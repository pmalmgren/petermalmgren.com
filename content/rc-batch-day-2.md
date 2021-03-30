---
title: "Recurse Center Day 2"
description: Learning about Continuations
date: 2021-03-30T07:20:01-04:00
draft: false
---

## What is a continuation?

Defined formally, a continuation "is the computation that will receive the result of an expression." (source: [CSE-341 from the University of Washington](https://courses.cs.washington.edu/courses/cse341/04wi/lectures/15-scheme-continuations.html))

### A more understandable definition

To me, a computation that "receives the result of an expression" is a bit hard to understand. I find the following definition to be more understandable:

> *A continuation is something you do to an expression after the expression has been evaluated.*

#### Examples of continuations

`Python`

```python
def f(x: int) -> int:
    return x + 1

# Adding 1 to an expression after it has been evaluated
1 + x(2)
```

`JavaScript`

```javascript
const f = s => `hello ${s}`;

// Appending a string to an expression after it has been evaluated
const msg = "Welcome and " + f("Peter");
```

I'll be focusing on continuations written in [Racket](https://docs.racket-lang.org) for the rest of the post, but these examples show that other languages can have continuations too, and we use them everyday when we write code.

### Implicit continuations

The examples above and this expression are all called implicit continuations:

```scheme
(cons '1 (cdr '(2 3 4 5)))
```

The `cdr` of `(2 3 4 5)` will get `cons`'d by `'1`. The `(cons '1)` is the expression's continuation, and will receive the result of the expression `(cdr '(2 3 4 5))`.

The continuation here is *implicit* because we can't refer to it or alter it in any way. It just happens as the natural result of evaluating the expression.

### Explicit continuations

Let's break down the definition of a continuation again, but this time using code.

A continuation is "something you do to an expression after the expression has been evaluated". Roughly this looks like:

```scheme
> (let ([my-continuation (lambda (x) (+ x 1))
        [my-expression-to-evaluate (+ 1 2)])
 (my-continuation (my-expression-to-evaluate))
)
4
```

Scheme has a notation for capturing and constructing functions from continuations. The notation is `call/cc`, which is short for "call with current continuation." Here's how it works:

```scheme
> (let ([my-continuation (lambda (x) (+ x 1))]
        [my-expression-to-evaluate (+ 1 2)])
    (my-continuation (call/cc (lambda (cont) (cont my-expression-to-evaluate)))))
4
```

Here `call/cc` passes in `my-continuation` as the first argument to the function that it takes as an argument. The function body can choose to continue to the computation by calling `(cont ...` or do something else.

### Use case of continuations: Returning early

When we looked at the `call/cc` with explicit continuations, we saw that `call/cc` captures the continuation, or code which is one level above itself, and passes that into the function that it takes as an argument.

One use for capturting the continuation is the ability to break out of deeply nested expressions, i.e. recursive function calls, without having to return from each one. Consider the function `divide-by-each`, which takes a list of numbers and a single number. `divide-by-each` constructs a new list where the provided argument is divided by each element in the list.

Let's write the version without `call/cc`.

```scheme
> (define error-value "NaN")
> (define divide-by-each (lambda (l n)
                           (cond
                             ((null? l) '())
                             ((= (car l) 0) error-value)
                             (else
                              (let ([rest (divide-by-each (cdr l) n)])
                                (cond
                                  ((list? rest) (cons (/ n (car l)) rest)) ; <-- extra logic for error
                                  (else error-value)))))))
> (divide-by-each '(4 6 8 10) 2)
'(1 1/2 1/3 1/4)
> (divide-by-each '(3 5 1 0) 2)
"NaN"
```

Here we have to add extra conditional logic when checking to see if the returned value is a list or not, then bubble that value up to the top.

Let's write a version with `call/cc` that calls the continuation *directly with the error* instead of adding extra logic for checking for a list.

```scheme
> (define divide-by-each-with-cc
    (lambda (l n)
      (call/cc
       (lambda (cont)
         (letrec ([divide-helper
                   (lambda (l n)
                     (cond
                       ((null? l) '())
                       ((= (car l) 0) (cont error-value)) ; <-- calls directly to the continuation, skipping returns
                       (else (cons (/ n (car l)) (divide-helper (cdr l) n)))
                     ))])
           (divide-helper l n))))))
```

## That's it

Tomorrow, I'd like to learn some more about continuations. Specifically, I'd like to learn about `dynamic-wind`, exceptions, and how to implement coroutines using continuations in Scheme. 
