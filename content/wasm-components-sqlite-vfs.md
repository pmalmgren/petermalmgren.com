---
title: "Building a SQLite VFS in JavaScript with WebAssembly Components"
date: 2023-09-25T07:00:00-04:00
categories: WebAssembly, SQLite
draft: false
---

## Introduction

The goal of this post is to explore an alternative way for running SQLite in JavaScript environments using the [WebAssembly component model](https://github.com/WebAssembly/component-model), including the implementation of a VFS for data persistence.

### What is the WebAssembly component model?

WebAssembly components are interfaces that declare types, functions, imports, and exports. These components are compiled into WebAssembly with a [special ABI](https://github.com/WebAssembly/component-model/blob/main/design/mvp/CanonicalABI.md).

After a WebAssembly component is compiled it can be embedded in different environments, such as a web browser or a server. These environments can call the exported interfaces and provide implementations for the imported interfaces that the component needs to function.

A good explanation is provided on the [component model GitHub repository](https://github.com/WebAssembly/component-model/blob/8f0a9175d5d3982c14aab581fc56a73552c9f74c/design/high-level/UseCases.md).

### What is the SQLite VFS?

The SQLite VFS is [officially defined as](https://www.sqlite.org/vfs.html):

> The module at the bottom of the SQLite implementation stack that provides portability across operating systems.

In other words, the SQLite VFS allows SQLite to run in any environment, provided that it has support for the following operations:

- Opening files in different modes, such as read only, read write, etc.
- Reading and writing data on open files
- File locking 
- Other required system behavior, for example getting the current time

A SQLite VFS can be implemented by subclassing three modules: `sqlite3_vfs`, `sqlite3_file`, and `sqlite3_io_methods`.

Once these modules are built, they can be registered with SQLite as a VFS with the `sqlite3_vfs_register` function.

Implementing a SQLite VFS in a way that supports data persistence is one of the main challenges of running SQLite in the browser.

### Existing tools

It is possible to run SQLite directly in the browser and/or Node using one of these libraries:

- [sql.js](https://github.com/sql-js/sql.js), which allows JavaScript access to a SQLite database
  - [absurd SQL](https://github.com/jlongster/absurd-sql) can be used for implementing a persistent VFS
- [the sqlite3 WASM/JS subproject](https://sqlite.org/wasm/doc/tip/about.md), which adds a WebAssembly build and JavaScript functionality to SQLite
- [wa-sqlite](https://github.com/rhashimoto/wa-sqlite), which allows for writing virtual filesystems (VFS) and virtual tables in Javascript

These libraries provide various degrees of support for data persistence in the browser.

[wa-sqlite](https://github.com/rhashimoto/wa-sqlite) differs slightly from other projects because it provides a [class called VFS.Base](https://github.com/rhashimoto/wa-sqlite/blob/122c46ea4d2f20308c0a3d62b79add048a2bef9c/src/VFS.js) that allows library consumers to implement their own VFS. Examples are provided for implementing a VFS with different web storage technologies, including the [origin private file system](https://github.com/rhashimoto/wa-sqlite/blob/122c46ea4d2f20308c0a3d62b79add048a2bef9c/src/examples/AccessHandlePoolVFS.js), and [IndexedDB](https://github.com/rhashimoto/wa-sqlite/blob/122c46ea4d2f20308c0a3d62b79add048a2bef9c/src/examples/IDBMinimalVFS.js).

In my opinion, the approach by Roy Hashimoto in wa-sqlite feels like the cleanest way to solve this problem, and the best work in this area to date.

All of the tools, including wa-sqlite, use [emscripten](https://emscripten.org/) to compile SQLite to WebAssembly and expose the C FFI in a WebAssembly binary.

These tools also re-export the C FFI in a JavaScript-friendly interface. This allows library consumers to directly use SQLite in JavaScript.

## How the WebAssembly component model fits in

Here is a high level summary of what a library must do to implement SQLite in the browser.

![a diagram showing the interactions between a SQLite JavaScript library, SQLite itself, and a library](sqlite-wasm.png)

The challenges and complexity lie in three areas:

1. Providing bindings between the SQLite WebAssembly module and JavaScript, including manipulating memory, dealing with pointers, and handling function calls
2. Using the bindings along with imported code to build a browser-aware SQLite VFS to provide data persistence
3. Exposing the bindings as exported code to allow library consumers to use SQLite in the browser

Theoretically, these are directly addressed by the WebAssembly component model proposal.

Practically, a number of different tools are needed to build a WebAssembly component:

1. [wit-bindgen](https://github.com/bytecodealliance/wit-bindgen) is used to define the import and export interfaces and generate the glue code in different guest languages
2. A supported guest language along with the [WASI SDK](https://github.com/WebAssembly/wasi-sdk). I chose Rust but C/C++, Go, Java, and possibly even [JavaScript](https://github.com/bytecodealliance/jco#componentize) are also supported
3. [wasm-tools](https://github.com/bytecodealliance/wasm-tools) is used to create the component from the WebAssembly binary
4. [jco](https://github.com/bytecodealliance/jco) is used to build a JavaScript interface to the WebAssembly component

Because there *are so many tools* I made this diagram to keep track of them:

![a diagram demonstrating how the four different sets of tools fit together](wasm-component-build.png)

The final artifact produced is `component.wasm`, which can be used along with [jco](https://github.com/bytecodealliance/jco) to create a JavaScript library. This library can be given import definitions to do things like implement a VFS or register custom user-defined functions. This library can also provide exports to open a database and perform SQL queries.

Here is a diagram demonstrating the last part of the build:

![a diagram demonstrating how jco is used to create a JavaScript library](component-to-js.png)

## Getting it to work

All of the code below is [here](https://github.com/pmalmgren/sqlite-wasm-component). There are three important parts:

- A Rust library which contains SQLite and the implementation of the WIT interfaces, compiled into WebAssembly
- WIT interfaces which export SQLite functionality to the browser, and import the required methods for a VFS
- A React app which imports the compiled library and provides the VFS implementation

### Compiling SQLite into WASM

I chose [rustqlite](https://docs.rs/sqlite/latest/sqlite/) because it supports the `wasm32-wasi` target. `wit-bindgen` is also included to generate the WIT interfaces.

```toml
[package]
name = "sqlite-component"
version = "0.1.0"
edition = "2021"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[lib]
crate-type = ["cdylib"]

[dependencies]
wit-bindgen = "0.8.0"
rusqlite = { version = "0.29.0", features = ["wasm32-wasi-vfs", "bundled"] }
```

Getting this to compile correctly is tricky. Here's how I got it to work:

1. By using the [wasi-sdk](https://github.com/WebAssembly/wasi-sdk) linker instead of the default Rust linker
2. With a custom `build.rs` and this linker flag: `println!("cargo:rustc-link-arg=--no-entry");` 
3. With a custom build script that I found on a comment in this [GitHub issue](https://github.com/rusqlite/rusqlite/issues/827#issuecomment-1042796161)

This build script was particularly helpful. Thanks to [polyrand](https://github.com/polyrand) for putting it together!

```bash
#!/usr/bin/env bash

# set WASI_SDK_PATH to the correct location in your system

export WASI_SYSROOT="${WASI_SDK_PATH}/share/wasi-sysroot"
export CC="${WASI_SDK_PATH}/bin/clang --sysroot=${WASI_SYSROOT}"
export AR="${WASI_SDK_PATH}/bin/llvm-ar"
export CC_wasm32_wasi="${CC}"
export CARGO_TARGET_WASM32_WASI_LINKER="${WASI_SDK_PATH}/bin/wasm-ld"

export LIBSQLITE3_FLAGS="\
    -DSQLITE_TEMP_STORE=2 \
    -DSQLITE_THREADSAFE=0 \
    -DSQLITE_OMIT_LOCALTIME \
    -DSQLITE_OMIT_LOAD_EXTENSION \
    -DLONGDOUBLE_TYPE=double"

cargo build --target "wasm32-wasi"

cp ./target/wasm32-wasi/debug/sqlite_component.wasm sqlite-component-core.wasm
```

This script must be provided with the path to wasi-sdk: `WASI_SDK=/lib/wasi-sdk ./build.sh`

### An Incomplete SQLite VFS WIT Interface

```wit
// wit/host.wit
package sqlite3-wasm-vfs:vfs

interface types {
  type sqlite-error = s32
  type sqlite-db = s32
  type file-id = s32
  flags open-flags {
    readonly,
    readwrite,
    create,
    deleteonclose,
    exclusive,
    autoproxy,
    uri,
    memory,
    main-db,
    temp-db,
    transient-db,
    main-journal,
    temp-journal,
    subjournal,
    super-journal,
    nomutex,
    fullmutex,
    privatecache,
    wal,
    nofollow,
    exrescode,
  }
}

interface imports {
  use types.{sqlite-error, open-flags, file-id}

  log: func(msg: string)
  vfs-open: func(name: string, id: file-id, in-flags: open-flags) -> result<open-flags, sqlite-error>
}

world vfs {
  use types.{sqlite-db, sqlite-error}
  export init: func()
  export sqlite-open: func(name: string, vfs: string) -> result<sqlite-db, sqlite-error>
  export register-vfs: func(name: string)
  import imports
}
```

_Note: because my mind was mostly on getting this to work, the interfaces probably aren't the best. Also, I used raw pointers for passing objects around across the wasm<->browser boundary, when I could have used a [resource](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md#item-resource) for borrowing._

This minimal proof-of-concept allows us to do a few things:

1. Initialize a database with the `init()` import
2. Register a custom VFS with the `registerVfs(name: string)` import, provided it defines and exports a `vfsOpen` function
3. Open a database with a name and the provided VFS
4. Log things to the browser provided that the browser code defines an exports a `log` function

### Rust: Provide WASI WIT Files

Because the compilation process uses a version of WASI which is converted to a WebAssembly component, I had to bring in and copy over some WIT files from the [preview2-prototyping repository](https://github.com/bytecodealliance/preview2-prototyping). I copied this stuff directly into the `wit/` folder of my repository.

### Rust: Define Exports

The `init` function calls the `sqlite3_initialize()` function that is exported from the `rustqlite` library. It also bypasses some of the `rustqlite` implementation, which allows us to use sqlite in single-threaded mode. 

```rust
fn init() {
    unsafe {
        assert_eq!(sqlite3_initialize(), SQLITE_OK, "Could not initialize SQLite");
        bypass_sqlite_initialization();
    }
}
```

I won't be going over the implementation of `registerVfs` because it's a ton of boilerplate, but I invite you to read it over [here](https://github.com/pmalmgren/sqlite-wasm-component/blob/main/src/lib.rs) if you're curious.

The `sqlite_open` function builds a path, the VFS name, and calls into `sqlite3_open_v2`, which in turn calls into the imported function `vfs_open`, which is where the browser takes over.

```rust
fn sqlite_open(path: String, vfs: String) -> Result<i32, i32> {
    let filename = match CString::new(path.as_str()) {
        Ok(fname) => fname,
        Err(err) => {
            log(format!("Error getting path: {err}").as_str());
            return Err(SQLITE_ERROR);
        }
    };
    let vfs_name = match CString::new(vfs) {
        Ok(vname) => vname,
        Err(err) => {
            log(format!("Error getting path: {err}").as_str());
            return Err(SQLITE_ERROR);
        },
    };
    unsafe {
        let mut db_ptr: *mut sqlite3 = std::ptr::null_mut();
        let flags = OpenFlags::default().bits();
        let res = sqlite3_open_v2(filename.as_ptr(), &mut db_ptr, flags, vfs_name.as_ptr());
        if res != SQLITE_OK {
            log(format!("Error opening database: {res}").as_str());
            return Err(res);
        }
        log("Successfully opened connection.");
        Ok(db_ptr as i32)
    }
}
```

These functions allow a very minimal version of SQLite to run in the browser.

### JavaScript: Building the WebAssembly Component

[jco](https://github.com/bytecodealliance/jco) can turn compiled WebAssembly into a WebAssembly component, and then turn that into a library that can be used in JavaScript. jco also takes care of building the shims for calling back and forth into WebAssembly, something that can be a major headache otherwise.

I used the following versions in `package.json`:

```json
{
  "devDependencies": {
    "@bytecodealliance/jco": "0.12.1",
    "@bytecodealliance/preview2-shim": "0.0.16",
  },
}
```

Afterwards, we can use the jco CLI to build a WebAssembly component like this:

```bash
$ pnpm exec jco new ../sqlite-component-core.wasm --wasi-reactor -o sqlite-component.wasm
```

The `--wasi-reactor` flag will pull a compatible WASI adapter and use that to build a WebAssembly component.

### JavaScript: Transpiling the WebAssembly Component

Next, we use the jco CLI [to transpile](https://github.com/bytecodealliance/jco#transpile) the WebAssembly component to JavaScript:

```bash
$ pnpm exec jco transpile sqlite-component.wasm \
    --no-nodejs-compat \
    --map sqlite3-wasm-vfs:vfs/imports=../imports \
    -o src/wasm
```

We also have to define the imports needed by our library:

```typescript
import type { OpenFlags } from "./wasm/interfaces/sqlite3-wasm-vfs-vfs-types";

const log = (out: string) => {
  console.log(out);
};

const vfsOpen = (name: string, fileId: number, flags: OpenFlags): OpenFlags => {
  console.log(`Opening ${name} with id ${fileId}`);
  return {
    readwrite: true
  }
}

export { log, vfsOpen }
```

### JavaScript: Using SQLite in a React Component

Finally, the cool part!

I used a client-side React app to access SQLite from a React component:

```tsx
import { useEffect, useState } from "react";
import { init, registerVfs, sqliteOpen } from "../wasm/sqlite-component";

const DB = "path.db";

export default function Hello() {
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized) {
      return;
    }
    init();
    registerVfs("test");
    setInitialized(true);
  }, [setInitialized, initialized]);
  useEffect(() => {
    if (initialized) {
      sqliteOpen("path.db", "test");
    }
  }, [initialized]);

  return (<h1>Hello SQLite!</h1>);
}
```

The app basically does nothing other than log some output to the console which proves that SQLite is working as expected.

![SQLite running in a react app, with console logging to prove it](/sqliteworks.png)

🎉

## Conclusion

The goal of this post is to draw attention to the [awesome work happening in WebAssembly by the Bytecode Alliance](https://bytecodealliance.org/), particularly around WebAssembly components and how they can be used to push the boundaries of what's possible in JS and embedded environments.

Even though my WIT interface only defined one VFS function, `vfsOpen`, I believe that it should be possible to extend and improve the approach I outlined here to run a fully customizable browser version of SQLite using WebAssembly components without the need for emscripten.

I hope this post sparks some further discussion between the SQLite project and the WebAssembly community on using WebAssembly components to embed and run SQLite.

I hope you enjoyed this post and found it helpful!

## Credits

Thanks to [@guybedford](https://twitter.com/guybedford) for proofreading this post and providing some tips on using the jco CLI to build WebAssembly components.

Thanks to the authors of [rustqlite](https://github.com/rusqlite/rusqlite) for providing and maintaining an awesome crate.