# Contributing to Wireloom

Two kinds of contribution are designed to be low-friction: **icons** and **themes**. Each is a single-file change with a clear template, takes maybe ten minutes, and the PR process is light. A third kind — **new primitives** — is deliberately harder because every primitive is permanent surface area; we want to talk it over before you write the code.

This guide walks through all three.

---

## Quick start

```bash
git clone https://github.com/StardockCorp/Wireloom.git
cd Wireloom
npm install
npm test          # 198 tests should pass
npm run typecheck # tsc --noEmit, should be silent
```

That's it. No build step is required to iterate — `npm test` runs against source via Vitest + ts-loader. The `dist/` folder is committed but only needs rebuilding with `npm run build` before a release.

---

## Adding an icon (≈10 min)

Wireloom ships a small named icon library in [`src/renderer/icons.ts`](src/renderer/icons.ts). Adding a new icon is:

1. **Open `src/renderer/icons.ts`.**
2. **Append an entry** to the `ICON_PATHS` map. Each entry is SVG markup drawn inside a 16×16 logical box, using `currentColor` for stroke and fill so the caller's accent color flows through:

   ```ts
   const ICON_PATHS: Record<string, string> = {
     // … existing icons …

     // Your new icon — a compass, say.
     compass:
       '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4" />' +
       '<path d="M 8 3 L 10 8 L 8 13 L 6 8 Z" fill="currentColor" />',
   };
   ```

3. **Run the tests** — `npm test`. Nothing should fail (the icon registry isn't snapshot-tested directly; it's exercised through existing examples).
4. **Add an example** (optional but appreciated). Either add a new row to [`examples/26-named-icons.wireloom`](examples/26-named-icons.wireloom), or create a tiny new `.wireloom` file using your icon and let the renderer snapshot tests pick it up. Run `npx vitest run -u` to generate the snapshot.
5. **Open a PR.**

### Icon style rules

- **16×16 viewBox.** Wireloom scales icons to whatever size the caller uses (typically 24px); your path data should assume 16×16 regardless.
- **Use `currentColor`**, not hex codes. That's how `accent=` coloring works — the wrapper `<g>` sets `color="…"` and your paths inherit.
- **Keep it minimal.** Single-stroke or single-fill shapes. This is wireframe iconography, not a production icon set. If you're tempted to add a drop shadow, don't.
- **One glyph per line of intent.** If you need two distinct renderings, that's two icon entries, not one with a flag.
- **Name it simply.** Lowercase, no hyphens unless necessary. `compass`, not `navigation-compass`.

### Duplicate names and coverage

Check `listIcons()` or just skim `ICON_PATHS` before adding. If an existing name means the same thing your icon does, extend that one rather than shipping a duplicate. If the concept overlaps but renders differently (e.g. a dove for "peace" vs. the existing `approval` heart), that's fine — ship both with distinct names.

---

## Adding a theme (≈20 min)

Wireloom ships two themes: `default` (light) and `dark`, defined in [`src/renderer/themes.ts`](src/renderer/themes.ts). Adding a third is a single-file change:

1. **Open `src/renderer/themes.ts`.**
2. **Define your theme** as an object spreading `DEFAULT_THEME`, overriding the colors you care about, and keeping everything else identical:

   ```ts
   export const SEPIA_THEME: Theme = Object.freeze({
     ...DEFAULT_THEME,
     name: 'sepia',
     background: '#f4ecd8',
     textColor: '#3d2e1a',
     mutedTextColor: '#8a7454',
     panelBorderColor: '#b5a07a',
     // … override whatever else you want; tokens you don't touch inherit from DEFAULT_THEME
   }) as Theme;
   ```

3. **Register it in `getTheme()`** at the bottom of the file:

   ```ts
   export function getTheme(name: 'default' | 'dark' | 'sepia'): Theme {
     if (name === 'dark') return DARK_THEME;
     if (name === 'sepia') return SEPIA_THEME;
     return DEFAULT_THEME;
   }
   ```

4. **Widen the `WireloomTheme` type** in [`src/config.ts`](src/config.ts) so the public API accepts the new name:

   ```ts
   export type WireloomTheme = 'default' | 'dark' | 'sepia';
   ```

5. **Run the tests** — `npm test`. The theme tests will verify your theme satisfies the `Theme` interface; rendering tests will only fail if your overrides produce invalid SVG (rare — the theme interface is plain strings and numbers).
6. **Add a snapshot** for your theme by copying `test/renderer/themes.test.ts`'s dark-theme check and pointing it at your new theme.
7. **Open a PR.**

### Theme style rules

- **Keep contrast readable.** Body text on background should comfortably pass WCAG AA. Muted text can be looser but still legible.
- **Accent palette is optional.** If you don't override `accents`, your theme inherits the default accent colors. If you do override it, provide all eight semantic accents — `research`, `military`, `industry`, `wealth`, `approval`, `warning`, `danger`, `success`.
- **State palette is optional** for the same reason. If you override it, provide all nine states — `locked`, `available`, `active`, `purchased`, `maxed`, `growing`, `ripe`, `withering`, `cashed`.
- **Name it meaningfully.** `sepia`, `solarized`, `high-contrast` — not `theme3`.
- **One theme per PR.** Makes reviews easier and lets us ship or revert each independently.

Runtime user-defined themes (passing a custom `Theme` object to `render()` without it being in the bundled set) aren't a stable public API yet — that's part of the v1.0 promise. Contributed themes that land in the bundled set are the supported path today.

---

## Adding a primitive (deliberate friction)

New primitives are *not* a low-friction contribution. Each one:

- Lands in the parser grammar, the AST, the layout engine, the SVG renderer, and the serializer — five files minimum.
- Becomes part of the public AST shape, which means changing it later is a breaking change.
- Has to be maintained forever by whoever owns the repo.

We are **not** trying to have 100 primitives. The value of the language is its small, composable core.

**If you have a primitive in mind**, please open an issue first with:

- What the primitive is and what visual job it does.
- Why it can't be expressed as a composition of existing primitives.
- A sketch of the proposed syntax (positional args, attributes, allowed children).
- A real use case — ideally a layout you tried to express without the new primitive and couldn't.

We'll discuss. If we decide to take it, we'll help scope it and you can contribute the implementation. If we don't, we'll explain why — often the answer is "do it with composition" or "we're holding that design space for a future primitive we already have plans for."

This isn't gatekeeping for the sake of it; it's how the language stays small enough to remember.

---

## Everything else

Bug fixes, documentation improvements, new examples, test coverage, performance work, build-system tweaks — open a PR directly. No issue required. Keep the change focused and the commit message descriptive; our commit-log style is a short imperative subject followed by a bulleted body (see `git log`).

For non-trivial changes or anything you're unsure about, an issue first is always welcome.

## Code style

- TypeScript, strict mode. No `any` without a comment explaining why.
- Functional style where practical. Classes are used sparsely (the parser has one; most code is plain functions).
- Tests live in `test/` mirroring the `src/` structure. Snapshot fixtures live in `test/**/fixtures/`.
- Commit messages: short imperative subject, bulleted body for anything non-trivial. No emoji.

## Thanks

Every icon, theme, example, and bug report shapes the language a little. If you're reading this and thinking about contributing — please do.
