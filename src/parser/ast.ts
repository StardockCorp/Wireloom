/**
 * AST type definitions for the Wireloom v0.1 thin-slice grammar.
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

export type AttributeValue =
  | { kind: 'string'; value: string; position: SourcePosition }
  | { kind: 'number'; value: number; unit: LengthUnit; position: SourcePosition }
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

export interface RowNode extends NodeBase {
  kind: 'row';
  children: ContainerChild[];
}

export interface ColNode extends NodeBase {
  kind: 'col';
  width?: LengthValue;
  children: ContainerChild[];
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

export interface DividerNode extends NodeBase {
  kind: 'divider';
}

export type LeafNode = TextNode | ButtonNode | InputNode | DividerNode;

export type ContainerChild = PanelNode | RowNode | ColNode | LeafNode;

export type WindowChild =
  | HeaderNode
  | FooterNode
  | PanelNode
  | RowNode
  | ColNode
  | LeafNode;

export type AnyNode =
  | WindowNode
  | HeaderNode
  | FooterNode
  | PanelNode
  | RowNode
  | ColNode
  | LeafNode;

export interface Document {
  kind: 'document';
  /** Required-by-grammar `window` root. Absent on stub or fully-failed parses. */
  root?: WindowNode;
  /** Total number of source lines parsed (including blanks and comments). */
  sourceLines: number;
}
