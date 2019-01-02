---
title: PWLConf 2018 Running Notes
url: /conferences/pwlconf2018/
draft: false
date: 2018-09-25
meta: false
tags: strangeloop-2018
categories: conferences
---

## PWLConf 2018 Notes

[PWLConf 2018](https://pwlconf.org/#schedule) was one of the preconferences at Strangeloop 2018. Here are my notes for the conference. I left out the last talk, [Stable Fluids](https://pwlconf.org/2018/dan-piponi), but if you find computer animation interesting I urge you to check it out.

<!--more-->

### [Computer-aided Concurrent Programming](https://pwlconf.org/2018/roopsha-samanta/)

Before this talk I wasn't very familiar with formal verification. Afterwards, I had a pretty cursory understanding of some of the state of the art methods for verifying concurrent programs.

The big takeaway for me was that these methods, while interesting, are so state of the art that they currently don't have a real-world application (yet). Instead, I did learn of a few insights that could help me reason about concurrent programs, as well as classify and detect bugs while writing code. I also learned that concurrent bugs have caused deaths in faulty medical devices, and that the big North East power outage of 2003 was caused by a race condition in a computer at a power plant.

There are three ways (typically) that a concurrent program can fail: race conditions, deadlocks, and corruption of shared memory, such as performing a double-free. At the same time, it can be difficult to reason about the behaviors of the systems in which the bugs can occur.

One of the ways we can reason about behaviors of a concurrent system is modeling. We can build a model of our program's behavior ahead of time, then attempt to find counter-examples of ways in which the program can break. Once we find a counter-example, we can either refactor the code to make it safer for concurrent execution, or add an atomic region.

Once we have found these counter-examples, it is important to try to abstract them to obtain a more general class of bug. For example, if some event B occurs before any of the other two events A or C, it can cause a race condition. Instead of enumerating all of the cases in which B can break our program, we can generalize them to the case of B executing first, and introduce locking or synchronization to make sure that this doesn't happen.

### [A rehabilitation of message-passing concurrency](https://pwlconf.org/2018/frank-pfenning/)

I had a cursory understanding of message passing in Go using channels before the talk, and if you are interested I definitely recommend reading about communicating sequential processes and their implementation in Go.

The basic gist of this paper was that message-passing concurrency, with the added addition of something called linear logic and session types, could really be a viable alternative to shared memory techniques. Concurrent workers, such as a program running on another thread or a process, communicate via message sent over channels instead of by sharing memory. Communication over these channels is defined by a protocol called a session type, and regulated by linear logic.

To demonstrate, the presenter gave an example of a programming language he wrote called `CC0`, which implements session types and linear types, to achieve safe concurrent programming. Session types are essentially a protocol for communication with remote processes. They include facilities for opening and closing a channel, sending and receiving messages over a channel, as well as forwarding a channel, which basically means transferring ownership to another function or process.

Linear types and session types provide some safety guarantees to the programmer, and it's interesting to note that several programming languages which adhere to the CSP (communicating sequential processes) theory do not provide strong safety guarantees.

### [Including Equity in Tech Work: A Quick, Paper-Based Guide](https://pwlconf.org/2018/ari-schlesinger/)

Traditionally, we consider the history of things like UNIX, Silicon Valley, and software in isolation. Rarely do authors and computing historians take into account influences from culture, society, politics, and current events when writing about history.

The presenter talked about a paper she had read which analyzed the computing paradigms of UNIX in light of events of the late 1960s in the United States. UNIX was developed alongside the Civil Rights movement, which resulted in the Civil Rights Act of 1968, along with the desegregation of schools and business in the United States. Modularity, or the ability to isolate and swap portions of code in a system, is one of the fundamental design principles of UNIX.

Modularity on its own, in the context of computing and UNIX, is a fairly benign concept. However, when looked at in the historical light of segregation, it reveals one truth which some of us in computing may not always think about: That our choice of language and concepts for building a system is often influenced by our social and political environments.

When building systems in computing, it is important to reflect upon the power structures in our society, and take care not to replicate the ones that selectively harm members of that society, such as people of color, the disabled, the LGBTQ community, and women. It is also interesting to think about what a system that was designed with radical social justice and equity in mind would look like from an architectural point of view. It would be interesting to reflect on the trend towards microservices and distributed computing, taking into consideration the state of our society and politics.

### [The Future of the Grid: Policy, Technology, and Market Changes](https://pwlconf.org/2018/casey-canfield/)

This talk held a pretty special place in my heart - I used to work as an electrician operating a power plant, so I am familiar with the challenges of generating and distributing power. What I was not so familiar with, and what came as quite a surprise, was the argument from the speaker that blockchain could be a potential solution for efficiently distributing power in local markets.

One of the main problems with green power is this: how do we pay people who generate it and put it back on the grid? How do we effectively price the power being generated, while also taking into consideration the fact that a utility company typically bears some of the burden of distributing that power, and surges in supply can disrupt the grid?

The answer is the blockchain! The idea is that you and your neighbors can form a local market. In this local market, some of your neighbors will generate power through things like solar panels, and will also need a way to sell the excess so it doesn't go to waste. One assumption here is that all of your appliances, including your lights, refrigerator, air conditioning unit, etc. all can sense what load they are using, and may be likely to use, so your house can automatically calculate what load it will need in the next 30 minute interval. Then, through a process of negotiation, an algorithim in your house and your neighbors' houses will negotiate a fair prices for the electricity, and it money will be exchanged. Exchanges of power will take place on the blockchain, while exchanges of money could also take place there or in a financial institution.

### [Standards We Love (for assuring and verifying safety-critical systems)](https://pwlconf.org/2018/heidy-khlaaf/)

This talk really tied in surprisingly well to the previous one about energy, in which the presenter did a great job of explaining power distribution, as well as the first talk which was all about verification of concurrent programs. The presenter, who has a PHd in Computer Science, works on catching bugs in embedded devices used at nuclear power plants. Some of the devices she analyzes are responsible for keeping the plants running, and potentially from melting down and exploding.

One of the interesting things about this talk was it really highlights some of the struggles with translating academic research, particularly in the field of Computer Science, into tools that can actually be used in the industry. Most of the examples in academia, as she pointed out, made a lot of simplifying assumptions which didn't hold in the real world.
