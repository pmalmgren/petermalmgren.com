---
title: "Creating a Token Scanner With Rust"
description: Using CharIndices and peekable iterators to create a token scanner
date: 2021-05-03T07:29:21-04:00
categories: Recurse Center 2021
draft: false
---

## What is a token scanner?

A token scanner takes a character stream and turns it into a stream of tokens, which are valid characters or character combinations for a given programming language.

I've been going through [Crafting Interpreters](https://craftinginterpreters.com/) course using Rust instead of Java. Part of the course is implementing a token scanner for the [Lox language](https://craftinginterpreters.com/the-lox-language.html). 

While I was reading the chapter, I was more or less translating the Java version into Rust. I ran into several things that looked like anti-patterns or didn't feel quite right in Rust, including:

- Keeping track of the start and current character offset
- Conditionally consuming characters for tokens longer than 1 character, such as `!=`, strings, and numbers
- Conditionally consuming characters until some condition(s), such as EOF, newline, or a space, are met

Here's how I built a token scanner in Rust using `std::str::CharIndices`.

## A Scanning Algorithm

Let's define a set of tokens based on an imaginary language:

1. Plus `+`
2. Double equals `==`
3. Not equal `!=`
4. Strings `"hey I'm a string"`
5. Numbers `1234`

Given this input string:

```rust
12 + 24 == 36 12 + 24 != 52 "I'm a string" & ^
```

We want to produce something like:

```rust
Token::Number(12)
Token::Plus(+)
Token::Number(24)
Token::EqualEqual(==)
Token::Number(12)
Token::Plus(+)
Token::Number(24)
Token::NotEqual(!=)
Token::Number(52)
Token::StringLiteral("I'm a string")
Token::Invalid("&")
Token::Invalid("^")
```

Here is the start of a scanning algorithm which generates tokens from a stream:

```rust
enum Token {
  Plus,
  EqualEqual,
  NotEqual,
  Number(u32),
  StringLiteral(String),
  Invalid(String),
}

fn scanner(input: String) -> Vec<Token> {
  let mut tokens: Vec<Token> = Vec::new();
  let mut current = 0;
  let mut start = 0;

  while current <= input.len()-1 {
    start = current;
    let char = input.chars().nth(current);
    current += 1;
    match char {
      // simple case - match a single token
      '+' => tokens.push(Token::Plus),
      '=' => {},
      '!' => {},
      '"' => {},
      c if char::alphabetic(c) => {},
      _ => Token::Invalid,
    };
  }
}
```

Most of the complexity in this scanner comes from dealing with conditional character offsets from having to peek ahead in the stream.

For example, if the current character in the stream is `=` we don't know if it is a single equals sign or a double equals sign without peeking ahead.

Also, if we run into a quote or a number, we have to advance and consume characters until we find either a non-alphanumeric character or a non-numeric character.

Finally, when we generate the token, we also have to keep track of the line number and column where it originated!

There is a lot of state to keep track of here, but luckily `CharIndices` can help us manage the current position, along with providing support for conditional advancement.

## Introducing CharIndices

`CharIndices` is an iterator which yields tuples of characters and their positions. We can build one easily from a string or string slice with the method [char_indices](https://doc.rust-lang.org/std/primitive.str.html#method.char_indices).

Here's a skeleton version of a token parser built using `CharIndices`:

```rust
use std::env;

#[derive(Debug)]
enum Token {
  Plus,
  Equal,
  EqualEqual,
  NotEqual,
  Number(u32),
  StringLiteral(String),
  Invalid(String),
}

fn main() {
    let args = env::args();
    if args.len() != 2 {
        eprintln!("Usage: parser str");
        return;
    }
    let args: Vec<String> = args.collect();
    let input = args[1].clone();

    let mut char_indices = input.char_indices();
    let mut tokens: Vec<Token> = Vec::new();

    for (pos, ch) in char_indices {
        let token = match ch {
            '+' => Token::Plus,
            _ => Token::Invalid(format!("{}", ch)),
        };
        tokens.push(token);
    }

    println!("{:?}", tokens);
}
```

### Don't forget the borrow checker

If we're just enumerating characters and indices, `char_indices` along with a `for..in` loop works well. However, using `for..in` moves the iterator, making it impossible to access later for conditional advancement. Instead of using `for..in` we can use the `while..let` loop construct, allowing us to loop while the iterator yields `Some` value:

```rust
while let Some((pos, ch)) = char_indices.next() {
    // do something with pos, ch
    // borrow char_indices
}
```

### Peeking & Conditional Advancement

`CharIndices` supports peeking and conditional advancement by creating a `Peekable` struct with the `peekable` method. The `Peekable` struct has two methods called `next_if` and `next_if_eq`. These methods let us conditionally advance the current scanner position based on equality, or by matching on some predicate.

We can use `next_if_eq` along with `peekable` to implement all of the two-character token matches:

```rust
let mut char_indices = input.char_indices().peekable();
let mut tokens: Vec<Token> = Vec::new();

while let Some((pos, ch)) = char_indices.next() {
    let token = match ch {
	'+' => Token::Plus,
	'=' => {
	    match char_indices.next_if_eq(&(pos+1, '=')) {
		Some(_equals) => Token::EqualEqual,
		None => Token::Equal,
	    }
	},
	'!' => {
	    match char_indices.next_if_eq(&(pos+1, '=')) {
		Some(_equals) => Token::NotEqual,
		None => Token::Invalid("!".to_string()),
	    }
	},
	_ => Token::Invalid(format!("{}", ch)),
    };
    tokens.push(token);
}
```

### Matching multiple tokens

Consider a string in our language. It is a series of characters started and terminated by the double-quote character `"`. If we were keeping track of the string indexes ourselves, we'd need to do something like:

```rust
// this code probably won't compile
let mut in_string = false;
let mut v = "".to_string();
let mut tokens: Vec<Token> = Vec::new();
for ch in input {
    if ch == '"' {
    	if in_string {
	    in_string = false;
	    tokens.push(Token::String(v));
	    v = "".to_string();
	} else {
	    in_string = true;
	    v += ch;
	}
    }
}
```

Rust iterators provide a really elegant way to solve the problem of consuming while a certain condition is met. The method they provide is `take_while`, which takes a predicate function that returns a `bool`. If `bool` is `true`, then characters are consumed and returned from the iterator, otherwise the iterator terminates.

[`take_while`](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.take_while) creates a new iterator by moving the original iterator, which means that we can't use the original iterator after we create a new one with `take_while`. Fortunately, we can use the iterator method [`by_ref()`](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.by_ref) to borrow a mutable copy of the original.

Borrowing a mutable copy means that all items consumed by the `take_while` iterator will also consume them from the original stream, which makes it perfect for our use case.

Here's how we can use `take_while` to consume strings from the character stream:

```rust
'"' => {
    let s: String = char_indices
	.by_ref()
	.take_while(|(_pos, c)| { *c != '"' })
	.map(|(_pos, c)| { c })
	.collect();

    Token::StringLiteral(s)
},
```

`map` maps the pair `(usize, char)` to a single `char` and `collect()` puts all of the characters into a single `String` for us.

The only issue here is that if we reach the end of the file or a newline, we don't actually want the token generator to produce a `StringLiteral` - we'd want some kind of syntax error or invalid token instead.

I solved this issue by keeping track of the last character matched. If it is `"`, then we know the string was terminated properly, otherwise we know that the string wasn't terminated properly and can produce an invalid token:

```rust
'"' => {
    let mut last_matched: char = '\0';

    let s: String = char_indices
	.by_ref()
	.take_while(|(_pos, c)| { 
	    last_matched = *c;
	    *c != '"'
	})
	.map(|(_pos, c)| { c })
	.collect();

    match last_matched {
	'"' => Token::StringLiteral(s),
	_ => Token::Invalid(
	    "Unterminated literal.".to_string()
	),
    }
}
```

## Final code & TODOs

Here is the code that we have written so far:

```rust
use std::env;

#[derive(Debug)]
enum Token {
  Plus,
  Equal,
  EqualEqual,
  NotEqual,
  Number(u32),
  StringLiteral(String),
  Invalid(String),
}

fn main() {
    let args = env::args();
    if args.len() != 2 {
        eprintln!("Usage: parser str");
        return;
    }
    let args: Vec<String> = args.collect();
    let input = args[1].clone();

    let mut char_indices = input.char_indices().peekable();
    let mut tokens: Vec<Token> = Vec::new();

    while let Some((pos, ch)) = char_indices.next() {
        let token = match ch {
            '+' => Token::Plus,
            '=' => {
                match char_indices.next_if_eq(&(pos+1, '=')) {
                    Some(_equals) => Token::EqualEqual,
                    None => Token::Equal,
                }
            },
            '!' => {
                match char_indices.next_if_eq(&(pos+1, '=')) {
                    Some(_equals) => Token::NotEqual,
                    None => Token::Invalid("!".to_string()),
                }
            },
            '"' => {
                let mut last_matched: char = '\0';
                let s: String = char_indices
                    .by_ref()
                    .take_while(|(_pos, c)| { 
                        last_matched = *c;
                        *c != '"' 
                    })
                    .map(|(_pos, c)| { c })
                    .collect();

                match last_matched {
                    '"' => Token::StringLiteral(s),
                    _ => Token::Invalid(
                        "Unterminated literal.".to_string()
                    ),
                }
            },
            _ => Token::Invalid(format!("{}", ch)),
        };
        tokens.push(token);
    }

    println!("{:?}", tokens);
}
```

Here are some things left to make this a complete token parser:

- Add number parsing
- Spaces and newline characters are counted as `Token::Invalid`, they should either be discarded or tokenized
- Line numbers and column numbers should be associated with tokens
- The token parser should accept files or multi-line input
- Tests

The behavior which yields tokens from a character stream could probably be abstracted into its own `Iterator` for re-usability and encapsulation.
