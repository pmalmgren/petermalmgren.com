---
title: "Experiments with WebAssembly on the Server"
description: "Building a Wasm Job Scheduler"
categories: Web Assembly
date: 2022-04-12T07:27:44-04:00
draft: false
---

## WebAssembly is for the server too

My first exposure to [WebAssembly](https://webassembly.org/) was in the browser. I assumed that it was mostly a way to stop writing JavaScript, and happily used it as the frontend component for a Rust project I was working on.

In the past few weeks I've learned that my initial assumptions about WebAssembly were completely wrong. What I didn't realize is that WebAssembly runtimes such as [wasmtime](https://github.com/bytecodealliance/wasmtime) provide a server-side execution environment for compiled WebAssembly, which can run independently outside of the browser.

In this post I'll be diving deeper into wasmtime and server side WebAssembly by building a simple job scheduler, which runs compiled WebAssembly on a set schedule. I'll be writing the job scheduler in Rust.

## Architecture

The program I'm going to write will look something like this:

```mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
```
