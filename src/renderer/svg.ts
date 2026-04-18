/**
 * SVG emitter — walks a LaidOutNode tree and produces an SVG string.
 *
 * Output is self-contained: inline attributes only, no external CSS or
 * font references. Consumers can drop the SVG straight into innerHTML
 * or save it to a file. Any SVG-compatible viewer (browsers, GitHub,
 * Obsidian, Notion) can render it without additional setup.
 */

import type {
  AttributeFlag,
  ButtonNode,
  InputNode,
  TextNode,
  WindowNode,
} from '../parser/ast.js';
import type { LaidOutNode } from './layout.js';
import type { Theme } from './themes.js';

export interface EmitOptions {
  id?: string;
}

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
    case 'row':
    case 'col':
      // Layout-only containers — just recurse into children.
      for (const c of laid.children) emitNode(c, theme, out);
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
    case 'divider':
      emitDivider(laid, theme, out);
      break;
  }
}

function emitWindow(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as WindowNode;
  // Outer border
  out.push(
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="none" stroke="${theme.windowBorderColor}" stroke-width="${theme.windowStrokeWidth}" />`,
  );
  // Title bar
  if (node.title !== undefined) {
    const titleBarY = laid.y + theme.titleBarHeight;
    // Bottom line of title bar
    out.push(
      `<line x1="${laid.x}" y1="${titleBarY}" x2="${laid.x + laid.width}" y2="${titleBarY}" ` +
        `stroke="${theme.chromeLineColor}" stroke-width="${theme.chromeStrokeWidth}" />`,
    );
    const titleY = laid.y + theme.titleBarHeight / 2 + theme.titleFontSize / 3;
    out.push(
      `<text x="${laid.x + laid.width / 2}" y="${titleY}" ` +
        `text-anchor="middle" font-size="${theme.titleFontSize}" ` +
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

function emitText(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as TextNode;
  const baseline = laid.y + theme.lineHeight * 0.75;
  out.push(
    `<text x="${laid.x}" y="${baseline}" fill="${theme.textColor}">${escapeText(node.content)}</text>`,
  );
}

function emitButton(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as ButtonNode;
  const isPrimary = hasFlag(node.attributes, 'primary');
  const isDisabled = hasFlag(node.attributes, 'disabled');
  const fill = isPrimary ? theme.primaryButtonFill : theme.buttonFill;
  const text = isPrimary ? theme.primaryButtonText : theme.buttonText;
  const stroke = isDisabled ? theme.disabledColor : theme.buttonBorderColor;
  const opacity = isDisabled ? '0.55' : '1';

  out.push(
    `<g opacity="${opacity}">`,
    `<rect x="${laid.x + 0.5}" y="${laid.y + 0.5}" width="${laid.width - 1}" height="${laid.height - 1}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="${theme.buttonStrokeWidth}" rx="3" />`,
    `<text x="${laid.x + laid.width / 2}" y="${laid.y + laid.height / 2 + theme.fontSize / 3}" ` +
      `text-anchor="middle" fill="${isDisabled ? theme.disabledColor : text}">${escapeText(node.label)}</text>`,
    `</g>`,
  );
}

function emitInput(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const node = laid.node as InputNode;
  const placeholder = getAttributeString(node, 'placeholder') ?? '';
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
  void node;
}

function emitDivider(laid: LaidOutNode, theme: Theme, out: string[]): void {
  const y = laid.y + laid.height / 2;
  out.push(
    `<line x1="${laid.x}" y1="${y}" x2="${laid.x + laid.width}" y2="${y}" ` +
      `stroke="${theme.dividerColor}" stroke-width="${theme.dividerStrokeWidth}" />`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasFlag(attrs: readonly { kind: string }[], name: string): boolean {
  return attrs.some((a) => a.kind === 'flag' && (a as AttributeFlag).flag === name);
}

function getAttributeString(
  node: { attributes: readonly unknown[] },
  key: string,
): string | undefined {
  for (const a of node.attributes) {
    const attr = a as
      | { kind: 'pair'; key: string; value: { kind: string; value: unknown } }
      | { kind: 'flag' };
    if (attr.kind === 'pair' && attr.key === key) {
      const val = attr.value;
      if (val.kind === 'string' && typeof val.value === 'string') {
        return val.value;
      }
    }
  }
  return undefined;
}

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
