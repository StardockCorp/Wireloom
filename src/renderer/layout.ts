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
  AnnotationNode,
  AnnotationSide,
  AnyNode,
  Attribute,
  AttributeFlag,
  AttributePair,
  AttributeValue,
  AvatarNode,
  BreadcrumbNode,
  ButtonNode,
  CellNode,
  ChartNode,
  CheckboxNode,
  ChipNode,
  ColNode,
  ComboNode,
  ContainerChild,
  CrumbNode,
  DividerNode,
  Document,
  FooterNode,
  GridNode,
  HeaderNode,
  IconNode,
  ImageNode,
  InputNode,
  ItemNode,
  KvNode,
  ListNode,
  MenubarNode,
  MenuNode,
  NavbarNode,
  NavbarSlotNode,
  PanelNode,
  ProgressNode,
  RadioNode,
  ResourceBarNode,
  ResourceNode,
  RowNode,
  SectionNode,
  SliderNode,
  SlotFooterNode,
  SlotNode,
  SpacerNode,
  SpinnerNode,
  StatNode,
  StatsNode,
  StatusNode,
  TabNode,
  TabsNode,
  TextNode,
  ToggleNode,
  TreeItemNode,
  TreeNode_,
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

/**
 * A laid-out annotation: box rect + the two endpoints for its leader line.
 * Coordinates are in the same absolute canvas space as `LaidOutNode`.
 */
export interface LaidAnnotation {
  node: AnnotationNode;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Text lines (already split on `\n`) for SVG emit. */
  lines: string[];
  /** Leader-line endpoint attached to the annotation box. */
  boxAnchor: { x: number; y: number };
  /** Leader-line endpoint attached to the target element. */
  targetAnchor: { x: number; y: number };
}

/**
 * Full laid-out document: the window tree plus any annotations, with
 * an outer canvas size that already accounts for annotation margins.
 */
export interface LaidDocument {
  canvasWidth: number;
  canvasHeight: number;
  root: LaidOutNode;
  annotations: LaidAnnotation[];
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

/**
 * Lay out a parsed document into absolute coordinates.
 *
 * The window is placed inside a canvas large enough to hold its annotation
 * margins. Annotations with targets that can't be resolved are silently
 * dropped — surface that as a warning in calling tools if desired.
 */
export function layout(doc: Document, theme: Theme): LaidDocument {
  if (!doc.root) {
    return { canvasWidth: 0, canvasHeight: 0, root: emptyLaidOut(), annotations: [] };
  }

  const measured = measureWindow(doc.root, theme);
  const windowSize: Size = measured.outer;

  const annotations = doc.annotations ?? [];
  if (annotations.length === 0) {
    // Fast path — identical to pre-v0.4 behavior.
    const laidRoot = positionWindow(doc.root, measured, 0, 0, theme);
    return {
      canvasWidth: windowSize.width,
      canvasHeight: windowSize.height,
      root: laidRoot,
      annotations: [],
    };
  }

  // Group annotations by side so we can size margins independently.
  const bySide: Record<AnnotationSide, AnnotationNode[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };
  for (const a of annotations) bySide[a.side].push(a);

  // Measure each annotation box once; reused during margin sizing + stacking.
  const measuredBoxes = new Map<AnnotationNode, MeasuredAnnotation>();
  for (const a of annotations) {
    measuredBoxes.set(a, measureAnnotation(a, theme));
  }

  const marginLeft = sideMargin('left', bySide.left, measuredBoxes, theme);
  const marginRight = sideMargin('right', bySide.right, measuredBoxes, theme);
  const marginTop = sideMargin('top', bySide.top, measuredBoxes, theme);
  const marginBottom = sideMargin('bottom', bySide.bottom, measuredBoxes, theme);

  // Horizontal side margins may need to expand to fit stacked top/bottom
  // annotations if the window itself is narrower than the top/bottom stack.
  const topStackWidth = stackMainAxis('top', bySide.top, measuredBoxes, theme);
  const bottomStackWidth = stackMainAxis('bottom', bySide.bottom, measuredBoxes, theme);
  const contentWidth = Math.max(windowSize.width, topStackWidth, bottomStackWidth);

  const leftStackHeight = stackMainAxis('left', bySide.left, measuredBoxes, theme);
  const rightStackHeight = stackMainAxis('right', bySide.right, measuredBoxes, theme);
  const contentHeight = Math.max(windowSize.height, leftStackHeight, rightStackHeight);

  const canvasWidth = marginLeft + contentWidth + marginRight;
  const canvasHeight = marginTop + contentHeight + marginBottom;

  const windowX = marginLeft + (contentWidth - windowSize.width) / 2;
  const windowY = marginTop + (contentHeight - windowSize.height) / 2;

  const laidRoot = positionWindow(doc.root, measured, windowX, windowY, theme);

  // Build id → rect map by walking the laid tree.
  const idMap = buildIdMap(laidRoot);

  const laidAnnotations: LaidAnnotation[] = [];
  for (const side of ['left', 'right', 'top', 'bottom'] as const) {
    const placed = placeAnnotationsOnSide(
      side,
      bySide[side],
      measuredBoxes,
      idMap,
      { x: windowX, y: windowY, width: windowSize.width, height: windowSize.height },
      canvasWidth,
      canvasHeight,
      theme,
    );
    laidAnnotations.push(...placed);
  }

  return {
    canvasWidth,
    canvasHeight,
    root: laidRoot,
    annotations: laidAnnotations,
  };
}

function emptyLaidOut(): LaidOutNode {
  return {
    node: {
      kind: 'window',
      attributes: [],
      children: [],
      position: { line: 1, column: 1 },
    } as WindowNode,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    children: [],
  };
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
    case 'spacer':
      return measureSpacer();
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
    case 'grid':
      return measureGrid(node, theme);
    case 'resourcebar':
      return measureResourceBar(node, theme);
    case 'stats':
      return measureStats(node, theme);
    case 'progress':
      return measureProgress(node, theme);
    case 'chart':
      return measureChart(node, theme);
    case 'tree':
      return measureTree(node, theme);
    case 'menubar':
      return measureMenubar(node, theme);
    case 'menu':
      return measureMenu(node, theme);
    case 'breadcrumb':
      return measureBreadcrumb(node, theme);
    case 'checkbox':
      return measureCheckbox(node, theme);
    case 'radio':
      return measureRadio(node, theme);
    case 'toggle':
      return measureToggle(node, theme);
    case 'chip':
      return measureChip(node, theme);
    case 'avatar':
      return measureAvatar(node, theme);
    case 'spinner':
      return measureSpinner(node, theme);
    case 'status':
      return measureStatus(node, theme);
  }
}

// --- v0.4.5 measurements --------------------------------------------------

function measureTree(node: TreeNode_, theme: Theme): Size {
  let maxW = 0;
  let totalRows = 0;
  const walk = (n: TreeItemNode, depth: number): void => {
    totalRows++;
    const labelW = n.label.length * theme.averageCharWidth;
    const rowW = depth * theme.treeIndent + theme.treeIndent + labelW;
    if (rowW > maxW) maxW = rowW;
    const collapsed = hasFlagAttr(n.attributes, 'collapsed');
    if (!collapsed) {
      for (const child of n.children) walk(child, depth + 1);
    }
  };
  for (const n of node.children) walk(n, 0);
  return { width: maxW, height: totalRows * theme.treeRowHeight };
}

function measureMenubar(node: MenubarNode, theme: Theme): Size {
  const totalW = node.children.reduce(
    (acc, m) => acc + m.label.length * theme.averageCharWidth + theme.menubarItemPaddingX * 2,
    0,
  );
  return { width: totalW, height: theme.menubarHeight };
}

function measureMenu(node: MenuNode, theme: Theme): Size {
  // Standalone menu renders as a dropdown box with its items. Width is
  // max(menuWidth, widest row). Height is items * row + 1px border.
  let maxLabel = node.label.length * theme.averageCharWidth;
  let itemCount = 0;
  for (const c of node.children) {
    if (c.kind === 'menuitem') {
      const shortcut = getAttrString(c.attributes, 'shortcut');
      const rowW =
        c.label.length * theme.averageCharWidth +
        (shortcut ? shortcut.length * theme.averageCharWidth + 24 : 0);
      if (rowW > maxLabel) maxLabel = rowW;
      itemCount++;
    } else if (c.kind === 'separator') {
      itemCount++;
    } else if (c.kind === 'menu') {
      const rowW = c.label.length * theme.averageCharWidth + 24;
      if (rowW > maxLabel) maxLabel = rowW;
      itemCount++;
    }
  }
  const width = Math.max(theme.menuWidth, maxLabel + theme.menuItemPaddingX * 2);
  const height = itemCount * theme.menuItemHeight + 4; // border padding
  return { width, height };
}

function measureBreadcrumb(node: BreadcrumbNode, theme: Theme): Size {
  if (node.children.length === 0) return { width: 0, height: theme.breadcrumbHeight };
  const labels = node.children.map(
    (c) => c.label.length * theme.averageCharWidth + (getAttrString(c.attributes, 'icon') ? theme.iconSize + 4 : 0),
  );
  const total =
    labels.reduce((a, b) => a + b, 0) +
    (node.children.length - 1) * (theme.breadcrumbGap * 2 + 8); // chevron width
  return { width: total, height: theme.breadcrumbHeight };
}

function measureCheckbox(node: CheckboxNode, theme: Theme): Size {
  const labelW = node.label.length * theme.averageCharWidth;
  return {
    width: theme.checkboxSize + theme.checkboxRowGap + labelW,
    height: Math.max(theme.checkboxSize, theme.lineHeight),
  };
}

function measureRadio(node: RadioNode, theme: Theme): Size {
  const labelW = node.label.length * theme.averageCharWidth;
  return {
    width: theme.radioSize + theme.checkboxRowGap + labelW,
    height: Math.max(theme.radioSize, theme.lineHeight),
  };
}

function measureToggle(node: ToggleNode, theme: Theme): Size {
  const labelW = node.label.length * theme.averageCharWidth;
  return {
    width: theme.toggleWidth + theme.checkboxRowGap + labelW,
    height: Math.max(theme.toggleHeight, theme.lineHeight),
  };
}

function measureChip(node: ChipNode, theme: Theme): Size {
  const labelW = node.label.length * theme.averageCharWidth;
  const iconExtra = getAttrString(node.attributes, 'icon') ? 16 : 0;
  const closeExtra = hasFlagAttr(node.attributes, 'closable') ? 16 : 0;
  return {
    width: labelW + iconExtra + closeExtra + theme.chipPaddingX * 2,
    height: theme.chipHeight,
  };
}

function measureAvatar(node: AvatarNode, theme: Theme): Size {
  const sizeName = getAttrIdent(node.attributes, 'size') ?? 'medium';
  const size =
    sizeName === 'small'
      ? theme.avatarSizeSmall
      : sizeName === 'large'
        ? theme.avatarSizeLarge
        : theme.avatarSizeMedium;
  return { width: size, height: size };
}

function measureSpinner(node: SpinnerNode, theme: Theme): Size {
  const labelW = node.label ? node.label.length * theme.averageCharWidth + theme.checkboxRowGap : 0;
  return {
    width: theme.spinnerSize + labelW,
    height: Math.max(theme.spinnerSize, theme.lineHeight),
  };
}

function measureStatus(node: StatusNode, theme: Theme): Size {
  const labelW = node.label.length * theme.averageCharWidth;
  return {
    width: labelW + 14 + theme.statusPaddingX * 2, // icon glyph + padding
    height: theme.statusHeight,
  };
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

function measureSpacer(): Size {
  // Spacer's intrinsic size is zero on both axes. Its rendered width comes
  // from the row's slack-distribution pass; it contributes no height so it
  // never forces the row taller than its other children.
  return { width: 0, height: 0 };
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
  let footerH = 0;
  let footerW = 0;
  if (node.slotFooter) {
    const f = measureSlotFooter(node.slotFooter, theme);
    footerH = f.height + theme.colGap;
    footerW = f.width;
  }
  return {
    width: Math.max(inner.width, titleW, footerW) + theme.slotPadding * 2,
    height:
      theme.slotTitleHeight +
      theme.sectionTitlePaddingBottom +
      inner.height +
      footerH +
      theme.slotPadding * 2,
  };
}

function measureSlotFooter(node: SlotFooterNode, theme: Theme): Size {
  return measureStack(node.children, theme, 'horizontal');
}

// --- Grid / Cell ----------------------------------------------------------

function measureGrid(node: GridNode, theme: Theme): Size {
  const cellSize = preferredCellSize(node, theme);
  const width = node.cols * cellSize.width + (node.cols - 1) * theme.rowGap;
  const height = node.rows * cellSize.height + (node.rows - 1) * theme.colGap;
  return { width, height };
}

function preferredCellSize(node: GridNode, theme: Theme): Size {
  // Cell size is the max intrinsic of any child cell, with a minimum for
  // aesthetic consistency (matrix-style grids look odd if cells are tiny).
  let maxW = theme.cellMinSize;
  let maxH = theme.cellMinSize;
  for (const c of node.children) {
    const s = measureCell(c, theme);
    if (s.width > maxW) maxW = s.width;
    if (s.height > maxH) maxH = s.height;
  }
  return { width: maxW, height: maxH };
}

function measureCell(node: CellNode, theme: Theme): Size {
  const inner = measureStack(node.children, theme, 'vertical');
  const labelW = node.label ? node.label.length * theme.averageCharWidth : 0;
  const labelH = node.label ? theme.lineHeight : 0;
  return {
    width: Math.max(inner.width, labelW) + theme.cellPadding * 2,
    height: inner.height + labelH + theme.cellPadding * 2,
  };
}

// --- ResourceBar ----------------------------------------------------------

function measureResourceBar(node: ResourceBarNode, theme: Theme): Size {
  if (node.children.length === 0) {
    return { width: 0, height: theme.resourceBarHeight };
  }
  const sizes = node.children.map((r) => measureResource(r, theme));
  const total = sizes.reduce((acc, s) => acc + s.width, 0) +
    (node.children.length - 1) * theme.resourceBarItemGap;
  return { width: total, height: theme.resourceBarHeight };
}

function measureResource(node: ResourceNode, theme: Theme): Size {
  const text = `${node.name}: ${node.value}`;
  const textW = text.length * theme.averageCharWidth;
  // Icon + small gap + text
  return {
    width: theme.resourceBarIconSize + 6 + textW,
    height: theme.resourceBarHeight,
  };
}

// --- Stats ----------------------------------------------------------------

function measureStats(node: StatsNode, theme: Theme): Size {
  if (node.children.length === 0) return { width: 0, height: 0 };
  const sizes = node.children.map((s) => measureStat(s, theme));
  const total = sizes.reduce((acc, s) => acc + s.width, 0) +
    (node.children.length - 1) * theme.statsGap;
  const h = Math.max(...sizes.map((s) => s.height));
  return { width: total, height: h };
}

function measureStat(node: StatNode, theme: Theme): Size {
  // "LABEL value" — inline compact form.
  const labelW = node.label.length * theme.averageCharWidth * (theme.smallFontSize / theme.fontSize);
  const valueW = node.value.length * theme.averageCharWidth;
  return {
    width: labelW + 6 + valueW,
    height: theme.lineHeight,
  };
}

// --- Progress / Chart -----------------------------------------------------

function measureProgress(node: ProgressNode, theme: Theme): Size {
  const label = getAttrString(node.attributes, 'label');
  const labelH = label !== undefined ? theme.smallFontSize + 4 : 0;
  return {
    width: theme.progressDefaultWidth,
    height: labelH + theme.progressHeight,
  };
}

function measureChart(node: ChartNode, theme: Theme): Size {
  const width = getAttrNumber(node.attributes, 'width') ?? theme.chartDefaultWidth;
  const height = getAttrNumber(node.attributes, 'height') ?? theme.chartDefaultHeight;
  return { width, height };
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
  navbarHeight: number;
  footerHeight: number;
  hasTitleBar: boolean;
}

function measureWindow(node: WindowNode, theme: Theme): WindowMeasurement {
  const { header, navbar, footer, bodyChildren } = classifyWindowChildren(node);

  const bodyStack = measureStack(bodyChildren, theme, 'vertical');
  let bodyWidth = bodyStack.width;
  let bodyHeight = bodyStack.height;

  let headerHeight = 0;
  if (header) {
    const hs = measureHeaderOrFooter(header, theme, 'header');
    headerHeight = hs.height;
    bodyWidth = Math.max(bodyWidth, hs.width);
  }
  let navbarHeight = 0;
  if (navbar) {
    const ns = measureNavbar(navbar, theme);
    navbarHeight = ns.height;
    bodyWidth = Math.max(bodyWidth, ns.width);
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
    (hasTitleBar ? theme.titleBarHeight : 0) +
    headerHeight +
    navbarHeight +
    bodySize.height +
    footerHeight;

  return {
    outer: { width: outerWidth, height: outerHeight },
    body: bodySize,
    headerHeight,
    navbarHeight,
    footerHeight,
    hasTitleBar,
  };
}

/**
 * Measure a navbar's intrinsic size. Width is `leading + trailing` plus
 * window padding (the central spacer's width is variable). Height is the
 * tallest slot child plus chrome-band vertical padding, with a floor of
 * the standard button height so an empty-ish navbar still reads as a band.
 */
function measureNavbar(node: NavbarNode, theme: Theme): Size {
  const leadingSize = node.leading
    ? measureStack(node.leading.children, theme, 'horizontal')
    : { width: 0, height: 0 };
  const trailingSize = node.trailing
    ? measureStack(node.trailing.children, theme, 'horizontal')
    : { width: 0, height: 0 };
  const innerHeight = Math.max(leadingSize.height, trailingSize.height, theme.buttonHeight);
  const minGap = leadingSize.width > 0 && trailingSize.width > 0 ? theme.rowGap : 0;
  return {
    width: leadingSize.width + trailingSize.width + minGap + theme.windowPadding * 2,
    height: innerHeight + theme.headerPaddingY * 2,
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
  navbar: NavbarNode | undefined;
  footer: FooterNode | undefined;
  bodyChildren: ContainerChild[];
} {
  let header: HeaderNode | undefined;
  let navbar: NavbarNode | undefined;
  let footer: FooterNode | undefined;
  const bodyChildren: ContainerChild[] = [];
  for (const child of node.children) {
    if (child.kind === 'header') header = child;
    else if (child.kind === 'navbar') navbar = child;
    else if (child.kind === 'footer') footer = child;
    else bodyChildren.push(child as ContainerChild);
  }
  return { header, navbar, footer, bodyChildren };
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

  const { header, navbar, footer, bodyChildren } = classifyWindowChildren(node);

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

  if (navbar) {
    const laidNavbar = positionNavbar(navbar, x, cursorY, outerWidth, m.navbarHeight, theme);
    childrenLaid.push(laidNavbar);
    cursorY += m.navbarHeight;
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

/**
 * Lay out a navbar as a chrome band: leading children anchor to the left of
 * the inner padding, trailing children anchor to the right. Each child is
 * vertically centered within the band's content area.
 */
function positionNavbar(
  node: NavbarNode,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: Theme,
): LaidOutNode {
  const innerX = x + theme.windowPadding;
  const innerY = y + theme.headerPaddingY;
  const innerWidth = width - theme.windowPadding * 2;
  const innerHeight = height - theme.headerPaddingY * 2;

  const slotChildren: LaidOutNode[] = [];
  if (node.leading) {
    slotChildren.push(
      positionNavbarSlot(node.leading, innerX, innerY, innerHeight, theme, 'left'),
    );
  }
  if (node.trailing) {
    const trailingRight = innerX + innerWidth;
    slotChildren.push(
      positionNavbarSlot(node.trailing, trailingRight, innerY, innerHeight, theme, 'right'),
    );
  }
  return { node, x, y, width, height, children: slotChildren };
}

function positionNavbarSlot(
  node: NavbarSlotNode,
  anchorX: number,
  innerY: number,
  innerHeight: number,
  theme: Theme,
  anchor: 'left' | 'right',
): LaidOutNode {
  const sizes = node.children.map((c) => measureChild(c, theme));
  const totalChildWidth =
    sizes.reduce((acc, s) => acc + s.width, 0) +
    Math.max(0, node.children.length - 1) * theme.rowGap;

  let cursorX = anchor === 'left' ? anchorX : anchorX - totalChildWidth;
  const slotX = cursorX;
  const childrenLaid: LaidOutNode[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const size = sizes[i]!;
    const childY = innerY + (innerHeight - size.height) / 2;
    childrenLaid.push(positionContainerChild(child, cursorX, childY, size.width, theme));
    cursorX += size.width;
    if (i < node.children.length - 1) cursorX += theme.rowGap;
  }
  return {
    node,
    x: slotX,
    y: innerY,
    width: totalChildWidth,
    height: innerHeight,
    children: childrenLaid,
  };
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
    case 'spacer':
      return positionSpacer(child, x, y, width);
    case 'grid':
      return positionGrid(child, x, y, width, theme);
    case 'resourcebar':
      return positionResourceBar(child, x, y, width, theme);
    case 'stats':
      return positionStats(child, x, y, width, theme);
    case 'progress':
      return positionProgress(child, x, y, width, theme);
    case 'chart':
      return positionChart(child, x, y, theme);
    case 'tree':
      return positionTree(child, x, y, width, theme);
    case 'menubar':
      return positionMenubar(child, x, y, width, theme);
    case 'menu':
      return positionMenu(child, x, y, width, theme);
    case 'breadcrumb':
      return positionBreadcrumb(child, x, y, width, theme);
    case 'checkbox':
      return positionLeaf(child, x, y, measureCheckbox(child, theme));
    case 'radio':
      return positionLeaf(child, x, y, measureRadio(child, theme));
    case 'toggle':
      return positionLeaf(child, x, y, measureToggle(child, theme));
    case 'chip':
      return positionLeaf(child, x, y, measureChip(child, theme));
    case 'avatar':
      return positionLeaf(child, x, y, measureAvatar(child, theme));
    case 'spinner':
      return positionLeaf(child, x, y, measureSpinner(child, theme));
    case 'status':
      return positionLeaf(child, x, y, measureStatus(child, theme));
  }
}

function positionLeaf(
  node: AnyNode,
  x: number,
  y: number,
  size: Size,
): LaidOutNode {
  return { node, x, y, width: size.width, height: size.height, children: [] };
}

function positionTree(
  node: TreeNode_,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  // Flatten tree into rows; each row is a leaf LaidOutNode whose node is the
  // TreeItemNode. Depth is packed into x-offset so the SVG emitter can paint
  // indent guides directly from the row rect.
  const rows: LaidOutNode[] = [];
  const walk = (n: TreeItemNode, depth: number): void => {
    const rowX = x + depth * theme.treeIndent;
    rows.push({
      node: n,
      x: rowX,
      y: y + rows.length * theme.treeRowHeight,
      width: width - depth * theme.treeIndent,
      height: theme.treeRowHeight,
      children: [],
    });
    const collapsed = hasFlagAttr(n.attributes, 'collapsed');
    if (!collapsed) {
      for (const c of n.children) walk(c, depth + 1);
    }
  };
  for (const n of node.children) walk(n, 0);
  const height = rows.length * theme.treeRowHeight;
  return { node, x, y, width, height, children: rows };
}

function positionMenubar(
  node: MenubarNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const children: LaidOutNode[] = [];
  let cursorX = x;
  for (const menu of node.children) {
    const w = menu.label.length * theme.averageCharWidth + theme.menubarItemPaddingX * 2;
    children.push({
      node: menu,
      x: cursorX,
      y,
      width: w,
      height: theme.menubarHeight,
      children: [],
    });
    cursorX += w;
  }
  return { node, x, y, width, height: theme.menubarHeight, children };
}

function positionMenu(
  node: MenuNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  void width;
  const size = measureMenu(node, theme);
  const children: LaidOutNode[] = [];
  let cursorY = y + 2;
  for (const c of node.children) {
    const rowH = theme.menuItemHeight;
    children.push({
      node: c,
      x: x + 2,
      y: cursorY,
      width: size.width - 4,
      height: rowH,
      children: [],
    });
    cursorY += rowH;
  }
  return { node, x, y, width: size.width, height: size.height, children };
}

function positionBreadcrumb(
  node: BreadcrumbNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  void width;
  const children: LaidOutNode[] = [];
  let cursorX = x;
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i] as CrumbNode;
    const iconW = getAttrString(c.attributes, 'icon') ? theme.iconSize + 4 : 0;
    const w = iconW + c.label.length * theme.averageCharWidth;
    children.push({
      node: c,
      x: cursorX,
      y,
      width: w,
      height: theme.breadcrumbHeight,
      children: [],
    });
    cursorX += w;
    if (i < node.children.length - 1) cursorX += theme.breadcrumbGap * 2 + 8;
  }
  return {
    node,
    x,
    y,
    width: cursorX - x,
    height: theme.breadcrumbHeight,
    children,
  };
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
  // `col fill` and `spacer` both get base width 0 — their real width comes
  // from distributing slack in pass 2.
  const baseWidths: number[] = [];
  let fillCount = 0;
  let spacerCount = 0;
  for (const child of node.children) {
    if (child.kind === 'col' && child.width.kind === 'fill') {
      baseWidths.push(0);
      fillCount++;
    } else if (child.kind === 'col' && child.width.kind === 'length' && child.width.unit === 'px') {
      baseWidths.push(child.width.value);
    } else if (child.kind === 'spacer') {
      baseWidths.push(0);
      spacerCount++;
    } else {
      baseWidths.push(measureChild(child, theme).width);
    }
  }

  const gapTotal = Math.max(0, node.children.length - 1) * theme.rowGap;
  const fixedTotal = baseWidths.reduce((acc, w) => acc + w, 0);
  const available = Math.max(0, width - fixedTotal - gapTotal);
  const fillWidth = fillCount > 0 ? available / fillCount : 0;
  // Spacers only consume slack when there are no fills — fills win precedence.
  const spacerWidth = fillCount === 0 && spacerCount > 0 ? available / spacerCount : 0;

  // Assigned widths per child after slack distribution.
  const assignedWidths = node.children.map((child, i) => {
    if (child.kind === 'col' && child.width.kind === 'fill') {
      return Math.max(fillWidth, theme.colFillMinWidth);
    }
    if (child.kind === 'spacer') {
      return Math.max(spacerWidth, 0);
    }
    return baseWidths[i] ?? 0;
  });

  // Compute effective row width (may exceed parent width if fill cols hit their minimum).
  const effectiveWidth =
    assignedWidths.reduce((acc, w) => acc + w, 0) + gapTotal;

  // Slack that will be consumed by `justify=…` when it applies. When fills or
  // explicit spacers are present, they already ate the slack — justify is a
  // no-op and alignment falls back to start.
  const justify = getJustify(node.attributes);
  const align = getAlign(node.attributes);
  const justifyActive =
    fillCount === 0 && spacerCount === 0 && justify !== 'start';
  const slack = Math.max(0, width - effectiveWidth);

  let cursorX: number;
  let extraGapBetween = 0;
  if (fillCount > 0 || spacerCount > 0) {
    cursorX = x;
  } else if (justifyActive) {
    const n = node.children.length;
    if (justify === 'end') {
      cursorX = x + slack;
    } else if (justify === 'between') {
      cursorX = x;
      extraGapBetween = n > 1 ? slack / (n - 1) : 0;
    } else {
      // 'around' — equal space on both sides of each child (half-units at edges).
      const unit = n > 0 ? slack / (2 * n) : 0;
      cursorX = x + unit;
      extraGapBetween = 2 * unit;
    }
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
    if (i < node.children.length - 1) cursorX += theme.rowGap + extraGapBetween;
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

  if (node.slotFooter) {
    cursorY += theme.colGap;
    const laidFooter = positionSlotFooter(
      node.slotFooter,
      innerX,
      cursorY,
      innerWidth,
      theme,
    );
    children.push(laidFooter);
    cursorY += laidFooter.height;
  }

  const height = cursorY - y + theme.slotPadding;
  return { node, x, y, width, height, children };
}

function positionSlotFooter(
  node: SlotFooterNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  // Right-align children horizontally.
  const sizes = node.children.map((c) => measureChild(c, theme));
  const totalWidth =
    sizes.reduce((acc, s) => acc + s.width, 0) +
    Math.max(0, node.children.length - 1) * theme.rowGap;
  let cursorX = x + width - totalWidth;
  const children: LaidOutNode[] = [];
  let maxH = 0;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const size = sizes[i]!;
    const laid = positionContainerChild(child, cursorX, y, size.width, theme);
    children.push(laid);
    if (laid.height > maxH) maxH = laid.height;
    cursorX += size.width + theme.rowGap;
  }
  return { node, x, y, width, height: maxH, children };
}

function positionGrid(
  node: GridNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  void width;
  const cellSize = preferredCellSize(node, theme);
  const children: LaidOutNode[] = [];

  // Auto-flow tracker: walks cells L→R, T→B, skipping positions already
  // claimed by explicit row/col attributes.
  const claimed = new Set<string>();
  for (const c of node.children) {
    if (c.row !== undefined && c.col !== undefined) {
      claimed.add(`${c.row}:${c.col}`);
    }
  }
  let flowRow = 1;
  let flowCol = 1;
  const advanceFlow = (): void => {
    while (true) {
      if (flowCol > node.cols) {
        flowCol = 1;
        flowRow++;
      }
      if (flowRow > node.rows) return;
      if (!claimed.has(`${flowRow}:${flowCol}`)) return;
      flowCol++;
    }
  };

  for (const cell of node.children) {
    let r = cell.row;
    let c = cell.col;
    if (r === undefined || c === undefined) {
      advanceFlow();
      r = flowRow;
      c = flowCol;
      flowCol++;
    }
    // Clamp into grid bounds so out-of-range explicit positions still render.
    const clampedR = Math.min(Math.max(1, r), node.rows);
    const clampedC = Math.min(Math.max(1, c), node.cols);
    const cellX = x + (clampedC - 1) * (cellSize.width + theme.rowGap);
    const cellY = y + (clampedR - 1) * (cellSize.height + theme.colGap);
    children.push(positionCell(cell, cellX, cellY, cellSize.width, cellSize.height, theme));
  }

  return {
    node,
    x,
    y,
    width: node.cols * cellSize.width + (node.cols - 1) * theme.rowGap,
    height: node.rows * cellSize.height + (node.rows - 1) * theme.colGap,
    children,
  };
}

function positionCell(
  node: CellNode,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: Theme,
): LaidOutNode {
  const innerX = x + theme.cellPadding;
  const innerWidth = width - theme.cellPadding * 2;
  let cursorY = y + theme.cellPadding;
  if (node.label !== undefined) {
    cursorY += theme.lineHeight;
  }
  const children: LaidOutNode[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const laid = positionContainerChild(child, innerX, cursorY, innerWidth, theme);
    children.push(laid);
    cursorY += laid.height;
    if (i < node.children.length - 1) cursorY += theme.colGap;
  }
  return { node, x, y, width, height, children };
}

function positionResourceBar(
  node: ResourceBarNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  void width;
  const sizes = node.children.map((r) => measureResource(r, theme));
  const children: LaidOutNode[] = [];
  let cursorX = x;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const size = sizes[i]!;
    children.push({
      node: child,
      x: cursorX,
      y,
      width: size.width,
      height: size.height,
      children: [],
    });
    cursorX += size.width + theme.resourceBarItemGap;
  }
  return {
    node,
    x,
    y,
    width: cursorX - x - (node.children.length > 0 ? theme.resourceBarItemGap : 0),
    height: theme.resourceBarHeight,
    children,
  };
}

function positionStats(
  node: StatsNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  void width;
  const sizes = node.children.map((s) => measureStat(s, theme));
  const children: LaidOutNode[] = [];
  let cursorX = x;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const size = sizes[i]!;
    children.push({
      node: child,
      x: cursorX,
      y,
      width: size.width,
      height: size.height,
      children: [],
    });
    cursorX += size.width + theme.statsGap;
  }
  const used = node.children.length > 0 ? cursorX - x - theme.statsGap : 0;
  return { node, x, y, width: used, height: theme.lineHeight, children };
}

function positionProgress(
  node: ProgressNode,
  x: number,
  y: number,
  width: number,
  theme: Theme,
): LaidOutNode {
  const size = measureProgress(node, theme);
  // Expand to available width up to a reasonable cap so progress bars can stretch.
  const w = Math.max(size.width, Math.min(width, theme.progressMaxWidth));
  return { node, x, y, width: w, height: size.height, children: [] };
}

function positionChart(
  node: ChartNode,
  x: number,
  y: number,
  theme: Theme,
): LaidOutNode {
  const size = measureChart(node, theme);
  return { node, x, y, width: size.width, height: size.height, children: [] };
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

function positionSpacer(
  node: SpacerNode,
  x: number,
  y: number,
  width: number,
): LaidOutNode {
  // Spacer has zero intrinsic height so it never makes the row taller; width
  // is whatever the row-layout pass assigned from the slack budget.
  return { node, x, y, width, height: 0, children: [] };
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

function hasFlagAttr(attrs: readonly unknown[], flag: string): boolean {
  for (const a of attrs) {
    const attr = a as AttributeFlag | AttributePair;
    if (attr.kind === 'flag' && attr.flag === flag) return true;
  }
  return false;
}

function getAlign(attrs: readonly unknown[]): 'left' | 'center' | 'right' {
  const v = getAttrIdent(attrs, 'align');
  if (v === 'center' || v === 'right' || v === 'left') return v;
  return 'left';
}

function getJustify(
  attrs: readonly unknown[],
): 'start' | 'between' | 'around' | 'end' {
  const v = getAttrIdent(attrs, 'justify');
  if (v === 'between' || v === 'around' || v === 'end' || v === 'start') return v;
  return 'start';
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

// ---------------------------------------------------------------------------
// Annotations — measurement, margin sizing, placement
// ---------------------------------------------------------------------------

interface MeasuredAnnotation {
  width: number;
  height: number;
  lines: string[];
}

function measureAnnotation(node: AnnotationNode, theme: Theme): MeasuredAnnotation {
  const lines = node.body.split('\n');
  // Box sizes to its longest line. Authors control wrapping with literal "\n" —
  // no hidden word-wrap at render time, so the output is predictable when
  // machine-generated.
  const contentWidth = Math.max(...lines.map((l) => l.length * theme.averageCharWidth));
  const width = contentWidth + theme.annotationPaddingX * 2;
  const height = lines.length * theme.lineHeight + theme.annotationPaddingY * 2;
  return { width, height, lines };
}

/**
 * Returns the thickness of the canvas margin on `side` — how much canvas
 * has to extend beyond the window edge to hold stacked annotation boxes
 * plus the leader-line gap. Zero if there are no annotations on this side.
 */
function sideMargin(
  side: AnnotationSide,
  list: AnnotationNode[],
  measured: Map<AnnotationNode, MeasuredAnnotation>,
  theme: Theme,
): number {
  if (list.length === 0) return 0;
  if (side === 'left' || side === 'right') {
    const maxW = Math.max(...list.map((a) => measured.get(a)!.width));
    return maxW + theme.annotationGap + theme.annotationMargin;
  }
  const maxH = Math.max(...list.map((a) => measured.get(a)!.height));
  return maxH + theme.annotationGap + theme.annotationMargin;
}

/**
 * Total extent along the main axis (i.e. along the window edge) needed to
 * stack this side's annotations without overlap. Used to grow the canvas
 * perpendicular dimension when top/bottom stacks exceed window width (or
 * left/right stacks exceed window height).
 */
function stackMainAxis(
  side: AnnotationSide,
  list: AnnotationNode[],
  measured: Map<AnnotationNode, MeasuredAnnotation>,
  theme: Theme,
): number {
  if (list.length === 0) return 0;
  const dims = list.map((a) => measured.get(a)!);
  const gapTotal = (list.length - 1) * theme.annotationStackGap;
  if (side === 'left' || side === 'right') {
    return dims.reduce((acc, d) => acc + d.height, 0) + gapTotal;
  }
  return dims.reduce((acc, d) => acc + d.width, 0) + gapTotal;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Walk the laid-out tree collecting `id → rect` entries. The first occurrence
 * of each id wins; duplicates are silently ignored. Ids come from the
 * universal `id="…"` attribute on any node.
 */
function buildIdMap(root: LaidOutNode): Map<string, Rect> {
  const out = new Map<string, Rect>();
  const stack: LaidOutNode[] = [root];
  while (stack.length > 0) {
    const n = stack.pop()!;
    const id = getAttrString((n.node as { attributes?: Attribute[] }).attributes ?? [], 'id');
    if (id !== undefined && !out.has(id)) {
      out.set(id, { x: n.x, y: n.y, width: n.width, height: n.height });
    }
    for (const c of n.children) stack.push(c);
  }
  return out;
}

/**
 * Lay out the annotations for one side, producing boxes + leader endpoints.
 * Strategy:
 *   1. Assign each box a preferred center aligned with its target's center
 *      (along the relevant axis — y for left/right, x for top/bottom).
 *   2. Sort by preferred center, then greedily push overlapping boxes along
 *      the axis until the stack is collision-free.
 *   3. Clamp box positions to the canvas bounds so none fall off.
 *   4. Compute leader-line endpoints (target edge midpoint → box edge).
 *
 * Annotations whose target id doesn't resolve are dropped.
 */
function placeAnnotationsOnSide(
  side: AnnotationSide,
  list: AnnotationNode[],
  measured: Map<AnnotationNode, MeasuredAnnotation>,
  idMap: Map<string, Rect>,
  windowRect: Rect,
  canvasWidth: number,
  canvasHeight: number,
  theme: Theme,
): LaidAnnotation[] {
  if (list.length === 0) return [];

  interface Pending {
    node: AnnotationNode;
    dims: MeasuredAnnotation;
    target: Rect;
    /** Preferred position along the main axis (top-left coordinate). */
    pref: number;
  }
  const pending: Pending[] = [];
  for (const a of list) {
    const target = idMap.get(a.target);
    if (!target) continue; // Silently drop unresolved — caller can warn.
    const dims = measured.get(a)!;
    let pref: number;
    if (side === 'left' || side === 'right') {
      pref = target.y + target.height / 2 - dims.height / 2;
    } else {
      pref = target.x + target.width / 2 - dims.width / 2;
    }
    pending.push({ node: a, dims, target, pref });
  }
  if (pending.length === 0) return [];

  pending.sort((a, b) => a.pref - b.pref);

  // Greedy non-overlap push along the main axis.
  const mainSize = (p: Pending) =>
    side === 'left' || side === 'right' ? p.dims.height : p.dims.width;
  const axisMin = side === 'left' || side === 'right' ? 0 : 0;
  const axisMax =
    side === 'left' || side === 'right' ? canvasHeight : canvasWidth;

  let cursor = -Infinity;
  for (const p of pending) {
    const minStart = cursor === -Infinity ? axisMin : cursor + theme.annotationStackGap;
    const start = Math.max(p.pref, minStart);
    cursor = start + mainSize(p);
    p.pref = start; // repurpose as final start coordinate
  }

  // If the stack overflows the bottom of the axis, shift the whole group up.
  if (cursor > axisMax) {
    const overflow = cursor - axisMax;
    for (const p of pending) p.pref -= overflow;
  }

  const out: LaidAnnotation[] = [];
  for (const p of pending) {
    const { node, dims, target } = p;
    let boxX: number;
    let boxY: number;
    let boxAnchor: { x: number; y: number };
    let targetAnchor: { x: number; y: number };

    if (side === 'right') {
      boxX = windowRect.x + windowRect.width + theme.annotationGap;
      boxY = p.pref;
      boxAnchor = { x: boxX, y: boxY + dims.height / 2 };
      targetAnchor = {
        x: target.x + target.width,
        y: target.y + target.height / 2,
      };
    } else if (side === 'left') {
      boxX = windowRect.x - theme.annotationGap - dims.width;
      boxY = p.pref;
      boxAnchor = { x: boxX + dims.width, y: boxY + dims.height / 2 };
      targetAnchor = { x: target.x, y: target.y + target.height / 2 };
    } else if (side === 'top') {
      boxX = p.pref;
      boxY = windowRect.y - theme.annotationGap - dims.height;
      boxAnchor = { x: boxX + dims.width / 2, y: boxY + dims.height };
      targetAnchor = { x: target.x + target.width / 2, y: target.y };
    } else {
      // bottom
      boxX = p.pref;
      boxY = windowRect.y + windowRect.height + theme.annotationGap;
      boxAnchor = { x: boxX + dims.width / 2, y: boxY };
      targetAnchor = {
        x: target.x + target.width / 2,
        y: target.y + target.height,
      };
    }

    out.push({
      node,
      x: boxX,
      y: boxY,
      width: dims.width,
      height: dims.height,
      lines: dims.lines,
      boxAnchor,
      targetAnchor,
    });
  }

  return out;
}
