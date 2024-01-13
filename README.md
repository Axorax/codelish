<h1 align="center"><code>codelish</code></h1>

<p align="center">Use English as a Programming Language</p>

### 📺 Watch the video on YouTube - https://youtu.be/70oPUlYoFAA

## ⚙️ Installation

### ● Executable file (.exe)

Go to the releases page and download the executable file.

Releases Page - https://github.com/Axorax/codelish/releases/

### ● With nodejs

1. Clone this repository onto your PC.
2. Done! Now, you can run `node codelish.js code.ch` and it will work.

## 🔗 Language Documentation

### ● Tag - language

```
<language="python">
```

Specify what language you want your code to get generated in. You can also use:

```
<lang="python">
```

### ● Tag - output

```
<output="main.py">
```

Specify the file name for the generated code. If not specified, then it will generate a file name automatically in the format `codelish-<CurrentTime>`

### ● Tag - oneshot

```
<oneshot="true">
```

If oneshot is set to true, then it will send only one request to the API with all of the text stitched together. If set to false, then it sends a request to the API for every run tag.

### ● Tag - external

```
<external="another_file.ch">
```

Mention another file to get executed alongside the main file.

### ● Tag - var

```
<var>
Hello, world!
</var>
```

Declare a variable. Optionally, provide a name and type for the variable.

```
<var="greeting" type="string">
Hello world!
</var>
```

### ● Tag - run

```
<run>
print hello world to the console
</run>
```

Describe what your code should do.

## ⬇️ Examples

### ● Fetch!

```
<lang="javascript">
<output="fetch.js">
<oneshot="true">

<run>
send a fetch request to the jsonplaceholder API and get the todolist item with an id of 1 and log it to the console.
</run>

<run>
print the value of pi upto 10 digits after the decimal to the console.
</run>
```

### ● Greet! 👋

```
<lang="python">

<var="greeting" type="string">
Hello, world!
</var>

<run>
print the variable greeting to the console.
</run>
```

---

[Support me on Patreon](https://www.patreon.com/axorax) —
[Check out my socials](https://github.com/axorax/socials)
