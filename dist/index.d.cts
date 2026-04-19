type WireloomTheme = 'default' | 'dark';
type WireloomSecurityLevel = 'strict' | 'loose';
interface WireloomConfig {
    theme: WireloomTheme;
    securityLevel: WireloomSecurityLevel;
}

/**
 * AST type definitions for the Wireloom v0.2 grammar.
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
/**
 * Column width — fixed pixel length, or "fill remaining space".
 *
 * Positional column widths are pixel-only; percent and fr are intentionally
 * not representable here so hand-built ASTs can't construct values the
 * serializer would silently discard.
 */
type ColWidth = {
    kind: 'length';
    value: number;
    unit: 'px';
} | {
    kind: 'fill';
};
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
    kind: 'range';
    min: number;
    max: number;
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
interface SectionNode extends NodeBase {
    kind: 'section';
    title: string;
    children: ContainerChild[];
}
interface TabsNode extends NodeBase {
    kind: 'tabs';
    children: TabNode[];
}
interface RowNode extends NodeBase {
    kind: 'row';
    children: ContainerChild[];
}
interface ColNode extends NodeBase {
    kind: 'col';
    width: ColWidth;
    children: ContainerChild[];
}
interface ListNode extends NodeBase {
    kind: 'list';
    children: (ItemNode | SlotNode)[];
}
interface SlotNode extends NodeBase {
    kind: 'slot';
    title: string;
    children: ContainerChild[];
}
interface TabNode extends NodeBase {
    kind: 'tab';
    label: string;
}
interface ItemNode extends NodeBase {
    kind: 'item';
    text: string;
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
interface ComboNode extends NodeBase {
    kind: 'combo';
    label?: string;
}
interface SliderNode extends NodeBase {
    kind: 'slider';
}
interface KvNode extends NodeBase {
    kind: 'kv';
    label: string;
    value: string;
}
interface ImageNode extends NodeBase {
    kind: 'image';
}
interface IconNode extends NodeBase {
    kind: 'icon';
}
interface DividerNode extends NodeBase {
    kind: 'divider';
}
/**
 * Leaf nodes that can appear in any container (panel/section/row/col/slot).
 * Excludes `tab` (must be inside `tabs`) and `item` (must be inside `list`).
 */
type LeafNode = TextNode | ButtonNode | InputNode | ComboNode | SliderNode | KvNode | ImageNode | IconNode | DividerNode;
type ContainerChild = PanelNode | SectionNode | TabsNode | RowNode | ColNode | ListNode | SlotNode | LeafNode;
type WindowChild = HeaderNode | FooterNode | PanelNode | SectionNode | TabsNode | RowNode | ColNode | ListNode | SlotNode | LeafNode;
type AnyNode = WindowNode | HeaderNode | FooterNode | PanelNode | SectionNode | TabsNode | TabNode | RowNode | ColNode | ListNode | ItemNode | SlotNode | LeafNode;
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
 * object consumed by the layout engine and SVG emitter.
 */
interface Theme {
    name: string;
    background: string;
    textColor: string;
    mutedTextColor: string;
    placeholderColor: string;
    windowBorderColor: string;
    panelBorderColor: string;
    sectionTitleColor: string;
    dividerColor: string;
    chromeLineColor: string;
    buttonBorderColor: string;
    buttonFill: string;
    buttonText: string;
    primaryButtonFill: string;
    primaryButtonText: string;
    disabledColor: string;
    tabActiveColor: string;
    tabInactiveColor: string;
    tabUnderlineColor: string;
    slotBorderColor: string;
    slotActiveBorderColor: string;
    slotFillColor: string;
    badgeFill: string;
    badgeText: string;
    sliderTrackColor: string;
    sliderFillColor: string;
    sliderThumbColor: string;
    comboChevronColor: string;
    bulletColor: string;
    iconStrokeColor: string;
    windowStrokeWidth: number;
    panelStrokeWidth: number;
    panelStrokeDasharray: string;
    chromeStrokeWidth: number;
    dividerStrokeWidth: number;
    buttonStrokeWidth: number;
    inputStrokeWidth: number;
    slotStrokeWidth: number;
    slotActiveStrokeWidth: number;
    fontFamily: string;
    fontSize: number;
    titleFontSize: number;
    sectionTitleFontSize: number;
    smallFontSize: number;
    largeFontSize: number;
    badgeFontSize: number;
    lineHeight: number;
    averageCharWidth: number;
    windowPadding: number;
    titleBarHeight: number;
    panelPadding: number;
    headerPaddingY: number;
    footerPaddingY: number;
    sectionTitleHeight: number;
    sectionTitlePaddingBottom: number;
    slotPadding: number;
    slotTitleHeight: number;
    rowGap: number;
    colGap: number;
    listGap: number;
    dividerHeight: number;
    buttonHeight: number;
    buttonPaddingX: number;
    inputHeight: number;
    inputPaddingX: number;
    inputMinWidth: number;
    comboHeight: number;
    comboChevronWidth: number;
    comboMinWidth: number;
    sliderHeight: number;
    sliderTrackHeight: number;
    sliderThumbRadius: number;
    sliderDefaultWidth: number;
    imageDefaultWidth: number;
    imageDefaultHeight: number;
    iconSize: number;
    tabHeight: number;
    tabPaddingX: number;
    tabGap: number;
    bulletWidth: number;
    badgeHeight: number;
    badgePaddingX: number;
    kvMinWidth: number;
    colFillMinWidth: number;
}
declare const DEFAULT_THEME: Theme;
declare const DARK_THEME: Theme;

/**
 * Wireloom — UI wireframe mockups from a Markdown-embedded DSL,
 * rendered as inline SVG.
 *
 * Public API, shaped like other text-to-diagram libraries:
 *
 *   import wireloom from 'wireloom';
 *   wireloom.initialize({ theme: 'default' });
 *   const doc = wireloom.parse(source);
 *   const { svg } = await wireloom.render('id', source);
 *   const canonical = wireloom.serialize(doc);
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
 * Serializes a parsed {@link Document} back to canonical Wireloom source.
 * Useful for formatting, tooling, and roundtrip verification. Comments and
 * non-canonical whitespace in the original source are not preserved; the
 * re-parsed AST of the serialized output equals the input AST.
 */
declare function serialize(doc: Document): string;
interface RenderOptions {
    /** Override the theme for this render without touching the global config. */
    theme?: 'default' | 'dark';
}
/**
 * Parses and renders a Wireloom source string to an SVG string.
 * Throws {@link WireloomError} with line/column info on parse failure.
 * If `options.theme` is omitted the global theme from `initialize()` is used.
 */
declare function render(id: string, source: string, options?: RenderOptions): Promise<RenderResult>;
declare const wireloom: {
    initialize: typeof initialize;
    parse: typeof parse;
    serialize: typeof serialize;
    render: typeof render;
};

export { type AnyNode, type Attribute, type AttributeFlag, type AttributePair, type AttributeValue, type ButtonNode, type ColNode, type ColWidth, type ComboNode, type ContainerChild, DARK_THEME, DEFAULT_THEME, type DividerNode, type Document, type FooterNode, type HeaderNode, type IconNode, type ImageNode, type InputNode, type ItemNode, type KvNode, type LeafNode, type LengthUnit, type LengthValue, type ListNode, type PanelNode, type RenderOptions, type RenderResult, type RowNode, type SectionNode, type SliderNode, type SlotNode, type SourcePosition, type TabNode, type TabsNode, type TextNode, type Theme, type WindowChild, type WindowNode, type WireloomConfig, WireloomError, type WireloomSecurityLevel, type WireloomTheme, wireloom as default, initialize, parse, render, serialize };
