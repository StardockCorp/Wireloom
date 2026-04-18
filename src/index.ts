/**
 * Wireloom — UI wireframe mockups from a Markdown-embedded DSL,
 * rendered as inline SVG.
 *
 * Public API (three calls, matching the well-established text-diagram-library
 * shape):
 *
 *   import wireloom from 'wireloom';
 *   wireloom.initialize({ theme: 'default' });
 *   const ast = wireloom.parse(source);
 *   const { svg } = await wireloom.render('id', source);
 *
 * The parser and renderer are currently stubs. Real implementations land in
 * the parser and renderer todos.
 */

import { mergeConfig, type WireloomConfig } from './config.js';
import type { Document } from './parser/ast.js';
import { parse as parseSource } from './parser/parser.js';
import { renderWireframe } from './renderer/index.js';

export type { WireloomConfig, WireloomTheme, WireloomSecurityLevel } from './config.js';
export type * from './parser/ast.js';
export { WireloomError } from './parser/errors.js';
export { DEFAULT_THEME, DARK_THEME, type Theme } from './renderer/themes.js';

export interface RenderResult {
  svg: string;
}

/**
 * Merges a partial configuration into the global Wireloom config.
 * Theme, security level, and future global options are set here.
 */
export function initialize(config: Partial<WireloomConfig>): void {
  mergeConfig(config);
}

/**
 * Parses a Wireloom source string into an AST.
 * Throws {@link WireloomError} with line/column info on parse failure.
 */
export function parse(source: string): Document {
  return parseSource(source);
}

/**
 * Parses and renders a Wireloom source string to an SVG string.
 * Throws {@link WireloomError} with line/column info on parse failure.
 */
export async function render(id: string, source: string): Promise<RenderResult> {
  const svg = renderWireframe(source, { id });
  return { svg };
}

const wireloom = { initialize, parse, render };
export default wireloom;
