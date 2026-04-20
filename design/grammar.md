# Wireloom Grammar (v0.2 — Full v1 Primitive Set)

This document defines the formal grammar for Wireloom v0.2. It is the contract between the parser and the renderer. Any source file that conforms to this grammar must parse without error; any source file that doesn't must produce a parse error with a human-readable message and a line number.

v0.2 is a superset of v0.1 — every v0.1 source continues to parse. Behaviorally, one default changes (bare `col` now fills instead of hugging content); this is explicitly called out in [Column Width Semantics](#column-width-semantics).

## Primitives

Twenty primitives total in v0.2. Grouped for readability.

### Structural containers

| Primitive   | Children?     | Purpose |
|-------------|---------------|---------|
| `window`    | Yes           | Top-level container (the root of any wireframe). Exactly one per source. |
| `header`    | Yes           | Top chrome region inside a `window`. |
| `footer`    | Yes           | Bottom chrome region inside a `window`. |
| `panel`     | Yes           | Bordered content container. |
| `section`   | Yes           | Labeled container with a quiet caps-style title band. Supports optional `badge="…"`. |
| `tabs`      | Yes (tab-only)| Tab-bar container. Only accepts `tab` children. |
| `row`       | Yes           | Horizontal flow container. |
| `col`       | Yes           | Vertical flow container. Width is pixel-explicit, `fill`, or defaults to `fill`. |
| `list`      | Yes (item/slot only) | Vertical list container. |
| `slot`      | Yes           | Titled multi-field row, used inside `list` or as a standalone card. |

### Leaves (no children)

| Primitive   | Purpose |
|-------------|---------|
| `tab`       | A tab in a `tabs` bar. Required string label. Optional `active` flag, `badge="…"`. |
| `item`      | A simple bulleted item in a `list`. Required string text. |
| `text`      | Static text. Required string content. Typography flags / attrs supported. |
| `button`    | Clickable action. Required string label. Optional `primary`, `disabled`, `badge="…"`. |
| `input`     | Text input placeholder. Optional `placeholder=`, `type=`, `disabled`. |
| `combo`     | Dropdown placeholder. Optional string label positional, optional `value=`, `options=`, `disabled`. |
| `slider`    | Horizontal range control. Required `range=N-M`, `value=K`. Optional `label=`. |
| `kv`        | Label/value row. Two required string positionals (label, value). Value typography flags supported. |
| `image`     | Image placeholder. Optional `label=`, `width=`, `height=`. |
| `icon`      | Icon glyph placeholder. Optional `name=`. |
| `divider`   | Horizontal rule. |

### Document-level siblings

| Primitive    | Purpose |
|--------------|---------|
| `annotation` | User-manual-style label with a leader line pointing at an `id`'d element in the `window`. Lives *outside* the window tree; see [Annotations](#annotations). |

Every Wireloom source file must have exactly one `window` root. One or more `annotation` nodes may follow the `window` as siblings (see [Annotations](#annotations)).

## Structural Rules

- **`window`** is the only primitive that can begin a document. It must not be nested, and there must be exactly one.
- **`annotation`** may only appear at the top level, after the `window` node. Annotations are *not* children of `window`; they are siblings that reference into the window via `target="<id>"`.
- **`header`** / **`footer`** may only appear as direct children of `window`.
- **`tabs`** may appear anywhere a container child is legal; its children must be only `tab` nodes.
- **`tab`** may only appear inside a `tabs` container.
- **`list`** may appear anywhere a container child is legal; its children must be only `item` or `slot` nodes.
- **`item`** may only appear inside a `list`.
- All other containers (`panel`, `section`, `row`, `col`, `slot`) accept the full container-child set: other containers (except `header`/`footer`/`window`/`tab`/`item`) plus leaves.

## Universal Attributes

The following attributes are accepted on *every* primitive, in addition to the primitive-specific attributes defined in [Node Syntax](#node-syntax):

| Attribute | Value   | Purpose |
|-----------|---------|---------|
| `id`      | string  | Author-supplied identifier. Used as the `target=` of an `annotation` node. Ids are not validated for uniqueness; if duplicates exist, layout uses the first match. |

## Annotations

`annotation` nodes are user-manual-style labels drawn in the canvas margin with a leader line pointing at an element in the `window`. They let a single Wireloom source produce a fully annotated mockup — mockup + call-outs in one artifact.

### Syntax

```
annotation "<body text>" target="<id>" position=<left|right|top|bottom>
```

- **body** (required positional string): label text. Literal `\n` in the string becomes a line break in the rendered box.
- **`target`** (required): the `id` of an element inside `window`. If no element has a matching id, the annotation is silently dropped during layout.
- **`position`** (required): which margin side the annotation box sits in. There is **no default** — authors must place annotations deliberately. Accepted values: `left`, `right`, `top`, `bottom`.

### Placement

For a given side, annotations are stacked along the window edge. Each box is nudged to align its center with the target element's center, then bumped along the axis just enough to avoid overlapping the previous box on the same side. If the resulting stack would overflow the canvas, the whole group is shifted inward.

### Example

```
window "Sign in":
  header:
    text "Welcome back" id="welcome"
  panel:
    input placeholder="Email" type=email id="email-field"
    button "Sign in" primary id="signin-btn"

annotation "Greeting — personalized after first sign-in" target="welcome" position=top
annotation "Email must be verified" target="email-field" position=right
annotation "Primary action.\nDisabled until form is valid." target="signin-btn" position=right
```

## Lexical Structure

### Line-oriented source

Wireloom source is processed line by line. Each non-blank, non-comment line is either a node declaration or a continuation of a node's children block.

### Indentation

- Indentation is **significant**.
- Each file uses **either 2 or 4 spaces** per level. The unit is detected from the first indented line and locked for the rest of the file. Mixing units within one file produces a parse error.
- **Tabs are forbidden** in leading whitespace. A tab in indentation produces a parse error.
- Blank lines and comment-only lines do not affect indentation level.
- The first node in a file must have zero indentation.
- Children of a node are indented exactly one level (one unit) deeper than their parent.

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
- Single-quoted strings are **not** supported in v0.2.
- Multi-line strings are **not** supported in v0.2.

### Number literals

- Integer numbers (e.g., `340`, `16`, `0`).
- Optional unit suffixes: `px`, `%`, `fr` (e.g., `340px`, `50%`, `1fr`). Bare integers are treated as pixels.
- Negative numbers are not supported in v0.2.
- Decimal numbers are not supported in v0.2.

### Range literals (new in v0.2)

- Form: `N-M` where both are bare non-negative integers and M > N.
- Used exclusively as a value for the `range=` attribute on `slider`.
- Example: `range=0-100`.

### Identifiers

- Match the pattern `[a-zA-Z_][a-zA-Z0-9_-]*`.
- Used for primitive names, attribute keys, bare-flag attributes, and identifier-valued attributes.

## Node Syntax

Every node declaration has the form:

```
<primitive> [positional...] [attribute...] [:]
```

- `primitive` — one of the primitive identifiers in the tables above.
- `positional` — zero or more string, number, or range literals. Meaning depends on the primitive.
- `attribute` — zero or more `key=value` pairs or bare-flag identifiers. Must follow positionals.
- `:` — optional terminator. If present, the node has children indented one level deeper. Required for container primitives that must have children.

### Positional argument rules (v0.2)

| Primitive | Positional args |
|-----------|-----------------|
| `window`  | Optional: one string (the title). |
| `section` | Required: one string (the title). |
| `slot`    | Required: one string (the title). |
| `tab`     | Required: one string (the label). |
| `item`    | Required: one string (the text). |
| `text`    | Required: one string (the text content). |
| `button`  | Required: one string (the label). |
| `kv`      | Required: two strings (label, value). |
| `col`     | Optional: one number (fixed pixel width) OR the bare identifier `fill`. Missing = `fill`. |
| `combo`   | Optional: one string (the label). |
| `slider`  | None (use `label=` attribute). |
| `image`, `icon` | None (use `label=` / `name=` attributes). |
| `row`, `tabs`, `list`, `header`, `footer`, `panel`, `input`, `divider` | None. |

### Attribute syntax

Two forms:

- **Key=value**: `placeholder="Email"`, `width=340`, `type=password`, `range=0-100`, `badge="3 new"`.
- **Bare flag**: `primary`, `disabled`, `active`, `bold`, `italic`, `muted`.

Values after `=` can be a string literal, a number literal, a range literal, or an identifier (unquoted single word).

### Recognized attributes (v0.2)

| Attribute     | Applies to                      | Value kind / flag | Notes |
|---------------|---------------------------------|-------------------|-------|
| `placeholder` | `input`                         | String            | Greyed placeholder text. |
| `type`        | `input`                         | Identifier: `text`, `password`, `email` | Purely cosmetic in the render. |
| `value`       | `combo`                         | String            | Current selected value shown. |
| `options`     | `combo`                         | String (comma-separated) | For documentation; doesn't change the render in v0.2. |
| `range`       | `slider`                        | Range: `N-M`      | Required on `slider`. |
| `value`       | `slider`                        | Number            | Required on `slider`. Thumb position computed as `(value − min) / (max − min)`. |
| `label`       | `slider`, `image`               | String            | Optional label text. |
| `width`       | `image`                         | Number (px)       | Overrides default placeholder width. |
| `height`      | `image`                         | Number (px)       | Overrides default placeholder height. |
| `name`        | `icon`                          | String            | Icon name (for the sketch label, not an icon font lookup). |
| `badge`       | `tab`, `section`, `button`      | String            | Small counter/status pill rendered next to label. |
| `align`       | `row`                           | Identifier: `left`, `center`, `right` | Children alignment along the main axis. Default `left`. |
| `weight`      | `text`, `kv` (applies to value) | Identifier: `light`, `regular`, `semibold`, `bold` | Default `regular`. |
| `size`        | `text`, `kv` (applies to value) | Identifier: `small`, `regular`, `large` | Default `regular`. |
| `primary`     | `button`                        | Flag              | Emphasizes the action. |
| `disabled`    | `button`, `input`, `combo`, `slider` | Flag         | Renders reduced-contrast. |
| `active`      | `tab`, `slot`                   | Flag              | Marks the currently-selected tab or slot. |
| `bold`        | `text`, `kv`                    | Flag              | Shorthand for `weight=bold`. |
| `italic`      | `text`, `kv`                    | Flag              | Italic text style. |
| `muted`       | `text`, `kv`                    | Flag              | Renders with the muted text color. |
| `fill`        | `col` (positional-style)        | Identifier        | Forces fill sizing. Bare `col` also defaults to fill. |

Unknown attributes (or flags used on primitives that don't accept them) produce parse errors.

## Column Width Semantics

`col` in v0.2 has three possible widths:

1. **Explicit pixel**: `col 340:` — fixed 340-pixel-wide column.
2. **Explicit fill**: `col fill:` — takes a share of any remaining horizontal space in the enclosing row.
3. **Default (bare)**: `col:` — treated as `fill` in v0.2.

**Behavior change from v0.1:** v0.1 bare `col` hugged content (intrinsic sizing). v0.2 bare `col` fills. This was deliberate — the most common case is "layout wants this column to take the rest of the row," which was awkward to express in v0.1. If the v0.1 intrinsic behavior is what you want, specify every column's width explicitly.

**Fill distribution** within a row:
- Let `available = row_width − sum(fixed col widths) − sum(inter-col gaps)`.
- `fill` columns each receive `available / count(fill cols)` pixels.
- If there are no `fill` cols and the explicit widths underflow the available width, extra space falls to the right of the last column (not distributed).

## Row Alignment

`row align=right:` positions children flush to the right edge of the row, with remaining space to the left. `align=center` centers them as a block. Default `align=left` packs them from the left.

Alignment applies to the row's inner box (after row padding).

## Typography

`text` and `kv` support four styling mechanisms:

- **Bare flags**: `bold` (≡ `weight=bold`), `italic`, `muted`.
- **Explicit `weight`**: `light` (300), `regular` (400, default), `semibold` (600), `bold` (700).
- **Explicit `size`**: `small` (~12px), `regular` (~14px, default), `large` (~18px).
- Flags and explicit attributes can be combined: `text "Heading" bold size=large`.

On `kv`, typography attributes apply to the **value** portion of the row. Labels use the theme's default body text.

## Formal EBNF

```ebnf
document       ::= (blank | comment_line | node)*

node           ::= indent primitive positional_args? attributes? terminator
                   children?

primitive      ::= "window" | "header" | "footer" | "panel"
                 | "section" | "tabs" | "tab"
                 | "row" | "col"
                 | "list" | "item" | "slot"
                 | "text" | "button" | "input"
                 | "combo" | "slider"
                 | "kv" | "image" | "icon" | "divider"

positional_args ::= positional_arg (WS positional_arg)*
positional_arg ::= STRING
                 | NUMBER
                 | "fill"                 (* only valid on col *)

attributes     ::= WS attribute (WS attribute)*
attribute      ::= IDENT "=" value
                 | IDENT                  (* bare flag *)
value          ::= STRING | NUMBER | RANGE | IDENT

RANGE          ::= DIGIT+ "-" DIGIT+

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

The parser produces human-readable errors with line and column information:

| Input problem | Expected error message |
|---------------|------------------------|
| Tab in leading whitespace | `Line {n}, col 1: tab in indentation (use 2 or 4 spaces, not tabs)` |
| First indented line uses neither 2 nor 4 spaces | `Line {n}, col 1: first indented line uses {k} spaces; Wireloom accepts 2 or 4 spaces per level (pick one and use it consistently)` |
| Indentation inconsistent with the detected unit | `Line {n}, col 1: indentation of {k} spaces is not a multiple of {u} (this file uses {u}-space indentation)` |
| Unknown primitive (with optional suggestion) | `Line {n}, col {c}: unknown primitive "{name}" (valid: …). Did you mean "{closest}"?` |
| Unknown attribute or flag with close typo | `Line {n}, col {c}: unknown attribute "{key}" on "{primitive}". Did you mean "{closest}"?` |
| Invalid enum value with close typo | `Line {n}, col {c}: "{value}" is not a valid {attr} on "{primitive}" (expected one of: …). Did you mean "{closest}"?` |
| `kv` given a single string with embedded `=` or `:` | `Line {n}, col {c}: "kv" needs two separate strings (label, value). Got only "{combined}" — if you meant to split on "{sep}", try: kv "{left}" "{right}"` |
| Missing required positional | `Line {n}, col {c}: "{primitive}" requires {expected}` |
| Unterminated string | `Line {n}, col {c}: unterminated string literal` |
| Unknown attribute on primitive | `Line {n}, col {c}: unknown attribute "{key}" on "{primitive}"` |
| Unknown bare flag on primitive | `Line {n}, col {c}: unknown flag "{flag}" on "{primitive}"` |
| Invalid enumerated value | `Line {n}, col {c}: "{value}" is not a valid {attr} (expected one of: {allowed})` |
| Invalid range format | `Line {n}, col {c}: range must be N-M with M > N, got "{got}"` |
| `tab` outside `tabs` | `Line {n}, col {c}: "tab" may only appear inside "tabs"` |
| `item` outside `list` | `Line {n}, col {c}: "item" may only appear inside "list"` |
| `tabs` contains non-tab child | `Line {n}, col {c}: "tabs" accepts only "tab" children` |
| `list` contains non-item/slot child | `Line {n}, col {c}: "list" accepts only "item" or "slot" children` |
| Children under a leaf-only primitive | `Line {n}, col {c}: "{primitive}" cannot have children` |
| Multiple root nodes | `Line {n}, col {c}: only one root "window" node is allowed` |
| Root is not a window | `Line {n}, col {c}: root node must be "window"` |
| Colon on a leaf line with no children following | `Line {n}, col {c}: "{primitive}" ends with ":" but has no children` |

## Design Rationale

- **Indentation over braces.** Wireframes nest deeply; braces at four levels look like soup. Indentation is readable and matches how people already write the DSL by hand.
- **Two or four spaces, consistent per-file.** Two spaces was the v0.2 hard rule; v0.3 relaxes it to accept 4-space indentation (common in code-heavy projects) while still enforcing consistency within a single file. YAML's full flexibility (any indent, mix at will) is still rejected — pick one of 2 or 4 and the file locks.
- **Tabs are errors.** Tabs in indentation are the classic invisible-bug generator. We fail fast and loudly.
- **No inline children syntax.** `row: a b c` saves typing but makes error messages terrible. Worth the verbosity.
- **`window` as required root.** Every wireframe depicts something, and that something has outer bounds.
- **`col fill` as the default.** The 80% case is "this column takes the remaining space." v0.2 makes that the default so simple layouts read naturally.
- **`kv` as first-class.** Data-heavy UIs (settings, ledgers, dashboards) are dominated by label/right-aligned-value rows. Giving them a dedicated primitive with correct alignment baked in is much cleaner than composing `row` + two `text`s with manual alignment.
- **Tabs / list / slot as constrained containers.** Limiting what they can contain (only `tab`, only `item`/`slot`) means the renderer can make strong layout assumptions and users get fast errors when they put the wrong thing in.
- **Typography as attributes, not primitives.** `text "Heading" bold` stays DSL-idiomatic instead of introducing a `heading` primitive with its own schema. Keeps the grammar small.
- **Known attributes only.** v0.2 still fails on unknown attributes so users get fast feedback on typos. A permissive mode may ship in v0.3 for forward compatibility with future primitives.
