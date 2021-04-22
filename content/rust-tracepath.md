---
title: "Implementing Tracepath in Rust"
description: Using Rust, nix, std::net, and libc to implement tracepath
date: 2021-04-22T08:03:02-04:00
draft: false
categories: Recurse Center 2021
---

## What is tracepath?

Every time you send data over the Internet, it passes through a series of routers. Routers are network devices which know how to get packets to their destinations.

Tracepath is a Linux program which tells you about every router a packet has to go through to get to a host. The output looks something like this:

```bash
$ tracepath google.com -n 10
 1?: [LOCALHOST]                      pmtu 1500
 1:  _gateway                                              6.139ms 
 1:  _gateway                                              5.843ms 
 2:  no reply
 3:  int.router.isp.net                      		  13.481ms 
 4:  4.28.30.66                                           21.167ms asymm  8 
 5:  ae100.edge4.Atlanta2.Level3.net                      48.584ms asymm 10 
 6:  ae-2-3513.edge1.Atlanta4.Level3.net                  33.876ms asymm 11 
 7:  4.68.70.190                                          33.342ms asymm 11 
 8:  no reply
 9:  no reply
10:  no reply
     Too many hops: pmtu 1500
     Resume: pmtu 1500 
```

## How does tracepath work?

Tracepath works by taking advantage of routing algorithms. Routing algorithms look at each incoming packet's IP header and decide what to do. One important field in an IPv4 packet's headers is TTL (time-to-live), which is known as the hop limit in IPv6.

Both TTL and the hop limit are an unsigned 8 bit number (0-255) and are used like this in the routing algorithm:

1. Receive a packet
2. Look at the packet's TTL or hop limit
3. __If the packet's TTL or hop limit is 1, drop the packet and return it to the sender__
4. Otherwise, decrement the TTL or hop limit by 1 and pass the packet on to its next destination

So as a packet gets passed between routers, its TTL/hop limit gets smaller. After the TTL/hop limit hits 1, it will be sent back to the host along with some information about the router that processed it. This information is transmitted using the ICMP protocol.

Tracepath works by sending UDP datagrams to a host and manipulating the TTL/hop limit. It starts by setting this to 1, sending a packet out, reading the data from the router which returned it, and then printing this out. Setting the value to 1 guarantees that the first router along its path will drop and return it.

Then `tracepath` sets the TTL to 2, 3, 4, etc. and repeats the process until the host is finally reached. These TTL values correspond to the 2nd, 3rd, 4th, and nth routers along the way to its destination.

From here on out I will be using the term "TTL" for both the TTL (IPv4) and hop limit (IPv6). They are both the same thing in practice.

### Routing is non-deterministic

Because routers can change where they route packets to dynamically, it's likely that the output of `tracepath` will be different if you run it multiple times. Also, the path that data takes to get to the host is unlikely to be the same as the path that the response data takes on the way back.

One thing that `tracepath` measures is the TTL of the ICMP packets that it receives back. It's hard to interpret exactly how many hops were taken based on this value, but we can use the following information to guess:

- Devices set a different TTL value when sending out packets
- Common TTLs are 255, 128, and 64

Here's the "guess" algorithm which `tracepath` uses:

```c
int ttl = 0;

for (ttl = 0; ttl < num_hops; ttl++) {
    // int recv_ttl is set somewhere above when receiving ICMP data
    int est_orig_ttl = 0;

    if (recv_ttl > 128) {
        est_orig_ttl = 255 - recv_ttl;
    } else if (ttl > 64) {
        est_orig_ttl = 128 - recv_ttl;
    } else {
        est_orig_ttl = 64 - recv_ttl;
    }

    int asymm = est_orig_ttl - ttl; 
    // continue on with loop
}
```

This doesn't help us if routers set TTLs outside of 255, 128, or 64, so it's best to treat this number as a guess. `tracepath` reports this number after the latency as `asymm [difference between ttl and estimated TTL]`.

### pmtu discovery

`tracepath` also performs [Path Maximum Transmission Unit Discovery](https://tools.ietf.org/html/rfc1191), or PMTU discovery, which shows up in the first hop. According to the IP protocol, receivers of data, including any routers along the way, are allowed to specify the maximum number of bytes which show up in a packet. If a sender wants to send more than this, they have to fragment the data before sending it.

Routers can use something like the following to enforce MTU on packets they receive. These rules are enforced for the _next hop_, meaning for the next router along the way:

1. Inspect a packet and look at the total length flag
2. If the packet total length is >= the MTU of the next router, drop the packet and send an ICMP packet back
3. Otherwise, pass the packet along to the next router

The ICMP data comes back with a "Destination Host Unreachable" message and the `Next-Hop MTU` set to the value that the sender should use. The sender is responsible for fragmenting data into the appropriate MTU size after this.

The minimum of all MTUs discovered along the way to the destination is called the Path Maximum Transmission Unit, or the largest size that packets can be sent without fragmentation.

## Implementing tracepath in Rust

*Note: The final implementation is on [this GitHub repository](https://github.com/pmalmgren/tracepath-rs)*

After learning how the TTL header works with routers, we can piece together a rough outline of how we want to proceed in code:

1. Read a host in as a command line argument
2. Read the number of hops to use as a TTL value, defaulting to 255
3. Loop over numbers in the range 1 to the number of hops we chose in step 2
4. Open a UDP connection to that host with the port number `33435 + ttl`
5. Send out a datagram with the TTL flag set to the value of the loop
6. Receive and read the ICMP message, printing out the address and the hop number
7. If the address we get back from the ICMP message is the same as the host we're trying to reach, terminate the loop

I'll be focusing on steps 4-7 below. Here's the skeleton of the code so far:

```rust
fn traceroute(hostname: String, hops: u8) {
    // Step 3: Start with a ttl of 0
    // ensuring the first hop is the local router
    for ttl in 0..hops {
        // Step 4: Open a UDP connection with the port number `33435 + ttl`
        // ??

        // Step 5: Send out a datagram with the TTL flag set to `ttl + 1`
        // ??

        // Step 6: Receive and read the ICMP message, printing out the address
        // and hop number.
        // ??

        // Step 7: If we receive a message from the host we're trying to
        // reach, ex. google's IP address for google.com, stop the loop
        // ??
    }
}

fn main() {
    // Steps 1, 2: Read host and hops as command line arguments
    let matches = App::new("traceroute-rs")
        .version("0.1")
        .author("Peter Malmgren <ptmalmgren@gmail.com>")
        .about("Rust version of traceroute")
        .arg(Arg::new("hostname")
            .about("The hostname to run traceroute against")
            .required(true)
            .index(1))
        .arg(Arg::new("hops")
            .short('m')
            .multiple(false)
            .takes_value(true)
            .about("use maximum <hops>"))
        .get_matches();

    let hostname: String = matches.value_of_t("hostname").unwrap();
    let hops: u8 = matches.value_of_t("hops").unwrap_or(255);
    
    traceroute(hostname, hops);
}
```

### Opening a UDP connection with `std::net::UdpSocket` and sending data

`std::net::UdpSocket` has a really nice interface for opening and interacting with UDP sockets. We'll use the `bind` method to create a socket that listens on all interfaces, and lets the OS choose a port number for us.

After we successfully create a socket with `bind`, we need to connect it to the remote host. We can do that with the `connect` method.

The code to do this is relatively straightforward:

```rust
use std::net::UdpSocket;

fn traceroute(host: String, hops: u8) {
    ...
    for ttl in 0..hops {
        // Step 4: Open a UDP connection with the port number `33435 + ttl`
        // `0.0.0.0` means that our socket will receive packets on any interface,
        //  and the port `:0` means that we'll let the OS choose a port number for us.
        let socket = UdpSocket::bind("0.0.0.0:0").expect("Error binding");
        socket.connect(&host).expect("Error connecting.");
```

We can pass a `String` into `UdpSocket::socket` because `String` implements the [`ToSockAddrs` trait](https://doc.rust-lang.org/stable/std/net/trait.ToSocketAddrs.html). 

There is one important edge case here. Because DNS can return multiple IP addresses for a single domain, and because `bind` will loop through them and choose one arbitrarily to connect to, we want to make sure that we're using the same IP address each time for accurate results. Luckily the `UdpSocket` type has a `.peer()` method, which returns the IP address of the peer we're connected to. We can save this peer for subsequent connections, directly passing in the IP address instead of the host name.

```rust
use std::net::UdpSocket;

fn peer_ip(sock: &UdpSocket) -> String {
    let peer = sock.peer_addr().unwrap().to_string();
    let parts: Vec<&str> = peer.split(":").collect();
    assert_eq!(parts.len(), 2);
    parts[0].to_string()
}

fn traceroute(host: String, hops: u8) {
    let mut ip_addr: Option<String> = None;
    for ttl in 0..hops {
        // Step 4: Open a UDP connection with the port number `33435 + ttl`
        let socket = UdpSocket::bind("0.0.0.0:0").expect("Error binding");
        let host = match ip_addr {
            None => format!("{}:{}", host, 33435+ttl),
            Some(ref ip) => format!("{}:{}", ip, 33435+ttl),
        }
        socket.connect(&host).expect("Error connecting.");
        if let None = ip_addr {
            ip_addr = Some(peer_ip(&sock));
        }
    }
```

### Sending data and setting the TTL

We didn't set the TTL in the above example before sending the data. To do this, we can use the socket `.set_ttl()` method, which calls [`setsockopt`](https://man7.org/linux/man-pages/man2/setsockopt.2.html) with `IP_TTL` as the option. We can use the socket `.send()` method to send out a datagram. The Linux IP stack will automatically set the IP packet's `IP_TTL` header to the value we passed into `set_ttl()`.

```rust
socket.set_ttl(ttl+1).expect("Error setting TTL.");
socket.send(b"hello").expect("Error sending data.");
```

### Reading the ICMP error response

If all goes well, the router will drop the packet and send us back an ICMP error message, which we can use to extract its address and learn more about how our data gets from us to our host.

This step was the most confusing part of developing `tracepath` using Rust. The reason for this is that it's hard to read ICMP packets directly unless we use a raw socket. But using a raw socket requires root privileges, which is something I like to avoid if possible.

There are also ICMP sockets, but these can only send and receive echo requests, which are used for utilities like `ping`. So how do we read ICMP error messages?

Linux has a facility for passing ICMP messages (along with other messages) back to user space called control messages. These can be read with the system call `recvmsg`, which can contain a variety of control messages depending on what options we give to the socket.

To register our socket to receive ICMP error messages, we want to set the socket option [`IP_RECVERR`](https://github.com/torvalds/linux/blob/f40ddce8/include/uapi/linux/in.h#L104) using the level [`SOL_IP`](https://github.com/torvalds/linux/blob/f40ddce8/include/linux/socket.h#L326) to the value `1`. We can do this using `libc`, or by using a (currently) patched version of [nix](https://github.com/nix-rust/nix/compare/master...pmalmgren:tracepath-enabled):

```rust
fn prepare_socket(sock: &UdpSocket) {
    let raw_fd: RawFd = sock.as_raw_fd();
    setsockopt(raw_fd, sockopt::IpRecvErr, &true).expect("sockopt failed");
    setsockopt(raw_fd, sockopt::IpRecvTtl, &true).expect("sockopt failed");
    setsockopt(raw_fd, sockopt::IpMtuDiscover, &true).expect("sockopt failed");
}
```

We have to use the `as_raw_fd()` method to convert the socket structure into a raw file descriptor, which is just an integer.

After we have prepared the socket, we have to use `.recvmsg()` to receive the control messages. This requires some upfront memory allocation, namely an `IoVec` for reading response data, and the macro `cmsg_space!` for declaring memory to put our control messages into.

We also have to wait until the socket is readable before calling `.recvmsg()` on it, otherwise we'll get an `EAGAIN` error. To do that, we'll use `select` which blocks the thread until one of the file descriptors passed in is available for reading.

Finally, we also have to pass in what we're interested in the socket message error queue using the `MsgFlags::MSG_ERRQUEUE` option.

We can pull the address of the sender out of the ICMP error message by looking at the offender's address. We also have to convert it from big endian to our platform's endianness (which is usually little-endian in x86) otherwise the IP will print out backwards. We can do that with the `s_addr.to_be()` method.

```rust
struct HopResult {
    addr: Option<String>,
    est_ttl: Option<u8>,
}

fn recv_hop_cmsg(sock: &UdpSocket) -> Result<Box<HopResult>, Box<nix::Error>> {
    // Prepare select to listen to our socket's file descriptor, letting us know
    // when it's ready to read.
    let raw_fd: RawFd = sock.as_raw_fd();
    let mut readset = FdSet::new();
    readset.insert(raw_fd);
    let mut timeout = TimeVal::from(libc::timeval{tv_sec: 1, tv_usec: 0});
    if let Err(e) = select(None, Some(&mut readset), None, None, Some(&mut timeout)) {
        return Err(Box::new(e));
    }

    // Prepare some data for reading our response and control messages into
    let mut data = [0; 65536];
    let iov = IoVec::from_mut_slice(&mut data);
    let mut cmsg = cmsg_space!([RawFd; 28]);

    // Receive the message
    let result = recvmsg(raw_fd, &[iov], Some(&mut cmsg), MsgFlags::MSG_ERRQUEUE);

    if let Err(e) = result {
        return Err(Box::new(e));
    }

    let msg = result.unwrap();

    let mut hop_result = Box::new(HopResult::new());
    for cmsg in msg.cmsgs() {
        match cmsg {
            ControlMessageOwned::IpTtl(ip_ttl) => {
                hop_result.est_ttl = Some(match ip_ttl {
                    ittl if ittl <= 64 => 64 - ip_ttl,
                    ittl if ittl <= 128 => 128 - ip_ttl,
                    ittl if ittl < 255 => 255 - ip_ttl,
                    _ => 0,
                });
            },
            ControlMessageOwned::IpRecvErr(err) => {
                hop_result.addr = Some(Ipv4Addr::from(err.offender.sin_addr.s_addr.to_be()).to_string());
            },
            _ => {},
        };
    }

    return Ok(hop_result);
}
```

We can use this block of code to get the next router IP address and hops the packet took to get back to us.

Finally, when we reach the host we will want to end the program. We can do this by matching on the return value of `recv_hop_cmsg` to the original value we stored in the variable `ip_addr`.

### Future work

The complete tracepath is available on GitHub here: https://github.com/pmalmgren/tracepath-rs/

Here are some things that I left out, but may add later:

- IPv6 support
- Path MTU discovery
- DNS resolution of routers discovered at each hop
