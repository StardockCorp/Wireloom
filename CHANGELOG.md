# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] — 2026-04-21

Small follow-up to v0.50's mobile-nav release. Authors kept pairing `navbar:` with `header:` to express a centered title alongside leading/trailing actions — the canonical iOS detail-view shape — but the two are mutually exclusive, so the source wouldn't parse. The root cause was that `navbar` had no slot for a centered cluster. This release adds one.

### Added
- **`navbar` gains an optional `center:` slot** alongside `leading:` and `trailing:`. Accepts the same row-legal children as the other two. Renders horizontally centered within the navbar's inner band, regardless of the width of the leading/trailing clusters. At most one `center:` per navbar. Existing v0.50 sources render byte-identical.
- **`input type=search`** accepted as a valid input type. Renders identically to `type=text` for now; the value exists so mobile search-field mockups stop getting rejected by the parser (`AGENTS.md` already documented `type=search`, so this also closes a docs/parser-drift bug). Reserved for a future magnifier-icon affordance without a grammar change.

### Changed
- `navbar` parse errors updated to mention all three slots. The "missing children" error now reads `"navbar" requires "leading:", "center:", and/or "trailing:" sub-blocks`; the "wrong child kind" error reads `"navbar" accepts only "leading:", "center:", or "trailing:" children`.
- README detail-view example now uses `navbar` with a `center:` title instead of pairing `navbar:` with `header large:` (which was a documentation bug — the two chrome bands are mutually exclusive).

## [0.5.0] — 2026-04-20

Mobile-navigation primitives. The release centers on the shapes mobile mockups
need constantly but Wireloom had no real answer for: anchor items on opposite
ends of a row, model a back/action top bar, model a bottom tab bar, overlay a
modal sheet, filter content with a segmented control, and signal "tap pushes
to detail" on list rows. Every v0.4.5 source still parses and renders
identically.

### Added
- **`spacer`**: leaf flex-gap primitive. Legal only directly inside `row`. Consumes horizontal slack so siblings anchor to opposite ends. Replaces the old "stack two rows" workaround for Cancel/Done style footers.
- **`row justify=start|between|around|end`**: distributes children along the main axis. `start` is the default. If a `spacer` child is present it wins over `justify`; a `fill` col still wins over both. Unknown `justify=` values produce a parse error listing the valid set.
- **`navbar`** with required `leading:` / `trailing:` sub-blocks (at least one of the two). Direct child of `window` only. Each slot accepts row-legal children (`button`, `backbutton`, `text`, `icon`, `chip`, `image`, etc.). Renders as a chrome band with leading items anchored left, trailing items anchored right.
- **`tabbar` / `tabitem`**: bottom chrome band for primary mobile navigation. `tabbar` is a direct child of `window` and accepts only `tabitem` children. `tabitem "Label"` accepts `icon="<name>"` and `badge="…"` attributes plus `selected` and `disabled` flags. `tabitem` renders as icon above label, evenly distributed across the window width.
- **`backbutton "Parent"`**: leaf primitive rendered as a path-drawn chevron plus parent label. Legal anywhere a `button` is (inside `row`, `navbar` slots, `panel`, `section` content, slot `footer:`). Supports the `disabled` flag.
- **`header large`**: bare flag that turns the header into a tall large-title band (the iOS Notes/Mail/Settings list-root style). With `large`, the header's `text` child is forced bold at large size regardless of typography attrs on it. An empty `header large:` is legal (renders an empty large-title band).
- **`chevron` flag on `slot` and `item`**: adds a trailing right-chevron glyph to the row to signal "tap for detail". Rendered as an SVG `<path>`, muted color. Unflagged rows render byte-identical to v0.4.5.
- **`sheet`**: modal overlay. Direct child of `window`, at most one per window. Defaults to a bottom sheet (scrim, rounded top corners, grabber pill, anchored to window bottom). `position=center` renders a centered floating modal instead. Optional `title="…"` renders bold and centered below the grabber. Body accepts any window-legal content.
- **`segmented` / `segment`**: rounded-pill segmented control for mutually-exclusive content filters. Visually distinct from `tabs` by design (inline pill vs full-width underlined bar). `segmented` accepts only `segment` children. `segment "Label"` supports `selected` and `disabled` flags.
- Three new example files exercising v0.50 primitives: `31-spacer-and-justify.wireloom`, `32-navbar.wireloom`, and the backbutton/large-header, tabbar, chevron, sheet, and segmented examples across the feature worktrees.

### Changed
- **`header` + `navbar` are mutually exclusive in the same window.** Using both produces a parse error pointing at whichever appeared second. They share the chrome-band role, so picking one is a deliberate design choice rather than a warning.
- **`tabbar` + `footer` are mutually exclusive in the same window.** Same reasoning: both occupy the bottom chrome band. Parse error if both present.
- Empty-container parse error now suggests `spacer` first when the enclosing primitive is a `row`.
- Chevron glyphs (disclosure on `slot`/`item`, parent glyph on `backbutton`, the right-chevron in `breadcrumb` separators) are drawn as `<path>` elements, not unicode characters, so rendering is consistent across browsers with no font substitution.
- `segmented` emits a `console.warn` (not a parse error) when authored with zero or one `segment`. Rationale: during authoring an author might type `segmented:` and add segments incrementally, and a hard fail on the partial state would be hostile. The warning includes the line number and a "at least 2 segments recommended" hint.
- `Theme` interface gained v0.50 tokens for every new primitive (sheet scrim/background/corner/grabber/title, segmented pill/divider/selected-fill, chevron glyph size/gutter/stroke/color, large-header height/padding, navbar/tabbar chrome metrics, spacer precedence). Both default and dark themes ship fully populated.

### Tests
- Test count passes through all sprint branches. Final aggregate of new tests across the sprint: +74 tests (spacer/justify, navbar, tabbar/tabitem, backbutton + `header large`, chevron flag, sheet, segmented/segment). All prior tests still pass; v0.4.5 golden snapshots render byte-identical where the new features are not used.
- New parser tests cover: `spacer` legal-location rule, `justify=` enum validation, navbar slot enforcement, navbar+header conflict, leading/trailing scoping, tabbar+footer conflict, tabbar child enforcement, tabitem placement rule, `header large` flag, `chevron` flag on slot and item, sheet `position=` enum and at-most-one-per-window, segmented single-selected and non-segment-child rules, segmented zero/one warning, all corpus roundtrip idempotency.
- New renderer tests cover: spacer slack distribution, justify precedence vs spacer vs align, navbar anchoring and empty-slot cases, tabitem icon+label stacking with unknown-icon fallback, backbutton path-drawn chevron, `header large` metric differences, chevron gutter reservation with state badge coexistence, sheet scrim and bottom vs center geometry, segmented equal-width fills with divider suppression adjacent to the selected segment, dark-theme parity for every addition.

## [0.4.5] — 2026-04-20

Widgets HTML doesn't have, at wireframe fidelity. This release adds the primitives
that LLM authors keep reaching for and simulating with `panel` + `kv` rows: file
trees, menubars, form controls, chips, avatars, breadcrumbs, and inline status.
No breaking changes — existing sources parse and render identically.

### Added
- **`tree` / `node`**: collapsible tree with recursive nodes. Disclosure glyphs render automatically (▾ expanded, ▸ collapsed); leaf nodes get no glyph. Flags: `collapsed`, `selected`. Attribute: `icon=` (reuses the named icon library).
  ```
  tree:
    node "src":
      node "parser.ts"
      node "renderer" collapsed:
        node "svg.ts"
    node "README.md" selected
  ```
- **`checkbox` / `radio` / `toggle`**: three separate row-level form primitives. `checkbox "Enable" checked`, `radio "Dark" group="theme" selected`, `toggle "Sync" on`. `group=` on `radio` affects visual layout only — no validation semantics. Shared flags: `disabled`, `label-right` (flips control/label placement).
- **`menubar` / `menu` / `menuitem` / `separator`**: horizontal menubar with dropdown children. `menuitem` accepts `shortcut="Ctrl+O"` and `disabled`. `separator` renders a thin divider inside a menu. `menu` may also appear standalone (context/popup menu). **`menuitem` is its own token — `item` is reserved for `list` children.**
- **`chip`**: standalone pill for filter rows, tag lists, and selected-item displays. Attributes: `accent=`, `icon=`. Flags: `closable` (renders × glyph), `selected`. Distinct from the `badge=` attribute (which attaches to section headers / buttons).
- **`avatar`**: circle with initials. Positional string is the initials (max 2 chars rendered). Attributes: `size=small|medium|large` (default medium), `accent=` for tint. No image slot by design — wireframes shouldn't care about real imagery.
- **`breadcrumb` / `crumb`**: horizontal path with auto-inserted chevron (›) separators. Last crumb renders bolder as the "current" location. Optional `icon=` on any crumb.
- **`spinner` / `status`**: static indicators. `spinner` renders a dashed ring and takes an optional positional label. `status "Saved" kind=success` renders a pill with an icon matching `kind` — one of `success | info | warning | error`.

### Changed
- `Theme` interface gained v0.4.5 tokens for every new primitive (`treeIndent`, `treeRowHeight`, `treeIndentGuideColor`, `treeGlyphColor`, `treeSelectedBg`, `treeSelectedText`, `checkboxSize`, `checkboxRowGap`, `checkboxBorderColor`, `checkboxFillColor`, `checkboxCheckColor`, `radioSize`, `toggleWidth`, `toggleHeight`, `toggleOnColor`, `toggleOffColor`, `toggleKnobColor`, `radioGroupGap`, `menubarHeight`, `menubarItemPaddingX`, `menubarBgColor`, `menubarBorderColor`, `menuWidth`, `menuItemHeight`, `menuItemPaddingX`, `menuBgColor`, `menuBorderColor`, `menuShortcutColor`, `menuSeparatorColor`, `chipHeight`, `chipPaddingX`, `chipBg`, `chipBorder`, `chipText`, `chipSelectedBg`, `chipSelectedBorder`, `chipSelectedText`, `avatarSizeSmall`, `avatarSizeMedium`, `avatarSizeLarge`, `avatarBg`, `avatarBorder`, `avatarText`, `breadcrumbHeight`, `breadcrumbGap`, `breadcrumbSeparatorColor`, `breadcrumbCurrentColor`, `spinnerSize`, `spinnerColor`, `statusHeight`, `statusPaddingX`, `statusColors`). Both default and dark themes ship fully populated.

### Tests
- **253 tests passing** (up from 201 carried into this release). New coverage: parse, roundtrip, and layout for every new primitive, plus SVG contents checks to verify theme palette wiring for tree, chip, toggle, and status.
- Three new example files — `28-file-explorer.wireloom`, `29-settings-controls.wireloom`, `30-status-and-chips.wireloom` — all roundtrip cleanly under the full corpus test.

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
