---
title: "Day 5: More macros"
description: Implementing a for..in loop with a macro and understanding exactly how it works
date: 2021-04-02T07:20:01-04:00
draft: false
categories: Recurse Center 2021
---

## Where I left off

Yesterday I wrapped up my day with some almost working code to implement a `for..in` loop in Racket. It compiled and kind of did what I set out to do, but not quite.

Today I'll be diving into understand exactly how this code works, and what I can do to fix the problem with the `'(#<void> #<void> #<void> #<void>)` being returned after it runs.

```scheme
#lang racket

(define-syntax for
  (syntax-rules (in)  ; needed to match against for in
    [(for item in list body ...)
     (letrec ([for-in-helper (lambda (l)
                               (cond
                                 ((empty? l) '())
                                 (else
                                  (let ([item (car l)])
                                   (cons body ... (for-in-helper (cdr l)))))))])
       (for-in-helper list))]))

> (let ([list '(1 2 3 4)])
  (for item in list (begin
                    (display item)
                    (newline))))
1
2
3
4
'(#<void> #<void> #<void> #<void>)
```

### Adding a `begin` statement to get rid of the voids

The first issue is that the `for-in-helper` is `cons`ing the `body ...` onto the recursive result of the `for-in-helper`. This ends up with a bunch of `void`s that are added onto the empty list which happens at the end of recursion.

We can use the `begin` statement to fix this issue. The `begin` statement takes the form:

```scheme
(begin
  (expr1)
  (expr2)
  (expr3)
  ret-val
)
```

This allows us to insert a bunch of expressions into our code and only return the last one.

Instead of using `cons body ... (for-in-helper (cdr l))` I'm going to try to use a `begin` statement to call `body ...` and then return the result of the recursive call.

```scheme
(begin
  body ...
  (for-in-helper (cdr l))
)
```

The other issue is the base case of recursion, which is returning an empty list. Instead of returning an empty list, we can just call the Racket procedure [void](https://docs.racket-lang.org/guide/void_undefined.html) and nothing will be displayed.

```scheme
((empty? l) (void))
```

This ensures that we're not returning any kind of value.

Here's the working implementation which doesn't print off void or an empty list.

```scheme
#lang racket

(require macro-debugger/stepper)

(define-syntax for
  (syntax-rules (in)  ; needed to match against for in
    [(for item in list body ...)
     (letrec ([for-in-helper (lambda (l)
                               (cond
                                 ((empty? l) (void))
                                 (else
                                  (let ([item (car l)])
                                   (begin
                                     body ...
                                     (for-in-helper (cdr l))
                                     )))))])
       (for-in-helper list))]))

> (let ([list '(1 2 3 4)])
(for item in list (begin
                    (display (+ 1 item))
                    (newline))))
2
3
4
5
```

## Why does this work?

I still don't fully understand how `define-syntax` and `syntax-rules` work. I kind of get that `define-syntax for` creates a new syntax with expressions starting with `for`. `syntax-rules` kind of makes sense too -- I guess it is defining a syntax rule specifically for the `in` keyword.

But I'm still not really sure so I'm going to dive in to both of these to figure out what is going on.

### `define-syntax`

I found this really useful article called [Fear of Macros](https://www.greghendershott.com/fear-of-macros/all.html#%28part._.Preface%29) which really helped me understand exactly what `define-syntax` was doing.

`define-syntax` is creating what's called a "syntax transformer" -- it takes in syntax, transforms it, and returns the transformed syntax. `define-syntax` binds its first argument, which above is `for`, and tells the compiler that whenever it encounters syntax starting with `for` to pass it to the function defined by the second argument which is the actual syntax transformer.

Here is the simplest way to define a syntax transformer:

```scheme
(define-syntax quack ; <-- the first argument, an id of the syntax we're defining
  (lambda (stx)      ; <-- the second argument, the syntax transformer function
    (syntax "Quack")))
```

### constructing syntax

One part that threw me off in reading about macros was some of the strange syntax. Consider this example for building an if statement:

```scheme
> (define-syntax (our-if-using-match stx)
    (match (syntax->list stx)
      [(list name condition true-expr false-expr)
       (datum->syntax stx `(cond [,condition ,true-expr]
                                 [else ,false-expr]))]))
```

The back tick ` is called a quasiquote, the comma is called an unquote, and together they form a way to build syntax and s-expressions. I'm going to read more about that next week.

