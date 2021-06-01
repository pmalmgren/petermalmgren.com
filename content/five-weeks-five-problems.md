---
title: "Five problems in five weeks"
description: The next 5 things I want to work on at the Recurse Center
date: 2021-05-22T08:16:23-04:00
categories: Recurse Center 2021
draft: false
---

## Prioritization means saying no

The hardest part about being at the [Recurse Center](https://recurse.org) has been prioritizing what I want to work on, and not feeling bad about myself when I fall short of my goals. My goals are always way too lofty and ambitious.

Even though I recognize that I can be too ambitious with my goals, I still want to push myself to some degree, and complete the last half of my batch with a sense of accomplishment.

Unfortunately, this means pausing work on a couple of projects which I find interesting, including:

- A Rust async executor based on `io_uring`
- My Rust-based DNS client, which I haven't been learning much from recently
- Most of my work exploring type systems and compilers

I don't think these are bad projects. In fact, they align with many of my goals, I just don't think these are the *best projects* for me to be working on right now, given the time constraints and things I would like to learn more about.

### Family, health, and community come first

My most productive times at the Recurse Center happened when I took care of myself and my family first. This meant eating well, exercising for at least 1 hour each day, spending quality time with my wife and daughter, engaging with social activities through the Recurse Center, and spending time developing my creative side through writing and drawing.

These will continue to be my focus going forward, even after my batch is complete. Through therapy I have learned that well-being requires showing up for myself, my family, and my community.

## Five weeks, five goals

Here are the projects I have decided to tackle in the next five weeks. Every one will be time boxed to at most one week (40 hours), and I will try to write a blog post for each one documenting everything I'm learning about.

### Networking

I have been learning a lot about networking in this batch. I wrote a DNS client in Rust, implemented a websocket server and HTTP server from scratch, learned about capturing and inspecting packets with tcpdump/wireshark, and learned about ICMP. I want to expand on my knowledge of networking and focus specifically on the following things:

- Learn Linux-specific networking, including `iptables`, `netlink`, XDP, and [kernel internals](https://linux-kernel-labs.github.io/refs/heads/master/labs/networking.html)
- Learn about NAT, NAT traversal, and routing
- Expand on my [QEMU + Buildroot](/qemu-buildroot/) post to add VDE and networking
- Maybe (stretch goal) learn how to [write a basic router](https://www.scs.stanford.edu/09au-cs144/)

### ELF Executables & Debugging

Last year I started to implement an [ELF](https://en.wikipedia.org/wiki/Executable_and_Linkable_Format) parser in Rust. I want to finish learning more about how executable files are constructed and run in Linux. Here are the specific things I want to learn about and do:

- Work more on ELF parsing, with the goal of parsing at least the headers of an ELF file
- Implement a basic debugger in Rust, using `ptrace` and this [blog post](https://eli.thegreenplace.net/2011/01/23/how-debuggers-work-part-1/)
- Learn about dynamic and static linking

### Linux system administration

Even though I am pretty knowledgeable of the Linux command line, there are some things I want to explore further. These are:

- Task automation through cron, maybe writing my own automated home directory backup system
- Learning more about bash through [Advanced Bash-Scripting](https://tldp.org/LDP/abs/abs-guide.pdf)
- Learn more about [systemd](https://www.freedesktop.org/wiki/Software/systemd/)

### Systems performance

The most enjoyable projects in my career have been working on performance issues. I would like to expand my knowledge by focusing on Linux systems performance. For this part I'll mostly be following along with Brendan Gregg's [systems performance book](http://www.brendangregg.com/sysperfbook.html) with a focus on:

- Learning about `perf` and other Linux CLI tools
- Writing benchmarks and microbenchmarks
- Learning more about CPUs, memory, and networking

### Miscellaneous projects

I have two outstanding projects I want to wrap up. These are:

- A filewatch/livereload server written in Rust, this is about halfway done, but I'd like to add support for configuration and pipelines
- Completing a parser and understanding how to handle precedence and associativity with [recursive descent parsing](https://eli.thegreenplace.net/2010/01/02/top-down-operator-precedence-parsing)

## Non-goals

I won't work late or stress to complete any of these projects, and I won't sacrifice family time, my personal health, nor the meaningful time I spend with others at the Recurse Center.

I also won't be working on anything outside of what I have outlined above. Prioritization means focus, and I'm going to embrace focus for these next five weeks.
