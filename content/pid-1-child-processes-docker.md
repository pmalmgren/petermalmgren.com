---
title: "PID 1 Orphan Child Processes in Docker"
description: What happens to the child of PID 1 when PID 1 dies?
date: 2020-10-31T08:30:55-04:00
draft: false
categories: Linux
---
## Background

Last week I ran into some code that was behaving strangely. The code used the Python `multiprocessing` module and was spawning child workers. When the program received the `SIGTERM` event it would pass along the signal to its children, do some cleanup, and then call `sys.exit(0)`.

The first problem I saw was the parent process never waited the results of the children. 

The second problem I saw was that these child processes had their own `SIGTERM` handlers which could take up to 3 minutes to complete, depending on how much work they had left to do. 

And the third problem I saw was that this program was running inside of Docker, meaning the parent process was PID 1 and had already exited.

### PID 1 Responsibilities

To understand the third problem, we have to consider PID 1, or `init` process behavior in Linux.

PID 1 processes behave differently than other processes in a few different ways:

- They don't get the [default system signal handlers](/signal-handling-docker/), so they are responsible for defining their own
- They are responsible for reaping zombie processes, or processes that have terminated but whose exit statuses haven't been read
- Most importantly (for this scenario), they are responsible for adopting orphaned children and waiting on them to finish

## PID 1 Responsibility Checklist

When writing code that runs in a Docker container, there are four questions you'll want to answer:

1. Does your process respond to `SIGTERM` signals and gracefully shutdown?
2. If spawning child processes, does your parent forward signals to them?
3. If spawning child processes, does your parent process call `os.wait()` to see if they unexpectedly die?
4. If spawning child processes, do you wait on all of your processes to exit before exiting yourself?

Alternatively, if you don't wait to be responsible for these things you can set the `ENTRYPOINT` of your Docker container to be a lightweight `init` process, such as [tini](https://github.com/krallin/tini) which takes care of these for you.

## The Fix

The parent code, or the program running as PID 1, looks something like this:

```python
import sys, signal, os
from multiprocessing import Process

from child import run

processes = []

def graceful_exit(_signum, _frame):
    print("Gracefully shutting down")
    for p in processes:
        print(f"Shutting down process {p.pid}")
        p.terminate()
    sys.exit(0)

if __name__ == "__main__":
    for _ in range(10):
        proc = Process(target=run)
        proc.start()
        processes.append(proc)
    print(f"Parent process started: {os.getpid()}")
    signal.signal(signal.SIGTERM, graceful_exit)
    signal.signal(signal.SIGINT, graceful_exit)

    while True:
        time.sleep(0.5)
	print("Still here!")
```

Let's take this code through the above checklist to see what we need to do.

### ✅ Respond to signals

We correctly define signal handlers in this program for `SIGTERM` and `SIGINT` and call `sys.exit(0)`. Our signal handler isn't perfect, but at least we're catching them!

### ✅ Pass signals to children if necessary

Along with defining our signal handlers, we call `p.terminate()` which sends a `SIGTERM` to our child processes which forwards our signal along.

### ❌ Call `os.wait()` and handle unexpected exits

While our parent is running, it's not waiting to see if any of the child processes are dying. This means we're going to leave zombies in our Docker container.

To improve this situation, we can use `os.waitpid()` which suspends the parent process until a child exits. Passing `-1` to `os.waitpid()` tells it to wait on any process, and passing in the option `os.WNOHANG` has it return immediately if no child process has exited.

```python
import os

if __name__ == "__main__":
    for _ in range(10):
        proc = Process(target=run)
        proc.start()
        processes.append(proc)
    print(f"Parent process started: {os.getpid()}")
    signal.signal(signal.SIGTERM, graceful_exit)
    signal.signal(signal.SIGINT, graceful_exit)

    while True:
        pid, status = os.waitpid(-1, os.WNOHANG)
        time.sleep(0.5)
	print("Still here!")
```

### ❌ Wait on all child processes before exiting

In our exit handler, we don't properly wait on our children to exit after sending them the `SIGTERM` signal. This means that PID 1 can die before our children are done, leaving us in a weird situation.

To fix this, we'll make use of the `multiprocessing.Process.join` method, which calls `os.waitpid()` under the hood for UNIX sytems. We'll give each process 60 seconds to finish up work, and then send it a `SIGKILL`. The reason for sending a misbehaving process a `SIGKILL` is that if we don't do this, the operating system or our Kubernetes cluster probably will anyway, and it is really hard to detect when this happens. Having an indication of `SIGKILL` in our application logs is really handy for debugging misbehaving child processes.

```python
def graceful_exit(_signum, _frame):
    print("Gracefully shutting down")
    for p in processes:
        print(f"Shutting down process {p.pid}")
        p.terminate()
    for p in processes:
        print(f"Waiting for process {p.pid}")
        p.join(60)
	if p.exitcode is None:
            print(f"Sending SIGKILL to process {p.pid}")
            p.kill()
    sys.exit(0)
```

## The Mystery: What happens to child processes of PID 1 after PID 1 dies?

I still haven't figured out what happens to PID 1 orphan child processes after the container dies. My intuition is that whatever process is launching the containers (Docker, containerd) will deal with them, but I don't know how that works. I'll keep investigating and might have a post about this in the future.

If you know the answer, please let me know on Twitter [@ptmalmgren](https://twitter.com/ptmalmgren).

