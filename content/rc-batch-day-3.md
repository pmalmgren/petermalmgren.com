---
title: "RC Day 3: Continuations Part 2"
description: Applications of continuations
date: 2021-03-31T07:20:01-04:00
draft: false
categories: Recurse Center 2021
---

Today my goal is to learn about how to use continuations to implement a few of the following things in Racket:

- `dynamic-wind`
- Exceptions (including `define-syntax`)
- Coroutines
- Time-traveling search
- Generators
- Threads
- Non-deterministic programming

## `dynamic-wind`

`dynamic-wind` is a function which takes three arguments: `pre-thunk`, `value-thunk`, and `post-thunk`. It has the special property that even if `value-thunk` returns early (from calling a continuation for example) `post-thunk` will still be called.

It can be used to implement cleanup, such as closing a file, no matter what happens in `value-thunk`. A great use case for `dynamic-wind` is using the `post-thunk` for cleanup code like closing a file once you're done reading from it:

```scheme
(define (safe-read-file input-file)
    (let ([p (open-input-file input-file)])
      (dynamic-wind
       (lambda () '())
       (lambda () '()) ; do something with the file here
       (lambda ()
         (begin
           (close-input-port p)))))) ; this will always be called!
```

## Exceptions

After reading through Matt Might's [article on implementing exceptions](http://matt.might.net/articles/programming-with-continuations--exceptions-backtracking-search-threads-generators-coroutines/), I realized that I had to take a slight detour to study the `define-syntax` procedure, which is a form of macro in Scheme.

### `define-syntax`

`define-syntax` is how you define macros, or templates of code, which expand into more code! I don't really fully understand this very well, but I hope to dive into this a bit more tomorrow.

## Questions

I ended up not getting very far with learning how to implement exceptions in Racket (I had lots of chats with great people!) so here are some open questions I hope to answer tomorrow:

- How does `define-syntax` work? What are `syntax-rules`? I think I'll read over [this post](https://beautifulracket.com/explainer/macros.html) and [macros in the Racket guide](https://docs.racket-lang.org/guide/macros.html)
- How do I display a fully-expanded macro for debugging?
- How can I write a `try/catch` macro using `define-syntax`?
- How can I use continuations to implement coroutines?
