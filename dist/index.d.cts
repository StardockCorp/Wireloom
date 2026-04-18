type WireloomTheme = 'default' | 'dark';
type WireloomSecurityLevel = 'strict' | 'loose';
interface WireloomConfig {
    theme: WireloomTheme;
    securityLevel: WireloomSecurityLevel;
}

/**
 * AST type definitions for the Wireloom v0.1 thin-slice grammar.
 *
 * The parser produces a `Document` whose optional `root` is the required
 * `WindowNode`. Every node carries a source position so errors and tooling
 * can point at the original file.
 *
 * See design/grammar.md for the formal EBNF this AST models.
 */
interface SourcePosition {
    /** 1-based line number. */
    line: number;
    /** 1-based column number. */
    column: number;
}
type LengthUnit = 'px' | 'percent' | 'fr';
interface LengthValue {
    value: number;
    unit: LengthUnit;
}
type AttributeValue = {
    kind: 'string';
    value: string;
    position: SourcePosition;
} | {
    kind: 'number';
    value: number;
    unit: LengthUnit;
    position: SourcePosition;
} | {
    kind: 'identifier';
    value: string;
    position: SourcePosition;
};
interface AttributePair {
    kind: 'pair';
    key: string;
    value: AttributeValue;
    position: SourcePosition;
}
interface AttributeFlag {
    kind: 'flag';
    flag: string;
    position: SourcePosition;
}
type Attribute = AttributePair | AttributeFlag;
interface NodeBase {
    position: SourcePosition;
    attributes: Attribute[];
}
interface WindowNode extends NodeBase {
    kind: 'window';
    title?: string;
    children: WindowChild[];
}
interface HeaderNode extends NodeBase {
    kind: 'header';
    children: ContainerChild[];
}
interface FooterNode extends NodeBase {
    kind: 'footer';
    children: ContainerChild[];
}
interface PanelNode extends NodeBase {
    kind: 'panel';
    children: ContainerChild[];
}
interface RowNode extends NodeBase {
    kind: 'row';
    children: ContainerChild[];
}
interface ColNode extends NodeBase {
    kind: 'col';
    width?: LengthValue;
    children: ContainerChild[];
}
interface TextNode extends NodeBase {
    kind: 'text';
    content: string;
}
interface ButtonNode extends NodeBase {
    kind: 'button';
    label: string;
}
interface InputNode extends NodeBase {
    kind: 'input';
}
interface DividerNode extends NodeBase {
    kind: 'divider';
}
type LeafNode = TextNode | ButtonNode | InputNode | DividerNode;
type ContainerChild = PanelNode | RowNode | ColNode | LeafNode;
type WindowChild = HeaderNode | FooterNode | PanelNode | RowNode | ColNode | LeafNode;
type AnyNode = WindowNode | HeaderNode | FooterNode | PanelNode | RowNode | ColNode | LeafNode;
interface Document {
    kind: 'document';
    /** Required-by-grammar `window` root. Absent on stub or fully-failed parses. */
    root?: WindowNode;
    /** Total number of source lines parsed (including blanks and comments). */
    sourceLines: number;
}

/**
 * Parse-time errors. All user-facing errors from the lexer and parser
 * go through this class so they carry precise line/column information
 * and a consistent message format.
 */
declare class WireloomError extends Error {
    readonly line: number;
    readonly column: number;
    constructor(message: string, line: number, column: number);
}

/**
 * Theme definitions for the Wireloom SVG renderer.
 *
 * A theme bundles colors, strokes, typography, and spacing into a single
 * object consumed by the layout engine and SVG emitter. v0.1 ships with
 * `default` only; `dark` is declared as a structural placeholder and will
 * ship real values in a later todo.
 */
interface Theme {
    name: string;
    background: string;
    textColor: string;
    placeholderColor: string;
    windowBorderColor: string;
    panelBorderColor: string;
    dividerColor: string;
    chromeLineColor: string;
    buttonBorderColor: string;
    buttonFill: string;
    buttonText: string;
    primaryButtonFill: string;
    primaryButtonText: string;
    disabledColor: string;
    windowStrokeWidth: number;
    panelStrokeWidth: number;
    panelStrokeDasharray: string;
    chromeStrokeWidth: number;
    dividerStrokeWidth: number;
    buttonStrokeWidth: number;
    inputStrokeWidth: number;
    fontFamily: string;
    fontSize: number;
    titleFontSize: number;
    lineHeight: number;
    averageCharWidth: number;
    windowPadding: number;
    titleBarHeight: number;
    panelPadding: number;
    headerPaddingY: number;
    footerPaddingY: number;
    rowGap: number;
    colGap: number;
    dividerHeight: number;
    buttonHeight: number;
    buttonPaddingX: number;
    inputHeight: number;
    inputPaddingX: number;
    inputMinWidth: number;
}
declare const DEFAULT_THEME: Theme;
declare const DARK_THEME: Theme;

/**
 * Wireloom — UI wireframe mockups from a Markdown-embedded DSL,
 * rendered as inline SVG.
 *
 * Public API (three calls, matching the well-established text-diagram-library
 * shape):
 *
 *   import wireloom from 'wireloom';
 *   wireloom.initialize({ theme: 'default' });
 *   const ast = wireloom.parse(source);
 *   const { svg } = await wireloom.render('id', source);
 *
 * The parser and renderer are currently stubs. Real implementations land in
 * the parser and renderer todos.
 */

interface RenderResult {
    svg: string;
}
/**
 * Merges a partial configuration into the global Wireloom config.
 * Theme, security level, and future global options are set here.
 */
declare function initialize(config: Partial<WireloomConfig>): void;
/**
 * Parses a Wireloom source string into an AST.
 * Throws {@link WireloomError} with line/column info on parse failure.
 */
declare function parse(source: string): Document;
/**
 * Parses and renders a Wireloom source string to an SVG string.
 * Throws {@link WireloomError} with line/column info on parse failure.
 */
declare function render(id: string, source: string): Promise<RenderResult>;
declare const wireloom: {
    initialize: typeof initialize;
    parse: typeof parse;
    render: typeof render;
};

export { type AnyNode, type Attribute, type AttributeFlag, type AttributePair, type AttributeValue, type ButtonNode, type ColNode, type ContainerChild, DARK_THEME, DEFAULT_THEME, type DividerNode, type Document, type FooterNode, type HeaderNode, type InputNode, type LeafNode, type LengthUnit, type LengthValue, type PanelNode, type RenderResult, type RowNode, type SourcePosition, type TextNode, type Theme, type WindowChild, type WindowNode, type WireloomConfig, WireloomError, type WireloomSecurityLevel, type WireloomTheme, wireloom as default, initialize, parse, render };
