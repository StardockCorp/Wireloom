/**
 * AST type definitions for the Wireloom v0.4 grammar.
 *
 * The parser produces a `Document` whose optional `root` is the required
 * `WindowNode`. Every node carries a source position so errors and tooling
 * can point at the original file.
 *
 * See design/grammar.md for the formal EBNF this AST models.
 */

export interface SourcePosition {
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
}

export type LengthUnit = 'px' | 'percent' | 'fr';

export interface LengthValue {
  value: number;
  unit: LengthUnit;
}

/**
 * Column width — fixed pixel length, or "fill remaining space".
 *
 * Positional column widths are pixel-only; percent and fr are intentionally
 * not representable here so hand-built ASTs can't construct values the
 * serializer would silently discard.
 */
export type ColWidth =
  | { kind: 'length'; value: number; unit: 'px' }
  | { kind: 'fill' };

export type AttributeValue =
  | { kind: 'string'; value: string; position: SourcePosition }
  | { kind: 'number'; value: number; unit: LengthUnit; position: SourcePosition }
  | { kind: 'range'; min: number; max: number; position: SourcePosition }
  | { kind: 'identifier'; value: string; position: SourcePosition };

export interface AttributePair {
  kind: 'pair';
  key: string;
  value: AttributeValue;
  position: SourcePosition;
}

export interface AttributeFlag {
  kind: 'flag';
  flag: string;
  position: SourcePosition;
}

export type Attribute = AttributePair | AttributeFlag;

interface NodeBase {
  position: SourcePosition;
  attributes: Attribute[];
}

// ---------------------------------------------------------------------------
// Structural containers
// ---------------------------------------------------------------------------

export interface WindowNode extends NodeBase {
  kind: 'window';
  title?: string;
  children: WindowChild[];
}

export interface HeaderNode extends NodeBase {
  kind: 'header';
  children: ContainerChild[];
}

export interface FooterNode extends NodeBase {
  kind: 'footer';
  children: ContainerChild[];
}

/**
 * Mobile-style navigation bar (v0.50). Direct child of `window` only, same
 * placement rule as `header`. Holds two optional sub-slots — `leading` (left)
 * and `trailing` (right) — separated by an internal spacer so the slots
 * anchor to opposite edges. At least one of leading/trailing must be present.
 *
 * Mutually exclusive with `header`: the parser rejects a window that contains
 * both, since they serve overlapping roles in the chrome band.
 */
export interface NavbarNode extends NodeBase {
  kind: 'navbar';
  leading?: NavbarSlotNode;
  trailing?: NavbarSlotNode;
}

/**
 * One side of a `navbar` (kind `navbarLeading` or `navbarTrailing`). Written
 * in source as a bare `leading:` / `trailing:` block. Holds the same children
 * a normal container row would.
 */
export interface NavbarSlotNode extends NodeBase {
  kind: 'navbarLeading' | 'navbarTrailing';
  children: ContainerChild[];
}

export interface PanelNode extends NodeBase {
  kind: 'panel';
  children: ContainerChild[];
}

export interface SectionNode extends NodeBase {
  kind: 'section';
  title: string;
  children: ContainerChild[];
}

export interface TabsNode extends NodeBase {
  kind: 'tabs';
  children: TabNode[];
}

export interface RowNode extends NodeBase {
  kind: 'row';
  children: ContainerChild[];
}

export interface ColNode extends NodeBase {
  kind: 'col';
  width: ColWidth;
  children: ContainerChild[];
}

export interface ListNode extends NodeBase {
  kind: 'list';
  children: (ItemNode | SlotNode)[];
}

export interface SlotNode extends NodeBase {
  kind: 'slot';
  title: string;
  children: ContainerChild[];
  /** Optional right-aligned footer, added v0.4. Rendered below main content. */
  slotFooter?: SlotFooterNode;
}

/**
 * Inline footer block inside a `slot`. Syntactically written as a bare
 * `footer:` child of a slot. Unlike the top-level window footer, this is
 * always right-aligned and intended for action buttons + secondary text.
 */
export interface SlotFooterNode extends NodeBase {
  kind: 'slotFooter';
  children: ContainerChild[];
}

export interface GridNode extends NodeBase {
  kind: 'grid';
  cols: number;
  rows: number;
  children: CellNode[];
}

export interface CellNode extends NodeBase {
  kind: 'cell';
  /** Optional positional label string. */
  label?: string;
  /** 1-indexed grid position. `undefined` means auto-flow. */
  row?: number;
  col?: number;
  children: ContainerChild[];
}

export interface ResourceBarNode extends NodeBase {
  kind: 'resourcebar';
  children: ResourceNode[];
}

export interface StatsNode extends NodeBase {
  kind: 'stats';
  children: StatNode[];
}

// ---------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------

export interface TabNode extends NodeBase {
  kind: 'tab';
  label: string;
}

export interface ItemNode extends NodeBase {
  kind: 'item';
  text: string;
}

export interface TextNode extends NodeBase {
  kind: 'text';
  content: string;
}

export interface ButtonNode extends NodeBase {
  kind: 'button';
  label: string;
}

export interface InputNode extends NodeBase {
  kind: 'input';
}

export interface ComboNode extends NodeBase {
  kind: 'combo';
  label?: string;
}

export interface SliderNode extends NodeBase {
  kind: 'slider';
}

export interface KvNode extends NodeBase {
  kind: 'kv';
  label: string;
  value: string;
}

export interface ImageNode extends NodeBase {
  kind: 'image';
}

export interface IconNode extends NodeBase {
  kind: 'icon';
}

export interface DividerNode extends NodeBase {
  kind: 'divider';
}

/**
 * Horizontal flex gap inside a `row`. No args, no attrs (other than universal
 * `id`), no children. Consumes any slack in the parent row so siblings on
 * either side anchor left/right. Only valid as a direct child of `row`.
 */
export interface SpacerNode extends NodeBase {
  kind: 'spacer';
}

export interface ProgressNode extends NodeBase {
  kind: 'progress';
}

export interface ChartNode extends NodeBase {
  kind: 'chart';
}

export interface ResourceNode extends NodeBase {
  kind: 'resource';
  name: string;
  value: string;
}

export interface StatNode extends NodeBase {
  kind: 'stat';
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Tree (v0.4.5)
// ---------------------------------------------------------------------------

export interface TreeNode_ extends NodeBase {
  kind: 'tree';
  children: TreeItemNode[];
}

/**
 * Single `node "Label"` entry inside a `tree`. Recursive — nodes may contain
 * other nodes. Serialized as keyword `node` (kind name `treeNode` disambiguates
 * internally).
 */
export interface TreeItemNode extends NodeBase {
  kind: 'treeNode';
  label: string;
  children: TreeItemNode[];
}

// ---------------------------------------------------------------------------
// Form controls (v0.4.5)
// ---------------------------------------------------------------------------

export interface CheckboxNode extends NodeBase {
  kind: 'checkbox';
  label: string;
}

export interface RadioNode extends NodeBase {
  kind: 'radio';
  label: string;
}

export interface ToggleNode extends NodeBase {
  kind: 'toggle';
  label: string;
}

// ---------------------------------------------------------------------------
// Menu system (v0.4.5)
// ---------------------------------------------------------------------------

export interface MenubarNode extends NodeBase {
  kind: 'menubar';
  children: MenuNode[];
}

export interface MenuNode extends NodeBase {
  kind: 'menu';
  label: string;
  children: MenuChild[];
}

export type MenuChild = MenuItemNode | SeparatorNode | MenuNode;

export interface MenuItemNode extends NodeBase {
  kind: 'menuitem';
  label: string;
}

export interface SeparatorNode extends NodeBase {
  kind: 'separator';
}

// ---------------------------------------------------------------------------
// Chip / Avatar (v0.4.5)
// ---------------------------------------------------------------------------

export interface ChipNode extends NodeBase {
  kind: 'chip';
  label: string;
}

export interface AvatarNode extends NodeBase {
  kind: 'avatar';
  initials: string;
}

// ---------------------------------------------------------------------------
// Breadcrumb (v0.4.5)
// ---------------------------------------------------------------------------

export interface BreadcrumbNode extends NodeBase {
  kind: 'breadcrumb';
  children: CrumbNode[];
}

export interface CrumbNode extends NodeBase {
  kind: 'crumb';
  label: string;
}

// ---------------------------------------------------------------------------
// Spinner / Status (v0.4.5)
// ---------------------------------------------------------------------------

export interface SpinnerNode extends NodeBase {
  kind: 'spinner';
  label?: string;
}

export type StatusKind = 'success' | 'info' | 'warning' | 'error';

export interface StatusNode extends NodeBase {
  kind: 'status';
  label: string;
}

// ---------------------------------------------------------------------------
// Annotations (v0.4 — user-manual-style labels pointing at window elements)
// ---------------------------------------------------------------------------

export type AnnotationSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * A user-manual-style label that identifies part of the `window` mockup.
 * Rendered as a box with a leader line drawn to the element whose `id`
 * matches `target`. Lives as a sibling of `window` (document root), never
 * inside the window tree.
 */
export interface AnnotationNode extends NodeBase {
  kind: 'annotation';
  /** Id of the node inside `window` that this annotation points to. */
  target: string;
  /** Which margin of the window the annotation box sits in. */
  side: AnnotationSide;
  /** Label text. Literal `\n` in source becomes a line break. */
  body: string;
}

// ---------------------------------------------------------------------------
// Unions
// ---------------------------------------------------------------------------

/**
 * Leaf nodes that can appear in any container (panel/section/row/col/slot).
 * Excludes `tab` (must be inside `tabs`) and `item` (must be inside `list`).
 */
export type LeafNode =
  | TextNode
  | ButtonNode
  | InputNode
  | ComboNode
  | SliderNode
  | KvNode
  | ImageNode
  | IconNode
  | DividerNode
  | SpacerNode
  | ProgressNode
  | ChartNode
  | CheckboxNode
  | RadioNode
  | ToggleNode
  | ChipNode
  | AvatarNode
  | SpinnerNode
  | StatusNode;

export type ContainerChild =
  | PanelNode
  | SectionNode
  | TabsNode
  | RowNode
  | ColNode
  | ListNode
  | SlotNode
  | GridNode
  | ResourceBarNode
  | StatsNode
  | TreeNode_
  | MenubarNode
  | MenuNode
  | BreadcrumbNode
  | LeafNode;

export type WindowChild =
  | HeaderNode
  | FooterNode
  | NavbarNode
  | PanelNode
  | SectionNode
  | TabsNode
  | RowNode
  | ColNode
  | ListNode
  | SlotNode
  | GridNode
  | ResourceBarNode
  | StatsNode
  | TreeNode_
  | MenubarNode
  | MenuNode
  | BreadcrumbNode
  | LeafNode;

export type AnyNode =
  | WindowNode
  | HeaderNode
  | FooterNode
  | NavbarNode
  | NavbarSlotNode
  | SlotFooterNode
  | PanelNode
  | SectionNode
  | TabsNode
  | TabNode
  | RowNode
  | ColNode
  | ListNode
  | ItemNode
  | SlotNode
  | GridNode
  | CellNode
  | ResourceBarNode
  | ResourceNode
  | StatsNode
  | StatNode
  | TreeNode_
  | TreeItemNode
  | MenubarNode
  | MenuNode
  | MenuItemNode
  | SeparatorNode
  | BreadcrumbNode
  | CrumbNode
  | AnnotationNode
  | LeafNode;

export interface Document {
  kind: 'document';
  /** Required-by-grammar `window` root. Absent on stub or fully-failed parses. */
  root?: WindowNode;
  /**
   * Optional user-manual-style callouts pointing at elements inside `root`.
   * Appear after the `window` node in source; omitted array means none.
   */
  annotations?: AnnotationNode[];
  /** Total number of source lines parsed (including blanks and comments). */
  sourceLines: number;
}
