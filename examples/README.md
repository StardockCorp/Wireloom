# Wireloom Example Corpus

Twenty example files covering every primitive in v0.2. Each is parser-snapshot-tested and renders to a golden SVG under `test/renderer/fixtures/`.

## v0.1 thin-slice examples

Focus: the original ten primitives (`window`, `header`, `footer`, `panel`, `row`, `col`, `text`, `button`, `input`, `divider`).

| File | What it exercises |
|------|-------------------|
| `01-minimal.wireloom` | The simplest possible wireframe — `window` + `text`. |
| `02-login-form.wireloom` | Header band, panel with inputs, primary button, footer text. |
| `03-settings-dialog.wireloom` | Two panels with rows of label + input controls. |
| `04-two-column.wireloom` | `row` with a fixed-width col and a bare col. |
| `05-nested-panels.wireloom` | Three levels of panel nesting. |
| `06-footer-actions.wireloom` | Footer with a pair of buttons. |
| `07-button-variants.wireloom` | `primary`, `disabled`, and combined button flags. |
| `08-input-placeholder.wireloom` | `placeholder=` and `type=` attributes on `input`. |
| `09-dividers.wireloom` | `divider` between text groups. |
| `10-whitespace-edges.wireloom` | Blank lines, comments, and inline comments. |

## v0.2 additions

Focus: the new primitives (`section`, `tabs`, `list`, `slot`, `kv`, `combo`, `slider`, `image`, `icon`), typography attributes, badges, `row align`, and fill columns.

| File | What it exercises |
|------|-------------------|
| `11-colonial-charter.wireloom` | Real-world stress test. Entire v0.2 primitive set in one file. |
| `12-tabs.wireloom` | `tabs` bar with `active` and `badge="…"`. |
| `13-sections.wireloom` | `section "Title":` with optional `badge="…"`. |
| `14-kv-rows.wireloom` | Ledger-style column of `kv` rows + typography flags on totals. |
| `15-list-and-slot.wireloom` | `list` of `slot`s for policy cards + `list` of `item`s. |
| `16-media.wireloom` | `image` and `icon` placeholders in a profile screen. |
| `17-controls.wireloom` | `combo` and `slider` inside a settings panel. |
| `18-typography.wireloom` | Bold / italic / muted / weight / size combos on text and kv. |
| `19-fill-columns.wireloom` | Three-column app shell with a fill middle column. |
| `20-right-aligned-row.wireloom` | Confirm dialog with `row align=right` footer. |

## Targets

`examples/targets/*.txt` contains hand-drawn ASCII visual contracts for the layouts that aren't obvious from source alone (tabs, sections with badges, kv ledgers, fill columns). The renderer output is expected to capture the structure these describe.
