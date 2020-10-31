---
title: "PID 1 Signal Handling in Docker"
date: 2020-10-19T07:46:19-04:00
draft: false
categories: Site Reliability Engineering
categories_weight: 1
---

## tl;dr

Running Docker containers spawns processes with the PID of 1. If you run your container process wrapped in a shell script, this shell script will be PID 1 and will not pass along any signals to your child process. This means that `SIGTERM`, the signal used for graceful shutdown, will be ignored by your process.

To avoid this problem, you can use the [`exec`](https://www.man7.org/linux/man-pages/man1/bash.1.html) from within your wrapper shell script along with a custom signal handler. 

Alternatively, you can use an init-like process such as [dumb-init](https://github.com/Yelp/dumb-init) with signal-proxying capabilities.

## Background

Recently I encountered some unexpected behavior when working on an application deployed in Kubernetes. When pods were rotated during deployments they were being abruptly stopped with a `SIGKILL` and ignoring the `SIGTERM` signal sent at the start of the [pod termination process](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination).

After looking at the logs it was clear that the issue wasn't with our signal handling code, which looked something like this:

```python
import sys
import signal

import time


def signal_handler(signum, frame):
    print(f"Gracefully shutting down after receiving signal {signum}")
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    while True:
        time.sleep(0.5)  # simulate work
	print("Interrupt me")
```

Based on our logs, we weren't hitting the signal handler function at all.

We were running the application from a shell script that looked like this:

```bash
#!/bin/sh

./main.py
```

This script was being run from a Docker container that looked something like this:

```docker
FROM python:3.9-alpine3.12

COPY main.py .
COPY main .

CMD ["./main"]
```

## The Problem

If we take a look at the running processes in our container, we'll see what the `main` shell script has PID 1, and our `main.py` Python program will have another PID:

```bash
$ docker exec pedantic_matsumoto ps aux
PID   USER     TIME  COMMAND
    1 root      0:00 {main} /bin/sh ./main &
    6 root      0:00 python ./main.py
   12 root      0:00 ps aux

$ docker exec pedantic_matsumoto pstree -p
main(1)---python(6)
```

PID 1 processes in Linux do not have [any default signal handlers](https://docs.docker.com/engine/reference/run/#foreground) and as a result will not receive and propogate signals. They are also expected to take on certain responsibilities, such as adopting orphaned processes, and reaping zombie processes.

## Potential Solutions

### DIY Signal Handling and `exec`

The first way to get around this issue is to install custom signal handlers for `SIGTERM` and other signals you need directly in your application code, and then run `exec` in your wrapper shell script. This replaces the running process with your application.

For the application I gave as an example above, using `exec` means doing this:

```
#!/bin/sh

exec ./main.py
```

Your application still wouldn't be able to reap zombie processes or adopt orphaned processes, but it would be able to catch signals and handle them gracefully.

### dumb-init

[dumb-init](https://github.com/Yelp/dumb-init) is a simple init process which does everything an `init` process is supposed to do. If you install it in your Docker container and use it as your entrypoint, you'll be able to handle signals just fine.

## tini

If you run your Docker container with `--init`, Docker will automatically start its own init process as PID 1. The problem with using `tini` is that container orchestrators, such as Kubernetes, can't start your Docker container with the `--init` flag.

If you want to use `tini`, you'll have to download and install it in your `Dockerfile` and pass along the `-g` option for signal forwarding.
