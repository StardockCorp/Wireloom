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
import { serialize as serializeDoc } from './parser/serializer.js';
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
 * Serializes a parsed {@link Document} back to canonical Wireloom source.
 * Useful for formatting, tooling, and roundtrip verification. Comments and
 * non-canonical whitespace in the original source are not preserved; the
 * re-parsed AST of the serialized output equals the input AST.
 */
export function serialize(doc: Document): string {
  return serializeDoc(doc);
}

export interface RenderOptions {
  /** Override the theme for this render without touching the global config. */
  theme?: 'default' | 'dark';
}

/**
 * Parses and renders a Wireloom source string to an SVG string.
 * Throws {@link WireloomError} with line/column info on parse failure.
 * If `options.theme` is omitted the global theme from `initialize()` is used.
 */
export async function render(
  id: string,
  source: string,
  options?: RenderOptions,
): Promise<RenderResult> {
  const rwOpts: { id: string; theme?: 'default' | 'dark' } = { id };
  if (options?.theme !== undefined) rwOpts.theme = options.theme;
  const svg = renderWireframe(source, rwOpts);
  return { svg };
}

const wireloom = { initialize, parse, render };
export default wireloom;
