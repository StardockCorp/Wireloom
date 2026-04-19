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
  CellNode,
  ChartNode,
  ComboNode,
  IconNode,
  ImageNode,
  InputNode,
  ItemNode,
  KvNode,
  ProgressNode,
  ResourceNode,
  SectionNode,
  SliderNode,
  SlotNode,
  StatNode,
  TabNode,
  TextNode,
  WindowNode,
} from '../parser/ast.js';
import type { LaidOutNode } from './layout.js';
import type { AccentName, StateName, Theme } from './themes.js';
import { emitIconByName, hasIcon } from './icons.js';

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
    case 'grid':
      emitGrid(laid, theme, out);
      break;
    case 'cell':
      emitCell(laid, theme, out);
      break;
    case 'resourcebar':
      emitResourceBar(laid, theme, out);
      break;
    case 'resource':
      emitResource(laid, theme, out);
      break;
    case 'stats':
      emitStats(laid, theme, out);
      break;
    case 'stat':
      emitStat(laid, theme, out);
      break;
    case 'progress':
      emitProgress(laid, theme, out);
      break;
    case 'chart':
      emitChart(laid, theme, out);
      break;
    case 'slotFooter':
      for (const c of laid.children) emitNode(c, theme, out);
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
  const accent = getAccent(node.attributes, theme);
  const titleColor = accent ?? theme.sectionTitleColor;

  // Section title in small caps-like muted style.
  out.push(
    `<text x="${laid.x}" y="${titleY}" ` +
      `font-size="${theme.sectionTitleFontSize}" font-weight="700" letter-spacing="0.8" ` +
      `fill="${titleColor}">${escapeText(node.title.toUpperCase())}</text>`,
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
      accent,
    );
  }

  // Subtle divider line under the title.
  const lineY = laid.y + theme.sectionTitleHeight;
  out.push(
    `<line x1="${laid.x}" y1="${lineY}" x2="${laid.x + laid.width}" y2="${lineY}" ` +
      `stroke="${accent ?? theme.dividerColor}" stroke-width="${theme.dividerStrokeWidth}" opacity="${accent ? '0.8' : '0.6'}" />`,
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
  const state = getState(node.attributes);
  const accent = getAccent(node.attributes, theme);

  let stroke: string;
  let strokeWidth: number;
  let fill: string;
  let textColor: string;
  let badgeIcon: string | undefined;

  if (state !== undefined) {
    const s = theme.states[state];
    stroke = accent ?? s.border;
    fill = s.fill;
    textColor = s.text;
    strokeWidth = state === 'active' ? theme.slotActiveStrokeWidth : theme.slotStrokeWidth;
    badgeIcon = s.badge;
  } else if (isActive) {
    stroke = accent ?? theme.slotActiveBorderColor;
    fill = theme.slotFillColor;
    textColor = theme.textColor;
    strokeWidth = theme.slotActiveStrokeWidth;
  } else {
    stroke = accent ?? theme.slotBorderColor;
    fill = theme.slotFillColor;
    textColor = theme.textColor;
    strokeWidth = theme.slotStrokeWidth;
  }

  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="4" />`,
  );

  // Title
  const titleX = laid.x + theme.slotPadding;
  const titleY = laid.y + theme.slotPadding + theme.slotTitleHeight * 0.7;
  out.push(
    `<text x="${titleX}" y="${titleY}" font-weight="600" fill="${textColor}">${escapeText(node.title)}</text>`,
  );

  // State badge in the top-right corner (lock/check/star, if the state supplies one).
  if (badgeIcon !== undefined) {
    const sz = 14;
    const bx = laid.x + laid.width - theme.slotPadding - sz;
    const by = laid.y + theme.slotPadding + (theme.slotTitleHeight - sz) / 2;
    const iconMarkup = emitIconByName(badgeIcon, bx, by, sz, stroke);
    if (iconMarkup) out.push(iconMarkup);
  }

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
  const accent = getAccent(node.attributes, theme);
  let fill = isPrimary ? theme.primaryButtonFill : theme.buttonFill;
  let textFill = isPrimary ? theme.primaryButtonText : theme.buttonText;
  let stroke = isDisabled ? theme.disabledColor : theme.buttonBorderColor;
  if (accent !== undefined && !isDisabled) {
    if (isPrimary) {
      fill = accent;
      textFill = '#ffffff';
      stroke = accent;
    } else {
      stroke = accent;
      textFill = accent;
    }
  }
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
  const node = laid.node as IconNode;
  const name = getAttrString(node.attributes, 'name') ?? '';
  const accent = getAccent(node.attributes, theme);
  const color = accent ?? theme.iconStrokeColor;

  if (name && hasIcon(name)) {
    const markup = emitIconByName(name, laid.x, laid.y, laid.width, color);
    if (markup !== undefined) {
      out.push(markup);
      return;
    }
  }

  // Fallback: boxed first-letter placeholder (preserves v0.3 behavior for unknown names).
  const fallback = name || '?';
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="none" stroke="${color}" stroke-width="1" rx="3" />`,
  );
  const glyph = fallback.charAt(0).toUpperCase();
  out.push(
    `<text x="${laid.x + laid.width / 2}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" ` +
      `text-anchor="middle" font-size="${theme.smallFontSize}" fill="${color}">${escapeText(glyph)}</text>`,
  );
}

function emitDivider(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const y = laid.y + laid.height / 2;
  out.push(
    `<line x1="${laid.x}" y1="${y}" x2="${laid.x + laid.width}" y2="${y}" ` +
      `stroke="${theme.dividerColor}" stroke-width="${theme.dividerStrokeWidth}" />`,
  );
}

function emitGrid(laid: LaidOutNode, theme: Theme, out: string[]): void {
  // The grid itself is a transparent container; children (cells) paint themselves.
  void theme;
  for (const c of laid.children) emitNode(c, theme, out);
}

function emitCell(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as CellNode;
  const state = getState(node.attributes);
  const accent = getAccent(node.attributes, theme);
  let stroke: string;
  let fill: string;
  let textColor: string;
  let badgeIcon: string | undefined;
  let strokeWidth = theme.slotStrokeWidth;

  if (state !== undefined) {
    const s = theme.states[state];
    stroke = accent ?? s.border;
    fill = s.fill;
    textColor = s.text;
    badgeIcon = s.badge;
    if (state === 'active' || state === 'purchased' || state === 'ripe' || state === 'maxed') {
      strokeWidth = theme.slotActiveStrokeWidth;
    }
  } else {
    stroke = accent ?? theme.slotBorderColor;
    fill = theme.slotFillColor;
    textColor = theme.textColor;
  }

  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="3" />`,
  );

  if (node.label !== undefined) {
    out.push(
      `<text x="${laid.x + theme.cellPadding}" y="${laid.y + theme.cellPadding + theme.fontSize}" ` +
        `font-weight="600" font-size="${theme.smallFontSize}" fill="${textColor}">${escapeText(node.label)}</text>`,
    );
  }

  if (badgeIcon !== undefined) {
    const sz = 12;
    const bx = laid.x + laid.width - theme.cellPadding - sz;
    const by = laid.y + theme.cellPadding;
    const iconMarkup = emitIconByName(badgeIcon, bx, by, sz, stroke);
    if (iconMarkup) out.push(iconMarkup);
  }

  for (const c of laid.children) emitNode(c, theme, out);
}

function emitResourceBar(laid: LaidOutNode, theme: Theme, out: string[]): void {
  // Subtle background band so the bar reads as a unit.
  out.push(
    `<rect x="${laid.x - 4}" y="${laid.y - 4}" width="${laid.width + 8}" height="${laid.height + 8}" ` +
      `fill="${theme.slotFillColor}" stroke="${theme.panelBorderColor}" stroke-width="0.5" rx="3" opacity="0.6" />`,
  );
  for (const c of laid.children) emitNode(c, theme, out);
}

function emitResource(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ResourceNode;
  const iconName = getAttrString(node.attributes, 'icon') ?? inferResourceIcon(node.name);
  const iconColor = theme.iconStrokeColor;
  if (iconName && hasIcon(iconName)) {
    const markup = emitIconByName(
      iconName,
      laid.x,
      laid.y + (laid.height - theme.resourceBarIconSize) / 2,
      theme.resourceBarIconSize,
      iconColor,
    );
    if (markup) out.push(markup);
  } else {
    // Small boxed fallback
    out.push(
      `<rect x="${laid.x + 0.5}" y="${laid.y + (laid.height - theme.resourceBarIconSize) / 2 + 0.5}" ` +
        `width="${theme.resourceBarIconSize - 1}" height="${theme.resourceBarIconSize - 1}" ` +
        `fill="none" stroke="${iconColor}" stroke-width="1" rx="2" />`,
    );
  }
  const textX = laid.x + theme.resourceBarIconSize + 6;
  const textY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${textX}" y="${textY}" font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">` +
      `${escapeText(node.name)}: </text>` +
      `<text x="${textX + (node.name.length + 2) * theme.averageCharWidth * (theme.smallFontSize / theme.fontSize)}" y="${textY}" ` +
      `font-size="${theme.smallFontSize}" font-weight="600" fill="${theme.textColor}">${escapeText(node.value)}</text>`,
  );
}

function inferResourceIcon(name: string): string | undefined {
  const lower = name.toLowerCase();
  if (hasIcon(lower)) return lower;
  // Lightweight heuristics so authors get sensible glyphs without specifying `icon=`.
  if (/credit|coin|money|gold|cash/.test(lower)) return 'credits';
  if (/research|science|lab/.test(lower)) return 'research';
  if (/military|army|fleet|defense/.test(lower)) return 'military';
  if (/industry|production|manufactur|factory/.test(lower)) return 'industry';
  if (/influence|diplo/.test(lower)) return 'influence';
  if (/approval|happy|morale/.test(lower)) return 'approval';
  if (/faith|ideology|religion/.test(lower)) return 'faith';
  if (/admin|authority|governance/.test(lower)) return 'authority';
  if (/compute|computation|ai/.test(lower)) return 'computation';
  if (/tech/.test(lower)) return 'tech';
  if (/policy|law/.test(lower)) return 'policy';
  return undefined;
}

function emitStats(laid: LaidOutNode, theme: Theme, out: string[]): void {
  void theme;
  for (const c of laid.children) emitNode(c, theme, out);
}

function emitStat(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as StatNode;
  const isBold = hasFlag(node.attributes, 'bold');
  const isMuted = hasFlag(node.attributes, 'muted');
  const labelColor = isMuted ? theme.mutedTextColor : theme.mutedTextColor;
  const valueColor = isMuted ? theme.mutedTextColor : theme.textColor;
  const valueWeight = isBold ? '700' : '500';
  const baseline = laid.y + laid.height * 0.75;
  const labelW =
    node.label.length * theme.averageCharWidth * (theme.smallFontSize / theme.fontSize);

  out.push(
    `<text x="${laid.x}" y="${baseline}" font-size="${theme.smallFontSize}" ` +
      `letter-spacing="0.5" fill="${labelColor}">${escapeText(node.label.toUpperCase())}</text>`,
  );
  out.push(
    `<text x="${laid.x + labelW + 6}" y="${baseline}" font-weight="${valueWeight}" fill="${valueColor}">${escapeText(node.value)}</text>`,
  );
}

function emitProgress(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ProgressNode;
  const label = getAttrString(node.attributes, 'label');
  const accent = getAccent(node.attributes, theme);
  const value = getAttrNumber(node.attributes, 'value') ?? 0;
  const max = Math.max(1, getAttrNumber(node.attributes, 'max') ?? 100);
  const frac = clamp01(value / max);

  const barY = label !== undefined ? laid.y + theme.smallFontSize + 4 : laid.y;
  const barHeight = theme.progressHeight;

  if (label !== undefined) {
    // Label on the left, "value / max" on the right, both small.
    out.push(
      `<text x="${laid.x}" y="${laid.y + theme.smallFontSize}" ` +
        `font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(label)}</text>`,
    );
    const right = `${value} / ${max}`;
    out.push(
      `<text x="${laid.x + laid.width}" y="${laid.y + theme.smallFontSize}" ` +
        `text-anchor="end" font-size="${theme.smallFontSize}" font-weight="600" fill="${theme.textColor}">${escapeText(right)}</text>`,
    );
  }

  // Track
  out.push(
    `<rect x="${laid.x}" y="${barY}" width="${laid.width}" height="${barHeight}" ` +
      `fill="${theme.sliderTrackColor}" rx="${barHeight / 2}" />`,
  );
  // Fill
  const fillColor = accent ?? theme.sliderFillColor;
  out.push(
    `<rect x="${laid.x}" y="${barY}" width="${laid.width * frac}" height="${barHeight}" ` +
      `fill="${fillColor}" rx="${barHeight / 2}" />`,
  );
}

function emitChart(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ChartNode;
  const kindAttr = getAttrIdent(node.attributes, 'kind');
  const kind: 'bar' | 'line' | 'pie' =
    kindAttr === 'line' || kindAttr === 'pie' ? kindAttr : 'bar';
  const label = getAttrString(node.attributes, 'label');
  const accent = getAccent(node.attributes, theme);
  const stroke = accent ?? theme.panelBorderColor;
  const fill = theme.slotFillColor;

  // Dashed bordered rect — this is a placeholder, not a real chart.
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="${theme.panelStrokeWidth}" ` +
      `stroke-dasharray="${theme.panelStrokeDasharray}" rx="3" />`,
  );

  // Glyph that signals the chart kind.
  const inset = 12;
  const gx = laid.x + inset;
  const gy = laid.y + inset;
  const gw = laid.width - inset * 2;
  const gh = laid.height - inset * 2 - (label !== undefined ? theme.smallFontSize + 4 : 0);
  const glyphStroke = accent ?? theme.mutedTextColor;

  if (kind === 'bar') {
    const bars = 4;
    const barW = gw / (bars * 2);
    const heights = [0.4, 0.75, 0.55, 0.9];
    for (let i = 0; i < bars; i++) {
      const bh = gh * (heights[i] ?? 0.5);
      const bx = gx + i * barW * 2 + barW * 0.5;
      const by = gy + gh - bh;
      out.push(
        `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${glyphStroke}" opacity="0.75" />`,
      );
    }
  } else if (kind === 'line') {
    const points = [
      { x: 0, y: 0.7 },
      { x: 0.25, y: 0.45 },
      { x: 0.5, y: 0.55 },
      { x: 0.75, y: 0.2 },
      { x: 1, y: 0.3 },
    ];
    const path = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${gx + p.x * gw} ${gy + p.y * gh}`)
      .join(' ');
    out.push(
      `<path d="${path}" fill="none" stroke="${glyphStroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />`,
    );
    for (const p of points) {
      out.push(
        `<circle cx="${gx + p.x * gw}" cy="${gy + p.y * gh}" r="2" fill="${glyphStroke}" />`,
      );
    }
  } else {
    // pie
    const cx = gx + gw / 2;
    const cy = gy + gh / 2;
    const r = Math.min(gw, gh) / 2;
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${glyphStroke}" opacity="0.75" />`);
    // Slice indicator — a wedge from 12 o'clock sweeping ~120°
    const endX = cx + r * Math.cos(-Math.PI / 2 + (2 * Math.PI) / 3);
    const endY = cy + r * Math.sin(-Math.PI / 2 + (2 * Math.PI) / 3);
    out.push(
      `<path d="M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${endX} ${endY} Z" ` +
        `fill="${theme.background}" opacity="0.7" />`,
    );
  }

  // Optional label beneath the glyph.
  if (label !== undefined) {
    out.push(
      `<text x="${laid.x + laid.width / 2}" y="${laid.y + laid.height - 8}" ` +
        `text-anchor="middle" font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(label)}</text>`,
    );
  }
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
  accent?: string,
): void {
  const w = badgeRenderWidth(text, theme);
  const h = theme.badgeHeight;
  const fill = accent ?? theme.badgeFill;
  const textFill = accent ? '#ffffff' : theme.badgeText;
  out.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" />`,
    `<text x="${x + w / 2}" y="${y + h / 2 + theme.badgeFontSize / 3}" ` +
      `text-anchor="middle" font-size="${theme.badgeFontSize}" font-weight="600" ` +
      `fill="${textFill}">${escapeText(text)}</text>`,
  );
}

function getAccent(attrs: readonly Attribute[], theme: Theme): string | undefined {
  const v = getAttrIdent(attrs, 'accent');
  if (v === undefined) return undefined;
  return theme.accents[v as AccentName];
}

function getState(attrs: readonly Attribute[]): StateName | undefined {
  const v = getAttrIdent(attrs, 'state');
  if (v === undefined) return undefined;
  return v as StateName;
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
