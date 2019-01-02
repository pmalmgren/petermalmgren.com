---
title: Strangeloop 2018
url: /conferences/strangeloop2018/
draft: false
date: 2018-10-04
meta: false
tags: strangeloop-2018
categories: conferences
---

## Strangeloop 2018

[Strangeloop 2018](https://www.thestrangeloop.com/) is a conference held every year in St. Louis. It features speakers from academia, the software industry, and even a museum party at the [City Museum](https://www.citymuseum.org/) held the night before the conference starts!

<!--more-->

Strangeloop was the first conference I've attended since becoming a software engineer in 2015. I've always been a bit wary of conferences, and in large gatherings of people in tech in particular, partly because I don't always feel like I fit in or fully grasp the culture, and partly because I have social anxiety and am averse to large social gatherings. This is part of why I picked Strangeloop - it has a reputation for attracting diversity, and having a friendly, welcoming atmosphere.

My favorite part of Strangeloop was the diversity of topics. There were talks on machine learning, functional programming, education, dev ops, programming languages, and even a book release party for [The Little Typer](https://mitpress.mit.edu/books/little-typer). During the evenings there were breakout sessions and lightning talks, board games, and other low-pressure social events.

### Functional Programming

It's hard to separate Strangeloop from functional programming. The conference was co-located with [ICFP](https://conf.researchr.org/home/icfp-2018/), which is one of the biggest conferences for functional programming in academia. During a few different talks things like dependent typing, session types, linear types, and typed holes came up. I'm still not sure I have a good grasp on all of these, but session and linear types seem really useful for some of the work that I do involving communication with other systems and APIs.

#### Session Types

Session types are a way to specify how a program communicates with other processes. Formally, session types are defined by [π-calculus](https://en.wikipedia.org/wiki/%CE%A0-calculus). Practically, session types are implemented using types that define a communication protocol as well as a channel, which serves as a means of communication using this protocol between a client and a server. Session types have the added advantage, in languages like Haskell, of being verified at compile-time. This can help eliminate concurrency bugs like race conditions and deadlocks.

These were mentioned in two talks that I attended: one at the [PWLConf pre-conference](/conferences/pwlconf2018/#a-rehabilitation-of-message-passing-concurrency-https-pwlconf-org-2018-frank-pfenning) and one by Heather Miller about [language support for distributed systems](https://www.thestrangeloop.com/2018/towards-language-support-for-distributed-systems.html).  


#### Category Theory

[Philip Wadler](https://homepages.inf.ed.ac.uk/wadler/bio.html) gave a short introduction to category theory. I really don't understand category theory well enough to summarize, but the talk ended with Philip stripping off his clothes to reveal a "Super Lambda" costume, complete with a cape!

### Dev Ops

Two of the most useful talks at Strangeloop (for me) were about performance monitoring. Both of the presenters did a really good job of tying in their experience with theory.

#### [Practical Performance Theory](https://www.thestrangeloop.com/2018/a-practical-look-at-performance-theory.html)

Kavya gave a really excellent talk about performance, capacity, and how to use performance theory to help us improve both. She talked about measuring capacity and performance on two types of systems: closed and open systems. Closed systems are systems with a fixed number of clients and requests, in which the clients sleep for some known period of time before performing their requests. Open systems are systems with a variable number of clients, such as a web server.

##### Single-server Open System

For a single web server, which is an open system, we can monitor its performance using the the Utilization Law, which is based on the following assumptions:

  1. Requests arrive at a variable rate from any number of clients
  2. The server processes the requests at a known rate (usually a statistical distribution)
  3. The server can only process one request at a time, and the rest sit in a queue

The Utilization Law comes from queuing theory, and is used to calculate the average response time of a request for a given rate of requests with a known response time. This gives us a graph which resembles a hockey stick, and grows expoentially after it reaches a certain point.

To improve performance, Kavya offered the following suggestions:

  1. Prevent requests from queueing too long, i.e. introduce timeouts
  2. Client-side concurrency control

Adding client-side concurrency control helps control the rate of incoming requests to a system, which helps the server by keeping the queue smaller during times of high load. Adding a timeout is relatively simple, although it can have some detrimental effects. If the queue grows really large and is processed in FIFO (first in first out) order, then the server will be processing requests that are most likely to timeout first. 

One strategy is to set the queue time as a function of the length of the queue, meaning that for a large queue, an incoming request would receive a short timeout.

Another strategy is to switch the order of processing the queue to LIFO (last in first out) to take into account the fact that when a queue reaches a certain size, requests that have been waiting longer are more likely to time out.

##### Closed Systems

Closed systems have different performance characteristics, and the response time is roughly based on the following factors:

  1. Time the clients spend sleeping
  2. Time the clients spend waiting for their request to be processed
  3. The number of clients

Increasing the number of clients will also increase the response time. This is similar to how the [polling system at Zapier](https://zapier.com/developer/documentation/v2/polling/) functions. There are a set number of clients (polls), they sleep for a certain time period (usually 5 minutes), and are processed in order.

##### Clusters

Nowadays, we usually have multiple servers working together to process incoming requests. These clusters have different performance characteristics based on the number of servers, resource contention, and how much they have to coordinate to process requests. This leads us to the Universal Scalability Law, which expresses response times in terms of the server capability, the amount of cross talk, and resource contention that occurs with each request.

An example of reducing contention would be to utilize database sharding.

##### Load Testing

A really interesting takeaway from this talk is that the load testing I've been doing throughout my entire career as a software engineer has been incorrect!

Tools typically will simulate a fixed number of clients, with a variable number of requests. This does not simulate load properly on an open system, most likely due to the way requests from different clients are handled. To do more efficient load testing, we have to vary the number of clients as well, which likely means using a tool like Locust, or even [Kubernetes](https://cloud.google.com/solutions/distributed-load-testing-using-kubernetes) to distribute the load test.

#### [Understanding Microservices with Distributed Tracing](https://www.thestrangeloop.com/2018/understanding-microservices-with-distributed-tracing.html)

This talk was awesome! As companies grow and scale, a common pattern is to use microservices. While this can help with scalability, it can make things like observability a nightmare - how do we understand and trace requests which go through many different services? One simple way to trace requests is by attaching a common `request_id` to each one, then serializing them using timestamps. This works relatively well for a small number of services, but stops scaling, and also makes it hard to see bottlenecks.

Lita proposes that we use tracing tools to get more fine-grained observability.

##### OpenTracing

The request-response lifecycle becomes a series of "spans," which are essentially work done by individual services, and are composed into a trace. There are products which do this for us, such as Datadog APM, but using them directly can introduce vendor lock-in. Instead, Lita recommended [OpenTracing](http://opentracing.io/), which is a project designed to bring a vendor-neutral interface to tracing. 

##### Using a sidecar

One challenge of tracing tools is having to reimplement boilerplate code across multiple projects and codebases, which adds a point of failure to the software development lifecycle. What if a developer fails to add tracing? What if a developer incorrectly instantiates the tracing client? If a trace fails, should the entire request/reponse fail?

To address these challenges, Lita argued that it's important _not_ to have developers implement tracing for each request. Instead, she proposed that projects use a sidecar, such as [Envoy Proxy](https://www.envoyproxy.io/) to perform the tracing asynchronously. This prevents trace failures from making the entire request fail, and also removes tons of boilerplate code to instantiate/execute a trace.

##### Visibility

To improve performance monitoring, traces can be added to error messages, sent to support, and exposed on dashboards to help with observability. When a request/response touches multiple services, having a trace available can be really helpful.
