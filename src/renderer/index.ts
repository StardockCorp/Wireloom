import { parse } from '../parser/parser.js';
import { getTheme, type Theme } from './themes.js';
import { layout } from './layout.js';
import { emitSvg } from './svg.js';
import { getConfig } from '../config.js';

export interface RenderWireframeOptions {
  id?: string;
  theme?: 'default' | 'dark';
}

export function renderWireframe(
  source: string,
  options: RenderWireframeOptions = {},
): string {
  const doc = parse(source);
  if (!doc.root) {
    return emptySvg();
  }
  const themeName = options.theme ?? getConfig().theme;
  const theme: Theme = getTheme(themeName);
  const laid = layout(doc, theme);
  const emitOpts = options.id !== undefined ? { id: options.id } : {};
  return emitSvg(laid, theme, emitOpts);
}

function emptySvg(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>';
}

export { getTheme, DEFAULT_THEME, DARK_THEME, type Theme } from './themes.js';
