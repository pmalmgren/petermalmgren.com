---
title: "QEMU + Buildroot"
description: Using QEMU and Buildroot to make tiny virtual machines
date: 2020-12-03T12:15:32-05:00
categories: Linux
draft: false
---

Recently I started playing around with the Linux kernel. This involved reading and changing the source, stepping into a running kernel with a debugger, and loading kernel modules. Given my lack of experience, I would almost be certainly causing a kernel panic at some point, and didn't want that to mess up my laptop.

I decided to use [QEMU](https://www.qemu.org/) to run a virtual machine with my kernel, and discovered a tool called [Buildroot](https://buildroot.org/) which takes care of building a small filesystem for these virtual machines. This way, if I caused a kernel panic or bug when writing kernel code I would only mess up my virtual machine and not my laptop.

Here's what I've learned, the solution I came up with, and some unanswered questions.

## QEMU Overview

QEMU is a hypervisor, which means it can boot and run another operating system. Functionally, it is pretty similar to [Virtualbox](https://www.virtualbox.org/), although Virtualbox uses a UI and QEMU is a command line app.

You can also use QEMU to emulate different architectures. This means that if you're running an Intel x86 processor, you could run binaries that were built for an ARM processor. I didn't end up using this at all but it does seem popular for developers who work with embedded Linux, which usually uses ARM or MIPS.

### QEMU Setup

I installed QEMU on my system (pop_OS!) by doing `apt-get install qemu-system qemu-system-x86_64`

Here's how I ended up running the kernel and system that I built with Buildroot.

```bash
$ qemu-system-x86_64 -kernel bzImage -hda rootfs.ext2 -append "root=/dev/sda rw console=ttyS0" \
--enable-kvm --nographic 
```

QEMU then will take whatever arguments you provide it and launch a brand new operating system! You can think of this running operating system as a real computer, but instead of plugging in real hardware you can pass in arguments which makes virtual hardware appear inside the operating system that you're running.

### QEMU Terminology

The computer that you run QEMU on is called the *host*, or sometimes *hypervisor*. I think *hypervisor* generally should refer to the program like QEMU, and not the machine itself, but I did see it used in some documentation to refer to the machine.

The virtual computer which gets created is called the *guest*.

On Linux QEMU can use a technology called KVM, which is the kernel code that actually launches the virtual machine. When people talk about KVM on Linux, they are usually talking it in the context of QEMU and/or libvirt.

## Buildroot

Buildroot is a really neat tool which takes care of compiling a kernel, building a root file system, and installing packages and configuring the system after it is built. It has a lot of options and they can be configured graphically through the tool `make menuconfig`.

I ended up using the following set of commands to get a minimal working system. Reference the [Buildroot user manual](https://buildroot.org/downloads/manual/manual.html#makeuser-syntax) to find out more details.

```bash
# download the latest release
$ curl https://git.busybox.net/buildroot/snapshot/buildroot-2020.11.tar.gz
# tar zxvf buildroot-2020.11.tar.gz
# cd buildroot-2020.11
# uses some QEMU friendly settings!
$ make qemu_x86_def_config
$ make menuconfig
```

Using `make qemu_x86_def_config` specifies a bunch of options for you, but I still enabled a few extras in `make menuconfig`. The most important were adding some packages (`zsh`, `vim`) and installying rootfs overlays. Overlays sit on top of the filesystem and let you override certain files. I used them to configure networking and DNS. Here's what they look like:

```bash
$ tree rootfs_overlay    
rootfs_overlay
└── etc
    ├── network
    │   └── interfaces
    └── resolv.conf

2 directories, 2 files
```

Here's the network interfaces file, these values are explained below. 

```bash
$ cat rootfs_overlay/etc/network/interfaces
auto lo
iface lo inet loopback
auto eth0
iface eth0 inet static
address 10.0.2.14
netmask 255.255.255.0
gateway 10.0.2.2
$ cat rootfs_overlay/etc/resolv.conf
nameserver 10.0.2.3
```

This will bring user networking up on boot.

I put both of those in a directory `board/kerneldev/overlayfs` and used that for the setting "Root Filesystem Overlay Directories" in "System Configuration."

### Building everything

Once everything is configured, I ran `make` in the Buildroot directory. It takes quite a while, but a lot of the compilation results are cached so subsequent runs aren't as slow. The output from the build will go in `output/images`. 

You can boot the virtual machine up by running the `./start-qemu.sh` script in the output directory, or by running this command:

```bash
$ qemu-system-x86_64 -kernel bzImage -hda rootfs.ext2 -append "root=/dev/sda rw console=ttyS0" \
--enable-kvm --nographic 
```

Using `console=ttys0` lets you see early boot logs.

### QEMU Networking

The hardest thing to figure out for me when working with QEMU was how to do networking. There are a lot of "magic" values which I will explain below.

QEMU provides each guest with an ethernet card and a network by default in something called user mode. The tricky thing is figuring out which IP, gateway, and DNS servers to use for internet connectivitiy. QEMU provides a gateway on 10.0.2.2 and a DNS server on 10.0.2.3.

Once you boot your system, you can get networking with the following commands:

```bash
$ ip addr set eth0 up
$ ip addr add 10.0.2.14/24 dev eth0
$ ip route add default via 10.0.2.2 
$ echo "nameserver 10.0.2.3" > /etc/resolv.conf
```

This allows network access from the *guest to the host* but not vice versa.

## Things I wasn't able to figure out

Although I was able to get a working system up and running, there's still a bunch of stuff I haven't figured out yet. Here are some questions I have I hope to answer about QEMU and Buildroot:

#### How do I share files between the guest and host machines with something like [9pfs](https://wiki.qemu.org/Documentation/9psetup)?
#### How do I set up networking to allow host to guest comminication?
#### How do I enable GDB debugging of the running kernel?
#### How can I share my local environment (shell, dotfiles, etc.) with the guest?
#### How do I build a kernel that's on my computer vs. the one on git.kernel.org?
#### How do I include kernel modules that I write in the build?
