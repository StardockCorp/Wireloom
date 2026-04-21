# Wireloom for AI Agents

> **You are reading this because you need to render a UI wireframe mockup.**
> Wireloom is a small text DSL for sketching user-interface layouts as inline SVG. This file is written for LLM agents (Claude, Codex, Cursor, etc.) that need to author wireframes — copy or link it into your agent's context when working on UI design tasks.

## What is Wireloom?

Wireloom is a small indentation-based text language for UI wireframe mockups. You write a layout as indented plain text inside a ```wireloom fenced code block, and the Wireloom renderer turns it into an SVG wireframe. Output is monochrome, sketch-style — it reads as a mockup, not a finished UI.

Because Wireloom outputs plain SVG, the same block renders in **GitHub, Obsidian, Notion, static site generators, or any Markdown tool that handles SVG**. The read side needs no per-host plugin — only the authoring side needs the renderer (via `npm install wireloom` or a tool that bundles it).

## When to Use Wireloom

Use Wireloom when the user asks for:

- "Mock up a screen / dialog / settings page / sign-in form…"
- "Draw a wireframe for…"
- "Sketch the layout of the new UI"
- "Show me how this feature would look"
- "Diagram the toolbar / inspector / split view"
- Any request about the **shape of a user interface** that isn't already a running app

## When NOT to Use Wireloom

| If the user wants… | Use instead |
|--------------------|-------------|
| Flowchart, sequence, class, ER, or state diagram | `mermaid` fenced block |
| Interactive prototype you can click through | A real component in their frontend framework (React, Svelte, Vue…) |
| Architecture / concept / dependency map with freeform nodes | A whiteboard/canvas tool or Mermaid graph |
| A real, working form or tool | Actual code in the target framework |

Wireloom is strictly for **static structural mockups**. If the ask is "can you make this tool / dashboard / page actually work?", write the real component instead.

## Minimum Viable Wireframe

```
window:
  text "Hello, Wireloom"
```

Rendered: a bordered window containing the text.

## Primitives (v0.4 / v0.4.1 / v0.4.5 / v0.50)

Every source must start with a single `window` root. In v0.4.1, one or more `annotation` nodes may follow the `window` as siblings to add user-manual-style callouts (see [Annotations (Callouts)](#annotations-callouts--v041)). v0.4.5 adds form controls (checkbox/radio/toggle), file trees, menubars, breadcrumbs, chips, avatars, and inline status indicators — see [v0.4.5 Primitives](#v045-primitives). v0.50 adds the mobile-navigation primitive set (`spacer`, `navbar`, `tabbar`, `tabitem`, `backbutton`, `sheet`, `segmented`, `segment`) plus `row justify=`, `header large`, and the `chevron` flag on `slot`/`item`: see [v0.50 Primitives](#v050-primitives).

### Structural containers

| Primitive   | Children?                   | Positional args            | Purpose |
|-------------|-----------------------------|----------------------------|---------|
| `window`    | Yes                         | optional title string      | Root container. Exactly one per source. |
| `header`    | Yes                         | —                          | Top chrome band (title-level content). |
| `footer`    | Yes                         | —                          | Bottom chrome band (actions), or optional last child of a `slot`. |
| `panel`     | Yes                         | —                          | Bordered dashed content container. |
| `section`   | Yes                         | required title string      | Labeled container with small-caps title band. Supports `badge="…"`, `accent=`. |
| `tabs`      | Yes (`tab` children only)   | —                          | Tab-bar container. |
| `row`       | Yes                         | —                          | Horizontal flow. Supports `align=left|center|right`. |
| `col`       | Yes                         | optional pixel width or `fill` | Vertical flow. Default is `fill` when no width given. |
| `list`      | Yes (`item`/`slot` only)    | —                          | Vertical list container. |
| `slot`      | Yes                         | required title string      | Titled bordered card. Supports `active` flag, `state=`, `accent=`, optional trailing `footer:` child. |
| `grid`      | Yes (`cell` children only)  | —                          | Fixed `cols=N rows=M` grid. Cells auto-flow or take explicit `row=`/`col=`. **v0.4** |
| `resourcebar` | Yes (`resource` children only) | —                      | Horizontal resource strip for game-UI headers. **v0.4** |
| `stats`     | Yes (`stat` children only)  | —                          | Terse inline stat strip (LABEL value). **v0.4** |
| `navbar`    | Yes (`leading:`/`trailing:` only) | —                    | Top chrome band with `leading:` and `trailing:` slots on one line. Direct child of `window` only, mutually exclusive with `header`. **v0.50** |
| `tabbar`    | Yes (`tabitem` children only) | —                        | Bottom chrome band for primary mobile navigation. Direct child of `window` only, mutually exclusive with `footer`. **v0.50** |
| `sheet`     | Yes                         | —                          | Modal overlay (bottom sheet by default, centered modal with `position=center`). Direct child of `window` only, at most one per window. Supports `position=bottom\|center`, `title="…"`. **v0.50** |
| `segmented` | Yes (`segment` children only) | —                        | Rounded-pill segmented control for mutually-exclusive content filters. Inline content, never a direct child of `window`. **v0.50** |

### Leaves (no children)

| Primitive   | Positional args            | Purpose |
|-------------|----------------------------|---------|
| `tab`       | required string label      | Tab in a `tabs` bar. Supports `active` flag and `badge="…"`. |
| `item`      | required string text       | Bulleted list item. |
| `text`      | required string content    | Static text. Typography attrs. |
| `button`    | required string label      | Clickable action. `primary`, `disabled`, `badge="…"`, `accent=`. |
| `input`     | —                          | Text input. `placeholder=`, `type=`, `disabled`. |
| `combo`     | optional string label      | Dropdown. `value=`, `options=`, `disabled`. |
| `slider`    | —                          | Range control. Required `range=N-M` and `value=K`. Optional `label=`. |
| `kv`        | required label + value strings | Right-aligned label/value row. Typography attrs on value. |
| `image`     | —                          | Placeholder image. `label=`, `width=`, `height=`. |
| `icon`      | —                          | Icon glyph. `name=` (named library, see below), optional `accent=`. |
| `divider`   | —                          | Horizontal rule. |
| `cell`      | optional string label      | Grid cell (inside `grid`). Supports `row=`, `col=`, `state=`, `accent=`, and arbitrary container children. **v0.4** |
| `resource`  | —                          | Required `name=` + `value=`. Optional `icon=` override. **v0.4** |
| `stat`      | required label + value strings | Inline LABEL value pair (inside `stats`). Supports `bold`, `muted`. **v0.4** |
| `progress`  | —                          | Horizontal bar. `value=`, `max=`, optional `label=`, `accent=`. **v0.4** |
| `chart`     | —                          | Placeholder chart. `kind=bar|line|pie`, optional `label=`, `width=`, `height=`, `accent=`. Renders a stylized shape — no real data. **v0.4** |
| `spacer`    | —                          | Flex gap inside a `row`. Consumes slack so siblings anchor to opposite ends. Only legal directly inside `row`. **v0.50** |
| `tabitem`   | required string label      | Icon+label cell inside `tabbar`. Attributes: `icon="<name>"`, `badge="…"`. Flags: `selected`, `disabled`. **v0.50** |
| `backbutton`| required string label      | Chevron+label button (e.g., `‹ Notes`). Legal anywhere a `button` is. Flag: `disabled`. **v0.50** |
| `segment`   | required string label      | Cell inside `segmented`. Flags: `selected` (exactly one per `segmented`), `disabled`. **v0.50** |

## Attributes and Flags

Attributes come after positional args, before the optional `:` that opens a children block.

- **String values** use double quotes: `placeholder="Email"`
- **Number values** use optional unit suffixes: `340`, `50%`, `1fr`
- **Range values**: `range=0-100` (slider only)
- **Identifier values**: `type=password`, `weight=bold`, `align=right`
- **Bare flags**: `primary`, `disabled`, `active`, `bold`, `italic`, `muted`

### Typography on `text` and `kv` (v-value)

| Shorthand flag | Full form            |
|----------------|----------------------|
| `bold`         | `weight=bold`        |
| `italic`       | `font-style: italic` |
| `muted`        | renders with theme's muted text color |

Explicit options:
- `weight=light|regular|semibold|bold`
- `size=small|regular|large`

Combine freely: `text "Heading" bold size=large`, `kv "Net" "+235 bc" bold`.

### Layout and structural attributes

| Attribute | Applies to              | Values |
|-----------|-------------------------|--------|
| `badge="…"` | `tab`, `section`, `button` | Short pill text (e.g., `"4/7"`, `"3 new"`). |
| `align=…` | `row`                   | `left` (default), `center`, `right`. Ignored when any child is a fill col. |
| `active`  | `tab`, `slot`           | Bare flag. |
| `fill`    | `col` width positional  | Identifier. Distributes row slack. Bare `col:` also defaults to `fill`. |
| `state=…` | `slot`, `cell` (**v0.4**) | `locked`, `available`, `active`, `purchased`, `maxed`, `growing`, `ripe`, `withering`, `cashed`. Distinct border/fill/text; `locked`/`purchased`/`ripe`/`maxed` paint a corner glyph. |
| `accent=…` | `slot`, `section`, `cell`, `button`, `icon` (**v0.4**) | `research`, `military`, `industry`, `wealth`, `approval`, `warning`, `danger`, `success`. Themed color applied to borders/fills/text. |
| `cols=N rows=M` | `grid` (**v0.4**) | Required. Defines the grid shape. |
| `row=N col=M`   | `cell` (**v0.4**) | 1-indexed explicit placement. Otherwise cells auto-flow L→R, T→B. |
| `value=N max=M label="…"` | `progress` (**v0.4**) | `value`/`max` required for a filled bar; `label` optional. |
| `kind=…` | `chart` (**v0.4**) | `bar`, `line`, or `pie`. Renders a placeholder glyph — no real data. |
| `justify=…` | `row` (**v0.50**) | `start` (default), `between`, `around`, `end`. Distributes children along the horizontal axis. If a `spacer` child is present, `spacer` wins and `justify` is ignored. Fill cols still win over both. |
| `large` | `header` (**v0.50**) | Bare flag. Turns the header into a tall large-title band (forces its `text` child to render bold at large size). |
| `chevron` | `slot`, `item` (**v0.50**) | Bare flag. Reserves a trailing gutter and draws a right-chevron glyph. Used to signal "tap for detail" on list rows. |
| `position=…` | `sheet` (**v0.50**) | `bottom` (default, anchors to window bottom with rounded top corners) or `center` (floating centered rectangle). |
| `title="…"` | `sheet` (**v0.50**) | Optional title string. Renders bold and centered below the grabber. |
| `icon="…"`, `badge="…"` | `tabitem` (**v0.50**) | Named-library icon above the label, optional trailing badge pill on the icon. |

Unknown attributes or flags on the wrong primitive produce parse errors that list the expected options.

### Named icon library (v0.4)

`icon name="…"` renders real glyphs for this baked set; unknown names fall back to a boxed first letter:

```
credits   research      military   industry  influence
approval  faith         authority  computation  tech
policy    ship          planet     leader    gear
warning   lock          check      star      plus    minus
```

Accent-color an icon with `accent=` (e.g., `icon name="warning" accent=danger`).

## v0.4.5 Primitives

v0.4.5 adds widgets for things LLM authors kept simulating with `panel` + `kv` rows: file trees, menubars, form controls, chips, avatars, breadcrumbs, and inline status. No breaking changes — existing sources render identically.

### Form controls

Use these **instead of** faking controls with `text`/`panel`/`kv` rows.

| Primitive | Positional | Flags | Attributes |
|-----------|-----------|-------|-----------|
| `checkbox` | required label string | `checked`, `disabled`, `label-right` | — |
| `radio`    | required label string | `selected`, `disabled`, `label-right` | `group="<name>"` (visual grouping only) |
| `toggle`   | required label string | `on`, `off`, `disabled`, `label-right` | — |

`label-right` flips the control/label order so the label sits to the right of the control (the typical settings-page arrangement).

```wireloom
window "Settings":
  section "Appearance":
    radio "Light"  group="theme" label-right
    radio "Dark"   group="theme" selected label-right
    radio "System" group="theme" label-right

  section "Notifications":
    toggle "Enable desktop notifications" on
    toggle "Play sound on new message"    off
    toggle "Vibrate"                      off disabled

  section "Privacy":
    checkbox "Share anonymous usage data" label-right
    checkbox "Allow crash reports"        checked label-right
```

### `tree` / `node` — file trees and hierarchies

Recursive collapsible tree. Disclosure glyphs render automatically (▾ expanded, ▸ collapsed, none for leaves).

| Primitive | Positional | Flags | Attributes |
|-----------|-----------|-------|-----------|
| `tree` | — | — | — |
| `node` | required label string | `collapsed`, `selected` | `icon="<name>"` (named icon library) |

```wireloom
window "Files":
  tree:
    node "wireloom" icon="policy":
      node "src" selected:
        node "parser.ts"
        node "renderer" collapsed:
          node "svg.ts"
      node "README.md"
```

### `menubar` / `menu` / `menuitem` / `separator`

Horizontal menubar with dropdown children. `menu` may also appear standalone for a context/popup menu.

| Primitive | Positional | Flags | Attributes |
|-----------|-----------|-------|-----------|
| `menubar` | — (contains `menu` children) | — | — |
| `menu` | required title string | — | — |
| `menuitem` | required label string | `disabled` | `shortcut="Ctrl+O"` |
| `separator` | — | — | — |

⚠️ **`menuitem` is its own token** — don't write `item` inside a `menu` (that's reserved for `list` children).

```wireloom
window "Editor":
  menubar:
    menu "File":
      menuitem "New"  shortcut="Ctrl+N"
      menuitem "Open" shortcut="Ctrl+O"
      separator
      menuitem "Quit" shortcut="Ctrl+Q"
    menu "Edit":
      menuitem "Delete" disabled
```

### `breadcrumb` / `crumb`

Horizontal path with auto-inserted chevron (›) separators. The **last crumb renders bolder** as the current location.

| Primitive | Positional | Attributes |
|-----------|-----------|-----------|
| `breadcrumb` | — | — |
| `crumb` | required label string | `icon="<name>"` (optional, per crumb) |

```wireloom
window "Files":
  breadcrumb:
    crumb "This PC" icon="authority"
    crumb "Projects"
    crumb "wireloom"
    crumb "src"
```

### `chip` — filter pills, tag lists, selected items

Standalone pill. Distinct from the `badge=` attribute (which attaches to section headers / buttons).

| Primitive | Positional | Flags | Attributes |
|-----------|-----------|-------|-----------|
| `chip` | required label string | `closable` (renders × glyph), `selected` | `accent=`, `icon="<name>"` |

```wireloom
window "Filters":
  row:
    chip "Active" selected
    chip "Archived"
    chip "Shared" closable
    chip "Starred" icon="star" accent=warning
```

### `avatar`

Circle with initials — wireframe-fidelity only, no image slot by design.

| Primitive | Positional | Attributes |
|-----------|-----------|-----------|
| `avatar` | required initials string (max 2 chars rendered) | `size=small\|medium\|large` (default `medium`), `accent=` |

```wireloom
window "Team":
  row:
    avatar "BW" size=medium accent=research
    avatar "JD" size=medium accent=military
    avatar "AL"
```

### `spinner` / `status`

Static indicators (no animation — Wireloom is static SVG).

| Primitive | Positional | Attributes |
|-----------|-----------|-----------|
| `spinner` | optional label string | — (renders a dashed ring) |
| `status`  | required label string | `kind=success\|info\|warning\|error` (required) |

```wireloom
window "Status":
  row:
    status "Deployed" kind=success
    status "Backup running" kind=info
    status "Disk 82%" kind=warning
    status "Build failed" kind=error
  row:
    spinner "Syncing index…"
```

### v0.4.5 — Full settings dialog

```wireloom
window "Settings":
  tabs:
    tab "General" active
    tab "Appearance"
    tab "Advanced"

  section "Appearance":
    radio "Light"  group="theme" label-right
    radio "Dark"   group="theme" selected label-right
    radio "System" group="theme" label-right

  section "Notifications":
    toggle "Enable desktop notifications" on
    toggle "Play sound on new message"    off

  section "Privacy":
    checkbox "Share anonymous usage data" label-right
    checkbox "Allow crash reports"        checked label-right

  footer:
    button "Cancel"
    button "Apply" primary
```

## v0.50 Primitives

v0.50 is the mobile-navigation release. Authors who tried to mock up list/detail/edit flows on phones were stacking two rows for Cancel/Done headers, hand-rolling tab bars with `footer` + `row` + `button`, and faking modals with a second panel. v0.50 replaces all of that with real primitives. No breaking changes: existing sources render identically. When in doubt, reach for these primitives before inventing a layout.

### Row layout: `spacer` and `justify=`

Rows gain two complementary tools for distributing children along the main axis:

- **`spacer`**: a leaf primitive that fills remaining horizontal space inside a `row`. Use it explicitly where you want the gap (most common: between a `leading` cluster and a `trailing` cluster).
- **`row justify=start|between|around|end`**: distributes all children along the row. `start` (default) packs left, `between` pushes first and last to opposite ends with even gaps between, `around` gives each child equal surrounding space, `end` packs right.

Precedence when they combine: a `fill` col wins over everything, then `spacer` wins over `justify`, then `justify` wins over `align=`. Unknown `justify=` values produce a parse error listing the valid set.

```wireloom
window "Dialog":
  panel:
    row:
      button "Cancel"
      spacer
      button "Done" primary
    row justify=between:
      text "Step 2 of 4" muted
      text "Draft saved" muted
```

### `navbar` with `leading:` / `trailing:` slots

`navbar` is the top chrome band for mobile list/detail flows. Direct child of `window` only, and mutually exclusive with `header` (you pick one). Children must be `leading:` and/or `trailing:` sub-blocks (at least one required, each at most once). Each slot accepts row-legal children (`button`, `backbutton`, `text`, `icon`, `chip`, `image`, etc.).

| Primitive | Positional | Children | Attributes | Flags |
|-----------|-----------|----------|------------|-------|
| `navbar`  | —         | `leading:` and/or `trailing:` (at least one) | — | — |
| `leading` | —         | row-legal children | — | — |
| `trailing`| —         | row-legal children | — | — |

```wireloom
window "Note":
  navbar:
    leading:
      backbutton "Notes"
    trailing:
      button "Share"
      button "Done" primary
  panel:
    text "Body copy goes here."
```

### `header large:` for large-title bands

`header` gains a `large` bare flag. With `large`, the header renders as a tall band with a bold large-size title (the "Notes", "Mail", "Settings" style on iOS list roots). The title `text` child is forced bold and large regardless of typography attrs on it. An empty `header large:` is legal and renders an empty large-title band (useful for placeholders). `header` without `large` renders identically to v0.4.5.

```wireloom
window:
  header large:
    text "Q2 Review"
  panel:
    text "Document body."
```

### `backbutton "Parent"`

A leaf primitive that renders as a path-drawn chevron plus parent label. Drawn as an SVG `<path>` element, not unicode, so it's consistent across browsers. Legal anywhere a `button` is: inside `row`, `navbar` slots, `panel`, `section` content, slot `footer:`. Supports the `disabled` flag.

```wireloom
row:
  backbutton "Inbox"
  backbutton "Archive" disabled
```

### `tabbar` / `tabitem` — bottom navigation

`tabbar` is the bottom chrome band for primary navigation. Direct child of `window` only, and mutually exclusive with `footer` (you pick one). Accepts only `tabitem` children, evenly distributed across the window width.

| Primitive | Positional | Children | Attributes | Flags |
|-----------|-----------|----------|------------|-------|
| `tabbar`  | —         | `tabitem` only | — | — |
| `tabitem` | required string label | (leaf) | `icon="<name>"`, `badge="…"` | `selected`, `disabled` |

Each `tabitem` renders as icon-above-label. Unknown icon names fall back to the boxed-first-letter placeholder (same rule as `icon`). `selected` uses the accent/emphasis styling; `badge=` renders a small pill on the icon's top-right.

```wireloom
window "Home":
  header:
    text "Inbox" bold size=large
  list:
    item "Welcome"
    item "Quarterly report"
  tabbar:
    tabitem "Home"     icon="planet" selected
    tabitem "Inbox"    icon="policy" badge="3"
    tabitem "Settings" icon="gear"
```

### `sheet` — modal overlay

`sheet` draws over the underlying window content with a scrim. Direct child of `window`, at most one per window. Defaults to a bottom sheet (rounded top corners, grabber pill, anchored to window bottom). `position=center` instead renders a centered floating modal. Optional `title="…"` renders bold and centered under the grabber. The sheet body accepts any window-legal content (rows, panels, sections, lists, buttons, etc.).

| Attribute | Values |
|-----------|--------|
| `position=` | `bottom` (default), `center` |
| `title="…"` | Optional title string |

```wireloom
window "Photos":
  header:
    text "Vacation 2026" bold size=large
  row:
    image label="beach"
    image label="mountain"
  sheet title="Share":
    list:
      item "Messages"
      item "Mail"
      item "AirDrop"
      item "Copy link"
    row justify=end:
      button "Cancel"
```

```wireloom
window "Documents":
  header:
    text "Budget 2026.xlsx" bold
  sheet position=center title="Delete file?":
    text "This action cannot be undone."
    row justify=end:
      button "Cancel"
      button "Delete" primary accent=danger
```

### `segmented` / `segment` — content filters

A rounded-pill control for mutually-exclusive filters that change which content shows inside a view. Visually distinct from `tabs`: segmented is inline pill-shaped and content-filtering, `tabs` is full-width underlined and view-switching. Never a direct child of `window`: place inside `panel`, `section`, `row`, etc.

| Primitive | Positional | Children | Flags |
|-----------|-----------|----------|-------|
| `segmented` | — | `segment` only | — |
| `segment`   | required string label | (leaf) | `selected`, `disabled` |

Exactly one segment may carry `selected`. Multiple `selected` flags produce a parse error; zero or one total segments emit a `console.warn` but still render (a hint, not a hard fail, so authoring stays forgiving).

```wireloom
window "Calendar":
  panel:
    text "Scope" muted
    segmented:
      segment "Day"
      segment "Week" selected
      segment "Month"
      segment "Year"
```

### `chevron` flag on `slot` and `item`

Disclosure affordance for list rows. Add the bare `chevron` flag to a `slot` or an `item` and the row gets a trailing right-chevron glyph (drawn as a `<path>`, muted color). Unflagged rows render unchanged from v0.4.5, so you can sprinkle it only on the rows that push to detail.

```wireloom
window "Settings":
  section "Account":
    list:
      item "Profile" chevron
      item "Password"
      item "Privacy" chevron
  section "Subscriptions":
    list:
      slot "Billing" chevron:
        text "Visa •••• 4242"
      slot "Plan":
        text "Pro"
```

## Mobile navigation patterns

Canonical flows for phone mockups. Reach for these shapes when the user asks for a mobile screen, a list+detail pair, a form-style edit screen, or a confirm sheet.

### 1. List screen: `tabbar` + `header large:` + search

Root of a mobile app. Large title on top, search field below the title, list in the middle, tab bar docked at the bottom.

```wireloom
window "Notes":
  header large:
    text "Notes"
  panel:
    input placeholder="Search" type=search
  list:
    slot "Ideas" chevron:
      text "3 items" muted
    slot "Recipes" chevron:
      text "12 items" muted
    slot "Trips" chevron:
      text "5 items" muted
  tabbar:
    tabitem "Notes"   icon="policy" selected
    tabitem "Inbox"   icon="planet" badge="2"
    tabitem "Profile" icon="leader"
```

### 2. Detail view: `navbar` (backbutton + actions) + `header large:`

One level deeper. Back button on the left, actions on the right, large title underneath identifies the current record.

```wireloom
window:
  navbar:
    leading:
      backbutton "Notes"
    trailing:
      button "Share"
      button "Edit" primary
  header large:
    text "Q2 Review"
  panel:
    text "Revenue up 18% QoQ. Plan review scheduled for May 7."
    text "Draft saved 2 minutes ago" muted
```

### 3. Edit view: `navbar` (Cancel / Done) + input panel

Modal-style edit. Cancel leading, Done trailing, form fields below. The `navbar` here replaces the `header` entirely, which matches the iOS modal edit pattern.

```wireloom
window:
  navbar:
    leading:
      button "Cancel"
    trailing:
      button "Done" primary
  panel:
    kv "Title" "Q2 Review"
    input placeholder="Title"
    input placeholder="Summary" type=text
    toggle "Pin to top" on
    toggle "Include in weekly digest" off
```

### 4. Confirmation flow: `sheet` overlay

The underlying screen stays visible under the scrim; the sheet draws on top with its own actions.

```wireloom
window "Documents":
  navbar:
    leading:
      backbutton "Files"
    trailing:
      button "Edit"
  header:
    text "Budget 2026.xlsx" bold
  panel:
    text "Last modified 2 hours ago" muted
  sheet position=center title="Delete file?":
    text "This action cannot be undone. The file will be moved to Trash."
    row justify=end:
      button "Cancel"
      button "Delete" primary accent=danger
```

### 5. Segmented content filter inside a section

Segmented sits inside content, not chrome. Use it when the view itself has a few exclusive "show me X" modes.

```wireloom
window "Analytics":
  header large:
    text "Revenue"
  panel:
    segmented:
      segment "Day"
      segment "Week" selected
      segment "Month"
      segment "Year"
    chart kind=line label="Weekly revenue" accent=wealth
```

## Spacers and right-alignment

For anchoring items within a single row (Cancel on the left, Done on the right; title on the left, actions on the right), use `spacer` or `row justify=between`:

```wireloom
# Preferred: explicit spacer
row:
  button "Cancel"
  spacer
  button "Done" primary

# Also valid: distribute via justify
row justify=between:
  text "Step 2 of 4"
  text "Draft saved" muted
```

`align=right` on `row` still works for its original case (pack all children to the right), but when you want two clusters anchored to opposite ends of the same row, reach for `spacer` or `justify=between` instead.

### Universal attribute: `id` (v0.4.1)

`id="…"` is accepted on **every** primitive. It's a string identifier used as the `target=` of an `annotation` (see below). Ids are not validated for uniqueness; if you repeat one, annotations match the first occurrence.

```
button "Sign in" primary id="signin-btn"
input placeholder="Email" type=email id="email-field"
```

Only add `id=""` to elements you actually plan to point a callout at — don't scatter them everywhere.

## Annotations (Callouts) — v0.4.1

> Users may call these "callouts" or "annotations" — both refer to the same feature.

An **annotation** is a user-manual-style label drawn in the canvas margin, with a leader line pointing at a specific element inside the `window`. This lets a single Wireloom source produce a fully annotated mockup — the wireframe and its call-outs in one artifact — the way a printed user manual labels parts of a UI with lines pointing to each feature.

### When to use annotations

Use them when the user asks for:

- "Mockup with callouts / annotations / labels pointing to the parts"
- "User-manual-style diagram of this screen"
- "Mock up the dialog and annotate what each control does"
- "Draw the UI and call out the important buttons"
- Any mockup that benefits from explanatory labels next to specific controls

If the user asks for a plain wireframe with no explanatory labels, **don't** invent annotations — keep it clean.

### Syntax

Annotations live at the **top level**, as siblings of `window`, **not** indented inside it:

```
annotation "<body text>" target="<id>" position=<left|right|top|bottom>
```

- **body** (required, first positional string): the label text. Use `\n` inside the string for line breaks (renders as multi-line in the box).
- **`target=`** (required): the `id` of an element inside the `window`. If no element matches, the annotation is silently dropped.
- **`position=`** (required): which side of the canvas the annotation sits in. No default — pick deliberately. Values: `left`, `right`, `top`, `bottom`.

### Placement

For each side, annotation boxes stack along that edge. Each box is first centered on its target, then nudged along the axis just enough to avoid overlapping the previous box on the same side. Canvas grows to fit.

### Author checklist

1. Add `id="…"` to every element you want to annotate.
2. Write the `window` tree as normal.
3. After the `window` block (at indent 0), add one `annotation` line per callout.
4. Pick `position=` for each so related callouts cluster on the same side when possible — easier to read than callouts scattered on all four sides.

### Example — Sign-in with callouts

```wireloom
window "Sign in":
  header:
    text "Welcome back" bold size=large id="welcome"
  panel:
    input placeholder="Email" type=email id="email-field"
    input placeholder="Password" type=password id="password-field"
    row align=right:
      button "Forgot?" id="forgot-btn"
      button "Sign in" primary id="signin-btn"

annotation "Greeting — personalized after first sign-in" target="welcome" position=top
annotation "Email address.\nMust be verified." target="email-field" position=right
annotation "Password field — masked input." target="password-field" position=right
annotation "Password recovery flow." target="forgot-btn" position=left
annotation "Primary action.\nDisabled until form is valid." target="signin-btn" position=right
```

## Indentation Rules

- **2 or 4 spaces** per level. The file's unit is detected from the first indented line and locked — mix 2-space and 4-space inside the same file and you get a parse error. Tabs in leading whitespace are a parse error.
- A line ending with `:` has children on the following indented line(s).
- A line without `:` is a leaf and cannot have children below it.
- Blank lines and lines starting with `#` are comments and do not affect nesting.

## Examples

### Settings dialog with sections and kv rows

```wireloom
window "Settings":
  section "Appearance":
    kv "Theme" "Dark"
    kv "Font size" "14"
  section "Notifications" badge="2 new":
    kv "Email" "Enabled"
    kv "Push" "Disabled"
```

### Tab bar with an active tab and a badge

```wireloom
window "Inbox":
  tabs:
    tab "All" active
    tab "Unread" badge="12"
    tab "Archived"
  panel:
    text "Message list goes here"
```

### Three-column app shell with a fill middle

```wireloom
window "Editor":
  row:
    col 240:
      panel:
        text "Sidebar" bold
        list:
          item "Home"
          item "Search"
    col:
      panel:
        text "Main content" bold
        text "Fills remaining width."
    col 280:
      panel:
        text "Inspector" bold
        kv "Type" "Document"
```

### Policy card list with slot + active emphasis

```wireloom
window "Policies":
  section "Enacted" badge="4 / 7":
    list:
      slot "Colonial Defense Pact":
        text "+15% Planetary Defense"
        text "All colonies gain defensive bonuses" muted
      slot "Research Subsidies" active:
        text "+20% Research Output"
        text "Government funded research programs" muted
        row align=right:
          button "Revoke"
```

### Confirm dialog with right-aligned footer buttons

```wireloom
window "Confirm action":
  panel:
    text "Delete the selected project?" bold
    text "This cannot be undone." muted
  footer:
    row align=right:
      button "Cancel"
      button "Delete" primary
```

### v0.4 — Resource strip + progress bars

```wireloom
window "Colonial Charter":
  resourcebar:
    resource name="Credits" value="1,500"
    resource name="Research" value="240"
    resource name="Production" value="88"
    resource name="Approval" value="72%"
  section "Progress":
    progress value=68 max=100 label="Computation Pool" accent=research
    progress value=4  max=10  label="Matrix Tier"       accent=wealth
```

### v0.4 — 5×5 tier matrix with state + accent

```wireloom
window "Technocracy — Optimization Matrix":
  grid cols=5 rows=5:
    cell "Compute I"  state=purchased accent=research
    cell "Compute II" state=purchased accent=research
    cell "Compute III" state=available accent=research
    cell "Compute IV" state=locked    accent=research
    cell "Compute V"  state=locked    accent=research
    cell "Tax I"      state=purchased accent=wealth
    cell "Tax II"     state=available accent=wealth
    # … remaining cells auto-flow L→R, T→B
```

### v0.4 — Investment cards with slot footer

```wireloom
window "Oligarchy — Investments":
  row:
    slot "Corellian Shipyards" state=growing accent=industry:
      stats:
        stat "Yield"   "+12/turn"
        stat "Ripens"  "T+6"
      footer:
        button "Sell"
        button "Harvest" primary accent=wealth
    slot "Arcturus Mining Guild" state=ripe accent=wealth:
      stats:
        stat "Yield"  "+40/turn"
        stat "Ripens" "NOW"
      footer:
        button "Sell"
        button "Harvest" primary accent=success
```

### v0.4 — Leader stat strip

```wireloom
window "Leader Card":
  panel:
    text "Admiral Kade Voss" bold size=large
    stats:
      stat "INT" "4"
      stat "CHA" "3"
      stat "MIL" "5" bold
      stat "LOY" "75"
    text "Fleet Admiral, Arcturus Prime" muted size=small
```

### v0.4 — Chart placeholders

```wireloom
window "Analysis":
  row:
    chart kind=bar  label="Maintenance ramp" accent=warning
    chart kind=line label="Approval over time" accent=approval
    chart kind=pie  label="Equity split"       accent=wealth
```

`chart` is a placeholder — it renders a stylized bar/line/pie shape, not a real chart from data. Use it the same way you use `image`: to signal "a chart goes here" in a mockup.

## v0.50 Limitations — Things You Cannot Yet Do

- **No interactivity.** No click handlers, no tab-switching, no form submission, no sheet open/close. Wireloom is static SVG.
- **No color overrides beyond `accent=`.** Choose from the named accent palette; fully-custom hex colors are not supported per-element.
- **No animation or transitions.** Sheets do not slide in, large-title headers do not collapse on scroll, segmented thumb positions do not animate.
- **No nested `window`.** Only one root per source.
- **`chart` does not plot real data.** It's a stylized placeholder shape. If you need real data visualization, use a real charting library in actual code, not a wireframe.
- **Icons outside the named set** render as the v0.3 boxed-first-letter placeholder. Add new names to the library (PR welcome) if you need them broadly.
- **At most one `sheet` per window.** Stacked modals are out of scope (no modal-stack semantics in the DSL).

## How Agents Should Think About Wireloom

**Default to Wireloom whenever you're about to describe a UI in prose.** If you catch yourself writing "there's a title bar with a search box on the left, then a content area with..." — that's a wireloom block, not a paragraph. The user sees a picture instead of imagining one.

Use it in:
- Chat replies when discussing a feature's layout
- Design docs, RFCs, and PR descriptions
- Issue comments proposing a UI change
- Any response to "what would this look like?" / "mock this up"
- **Any time the user asks for a mockup with "callouts", "annotations", or "labels"** — reach straight for Wireloom with `annotation` nodes (both words mean the same thing).

Don't use it for:
- Static decorative drawings (just describe in prose)
- Diagrams of data or process flow (that's Mermaid)
- Anything the user needs to actually click (write the real component)

## Common Parse Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Line N, col 1: tab in indentation (use 2 or 4 spaces, not tabs)` | A tab character in leading whitespace | Replace tabs with consistent space indentation (2 or 4 per level) |
| `Line N, col 1: first indented line uses K spaces; Wireloom accepts 2 or 4 spaces per level` | First indented line isn't 2 or 4 | Use exactly 2 or 4 spaces on the first indented line |
| `Line N, col 1: indentation of K spaces is not a multiple of {U}` | A later line uses a different unit than the file was detected with | Pick one of 2 or 4 and use it consistently |
| `Line N, col C: unknown primitive "foo". Did you mean "bar"?` | Typo in primitive name | Accept the suggestion or check the primitives tables above |
| `Line N, col C: "text" requires a string argument` | Leaf primitive missing its required positional | `text "Hello"` not just `text` |
| `Line N, col C: "kv" needs two separate strings (label, value). Got only "Label=Value" — if you meant to split on "=", try: kv "Label" "Value"` | You wrote label and value as a single string | Split into two quoted strings |
| `Line N, col C: "kv" requires a value string after the label` | `kv` missing its second positional entirely | `kv "Label" "Value"` — both required |
| `Line N, col C: "tab" may only appear inside "tabs"` | Structural rule violation | Wrap `tab`s in a `tabs:` container |
| `Line N, col C: "item" may only appear inside "list"` | Structural rule violation | Wrap `item`s in a `list:` container |
| `Line N, col C: "tabs" accepts only "tab" children` | Non-tab child inside `tabs:` | Only `tab` children allowed — use a different container |
| `Line N, col C: "xyz" is not a valid weight on "text" (expected one of: light, regular, semibold, bold)` | Enum value typo | Use one of the listed values |
| `Line N, col C: range must be N-M with M > N, got "100-0"` | Slider range inverted | Swap to `range=0-100` |
| `Line N, col C: unknown attribute "xyz" on "input"` | Attribute not in the table above | Remove or use a supported attribute |
| `Line N, col C: "text" cannot have children` | A leaf primitive ends with `:` and has indented content under it | Remove the colon; leaves don't nest |
| `Line N, col C: "spacer" may only appear inside "row"` | `spacer` placed outside a `row` | Wrap the `spacer` in a `row:`, or delete it if the gap was intended inside a `col` (use `col fill` instead) |
| `Line N, col C: "xyz" is not a valid justify on "row" (expected one of: start, between, around, end)` | Unknown `justify=` value | Pick one of the four values |
| `Line N, col C: "navbar" may only appear directly inside "window"` | `navbar` placed inside a `row`, `panel`, `section`, etc. | Move the `navbar:` up to be a direct child of `window:` |
| `Line N, col C: navbar and header cannot both appear in a window — pick one (they share the chrome band)` | Both `header:` and `navbar:` used at window level | Delete one. Use `navbar` for back/action mobile chrome, `header` for plain title bands |
| `Line N, col C: "navbar" accepts only "leading:" or "trailing:" children (got "xyz")` | A primitive other than `leading:` / `trailing:` placed directly under `navbar:` | Wrap it in one of the two slots, e.g. `leading: button "Back"` |
| `Line N, col C: "navbar" may contain at most one "leading:" block` (and similarly for `trailing:`) | Two `leading:` or two `trailing:` blocks under the same `navbar` | Merge their children into a single slot |
| `Line N, col C: "leading" may only appear inside "navbar"` / `"trailing" may only appear inside "navbar"` | `leading:` or `trailing:` used at window or container scope | Only valid inside `navbar:` |
| `Line N, col C: "tabbar" and "footer" are mutually exclusive in the same window — use one or the other` | Both `tabbar:` and `footer:` at window level | Pick one. `tabbar` for mobile primary nav, `footer` for desktop action bars |
| `Line N, col C: "tabbar" accepts only "tabitem" children (got "xyz")` | Non-`tabitem` child under `tabbar` | Wrap each tab as `tabitem "Label" icon="…"` |
| `Line N, col C: "tabitem" may only appear inside "tabbar"` | `tabitem` used outside `tabbar` | Wrap in `tabbar:` |
| `Line N, col C: only one "sheet" is allowed per "window"` | Two `sheet:` blocks in one window | Keep one. Wireloom does not model stacked modals |
| `Line N, col C: "xyz" is not a valid position on "sheet" (expected one of: bottom, center)` | Unknown `position=` on `sheet` | Use `position=bottom` (default) or `position=center` |
| `Line N, col C: "sheet" may only appear directly inside "window"` | `sheet:` nested inside a container | Move it up to the window level |
| `Line N, col C: "segmented" allows at most one "segment" with the "selected" flag; pick exactly one` | Two or more `segment`s flagged `selected` | Remove `selected` from all but one segment |
| `Line N, col C: "segmented" accepts only "segment" children (got "xyz")` | Non-`segment` child inside `segmented` | Wrap each option as `segment "Label"` |
| `Line N, col C: "segment" may only appear inside "segmented"` | `segment` used outside `segmented` | Wrap in `segmented:` |

## Where Wireloom Renders

Wireloom outputs plain SVG, so any Markdown consumer that supports inline SVG can display the result:

- **GitHub** — READMEs, issues, PR descriptions, discussions (when the SVG is pre-rendered and embedded or linked)
- **Obsidian, Notion, Bear, iA Writer** — any Markdown tool with SVG support
- **Static site generators** — Docusaurus, Astro, Hugo, MkDocs, Next.js MDX
- **Integrations** — tools that bundle the Wireloom renderer turn fenced ```wireloom blocks into inline SVG at view time (no SVG in the source file needed)

## Prompting Tips for Orchestrating Agents

If you're an agent that orchestrates other agents (task delegation, subagents, recruiters), tell your subagent explicitly:

> "When you need to sketch a UI, emit a ```wireloom fenced code block following the Wireloom grammar. Do not describe the layout in prose. Do not use ASCII art. Do not use Mermaid for UI layouts."

Followed by linking this file, or pasting the primitives table. Agents default to prose or ASCII art unless instructed otherwise.

## Links

- Source + issues: https://github.com/StardockCorp/Wireloom
- npm: https://www.npmjs.com/package/wireloom
- Integration guide: [INTEGRATION.md](INTEGRATION.md)
