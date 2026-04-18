/**
 * SVG emitter — walks a LaidOutNode tree and produces an SVG string.
 *
 * Output is self-contained: inline attributes only, no external CSS or
 * font references. Consumers can drop the SVG straight into innerHTML
 * or save it to a file. Any SVG-compatible viewer (browsers, GitHub,
 * Obsidian, Notion) can render it without additional setup.
 */

import type {
  Attribute,
  AttributeFlag,
  AttributePair,
  AttributeValue,
  ButtonNode,
  ComboNode,
  ImageNode,
  InputNode,
  ItemNode,
  KvNode,
  SectionNode,
  SliderNode,
  SlotNode,
  TabNode,
  TextNode,
  WindowNode,
} from '../parser/ast.js';
import type { LaidOutNode } from './layout.js';
import type { Theme } from './themes.js';

export interface EmitOptions {
  id?: string;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function emitSvg(
  root: LaidOutNode,
  theme: Theme,
  options: EmitOptions = {},
): string {
  const parts: string[] = [];
  const width = root.width;
  const height = root.height;

  const svgAttrs = [
    'xmlns="http://www.w3.org/2000/svg"',
    `width="${width}"`,
    `height="${height}"`,
    `viewBox="0 0 ${width} ${height}"`,
    `font-family="${escapeAttr(theme.fontFamily)}"`,
    `font-size="${theme.fontSize}"`,
  ];
  if (options.id !== undefined) {
    svgAttrs.push(`id="${escapeAttr(options.id)}"`);
  }

  parts.push(`<svg ${svgAttrs.join(' ')}>`);
  parts.push(
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${theme.background}" />`,
  );

  emitNode(root, theme, parts);

  parts.push('</svg>');
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function emitNode(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const kind = laid.node.kind;
  switch (kind) {
    case 'window':
      emitWindow(laid, theme, out);
      break;
    case 'header':
    case 'footer':
      emitChromeBand(laid, kind, theme, out);
      break;
    case 'panel':
      emitPanel(laid, theme, out);
      break;
    case 'section':
      emitSection(laid, theme, out);
      break;
    case 'tabs':
      emitTabs(laid, theme, out);
      break;
    case 'tab':
      emitTab(laid, theme, out);
      break;
    case 'row':
    case 'col':
      for (const c of laid.children) emitNode(c, theme, out);
      break;
    case 'list':
      emitList(laid, theme, out);
      break;
    case 'item':
      emitItem(laid, theme, out);
      break;
    case 'slot':
      emitSlot(laid, theme, out);
      break;
    case 'text':
      emitText(laid, theme, out);
      break;
    case 'button':
      emitButton(laid, theme, out);
      break;
    case 'input':
      emitInput(laid, theme, out);
      break;
    case 'combo':
      emitCombo(laid, theme, out);
      break;
    case 'slider':
      emitSlider(laid, theme, out);
      break;
    case 'kv':
      emitKv(laid, theme, out);
      break;
    case 'image':
      emitImage(laid, theme, out);
      break;
    case 'icon':
      emitIcon(laid, theme, out);
      break;
    case 'divider':
      emitDivider(laid, theme, out);
      break;
  }
}

// ---------------------------------------------------------------------------
// Structural containers
// ---------------------------------------------------------------------------

function emitWindow(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as WindowNode;
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="none" stroke="${theme.windowBorderColor}" stroke-width="${theme.windowStrokeWidth}" />`,
  );
  if (node.title !== undefined) {
    const titleBarY = laid.y + theme.titleBarHeight;
    out.push(
      `<line x1="${laid.x}" y1="${titleBarY}" x2="${laid.x + laid.width}" y2="${titleBarY}" ` +
        `stroke="${theme.chromeLineColor}" stroke-width="${theme.chromeStrokeWidth}" />`,
    );
    const titleY = laid.y + theme.titleBarHeight / 2 + theme.titleFontSize / 3;
    out.push(
      `<text x="${laid.x + laid.width / 2}" y="${titleY}" ` +
        `text-anchor="middle" font-size="${theme.titleFontSize}" font-weight="600" ` +
        `fill="${theme.textColor}">${escapeText(node.title)}</text>`,
    );
  }
  for (const c of laid.children) emitNode(c, theme, out);
}

function emitChromeBand(
  laid: LaidOutNode,
  kind: 'header' | 'footer',
  theme: Theme,
  out: string[],
): void {
  if (kind === 'header') {
    out.push(
      `<line x1="${laid.x}" y1="${laid.y + laid.height}" x2="${laid.x + laid.width}" y2="${laid.y + laid.height}" ` +
        `stroke="${theme.chromeLineColor}" stroke-width="${theme.chromeStrokeWidth}" />`,
    );
  } else {
    out.push(
      `<line x1="${laid.x}" y1="${laid.y}" x2="${laid.x + laid.width}" y2="${laid.y}" ` +
        `stroke="${theme.chromeLineColor}" stroke-width="${theme.chromeStrokeWidth}" />`,
    );
  }
  for (const c of laid.children) emitNode(c, theme, out);
}

function emitPanel(laid: LaidOutNode, theme: Theme, out: string[]): void {
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="none" stroke="${theme.panelBorderColor}" stroke-width="${theme.panelStrokeWidth}" ` +
      `stroke-dasharray="${theme.panelStrokeDasharray}" rx="2" />`,
  );
  for (const c of laid.children) emitNode(c, theme, out);
}

function emitSection(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as SectionNode;
  const titleY = laid.y + theme.sectionTitleHeight - 4;

  // Section title in small caps-like muted style.
  out.push(
    `<text x="${laid.x}" y="${titleY}" ` +
      `font-size="${theme.sectionTitleFontSize}" font-weight="700" letter-spacing="0.8" ` +
      `fill="${theme.sectionTitleColor}">${escapeText(node.title.toUpperCase())}</text>`,
  );

  // Optional badge pill aligned right.
  const badge = getAttrString(node.attributes, 'badge');
  if (badge !== undefined) {
    const badgeW = badgeRenderWidth(badge, theme);
    renderBadgePill(
      laid.x + laid.width - badgeW,
      laid.y + (theme.sectionTitleHeight - theme.badgeHeight) / 2,
      badge,
      theme,
      out,
    );
  }

  // Subtle divider line under the title.
  const lineY = laid.y + theme.sectionTitleHeight;
  out.push(
    `<line x1="${laid.x}" y1="${lineY}" x2="${laid.x + laid.width}" y2="${lineY}" ` +
      `stroke="${theme.dividerColor}" stroke-width="${theme.dividerStrokeWidth}" opacity="0.6" />`,
  );

  for (const c of laid.children) emitNode(c, theme, out);
}

function emitTabs(laid: LaidOutNode, theme: Theme, out: string[]): void {
  // Baseline divider under the tab row.
  const baselineY = laid.y + laid.height - 0.5;
  out.push(
    `<line x1="${laid.x}" y1="${baselineY}" x2="${laid.x + laid.width}" y2="${baselineY}" ` +
      `stroke="${theme.chromeLineColor}" stroke-width="${theme.chromeStrokeWidth}" />`,
  );
  for (const c of laid.children) emitNode(c, theme, out);
}

function emitTab(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as TabNode;
  const isActive = hasFlag(node.attributes, 'active');
  const badge = getAttrString(node.attributes, 'badge');
  const fill = isActive ? theme.tabActiveColor : theme.tabInactiveColor;
  const weight = isActive ? '600' : '400';

  // Label
  const labelX = laid.x + theme.tabPaddingX;
  const labelY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${labelX}" y="${labelY}" font-weight="${weight}" fill="${fill}">${escapeText(node.label)}</text>`,
  );

  // Inline badge after label
  if (badge !== undefined) {
    const labelWidth = node.label.length * theme.averageCharWidth;
    renderBadgePill(
      labelX + labelWidth + 6,
      laid.y + (laid.height - theme.badgeHeight) / 2,
      badge,
      theme,
      out,
    );
  }

  // Active underline
  if (isActive) {
    const underlineY = laid.y + laid.height - 2;
    out.push(
      `<line x1="${laid.x + 4}" y1="${underlineY}" x2="${laid.x + laid.width - 4}" y2="${underlineY}" ` +
        `stroke="${theme.tabUnderlineColor}" stroke-width="2" />`,
    );
  }
}

function emitList(laid: LaidOutNode, theme: Theme, out: string[]): void {
  for (const c of laid.children) emitNode(c, theme, out);
}

function emitItem(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ItemNode;
  const bulletX = laid.x + 4;
  const bulletY = laid.y + laid.height / 2 + 1;
  out.push(
    `<circle cx="${bulletX + 2}" cy="${bulletY}" r="2" fill="${theme.bulletColor}" />`,
  );
  const textX = laid.x + theme.bulletWidth;
  const textY = laid.y + laid.height * 0.7;
  out.push(
    `<text x="${textX}" y="${textY}" fill="${theme.textColor}">${escapeText(node.text)}</text>`,
  );
}

function emitSlot(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as SlotNode;
  const isActive = hasFlag(node.attributes, 'active');
  const stroke = isActive ? theme.slotActiveBorderColor : theme.slotBorderColor;
  const strokeWidth = isActive ? theme.slotActiveStrokeWidth : theme.slotStrokeWidth;

  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="${theme.slotFillColor}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="4" />`,
  );

  // Title
  const titleX = laid.x + theme.slotPadding;
  const titleY = laid.y + theme.slotPadding + theme.slotTitleHeight * 0.7;
  out.push(
    `<text x="${titleX}" y="${titleY}" font-weight="600" fill="${theme.textColor}">${escapeText(node.title)}</text>`,
  );

  for (const c of laid.children) emitNode(c, theme, out);
}

// ---------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------

function emitText(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as TextNode;
  const style = textStyle(node.attributes, theme);
  const baseline = laid.y + laid.height * 0.75;
  out.push(
    `<text x="${laid.x}" y="${baseline}"${style}>${escapeText(node.content)}</text>`,
  );
}

function emitButton(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ButtonNode;
  const isPrimary = hasFlag(node.attributes, 'primary');
  const isDisabled = hasFlag(node.attributes, 'disabled');
  const fill = isPrimary ? theme.primaryButtonFill : theme.buttonFill;
  const textFill = isPrimary ? theme.primaryButtonText : theme.buttonText;
  const stroke = isDisabled ? theme.disabledColor : theme.buttonBorderColor;
  const opacity = isDisabled ? '0.55' : '1';
  const badge = getAttrString(node.attributes, 'badge');

  out.push(
    `<g opacity="${opacity}">`,
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="${theme.buttonStrokeWidth}" rx="3" />`,
    `<text x="${laid.x + laid.width / 2 - (badge ? badgeRenderWidth(badge, theme) / 2 : 0)}" ` +
      `y="${laid.y + laid.height / 2 + theme.fontSize / 3}" ` +
      `text-anchor="middle" font-weight="500" fill="${isDisabled ? theme.disabledColor : textFill}">${escapeText(node.label)}</text>`,
    `</g>`,
  );

  if (badge !== undefined) {
    renderBadgePill(
      laid.x + laid.width - badgeRenderWidth(badge, theme) - 8,
      laid.y + (laid.height - theme.badgeHeight) / 2,
      badge,
      theme,
      out,
    );
  }
}

function emitInput(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as InputNode;
  const placeholder = getAttrString(node.attributes, 'placeholder') ?? '';
  const isDisabled = hasFlag(node.attributes, 'disabled');
  const opacity = isDisabled ? '0.55' : '1';

  out.push(
    `<g opacity="${opacity}">`,
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="${theme.background}" stroke="${theme.panelBorderColor}" stroke-width="${theme.inputStrokeWidth}" rx="2" />`,
    `<text x="${laid.x + theme.inputPaddingX}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" ` +
      `fill="${theme.placeholderColor}">${escapeText(placeholder)}</text>`,
    `</g>`,
  );
}

function emitCombo(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ComboNode;
  const value = getAttrString(node.attributes, 'value') ?? node.label ?? '';
  const isDisabled = hasFlag(node.attributes, 'disabled');
  const opacity = isDisabled ? '0.55' : '1';
  const chevronX = laid.x + laid.width - theme.comboChevronWidth + 4;
  const midY = laid.y + laid.height / 2;

  out.push(
    `<g opacity="${opacity}">`,
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="${theme.background}" stroke="${theme.panelBorderColor}" stroke-width="${theme.inputStrokeWidth}" rx="2" />`,
    `<text x="${laid.x + theme.inputPaddingX}" y="${midY + theme.fontSize / 3}" fill="${theme.textColor}">${escapeText(value)}</text>`,
    // Chevron ▾
    `<path d="M ${chevronX} ${midY - 3} L ${chevronX + 10} ${midY - 3} L ${chevronX + 5} ${midY + 3} Z" fill="${theme.comboChevronColor}" />`,
    `</g>`,
  );
}

function emitSlider(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as SliderNode;
  const range = getAttrRange(node.attributes, 'range') ?? { min: 0, max: 100 };
  const value = getAttrNumber(node.attributes, 'value') ?? range.min;
  const label = getAttrString(node.attributes, 'label');

  const trackX = laid.x;
  const trackY = laid.y + laid.height / 2 - theme.sliderTrackHeight / 2;
  const trackW = laid.width;
  const thumbT = clamp01((value - range.min) / (range.max - range.min));
  const thumbX = trackX + trackW * thumbT;
  const thumbY = laid.y + laid.height / 2;

  // Optional label above the track
  if (label !== undefined) {
    out.push(
      `<text x="${laid.x}" y="${laid.y + theme.fontSize * 0.9}" ` +
        `font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(label)}</text>`,
    );
  }

  // Track base
  out.push(
    `<rect x="${trackX}" y="${trackY}" width="${trackW}" height="${theme.sliderTrackHeight}" ` +
      `fill="${theme.sliderTrackColor}" rx="${theme.sliderTrackHeight / 2}" />`,
  );
  // Filled portion
  out.push(
    `<rect x="${trackX}" y="${trackY}" width="${thumbX - trackX}" height="${theme.sliderTrackHeight}" ` +
      `fill="${theme.sliderFillColor}" rx="${theme.sliderTrackHeight / 2}" />`,
  );
  // Thumb
  out.push(
    `<circle cx="${thumbX}" cy="${thumbY}" r="${theme.sliderThumbRadius}" ` +
      `fill="${theme.sliderThumbColor}" stroke="${theme.background}" stroke-width="1.5" />`,
  );
}

function emitKv(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as KvNode;
  const valueStyle = textStyle(node.attributes, theme);
  const baseline = laid.y + laid.height * 0.75;

  // Label (always default body text)
  out.push(
    `<text x="${laid.x}" y="${baseline}" fill="${theme.textColor}">${escapeText(node.label)}</text>`,
  );
  // Value — right-aligned at laid.x + laid.width
  out.push(
    `<text x="${laid.x + laid.width}" y="${baseline}" text-anchor="end"${valueStyle}>${escapeText(node.value)}</text>`,
  );
}

function emitImage(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ImageNode;
  const label = getAttrString(node.attributes, 'label') ?? 'image';

  // Bordered rect with dashed stroke
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="${theme.slotFillColor}" stroke="${theme.panelBorderColor}" stroke-width="${theme.panelStrokeWidth}" ` +
      `stroke-dasharray="${theme.panelStrokeDasharray}" rx="2" />`,
  );
  // Diagonal lines (corner to corner) for "placeholder image" feel
  out.push(
    `<line x1="${laid.x}" y1="${laid.y}" x2="${laid.x + laid.width}" y2="${laid.y + laid.height}" ` +
      `stroke="${theme.panelBorderColor}" stroke-width="0.5" opacity="0.4" />`,
    `<line x1="${laid.x + laid.width}" y1="${laid.y}" x2="${laid.x}" y2="${laid.y + laid.height}" ` +
      `stroke="${theme.panelBorderColor}" stroke-width="0.5" opacity="0.4" />`,
  );
  // Center label
  out.push(
    `<text x="${laid.x + laid.width / 2}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" ` +
      `text-anchor="middle" font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(label)}</text>`,
  );
}

function emitIcon(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ImageNode; // shares `name` extraction shape
  const name = getAttrString((node as unknown as { attributes: Attribute[] }).attributes, 'name') ?? '?';

  // Rounded square
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="none" stroke="${theme.iconStrokeColor}" stroke-width="1" rx="3" />`,
  );
  // Single glyph (first letter of name) centered
  const glyph = name.charAt(0).toUpperCase();
  out.push(
    `<text x="${laid.x + laid.width / 2}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" ` +
      `text-anchor="middle" font-size="${theme.smallFontSize}" fill="${theme.iconStrokeColor}">${escapeText(glyph)}</text>`,
  );
}

function emitDivider(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const y = laid.y + laid.height / 2;
  out.push(
    `<line x1="${laid.x}" y1="${y}" x2="${laid.x + laid.width}" y2="${y}" ` +
      `stroke="${theme.dividerColor}" stroke-width="${theme.dividerStrokeWidth}" />`,
  );
}

// ---------------------------------------------------------------------------
// Typography + badge helpers
// ---------------------------------------------------------------------------

/**
 * Build the typography-related SVG attributes for a text/kv value from its
 * bare flags and explicit weight/size attributes. Returns a prefixed
 * attribute string (e.g., ` font-weight="700" fill="#2d2d2d"`) ready to
 * interpolate directly into an element open tag.
 */
function textStyle(attrs: readonly Attribute[], theme: Theme): string {
  const isBold = hasFlag(attrs, 'bold');
  const isItalic = hasFlag(attrs, 'italic');
  const isMuted = hasFlag(attrs, 'muted');
  const weight = getAttrIdent(attrs, 'weight');
  const size = getAttrIdent(attrs, 'size');

  const parts: string[] = [];
  let fontWeight: string | null = null;
  if (weight === 'light') fontWeight = '300';
  else if (weight === 'semibold') fontWeight = '600';
  else if (weight === 'bold') fontWeight = '700';
  else if (weight === 'regular') fontWeight = '400';
  else if (isBold) fontWeight = '700';

  if (fontWeight) parts.push(`font-weight="${fontWeight}"`);

  let fontSize: number | null = null;
  if (size === 'small') fontSize = theme.smallFontSize;
  else if (size === 'large') fontSize = theme.largeFontSize;
  if (fontSize !== null) parts.push(`font-size="${fontSize}"`);

  if (isItalic) parts.push(`font-style="italic"`);

  const fill = isMuted ? theme.mutedTextColor : theme.textColor;
  parts.push(`fill="${fill}"`);

  return ' ' + parts.join(' ');
}

function renderBadgePill(
  x: number,
  y: number,
  text: string,
  theme: Theme,
  out: string[],
): void {
  const w = badgeRenderWidth(text, theme);
  const h = theme.badgeHeight;
  out.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${theme.badgeFill}" />`,
    `<text x="${x + w / 2}" y="${y + h / 2 + theme.badgeFontSize / 3}" ` +
      `text-anchor="middle" font-size="${theme.badgeFontSize}" font-weight="600" ` +
      `fill="${theme.badgeText}">${escapeText(text)}</text>`,
  );
}

function badgeRenderWidth(text: string, theme: Theme): number {
  const charW = theme.averageCharWidth * (theme.badgeFontSize / theme.fontSize);
  return text.length * charW + theme.badgePaddingX * 2;
}

// ---------------------------------------------------------------------------
// Attribute accessors
// ---------------------------------------------------------------------------

function hasFlag(attrs: readonly Attribute[], name: string): boolean {
  return attrs.some((a) => a.kind === 'flag' && (a as AttributeFlag).flag === name);
}

function getAttr(attrs: readonly Attribute[], key: string): AttributeValue | undefined {
  for (const a of attrs) {
    if (a.kind === 'pair' && (a as AttributePair).key === key) {
      return (a as AttributePair).value;
    }
  }
  return undefined;
}

function getAttrString(attrs: readonly Attribute[], key: string): string | undefined {
  const v = getAttr(attrs, key);
  return v?.kind === 'string' ? v.value : undefined;
}

function getAttrNumber(attrs: readonly Attribute[], key: string): number | undefined {
  const v = getAttr(attrs, key);
  return v?.kind === 'number' ? v.value : undefined;
}

function getAttrIdent(attrs: readonly Attribute[], key: string): string | undefined {
  const v = getAttr(attrs, key);
  return v?.kind === 'identifier' ? v.value : undefined;
}

function getAttrRange(
  attrs: readonly Attribute[],
  key: string,
): { min: number; max: number } | undefined {
  const v = getAttr(attrs, key);
  return v?.kind === 'range' ? { min: v.min, max: v.max } : undefined;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
