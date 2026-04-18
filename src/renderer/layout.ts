/**
 * Layout engine for Wireloom.
 *
 * Two-pass approach:
 *   1. Bottom-up `measure()` computes each node's intrinsic size based on
 *      its content and children.
 *   2. Top-down `layout()` assigns absolute (x, y, width, height) to every
 *      node starting from the window root.
 *
 * v0.1 uses intrinsic sizing throughout — containers hug their content.
 * Future work ("fill" columns, flex weights) happens here without changing
 * the SVG emitter or the parser.
 */

import type {
  AnyNode,
  ButtonNode,
  ColNode,
  ContainerChild,
  DividerNode,
  FooterNode,
  HeaderNode,
  InputNode,
  PanelNode,
  RowNode,
  TextNode,
  WindowNode,
} from '../parser/ast.js';
import type { Theme } from './themes.js';

export interface LaidOutNode {
  node: AnyNode;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LaidOutNode[];
}

interface Size {
  width: number;
  height: number;
}

export function layout(root: WindowNode, theme: Theme): LaidOutNode {
  const measured = measureWindow(root, theme);
  return positionWindow(root, measured, 0, 0, theme);
}

/**
 * Compute the intrinsic size of any container child.
 */
function measureChild(node: ContainerChild, theme: Theme): Size {
  switch (node.kind) {
    case 'text':
      return measureText(node, theme);
    case 'button':
      return measureButton(node, theme);
    case 'input':
      return measureInput(node, theme);
    case 'divider':
      return measureDivider(theme);
    case 'panel':
      return measurePanel(node, theme);
    case 'row':
      return measureRow(node, theme);
    case 'col':
      return measureCol(node, theme);
    // v0.2 primitives — stub measurements. Full layout in the layout todo.
    case 'section':
      return measurePanel({ ...node, kind: 'panel' } as PanelNode, theme);
    case 'tabs':
      return { width: 200, height: theme.buttonHeight + 4 };
    case 'list':
      return measurePanel({ ...node, kind: 'panel' } as PanelNode, theme);
    case 'slot':
      return measurePanel({ ...node, kind: 'panel' } as PanelNode, theme);
    case 'kv':
      return { width: 240, height: theme.lineHeight };
    case 'combo':
      return { width: theme.inputMinWidth, height: theme.inputHeight };
    case 'slider':
      return { width: 220, height: theme.lineHeight + 4 };
    case 'image':
      return { width: 120, height: 80 };
    case 'icon':
      return { width: 20, height: 20 };
  }
}

function measureText(node: TextNode, theme: Theme): Size {
  return {
    width: textWidth(node.content, theme),
    height: theme.lineHeight,
  };
}

function measureButton(node: ButtonNode, theme: Theme): Size {
  return {
    width: textWidth(node.label, theme) + theme.buttonPaddingX * 2,
    height: theme.buttonHeight,
  };
}

function measureInput(node: InputNode, theme: Theme): Size {
  const placeholder = placeholderOf(node);
  const textW = placeholder ? textWidth(placeholder, theme) : 0;
  return {
    width: Math.max(theme.inputMinWidth, textW + theme.inputPaddingX * 2),
    height: theme.inputHeight,
  };
}

function measureDivider(theme: Theme): Size {
  return { width: 0, height: theme.dividerHeight };
}

function measurePanel(node: PanelNode, theme: Theme): Size {
  const inner = measureStack(node.children, theme, 'vertical');
  return {
    width: inner.width + theme.panelPadding * 2,
    height: inner.height + theme.panelPadding * 2,
  };
}

function measureRow(node: RowNode, theme: Theme): Size {
  return measureStack(node.children, theme, 'horizontal');
}

function measureCol(node: ColNode, theme: Theme): Size {
  const inner = measureStack(node.children, theme, 'vertical');
  // Explicit pixel width overrides intrinsic sizing.
  if (node.width.kind === 'length' && node.width.unit === 'px') {
    return { width: node.width.value, height: inner.height };
  }
  return inner;
}

/** Layout a list of children as a row or column, returning intrinsic size. */
function measureStack(
  children: ContainerChild[],
  theme: Theme,
  direction: 'vertical' | 'horizontal',
): Size {
  if (children.length === 0) return { width: 0, height: 0 };
  const sizes = children.map((c) => measureChild(c, theme));
  if (direction === 'vertical') {
    // Dividers stretch to parent width; don't count their 0 intrinsic width
    // against the max content width.
    const maxChildWidth = Math.max(
      0,
      ...sizes.map((s, i) => (children[i]?.kind === 'divider' ? 0 : (s?.width ?? 0))),
    );
    const totalChildHeight = sizes.reduce((acc, s) => acc + (s?.height ?? 0), 0);
    const gaps = (children.length - 1) * theme.colGap;
    return { width: maxChildWidth, height: totalChildHeight + gaps };
  }
  // horizontal
  const totalChildWidth = sizes.reduce((acc, s) => acc + s.width, 0);
  const maxChildHeight = Math.max(0, ...sizes.map((s) => s.height));
  const gaps = (children.length - 1) * theme.rowGap;
  return { width: totalChildWidth + gaps, height: maxChildHeight };
}

/**
 * Compute window intrinsic size including title bar and chrome bands.
 */
interface WindowMeasurement {
  outer: Size;
  body: Size;
  headerHeight: number;
  footerHeight: number;
  hasTitleBar: boolean;
}

function measureWindow(node: WindowNode, theme: Theme): WindowMeasurement {
  let bodyWidth = 0;
  let bodyHeight = 0;
  let headerHeight = 0;
  let footerHeight = 0;

  const bodyChildren: ContainerChild[] = [];
  let header: HeaderNode | undefined;
  let footer: FooterNode | undefined;

  for (const child of node.children) {
    if (child.kind === 'header') header = child;
    else if (child.kind === 'footer') footer = child;
    else bodyChildren.push(child);
  }

  const bodyStack = measureStack(bodyChildren, theme, 'vertical');
  bodyWidth = bodyStack.width;
  bodyHeight = bodyStack.height;

  if (header) {
    const hs = measureHeaderOrFooter(header, theme, 'header');
    headerHeight = hs.height;
    bodyWidth = Math.max(bodyWidth, hs.width);
  }
  if (footer) {
    const fs = measureHeaderOrFooter(footer, theme, 'footer');
    footerHeight = fs.height;
    bodyWidth = Math.max(bodyWidth, fs.width);
  }

  const hasTitleBar = node.title !== undefined;

  const padding = theme.windowPadding;
  const bodySize: Size = {
    width: bodyWidth + padding * 2,
    height: bodyHeight + padding * 2,
  };

  const outerWidth = Math.max(bodySize.width, titleWidth(node.title, theme));
  const outerHeight =
    (hasTitleBar ? theme.titleBarHeight : 0) +
    headerHeight +
    bodySize.height +
    footerHeight;

  return {
    outer: { width: outerWidth, height: outerHeight },
    body: bodySize,
    headerHeight,
    footerHeight,
    hasTitleBar,
  };
}

function measureHeaderOrFooter(
  node: HeaderNode | FooterNode,
  theme: Theme,
  kind: 'header' | 'footer',
): Size {
  // Treat header as vertical stack (most examples use single text lines).
  // Treat footer as horizontal if all children are buttons; else vertical.
  const direction = footerHorizontal(node, kind) ? 'horizontal' : 'vertical';
  const inner = measureStack(node.children, theme, direction);
  const padY = kind === 'header' ? theme.headerPaddingY : theme.footerPaddingY;
  return {
    width: inner.width + theme.windowPadding * 2,
    height: inner.height + padY * 2,
  };
}

function footerHorizontal(node: HeaderNode | FooterNode, kind: 'header' | 'footer'): boolean {
  if (kind !== 'footer') return false;
  if (node.children.length === 0) return false;
  return node.children.every((c) => c.kind === 'button' || c.kind === 'text');
}

function titleWidth(title: string | undefined, theme: Theme): number {
  if (!title) return 0;
  return (
    title.length * (theme.averageCharWidth * (theme.titleFontSize / theme.fontSize)) +
    theme.windowPadding * 2
  );
}

function textWidth(text: string, theme: Theme): number {
  return text.length * theme.averageCharWidth;
}

function placeholderOf(node: InputNode): string | undefined {
  const pair = node.attributes.find(
    (a) => a.kind === 'pair' && a.key === 'placeholder',
  );
  if (pair?.kind === 'pair' && pair.value.kind === 'string') {
    return pair.value.value;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Position pass
// ---------------------------------------------------------------------------

function positionWindow(
  node: WindowNode,
  m: WindowMeasurement,
  x: number,
  y: number,
  theme: Theme,
): LaidOutNode {
  const childrenLaid: LaidOutNode[] = [];
  const outerWidth = m.outer.width;
  let cursorY = y;

  if (m.hasTitleBar) {
    cursorY += theme.titleBarHeight;
  }

  const bodyChildren: ContainerChild[] = [];
  let header: HeaderNode | undefined;
  let footer: FooterNode | undefined;
  for (const child of node.children) {
    if (child.kind === 'header') header = child;
    else if (child.kind === 'footer') footer = child;
    else bodyChildren.push(child);
  }

  if (header) {
    const laidHeader = positionHeaderOrFooter(
      header,
      'header',
      x,
      cursorY,
      outerWidth,
      m.headerHeight,
      theme,
    );
    childrenLaid.push(laidHeader);
    cursorY += m.headerHeight;
  }

  // Body region
  const bodyY = cursorY;
  const bodyInnerX = x + theme.windowPadding;
  const bodyInnerY = bodyY + theme.windowPadding;
  const bodyInnerWidth = outerWidth - theme.windowPadding * 2;

  let innerCursorY = bodyInnerY;
  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i]!;
    const laidChild = positionContainerChild(
      child,
      bodyInnerX,
      innerCursorY,
      bodyInnerWidth,
      theme,
    );
    childrenLaid.push(laidChild);
    innerCursorY += laidChild.height;
    if (i < bodyChildren.length - 1) {
      innerCursorY += theme.colGap;
    }
  }

  const bodyEndY = bodyY + m.body.height;
  cursorY = bodyEndY;

  if (footer) {
    const laidFooter = positionHeaderOrFooter(
      footer,
      'footer',
      x,
      cursorY,
      outerWidth,
      m.footerHeight,
      theme,
    );
    childrenLaid.push(laidFooter);
    cursorY += m.footerHeight;
  }

  return {
    node,
    x,
    y,
    width: outerWidth,
    height: m.outer.height,
    children: childrenLaid,
  };
}

function positionHeaderOrFooter(
  node: HeaderNode | FooterNode,
  kind: 'header' | 'footer',
  x: number,
  y: number,
  width: number,
  height: number,
  theme: Theme,
): LaidOutNode {
  const horizontal = footerHorizontal(node, kind);
  const padY = kind === 'header' ? theme.headerPaddingY : theme.footerPaddingY;
  const innerX = x + theme.windowPadding;
  const innerY = y + padY;
  const innerWidth = width - theme.windowPadding * 2;

  const children: LaidOutNode[] = [];
  if (horizontal) {
    // Right-align for footers with only buttons/text.
    const sizes = node.children.map((c) => measureChild(c, theme));
    const totalWidth =
      sizes.reduce((acc, s) => acc + s.width, 0) +
      (node.children.length - 1) * theme.rowGap;
    let cursorX = innerX + innerWidth - totalWidth;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const size = sizes[i]!;
      const laidChild = positionContainerChild(
        child,
        cursorX,
        innerY,
        size.width,
        theme,
      );
      children.push(laidChild);
      cursorX += size.width + theme.rowGap;
    }
  } else {
    // Vertical stacking, centered horizontally for header single-line content.
    let cursorY = innerY;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const size = measureChild(child, theme);
      let childX = innerX;
      if (kind === 'header') {
        childX = innerX + (innerWidth - size.width) / 2;
      }
      const laidChild = positionContainerChild(
        child,
        childX,
        cursorY,
        size.width,
        theme,
      );
      children.push(laidChild);
      cursorY += laidChild.height;
      if (i < node.children.length - 1) {
        cursorY += theme.colGap;
      }
    }
  }

  return { node, x, y, width, height, children };
}

function positionContainerChild(
  child: ContainerChild,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  switch (child.kind) {
    case 'panel':
      return positionPanel(child, x, y, width, theme);
    case 'row':
      return positionRow(child, x, y, width, theme);
    case 'col':
      return positionCol(child, x, y, width, theme);
    case 'text':
      return positionText(child, x, y, width, theme);
    case 'button':
      return positionButton(child, x, y, theme);
    case 'input':
      return positionInput(child, x, y, width, theme);
    case 'divider':
      return positionDivider(child, x, y, width, theme);
    // v0.2 primitives — stub positions. Real layout lands in the layout todo.
    case 'section':
    case 'list':
    case 'slot':
    case 'tabs': {
      const size = measureChild(child, theme);
      return { node: child, x, y, width, height: size.height, children: [] };
    }
    case 'kv':
    case 'combo':
    case 'slider':
    case 'image':
    case 'icon': {
      const size = measureChild(child, theme);
      return { node: child, x, y, width: size.width, height: size.height, children: [] };
    }
  }
}

function positionPanel(
  node: PanelNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const innerX = x + theme.panelPadding;
  const innerY = y + theme.panelPadding;
  const innerWidth = width - theme.panelPadding * 2;

  const children: LaidOutNode[] = [];
  let cursorY = innerY;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const laidChild = positionContainerChild(child, innerX, cursorY, innerWidth, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) {
      cursorY += theme.colGap;
    }
  }

  const height = cursorY - y + theme.panelPadding;
  return { node, x, y, width, height, children };
}

function positionRow(
  node: RowNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  // Intrinsic row layout: each child uses its own measured width.
  const children: LaidOutNode[] = [];
  let cursorX = x;
  let maxHeight = 0;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const size = measureChild(child, theme);
    const laidChild = positionContainerChild(child, cursorX, y, size.width, theme);
    children.push(laidChild);
    cursorX += laidChild.width;
    if (laidChild.height > maxHeight) maxHeight = laidChild.height;
    if (i < node.children.length - 1) {
      cursorX += theme.rowGap;
    }
  }
  void width;
  return { node, x, y, width: cursorX - x, height: maxHeight, children };
}

function positionCol(
  node: ColNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const colWidth =
    node.width.kind === 'length' && node.width.unit === 'px'
      ? node.width.value
      : measureCol(node, theme).width;
  const children: LaidOutNode[] = [];
  let cursorY = y;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const laidChild = positionContainerChild(child, x, cursorY, colWidth, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) {
      cursorY += theme.colGap;
    }
  }
  void width;
  return { node, x, y, width: colWidth, height: cursorY - y, children };
}

function positionText(
  node: TextNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  void width;
  return {
    node,
    x,
    y,
    width: textWidth(node.content, theme),
    height: theme.lineHeight,
    children: [],
  };
}

function positionButton(node: ButtonNode, x: number, y: number, theme: Theme): LaidOutNode {
  return {
    node,
    x,
    y,
    width: textWidth(node.label, theme) + theme.buttonPaddingX * 2,
    height: theme.buttonHeight,
    children: [],
  };
}

function positionInput(
  node: InputNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const placeholder = placeholderOf(node);
  const textW = placeholder ? textWidth(placeholder, theme) : 0;
  const finalWidth = Math.max(
    theme.inputMinWidth,
    textW + theme.inputPaddingX * 2,
    width,
  );
  return {
    node,
    x,
    y,
    width: finalWidth,
    height: theme.inputHeight,
    children: [],
  };
}

function positionDivider(
  node: DividerNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  return { node, x, y, width, height: theme.dividerHeight, children: [] };
}
