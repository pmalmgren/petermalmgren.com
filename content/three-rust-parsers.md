---
title: "Implementing a calculator parser in Rust"
description: How I implemented a recursive descent calculator parser in Rust
date: 2021-06-01T08:00:00-04:00
categories: Recurse Center 2021
draft: false
---

## Motivation

Parsing is something that I have really struggled with over the past few weeks. And because I've been struggling with it, I've also been avoiding working on it.

For these reasons, it has been hard for me to get up the motivation to work on and understand how parsing algorithms work. But this week I sat through my discomfort long enough to finally understand some of the algorithms and techniques for building a parser. 

Here is everything I've learned while writing this parser, so hopefully I won't forget later.

## What is a parser?

A parser is a program which takes an input string, turns it into a stream of tokens, and then transforms the token stream into an abstract syntax tree. If the program is incorrectly specified, it will return an error.

Parsers exist for all major programming languages, as well as for smaller special purposes languages such as JSON, YAML, and HTTP. They are one of the most important parts of both compilers, like `gcc`, and interpreters like Python.

### Building a parser

To build a parser we need two things. The first is a language, specified as a formal grammar. The second is a parsing algorithm that we want to use, and a way to transform the grammar that we picked into a grammar that we can use with our parser. 

There are many different ways to specify a grammar, but certain parsing algorithms require certain grammar types to work correctly. Here I am focused on a top down method of parsing called *recursive descent parsing*, which requires a grammar with no left recursive production rules.

Because most of this post is focused on a Rust *implementation* rather than *theory*, I encourage you to read [Parsing Expressions by Recursive Descent](https://www.engr.mun.ca/~theo/Misc/exp_parsing.htm) which goes a little bit more into the theory behind grammars.

## A calculator

To make things simple, I decided to implement a simple arithmetic calculator and will be using and building on this idea for the remainder of this post. Here are some examples of how valid syntax will look in this language.

### Basic operations 

Addition, subtraction, multiplication, and division are all supported:

```
> 2 + 3
5
> 100 - 10
90
> 3 * 4
12
> 12 / 4
3
> 2 ^ 8
256
```

Negative numbers are also supported, via a unary operator `-`:

```
> -10 + 10
0
```

Finally, to give the user control over the order of operations, parentheses are available:

```
> 2 ^ 3 + 2
10
> 2 ^ (3 + 2)
32
```

Bad things, such as questions and incorrectly specified arithmetic expressions, are prohibited:

```
> 2 +++++ *** 999
error
> 2 ^^^^^^^^^^^^^^^^^^^ 78438734
error
> hello?
error
```

### A simple grammar for addition

A grammar is a set of production rules, which are rules that help us produce valid statements in a given language. 

We can define a really simple grammar using a couple of production rules:

```
S -> E0 end
E0 -> E0 "+" E1 | E1
E1 -> P
P -> v | "-"E1
v -> [0-9]+
```

We can use this rule to formulate strings like this:

``` 
1. Start with S, then E0
2. For E0, pick E0 "+" E1
> E0 "+" E1
3. For the E0 in the new string, pick E0 "+" E1
> E0 "+" E1 "+" E1
4. For E0 in the string, pick E1
> E1 "+" E1 "+" E1
5. For the first E1, pick P, then v, then 10
> 10 "+" E1 "+" E1
6. For the second and third E1s, pick P, then "-"E1
> 10 "+" "-"E1 + "-"E1
7. For the second and third E1s, pick P, then v, then 5
> 10 "+" "-"5 + "-"5
8. Return the string
10 + -5 + -5
```

Some terminology is important here:

- The `S` and `E0` in statements like `S -> E0 end` are called nonterminals
- `v` and `end` are called terminals
- The pipe character `|` means "or"

### Parser pseudocode and left recursion

Writing a top down parser has one basic approach: take each production rule and turn it into a function. Each production rule function usually takes a token stream, can consume one or more tokens, and then call either itself, or a higher numbered production rule.

Let's use this approach to quickly sketch out some pseudocode for the above grammar:

```rust
fn S(code) -> Expression {
    expression := E0(code)
    assert_next_token(code, END)
    return expression
}

fn E0(code) -> Expression {
    // E0 will never return!
    lhs := E0(code)
}
```

The grammar we specified has a big problem which became apparent as soon as we wrote the `S` function: it is left recursive. This means that the left hand side of a production rule immediately refers to itself without consuming a token, so we enter into an endless loop.

We need to re-factor the grammar to make it right recursive. There is one simple transformation we can apply to our grammar which eliminate left recursion. This transformation says that any rule of the form `A -> a | Ab` can be rewritten in the form `A -> a {b}` where `{b}` means zero or more b.

We can rewrite the first rule of our grammar to meet the necessary form:

```
E0 -> E0 "+" E1 | E1
becomes
E0 -> E1 | E0 "+" E1
```

Then we can use substitution and apply the transformation. Here `a` is `E1` and `b` is `"+" E1`. We'll also consolidate `E1` with `P` since there isn't any meaningful difference at this point.

```
E0 -> P { "+" P }
P -> v | "-"P
v -> [0-9]+
```

Now we can write our parser pseudocode!

```rust
fn S(code) -> Expression {
    expression := E0(code)
    assert_next_token(code, END)
    return expression
}

fn E0(code) -> Expression {
    expr := P(code)
    while next(code) == ADD {
        consume()
        rhs := P(code)
        // expr can either be (ADD, lhs, rhs), (NUMBER, num) or (UNARY, "-", expr)
        expr = expr(ADD, expr, rhs)
    }

    return expr
}

fn P(code) -> Expression {
    if next(code) == "-" {
        consume()
        return expr(UNARY, "-", P(code))
    } else if next(code).is_number() {
        num := next(code)
        consume()
        return expr(NUMBER, num)
    } else {
        error
    }
}
```

This is pseudo-code for a recursive descent parser. Recursive descent parsing mirrors the structure of a grammar, but it can only operate on grammars which aren't left recursive.

To get a better understanding of how this simple parser works, I recommend stepping through the above parsing algorithm with a few example inputs, and a pen and paper. If my example is hard to follow, check out [this article](https://www.engr.mun.ca/~theo/Misc/exp_parsing.htm#RDP) which helped me out a lot.

### Expanding our grammar to include order of operations

So far we have a grammar which lets us formulate strings which are either one number, or two or more numbers added together. Numbers can be negative with a unary operator. We also have pseudocode for a parser which consumes a series of tokens and builds an expression, or abstract syntax tree.

To build a complete calculator, we need four other operators--multiplication, subtraction, division, and the exponent--as well as parentheses. This means that we also need to take into account order of operations (remember [PEMDAS?](https://en.wikipedia.org/wiki/Order_of_operations)).

Here's how we can add these order of operations to our grammar:

```
S -> E end
E -> T {("+" | "-") T}
T -> F {("*" | "/") F}
F -> P ["^" F]
P -> v | "(" E ")" | "-" T
```

Notice how there is a rule for each level of precedence. If you follow along, you will see that the `E` production rule that encapsulates addition and subtraction immediately refers to `T` which encapsulates the higher precedence operations of multiplication and division.

## Implementing recursive descent in Rust

There are three approaches that I implemented in my [calculator repository](https://github.com/pmalmgren/rust-calculator), but the one I'll be talking about in this post is recursive descent.

### Some nice things about writing parsers in Rust

There are two features of Rust that make parsing nice:

- First class support for streams of tokens and characters with `Iter` and `Peekable`
- A strong type system with support for recursive data structures

The big drawback for using Rust for anything *recursive*, including a *recursive* descent parser, is that it isn't tail call optimized. If you want to use a Rust parser to parse large chunks of code, you'll want to either [increase your stack size](https://www.reddit.com/r/rust/comments/872fc4/how_to_increase_the_stack_size/) or follow a [workaround](https://dev.to/seanchen1991/the-story-of-tail-call-optimizations-in-rust-35hf).

For our calculator stack size limits don't really matter.

### Boilerplate

We need a way to run a REPL (read eval print loop) to accept, validate, parse, and evaluate input from the user. Here's some boilerplate for that:

```rust
use std::error::Error;

fn eval(line: String) -> Result<(), Box<dyn Error>> {
    let mut token_iter = tokens.iter().peekable();
    let mut parser = Parser::new(&mut token_iter);
    let result = parser.parse();
    match result {
        Ok(mut ast) => println!("{}", ast.eval()),
        Err(e) => return Err(Box::new(e)),
    }

    Ok(())
}

fn get_line() -> String {
    print!("> ");
    std::io::stdout().flush().unwrap();
    let mut input = String::new();
    match std::io::stdin().read_line(&mut input) {
        Ok(_s) => {}
        Err(_e) => {}
    };
    input.trim().to_string()
}


fn run_repl() -> Result<(), Box<dyn Error>> {
    loop {
        let line = get_line();
        if line == "quit" {
            return Ok(());
        }
        if let Err(e) = eval(line) {
            println!("Error: {}", e);
        }
    }
    Ok(())
}

fn run() -> Result<(), Box<dyn Error>> {
    run_repl()
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {}", e);
    }
}
```

We'll also need an error type for syntax errors of two different types, lexical errors and parse errors. "Lex" errors are picked up by the tokenizer and are characters which are unrecognized in our grammar. "Parse" errors are generated by the parser and are things like missing closing parentheses. Here's what I used:

```rust

#[derive(Debug)]
struct SyntaxError {
    message: String,
    level: String,
}

impl SyntaxError {
    fn new_lex_error(message: String) -> Self {
        SyntaxError {
            message,
            level: "Lex".to_string(),
        }
    }

    fn new_parse_error(message: String) -> Self {
        SyntaxError {
            message,
            level: "Parse".to_string(),
        }
    }
}

impl fmt::Display for SyntaxError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{} Error {}", self.level, self.message)
    }
}

impl Error for SyntaxError {}
```

### Data structures 

We need a way to define tokens, which are all the valid set of characters in our language. We can do this with an enumerator:

```rust
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
enum Token {
    Plus,
    Dash,
    Star,
    Slash,
    Caret,
    RightParen,
    LeftParen,
    End,
    Number(i64),
}
```

We also need a definition of operators, which are `+-/*^` for arithmetic, and the unary `-` operator for negative numbers.

```rust
#[derive(Debug, PartialEq, Eq)]
enum Operator {
    Add,
    Multiply,
    Divide,
    Subtract,
    Power,
    Negative,
}
```

We'll also implement a conversion from tokens to operators by implementing the `TryFrom` trait:

```rust
impl TryFrom<Token> for Operator {
    type Error = &'static str;

    fn try_from(token: Token) -> Result<Self, Self::Error> {
        match token {
            Token::Plus => Ok(Operator::Add),
            Token::Star => Ok(Operator::Multiply),
            Token::Dash => Ok(Operator::Subtract),
            Token::Caret => Ok(Operator::Power),
            Token::Slash => Ok(Operator::Divide),
            _ => Err("Can only convert operators"),
        }
    }
}
```

Finally, we can use the definition of `Operator` to build a definition of `Expression`, which is our `AST`.

```rust
#[derive(Debug, PartialEq, Eq)]
enum Expression {
    Binary(Operator, Box<Expression>, Box<Expression>),
    Unary(Operator, Box<Expression>),
    Number(i64),
}
```

For the actual number crunching part, we can implement an expression evaluator:

```rust
impl Expression {
    fn eval(&mut self) -> i64 {
        match self {
            Expression::Number(n) => *n,
            Expression::Unary(_negative, expr) => -1 * expr.eval(),
            Expression::Binary(Operator::Add, expr1, expr2) => {
                expr1.eval() + expr2.eval()
            }
            Expression::Binary(Operator::Multiply, expr1, expr2) => {
                expr1.eval() * expr2.eval()
            }
            Expression::Binary(Operator::Subtract, expr1, expr2) => {
                expr1.eval() - expr2.eval()
            }
            Expression::Binary(Operator::Power, expr1, expr2) => {
                expr1.eval().pow(expr2.eval() as u32)
            }
            Expression::Binary(Operator::Divide, expr1, expr2) => {
                expr1.eval() / expr2.eval()
            }
            _ => {
                panic!("Unreachable code: for expr {:?}", self);
            }
        }
    }
}
```

I won't summarize how to tokenize a string here, but if you're curious you can refer to [the code I wrote for this post](https://github.com/pmalmgren/rust-calculator/blob/43d5f57220044a361749cfbf36d409a70544bce3/src/main.rs#L474-L523) and my [previous blog post on tokenizing in Rust](/token-scanning-with-rust/).

### A parsing struct

A lot of parsing code is hard to follow because it uses global variables and functions with side-effects, such as `next()` to get the next token from a token stream, and `consume()` to move on to the next token.

I decided to make this explicit by encapsulating the token stream in a `Peekable<Iter<Token>>` struct. `Peekable` allows us to peek ahead one character in the stream without consuming it, and the `Iter` struct keeps track of consuming tokens for us. This is the definition I used:

```rust
struct Parser<'a> {
    iter: &'a mut Peekable<Iter<'a, Token>>,
}

impl<'a> Parser<'a> {
    fn new(iter: &'a mut Peekable<Iter<'a, Token>>) -> Self {
        Parser { iter }
    }

    fn assert_next(&mut self, token: Token) -> Result<(), SyntaxError> {
        let next = self.iter.next();
        if let None = next {
            return Err(SyntaxError::new_parse_error(
                "Unexpected end of input".to_string(),
            ));
        }

        if *next.unwrap() != token {
            return Err(SyntaxError::new_parse_error(format!(
                "Expected {:?} actual {:?}",
                token,
                next.unwrap(),
            )));
        }

        Ok(())
    }

    fn parse(&mut self) -> Result<Expression, SyntaxError> {
        let ast = self.expression()?;
        self.assert_next(Token::End)?;
        Ok(ast)
    }
}
```

This allows us to write methods which take `&mut self` as a parameter, and consume the current cursor position with calls like `self.iter.next()` and peek at the next cursor position with `self.iter.peek()`.

The other nice thing about these methods are that the return types are roughly the same. They all return a `Result` of either the unit-type `()` or `Expression` with a `SyntaxError`. This lets us use the [`?` operator](https://doc.rust-lang.org/edition-guide/rust-2018/error-handling-and-panics/the-question-mark-operator-for-easier-error-handling.html) for better error handling, which results in less control logic.

### Parsing logic

Here is our calculator's grammar:

```
S -> E end
E -> T {("+" | "-") T}
T -> F {("*" | "/") F}
F -> P ["^" F]
P -> v | "(" E ")" | "-" T
```

We need a few additional rules to understand some of this terminology:

- The curly braces `{}` represent zero or more of the rules inside of them
- The square braces `[]` represent an optional part of a production rule

We can now translate each level into a method on our parsing struct:

```rust
impl<'a> Parser<'a> {
    ...

    fn primary(&mut self) -> Result<Expression, SyntaxError> {
        let next = self.iter.next().unwrap();

        match next {
            Token::Number(n) => Ok(Expression::Number(*n)),
            Token::RightParen => {
                let expr = self.expression()?;
                self.assert_next(Token::LeftParen)?;
                Ok(expr)
            }
            Token::Dash => {
                let expr = self.factor()?;
                Ok(Expression::Unary(
                    Operator::Negative,
                    Box::new(expr),
                ))
            }
            _ => Err(SyntaxError::new_parse_error(format!(
                "Unexpected token {:?}",
                next
            ))),
        }
    }

    fn factor(&mut self) -> Result<Expression, SyntaxError> {
        let expr = self.primary()?;
        let next = self.iter.peek().unwrap();
        if *next == &Token::Caret {
            self.iter.next();
            let rhs = self.factor()?;
            return Ok(Expression::Binary(
                Operator::Power,
                Box::new(expr),
                Box::new(rhs),
            ));
        }

        Ok(expr)
    }

    fn term(&mut self) -> Result<Expression, SyntaxError> {
        let mut expr: Expression = self.factor()?;

        loop {
            let next = self.iter.peek().unwrap();
            match next {
                Token::Star => {
                    self.iter.next();
                    let rhs = self.factor()?;
                    expr = Expression::Binary(
                        Operator::Multiply,
                        Box::new(expr),
                        Box::new(rhs),
                    );
                }
                Token::Slash => {
                    self.iter.next();
                    let rhs = self.factor()?;
                    expr = Expression::Binary(
                        Operator::Divide,
                        Box::new(expr),
                        Box::new(rhs),
                    );
                }
                _ => break,
            };
        }

        Ok(expr)
    }

    fn expression(&mut self) -> Result<Expression, SyntaxError> {
        let mut expr: Expression = self.term()?;

        loop {
            let next = self.iter.peek().unwrap();
            match next {
                Token::Plus => {
                    self.iter.next();
                    let rhs = self.term()?;
                    expr = Expression::Binary(
                        Operator::Add,
                        Box::new(expr),
                        Box::new(rhs),
                    );
                }
                Token::Dash => {
                    self.iter.next();
                    let rhs = self.term()?;
                    expr = Expression::Binary(
                        Operator::Subtract,
                        Box::new(expr),
                        Box::new(rhs),
                    );
                }
                _ => break,
            };
        }

        Ok(expr)
    }
}
```

### A couple of notes

General recursive descent parsers have a few disadvantages:

- The order of operations, associativity, and ambiguity are handled implicitly by the algorithm
- The size, speed, and complexity of these parsers are dependent on the number of precedence levels
- They cannot handle left recursion in production rules

Most of these, other than the left recursion issue, can be mitigated by using the precedence climbing algorithm. I won't be going into that in this post, but if you're curious I recommend checking out both [my Rust implementation](https://github.com/pmalmgren/rust-calculator/blob/43d5f57220044a361749cfbf36d409a70544bce3/src/main.rs#L158-L233) and [this article](https://www.engr.mun.ca/~theo/Misc/exp_parsing.htm#more_climbing).
