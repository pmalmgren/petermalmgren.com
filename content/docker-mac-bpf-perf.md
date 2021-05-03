---
title: "Running eBPF and Perf in Docker for Mac"
description: How to spy on your macOS Docker Containers
date: 2020-12-17T16:26:17-05:00
categories: Linux
draft: false
---

## Motivation

This week I noticed a big slowdown in my development environment which runs in [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop).

Docker on a mac is a Linux VM, and because Linux supports tools that I'm already familiar with such as [perf](https://perf.wiki.kernel.org/index.php/Main_Page) and [eBPF](http://www.brendangregg.com/ebpf.html), I decided to use those from inside the Linux VM to see what the issue was.

## Update

### 2021-05-03

[Dominic White](https://twitter.com/singe/status/1389224943435620360?s=20) pointed out that Docker publishes their kernel sources in an [official Docker image](https://hub.docker.com/r/docker/for-desktop-kernel/tags?page=1&ordering=last_updated) for certain Docker Desktop releases.

Instead of downloading the sources manually, you can use one of these official Docker images instead. Check out Dominic's [ebpf-docker-for-mac GitHub repository](https://github.com/singe/ebpf-docker-for-mac) for an easier way to do this than the one I described below. Thanks Dominic!

## How to access the VM that runs Docker for Mac

I used the Docker image [justincormack/nsenter1](https://github.com/justincormack/nsenter1) which starts a shell on the host system:

```bash
$ docker run -it --rm --privileged --pid=host justincormack/nsenter1
```

This gives you full access to the Docker VM. You can also just use `--pid=host` if you want to start any other Docker container to inspect running processes.

## Basic observability

Before diving too deeply into `perf` or `eBPF` to look for performance problems, it helps to know where to start. Netflix has an excellent post called [Linux Performance Analysis in 60,000 Milliseconds](https://netflixtechblog.com/linux-performance-analysis-in-60-000-milliseconds-accc10403c55) which recommends some good tools. I recommend that you install these inside of your Docker containers to help with performance analysis. In my case, running `pidstat` and `mpstat` was sufficient to discover the cause of my slow builds.

One helpful Docker-specific tool is `docker stats`, which is a `top`-like tool for monitoring the status of running Docker containers. It displays each container and its CPU usage, memory usage, and other resource information. It runs from the host, so you don't need to do anything other than have Docker installed.

Another helpful tool is the `/sys/fs/cgroups` directory. Docker containers can be throttled by cgroup CPU limits, and when this happens a throttle counter will be incremented in `/sys/fs/cgroup/cpu,cpuacct/docker/{container-hash}/cpu.stat`. This is a good way to see if performance issues are due to container issues (cgroup throttling) or if they're due to host issues such as CPU saturation. This directory is accessible from within your VM, so you'll want to run this command to start a shell and inspect it:

```bash
host$ docker run -it --rm --privileged --pid=host justincormack/nsenter1
container# cat /sys/fs/cgroup/cpu,cpuacct/docker/.../cpu.stat
```

## perf from inside the container

`perf` is a really powerful tool that provides visibility into a lot of different events on a Linux system. Most of its functionality require root access, i.e. [privileged containers](https://docs.docker.com/engine/reference/commandline/run/#full-container-capabilities---privileged), in order to work. This means that to get it running inside of Docker, you'll need to pass the `--privileged` flag OR find a way to add `CAP_PERFMON` to your container which seems to be [temporarily disabled](https://github.com/moby/moby/pull/41563) by Docker.

_Please note that privileged containers are NOT recommended in production, so use this flag with caution!_

You'll also need to install `perf` in your container. This involves either manually running `apt-get install linux-perf` immediately after spawning a shell or adding it to your `Dockerfile`. 

The commonly used `perf record` command dumps data to disk, so I also recommend mounting a volume to persist data across container runs and to do analysis on your host machine after profiling is done.

I also installed `tmux` so I could run the command causing the problem in one pane, and run `perf record` in the other pane. An alternative would be to run `docker exec` into your running container, which would work well for something like a server.

```bash
host$ mkdir perf_data
host$ docker run --priviliged -v $PWD:perf_data:/perf_data --rm [image] bash
...
container# apt-get install perf
container# cd /perf_data
container# perf record -F 99 ...
```

I recommend checking out [CPU Flame Graphs](http://www.brendangregg.com/FlameGraphs/cpuflamegraphs.html), a blog post by Brendan Gregg, which outlines how to use perf output to make flamegraphs. These make it really easy to visualize where your program is spending lots of time.

## BCC tools and bpftrace

BCC tools and bpftrace provide a way to perform more in-depth performance analysis, but require a little bit more work to get up and running in the macOS Docker environment.

In most cases, if you run Docker on a Linux host it shares the kernel with the Linux host. eBPF tools such as BCC and bpftrace, especially for older Linux Kernels, rely on Linux kernel headers. These do not ship with the Docker Desktop for macOS VM, so I had to find a way to compile and install them which is the hardest part of getting BCC tools and bpftrace working.

Fortunately, [bpftrace](https://github.com/iovisor/bpftrace/blob/master/INSTALL.md#kernel-headers-install) has an informative guide on installing kernel headers which I used as a starting point to get eBPF working. However, it uses the Linux kernel git repository, and Docker for Mac uses a fork of the Linux kernel called [linuxkit](https://github.com/linuxkit/linux). I'm not sure if there is any difference between the two, but I used the `linuxkit` fork to be safe.

### Download the linuxkit source

Here is the command I ran on the host (my macOS laptop) to download the Linux kernel sources. Unfortunately my kernel version didn't have a release tag in the `linuxkit` repository, so I had to do a checkout and clone instead of downloading a tarball.

```bash
$ git clone --depth 1 --branch v4.19.121 https://github.com/linuxkit/linux 4.19.121-linuxkit
```

### Configure a Docker image to compile the kernel headers

Once you have the Linux source, you'll need a way to prepare the headers. This doesn't work very well from macOS so I chose to do it in Linux. Here's a `Dockerfile` with all the tools needed to do this. The image is based off of [zlim/bcc](https://github.com/zlim/bcc-docker), which contains BCC tools.

```Dockerfile
FROM zlim/bcc

RUN apt-get -y -qq update && apt-get -y -qq install gcc make bison flex bc libelf-dev vim
```

```bash
$ docker build -t docker-bpf .
```

I also didn't want to have to send the Linux kernel source (which is around 1GB) to the Docker daemon for each build, so I decided to add the `4.19.121-linuxkit` directory to `.dockerignore` and mount it as a volume. This would ensure that preparing the Linux headers would persist across container runs and the container would boot up fast. However, this also means that there are some manual steps to run after the container boots up. These could probably be automated in an `entrypoint.sh` script.

### Run the Docker container and prepare headers

BCC looks for kernel headers in the `/lib/modules/$(uname -r)/source` and `/lib/modules/$(uname -r)/build` directories, which are typically symlinked to `/usr/src/$(uname-r)`. Although I don't know why this works because `/lib/modules` does not exist on my macOS laptop, I was able to pass in `-v /lib/modules:/lib/modules:ro` which booted the container up with the symlinks already installed to `/usr/src/$(uname -r)`.

Here's the command to boot the container:

```bash
$ docker run -it --rm \
  --privileged \
  -v /lib/modules:/lib/modules:ro \
  -v $PWD/4.19.121-linuxkit:/usr/src/4.19.121-linuxkit \
  -v /etc/localtime:/etc/localtime:ro \
  --workdir /usr/share/bcc/tools \
  docker-bpf
```

Once inside, you will have to configure and prepare your headers:

```bash
container# cd /usr/src/$(uname -r)
container# make defconfig
```

After running `make defconfig`, you'll want to make sure that the following options are specified in the `.config` file:

```bash
CONFIG_BPF=y
CONFIG_BPF_SYSCALL=y
CONFIG_BPF_JIT=y
CONFIG_HAVE_EBPF_JIT=y
CONFIG_BPF_EVENTS=y
CONFIG_FTRACE_SYSCALLS=y
```

Once those are in, you can prepare your headers and run a BCC tool to test that it worked:

```bash
container# make prepare
container# cd /usr/share/bcc/tools
container# ./profile 1
Sampling at 49 Hertz of all threads by user + kernel stack for 1 secs.
```

### Use `--pid=host` to see all processes

Once you have your headers prepared and BCC tools installed, I recommend running them inside of a container with the `--pid=host` argument passed into `docker run`. This allows you to trace and observe any running Docker container on the VM.

```bash
$ docker run -it --rm \
  --privileged \
  --pid=host \
  -v /lib/modules:/lib/modules:ro \
  -v $PWD/4.19.121-linuxkit:/usr/src/4.19.121-linuxkit \
  -v /etc/localtime:/etc/localtime:ro \
  --workdir /usr/share/bcc/tools \
  docker-bpf
```

## How I figured my problem out

My containers were taking a long time to build, and the script that was building them didn't offer any kind of debugging information. I only needed to use `pidstat` and `mpstat` to figure the issue out. `mpstat -P ALL` was showing that all 4 processors were running at around 90% during most of the build, but then at some point went down to 100% for 1 processor, indicating some bottleneck in the build process.

Since the build was configured to install dependencies in parallel, this was very unexpected. Running `pidstat` showed that `gcc` was responsible for using most of the CPU during the build, and from there I was able to narrow it down to a `libxml2` build using `top` and `ps`. We ended up fixing the issue by installing a version of `lxml` which had a pre-built `libxml2` wheel which didn't require compiling.

So I didn't end up needing eBPF in the end, but I still went through with the installation process as an educational exercise.

## Questions

Although I was able to figure out how to run eBPF, there were some things I couldn't figure out.

### Why does -v /lib/modules:/lib/modules work correctly when invoking `docker run` from macOS?

The directory doesn't exist on my macOS machine, so I'm guessing it might fall back to the directory on the VM.

### Could I just use the upstream linux.org 4.19.121 kernel instead of the linuxkit fork?

Downloading a tarball would be much quicker than `git clone`.

### Why doesn't `runqlat` work?

I noticed that `runqlat`, a tool to detect CPU scheduler queue latency, wasn't working. It was running but not displaying any histograms.
