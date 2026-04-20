# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] — 2026-04-19

### Added
- **Universal `id="…"` attribute** — any primitive may now carry an author-supplied id, used as a target for annotations. Ids are not checked for uniqueness; the layout engine uses the first match.
- **`annotation` primitive** — user-manual-style label with a leader line pointing at an element in the window. Lives as a sibling of `window` (not a child), since annotations are *about* the mockup. Usage:
  ```
  window "Sign in":
    panel:
      button "Sign in" primary id="signin-btn"

  annotation "Primary action — disabled until both fields valid" target="signin-btn" position=right
  ```
  Required: positional body string, `target="<id>"`, `position=left|right|top|bottom`. There is no position default — authors must place annotations deliberately. Annotations whose target id can't be resolved are silently dropped.
- Theme tokens for annotations: `annotationBg`, `annotationBorder`, `annotationText`, `annotationLineColor`, `annotationDotColor`, `annotationStrokeWidth`, `annotationDotRadius`, `annotationCornerRadius`, `annotationPaddingX`, `annotationPaddingY`, `annotationGap`, `annotationMargin`, `annotationStackGap`.
- `examples/27-annotations.wireloom` demonstrates the full feature.

### Changed
- Internal: `layout()` now accepts a `Document` and returns a `LaidDocument` (canvas dimensions + laid root + laid annotations). Consumers that reach into `renderer/layout.ts` directly will need to update; the public `render()` / `renderWireframe()` APIs are unchanged.

## [0.4.0] — 2026-04-19

Wider primitive set aimed at game-UI wireframes — grids, state-aware cells and slots, resource bars, progress bars, chart placeholders, inline stats, and a real named icon library. Driven by the GC4 F&E government-screen mockup work; every addition came out of a concrete gap hit while building those layouts.

### Added
- **`grid` / `cell`**: fixed rows×cols grid with addressable cells. Usage:
  ```
  grid cols=5 rows=5:
    cell "Compute I" state=purchased accent=research
    cell "Compute II" state=available accent=research row=1 col=2
  ```
  Cells can carry an optional positional label string, `row=N col=M` explicit placement (1-indexed), and `state=` / `accent=`. Without explicit placement, cells auto-flow L→R, T→B, skipping positions already claimed by explicit cells.
- **Unified `state=` enum** on `slot` and `cell`: `locked | available | active | purchased | maxed | growing | ripe | withering | cashed`. Each state maps to a distinct border / fill / text treatment; `locked`, `purchased`, `ripe`, and `maxed` also paint a corner badge glyph (lock / check / star). The pre-existing `active` flag on slots still works as a back-compat alias.
- **`progress`**: horizontal bar with `value=`, `max=`, optional `label=` and `accent=`. Renders as a rounded track with a filled portion and an inline "value / max" readout when labeled.
- **`chart kind=bar|line|pie`**: placeholder chart primitive — renders a dashed-border card with a stylized glyph (bars, line segments, wedge). No data binding by design; this is for "imagine a chart here" in mockups, not a real charting library. Supports `label=`, `width=`, `height=`, `accent=`.
- **`resourcebar` / `resource`**: horizontal resource strip for game-UI headers. `resource name="…" value="…"` children render as icon + `Name: value` pairs. Icon is inferred from the resource name (Credits → `credits`, Research → `research`, …) and can be overridden with `icon=`.
- **`stats` / `stat`**: terse inline strip of `LABEL value` pairs. `stats:` with `stat "INT" "4"` / `stat "LOY" "75" bold` children replaces the verbose `row:` of `kv` rows used for leader stat strips.
- **`slot footer`**: optional `footer:` block as the last child of a `slot`. Renders as a right-aligned action row below the slot's main content. Unlike the top-level window footer, only one per slot and must be the last child.
- **Semantic `accent=` attribute** on `slot`, `section`, `cell`, `button`, and `icon`: `research | military | industry | wealth | approval | warning | danger | success`. Each accent maps to a themed color (light and dark themes have distinct palettes) and is applied to borders, badges, and text as appropriate for the primitive.
- **Named icon library**: `icon name="…"` now renders actual SVG glyphs for a baked set of game-UI concepts — `credits`, `research`, `military`, `industry`, `influence`, `approval`, `faith`, `authority`, `computation`, `tech`, `policy`, `ship`, `planet`, `leader`, `gear`, `warning`, `lock`, `check`, `star`, `plus`, `minus`. Unknown names fall back to the previous boxed-first-letter placeholder, so v0.3 sources render unchanged.
- **Theme surface**: new `Theme.accents` and `Theme.states` maps expose the accent palette and state styles, and can be overridden per theme. Both default and dark themes ship fully populated.

### Changed
- `Theme` interface gained several v0.4 tokens: `cellMinSize`, `cellPadding`, `resourceBarHeight`, `resourceBarItemGap`, `resourceBarIconSize`, `statsGap`, `progressDefaultWidth`, `progressMaxWidth`, `progressHeight`, `chartDefaultWidth`, `chartDefaultHeight`, `accents`, `states`. Custom themes built against the v0.3 interface will need to provide these.
- `icon` primitive now renders real glyphs for known names instead of a boxed first letter. Sources that used unknown icon names still fall through to the v0.3 placeholder.

### Tests
- **198 tests passing** (up from 160). New coverage: grid/cell parse and layout, state enum, resourcebar, stats, progress, chart placeholders, slot footer ordering rules, accent enum.
- Six new example files exercising the v0.4 primitives (Technocracy Optimization Matrix, GC4 resource strip, research dashboard with charts, leader stat strip, Oligarchy investment cards with footers, named icon catalog). All roundtrip cleanly.

## [0.3.0] — 2026-04-18

First public npm release. Rolls up the v0.2 primitive set plus error-DX improvements aimed at making the grammar friendlier for AI staff and hand-writers. No breaking changes for sources that were valid under v0.2 as documented.

### Added
- **Flexible indentation**: files can use either 2-space or 4-space indentation. The unit is detected from the first indented line and locked for the rest of the file. Mixing units within a single file is a parse error.
- **"Did you mean?" suggestions** on error messages for typos in primitive names, attribute keys, bare flags, and enum values (weight, size, align, type). Uses Levenshtein distance with a conservative threshold so wildly-off inputs don't produce noisy suggestions.
- **`kv` single-string hint**: writing `kv "Label=Value"` (one combined string with an embedded separator) emits a targeted hint suggesting the split, e.g., `kv "Label" "Value"`.
- `serialize` is now reachable on the default export (`wireloom.serialize(doc)`), matching the README.

### Changed
- `col` positional width is now strictly a pixel number or `fill` — matching the documented grammar. `col 50%:` and `col 1fr:`, which previously parsed but didn't round-trip correctly, now emit a clear parse error. Fluid sizing is expressed with `col fill:` (or bare `col:`), which distributes remaining horizontal space in the enclosing row.
- Public `ColWidth` type narrowed to `unit: 'px'` so hand-built ASTs can't construct percent/fr column widths the serializer would silently discard.

### Fixed
- Tab-in-indentation error message now says "use 2 or 4 spaces" instead of "use 2 spaces".

### Tests
- **160 tests passing** (up from 146). New tests cover 2- vs 4-space detection, unit-locking, did-you-mean suggestions across four error paths, the kv hint, and the `col` positional-width tightening.

## [0.2.0] — Unreleased

Full v1 primitive set, controls, and typography. This is the release planned to go out as the first public npm publish.

### Added
- **Structural primitives**: `section`, `tabs` + `tab`, `list` + `item`, `slot`.
- **Data primitives**: `kv` (label + right-aligned value row).
- **Media primitives**: `image`, `icon` (sketch placeholders).
- **Controls**: `combo` (dropdown) and `slider` (track + thumb).
- **Typography attributes** on `text` and `kv`: `bold`, `italic`, `muted` flags; explicit `weight=light|regular|semibold|bold` and `size=small|regular|large`.
- **Badge attribute** `badge="…"` on `tab`, `section`, and `button` — renders a counter pill next to the label.
- **Row alignment** `align=left|center|right` on `row` when no fill columns are present.
- **Column fill sizing**: `col fill:` or bare `col:` distributes row slack proportionally. Multi-fill rows split equally.
- **Dark theme**: every primitive renders legibly under the `dark` theme; WCAG AA contrast verified for body text, tabs, buttons, badges, and controls.
- **Per-render theme override**: `render(id, source, { theme: 'dark' })`.
- **AST serializer**: `serialize(doc) → string` — canonical source output usable as a formatter and for tooling.
- **Range literal**: `range=N-M` attribute value (used by `slider`).

### Changed
- **Behavior change**: bare `col:` (no width) now defaults to `fill` instead of intrinsic-hug content. v0.1 sources with bare cols render with proportional widths instead of content-hugging.
- **Attribute rule system**: parser upgraded to enum-aware validation. Invalid enum values (e.g., unknown `weight`, `size`, `align`) produce errors listing the allowed values.

### Fixed
- Sections, slots, and tabs size their parent container correctly when they carry wide badges.

### Tests
- **146 tests passing** across lexer, parser, errors, layout, renderer, themes, roundtrip idempotence, and render performance.
- Roundtrip tests confirm `source → AST → source → AST` equals for every example file.
- Performance sanity: Colonial Charter renders in <50 ms warm.

## [0.1.0] — 2026-04-18

First end-to-end working build.

### Added
- Thin-slice primitives: `window`, `header`, `footer`, `panel`, `row`, `col`, `text`, `button`, `input`, `divider`.
- Indentation-based grammar with formal EBNF spec.
- Hand-rolled lexer + recursive-descent parser with line/column error messages.
- Layout engine (bottom-up measure, top-down position) and SVG emitter.
- Default and dark theme scaffolding.
- Clairvoyance integration — `wireloom` fenced blocks render in chat, notes, and the CodeMirror editor.
- Golden-snapshot parser and renderer tests.

## [0.0.1] — 2026-04-18

Initial scaffold. Package exists, API surface declared, stub implementations.
