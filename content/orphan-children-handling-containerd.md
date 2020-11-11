---
title: "Orphan Process Handling in Docker"
description: "What happens if a processes parent dies in a Docker container?"
date: 2020-11-11T07:32:34-05:00
draft: false
categories: Observability
categories_weight: 1
---

## Background

Last week I [posted about a program which was behaving strangely](/pid-1-child-processes-docker/) because it wasn't properly cleaning up its child processes after receiving the `SIGTERM` signal. The fix was to wait for the child processes to exit before exiting from the parent, but I never figured out what was happening to orphaned processes after the parent (a PID 1 process in that namespace) exited.

After cleaning up the code and fixing the bug, I still didn't have any idea what was actually happening to the orphan child process running in Docker after its parent died. Here is a braindump of how I figured this out.

## Edit: I found why the parent wasn't shutting down correctly

I was launching new Python processes with the `multiprocessing` Python module. Part of this module involves registering a cleanup function using the `atexit` handler. In this cleanup function, all running processes are waited on with `.join()`, which makes our parent process sleep indefinitely until the children are done running.

See the [multiprocessing/util.py](https://github.com/python/cpython/blob/33922cb0aa0c81ebff91ab4e938a58dfec2acf19/Lib/multiprocessing/util.py#L362) file for more details.

I'll leave the rest of this post up just in case anyone finds the BPF programs I used interesting.

## Setup

Here's a minimal Dockerfile and two Python programs I used to investigate this. The parent process handles a `SIGTERM`, passes the signal along to its child, and then calls `sys.exit(0)`. The child process also handles the signal, but doesn't exit.

You can view all of the code needed to reproduce this problem here: https://gist.github.com/pmalmgren/7bae3262047b32416062d9843210c4b2

## Initial Investigation

`docker top` is a quick way to see the PID of any process running in Docker. It includes the non-namespaced PID and PPID, because inside the container the first process spawned will see itself as PID 1. Let's take a look at our containerized process:

```bash
# Terminal 1
$ docker run --rm -ti bad-parent
Parent process started: 1
Hello from child 6
Parent still alive!
Parent still alive!
Parent still alive!
...

# Terminal 2
$ docker top c44466ae62ec
UID                 PID                 PPID                ...                 CMD
root                294147              296942              ...                 python parent.py
root                294200              294147              ...                 python parent.py
```

Now let's take a look at the PID 294129 the parent process of our container, noting that names inside `{}` are threads:

```bash
$ pstree -ps -U 296942          
systemd(1)───containerd(1171)───containerd-shim(296942)─┬─python(294147)───python(294200)
                                                        ├─{containerd-shim}(296943)
                                                        ├─{containerd-shim}(296944)
                                                        ├─{containerd-shim}(296945)
                                                        └─...
```

To see what processes are receiving which signals, I used the [signals.bt](https://github.com/brendangregg/bpf-perf-tools-book/blob/master/originals/Ch13_Applications/signals.bt) script introduced in [BPF Performance Tools](http://www.brendangregg.com/blog/2019-07-15/bpf-performance-tools-book.html). I made a small modification to allow filtering based on the process name:

```bpf
tracepoint:signal:signal_generate
{
	if (str($1) == "0" || args->comm == str($1)) {
		@[@sig[args->sig], args->pid, args->comm] = count();
	}
}
```

Next I found something surprising: After sending the Docker container a `SIGTERM`, I found that it calls `sys.exit(0)` and stops execution of the Python script, but the parent process actually stays alive!

```bash
# Terminal 1
$ docker kill --signal=SIGTERM c44466ae62ec
c44466ae62ec

# Running docker process
$ docker run --rm -ti bad-parent
Parent process started: 1
Hello from child 6
Parent still alive!
...
Gracefully shutting down
Shutting down process 6
Child 6[ppid=1] received SIGTERM...
```

And here's the output of `signals.bt` for the `containerd-shim` process:

```bash
# Terminal 1
$ sudo signals.bt "containerd-shim"
Attaching 3 probes...
Counting signals. Hit Ctrl-C to end.
^C
@[SIGNAL, PID, COMM] = COUNT

@[SIGCHLD, 296943, containerd-shim]: 1

# Terminal 2

$ sudo signals.bt "python"
Attaching 3 probes...
Counting signals. Hit Ctrl-C to end.
^C
@[SIGNAL, PID, COMM] = COUNT

@[SIGTERM, 294147, python]: 1
@[SIGTERM, 294200, python]: 1
```

The one clue I see here is that a containerd-shim thread, `296943`, received a `SIGCHLD` process. My guess is that `containerd-shim` spawns a number of threads to handle signals, although it is unclear if it lets the kernel route the signals to a random thread (the default behavior for a process with many threads), or if it blocks signals in all but one threads.

To find out, we can take a look at the `/proc/${PID}/status` file, which [contains a human-readable process status](https://www.kernel.org/doc/html/latest/filesystems/proc.html) including signal masks. Let's look at it for the thread that received the `SIGCHLD` and some of its siblings:

```bash
$ cat /proc/296943/status
Name:   containerd-shim
Umask:  0022
State:  S (sleeping)
...
SigCgt: fffffffe7fc1feff
...
$ cat /proc/296945/status
Name:   containerd-shim
Umask:  0022
State:  S (sleeping)
...
SigCgt: fffffffe7fc1feff
...
```

Next, we can take a look at what is happening with our process which called `sys.exit(0)` but is still somehow alive:

```bash
$ head -n 10 /proc/296945/status
Name:   python
Umask:  0022
State:  S (sleeping)
Tgid:   296945
Ngid:   0
Pid:    296945
```

It looks like the process just went to sleep. We do have a call to `time.sleep()` which should be happening every half a second or so. Let's see what syscalls, if any, our process is calling with `syscount-bpff`:

```bash
$ sudo syscount-bpfcc -p 296954
Tracing syscalls, printing top 10... Ctrl+C to quit.
^C[09:33:00]
SYSCALL                   COUNT

Detaching...
```

This output shows absolutely no syscalls during a 10 second period. So it's pretty clear that something has taken control of our process and put it to sleep!

## What is happening during container shutdown?

Let's run `syscount-bpfcc` on the parent `containerd-shim` process before and during the process shutdown process to see what's happening:

```bash
# Before shutdown
$ sudo syscount-bpfcc -p 696458
Tracing syscalls, printing top 10... Ctrl+C to quit.
^C[09:38:23]
SYSCALL                   COUNT
nanosleep                    69
futex                        46
read                         16
epoll_pwait                  16
epoll_wait                    8
write                         8

Detaching...

# During shutdown
$ sudo syscount-bpfcc -p 696458
Tracing syscalls, printing top 10... Ctrl+C to quit.
^C[09:39:42]
SYSCALL                   COUNT
nanosleep                   386
futex                       163
epoll_pwait                  57
read                         53
write                        25
epoll_wait                   23
fcntl                         8
epoll_ctl                     6
close                         5
newfstatat                    4
```

After looking at the four different syscalls being called during shutdown, I don't think that any of these would be responsible for holding our process in a sleep state.

## What is happening during container startup?

Containers start using the `clone` system call. Let's trace that to see what is starting our containers:

```bash
$ sudo bpftrace -e 'tracepoint:syscalls:sys_enter_clone { printf("PID %d %s\n", pid, comm); }'

PID 1171 containerd
PID 1438914 containerd-shim
PID 1438914 containerd-shim
PID 1438914 containerd-shim
PID 1438914 containerd-shim
PID 1438914 containerd-shim
PID 1438914 containerd-shim
PID 1438914 containerd-shim
PID 1438914 containerd-shim
PID 1438914 containerd-shim
PID 1438923 runc
PID 1438923 runc
PID 1438923 runc
PID 1438923 runc
PID 1438923 runc
PID 1438923 runc
PID 1438923 runc
PID 1438929 runc:[0:PARENT]
PID 1438931 runc:[1:CHILD]
PID 1438933 runc:[2:INIT]
PID 1438933 runc:[2:INIT]
PID 1438933 runc:[2:INIT]
PID 1438933 runc:[2:INIT]
```

At this point it looks like `runc` may be responsible for this weird behavior, and not `containerd`.

## Running our container with just `runc`

To eliminate the possibility that `containerd` has anything to do with this weird behavior, let's run our container with just `runc` and see what happens. I followed the instructions on the [runc GitHub repository](https://github.com/opencontainers/runc/blob/v1.0.0-rc4/README.md#running-containers) for running containers. Here's what happens:

```bash
$ sudo runc create bad-parent
$ sudo runc start bad-parent
Parent process started: 1
Parent still alive!
Hello from child 7
Parent still alive!
...

$ sudo runc kill bad-parent
Gracefully shutting down 1
Shutting down process 7
Child 7[ppid=1] received SIGTERM...

$ sudo runc list
ID           PID         STATUS      BUNDLE                                              CREATED                          OWNER
bad-parent   1444776     running     /home/petermalmgren/code/docker-orphan-child-test   2020-11-11T13:21:54.872566227Z   root

$ sudo runc kill bad-parent
Gracefully shutting down 1
Shutting down process 7
Child 7[ppid=1] received SIGTERM...

$ sudo runc list
ID           PID         STATUS      BUNDLE                                              CREATED                          OWNER
bad-parent   0           stopped     /home/petermalmgren/code/docker-orphan-child-test   2020-11-11T13:21:54.872566227Z   root
```

In a separate terminal I ran:

```bash
$ sudo signals.bt "python"
Attaching 3 probes...
Counting signals. Hit Ctrl-C to end.
^C
@[SIGNAL, PID, COMM] = COUNT

@[SIGKILL, 1444823, python]: 1
@[SIGTERM, 1444776, python]: 1
@[SIGTERM, 1444823, python]: 1
```

## Checking syscalls of the Python process

I forgot to do something obvious above, which was check the syscalls of the Python process when it exits. Here's what that looks like:

```bash
$ sudo syscount-bpfcc -p 1491744
Tracing syscalls, printing top 10... Ctrl+C to quit.
^C[13:01:31]
SYSCALL                   COUNT
write                         9
select                        8
wait4                         2
getpid                        2
kill                          1
```

`wait4` is what processes use to wait on children. And after some quick investigation, I realized that the `multiprocessing` module registers an `atexit` handler which will wait indefinitely for children to finish. This is why our process is showing up as sleeping.

## I was looking in the wrong rabbit hole

I probably should've checked the behavior of `sys.exit(0)` and `multiprocessing` first before assuming there was something wrong with `runc` or `containerd`!
