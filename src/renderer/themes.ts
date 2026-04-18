/**
 * Theme definitions for the Wireloom SVG renderer.
 *
 * A theme bundles colors, strokes, typography, and spacing into a single
 * object consumed by the layout engine and SVG emitter. v0.1 ships with
 * `default` only; `dark` is declared as a structural placeholder and will
 * ship real values in a later todo.
 */

export interface Theme {
  name: string;

  // Colors
  background: string;
  textColor: string;
  placeholderColor: string;
  windowBorderColor: string;
  panelBorderColor: string;
  dividerColor: string;
  chromeLineColor: string;
  buttonBorderColor: string;
  buttonFill: string;
  buttonText: string;
  primaryButtonFill: string;
  primaryButtonText: string;
  disabledColor: string;

  // Borders and strokes
  windowStrokeWidth: number;
  panelStrokeWidth: number;
  panelStrokeDasharray: string;
  chromeStrokeWidth: number;
  dividerStrokeWidth: number;
  buttonStrokeWidth: number;
  inputStrokeWidth: number;

  // Typography
  fontFamily: string;
  fontSize: number;
  titleFontSize: number;
  lineHeight: number;
  averageCharWidth: number;

  // Spacing
  windowPadding: number;
  titleBarHeight: number;
  panelPadding: number;
  headerPaddingY: number;
  footerPaddingY: number;
  rowGap: number;
  colGap: number;
  dividerHeight: number;

  // Controls
  buttonHeight: number;
  buttonPaddingX: number;
  inputHeight: number;
  inputPaddingX: number;
  inputMinWidth: number;
}

export const DEFAULT_THEME: Theme = Object.freeze({
  name: 'default',

  background: '#ffffff',
  textColor: '#2d2d2d',
  placeholderColor: '#9aa0a6',
  windowBorderColor: '#505050',
  panelBorderColor: '#8a8a8a',
  dividerColor: '#c4c4c4',
  chromeLineColor: '#b0b0b0',
  buttonBorderColor: '#505050',
  buttonFill: '#ffffff',
  buttonText: '#2d2d2d',
  primaryButtonFill: '#3a3a3a',
  primaryButtonText: '#ffffff',
  disabledColor: '#b8b8b8',

  windowStrokeWidth: 1.25,
  panelStrokeWidth: 1,
  panelStrokeDasharray: '4 3',
  chromeStrokeWidth: 1,
  dividerStrokeWidth: 1,
  buttonStrokeWidth: 1.25,
  inputStrokeWidth: 1,

  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 14,
  titleFontSize: 16,
  lineHeight: 20,
  averageCharWidth: 7.2,

  windowPadding: 16,
  titleBarHeight: 36,
  panelPadding: 12,
  headerPaddingY: 10,
  footerPaddingY: 10,
  rowGap: 8,
  colGap: 8,
  dividerHeight: 12,

  buttonHeight: 32,
  buttonPaddingX: 16,
  inputHeight: 32,
  inputPaddingX: 12,
  inputMinWidth: 220,
}) as Theme;

export const DARK_THEME: Theme = Object.freeze({
  ...DEFAULT_THEME,
  name: 'dark',
  background: '#1e1e1e',
  textColor: '#e0e0e0',
  placeholderColor: '#6b7075',
  windowBorderColor: '#8a8a8a',
  panelBorderColor: '#6b6b6b',
  dividerColor: '#404040',
  chromeLineColor: '#555555',
  buttonBorderColor: '#b0b0b0',
  buttonFill: '#2a2a2a',
  buttonText: '#e0e0e0',
  primaryButtonFill: '#d4d4d4',
  primaryButtonText: '#1e1e1e',
  disabledColor: '#5a5a5a',
}) as Theme;

export function getTheme(name: 'default' | 'dark'): Theme {
  return name === 'dark' ? DARK_THEME : DEFAULT_THEME;
}
