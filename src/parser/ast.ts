/**
 * AST type definitions for the Wireloom v0.2 grammar.
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
  | DividerNode;

export type ContainerChild =
  | PanelNode
  | SectionNode
  | TabsNode
  | RowNode
  | ColNode
  | ListNode
  | SlotNode
  | LeafNode;

export type WindowChild =
  | HeaderNode
  | FooterNode
  | PanelNode
  | SectionNode
  | TabsNode
  | RowNode
  | ColNode
  | ListNode
  | SlotNode
  | LeafNode;

export type AnyNode =
  | WindowNode
  | HeaderNode
  | FooterNode
  | PanelNode
  | SectionNode
  | TabsNode
  | TabNode
  | RowNode
  | ColNode
  | ListNode
  | ItemNode
  | SlotNode
  | LeafNode;

export interface Document {
  kind: 'document';
  /** Required-by-grammar `window` root. Absent on stub or fully-failed parses. */
  root?: WindowNode;
  /** Total number of source lines parsed (including blanks and comments). */
  sourceLines: number;
}
