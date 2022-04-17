
---
title: "Getting data in and out of WASI modules"
description: "Fun with wasmtime, linear memory, and external bindings"
date: 2022-04-17T08:56:08-04:00
categories: Web Assembly
draft: false
---

## The problem

After learning about WebAssembly, I kept running into a problem: Getting data in and out of WebAssembly, specifically server-side WebAssembly run with wasmtime, can be really hard.

Even though there are lots of examples of how to do this on the web, most of them focus specifically on JS and browser contexts. Here I’m going to focus on server-side WebAssembly, and in particular WebAssembly modules compiled into WebAssembly System Interface, or WASI.

## The (future) solution

The main limitation with WebAssembly is that it only supports four different types: i32, i64, f32, and f64. Passing around more complex values like strings, arrays, or record types can’t be done without some kind of glue code.

The WebAssembly interface types proposal looks like the most promising approach.

Once the interface types proposal is finalized and implemented, I think this will be the best path forward.

Another approach I’m not going to cover is using a library to produce the bindings and glue code. I recommend doing this unless you’re writing a platform for running compiled WebAssembly, which I am :).

You can use wasm-bindgen, which also has a way to produce bindings for browser and web APIs. There is also a newer library called [fp-bindgen](https://github.com/fiberplane/fp-bindgen) which helps produce bindings for non-web environments, like Rust.

## An example

Let’s say we want to run a compiled WASI module from Rust with this program:

```rust
fn main() -> Result<()> {
    let engine = Engine::default();
    let mut linker: Linker<WasiCtx> = Linker::new(&engine);
    wasmtime_wasi::add_to_linker(&mut linker, |s| s)?;
    let module = Module::from_file(&engine, "wasm-demo.wasm")?;
    let wasi = WasiCtxBuilder::new()
        .inherit_stdio()
        .inherit_args()?
        .build();
    let mut store = Store::new(&engine, wasi);
    linker.module(&mut store, "", &module)?;
    linker
        .get_default(&mut store, "")?
        .typed::<(), (), _>(&store)?
        .call(&mut store, ())?;
}
```

How do we get data in and out of the WASI module?

## Approach 1: Treat WASI like a regular program

WASI was designed to be POSIX-like. This means it has access to resources like files (including standard input and output), command line arguments, environment variables, pipes, and network sockets.

We can use stdin, stdout, and stderr to pass data in and out of the WASI module, kind of like a UNIX program. We could also use environment variables, or pass the arguments in with command line arguments. Because the environment variable and command line argument approaches are pretty straightforward, I’ll be describing how to share state with stdin and stdout, even if command line arguments are probably the better choice.

This approach requires coming up with a data format which supports serialization and de-serialization. We’ll also need a runtime which supports overriding stdin and stdout.

### Building a string multiplier with WASI stdio

Here is how I used this approach to build a WASI module which takes in a string and a number in a JSON object, then returns a serialized JSON object with the string repeated the specified number of times.

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Input {
    pub name: String,
    pub num: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Output {
    pub names: Vec<String>,
}
```

Since we’re using the wasmtime crate, we can use the WasiContextBuilder to specify the stdin and stdout of the WASI module. For convenience I used wasi-common and its WritePipe and ReadPipe structs.

```rust
let input = Input { name: "Rust".into(), num: 10 };
let serialized_input = serde_json::to_string(&input)?;

let stdin = ReadPipe::from(serialized_input);
let stdout = WritePipe::new_in_memory();

let wasi = WasiCtxBuilder::new()
    .stdin(Box::new(stdin.clone()))
    .stdout(Box::new(stdout.clone()))
    .inherit_stderr()
    .build();
let mut store = Store::new(&engine, wasi);

let module = Module::from_file(&engine, "wasi-demo.wasm")?;
linker.module(&mut store, "", &module)?;
linker
    .get_default(&mut store, "")?
    .typed::<(), (), _>(&store)?
    .call(&mut store, ())?;

drop(store);

let contents: Vec<u8> = stdout.try_into_inner()
    .map_err(|_err| anyhow::Error::msg("sole remaining reference"))?
    .into_inner();
let output: Output = serde_json::from_slice(&contents)?;
```

Calling `drop(store)` is important, otherwise converting the `WritePipe` into a `Vec<u8>` will fail. This is because the `WritePipe` wraps the data in an `Arc` and calls `try_unwrap` on it, which will fail unless there is only 1 strong reference to the data. The store holds a strong reference to the `WritePipe`.

## Approach 1 pros/cons

Coming up with a wire data format and using a serialization library introduces complexity. However, it also decouples things pretty nicely. Other approaches tend to be pretty opinionated about both the host and guest environment. We could use the wasmtime Python runtime, and write a WASI module with AssemblyScript.

This approach isn’t very flexible. Input is read at the beginning of the program from stdin, and when the program is done it will emit its output to stdout.

I can also only think of 3-4 languages which target WASI: C/C++, Rust, and AssemblyScript.

There are probably more pros and cons, but overall this approach works pretty well.

## Approach 2: Using exported functions and memory

WebAssembly functions can be exported by both the host and other modules. They are exposed to running WebAssembly code in wasmtime with a Linker object. This allows us to either compile a WebAssembly module and link that against a running WASI module, or to directly expose a host function which we can call from WebAssembly.

WebAssembly allows data to be shared between a host and a running WebAssembly module with linear memory. wasmtime does this with its Memory struct, which is accessible in the host function defined on the Linker object.

### Passing arguments through linear memory and a host callback

Linear memory is configured through the Store struct and is used by the guest when it allocates memory. Linear memory is allocated in pages of 64kb.

Here’s how we tell the store to allocate a single page of memory for use by a running wasm module:

```rust
let mut store = Store::new(&engine, wasi);
let memory_ty = MemoryType::new(1, None);
Memory::new(&mut store, memory_ty)?;
```

And here’s how we’re turning our Input into a serialized JSON object:

```rust
let input = Input { name: "hey".into(), num: 5 };
let buf = serde_json::to_vec(&input).expect("should serialize");
```

Once we have store set up, we need to figure out a way to get this serialized buffer into the running WebAssembly module.

#### Step 1: Export the host function

A host function runs on the guest, but is defined completely on the host. We can use a host function to manipulate memory inside the guest, write our serialized input, and check for errors.

Here is how we can use the Linker struct’s func_wrap method to define two exported hosts function, one two fetch the put and one to get the input size in bytes:

```rust
let input = Input { name: "hey".into(), num: 5 };
let buf = serde_json::to_vec(&input).expect("should serialize");
let input_size = buf.len() as i32;

linker
    .func_wrap("host", "get_input", move |mut caller: Caller<'_, WasiCtx>, ptr: i32| {
        // This will be explained in step 3 below
        println!("Hello from the host!");
        Ok(0)
    })
    .expect("should define the function");

linker
    .func_wrap("host", "get_input_size", move || -> i32 {
        input_size   
    })
    .expect("should define the function");
```

The first two arguments define the module and the exported function name, respectively. We’ll need to use these if we want to import the host functionality into our WebAssembly module.

The caller parameter to the Fn is pretty important. It contains a reference to the store and the memory it contains. The addresses on the host and on the guest are different, so it’s important that we only access memory using the guest provided offsets from within this Fn.

#### Step 2: Link against the function in WebAssembly

We can use the extern keyword to let the compiler know that we’re going to be importing a function from the host module called get_input. It takes an argument which is the offset to the memory we allocated in WebAssembly.

```rust
#[link(wasm_import_module = "host")]
extern {
    fn get_input(ptr: i32) -> ();
    fn get_input_size() -> i32;
}
```

Here’s how to allocate this from within the WebAssembly module:

```rust
fn main() {
    let mem_size = unsafe { get_input_size() };
    let mut buf: Vec<u8> = Vec::with_capacity(mem_size as usize);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(ptr);
}
```

#### Step 3: Write serialized input to linear memory

Here’s the function I used to write the serialized input to linear memory. First, we fetch the exported memory from the compiled WebAssembly module, and write our serialized input at the location passed in from the module:

```rust
let linker = linker
    .func_wrap(
        "host",
        "get_input",
        move |mut caller: Caller<'_, WasiCtx>, ptr: i32| {
            let mem = match caller.get_export("memory") {
                Some(Extern::Memory(mem)) => mem,
                _ => return Err(Trap::new("failed to find host memory")),
            };
            let offset = ptr as u32 as usize;
            match mem.write(&mut caller, offset, &buf) {
                Ok(_) => {}
                _ => return Err(Trap::new("failed to write to host memory")),
            };
            let offset = ptr as i32;
            Ok(())
        },
    )
    .expect("should define the function");
```

#### Step 4: Get the input and de-serialize it into a vec

Finally, we can allocate memory on the host, pass in the location to the memory to get_input, and serialize the result:

```rust
fn main() -> Result<(), box<dyn std::error::Error>> {
    let mem_size = unsafe { get_input_size() };

    let mut buf: Vec<u8> = Vec::with_capacity(mem_size as usize);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(ptr);

    let input_buf = unsafe {
        get_input(ptr as i32);
        Vec::from_raw_parts(ptr, mem_size as usize, mem_size as usize)
    };

    println!("input_buf = {:?}", input_buf);

    let input: Input = serde_json::from_slice(&input_buf)
        .map_err(|e| {
            eprintln!("ser: {e}");
            e
        })?;
    
    println!("input = {:?}", input);
}
```

Unfortunately, we do need to call Vec::from_raw_parts, which is unsafe and quite dangerous. But since WebAssembly is sand boxed, overwriting memory bounds will produce a trap and shouldn’t be able to do too much damage.

#### Step 5 (skipped): Write the output to a buffer and pass it back to the host

I'm going to skip explaining how I did this because it would repeat a lot of things I explained earlier in the blog post.

If you're curious, there is a working example [on GitHub](https://github.com/pmalmgren/wasi-data-sharing/tree/shared-linear-memory-demo).

### Linear memory pros/cons

Using linear memory should be pretty fast. This is the only advantage I can think of.

The downsides to using linear memory are: unsafe code, fragmentation (allocation is done in pages), and the complexities of managing memory on the runtime. If you provide a platform for people to run WebAssembly on, you’ll probably have to deal with memory. Otherwise, I think using the first approach is probably better.

## Conclusion

WebAssembly is really fun but passing in data can be a bit of a pain 😅. Interface types should help take care of this in the future.

Here is a full working version of the code for the [sharing with stdio](https://github.com/pmalmgren/wasi-data-sharing/tree/shared-stdio-demo) and [sharing with memory](https://github.com/pmalmgren/wasi-data-sharing/tree/shared-linear-memory-demo) approaches.

## References

Here are the docs and blog posts which helped me learn this stuff, in no particular order:

- [wasmtime docs](https://docs.wasmtime.dev/)
- [A practical guide to WebAssembly memory](https://radu-matei.com/blog/practical-guide-to-wasm-memory/)
- [@adlrocha - Playing with Wasmtime and Web Assembly’s linear memory](https://adlrocha.substack.com/p/adlrocha-playing-with-wasmtime-and)
