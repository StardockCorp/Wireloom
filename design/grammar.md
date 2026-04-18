# Wireloom Grammar (v0.1 — Thin Slice)

This document defines the formal grammar for Wireloom's thin-slice token set. It is the contract between the parser and the renderer. Any source file that conforms to this grammar must parse without error; any source file that doesn't must produce a parse error with a human-readable message and a line number.

## Thin-Slice Primitives

The thin slice covers ten primitives, enough to express basic windows, forms, and toolbar/footer layouts:

| Primitive  | Children? | Purpose |
|------------|-----------|---------|
| `window`   | Yes       | Top-level container (the root of any wireframe). |
| `header`   | Yes       | Top chrome region inside a `window`. |
| `footer`   | Yes       | Bottom chrome region inside a `window`. |
| `panel`    | Yes       | Bordered content container. |
| `row`      | Yes       | Horizontal flow container. |
| `col`      | Yes       | Vertical flow container. |
| `text`     | No        | Static text. First positional arg is the text content. |
| `button`   | No        | Clickable action. First positional arg is the label. |
| `input`    | No        | Text input placeholder. Has no positional args; uses `placeholder=` attribute. |
| `divider`  | No        | Horizontal rule separator. |

Every Wireloom source file must have exactly one root node, and it must be a `window`.

## Lexical Structure

### Line-oriented source

Wireloom source is processed line by line. Each non-blank, non-comment line is either a node declaration or a continuation of a node's children block.

### Indentation

- Indentation is **significant**.
- Exactly **two spaces** per level. No other amount is valid.
- **Tabs are forbidden** in leading whitespace. A tab in indentation produces a parse error.
- Blank lines and comment-only lines do not affect indentation level.
- The first node in a file must have zero indentation.
- Children of a node are indented exactly one level (two spaces) deeper than their parent.

### Comments

- Line comments begin with `#` and extend to the end of the line.
- Comments may appear on their own line or at the end of a node line.
- Comment-only lines are treated as blank lines for indentation purposes.

### Blank lines

Blank lines (containing only whitespace) are ignored for all parsing purposes.

### String literals

- Enclosed in **double quotes** (`"`).
- Support the escape sequences: `\"` (literal double quote), `\\` (backslash), `\n` (newline in rendered text).
- Unterminated strings (missing closing `"` before end of line) produce a parse error.
- Single-quoted strings are **not** supported in v0.1.
- Multi-line strings are **not** supported in v0.1.

### Number literals

- Integer numbers (e.g., `340`, `16`, `0`) are supported.
- Optional unit suffixes: `px`, `%`, `fr` (e.g., `340px`, `50%`, `1fr`). Bare integers are treated as pixels.
- Negative numbers are not supported in v0.1.
- Decimal numbers are not supported in v0.1.

### Identifiers

- Match the pattern `[a-zA-Z_][a-zA-Z0-9_-]*`.
- Used for primitive names, attribute keys, bare-flag attributes, and identifier-valued attributes.

## Node Syntax

Every node declaration has the form:

```
<primitive> [positional...] [attribute...] [:]
```

- `primitive` — one of the ten primitive identifiers in the table above.
- `positional` — zero or more string or number literals. Their meaning depends on the primitive (e.g., `text "Hello"`, `button "Save"`, `col 340`, `window "Sign in"`).
- `attribute` — zero or more `key=value` pairs or bare-flag identifiers. Attributes follow positionals.
- `:` — optional terminator. If present, the node has children indented one level deeper. If absent, the node is a leaf.

### Positional argument rules

| Primitive | Positional args |
|-----------|-----------------|
| `window`  | Optional: one string (the title). |
| `text`    | Required: one string (the text content). |
| `button`  | Required: one string (the label). |
| `col`     | Optional: one number (the column width). |
| `row`     | None. |
| `header`, `footer`, `panel`, `input`, `divider` | None. |

### Attribute syntax

Two forms:

- **Key=value**: `placeholder="Email"`, `width=340`, `type=password`.
- **Bare flag**: `primary`, `disabled`, `active`.

Values after `=` can be a string literal, a number literal, or an identifier (unquoted single word).

### Recognized attributes (v0.1)

| Attribute     | Applies to     | Values |
|---------------|----------------|--------|
| `placeholder` | `input`        | String |
| `type`        | `input`        | Identifier (e.g., `text`, `password`, `email`) |
| `primary`     | `button`       | Bare flag |
| `disabled`    | `button`, `input` | Bare flag |

Unknown attributes produce a parse error in v0.1. (v0.2 will be permissive for forward compatibility.)

## Formal EBNF

```ebnf
document       ::= (blank | comment_line | node)*

node           ::= indent primitive positional_args? attributes? terminator
                   children?

primitive      ::= "window" | "header" | "footer" | "panel"
                 | "row" | "col"
                 | "text" | "button" | "input" | "divider"

positional_args ::= positional_arg (WS positional_arg)*
positional_arg ::= STRING | NUMBER

attributes     ::= WS attribute (WS attribute)*
attribute      ::= IDENT "=" value
                 | IDENT
value          ::= STRING | NUMBER | IDENT

terminator     ::= ":" line_end
                 | line_end

children       ::= INDENT (blank | comment_line | node)+ DEDENT

comment_line   ::= indent? "#" (any char except newline)* line_end
line_end       ::= inline_comment? NEWLINE
inline_comment ::= WS+ "#" (any char except newline)*
blank          ::= WS* NEWLINE

STRING         ::= '"' (ESCAPE | [^"\\\n])* '"'
ESCAPE         ::= "\\" ( '"' | '\\' | 'n' )
NUMBER         ::= DIGIT+ UNIT?
UNIT           ::= "px" | "%" | "fr"
IDENT          ::= [a-zA-Z_] [a-zA-Z0-9_-]*
DIGIT          ::= [0-9]

WS             ::= (" ")+
NEWLINE        ::= "\r"? "\n"
indent         ::= ("  ")*     (* Exactly 2 spaces per level *)
INDENT         ::= <synthetic, emitted when leading spaces increase by 2>
DEDENT         ::= <synthetic, emitted when leading spaces decrease>
```

## Error Cases and Expected Messages

The parser must produce human-readable errors with line and column information for each of these cases:

| Input problem | Expected error message |
|---------------|------------------------|
| Tab in leading whitespace | `Line {n}: tab in indentation (use 2 spaces, not tabs)` |
| Odd number of leading spaces (not a multiple of 2) | `Line {n}: indentation of {k} spaces is not a multiple of 2` |
| Unknown primitive | `Line {n}: unknown primitive "{name}" (valid: window, header, footer, panel, row, col, text, button, input, divider)` |
| Missing required positional | `Line {n}: "{primitive}" requires a {expected} argument` |
| Unterminated string | `Line {n}, col {c}: unterminated string literal` |
| Unknown attribute | `Line {n}: unknown attribute "{key}" on "{primitive}"` |
| Children under a leaf-only primitive | `Line {n}: "{primitive}" cannot have children` |
| Multiple root nodes | `Line {n}: only one root "window" node is allowed` |
| Root is not a window | `Line {n}: root node must be "window"` |
| Inconsistent child indentation | `Line {n}: indentation mismatch with sibling at line {m}` |
| Colon on a leaf line with no children following | `Line {n}: "{primitive}" ends with ":" but has no children` |

## Design Rationale

- **Indentation over braces.** Wireframes nest deeply; braces at four levels look like soup. Indentation is readable and matches how people already write the DSL by hand.
- **Two spaces, not flexible.** YAML's indentation flexibility is the source of most YAML bugs. Pick a number, enforce it.
- **Tabs are errors.** Tabs in indentation are the classic invisible-bug generator. We fail fast and loudly.
- **No inline children syntax.** `row: a b c` saves typing but makes error messages terrible. Worth the verbosity.
- **`window` as required root.** Every wireframe depicts something, and that something has outer bounds. Forcing `window` makes the grammar and renderer simpler.
- **Known attributes only.** v0.1 fails on unknown attributes so users get fast feedback on typos. v0.2 will relax this for forward compatibility.
