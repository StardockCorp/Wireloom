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

export type { WireloomConfig, WireloomTheme, WireloomSecurityLevel } from './config.js';
export type * from './parser/ast.js';

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
 *
 * v0.1 stub: returns an empty {@link Document}. Real parser is implemented
 * in the parser todo and replaces this export.
 */
export function parse(source: string): Document {
  void source;
  return {
    kind: 'document',
    sourceLines: 0,
  };
}

/**
 * Parses and renders a Wireloom source string to an SVG string.
 *
 * v0.1 stub: returns a placeholder SVG. The real renderer lands in the
 * renderer todo, at which point the output will match the visual contract
 * in examples/targets/.
 */
export async function render(id: string, source: string): Promise<RenderResult> {
  void id;
  void source;
  return {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><!-- wireloom stub --></svg>',
  };
}

const wireloom = { initialize, parse, render };
export default wireloom;
