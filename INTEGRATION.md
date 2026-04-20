# Integrating Wireloom into a Markdown viewer

This guide covers everything a third-party Markdown viewer, documentation site, or note-taking app needs to drop Wireloom into its rendering pipeline.

**Compatible with:** any Markdown pipeline that exposes fenced code blocks. Works in browsers (every evergreen), Node 18+, Deno, Bun, Electron / Tauri / Capacitor, and edge runtimes (Cloudflare Workers, Vercel Edge).

---

## 5-minute quickstart

If your viewer already renders Mermaid, KaTeX, or any other fenced-block extension, Wireloom plugs in the same way. The whole integration is:

```ts
import wireloom from 'wireloom';

// When you see a fenced block with language "wireloom":
const { svg } = await wireloom.render('unique-id', source);

// Inject the SVG string into the DOM.
element.innerHTML = svg;
```

That's the entire API surface you need. Output is a self-contained SVG string with no `<script>` tags, no external references, and fully HTML-escaped text — safe for `innerHTML` / `dangerouslySetInnerHTML` without further sanitization.

Next steps:

- **Pick a recipe** for your Markdown pipeline in [Recipes](#recipes) below (react-markdown, remark/rehype, markdown-it, plain DOM, SSR).
- **Optional:** expose a theme toggle to your users — `render(id, source, { theme: 'dark' })`.
- **Done.** Full grammar lives in [`design/grammar.md`](design/grammar.md); your users write it, you render it.

Minimum viable end-to-end example (copy-paste into a fresh project):

```html
<!doctype html>
<html>
<head><title>Wireloom quickstart</title></head>
<body>
  <div id="out"></div>
  <script type="module">
    import wireloom from 'https://esm.sh/wireloom@0.4.1';
    const source = `
window "Sign in":
  header:
    text "Welcome back" bold id="welcome"
  panel:
    input placeholder="Email" id="email"
    button "Sign in" primary id="signin"

annotation "Personalized greeting" target="welcome" position=top
annotation "Primary action" target="signin" position=right
`;
    const { svg } = await wireloom.render('demo', source);
    document.getElementById('out').innerHTML = svg;
  </script>
</body>
</html>
```

Open that file in a browser and you get a rendered annotated wireframe.

---

## Core model

Wireloom is a pure text-to-SVG function. You give it the source of a ```wireloom fenced block; it returns a self-contained SVG string. Everything the integrator needs to do is:

1. Detect `wireloom` fenced code blocks in the Markdown input.
2. Pass the block's source to `wireloom.render(id, source)`.
3. Inject the resulting SVG into the output — with `innerHTML`, `dangerouslySetInnerHTML`, or a plain HTML string concatenation.

No runtime JavaScript is needed for the rendered output — SVG renders natively in every browser and in every Markdown viewer that supports SVG.

## Install

```bash
npm install wireloom
```

Zero runtime dependencies. Works in Node 18+, in every evergreen browser, and inside Electron / Tauri / React Native WebView / Capacitor. Ships dual ESM/CJS with full TypeScript types.

## Output safety

`wireloom.render` returns a self-contained SVG string:

- No `<script>` tags.
- No external references (no `<image href>`, no `<use href>`, no external fonts).
- All user-supplied text content is HTML-escaped before emission.
- All attribute values are HTML-escaped before emission.

You can safely inject the output with `innerHTML` / `dangerouslySetInnerHTML` without running it through a further sanitizer. The output **does** embed user text verbatim (inside `<text>` elements), so if you have a separate content-integrity concern (e.g. stopping users from embedding rude words in a shared note), apply your own content filter to the input source — sanitization of the output is a no-op.

## Bundle size

At v0.4.1, the built bundle is roughly:

- ESM: ~120 KB raw, gzipped this lands well under 40 KB.
- CJS: same.

No heavy dependencies. If you're worried about the bundle landing in a main chunk, lazy-load the module on the first `wireloom` block you see:

```ts
async function renderWireloomBlock(id: string, source: string) {
  const { default: wireloom } = await import('wireloom');
  return wireloom.render(id, source);
}
```

## Recipes

### Plain DOM / no framework

```ts
import wireloom, { WireloomError } from 'wireloom';

document.querySelectorAll('pre > code.language-wireloom').forEach(async (codeEl, i) => {
  const source = codeEl.textContent ?? '';
  try {
    const { svg } = await wireloom.render(`wireloom-${i}`, source);
    const host = document.createElement('div');
    host.className = 'wireloom';
    host.innerHTML = svg;
    codeEl.closest('pre')?.replaceWith(host);
  } catch (err) {
    if (err instanceof WireloomError) {
      codeEl.parentElement?.insertAdjacentHTML(
        'beforebegin',
        `<div class="wireloom-error">Line ${err.line}, col ${err.column}: ${escapeHtml(err.message)}</div>`,
      );
    } else {
      throw err;
    }
  }
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c));
}
```

### react-markdown

```tsx
import ReactMarkdown from 'react-markdown';
import wireloom, { WireloomError } from 'wireloom';
import { useEffect, useRef, useState } from 'react';

function WireloomBlock({ source }: { source: string }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`wireloom-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    wireloom
      .render(idRef.current, source)
      .then(({ svg }) => !cancelled && setSvg(svg))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof WireloomError) {
          setError(`Line ${err.line}, col ${err.column}: ${err.message}`);
        } else {
          setError(String(err));
        }
      });
    return () => { cancelled = true; };
  }, [source]);

  if (error) return <pre className="wireloom-error">{error}</pre>;
  return <div className="wireloom" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Markdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      components={{
        code({ className, children }) {
          const lang = /language-(\w+)/.exec(className ?? '')?.[1];
          if (lang === 'wireloom') return <WireloomBlock source={String(children)} />;
          return <code className={className}>{children}</code>;
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
```

### remark / rehype

Write a small rehype visitor that replaces `wireloom` code blocks with raw HTML containing the rendered SVG:

```ts
import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';
import wireloom, { WireloomError } from 'wireloom';

export function rehypeWireloom() {
  return async (tree: Root) => {
    const targets: Array<{ node: Element; parent: Element | Root; index: number }> = [];
    visit(tree, 'element', (node, index, parent) => {
      if (
        node.tagName === 'code' &&
        Array.isArray(node.properties?.className) &&
        node.properties.className.includes('language-wireloom') &&
        parent && typeof index === 'number'
      ) {
        targets.push({ node, parent: parent as Element, index });
      }
    });

    let i = 0;
    for (const { node, parent, index } of targets) {
      const source = (node.children[0] as { value?: string })?.value ?? '';
      try {
        const { svg } = await wireloom.render(`wireloom-${i++}`, source);
        // Replace the enclosing <pre> with raw HTML.
        const grandparent = parent;
        grandparent.children[index] = {
          type: 'raw',
          value: `<div class="wireloom">${svg}</div>`,
        } as unknown as Element;
      } catch (err) {
        const msg = err instanceof WireloomError
          ? `Wireloom line ${err.line}, col ${err.column}: ${err.message}`
          : String(err);
        grandparent.children[index] = {
          type: 'raw',
          value: `<pre class="wireloom-error">${escapeHtml(msg)}</pre>`,
        } as unknown as Element;
      }
    }
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c));
}
```

Plug it in after `rehype-raw` (so the injected raw HTML is kept) and before `rehype-stringify`:

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';

const html = await unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeWireloom)
  .use(rehypeStringify, { allowDangerousHtml: true })
  .process(markdown);
```

### markdown-it

`markdown-it` is synchronous, so you pre-render asynchronously then inject via a custom fence renderer backed by a cache:

```ts
import MarkdownIt from 'markdown-it';
import wireloom, { WireloomError } from 'wireloom';

/** Cache of source → rendered SVG (or error HTML). Populated before md.render(). */
const cache = new Map<string, string>();

async function prepareWireloom(markdown: string): Promise<void> {
  const fenceRe = /```wireloom\n([\s\S]*?)```/g;
  const sources = [...markdown.matchAll(fenceRe)].map((m) => m[1]!);
  await Promise.all(sources.map(async (source, i) => {
    try {
      const { svg } = await wireloom.render(`wireloom-${i}`, source);
      cache.set(source, `<div class="wireloom">${svg}</div>`);
    } catch (err) {
      const msg = err instanceof WireloomError
        ? `Wireloom line ${err.line}, col ${err.column}: ${err.message}`
        : String(err);
      cache.set(source, `<pre class="wireloom-error">${escapeHtml(msg)}</pre>`);
    }
  }));
}

const md = new MarkdownIt();
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!;
  if (token.info.trim() === 'wireloom') {
    return cache.get(token.content) ?? defaultFence(tokens, idx, options, env, self);
  }
  return defaultFence(tokens, idx, options, env, self);
};

// Usage:
await prepareWireloom(markdown);
const html = md.render(markdown);
```

### Server-side rendering

Everything above works on the server. `wireloom.render` is a pure function with no DOM dependency — Node, Deno, Bun, Cloudflare Workers, Vercel Edge all work. The returned SVG string can be written directly into your static HTML output; consumers never need to load the `wireloom` bundle client-side.

If you're pre-rendering at build time, do it synchronously with the rehype recipe above (the `render` is only `await`-wrapped for API symmetry — internally it's synchronous).

## Annotations (user-manual-style callouts)

As of **v0.4.1**, Wireloom sources can include `annotation` nodes — labels drawn in the canvas margin with leader lines pointing at elements inside the `window`. This lets a single source produce both the wireframe *and* its explanatory callouts in one artifact, the way a printed user manual labels the parts of a UI.

From an integrator's perspective, **there is nothing to do.** Annotations are part of the source syntax; `wireloom.render()` lays them out and emits them as part of the same self-contained SVG string. You don't need separate render paths, separate DOM nodes, or special handling — the SVG returned is already annotated.

Source syntax for reference (you'll see this appear in user content):

```
window "Sign in":
  panel:
    button "Sign in" primary id="signin-btn"

annotation "Primary action. Disabled until form is valid." target="signin-btn" position=right
```

Two things worth knowing:

1. `annotation` nodes live at the **top level**, as siblings of `window` — not indented inside it. They reference into the window via `target="<id>"`, where `id` is a universal attribute now accepted on every primitive.
2. The SVG canvas grows to accommodate annotations in the margins. The `width` / `height` / `viewBox` attributes on the returned `<svg>` reflect that larger canvas, so `max-width: 100%; height: auto` styling still works as-is.

This feature is strictly additive — sources written against v0.4.0 parse and render identically under v0.4.1.

## Themes

Two themes ship in the box: `default` (light) and `dark`. Select per-render:

```ts
const { svg } = await wireloom.render('id', source, { theme: 'dark' });
```

Or set globally:

```ts
wireloom.initialize({ theme: 'dark' });
```

The theme interface is public — import it if you want to read its tokens (for example, to match your site's own CSS palette against the SVG backgrounds):

```ts
import { DEFAULT_THEME, DARK_THEME, type Theme } from 'wireloom';

console.log(DEFAULT_THEME.background); // "#ffffff"
console.log(DARK_THEME.textColor);     // "#e0e0e0"
```

Fully-custom themes (user-defined palettes beyond `default`/`dark`) aren't a stable public API yet — the `Theme` interface is exported but we reserve the right to add new tokens in a minor release, which breaks structural typing. Targeted for v1.0. For now, use one of the two bundled themes.

## Error handling

Parse failures throw `WireloomError` with `line`, `column`, and a human-readable `message`:

```ts
import { WireloomError } from 'wireloom';

try {
  await wireloom.render('id', source);
} catch (err) {
  if (err instanceof WireloomError) {
    // err.line, err.column, err.message
  } else {
    throw err; // something else went wrong
  }
}
```

Error messages include targeted "did you mean?" hints for common typos — e.g. `unknown primitive "pannel". Did you mean "panel"?` — so surfacing them verbatim to the end user usually gives them enough to fix the source themselves.

An empty or whitespace-only source does **not** throw — it returns an empty SVG element. Parse a comment-only source and you'll get an empty document rather than an error.

## CSS styling

The rendered SVG is self-contained with inline attributes — no classes, no element IDs that collide with your site. If you want to style the container (padding, max-width, centering), style the wrapper `div` you put the SVG into:

```css
.wireloom {
  max-width: 100%;
  overflow-x: auto;
}
.wireloom svg {
  display: block;
  max-width: 100%;
  height: auto;
}
.wireloom-error {
  background: #fee;
  border-left: 3px solid #c33;
  padding: 0.5em 0.75em;
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
}
```

The SVG declares its own `width`, `height`, and `viewBox`. Scaling with CSS `max-width: 100%; height: auto` preserves the aspect ratio.

## Versioning and stability

Wireloom is pre-1.0. We follow these rules:

- **Patch (0.4.0 → 0.4.1)**: bug fixes, internal refactors, no public-API or rendered-output changes.
- **Minor (0.4.0 → 0.5.0)**: new primitives, new attributes, new theme tokens. Existing source written against the previous minor continues to parse and render, but the rendered SVG output and the `Theme` interface can evolve.
- **Pre-1.0 major (0.x.0 → 0.y.0)**: reserved; we don't plan to ship this. Sources from v0.1 through today all still parse.

If you pin `wireloom` for reproducibility, use `~0.4.0` (patch-only) or an exact version. The `^` caret on a pre-1.0 version locks the minor — `^0.4.0` means `>=0.4.0 <0.5.0` — which is equivalent to `~0.4.0` in our case.

## Feedback

If you're integrating Wireloom into a Markdown viewer or docs pipeline and hit a sharp edge this doc doesn't cover, open an issue at [github.com/StardockCorp/Wireloom/issues](https://github.com/StardockCorp/Wireloom/issues). Integration feedback is the single biggest signal we use to decide what lands in v1.0.
