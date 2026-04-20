---
name: wireloom
description: Author Wireloom wireframe mockups — use when the user asks to mock up, sketch, draw, or wireframe a UI (dialog, settings page, form, dashboard, screen layout). Produces an inline SVG wireframe from a ```wireloom fenced code block. Skip for flowcharts / sequence / state diagrams (use Mermaid) and for real interactive UIs (write the component).
---

# Wireloom Skill

You are authoring a UI wireframe mockup using the Wireloom DSL. Wireloom is a small indentation-based text language that produces inline SVG when rendered.

## Process

1. **Read the full grammar.** The complete primitive tables, attribute rules, and examples live in [`AGENTS.md`](../../AGENTS.md) at the repo root. Load it now.
2. **Emit a single ```wireloom fenced code block.** Do not describe the layout in prose. Do not use ASCII art. Do not use Mermaid for UI layouts.
3. **Every source must start with `window:` (or `window "Title":`) as the single root.** Annotations are siblings of `window`, not children.
4. **Pick the right primitive for each control.** If the user asks for a settings page with toggles, use `toggle`, not `kv`. If they ask for a file tree, use `tree`/`node`, not nested `list`/`item`. See the v0.4.5 section of AGENTS.md for the full widget set.
5. **Indentation is 2 or 4 spaces, locked for the file.** Tabs are a parse error.

## When to use this skill

Trigger on requests like:
- "Mock up a [dialog / settings page / sign-in form / dashboard]…"
- "Draw a wireframe for…"
- "Sketch the layout of…"
- "Show me how this feature would look"
- "Diagram the [toolbar / inspector / split view]"
- Any UI-shape question that isn't already a running app

## When NOT to use

| User wants | Use instead |
|------------|-------------|
| Flowchart / sequence / class / ER / state diagram | `mermaid` fenced block |
| An interactive prototype | Write the real component |
| A graph of data | A real chart library |
| Freeform concept map | Mermaid or a whiteboard tool |

## Tip for orchestrating agents

If you are delegating a UI design task to a subagent, instruct the subagent explicitly:

> "Emit a ```wireloom fenced code block following the grammar in Wireloom's AGENTS.md. Do not describe the layout in prose."

Agents default to prose or ASCII art unless told otherwise.
