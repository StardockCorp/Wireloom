type WireloomTheme = 'default' | 'dark';
type WireloomSecurityLevel = 'strict' | 'loose';
interface WireloomConfig {
    theme: WireloomTheme;
    securityLevel: WireloomSecurityLevel;
}

/**
 * AST type definitions for the Wireloom v0.4 grammar.
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
/**
 * Mobile-style navigation bar (v0.50). Direct child of `window` only, same
 * placement rule as `header`. Holds two optional sub-slots — `leading` (left)
 * and `trailing` (right) — separated by an internal spacer so the slots
 * anchor to opposite edges. At least one of leading/trailing must be present.
 *
 * Mutually exclusive with `header`: the parser rejects a window that contains
 * both, since they serve overlapping roles in the chrome band.
 */
interface NavbarNode extends NodeBase {
    kind: 'navbar';
    leading?: NavbarSlotNode;
    trailing?: NavbarSlotNode;
}
/**
 * One side of a `navbar` (kind `navbarLeading` or `navbarTrailing`). Written
 * in source as a bare `leading:` / `trailing:` block. Holds the same children
 * a normal container row would.
 */
interface NavbarSlotNode extends NodeBase {
    kind: 'navbarLeading' | 'navbarTrailing';
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
    /** Optional right-aligned footer, added v0.4. Rendered below main content. */
    slotFooter?: SlotFooterNode;
}
/**
 * Inline footer block inside a `slot`. Syntactically written as a bare
 * `footer:` child of a slot. Unlike the top-level window footer, this is
 * always right-aligned and intended for action buttons + secondary text.
 */
interface SlotFooterNode extends NodeBase {
    kind: 'slotFooter';
    children: ContainerChild[];
}
interface GridNode extends NodeBase {
    kind: 'grid';
    cols: number;
    rows: number;
    children: CellNode[];
}
interface CellNode extends NodeBase {
    kind: 'cell';
    /** Optional positional label string. */
    label?: string;
    /** 1-indexed grid position. `undefined` means auto-flow. */
    row?: number;
    col?: number;
    children: ContainerChild[];
}
interface ResourceBarNode extends NodeBase {
    kind: 'resourcebar';
    children: ResourceNode[];
}
interface StatsNode extends NodeBase {
    kind: 'stats';
    children: StatNode[];
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
 * Horizontal flex gap inside a `row`. No args, no attrs (other than universal
 * `id`), no children. Consumes any slack in the parent row so siblings on
 * either side anchor left/right. Only valid as a direct child of `row`.
 */
interface SpacerNode extends NodeBase {
    kind: 'spacer';
}
interface ProgressNode extends NodeBase {
    kind: 'progress';
}
interface ChartNode extends NodeBase {
    kind: 'chart';
}
interface ResourceNode extends NodeBase {
    kind: 'resource';
    name: string;
    value: string;
}
interface StatNode extends NodeBase {
    kind: 'stat';
    label: string;
    value: string;
}
interface TreeNode_ extends NodeBase {
    kind: 'tree';
    children: TreeItemNode[];
}
/**
 * Single `node "Label"` entry inside a `tree`. Recursive — nodes may contain
 * other nodes. Serialized as keyword `node` (kind name `treeNode` disambiguates
 * internally).
 */
interface TreeItemNode extends NodeBase {
    kind: 'treeNode';
    label: string;
    children: TreeItemNode[];
}
interface CheckboxNode extends NodeBase {
    kind: 'checkbox';
    label: string;
}
interface RadioNode extends NodeBase {
    kind: 'radio';
    label: string;
}
interface ToggleNode extends NodeBase {
    kind: 'toggle';
    label: string;
}
interface MenubarNode extends NodeBase {
    kind: 'menubar';
    children: MenuNode[];
}
interface MenuNode extends NodeBase {
    kind: 'menu';
    label: string;
    children: MenuChild[];
}
type MenuChild = MenuItemNode | SeparatorNode | MenuNode;
interface MenuItemNode extends NodeBase {
    kind: 'menuitem';
    label: string;
}
interface SeparatorNode extends NodeBase {
    kind: 'separator';
}
interface ChipNode extends NodeBase {
    kind: 'chip';
    label: string;
}
interface AvatarNode extends NodeBase {
    kind: 'avatar';
    initials: string;
}
interface BreadcrumbNode extends NodeBase {
    kind: 'breadcrumb';
    children: CrumbNode[];
}
interface CrumbNode extends NodeBase {
    kind: 'crumb';
    label: string;
}
interface SpinnerNode extends NodeBase {
    kind: 'spinner';
    label?: string;
}
type StatusKind = 'success' | 'info' | 'warning' | 'error';
interface StatusNode extends NodeBase {
    kind: 'status';
    label: string;
}
type AnnotationSide = 'left' | 'right' | 'top' | 'bottom';
/**
 * A user-manual-style label that identifies part of the `window` mockup.
 * Rendered as a box with a leader line drawn to the element whose `id`
 * matches `target`. Lives as a sibling of `window` (document root), never
 * inside the window tree.
 */
interface AnnotationNode extends NodeBase {
    kind: 'annotation';
    /** Id of the node inside `window` that this annotation points to. */
    target: string;
    /** Which margin of the window the annotation box sits in. */
    side: AnnotationSide;
    /** Label text. Literal `\n` in source becomes a line break. */
    body: string;
}
/**
 * Leaf nodes that can appear in any container (panel/section/row/col/slot).
 * Excludes `tab` (must be inside `tabs`) and `item` (must be inside `list`).
 */
type LeafNode = TextNode | ButtonNode | InputNode | ComboNode | SliderNode | KvNode | ImageNode | IconNode | DividerNode | SpacerNode | ProgressNode | ChartNode | CheckboxNode | RadioNode | ToggleNode | ChipNode | AvatarNode | SpinnerNode | StatusNode;
type ContainerChild = PanelNode | SectionNode | TabsNode | RowNode | ColNode | ListNode | SlotNode | GridNode | ResourceBarNode | StatsNode | TreeNode_ | MenubarNode | MenuNode | BreadcrumbNode | LeafNode;
type WindowChild = HeaderNode | FooterNode | NavbarNode | PanelNode | SectionNode | TabsNode | RowNode | ColNode | ListNode | SlotNode | GridNode | ResourceBarNode | StatsNode | TreeNode_ | MenubarNode | MenuNode | BreadcrumbNode | LeafNode;
type AnyNode = WindowNode | HeaderNode | FooterNode | NavbarNode | NavbarSlotNode | SlotFooterNode | PanelNode | SectionNode | TabsNode | TabNode | RowNode | ColNode | ListNode | ItemNode | SlotNode | GridNode | CellNode | ResourceBarNode | ResourceNode | StatsNode | StatNode | TreeNode_ | TreeItemNode | MenubarNode | MenuNode | MenuItemNode | SeparatorNode | BreadcrumbNode | CrumbNode | AnnotationNode | LeafNode;
interface Document {
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
type AccentName = 'research' | 'military' | 'industry' | 'wealth' | 'approval' | 'warning' | 'danger' | 'success';
type StateName = 'locked' | 'available' | 'active' | 'purchased' | 'maxed' | 'growing' | 'ripe' | 'withering' | 'cashed';
/** Rendering style for a cell/slot in a given state. */
interface StateStyle {
    border: string;
    fill: string;
    text: string;
    /** Optional right-shoulder badge glyph rendered on the node (e.g. 🔒, ✓). */
    badge?: string;
}
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
    cellMinSize: number;
    cellPadding: number;
    resourceBarHeight: number;
    resourceBarItemGap: number;
    resourceBarIconSize: number;
    statsGap: number;
    progressDefaultWidth: number;
    progressMaxWidth: number;
    progressHeight: number;
    chartDefaultWidth: number;
    chartDefaultHeight: number;
    treeIndent: number;
    treeRowHeight: number;
    treeIndentGuideColor: string;
    treeGlyphColor: string;
    treeSelectedBg: string;
    treeSelectedText: string;
    checkboxSize: number;
    checkboxRowGap: number;
    checkboxBorderColor: string;
    checkboxFillColor: string;
    checkboxCheckColor: string;
    radioSize: number;
    toggleWidth: number;
    toggleHeight: number;
    toggleOnColor: string;
    toggleOffColor: string;
    toggleKnobColor: string;
    radioGroupGap: number;
    menubarHeight: number;
    menubarItemPaddingX: number;
    menubarBgColor: string;
    menubarBorderColor: string;
    menuWidth: number;
    menuItemHeight: number;
    menuItemPaddingX: number;
    menuBgColor: string;
    menuBorderColor: string;
    menuShortcutColor: string;
    menuSeparatorColor: string;
    chipHeight: number;
    chipPaddingX: number;
    chipBg: string;
    chipBorder: string;
    chipText: string;
    chipSelectedBg: string;
    chipSelectedBorder: string;
    chipSelectedText: string;
    avatarSizeSmall: number;
    avatarSizeMedium: number;
    avatarSizeLarge: number;
    avatarBg: string;
    avatarBorder: string;
    avatarText: string;
    breadcrumbHeight: number;
    breadcrumbGap: number;
    breadcrumbSeparatorColor: string;
    breadcrumbCurrentColor: string;
    spinnerSize: number;
    spinnerColor: string;
    statusHeight: number;
    statusPaddingX: number;
    /** Per-kind background/text for status pills. Keys: success|info|warning|error. */
    statusColors: Readonly<Record<'success' | 'info' | 'warning' | 'error', {
        bg: string;
        fg: string;
        border: string;
    }>>;
    annotationBg: string;
    annotationBorder: string;
    annotationText: string;
    annotationLineColor: string;
    annotationDotColor: string;
    annotationStrokeWidth: number;
    annotationDotRadius: number;
    annotationCornerRadius: number;
    annotationPaddingX: number;
    annotationPaddingY: number;
    annotationGap: number;
    annotationMargin: number;
    annotationStackGap: number;
    /** Maps accent name → color used for borders, fills, and text treatments. */
    accents: Readonly<Record<AccentName, string>>;
    /** Maps state name → visual treatment applied to slots and cells. */
    states: Readonly<Record<StateName, StateStyle>>;
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

export { type AnnotationNode, type AnnotationSide, type AnyNode, type Attribute, type AttributeFlag, type AttributePair, type AttributeValue, type AvatarNode, type BreadcrumbNode, type ButtonNode, type CellNode, type ChartNode, type CheckboxNode, type ChipNode, type ColNode, type ColWidth, type ComboNode, type ContainerChild, type CrumbNode, DARK_THEME, DEFAULT_THEME, type DividerNode, type Document, type FooterNode, type GridNode, type HeaderNode, type IconNode, type ImageNode, type InputNode, type ItemNode, type KvNode, type LeafNode, type LengthUnit, type LengthValue, type ListNode, type MenuChild, type MenuItemNode, type MenuNode, type MenubarNode, type NavbarNode, type NavbarSlotNode, type PanelNode, type ProgressNode, type RadioNode, type RenderOptions, type RenderResult, type ResourceBarNode, type ResourceNode, type RowNode, type SectionNode, type SeparatorNode, type SliderNode, type SlotFooterNode, type SlotNode, type SourcePosition, type SpacerNode, type SpinnerNode, type StatNode, type StatsNode, type StatusKind, type StatusNode, type TabNode, type TabsNode, type TextNode, type Theme, type ToggleNode, type TreeItemNode, type TreeNode_, type WindowChild, type WindowNode, type WireloomConfig, WireloomError, type WireloomSecurityLevel, type WireloomTheme, wireloom as default, initialize, parse, render, serialize };
