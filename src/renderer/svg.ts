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
  AvatarNode,
  ButtonNode,
  CellNode,
  ChartNode,
  CheckboxNode,
  ChipNode,
  ComboNode,
  CrumbNode,
  IconNode,
  ImageNode,
  InputNode,
  ItemNode,
  KvNode,
  MenuItemNode,
  MenuNode,
  ProgressNode,
  RadioNode,
  ResourceNode,
  SectionNode,
  SheetNode,
  SliderNode,
  SlotNode,
  SpinnerNode,
  StatNode,
  StatusNode,
  TabNode,
  TextNode,
  ToggleNode,
  TreeItemNode,
  WindowNode,
} from '../parser/ast.js';
import type { LaidAnnotation, LaidDocument, LaidOutNode } from './layout.js';
import type { AccentName, StateName, Theme } from './themes.js';
import { emitIconByName, hasIcon } from './icons.js';

export interface EmitOptions {
  id?: string;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function emitSvg(
  doc: LaidDocument,
  theme: Theme,
  options: EmitOptions = {},
): string {
  const parts: string[] = [];
  const width = doc.canvasWidth;
  const height = doc.canvasHeight;

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

  emitNode(doc.root, theme, parts);

  for (const a of doc.annotations) {
    emitAnnotation(a, theme, parts);
  }

  parts.push('</svg>');
  return parts.join('');
}

function emitAnnotation(a: LaidAnnotation, theme: Theme, out: string[]): void {
  // Leader line + target dot rendered first so the box paints over them
  // where they cross the box edge.
  out.push(
    `<line x1="${a.targetAnchor.x}" y1="${a.targetAnchor.y}" x2="${a.boxAnchor.x}" y2="${a.boxAnchor.y}" stroke="${theme.annotationLineColor}" stroke-width="${theme.annotationStrokeWidth}" />`,
  );
  out.push(
    `<circle cx="${a.targetAnchor.x}" cy="${a.targetAnchor.y}" r="${theme.annotationDotRadius}" fill="${theme.annotationDotColor}" />`,
  );
  out.push(
    `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" rx="${theme.annotationCornerRadius}" ry="${theme.annotationCornerRadius}" fill="${theme.annotationBg}" stroke="${theme.annotationBorder}" stroke-width="${theme.annotationStrokeWidth}" />`,
  );
  const textX = a.x + theme.annotationPaddingX;
  // Baseline for the first line; subsequent lines advance by lineHeight.
  let baseline = a.y + theme.annotationPaddingY + theme.fontSize;
  for (const line of a.lines) {
    out.push(
      `<text x="${textX}" y="${baseline}" fill="${theme.annotationText}">${escapeText(line)}</text>`,
    );
    baseline += theme.lineHeight;
  }
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
    case 'tree':
      emitTree(laid, theme, out);
      break;
    case 'treeNode':
      emitTreeNode(laid, theme, out);
      break;
    case 'menubar':
      emitMenubar(laid, theme, out);
      break;
    case 'menu':
      emitMenu(laid, theme, out);
      break;
    case 'menuitem':
      emitMenuItem(laid, theme, out);
      break;
    case 'separator':
      emitMenuSeparator(laid, theme, out);
      break;
    case 'breadcrumb':
      emitBreadcrumb(laid, theme, out);
      break;
    case 'crumb':
      // Crumbs paint themselves via emitBreadcrumb (renders separator + label
      // per row in one pass to ensure chevron alignment).
      break;
    case 'checkbox':
      emitCheckbox(laid, theme, out);
      break;
    case 'radio':
      emitRadio(laid, theme, out);
      break;
    case 'toggle':
      emitToggle(laid, theme, out);
      break;
    case 'chip':
      emitChip(laid, theme, out);
      break;
    case 'avatar':
      emitAvatar(laid, theme, out);
      break;
    case 'spinner':
      emitSpinner(laid, theme, out);
      break;
    case 'status':
      emitStatus(laid, theme, out);
      break;
    case 'sheet':
      emitSheet(laid, theme, out);
      break;
  }
}

function emitSheet(laid: LaidOutNode, theme: Theme, out: string[]): void {
  // Outer sheet LaidOutNode is the scrim; its single child is the panel
  // (also kinded 'sheet'). See positionSheet in layout.ts for the structure.
  const node = laid.node as SheetNode;
  out.push(
    `<rect x="${laid.x}" y="${laid.y}" width="${laid.width}" height="${laid.height}" ` +
      `fill="${theme.sheetScrimColor}" opacity="${theme.sheetScrimOpacity}" />`,
  );
  const panel = laid.children[0];
  if (panel === undefined) return;
  emitSheetPanel(panel, node, theme, out);
}

function emitSheetPanel(
  panel: LaidOutNode,
  node: SheetNode,
  theme: Theme,
  out: string[],
): void {
  const r = theme.sheetCornerRadius;
  if (node.placement === 'bottom') {
    // Rounded top corners only — bottom edge flush with window bottom.
    const path = roundedTopRectPath(panel.x, panel.y, panel.width, panel.height, r);
    out.push(
      `<path d="${path}" fill="${theme.sheetBg}" stroke="${theme.sheetBorder}" stroke-width="${theme.sheetStrokeWidth}" />`,
    );
    // Grabber pill centered near the top.
    const gw = theme.sheetGrabberWidth;
    const gh = theme.sheetGrabberHeight;
    const gx = panel.x + (panel.width - gw) / 2;
    const gy = panel.y + theme.sheetPadding / 2 + theme.sheetGrabberGap / 2;
    out.push(
      `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="${gh / 2}" fill="${theme.sheetGrabberColor}" />`,
    );
  } else {
    // Center sheet — fully rounded floating rect.
    out.push(
      `<rect x="${panel.x + 0.5}" y="${panel.y + 0.5}" width="${panel.width - 1}" height="${panel.height - 1}" ` +
        `rx="${r}" ry="${r}" fill="${theme.sheetBg}" stroke="${theme.sheetBorder}" stroke-width="${theme.sheetStrokeWidth}" />`,
    );
  }

  if (node.title !== undefined) {
    const titleY =
      node.placement === 'bottom'
        ? panel.y + theme.sheetPadding + theme.sheetGrabberHeight + theme.sheetGrabberGap + theme.sheetTitleHeight * 0.7
        : panel.y + theme.sheetPadding + theme.sheetTitleHeight * 0.7;
    out.push(
      `<text x="${panel.x + panel.width / 2}" y="${titleY}" text-anchor="middle" ` +
        `font-size="${theme.sheetTitleFontSize}" font-weight="600" fill="${theme.textColor}">${escapeText(node.title)}</text>`,
    );
  }

  for (const c of panel.children) emitNode(c, theme, out);
}

/**
 * SVG path for a rectangle with rounded TOP corners only. Used for bottom
 * sheets, where the bottom edge should meet the window edge cleanly.
 */
function roundedTopRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): string {
  const r = Math.min(radius, width / 2, height);
  return (
    `M ${x} ${y + r} ` +
    `Q ${x} ${y} ${x + r} ${y} ` +
    `L ${x + width - r} ${y} ` +
    `Q ${x + width} ${y} ${x + width} ${y + r} ` +
    `L ${x + width} ${y + height} ` +
    `L ${x} ${y + height} Z`
  );
}

// ---------------------------------------------------------------------------
// v0.4.5 emitters
// ---------------------------------------------------------------------------

function emitTree(laid: LaidOutNode, theme: Theme, out: string[]): void {
  // Indent guides: one vertical line per nesting level covering the rows.
  // Derived from the row x-offsets (depth = (row.x - laid.x) / treeIndent).
  for (const row of laid.children) {
    emitNode(row, theme, out);
  }
}

function emitTreeNode(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as TreeItemNode;
  const isSelected = hasFlag(node.attributes, 'selected');
  const isCollapsed = hasFlag(node.attributes, 'collapsed');
  const hasChildren = node.children.length > 0;
  const iconName = getAttrString(node.attributes, 'icon');

  if (isSelected) {
    out.push(
      `<rect x="${laid.x}" y="${laid.y}" width="${laid.width}" height="${laid.height}" fill="${theme.treeSelectedBg}" rx="2" />`,
    );
  }

  let cursorX = laid.x + 4;
  const midY = laid.y + laid.height / 2;
  // Disclosure glyph (▸ / ▾) or 10px empty space for leaves.
  if (hasChildren) {
    const glyph = isCollapsed ? '▸' : '▾';
    out.push(
      `<text x="${cursorX}" y="${midY + theme.fontSize / 3}" font-size="${theme.smallFontSize}" fill="${theme.treeGlyphColor}">${glyph}</text>`,
    );
  }
  cursorX += 12;

  if (iconName && hasIcon(iconName)) {
    const iconSize = 14;
    const iconMarkup = emitIconByName(
      iconName,
      cursorX,
      midY - iconSize / 2,
      iconSize,
      theme.iconStrokeColor,
    );
    if (iconMarkup) out.push(iconMarkup);
    cursorX += iconSize + 4;
  }

  const textFill = isSelected ? theme.treeSelectedText : theme.textColor;
  out.push(
    `<text x="${cursorX}" y="${midY + theme.fontSize / 3}" fill="${textFill}">${escapeText(node.label)}</text>`,
  );
}

function emitMenubar(laid: LaidOutNode, theme: Theme, out: string[]): void {
  out.push(
    `<rect x="${laid.x}" y="${laid.y}" width="${laid.width}" height="${laid.height}" fill="${theme.menubarBgColor}" stroke="${theme.menubarBorderColor}" stroke-width="1" />`,
  );
  for (const m of laid.children) {
    const menu = m.node as MenuNode;
    out.push(
      `<text x="${m.x + theme.menubarItemPaddingX}" y="${m.y + m.height / 2 + theme.fontSize / 3}" fill="${theme.textColor}">${escapeText(menu.label)}</text>`,
    );
  }
}

function emitMenu(laid: LaidOutNode, theme: Theme, out: string[]): void {
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" fill="${theme.menuBgColor}" stroke="${theme.menuBorderColor}" stroke-width="1" rx="3" />`,
  );
  for (const c of laid.children) emitNode(c, theme, out);
}

function emitMenuItem(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as MenuItemNode;
  const isDisabled = hasFlag(node.attributes, 'disabled');
  const opacity = isDisabled ? '0.5' : '1';
  const midY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${laid.x + theme.menuItemPaddingX}" y="${midY}" opacity="${opacity}" fill="${theme.textColor}">${escapeText(node.label)}</text>`,
  );
  const shortcut = getAttrString(node.attributes, 'shortcut');
  if (shortcut !== undefined) {
    out.push(
      `<text x="${laid.x + laid.width - theme.menuItemPaddingX}" y="${midY}" text-anchor="end" opacity="${opacity}" font-size="${theme.smallFontSize}" fill="${theme.menuShortcutColor}">${escapeText(shortcut)}</text>`,
    );
  }
}

function emitMenuSeparator(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const midY = laid.y + laid.height / 2;
  out.push(
    `<line x1="${laid.x + 4}" y1="${midY}" x2="${laid.x + laid.width - 4}" y2="${midY}" stroke="${theme.menuSeparatorColor}" stroke-width="1" />`,
  );
}

function emitBreadcrumb(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const crumbs = laid.children;
  for (let i = 0; i < crumbs.length; i++) {
    const c = crumbs[i]!;
    const isLast = i === crumbs.length - 1;
    const node = c.node as CrumbNode;
    const iconName = getAttrString(node.attributes, 'icon');
    let labelX = c.x;
    const midY = c.y + c.height / 2 + theme.fontSize / 3;
    if (iconName && hasIcon(iconName)) {
      const iconSize = 14;
      const iconMarkup = emitIconByName(
        iconName,
        c.x,
        c.y + (c.height - iconSize) / 2,
        iconSize,
        theme.iconStrokeColor,
      );
      if (iconMarkup) out.push(iconMarkup);
      labelX += iconSize + 4;
    }
    const fill = isLast ? theme.breadcrumbCurrentColor : theme.mutedTextColor;
    const weight = isLast ? '600' : '400';
    out.push(
      `<text x="${labelX}" y="${midY}" font-weight="${weight}" fill="${fill}">${escapeText(node.label)}</text>`,
    );
    if (!isLast) {
      const chevX = c.x + c.width + theme.breadcrumbGap;
      out.push(
        `<text x="${chevX}" y="${midY}" fill="${theme.breadcrumbSeparatorColor}">›</text>`,
      );
    }
  }
}

function emitCheckbox(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as CheckboxNode;
  const checked = hasFlag(node.attributes, 'checked');
  const disabled = hasFlag(node.attributes, 'disabled');
  const labelRight = !hasFlag(node.attributes, 'label-right')
    ? false
    : true;
  // Default: label on left, control on right. `label-right` flips to common
  // form layout (control on left, label on right). This is a readability-in-
  // wireframes choice — form designers can flip per-row.
  const opacity = disabled ? '0.5' : '1';
  const size = theme.checkboxSize;
  const cy = laid.y + laid.height / 2 - size / 2;

  let controlX: number;
  let labelX: number;
  if (labelRight) {
    controlX = laid.x;
    labelX = controlX + size + theme.checkboxRowGap;
  } else {
    labelX = laid.x;
    controlX = laid.x + laid.width - size;
  }

  out.push(`<g opacity="${opacity}">`);
  out.push(
    `<rect x="${controlX + 0.5}" y="${cy + 0.5}" width="${size - 1}" height="${size - 1}" rx="2" fill="${theme.checkboxFillColor}" stroke="${theme.checkboxBorderColor}" stroke-width="1.2" />`,
  );
  if (checked) {
    out.push(
      `<path d="M ${controlX + size * 0.22} ${cy + size * 0.52} L ${controlX + size * 0.45} ${cy + size * 0.74} L ${controlX + size * 0.8} ${cy + size * 0.28}" fill="none" stroke="${theme.checkboxCheckColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`,
    );
  }
  const midY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${labelX}" y="${midY}" fill="${theme.textColor}">${escapeText(node.label)}</text>`,
  );
  out.push(`</g>`);
}

function emitRadio(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as RadioNode;
  const selected = hasFlag(node.attributes, 'selected');
  const disabled = hasFlag(node.attributes, 'disabled');
  const labelRight = hasFlag(node.attributes, 'label-right');
  const opacity = disabled ? '0.5' : '1';
  const size = theme.radioSize;
  const cy = laid.y + laid.height / 2;
  let controlCx: number;
  let labelX: number;
  if (labelRight) {
    controlCx = laid.x + size / 2;
    labelX = laid.x + size + theme.checkboxRowGap;
  } else {
    labelX = laid.x;
    controlCx = laid.x + laid.width - size / 2;
  }

  out.push(`<g opacity="${opacity}">`);
  out.push(
    `<circle cx="${controlCx}" cy="${cy}" r="${size / 2 - 0.5}" fill="${theme.checkboxFillColor}" stroke="${theme.checkboxBorderColor}" stroke-width="1.2" />`,
  );
  if (selected) {
    out.push(
      `<circle cx="${controlCx}" cy="${cy}" r="${size / 4}" fill="${theme.checkboxCheckColor}" />`,
    );
  }
  const midY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${labelX}" y="${midY}" fill="${theme.textColor}">${escapeText(node.label)}</text>`,
  );
  out.push(`</g>`);
}

function emitToggle(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ToggleNode;
  const on = hasFlag(node.attributes, 'on') && !hasFlag(node.attributes, 'off');
  const disabled = hasFlag(node.attributes, 'disabled');
  const labelRight = hasFlag(node.attributes, 'label-right');
  const opacity = disabled ? '0.5' : '1';
  const w = theme.toggleWidth;
  const h = theme.toggleHeight;
  const cy = laid.y + laid.height / 2 - h / 2;
  let controlX: number;
  let labelX: number;
  if (labelRight) {
    controlX = laid.x;
    labelX = laid.x + w + theme.checkboxRowGap;
  } else {
    labelX = laid.x;
    controlX = laid.x + laid.width - w;
  }

  const fill = on ? theme.toggleOnColor : theme.toggleOffColor;
  const knobR = h / 2 - 2;
  const knobCx = on ? controlX + w - knobR - 2 : controlX + knobR + 2;

  out.push(`<g opacity="${opacity}">`);
  out.push(
    `<rect x="${controlX}" y="${cy}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" />`,
  );
  out.push(
    `<circle cx="${knobCx}" cy="${cy + h / 2}" r="${knobR}" fill="${theme.toggleKnobColor}" />`,
  );
  const midY = laid.y + laid.height / 2 + theme.fontSize / 3;
  out.push(
    `<text x="${labelX}" y="${midY}" fill="${theme.textColor}">${escapeText(node.label)}</text>`,
  );
  out.push(`</g>`);
}

function emitChip(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ChipNode;
  const selected = hasFlag(node.attributes, 'selected');
  const closable = hasFlag(node.attributes, 'closable');
  const accent = getAccent(node.attributes, theme);
  const iconName = getAttrString(node.attributes, 'icon');

  let bg: string;
  let border: string;
  let textColor: string;
  if (selected) {
    bg = accent ?? theme.chipSelectedBg;
    border = accent ?? theme.chipSelectedBorder;
    textColor = theme.chipSelectedText;
  } else {
    bg = theme.chipBg;
    border = accent ?? theme.chipBorder;
    textColor = accent ?? theme.chipText;
  }

  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" rx="${laid.height / 2}" fill="${bg}" stroke="${border}" stroke-width="1" />`,
  );

  let cursorX = laid.x + theme.chipPaddingX;
  const midY = laid.y + laid.height / 2;

  if (iconName && hasIcon(iconName)) {
    const iconSize = 12;
    const iconMarkup = emitIconByName(
      iconName,
      cursorX,
      midY - iconSize / 2,
      iconSize,
      textColor,
    );
    if (iconMarkup) out.push(iconMarkup);
    cursorX += iconSize + 4;
  }

  out.push(
    `<text x="${cursorX}" y="${midY + theme.fontSize / 3}" font-size="${theme.smallFontSize}" fill="${textColor}">${escapeText(node.label)}</text>`,
  );

  if (closable) {
    const cx = laid.x + laid.width - theme.chipPaddingX - 4;
    out.push(
      `<line x1="${cx - 4}" y1="${midY - 4}" x2="${cx + 4}" y2="${midY + 4}" stroke="${textColor}" stroke-width="1.2" stroke-linecap="round" />`,
      `<line x1="${cx + 4}" y1="${midY - 4}" x2="${cx - 4}" y2="${midY + 4}" stroke="${textColor}" stroke-width="1.2" stroke-linecap="round" />`,
    );
  }
}

function emitAvatar(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as AvatarNode;
  const accent = getAccent(node.attributes, theme);
  const bg = accent ?? theme.avatarBg;
  const border = accent ?? theme.avatarBorder;
  const text = accent ? '#ffffff' : theme.avatarText;
  const cx = laid.x + laid.width / 2;
  const cy = laid.y + laid.height / 2;
  const r = laid.width / 2 - 0.5;

  out.push(
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="${border}" stroke-width="1" />`,
  );
  const initials = (node.initials || '?').slice(0, 2).toUpperCase();
  const fontSize = Math.max(10, Math.round(laid.width * 0.42));
  out.push(
    `<text x="${cx}" y="${cy + fontSize / 3}" text-anchor="middle" font-size="${fontSize}" font-weight="600" fill="${text}">${escapeText(initials)}</text>`,
  );
}

function emitSpinner(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as SpinnerNode;
  const cx = laid.x + theme.spinnerSize / 2;
  const cy = laid.y + laid.height / 2;
  const r = theme.spinnerSize / 2 - 2;
  // Dashed ring — implies motion without actually animating.
  out.push(
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${theme.spinnerColor}" stroke-width="1.6" stroke-dasharray="${r * 1.3} ${r * 0.9}" stroke-linecap="round" />`,
  );
  if (node.label !== undefined) {
    out.push(
      `<text x="${laid.x + theme.spinnerSize + theme.rowGap}" y="${cy + theme.fontSize / 3}" font-size="${theme.smallFontSize}" fill="${theme.mutedTextColor}">${escapeText(node.label)}</text>`,
    );
  }
}

function emitStatus(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as StatusNode;
  const kindRaw = getAttrIdent(node.attributes, 'kind') ?? 'info';
  const kind = (['success', 'info', 'warning', 'error'] as const).includes(
    kindRaw as 'success',
  )
    ? (kindRaw as 'success' | 'info' | 'warning' | 'error')
    : 'info';
  const style = theme.statusColors[kind];

  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" rx="${laid.height / 2}" fill="${style.bg}" stroke="${style.border}" stroke-width="1" />`,
  );

  const glyphX = laid.x + theme.statusPaddingX;
  const midY = laid.y + laid.height / 2;
  // Kind-specific glyph: check (success), info i (info), ! (warning), × (error).
  if (kind === 'success') {
    out.push(
      `<path d="M ${glyphX} ${midY} L ${glyphX + 4} ${midY + 4} L ${glyphX + 10} ${midY - 4}" fill="none" stroke="${style.border}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`,
    );
  } else if (kind === 'warning') {
    out.push(
      `<path d="M ${glyphX + 5} ${midY - 5} L ${glyphX + 10} ${midY + 4} L ${glyphX} ${midY + 4} Z" fill="none" stroke="${style.border}" stroke-width="1.4" stroke-linejoin="round" />`,
      `<line x1="${glyphX + 5}" y1="${midY - 1}" x2="${glyphX + 5}" y2="${midY + 2}" stroke="${style.border}" stroke-width="1.4" stroke-linecap="round" />`,
    );
  } else if (kind === 'error') {
    out.push(
      `<line x1="${glyphX}" y1="${midY - 4}" x2="${glyphX + 10}" y2="${midY + 4}" stroke="${style.border}" stroke-width="1.8" stroke-linecap="round" />`,
      `<line x1="${glyphX + 10}" y1="${midY - 4}" x2="${glyphX}" y2="${midY + 4}" stroke="${style.border}" stroke-width="1.8" stroke-linecap="round" />`,
    );
  } else {
    // info — small i glyph
    out.push(
      `<circle cx="${glyphX + 5}" cy="${midY - 4}" r="1.2" fill="${style.border}" />`,
      `<line x1="${glyphX + 5}" y1="${midY - 1}" x2="${glyphX + 5}" y2="${midY + 4}" stroke="${style.border}" stroke-width="1.6" stroke-linecap="round" />`,
    );
  }

  out.push(
    `<text x="${glyphX + 16}" y="${midY + theme.fontSize / 3}" font-size="${theme.smallFontSize}" font-weight="500" fill="${style.fg}">${escapeText(node.label)}</text>`,
  );
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
