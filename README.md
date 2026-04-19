# Wireloom

> UI wireframe mockups from a Markdown-embedded DSL, rendered as inline SVG.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built for Clairvoyance](https://img.shields.io/badge/built%20for-Clairvoyance-3a3a3a)](https://www.clairvoyanceai.com)

Wireloom is a small text-based language for sketching user-interface wireframes. You write the layout as indented plain text inside a fenced code block in any Markdown document, and Wireloom turns it into an SVG diagram that renders inline — in GitHub, Obsidian, Notion, static site generators, or any tool that supports SVG in Markdown.

## Origin

Wireloom was built for **[Clairvoyance](https://www.clairvoyanceai.com)** — an AI-native knowledge workspace where staff (AI agents) collaborate with users through chat and Markdown notes. The team needed a way for staff to *communicate UI design ideas inline* — not flowcharts, not ASCII art, not clickable prototypes, but quick visual wireframes embedded directly in a chat reply, a note, or a design report.

Since everything in Clairvoyance flows through Markdown and SVG is already the cross-tool lingua franca for inline visuals, Wireloom was built as a text-to-SVG DSL. It ships with Clairvoyance and Just Works™ there — and because the output is plain static SVG, it works everywhere else that renders SVG in Markdown.

## Status

**v0.3 — first public release.** Full v1 primitive set, flexible 2- or 4-space indentation, and friendly "did you mean?" error messages. Available on npm.

## What it looks like

A fenced block in Markdown:

~~~markdown
```wireloom
window "Sign in":
  header:
    text "Welcome back"
  panel:
    input placeholder="Email"
    input placeholder="Password" type=password
    button "Sign in" primary
  footer:
    text "Forgot your password?"
```
~~~

Renders as:

![Login form wireframe rendered by Wireloom](docs/login-form.svg)

No pixel-perfect fidelity; the aesthetic is sketch-style so it reads as a wireframe, not a finished UI.

### A denser example

```wireloom
window "Settings":
  section "Appearance":
    kv "Theme" "Dark"
    kv "Font size" "14"
  section "Notifications" badge="2 new":
    kv "Email" "Enabled"
    kv "Push" "Disabled"
  section "Privacy":
    kv "Telemetry" "Anonymous"
    kv "Crash reports" "Enabled"
```

![Settings dialog wireframe rendered by Wireloom](docs/settings-dialog.svg)

Sections with optional badges, `kv` label/value rows with flush-right alignment. Add `tabs`, `slot`, `combo`, `slider`, `image`, and `icon` primitives on top of that and you can sketch a full application screen:

![Colonial Charter screen rendered by Wireloom](docs/colonial-charter.svg)

The source for that render is in [`examples/11-colonial-charter.wireloom`](examples/11-colonial-charter.wireloom) — a real game-UI stress test used to drive v0.2 fidelity.

## Install

```bash
npm install wireloom
```

Works the same with `pnpm add wireloom` or `yarn add wireloom`. Zero runtime dependencies; ships dual ESM/CJS with full TypeScript types.

## Usage

Three public calls, same shape as other text-to-diagram libraries:

```ts
import wireloom from 'wireloom';

// Optional: configure theme + security level once at startup.
wireloom.initialize({ theme: 'default', securityLevel: 'strict' });

// Render a source string to an SVG string.
const { svg } = await wireloom.render('my-diagram', `
window "Sign in":
  header:
    text "Welcome"
  panel:
    input placeholder="Email"
    input placeholder="Password" type=password
    button "Sign in" primary
`);

document.getElementById('container').innerHTML = svg;
```

Or parse without rendering, useful for editors and tooling:

```ts
const doc = wireloom.parse(source); // typed AST
```

Serialize an AST back to canonical source — useful for formatters and structural diffs:

```ts
const canonical = wireloom.serialize(doc);
```

Switch themes per-render:

```ts
const { svg } = await wireloom.render('id', source, { theme: 'dark' });
```

### Inside a Markdown renderer

Hook `wireloom.render` onto the `wireloom` fence language in whatever pipeline you use (react-markdown, remark, markdown-it, etc.):

```tsx
<ReactMarkdown
  components={{
    code({ className, children }) {
      const lang = /language-(\w+)/.exec(className ?? '')?.[1];
      if (lang === 'wireloom') return <WireloomBlock source={String(children)} />;
      // ... your other handlers
    },
  }}
>
  {markdown}
</ReactMarkdown>
```

`WireloomBlock` is a small component that awaits `wireloom.render(id, source)` on mount and injects the SVG via `dangerouslySetInnerHTML`.

## Why not just use [other thing]?

- **ASCII art** is readable but doesn't render visually and can't be styled.
- **Flowchart DSLs** can't express UI layout — rows, columns, panels, form fields.
- **Wireframing tools** produce images, not text; they don't live in your Markdown, can't be diffed in git, and break when you change tools.

Wireloom is text-first, SVG-output, Markdown-native.

## Design principles

- **Text in, SVG out.** One API call: `render(source) → svg`.
- **Works anywhere Markdown + SVG works.** No JavaScript runtime required for rendered output.
- **Readable source.** If you squint at a `.wireloom` file, you should be able to see the layout.
- **Small core.** Fewer primitives, composed well. No feature creep.
- **Public package.** MIT-licensed. Built to be depended on.

## Primitive set

20 primitives, grouped:

- **Structural containers**: `window`, `header`, `footer`, `panel`, `section`, `tabs`, `row`, `col`, `list`, `slot`
- **Interactive leaves**: `button`, `input`, `combo`, `slider`, `tab`, `item`
- **Content leaves**: `text`, `kv`, `image`, `icon`, `divider`

Styling attributes on `text` and `kv` value: `bold` / `italic` / `muted` flags, `weight=light|regular|semibold|bold`, `size=small|regular|large`. `badge="…"` on tabs, sections, and buttons. `align=left|center|right` on rows. `fill` on columns.

Full reference at [`design/grammar.md`](design/grammar.md).

## Roadmap

- ✅ **v0.1** — Thin slice: `window`, `header`, `footer`, `row`, `col`, `panel`, `text`, `button`, `input`, `divider`. Default theme.
- ✅ **v0.2** — Full v1 token set: `tabs`, `section`, `list`, `slot`, `kv`, `combo`, `slider`, `image`, `icon`, badges, alignment, typography, dark theme, roundtrip serializer.
- ✅ **v0.3** — Published to npm. Flexible 2- or 4-space indentation, "did you mean?" suggestions, targeted `kv` hint.
- **v0.4** — Documentation site with live editor. Visual regression via headless Chromium.
- **v1.0** — Stable public API, ecosystem adapters (`remark-wireloom`, `markdown-it-wireloom`), VS Code extension.

## Links

- GitHub: [StardockCorp/Wireloom](https://github.com/StardockCorp/Wireloom)
- Issues: [github.com/StardockCorp/Wireloom/issues](https://github.com/StardockCorp/Wireloom/issues)
- Designed for: **[Clairvoyance](https://www.clairvoyanceai.com)** — AI-native knowledge workspace where staff communicate UI designs through wireloom blocks inline

## License

MIT © 2026 Brad Wardell
