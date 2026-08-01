# Theta Programming Language — Visual Studio Code Extension

Syntax highlighting for the **Theta** programming language (`.th` files).

Theta is a programming language for real-time data analysis, featuring columnar and graph databases as first-class types.

## Features

This extension provides syntax highlighting for:

- **Comments** — `//` line comments and `/* */` block comments
- **Keywords** — `if`, `elif`, `else`, `return`, `while`, `fn`, `async`, `in`, `within`
- **Types** — `bool`, `byte`, `integer`, `long`, `double`, `character`, `u-character` `symbol`, `enumeration`, `date`, `timestamp`, `string`, etc.
- **Literals**
  - Boolean: `1b`, `0b`
  - Hex byte: `0x00`, `0xff`
  - Integer: `42i`, `-3i`
  - Long: `-2000`, `2000`
  - Double: `3.14`, `-0.25`
  - Character: `'t'`
  - U-character: `U'鷲'`
  - Symbol: `` `theta ``, `` `name ``
  - Date: `2026.04.01`
  - Timestamp: `2026.01.01_12:00:00.123456789`
  - Special: `::` (none), `__NaN__`, `inf(i)`, `inf(f)`, `inf(d)`, `inf(t)`
  - Bool list: `011b`
  - Byte list: `0x0aff14`
  - String: `"hello"`
  - U-string: `U"日本語"`
- **Operators** — `+`, `-`, `*`, `%`, `=`, `==`, `!=`, `!==`, `<`, `<=`, `>`, `>=`, `#`, `,`, `&&`, `||`, `&?`, `in`, `within`, etc. expansion adapters `/`, `\`, `|`
- **Assignment** — `<-` (define), `<<=` (overwrite), `<~` (cast/attribute)
- **Enumerations** — `enum signal <- \`green\`yellow\`red` and access `signal::\`green`
- **Column references** — `$name`, `$age` in query expressions
- **List attributes** — `u~`, `a~`, `d~`, `p~`
- **Built-in functions** — `select`, `update`, `delete`, `insert`, `table`, `graph`, `map`, `count`, `range`, `save`, `load`, `import`, `sleep`, `await`, and more
- **Function calls** — any `identifier[...]` call

## Usage

Files with the `.th` extension are automatically recognized as Theta source files.

## Example

```theta
// Define enum
@)enum sex <- `M`F

// Create a table
@)members <- table[`name`age`sex; {`John`Jacob`Mary; 18 25 60; sex::`M`M`F}]

// Query with conditions
@)select[members; `name`age; {{<; $age; 30}; {=; $sex; sex::`M}}]

// Async function
@)nonsleeper <- async fn (x) {
  sleep[x];
  return 42;
};
```

## Links

- [Theta Programming Language Website](https://theta-lang.com)
- [Tutorial](https://theta-lang.com/tutorials/)
