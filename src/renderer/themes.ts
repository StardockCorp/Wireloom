/**
 * Theme definitions for the Wireloom SVG renderer.
 *
 * A theme bundles colors, strokes, typography, and spacing into a single
 * object consumed by the layout engine and SVG emitter.
 */

export type AccentName =
  | 'research'
  | 'military'
  | 'industry'
  | 'wealth'
  | 'approval'
  | 'warning'
  | 'danger'
  | 'success';

export type StateName =
  | 'locked'
  | 'available'
  | 'active'
  | 'purchased'
  | 'maxed'
  | 'growing'
  | 'ripe'
  | 'withering'
  | 'cashed';

/** Rendering style for a cell/slot in a given state. */
export interface StateStyle {
  border: string;
  fill: string;
  text: string;
  /** Optional right-shoulder badge glyph rendered on the node (e.g. 🔒, ✓). */
  badge?: string;
}

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

  // v0.4 additions
  cellMinSize: number;
  cellPadding: number;
  resourceBarHeight: number;
  resourceBarItemGap: number;
  resourceBarIconSize: number;
  statsGap: number;
  progressDefaultWidth: number;
  progressMaxWidth: number;
  progressHeight: number;
  chartDefaultWidth: number;
  chartDefaultHeight: number;

  // v0.4.5 — widget primitives (tree/menubar/breadcrumb/chip/avatar/spinner/status/checkbox/radio/toggle)
  treeIndent: number;
  treeRowHeight: number;
  treeIndentGuideColor: string;
  treeGlyphColor: string;
  treeSelectedBg: string;
  treeSelectedText: string;

  checkboxSize: number;
  checkboxRowGap: number;
  checkboxBorderColor: string;
  checkboxFillColor: string;
  checkboxCheckColor: string;

  radioSize: number;
  toggleWidth: number;
  toggleHeight: number;
  toggleOnColor: string;
  toggleOffColor: string;
  toggleKnobColor: string;
  radioGroupGap: number;

  menubarHeight: number;
  menubarItemPaddingX: number;
  menubarBgColor: string;
  menubarBorderColor: string;
  menuWidth: number;
  menuItemHeight: number;
  menuItemPaddingX: number;
  menuBgColor: string;
  menuBorderColor: string;
  menuShortcutColor: string;
  menuSeparatorColor: string;

  chipHeight: number;
  chipPaddingX: number;
  chipBg: string;
  chipBorder: string;
  chipText: string;
  chipSelectedBg: string;
  chipSelectedBorder: string;
  chipSelectedText: string;

  avatarSizeSmall: number;
  avatarSizeMedium: number;
  avatarSizeLarge: number;
  avatarBg: string;
  avatarBorder: string;
  avatarText: string;

  breadcrumbHeight: number;
  breadcrumbGap: number;
  breadcrumbSeparatorColor: string;
  breadcrumbCurrentColor: string;

  spinnerSize: number;
  spinnerColor: string;

  statusHeight: number;
  statusPaddingX: number;
  /** Per-kind background/text for status pills. Keys: success|info|warning|error. */
  statusColors: Readonly<Record<'success' | 'info' | 'warning' | 'error', { bg: string; fg: string; border: string }>>;

  // Annotations (user-manual-style callouts with leader lines)
  annotationBg: string;
  annotationBorder: string;
  annotationText: string;
  annotationLineColor: string;
  annotationDotColor: string;
  annotationStrokeWidth: number;
  annotationDotRadius: number;
  annotationCornerRadius: number;
  annotationPaddingX: number;
  annotationPaddingY: number;
  annotationGap: number;
  annotationMargin: number;
  annotationStackGap: number;

  /** Maps accent name → color used for borders, fills, and text treatments. */
  accents: Readonly<Record<AccentName, string>>;
  /** Maps state name → visual treatment applied to slots and cells. */
  states: Readonly<Record<StateName, StateStyle>>;
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

  cellMinSize: 80,
  cellPadding: 8,
  resourceBarHeight: 28,
  resourceBarItemGap: 16,
  resourceBarIconSize: 18,
  statsGap: 18,
  progressDefaultWidth: 200,
  progressMaxWidth: 600,
  progressHeight: 18,
  chartDefaultWidth: 220,
  chartDefaultHeight: 120,

  annotationBg: '#fefcf3',
  annotationBorder: '#b8a26b',
  annotationText: '#3d3526',
  annotationLineColor: '#8a7a4f',
  annotationDotColor: '#8a7a4f',
  annotationStrokeWidth: 1,
  annotationDotRadius: 3,
  annotationCornerRadius: 4,
  annotationPaddingX: 12,
  annotationPaddingY: 8,
  annotationGap: 48,
  annotationMargin: 16,
  annotationStackGap: 8,

  treeIndent: 18,
  treeRowHeight: 22,
  treeIndentGuideColor: '#d8dadf',
  treeGlyphColor: '#6b7078',
  treeSelectedBg: '#e7edf5',
  treeSelectedText: '#2d2d2d',

  checkboxSize: 16,
  checkboxRowGap: 8,
  checkboxBorderColor: '#6b7078',
  checkboxFillColor: '#ffffff',
  checkboxCheckColor: '#2d2d2d',

  radioSize: 16,
  toggleWidth: 32,
  toggleHeight: 18,
  toggleOnColor: '#3a3a3a',
  toggleOffColor: '#c4c4c4',
  toggleKnobColor: '#ffffff',
  radioGroupGap: 14,

  menubarHeight: 28,
  menubarItemPaddingX: 12,
  menubarBgColor: '#f5f6f8',
  menubarBorderColor: '#c4c4c4',
  menuWidth: 200,
  menuItemHeight: 24,
  menuItemPaddingX: 12,
  menuBgColor: '#ffffff',
  menuBorderColor: '#8a8a8a',
  menuShortcutColor: '#8a9099',
  menuSeparatorColor: '#d8dadf',

  chipHeight: 22,
  chipPaddingX: 10,
  chipBg: '#eef0f3',
  chipBorder: '#c4c8ce',
  chipText: '#3a3e44',
  chipSelectedBg: '#3a3a3a',
  chipSelectedBorder: '#3a3a3a',
  chipSelectedText: '#ffffff',

  avatarSizeSmall: 24,
  avatarSizeMedium: 32,
  avatarSizeLarge: 44,
  avatarBg: '#e2e5ea',
  avatarBorder: '#b5b8bd',
  avatarText: '#3a3e44',

  breadcrumbHeight: 22,
  breadcrumbGap: 6,
  breadcrumbSeparatorColor: '#8a9099',
  breadcrumbCurrentColor: '#2d2d2d',

  spinnerSize: 16,
  spinnerColor: '#6b7078',

  statusHeight: 22,
  statusPaddingX: 10,
  statusColors: Object.freeze({
    success: { bg: '#e8f3ec', fg: '#205537', border: '#3f8f5c' },
    info: { bg: '#e7edf5', fg: '#234273', border: '#3f7cc2' },
    warning: { bg: '#f7efdc', fg: '#6b4e15', border: '#c79a2e' },
    error: { bg: '#f5e4e2', fg: '#5c2420', border: '#b0413c' },
  }),

  accents: Object.freeze({
    research: '#3f7cc2',
    military: '#b55442',
    industry: '#c28a3a',
    wealth: '#3f8f5c',
    approval: '#7a56b0',
    warning: '#c79a2e',
    danger: '#b0413c',
    success: '#3f8f5c',
  }),
  states: Object.freeze({
    locked: {
      border: '#b8b8b8',
      fill: '#f0f0f0',
      text: '#8a8f97',
      badge: 'lock',
    },
    available: {
      border: '#7a7f87',
      fill: '#fafbfc',
      text: '#2d2d2d',
    },
    active: {
      border: '#3a3a3a',
      fill: '#fafbfc',
      text: '#2d2d2d',
    },
    purchased: {
      border: '#3f8f5c',
      fill: '#e8f3ec',
      text: '#205537',
      badge: 'check',
    },
    maxed: {
      border: '#c28a3a',
      fill: '#f7efdc',
      text: '#6b4e15',
      badge: 'star',
    },
    growing: {
      border: '#7a9a5a',
      fill: '#edf4e2',
      text: '#44552a',
    },
    ripe: {
      border: '#3f8f5c',
      fill: '#d9eedf',
      text: '#205537',
      badge: 'check',
    },
    withering: {
      border: '#a07245',
      fill: '#f0e4d5',
      text: '#6b4e2e',
    },
    cashed: {
      border: '#b8b8b8',
      fill: '#ededed',
      text: '#7a7f87',
    },
  }),
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

  annotationBg: '#2c2a22',
  annotationBorder: '#7a6a42',
  annotationText: '#e8dfc4',
  annotationLineColor: '#a8966a',
  annotationDotColor: '#a8966a',

  treeIndentGuideColor: '#404040',
  treeGlyphColor: '#8a9099',
  treeSelectedBg: '#2f3a4c',
  treeSelectedText: '#e0e0e0',

  checkboxBorderColor: '#8a9099',
  checkboxFillColor: '#252525',
  checkboxCheckColor: '#e0e0e0',

  toggleOnColor: '#d4d4d4',
  toggleOffColor: '#555555',
  toggleKnobColor: '#1e1e1e',

  menubarBgColor: '#2a2a2a',
  menubarBorderColor: '#555555',
  menuBgColor: '#252525',
  menuBorderColor: '#6b6b6b',
  menuShortcutColor: '#8a9099',
  menuSeparatorColor: '#404040',

  chipBg: '#353a42',
  chipBorder: '#555a62',
  chipText: '#b8bcc4',
  chipSelectedBg: '#d4d4d4',
  chipSelectedBorder: '#d4d4d4',
  chipSelectedText: '#1e1e1e',

  avatarBg: '#353a42',
  avatarBorder: '#555a62',
  avatarText: '#d4d4d4',

  breadcrumbSeparatorColor: '#707780',
  breadcrumbCurrentColor: '#f0f0f0',

  spinnerColor: '#8a9099',

  statusColors: Object.freeze({
    success: { bg: '#1f2e24', fg: '#b0e0c2', border: '#6bbd86' },
    info: { bg: '#1f2a3a', fg: '#b0c7e8', border: '#6ba4e8' },
    warning: { bg: '#3a2f1c', fg: '#f0d79a', border: '#e2aa57' },
    error: { bg: '#3a2220', fg: '#edb4ae', border: '#d66863' },
  }),

  accents: Object.freeze({
    research: '#6ba4e8',
    military: '#d47967',
    industry: '#e2aa57',
    wealth: '#6bbd86',
    approval: '#a58fd0',
    warning: '#e2b84a',
    danger: '#d66863',
    success: '#6bbd86',
  }),
  states: Object.freeze({
    locked: {
      border: '#5a5a5a',
      fill: '#2a2a2a',
      text: '#707780',
      badge: 'lock',
    },
    available: {
      border: '#8a9099',
      fill: '#252525',
      text: '#e0e0e0',
    },
    active: {
      border: '#d4d4d4',
      fill: '#252525',
      text: '#f0f0f0',
    },
    purchased: {
      border: '#6bbd86',
      fill: '#1f2e24',
      text: '#b0e0c2',
      badge: 'check',
    },
    maxed: {
      border: '#e2aa57',
      fill: '#3a2f1c',
      text: '#f0d79a',
      badge: 'star',
    },
    growing: {
      border: '#9abb6f',
      fill: '#242d1c',
      text: '#c5d9a7',
    },
    ripe: {
      border: '#6bbd86',
      fill: '#1f3528',
      text: '#b0e0c2',
      badge: 'check',
    },
    withering: {
      border: '#b58a5c',
      fill: '#332a22',
      text: '#d1b89a',
    },
    cashed: {
      border: '#5a5a5a',
      fill: '#2a2a2a',
      text: '#8a9099',
    },
  }),
}) as Theme;

export function getTheme(name: 'default' | 'dark'): Theme {
  return name === 'dark' ? DARK_THEME : DEFAULT_THEME;
}
