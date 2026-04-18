/**
 * Layout engine for Wireloom (v0.2).
 *
 * Two-pass approach:
 *   1. Bottom-up `measure*` computes each node's intrinsic size.
 *   2. Top-down `position*` assigns absolute (x, y, width, height),
 *      distributing row slack across any `fill` columns and honoring
 *      `row align=…` for alignment.
 */

import type {
  AnyNode,
  AttributeFlag,
  AttributePair,
  AttributeValue,
  ButtonNode,
  ColNode,
  ComboNode,
  ContainerChild,
  DividerNode,
  FooterNode,
  HeaderNode,
  IconNode,
  ImageNode,
  InputNode,
  ItemNode,
  KvNode,
  ListNode,
  PanelNode,
  RowNode,
  SectionNode,
  SliderNode,
  SlotNode,
  TabNode,
  TabsNode,
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

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export function layout(root: WindowNode, theme: Theme): LaidOutNode {
  const measured = measureWindow(root, theme);
  return positionWindow(root, measured, 0, 0, theme);
}

// ---------------------------------------------------------------------------
// Measurement (bottom-up intrinsic sizes)
// ---------------------------------------------------------------------------

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
    case 'section':
      return measureSection(node, theme);
    case 'tabs':
      return measureTabs(node, theme);
    case 'row':
      return measureRow(node, theme);
    case 'col':
      return measureCol(node, theme);
    case 'list':
      return measureList(node, theme);
    case 'slot':
      return measureSlot(node, theme);
    case 'kv':
      return measureKv(node, theme);
    case 'combo':
      return measureCombo(node, theme);
    case 'slider':
      return measureSlider(theme);
    case 'image':
      return measureImage(node, theme);
    case 'icon':
      return measureIcon(theme);
  }
}

function measureText(node: TextNode, theme: Theme): Size {
  return {
    width: textWidth(node.content, node.attributes, theme),
    height: textLineHeight(node.attributes, theme),
  };
}

function measureButton(node: ButtonNode, theme: Theme): Size {
  const labelW = node.label.length * theme.averageCharWidth;
  const badgeW = badgeWidthOf(node.attributes, theme);
  return {
    width: labelW + theme.buttonPaddingX * 2 + (badgeW > 0 ? badgeW + theme.rowGap : 0),
    height: theme.buttonHeight,
  };
}

function measureInput(node: InputNode, theme: Theme): Size {
  const placeholder = getAttrString(node.attributes, 'placeholder');
  const textW = placeholder ? placeholder.length * theme.averageCharWidth : 0;
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

function measureSection(node: SectionNode, theme: Theme): Size {
  const inner = measureStack(node.children, theme, 'vertical');
  const titleRowW =
    node.title.length * theme.averageCharWidth +
    badgeWidthOf(node.attributes, theme) +
    theme.rowGap;
  return {
    width: Math.max(inner.width, titleRowW),
    height:
      theme.sectionTitleHeight +
      theme.sectionTitlePaddingBottom +
      inner.height +
      theme.panelPadding,
  };
}

function measureTabs(node: TabsNode, theme: Theme): Size {
  const sizes = node.children.map((t) => measureTab(t, theme));
  const total = sizes.reduce((acc, s) => acc + s.width, 0) +
    Math.max(0, node.children.length - 1) * theme.tabGap;
  return { width: total, height: theme.tabHeight };
}

function measureTab(node: TabNode, theme: Theme): Size {
  const labelW = node.label.length * theme.averageCharWidth;
  const badgeW = badgeWidthOf(node.attributes, theme);
  return {
    width: labelW + theme.tabPaddingX * 2 + (badgeW > 0 ? badgeW + 6 : 0),
    height: theme.tabHeight,
  };
}

function measureRow(node: RowNode, theme: Theme): Size {
  return measureStack(node.children, theme, 'horizontal');
}

function measureCol(node: ColNode, theme: Theme): Size {
  const inner = measureStack(node.children, theme, 'vertical');
  if (node.width.kind === 'length' && node.width.unit === 'px') {
    return { width: node.width.value, height: inner.height };
  }
  // `fill` — use max(content, colFillMinWidth) for parent-sizing purposes.
  // The actual width gets assigned during row positioning when slack is distributed.
  return {
    width: Math.max(inner.width, theme.colFillMinWidth),
    height: inner.height,
  };
}

function measureList(node: ListNode, theme: Theme): Size {
  if (node.children.length === 0) return { width: 0, height: 0 };
  let maxW = 0;
  let totalH = 0;
  for (const child of node.children) {
    const size = child.kind === 'item' ? measureItem(child, theme) : measureSlot(child, theme);
    if (size.width > maxW) maxW = size.width;
    totalH += size.height;
  }
  totalH += (node.children.length - 1) * theme.listGap;
  return { width: maxW, height: totalH };
}

function measureItem(node: ItemNode, theme: Theme): Size {
  const textW = node.text.length * theme.averageCharWidth;
  return {
    width: theme.bulletWidth + textW,
    height: theme.lineHeight,
  };
}

function measureSlot(node: SlotNode, theme: Theme): Size {
  const inner = measureStack(node.children, theme, 'vertical');
  const titleW = node.title.length * theme.averageCharWidth;
  return {
    width: Math.max(inner.width, titleW) + theme.slotPadding * 2,
    height:
      theme.slotTitleHeight +
      theme.sectionTitlePaddingBottom +
      inner.height +
      theme.slotPadding * 2,
  };
}

function measureKv(node: KvNode, theme: Theme): Size {
  const labelW = node.label.length * theme.averageCharWidth;
  const valueW = node.value.length * textSizeScale(node.attributes, theme) * theme.averageCharWidth;
  return {
    width: Math.max(theme.kvMinWidth, labelW + valueW + theme.rowGap * 3),
    height: textLineHeight(node.attributes, theme),
  };
}

function measureCombo(node: ComboNode, theme: Theme): Size {
  const value = getAttrString(node.attributes, 'value') ?? node.label ?? '';
  const textW = value.length * theme.averageCharWidth;
  return {
    width: Math.max(theme.comboMinWidth, textW + theme.inputPaddingX * 2 + theme.comboChevronWidth),
    height: theme.comboHeight,
  };
}

function measureSlider(theme: Theme): Size {
  return {
    width: theme.sliderDefaultWidth,
    height: theme.sliderHeight,
  };
}

function measureImage(node: ImageNode, theme: Theme): Size {
  const width = getAttrNumber(node.attributes, 'width') ?? theme.imageDefaultWidth;
  const height = getAttrNumber(node.attributes, 'height') ?? theme.imageDefaultHeight;
  return { width, height };
}

function measureIcon(theme: Theme): Size {
  return { width: theme.iconSize, height: theme.iconSize };
}

function measureStack(
  children: ContainerChild[],
  theme: Theme,
  direction: 'vertical' | 'horizontal',
): Size {
  if (children.length === 0) return { width: 0, height: 0 };
  const sizes = children.map((c) => measureChild(c, theme));
  if (direction === 'vertical') {
    const maxChildWidth = Math.max(
      0,
      ...sizes.map((s, i) => (children[i]?.kind === 'divider' ? 0 : s.width)),
    );
    const totalChildHeight = sizes.reduce((acc, s) => acc + s.height, 0);
    const gaps = Math.max(0, children.length - 1) * theme.colGap;
    return { width: maxChildWidth, height: totalChildHeight + gaps };
  }
  const totalChildWidth = sizes.reduce((acc, s) => acc + s.width, 0);
  const maxChildHeight = Math.max(0, ...sizes.map((s) => s.height));
  const gaps = Math.max(0, children.length - 1) * theme.rowGap;
  return { width: totalChildWidth + gaps, height: maxChildHeight };
}

// ---------------------------------------------------------------------------
// Window measurement (separate from generic because of title bar + header/footer)
// ---------------------------------------------------------------------------

interface WindowMeasurement {
  outer: Size;
  body: Size;
  headerHeight: number;
  footerHeight: number;
  hasTitleBar: boolean;
}

function measureWindow(node: WindowNode, theme: Theme): WindowMeasurement {
  const { header, footer, bodyChildren } = classifyWindowChildren(node);

  const bodyStack = measureStack(bodyChildren, theme, 'vertical');
  let bodyWidth = bodyStack.width;
  let bodyHeight = bodyStack.height;

  let headerHeight = 0;
  if (header) {
    const hs = measureHeaderOrFooter(header, theme, 'header');
    headerHeight = hs.height;
    bodyWidth = Math.max(bodyWidth, hs.width);
  }
  let footerHeight = 0;
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
    (hasTitleBar ? theme.titleBarHeight : 0) + headerHeight + bodySize.height + footerHeight;

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
  return node.children.every(
    (c) => c.kind === 'button' || c.kind === 'text' || c.kind === 'row',
  );
}

function classifyWindowChildren(node: WindowNode): {
  header: HeaderNode | undefined;
  footer: FooterNode | undefined;
  bodyChildren: ContainerChild[];
} {
  let header: HeaderNode | undefined;
  let footer: FooterNode | undefined;
  const bodyChildren: ContainerChild[] = [];
  for (const child of node.children) {
    if (child.kind === 'header') header = child;
    else if (child.kind === 'footer') footer = child;
    else bodyChildren.push(child);
  }
  return { header, footer, bodyChildren };
}

function titleWidth(title: string | undefined, theme: Theme): number {
  if (!title) return 0;
  return (
    title.length * (theme.averageCharWidth * (theme.titleFontSize / theme.fontSize)) +
    theme.windowPadding * 2
  );
}

// ---------------------------------------------------------------------------
// Position (top-down with width assignment + fill distribution)
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

  const { header, footer, bodyChildren } = classifyWindowChildren(node);

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

  const bodyY = cursorY;
  const bodyInnerX = x + theme.windowPadding;
  const bodyInnerY = bodyY + theme.windowPadding;
  const bodyInnerWidth = outerWidth - theme.windowPadding * 2;

  let innerCursorY = bodyInnerY;
  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i]!;
    const laidChild = positionContainerChild(child, bodyInnerX, innerCursorY, bodyInnerWidth, theme);
    childrenLaid.push(laidChild);
    innerCursorY += laidChild.height;
    if (i < bodyChildren.length - 1) innerCursorY += theme.colGap;
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
    const sizes = node.children.map((c) => measureChild(c, theme));
    const totalWidth =
      sizes.reduce((acc, s) => acc + s.width, 0) +
      Math.max(0, node.children.length - 1) * theme.rowGap;
    let cursorX = innerX + innerWidth - totalWidth;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const size = sizes[i]!;
      children.push(positionContainerChild(child, cursorX, innerY, size.width, theme));
      cursorX += size.width + theme.rowGap;
    }
  } else {
    let cursorY = innerY;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const size = measureChild(child, theme);
      const childX = kind === 'header' ? innerX + (innerWidth - size.width) / 2 : innerX;
      const childWidth = kind === 'header' ? size.width : innerWidth;
      const laidChild = positionContainerChild(child, childX, cursorY, childWidth, theme);
      children.push(laidChild);
      cursorY += laidChild.height;
      if (i < node.children.length - 1) cursorY += theme.colGap;
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
    case 'section':
      return positionSection(child, x, y, width, theme);
    case 'tabs':
      return positionTabs(child, x, y, width, theme);
    case 'row':
      return positionRow(child, x, y, width, theme);
    case 'col':
      return positionCol(child, x, y, width, theme);
    case 'list':
      return positionList(child, x, y, width, theme);
    case 'slot':
      return positionSlot(child, x, y, width, theme);
    case 'text':
      return positionText(child, x, y, width, theme);
    case 'button':
      return positionButton(child, x, y, theme);
    case 'input':
      return positionInput(child, x, y, width, theme);
    case 'combo':
      return positionCombo(child, x, y, width, theme);
    case 'slider':
      return positionSlider(child, x, y, width, theme);
    case 'kv':
      return positionKv(child, x, y, width, theme);
    case 'image':
      return positionImage(child, x, y, theme);
    case 'icon':
      return positionIcon(child, x, y, theme);
    case 'divider':
      return positionDivider(child, x, y, width, theme);
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
    if (i < node.children.length - 1) cursorY += theme.colGap;
  }
  const height = cursorY - y + theme.panelPadding;
  return { node, x, y, width, height, children };
}

function positionSection(
  node: SectionNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const innerX = x;
  const innerY = y + theme.sectionTitleHeight + theme.sectionTitlePaddingBottom;
  const innerWidth = width;

  const children: LaidOutNode[] = [];
  let cursorY = innerY;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const laidChild = positionContainerChild(child, innerX, cursorY, innerWidth, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) cursorY += theme.colGap;
  }
  const height = cursorY - y + theme.panelPadding;
  return { node, x, y, width, height, children };
}

function positionTabs(
  node: TabsNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const children: LaidOutNode[] = [];
  let cursorX = x;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const size = measureTab(child, theme);
    children.push({
      node: child,
      x: cursorX,
      y,
      width: size.width,
      height: size.height,
      children: [],
    });
    cursorX += size.width + theme.tabGap;
  }
  return { node, x, y, width, height: theme.tabHeight, children };
}

function positionRow(
  node: RowNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  // Pass 1: classify children and compute their base (measured) widths.
  const baseWidths: number[] = [];
  let fillCount = 0;
  for (const child of node.children) {
    if (child.kind === 'col' && child.width.kind === 'fill') {
      baseWidths.push(0);
      fillCount++;
    } else if (child.kind === 'col' && child.width.kind === 'length' && child.width.unit === 'px') {
      baseWidths.push(child.width.value);
    } else {
      baseWidths.push(measureChild(child, theme).width);
    }
  }

  const gapTotal = Math.max(0, node.children.length - 1) * theme.rowGap;
  const fixedTotal = baseWidths.reduce((acc, w) => acc + w, 0);
  const available = Math.max(0, width - fixedTotal - gapTotal);
  const fillWidth = fillCount > 0 ? available / fillCount : 0;

  // Assigned widths per child after fill distribution.
  const assignedWidths = node.children.map((child, i) => {
    if (child.kind === 'col' && child.width.kind === 'fill') {
      return Math.max(fillWidth, theme.colFillMinWidth);
    }
    return baseWidths[i] ?? 0;
  });

  // Compute effective row width (may exceed parent width if fill cols hit their minimum).
  const effectiveWidth =
    assignedWidths.reduce((acc, w) => acc + w, 0) + gapTotal;

  // Alignment only applies when there are no fill cols (fills consume all slack).
  const align = getAlign(node.attributes);
  let cursorX: number;
  if (fillCount > 0) {
    cursorX = x;
  } else if (align === 'right') {
    cursorX = x + width - effectiveWidth;
  } else if (align === 'center') {
    cursorX = x + (width - effectiveWidth) / 2;
  } else {
    cursorX = x;
  }

  const children: LaidOutNode[] = [];
  let maxHeight = 0;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const childWidth = assignedWidths[i] ?? 0;
    const laidChild = positionContainerChild(child, cursorX, y, childWidth, theme);
    children.push(laidChild);
    cursorX += childWidth;
    if (laidChild.height > maxHeight) maxHeight = laidChild.height;
    if (i < node.children.length - 1) cursorX += theme.rowGap;
  }

  return {
    node,
    x,
    y,
    width: Math.max(width, effectiveWidth),
    height: maxHeight,
    children,
  };
}

function positionCol(
  node: ColNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const colWidth =
    node.width.kind === 'length' && node.width.unit === 'px' ? node.width.value : width;
  const children: LaidOutNode[] = [];
  let cursorY = y;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const laidChild = positionContainerChild(child, x, cursorY, colWidth, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) cursorY += theme.colGap;
  }
  return { node, x, y, width: colWidth, height: cursorY - y, children };
}

function positionList(
  node: ListNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const children: LaidOutNode[] = [];
  let cursorY = y;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const laidChild =
      child.kind === 'item'
        ? positionItem(child, x, cursorY, width, theme)
        : positionSlot(child, x, cursorY, width, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) cursorY += theme.listGap;
  }
  return { node, x, y, width, height: cursorY - y, children };
}

function positionItem(
  node: ItemNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  return {
    node,
    x,
    y,
    width,
    height: theme.lineHeight,
    children: [],
  };
}

function positionSlot(
  node: SlotNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const innerX = x + theme.slotPadding;
  const innerY = y + theme.slotPadding + theme.slotTitleHeight + theme.sectionTitlePaddingBottom;
  const innerWidth = width - theme.slotPadding * 2;

  const children: LaidOutNode[] = [];
  let cursorY = innerY;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const laidChild = positionContainerChild(child, innerX, cursorY, innerWidth, theme);
    children.push(laidChild);
    cursorY += laidChild.height;
    if (i < node.children.length - 1) cursorY += theme.colGap;
  }
  const height = cursorY - y + theme.slotPadding;
  return { node, x, y, width, height, children };
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
    width: textWidth(node.content, node.attributes, theme),
    height: textLineHeight(node.attributes, theme),
    children: [],
  };
}

function positionButton(node: ButtonNode, x: number, y: number, theme: Theme): LaidOutNode {
  const size = measureButton(node, theme);
  return {
    node,
    x,
    y,
    width: size.width,
    height: size.height,
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
  const size = measureInput(node, theme);
  return {
    node,
    x,
    y,
    width: Math.max(size.width, Math.min(width, theme.inputMinWidth * 2)),
    height: theme.inputHeight,
    children: [],
  };
}

function positionCombo(
  node: ComboNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const size = measureCombo(node, theme);
  return {
    node,
    x,
    y,
    width: Math.max(size.width, Math.min(width, 320)),
    height: theme.comboHeight,
    children: [],
  };
}

function positionSlider(
  node: SliderNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  return {
    node,
    x,
    y,
    width: Math.max(theme.sliderDefaultWidth, Math.min(width, 360)),
    height: theme.sliderHeight,
    children: [],
  };
}

function positionKv(
  node: KvNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  return {
    node,
    x,
    y,
    width,
    height: textLineHeight(node.attributes, theme),
    children: [],
  };
}

function positionImage(node: ImageNode, x: number, y: number, theme: Theme): LaidOutNode {
  const size = measureImage(node, theme);
  return { node, x, y, width: size.width, height: size.height, children: [] };
}

function positionIcon(node: IconNode, x: number, y: number, theme: Theme): LaidOutNode {
  return { node, x, y, width: theme.iconSize, height: theme.iconSize, children: [] };
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

// ---------------------------------------------------------------------------
// Attribute / typography helpers
// ---------------------------------------------------------------------------

function getAttr(attrs: readonly unknown[], key: string): AttributeValue | undefined {
  for (const a of attrs) {
    const attr = a as AttributeFlag | AttributePair;
    if (attr.kind === 'pair' && attr.key === key) return attr.value;
  }
  return undefined;
}

function getAttrString(attrs: readonly unknown[], key: string): string | undefined {
  const v = getAttr(attrs, key);
  return v?.kind === 'string' ? v.value : undefined;
}

function getAttrNumber(attrs: readonly unknown[], key: string): number | undefined {
  const v = getAttr(attrs, key);
  return v?.kind === 'number' ? v.value : undefined;
}

function getAttrIdent(attrs: readonly unknown[], key: string): string | undefined {
  const v = getAttr(attrs, key);
  return v?.kind === 'identifier' ? v.value : undefined;
}

function getAlign(attrs: readonly unknown[]): 'left' | 'center' | 'right' {
  const v = getAttrIdent(attrs, 'align');
  if (v === 'center' || v === 'right' || v === 'left') return v;
  return 'left';
}

function textSizeScale(attrs: readonly unknown[], theme: Theme): number {
  const size = getAttrIdent(attrs, 'size');
  if (size === 'small') return theme.smallFontSize / theme.fontSize;
  if (size === 'large') return theme.largeFontSize / theme.fontSize;
  return 1;
}

function textWidth(content: string, attrs: readonly unknown[], theme: Theme): number {
  return content.length * theme.averageCharWidth * textSizeScale(attrs, theme);
}

function textLineHeight(attrs: readonly unknown[], theme: Theme): number {
  const scale = textSizeScale(attrs, theme);
  return theme.lineHeight * scale;
}

function badgeWidthOf(attrs: readonly unknown[], theme: Theme): number {
  const badge = getAttrString(attrs, 'badge');
  if (badge === undefined) return 0;
  return badge.length * theme.averageCharWidth * (theme.badgeFontSize / theme.fontSize) +
    theme.badgePaddingX * 2;
}
