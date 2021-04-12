---
title: "Configuring Vim for Rust Development"
description: Using ALE, rust.vim, and rust-analyzer with Neovim
date: 2021-04-08T07:20:01-04:00
draft: false
categories: Recurse Center 2021
---

![Screenshot of Neovim, ALE, rust.vim, and rust-analyzer](/neovimrust.png)

Here's how I set up [neovim](https://neovim.io/) to work with [rust-analyzer](https://rust-analyzer.github.io/) using [ALE](https://github.com/dense-analysis/ale).

## Basic setup: ALE and Syntax Highlighting

ALE stands for "Asynchronous Lint Engine" and acts as a language server client for Vim and Neovim. I like it because it eliminates the need to set up different plugins for every language you use. It can do things like:

- Autocomplete
- Fixing (formatting, whitespace/trailing newline removal)
- Linting
- Go to definition

I also installed [rust-lang/rust.vim](https://github.com/rust-lang/rust.vim) for syntax highlighting.

```vim
call plug#begin()
Plug 'dense-analysis/ale'
Plug 'rust-lang/rust.vim'
call plug#end()
```

### Configuring Auto-Complete with ALE

I set auto-completion up using two configuration options:

```vim
" As-you-type autocomplete
set completeopt=menu,menuone,preview,noselect,noinsert
let g:ale_completion_enabled = 1
```

This allows you to see a menu of auto-complete options as you type.

### Configuring Go To Definition

ALE comes with autocomplete, but you have to hover over a symbol and use the `:ALEGoToDefinition` command.

I like to use a ctrl + left-click shortcut to go to the definition for a symbol. I used this configuration to enable that:

```vim
nnoremap <C-LeftMouse> :ALEGoToDefinition<CR>
```

Ctrl + right-click will navigate backwards.

### Configuring fixers

Fixers are programs which ALE uses to format or fix your code. For formatting Rust code I use [`rustfmt`](https://github.com/rust-lang/rustfmt). For all languages, I use `trim_whitespace` and `remove_trailing_lines`. 

```vim
let g:ale_fixers = { 'rust': ['rustfmt', 'trim_whitespace', 'remove_trailing_lines'] }
```

### Rust Analyzer

[`rust-analyzer`](https://rust-analyzer.github.io/) is a language server protocol implementation for Rust. I installed it on Linux by downloading it to a local directory I have in my home directory `~/.bin/` which is in my `$PATH` variable.

```bash
$ curl -o -L ~/.bin/rust-analyzer https://github.com/rust-analyzer/rust-analyzer/releases/download/2021-04-12/rust-analyzer-linux 
$ chmod +x ~/.bin/rust-analyzer
```

*Note: You should use the most recent release from the [releases page](https://github.com/rust-analyzer/rust-analyzer/releases).*

I used the following configuration to tell ALE to use Rust analyzer for Rust files:

```vim
" Required, explicitly enable Elixir LS
let g:ale_linters = {
\  'rust': ['analyzer'],
\}
```

## Final configuration file

```vim
syntax enable
filetype plugin indent on

autocmd BufNewFile,BufRead *.rs set filetype=rust

call plug#begin()
Plug 'dense-analysis/ale'
Plug 'rust-lang/rust.vim'
call plug#end()

let g:ale_linters = {
\  'rust': ['analyzer'],
\}

let g:ale_fixers = { 'rust': ['rustfmt', 'trim_whitespace', 'remove_trailing_lines'] }

" Optional, configure as-you-type completions
set completeopt=menu,menuone,preview,noselect,noinsert
let g:ale_completion_enabled = 1

nnoremap <C-LeftMouse> :ALEGoToDefinition<CR>
```
