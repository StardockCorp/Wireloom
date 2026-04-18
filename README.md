# Wireloom

> UI wireframe mockups from a Markdown-embedded DSL, rendered as inline SVG.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built for Clairvoyance](https://img.shields.io/badge/built%20for-Clairvoyance-3a3a3a)](https://www.clairvoyanceai.com)

Wireloom is a small text-based language for sketching user-interface wireframes. You write the layout as indented plain text inside a fenced code block in any Markdown document, and Wireloom turns it into an SVG diagram that renders inline — in GitHub, Obsidian, Notion, static site generators, or any tool that supports SVG in Markdown.

## Origin

Wireloom was built for **[Clairvoyance](https://www.clairvoyanceai.com)** — an AI-native knowledge workspace where staff (AI agents) collaborate with users through chat and Markdown notes. The team needed a way for staff to *communicate UI design ideas inline* — not flowcharts, not ASCII art, not clickable prototypes, but quick visual wireframes embedded directly in a chat reply, a note, or a design report.

Since everything in Clairvoyance flows through Markdown and SVG is already the cross-tool lingua franca for inline visuals, Wireloom was built as a text-to-SVG DSL. It ships with Clairvoyance and Just Works™ there — and because the output is plain static SVG, it works everywhere else that renders SVG in Markdown.

## Status

**Pre-alpha.** Grammar and API are being pinned down. Nothing is published yet. Follow the milestones below.

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

## Install

Wireloom isn't on npm yet. Install directly from GitHub:

```bash
npm install github:StardockCorp/Wireloom
```

Works the same with `pnpm add github:StardockCorp/Wireloom` or `yarn add github:StardockCorp/Wireloom`.

Once the package is published to npm you'll be able to install it the normal way — `npm install wireloom` — and this section will be updated.

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

## Roadmap

- **v0.1** — Thin slice: `window`, `header`, `footer`, `row`, `col`, `panel`, `text`, `button`, `input`, `divider`. Default theme.
- **v0.2** — Full v1 token set: `tabs`, `section`, `list`, `slot`, `kv`, `image`, `icon`, form inputs, badges. Dark theme.
- **v0.3** — Error messages with line numbers, visual regression tests, published on npm.
- **v1.0** — Documentation site with live editor and example gallery.

## Links

- GitHub: [StardockCorp/Wireloom](https://github.com/StardockCorp/Wireloom)
- Issues: [github.com/StardockCorp/Wireloom/issues](https://github.com/StardockCorp/Wireloom/issues)
- Designed for: **[Clairvoyance](https://www.clairvoyanceai.com)** — AI-native knowledge workspace where staff communicate UI designs through wireloom blocks inline

## License

MIT © 2026 Brad Wardell
