---
title: "Cool things I learned about Bash this week"
description: Typed variables, network programming, Oh My Bash, and more!
date: 2021-06-02T09:15:03-04:00
draft: false
---

{{< rawhtml >}}
<div class="headline-image">
<img src="/bash.png" alt="Bash official logo" />
</div>
{{< /rawhtml >}}

## What is a shell?

[Bash](https://www.gnu.org/software/bash/) is a kind of program called a shell. Shells are usually text-based, and allow us to interact with our computers by exposing a set of builtin functions for things like directory and file navigation, and run commands. The first Unix shell was called the [Thompson shell](https://en.wikipedia.org/wiki/Thompson_shell) and was written in 1971. Shells have come a long way since then, but more modern shells, including Bash, still use a bunch of the same ideas and concepts as this original shell that was written almost 50 years ago.

If you're interested in the history of Unix and Unix shells, I recommend reading [The Traditional Bourne Shell Family](https://www.in-ulm.de/~mascheck/bourne/index.html), which gives a great overview of the history and lineage of shells in Unix.

## What is Bash?

The [Bash](https://www.gnu.org/software/bash/) shell is pretty much everywhere. It comes as the default shell on macOS and most distributions of Linux, and is available to install and use on Windows, FreeBSD, and other operating systems.

Because it is so widely available, Bash scripts are a very common way to do things like automate tasks, run programs to parse logs and files, and run commands on CI/CD servers. Bash, along with a few other tools, are some of the most important and valuable tools to know as a software engineer. This is why I've spent the past couple of days diving into parts of Bash I didn't know about before.

## Things I learned about Bash

I decided to dive deeper into Bash this week because after glancing through the [Advanced Bash-Scripting Guide](https://tldp.org/LDP/abs/html/index.html) I saw a *bunch* of topics that I knew nothing about. Here are some cool things I learned by reading through that book and other resources.

### A nicer environment with Oh My Bash

[Oh My Bash](https://ohmybash.nntoan.com/) is a framework for managing functions, helpers, plugins, and themes. It is (obviously) inspired by [Oh My Zsh](https://ohmyz.sh/) and has many of the same features.

After using Oh My Zsh for a couple of years, I always felt that the Bash shell was limited. But with Oh My Bash, things feel pretty similar to Oh My Zsh. I probably won't make the switch to Oh My Bash because of my large `.zshrc` file that I don't want to migrate, but if I were starting over, I would seriously consider Oh My Bash.

The only small problem I ran into was with `tmux`, which refused to acknowledge Bash as the shell. I had to fix this by adding one line to my `.tmux.conf` file:

```bash
set-option -g default-shell /bin/bash
```

### Typing and identifying variables with `declare`

Bash variables are declared with the assignment operator, and can be made global with an `export` statement. Bash variables are also inherently untyped, meaning that operations on `num` will all proceed without an error for any of the following values:

```bash
$ num=1
$ num="hey"
$ num=(1 2 3 4)
```

We can use `declare` to provide a kind of typing on Bash variables. We can make variables readonly with `declare -r`:

```bash
$ declare -r readonly=1
$ readonly=2
-bash: readonly: readonly variable
```

We can make a variable an integer with the `-i` flag, and use it to assign the output of an arithmetic expression to the variable, and also restrict it from floating point operations:

```bash
$ declare -i x=10*8; echo $x
80
$ x+=1.2
-bash: 1.2: syntax error: invalid arithmetic operator (error token is ".2")
```

Interestingly, we can do arithmetic on strings with `x` but these always evaluate to `0`.

```bash
$ x+="hey"; echo $x
80
$ x=$x*"hey"; echo $x
0
```

There are also two interesting flags which will either lowercase or uppercase the string contents of a variable after assignment:

```bash
$ declare -u s=$(ls); echo $s
ARR-CHOICE.SH KEYPRESS.SH
$ declare -l s2=$s; echo $s2
arr-choice.sh keypress.sh
```

We can also use `declare` to search for anything in the Bash environment, including functions:

```bash
$ declare | grep my_fun
$ my_fun () { echo "hey"; }
$ declare | grep my_fun
my_fun ()
```

This is useful when you define a function in a Bash script and want to avoid defining it again if the script is run again.

### Using `let`, arithmetic expansion, and `expr` to do arithmetic

`declare` can enable arithmetic expressions via the `declare -i` command, but there are also a few other builtin commands which can enable arithmetic expression evaluation.

`let` allows us to assign a variable name to an arithmetic expression, or to mutate the variable after it has been assigned:

```bash
$ let x=4*3902; echo $x
15608
$ let x/=3902; echo $x
4
```

Arithmetic expansion, which is an expression of the form `$(( expr ))` lets us mutate variables with certain operators, or just assign the output of some arithmetic expression to a variable to use later.

```bash
$ echo $(( 98765 * 43210 ))
4267635650
$ let x=9999; (( x++ )); echo $x
10000
```

`expr` lets us evaluate arbitrary expressions via command line arguments, but you have to make sure to escape certain operators:

```bash
$ expr 10 + 10
20
$ expr 10 \* 10
100
$ expr (10 \* 10) \> 10
1
$ expr (10 \* 10) \> 100
0
```

### Here documents and templates

Here documents are multiline *code blocks* which can be used to form multi-line inputs to commands. They take the following format and return a multi-line string, with variables and commands inside evaluated:

```bash
<<LimitString
line #1
line #2
line #3
LimitString
```

Here is how you'd use one to make a multiline string in Bash:

```bash
$ cat <<EOF
line 1
line 2
line 3
line 4
EOF
```

I have used these briefly before, but what I learned is that you can put them inside functions or shell scripts and use them as templates. Here's an example HTML template built with a here document and Bash function:

```bash
$ render_template () {
>   cat <<EOF
> <html>
>   <head>
>     <title>My Page</title>
>   </head>
>   <body>
>     <h1>Hello $1</h1>
>   </body>
> </html>
> EOF
> }
$ render_template "peter"
<html>
  <head>
    <title>My Page</title>
  </head>
  <body>
    <h1>Hello peter</h1>
  </body>
</html>
```

I think this is pretty cool! You could even use this with a program like `nc` or `socat` to make a web server written (mostly) in Bash.

### Directory navigation with dirs, pushd, and popd

I've always used `cd`, `pwd`, and file paths to change directories, but I learned that you can use the builtin command `dirs` along with `pushd` and `popd` to navigate directories in a slightly non-linear way.

Bash maintains a stack of directories that you can use for navigation. We can see this stack by running the `dirs` command:

```bash
$ dirs
~ 
$ pwd
~
```

If there is only one element on the stack, then it is the current working directory.

We can push and pop directories off the stack, while maintaining the history of directories we've traversed, with the `popd` and `pushd` commands:

```bash
$ pushd /usr/share/man/man4/
/usr/share/man/man4 ~
$ pushd /etc
/etc /usr/share/man/man4 ~
```

`pushd` can also refer to earlier items in the stack with the offset `-n`. Here's how we'd get back to the man pages directory while preserving all items on the stack:

```bash
$ dirs
/etc /usr/share/man/man4 ~
$ pushd -1
/usr/share/man/man4 ~ /etc
```

We can also go back to earlier directories by popping off the stack, either by specifying a position or leaving it empty and popping off the last entry:

```bash
$ pushd /sys
/sys /usr/share/man/man4 ~ /etc
$ popd
/usr/share/man/man4 ~ /etc
$ popd
~ /etc
$ popd
/etc
```

### Redirections and file I/O

We can use bash to operate directly on file descriptors with the syntax `[n]<>file`, where `<` means that we'll open the file for reading and `>` means that we'll open the file for writing.

Here's how we'd open `/etc/passwd` for reading, and output its contents with `cat`:

```bash
$ exec 5</etc/passwd
$ cat <&5
```

We can use this syntax to copy files.

```bash
$ exec 5</etc/passwd
$ exec 6>/tmp/passwd
$ cat <&5 >&6
```

We can also use this to redirect standard input and output. Here's an example where we send all the output from a process to `/dev/null`:

```bash
$ exec 6>/dev/null
$ echo 1>&6 "where did I go"
$
```

These file descriptors can be closed with the syntax `[n]>&-` and/or `[n]<&-` depending on if you created the file descriptor for reading or writing.

You can also check open file descriptors with the `lsof` command, which I don't recommend running without flags because it will list every open file descriptor of every type on your machine. If you just want to see file descriptors open on your current shell, you can use the Bash variable `$BASHPID` and the `-p` flag:

```bash
$ lsof -p $BASHPID
```

### Network programming with redirections

Network programming can be accomplished in Bash with [redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html) and the `/dev/net/tcp` directory.

The `/dev/net/tcp` directory can be used with Bash I/O net redirection to open and close TCP sockets like this:

The `[n]<>` syntax means open a file descriptor for both reading and writing on file descriptor `n`. 

```bash
$ exec 3<>/dev/tcp/neverssl.com/80
$ echo -e "GET / HTTP/1.1\r\nhost: neverssl.com\r\n\r\n" >&3
$ cat <&3
<html>
...
```

You can check the current time with this command:

```bash
$ cat </dev/tcp/time.nist.gov/13

59367 21-06-02 16:24:19 50 0 0 219.2 UTC(NIST) *
```

There aren't any ways to use redirections to listen on a port, so redirections can only be used for client side programming.

There are more examples here: https://admin-ahead.com/forum/general-linux/how-to-open-a-tcpudp-socket-in-a-bash-shell/

## Final thoughts

Although I will probably switch back to using Zsh, learning about Bash was pretty neat. As a followup post, I may try to explain how I would write an HTTP server with a bash script and `socat`.
