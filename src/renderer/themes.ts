/**
 * Theme definitions for the Wireloom SVG renderer.
 *
 * A theme bundles colors, strokes, typography, and spacing into a single
 * object consumed by the layout engine and SVG emitter.
 */

export interface Theme {
  name: string;

  // Colors
  background: string;
  textColor: string;
  mutedTextColor: string;
  placeholderColor: string;
  windowBorderColor: string;
  panelBorderColor: string;
  sectionTitleColor: string;
  dividerColor: string;
  chromeLineColor: string;
  buttonBorderColor: string;
  buttonFill: string;
  buttonText: string;
  primaryButtonFill: string;
  primaryButtonText: string;
  disabledColor: string;
  tabActiveColor: string;
  tabInactiveColor: string;
  tabUnderlineColor: string;
  slotBorderColor: string;
  slotActiveBorderColor: string;
  slotFillColor: string;
  badgeFill: string;
  badgeText: string;
  sliderTrackColor: string;
  sliderFillColor: string;
  sliderThumbColor: string;
  comboChevronColor: string;
  bulletColor: string;
  iconStrokeColor: string;

  // Borders and strokes
  windowStrokeWidth: number;
  panelStrokeWidth: number;
  panelStrokeDasharray: string;
  chromeStrokeWidth: number;
  dividerStrokeWidth: number;
  buttonStrokeWidth: number;
  inputStrokeWidth: number;
  slotStrokeWidth: number;
  slotActiveStrokeWidth: number;

  // Typography
  fontFamily: string;
  fontSize: number;
  titleFontSize: number;
  sectionTitleFontSize: number;
  smallFontSize: number;
  largeFontSize: number;
  badgeFontSize: number;
  lineHeight: number;
  averageCharWidth: number;

  // Spacing
  windowPadding: number;
  titleBarHeight: number;
  panelPadding: number;
  headerPaddingY: number;
  footerPaddingY: number;
  sectionTitleHeight: number;
  sectionTitlePaddingBottom: number;
  slotPadding: number;
  slotTitleHeight: number;
  rowGap: number;
  colGap: number;
  listGap: number;
  dividerHeight: number;

  // Controls
  buttonHeight: number;
  buttonPaddingX: number;
  inputHeight: number;
  inputPaddingX: number;
  inputMinWidth: number;
  comboHeight: number;
  comboChevronWidth: number;
  comboMinWidth: number;
  sliderHeight: number;
  sliderTrackHeight: number;
  sliderThumbRadius: number;
  sliderDefaultWidth: number;
  imageDefaultWidth: number;
  imageDefaultHeight: number;
  iconSize: number;
  tabHeight: number;
  tabPaddingX: number;
  tabGap: number;
  bulletWidth: number;
  badgeHeight: number;
  badgePaddingX: number;
  kvMinWidth: number;
  colFillMinWidth: number;
}

export const DEFAULT_THEME: Theme = Object.freeze({
  name: 'default',

  background: '#ffffff',
  textColor: '#2d2d2d',
  mutedTextColor: '#7a7f87',
  placeholderColor: '#9aa0a6',
  windowBorderColor: '#505050',
  panelBorderColor: '#8a8a8a',
  sectionTitleColor: '#6b7078',
  dividerColor: '#c4c4c4',
  chromeLineColor: '#b0b0b0',
  buttonBorderColor: '#505050',
  buttonFill: '#ffffff',
  buttonText: '#2d2d2d',
  primaryButtonFill: '#3a3a3a',
  primaryButtonText: '#ffffff',
  disabledColor: '#b8b8b8',
  tabActiveColor: '#2d2d2d',
  tabInactiveColor: '#8a8f97',
  tabUnderlineColor: '#3a3a3a',
  slotBorderColor: '#b5b8bd',
  slotActiveBorderColor: '#3a3a3a',
  slotFillColor: '#fafbfc',
  badgeFill: '#eef0f3',
  badgeText: '#505560',
  sliderTrackColor: '#dde0e4',
  sliderFillColor: '#6b7078',
  sliderThumbColor: '#3a3a3a',
  comboChevronColor: '#6b7078',
  bulletColor: '#8a8f97',
  iconStrokeColor: '#6b7078',

  windowStrokeWidth: 1.25,
  panelStrokeWidth: 1,
  panelStrokeDasharray: '4 3',
  chromeStrokeWidth: 1,
  dividerStrokeWidth: 1,
  buttonStrokeWidth: 1.25,
  inputStrokeWidth: 1,
  slotStrokeWidth: 1,
  slotActiveStrokeWidth: 1.5,

  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 14,
  titleFontSize: 16,
  sectionTitleFontSize: 11,
  smallFontSize: 12,
  largeFontSize: 18,
  badgeFontSize: 11,
  lineHeight: 20,
  averageCharWidth: 7.2,

  windowPadding: 16,
  titleBarHeight: 36,
  panelPadding: 12,
  headerPaddingY: 10,
  footerPaddingY: 10,
  sectionTitleHeight: 22,
  sectionTitlePaddingBottom: 8,
  slotPadding: 10,
  slotTitleHeight: 22,
  rowGap: 8,
  colGap: 8,
  listGap: 6,
  dividerHeight: 12,

  buttonHeight: 32,
  buttonPaddingX: 16,
  inputHeight: 32,
  inputPaddingX: 12,
  inputMinWidth: 220,
  comboHeight: 32,
  comboChevronWidth: 24,
  comboMinWidth: 180,
  sliderHeight: 28,
  sliderTrackHeight: 4,
  sliderThumbRadius: 7,
  sliderDefaultWidth: 220,
  imageDefaultWidth: 120,
  imageDefaultHeight: 80,
  iconSize: 24,
  tabHeight: 36,
  tabPaddingX: 14,
  tabGap: 2,
  bulletWidth: 16,
  badgeHeight: 18,
  badgePaddingX: 8,
  kvMinWidth: 200,
  colFillMinWidth: 220,
}) as Theme;

export const DARK_THEME: Theme = Object.freeze({
  ...DEFAULT_THEME,
  name: 'dark',
  background: '#1e1e1e',
  textColor: '#e0e0e0',
  mutedTextColor: '#8a9099',
  placeholderColor: '#6b7075',
  windowBorderColor: '#8a8a8a',
  panelBorderColor: '#6b6b6b',
  sectionTitleColor: '#8a9099',
  dividerColor: '#404040',
  chromeLineColor: '#555555',
  buttonBorderColor: '#b0b0b0',
  buttonFill: '#2a2a2a',
  buttonText: '#e0e0e0',
  primaryButtonFill: '#d4d4d4',
  primaryButtonText: '#1e1e1e',
  disabledColor: '#5a5a5a',
  tabActiveColor: '#f0f0f0',
  tabInactiveColor: '#707780',
  tabUnderlineColor: '#d4d4d4',
  slotBorderColor: '#555a62',
  slotActiveBorderColor: '#d4d4d4',
  slotFillColor: '#252525',
  badgeFill: '#353a42',
  badgeText: '#b8bcc4',
  sliderTrackColor: '#404040',
  sliderFillColor: '#a0a4ac',
  sliderThumbColor: '#d4d4d4',
  comboChevronColor: '#8a9099',
  bulletColor: '#707780',
  iconStrokeColor: '#8a9099',
}) as Theme;

export function getTheme(name: 'default' | 'dark'): Theme {
  return name === 'dark' ? DARK_THEME : DEFAULT_THEME;
}
