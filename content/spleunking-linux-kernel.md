---
title: "How I Find Things in the Linux Kernel"
description: How I use livegrep and some online search tools to figure out what's happening in the Linux kernel
date: 2021-04-23T08:56:08-04:00
categories: Recurse Center 2021
draft: false
---

## Why dive into the Linux source code?

Here are a few of reasons I've chosen to read the Linux source:

- Curiosity, ex. [what happens when you make an open() system call](https://github.com/pmalmgren/bpf-linux-internals/blob/main/open/open-trace.bt)
- Debugging an issue which may be caused by a kernel bug, or strange kernel behavior
- Performance at the system level, ex. answering questions like: Where in the Linux kernel is my code calling into and spending the most time?
- I think it's fun :)

I've felt a bit intimidated in the past by opening up the Linux source tree and reading through the code. 

The three things that helped me get over this feeling were having a basic understanding of the Linux kernel architecture, having some tools to search the Linux kernel code, and knowing how to trace my programs in real time to see which code is getting called and when.

## Understanding the basic kernel architecture

If you're curious and want to learn more, I recommend diving a bit deeper using a few of the following books and websites (note: I don't use affiliate links or anything):

- [linux-insides](https://0xax.gitbooks.io/linux-insides/content/) is a free Git book which has lots of details about Linux internals
- [the kernel.org docs](https://www.kernel.org/doc/html/latest/index.html) can have some good information
- [The Linux Programming Interface](https://man7.org/tlpi/) is a wonderful book about the interface that programs use to talk to Linux
- [Understanding the Linux Kernel](https://www.oreilly.com/library/view/understanding-the-linux/0596005652/) is a good book which goes into lots of details about Linux

I'll be going briefly into the two things that I think are fundamental to understanding how the Linux kernel work: system calls and interrupt handling.

### System calls

I like to think of the Linux kernel as a kind of server which provides APIs for things like access to the CPU, network data, keyboard keystrokes, mouse movements, files on the hard drive, and lots of other things. The programs we run on Linux, like web browsers and text editors, are the clients. They call into the Linux kernel using provided APIs to get access to resources.

The API of the Linux kernel is available through system calls. System calls have names, such as `read()` for reading a file that we can call directly in our code. When looking to see what's going on on Linux, the first place you can start is with system calls.

These are defined with a macro called `SYSCALL_DEFINE3` which generally takes the form, `SYSCALL_DEFINE3(syscall_name, args...)`.

You can also find them listed in the system call table. Here is a link to see all of the [system calls for the x86_64 architecture](https://github.com/torvalds/linux/blob/18a3c5f7abfdf97f88536d35338ebbee119c355c/arch/x86/entry/syscalls/syscall_64.tbl#L11).

### Interrupts, top half, and bottom half work

The Linux kernel is split into two halves. The top half responds to "interrupts" which come to the CPU from some device or timer. An interrupt can be something like:

- A network card has some data ready to be read
- A user typed something on the keyboard
- A timer went off

The top half's responsibility is to immediately handle the interrupt and schedule some work later to take care of it. The bottom half picks up the work and does any processing required, such as notifying your web browser that a response came back from a server, or notifying your terminal program that a key was typed.

Generally, if you're trying to look for data that is coming in (network, keyboard, etc.) from I/O, this will be somewhere in the bottom half.

## Tools to search the Linux source

I have three methods that I like to use to search the Linux source: [livegrep](https://livegrep.com/search/linux), [lxr](https://elixir.bootlin.com/linux/latest/source), and [ctags](https://kernelnewbies.org/FAQ/CodeBrowsing).

Livegrep and lxr are useful for quick searches. 

Livegrep has a web interface where you can search against paths, specific file types (*.c, *.h), and use regular expressions in your search.

lxr has better code navigation and kernel version support than Livegrep, so I usually use both of them together.

### ctags and a text editor

Before you get started with this method, you'll want to make sure you're in an editor which has the following functionality:

- File-search and open, this is available in VSCode by hitting ctrl-p, and in vim by using [fzf.vim](https://github.com/junegunn/fzf.vim)
- A ctags plugin, which reads a ctag database file and allows you to ctrl-click into code

Next, you need to figure out what version of the kernel you're on. `uname -r` should do the trick on Linux. Then you'll want to download the release tarball for the version of Linux that shows up. You can run `git clone` too, but Linux has so many commits that it will take a long time and fill up a huge amount of hard drive space, so I strongly recommend that you download a release tarball of the source.

Go to [the kernel.org release page](https://www.kernel.org/category/releases.html) or [the Linux GitHub page](https://github.com/torvalds/linux) to download a release zip or tarball.

Once you have your ctag database generated, you can ctrl-click your way through the code to explore code paths.

### Finding system calls

Here's a common query I use to find a system call implementation:

```c
SYSCALL_DEFINE3(open
```

This will give you the general location of the syscall entry point in the code. From there, I usually switch to another method, which is using a text editor with a ctags extension. I have used both `vscode` and `vim` for this.

Here is the search result for `SYSCALL_DEFINE3(open` at lxr:

[`fs/open.c#L1185`](https://elixir.bootlin.com/linux/latest/source/fs/open.c#L1185)
```c
SYSCALL_DEFINE3(open, const char __user *, filename, int, flags, umode_t, mode)
{
	if (force_o_largefile())
		flags |= O_LARGEFILE;
	return do_sys_open(AT_FDCWD, filename, flags, mode);
}
```

Here's the body of `do_sys_open`, which will give us some more clues on where to look:

```c
long do_sys_open(int dfd, const char __user *filename, int flags, umode_t mode)
{
	struct open_how how = build_open_how(flags, mode);
	return do_sys_openat2(dfd, filename, &how);
}
```

`do_sys_openat2` ends up calling into `do_filp_open`, which we will be tracing as part of the example below.

## Tracing with `bpftrace`

Here's the code we'll be tracing. It is a C program which opens and closes a file:

```c
#include <stdio.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdlib.h>

void do_open(char *file) {
    int fd = open(file, O_RDONLY);

    if (fd == -1) {
        perror("open");
        exit(1);
    }

    if (close(fd) == -1) {
        perror("close");
        exit(1);
    }
}

int main(int argc, char *argv[]) {
    if (argc != 2) {
        printf("Usage: open [file]\n");
        return 1;
    }
    
    do_open(argv[1]);
}
```

I compiled it with `-static` so that it won't open `libc` when it does dynamic linking.

```sh
$ gcc -static open.c -o open
```

### How to trace Linux kernel code

There are other ways to trace kernel code, but I find [`bpftrace`](https://github.com/iovisor/bpftrace) along with [`kprobes`](https://lwn.net/Articles/132196/) to be really flexible.

I won't go into a full explanation of how to use `bpftrace`, but the syntax looks something like this:

```sh
#!/usr/bin/bpftrace

[probe type (kprobe or kretprobe)]:[linux kernel function name] / filters /
{
	...this code runs when the probe runs...
}
```

Probes can be anything from static tracepoints to kprobes. We'll use kprobes, which are neat because they can hook into _any function_ currently in the running kernel. The downside to this flexibility is that functions go away or get renamed between kernel releases, which can cause our `bpftrace` programs to fail.

`kprobes` attach to _symbols of the compiled code_, which is not necessarily the same as the symbols we see in the original source. To verify that a symbol is present in our running kernel, we can check the `/proc/kallsyms` file to see if the symbol is there.

```sh
$ grep "do_filp_open" /proc/kallsyms
0000000000000000 T do_filp_open
$ grep "do_sys_openat2" /proc/kallsyms
0000000000000000 t do_sys_openat2
```

Next, we can probe that using a `kprobe` and a `kretprobe`. A `kprobe` is triggered on a function call and a `kretprobe` gets triggered on the return of a function call. Each argument is made available via `arg[x]` where `x` is the argument number. We can see that `do_sys_openat2` takes 3 arguments, the second of which is a filename, and use this knowledge to print out the filename.

```sh
#!/usr/bin/bpftrace

kprobe:do_sys_openat2 / comm == $1 / 
{
	printf("do_sys_openat2(_, filename=%s, _)", str(arg1));
}
```

If we run the program with:

```sh
$ sudo ./opentrace.bt "open"
```

And then run the following command in another terminal:

```sh
$ ./open open.c
```

We should see the following output:

```sh
Attaching 1 probe...
do_sys_openat(_, filename=open.c, _)
^C
```

Our `bpftrace` code is running whenever `do_sys_openat2` in the Linux kernel is running, which is pretty neat!

### More complex data structures

Sometimes the arguments to functions will be C structs, and/or functions will return structs. How can we trace these?

A cool thing about `bpftrace` is that you can include Linux kernel header files where the struct is defined. For example, `do_filp_open` takes a `struct filename*` as its second argument. To unpack this, we can add an include at the top where it is defined:

```sh
#!/usr/bin/bpftrace

#include <linux/fs.h>

kprobe:do_filp_open /comm == str($1)/ 
{
	$filename = str(((struct filename *)arg1)->uptr);
	printf("do_filp_open(dfd=%d, filename->name=%s)\n", arg0, $filename);
}
```

Now we can reference the struct in our `bpftrace` code!

### Structs defined in a .c file

Sometimes a struct will only be defined in a `.c` file, which means we can't include it in `bpftrace`. In these cases we have to manually define the `struct` at the top of our `bpftrace` program.

Path lookup in Linux uses a struct called `nameidata` which is defined in [fs/namei.c](https://elixir.bootlin.com/linux/latest/source/fs/namei.c#L502). We can simply copy-paste this struct into the top of our `bpftrace` program if we wanted to look at that if we were tracing `walk_component` during path lookup.

## More bpftrace stuff

I recommend checking out the [`bpftrace` One-Liner Tutorial](https://github.com/iovisor/bpftrace/blob/master/docs/tutorial_one_liners.md) which has more cool stuff you can do with `bpftrace`.

I also really like this talk by Brendan Gregg where he uses bpftrace to turn his wifi signal strength into something that sounds like a theramin: http://www.brendangregg.com/blog/2019-12-22/bpf-theremin.html
