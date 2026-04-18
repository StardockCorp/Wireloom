# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
