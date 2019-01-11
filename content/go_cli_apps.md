---
title: Testing Go CLI Apps
url: /go-cli-app-testing/
draft: false
date: 2019-01-10
meta: false
categories: golang
---

<div class="image-credit">
<img src="/gopher.svg"/>
<p>Credit: <a href="https://github.com/egonelbre/gophers">https://github.com/egonelbre/gophers</a></p>
</div>

Recently I've been building some CLI applications using Go and [cobra](https://github.com/spf13/cobra), and have been looking for an easy, reproducible way to build and test their behavior by launching the binary and testing it out with actual command line arguments. Here is what I came up with using a `Makefile` and `exec.Command`.

## Testing gecko

`gecko` is a `go` version of echo. It takes arguments from the command line and writes them to standard output:

<span class="filename">gecko.go</span>
```go
package main

import (
    "fmt"
    "os"
    "strings"
)

func main() {
    fmt.Println(strings.Join(os.Args[1:], " "))
}
```

### Test code

To test this application, we can write a test function which calls `gecko` with `os.Exec`, checks the contents of standard output, and then verifies it is what we expect.

<span class="filename">gecko_test.go</span>
```go
package main

import (
    "bytes"
    "fmt"
    "testing"
    "os/exec"
)

func TestGecko(t *testing.T) {
    cmd := exec.Command("./gecko", "hello")
    var out bytes.Buffer
    cmd.Stdout = &out
    err := cmd.Run()
    if err != nil {
        t.Fatalf("Unexpected error: %v", err)
    }

    if out.String() != "hello\n" {
        t.Errorf("Expected 'hello' received '%s'", out.String())
    }
}
```

### Running the test

Before we run the test, we have to compile the binary.

```bash
$ go build -o gecko
$ tree
.
├── gecko
├── gecko.go
└── gecko_test.go

0 directories, 3 files
$ go test
PASS
ok      github.com/pmalmgren/gecko       0.012s
$ rm gecko
```

### Using a `Makefile`

It would be nice not to have to worry about compiling the test binary, running the test command, then deleting the compiled test binary. A `Makefile` can help us here!

<span class="filename">Makefile</span>
```make
TARGET=gecko
all: clean build test

build:
    go build -o $(TARGET)
test:
    go test
clean:
    $(RM) $(TARGET)
```

Now, to test and compile `gecko` we can just run the command `make`.

## What about subpaths?

Oftentimes Go CLI projects are structured with a directory of commands. CLI libraries, such as [cobra](https://github.com/spf13/cobra), will look through this directory to find subcommands.

A typical CLI project layout will look something like this:

```bash
$ tree
.
├── Gopkg.lock
├── Gopkg.toml
├── LICENSE
├── cmd
│   ├── cmd.go
│   └── cmd_test.go
└── main.go

1 directory, 6 files
```

Because we won't be compiling `main.go` in the same directory as the `cmd/test_*` files, we will need to make it available via `PATH`:

<span class="filename">Makefile</span>
```make
TARGET=main
BUILDPATH=.bin
all: clean build test

build:
    mkdir -p $(BUILDPATH)
    go build -o $(BUILDPATH)/$(TARGET)
test:
    PATH=$(BUILDPATH):$PATH go test cmd
clean:
    $(RM) $(BUILDPATH)/$(TARGET)
```

Now our test file can call the CLI application directly with `exec.Command("main", "cmd")` and not have to worry about its location.
