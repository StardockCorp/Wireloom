/**
 * Wireloom parser — recursive-descent, token-driven.
 *
 * Consumes a tokenized source stream and produces a {@link Document}
 * conforming to ast.ts. Errors are always {@link WireloomError} with
 * line/column information.
 */

import type {
  AnnotationNode,
  AnnotationSide,
  Attribute,
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
  ColWidth,
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
  MenuChild,
  MenuItemNode,
  MenuNode,
  PanelNode,
  ProgressNode,
  RadioNode,
  ResourceBarNode,
  ResourceNode,
  RowNode,
  SectionNode,
  SeparatorNode,
  SliderNode,
  SlotFooterNode,
  SlotNode,
  SourcePosition,
  SpinnerNode,
  StatNode,
  StatsNode,
  StatusNode,
  TabNode,
  TabsNode,
  TextNode,
  ToggleNode,
  TreeNode_,
  TreeItemNode,
  WindowChild,
  WindowNode,
} from './ast.js';
import { WireloomError } from './errors.js';
import { tokenize, type Token, type TokenKind } from './lexer.js';

// ---------------------------------------------------------------------------
// Attribute rule system
// ---------------------------------------------------------------------------

type AttrSpec =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'range' }
  | { kind: 'ident' }
  | { kind: 'enum'; values: readonly string[] };

interface AttrRules {
  attrs: Record<string, AttrSpec>;
  flags: string[];
}

const WEIGHT_VALUES = ['light', 'regular', 'semibold', 'bold'] as const;
const SIZE_VALUES = ['small', 'regular', 'large'] as const;
const ALIGN_VALUES = ['left', 'center', 'right'] as const;
const INPUT_TYPE_VALUES = ['text', 'password', 'email'] as const;
const ACCENT_VALUES = [
  'research',
  'military',
  'industry',
  'wealth',
  'approval',
  'warning',
  'danger',
  'success',
] as const;
/**
 * Unified state enum for slots and cells. Covers tier/lifecycle UIs —
 * e.g. Matrix sectors (locked/available/purchased/maxed) and Oligarchy
 * investments (growing/ripe/withering/cashed). Kept as a single enum so
 * authors don't have to remember which states apply to which primitive.
 */
const STATE_VALUES = [
  'locked',
  'available',
  'active',
  'purchased',
  'maxed',
  'growing',
  'ripe',
  'withering',
  'cashed',
] as const;
const CHART_KIND_VALUES = ['bar', 'line', 'pie'] as const;
const ANNOTATION_SIDE_VALUES = ['left', 'right', 'top', 'bottom'] as const;
const AVATAR_SIZE_VALUES = ['small', 'medium', 'large'] as const;
const STATUS_KIND_VALUES = ['success', 'info', 'warning', 'error'] as const;

/** Spec for the universal `id="…"` attribute, accepted on every primitive. */
const UNIVERSAL_ID_SPEC: AttrSpec = { kind: 'string' };

const ATTR_RULES: Record<string, AttrRules> = {
  window: { attrs: {}, flags: [] },
  header: { attrs: {}, flags: [] },
  footer: { attrs: {}, flags: [] },
  panel: { attrs: {}, flags: [] },
  section: {
    attrs: {
      badge: { kind: 'string' },
      accent: { kind: 'enum', values: ACCENT_VALUES },
    },
    flags: [],
  },
  tabs: { attrs: {}, flags: [] },
  tab: {
    attrs: { badge: { kind: 'string' } },
    flags: ['active'],
  },
  row: {
    attrs: { align: { kind: 'enum', values: ALIGN_VALUES } },
    flags: [],
  },
  col: { attrs: {}, flags: [] },
  list: { attrs: {}, flags: [] },
  item: { attrs: {}, flags: [] },
  slot: {
    attrs: {
      state: { kind: 'enum', values: STATE_VALUES },
      accent: { kind: 'enum', values: ACCENT_VALUES },
    },
    flags: ['active'],
  },
  slotFooter: { attrs: {}, flags: [] },
  grid: {
    attrs: {
      cols: { kind: 'number' },
      rows: { kind: 'number' },
    },
    flags: [],
  },
  cell: {
    attrs: {
      row: { kind: 'number' },
      col: { kind: 'number' },
      state: { kind: 'enum', values: STATE_VALUES },
      accent: { kind: 'enum', values: ACCENT_VALUES },
    },
    flags: [],
  },
  resourcebar: { attrs: {}, flags: [] },
  resource: {
    attrs: {
      name: { kind: 'string' },
      value: { kind: 'string' },
      icon: { kind: 'string' },
    },
    flags: [],
  },
  stats: { attrs: {}, flags: [] },
  stat: {
    attrs: {},
    flags: ['bold', 'muted'],
  },
  text: {
    attrs: {
      weight: { kind: 'enum', values: WEIGHT_VALUES },
      size: { kind: 'enum', values: SIZE_VALUES },
    },
    flags: ['bold', 'italic', 'muted'],
  },
  button: {
    attrs: {
      badge: { kind: 'string' },
      accent: { kind: 'enum', values: ACCENT_VALUES },
    },
    flags: ['primary', 'disabled'],
  },
  input: {
    attrs: {
      placeholder: { kind: 'string' },
      type: { kind: 'enum', values: INPUT_TYPE_VALUES },
    },
    flags: ['disabled'],
  },
  combo: {
    attrs: {
      value: { kind: 'string' },
      options: { kind: 'string' },
    },
    flags: ['disabled'],
  },
  slider: {
    attrs: {
      range: { kind: 'range' },
      value: { kind: 'number' },
      label: { kind: 'string' },
    },
    flags: ['disabled'],
  },
  kv: {
    attrs: {
      weight: { kind: 'enum', values: WEIGHT_VALUES },
      size: { kind: 'enum', values: SIZE_VALUES },
    },
    flags: ['bold', 'italic', 'muted'],
  },
  image: {
    attrs: {
      label: { kind: 'string' },
      width: { kind: 'number' },
      height: { kind: 'number' },
    },
    flags: [],
  },
  icon: {
    attrs: {
      name: { kind: 'string' },
      accent: { kind: 'enum', values: ACCENT_VALUES },
    },
    flags: [],
  },
  divider: { attrs: {}, flags: [] },
  progress: {
    attrs: {
      value: { kind: 'number' },
      max: { kind: 'number' },
      label: { kind: 'string' },
      accent: { kind: 'enum', values: ACCENT_VALUES },
    },
    flags: [],
  },
  chart: {
    attrs: {
      kind: { kind: 'enum', values: CHART_KIND_VALUES },
      label: { kind: 'string' },
      width: { kind: 'number' },
      height: { kind: 'number' },
      accent: { kind: 'enum', values: ACCENT_VALUES },
    },
    flags: [],
  },
  annotation: {
    attrs: {
      target: { kind: 'string' },
      position: { kind: 'enum', values: ANNOTATION_SIDE_VALUES },
    },
    flags: [],
  },
  tree: { attrs: {}, flags: [] },
  treeNode: {
    attrs: { icon: { kind: 'string' } },
    flags: ['collapsed', 'selected'],
  },
  checkbox: {
    attrs: {},
    flags: ['checked', 'disabled', 'label-right'],
  },
  radio: {
    attrs: { group: { kind: 'string' } },
    flags: ['selected', 'disabled', 'label-right'],
  },
  toggle: {
    attrs: {},
    flags: ['on', 'off', 'disabled', 'label-right'],
  },
  menubar: { attrs: {}, flags: [] },
  menu: { attrs: {}, flags: [] },
  menuitem: {
    attrs: { shortcut: { kind: 'string' } },
    flags: ['disabled'],
  },
  separator: { attrs: {}, flags: [] },
  chip: {
    attrs: {
      icon: { kind: 'string' },
      accent: { kind: 'enum', values: ACCENT_VALUES },
    },
    flags: ['closable', 'selected'],
  },
  avatar: {
    attrs: {
      size: { kind: 'enum', values: AVATAR_SIZE_VALUES },
      accent: { kind: 'enum', values: ACCENT_VALUES },
    },
    flags: [],
  },
  breadcrumb: { attrs: {}, flags: [] },
  crumb: {
    attrs: { icon: { kind: 'string' } },
    flags: [],
  },
  spinner: { attrs: {}, flags: [] },
  status: {
    attrs: {
      kind: { kind: 'enum', values: STATUS_KIND_VALUES },
    },
    flags: [],
  },
};

const VALID_PRIMITIVES = new Set([
  ...Object.keys(ATTR_RULES).filter((k) => k !== 'treeNode' && k !== 'slotFooter'),
  'node',
]);

/** Primitives allowed as direct children of a general container (panel/section/row/col/slot/header/footer). */
const CONTAINER_CHILD_PRIMITIVES = new Set([
  'panel',
  'section',
  'tabs',
  'row',
  'col',
  'list',
  'slot',
  'grid',
  'resourcebar',
  'stats',
  'text',
  'button',
  'input',
  'combo',
  'slider',
  'kv',
  'image',
  'icon',
  'divider',
  'progress',
  'chart',
  'tree',
  'menubar',
  'menu',
  'breadcrumb',
  'checkbox',
  'radio',
  'toggle',
  'chip',
  'avatar',
  'spinner',
  'status',
]);

const LIST_CHILD_PRIMITIVES = new Set(['item', 'slot']);

const PRIMITIVE_LIST_HUMAN =
  'window, header, footer, panel, section, tabs, tab, row, col, list, item, slot, grid, cell, resourcebar, resource, stats, stat, text, button, input, combo, slider, kv, image, icon, divider, progress, chart, tree, node, menubar, menu, menuitem, separator, chip, avatar, breadcrumb, crumb, spinner, status';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function parse(source: string): Document {
  const tokens = tokenize(source);
  const lines = source.split(/\r\n|\r|\n/).length;
  const parser = new Parser(tokens);
  return parser.parseDocument(lines);
}

class Parser {
  private readonly tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parseDocument(sourceLines: number): Document {
    if (this.peek().kind === 'eof') {
      return { kind: 'document', sourceLines };
    }

    const head = this.peek();
    if (head.kind !== 'ident') {
      throw new WireloomError(
        `expected root "window" node, got ${describeToken(head)}`,
        head.line,
        head.column,
      );
    }
    if (head.identValue !== 'window') {
      throw new WireloomError(
        `root node must be "window", got "${head.identValue ?? head.raw}"`,
        head.line,
        head.column,
      );
    }

    const root = this.parseWindow();

    // After the window, any number of annotations may follow as siblings.
    const annotations: AnnotationNode[] = [];
    while (this.peek().kind === 'ident') {
      const tok = this.peek();
      const name = tok.identValue ?? tok.raw;
      if (name === 'annotation') {
        annotations.push(this.parseAnnotation());
        continue;
      }
      if (name === 'window') {
        throw new WireloomError(
          'only one root "window" node is allowed',
          tok.line,
          tok.column,
        );
      }
      throw new WireloomError(
        `unexpected "${name}" after "window" — only "annotation" may follow`,
        tok.line,
        tok.column,
      );
    }

    if (this.peek().kind !== 'eof') {
      const extra = this.peek();
      throw new WireloomError(
        'only one root "window" node is allowed',
        extra.line,
        extra.column,
      );
    }

    const doc: Document = { kind: 'document', root, sourceLines };
    if (annotations.length > 0) doc.annotations = annotations;
    return doc;
  }

  // --- Annotation -----------------------------------------------------------

  private parseAnnotation(): AnnotationNode {
    const head = this.consume();
    const position = positionOf(head);
    const body = this.expectKind(
      'string',
      '"annotation" requires a label string (e.g., annotation "Power Button" target="power-btn" position=right)',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('annotation');
    this.parseLeafTerminator('annotation', head);

    const target = getAttrStringValue(attributes, 'target');
    if (target === undefined || target === '') {
      throw new WireloomError(
        '"annotation" requires target="…" referencing an id in the window (e.g., annotation "Power" target="power-btn" position=right)',
        head.line,
        head.column,
      );
    }
    const sideRaw = getAttrIdentValue(attributes, 'position');
    if (sideRaw === undefined) {
      throw new WireloomError(
        '"annotation" requires position=left|right|top|bottom (explicit placement — no default)',
        head.line,
        head.column,
      );
    }
    const side = sideRaw as AnnotationSide;

    return { kind: 'annotation', target, side, body, attributes, position };
  }

  // --- Window ---------------------------------------------------------------

  private parseWindow(): WindowNode {
    const head = this.consume();
    const position = positionOf(head);

    let title: string | undefined;
    if (this.peek().kind === 'string') {
      title = this.consume().stringValue;
    }

    const attributes = this.parseAttributes('window');
    const hasChildren = this.parseTerminator('window', head);
    const children: WindowChild[] = hasChildren ? this.parseWindowChildren() : [];

    const node: WindowNode = { kind: 'window', attributes, children, position };
    if (title !== undefined) {
      node.title = title;
    }
    return node;
  }

  private parseWindowChildren(): WindowChild[] {
    const children: WindowChild[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      children.push(this.parseWindowChild());
    }
    this.expectKind('dedent', 'children block did not close cleanly');
    return children;
  }

  private parseWindowChild(): WindowChild {
    const head = this.peek();
    if (head.kind !== 'ident') {
      throw new WireloomError(
        `expected a primitive, got ${describeToken(head)}`,
        head.line,
        head.column,
      );
    }
    const name = head.identValue ?? head.raw;
    if (!VALID_PRIMITIVES.has(name)) {
      throw new WireloomError(unknownPrimitiveMessage(name), head.line, head.column);
    }
    if (name === 'window') {
      throw new WireloomError(
        '"window" cannot be nested — only one root "window" is allowed',
        head.line,
        head.column,
      );
    }
    if (name === 'tab') {
      throw new WireloomError(
        '"tab" may only appear inside "tabs"',
        head.line,
        head.column,
      );
    }
    if (name === 'item') {
      throw new WireloomError(
        '"item" may only appear inside "list"',
        head.line,
        head.column,
      );
    }
    if (name === 'cell') {
      throw new WireloomError(
        '"cell" may only appear inside "grid"',
        head.line,
        head.column,
      );
    }
    if (name === 'resource') {
      throw new WireloomError(
        '"resource" may only appear inside "resourcebar"',
        head.line,
        head.column,
      );
    }
    if (name === 'stat') {
      throw new WireloomError(
        '"stat" may only appear inside "stats"',
        head.line,
        head.column,
      );
    }
    if (name === 'node') {
      throw new WireloomError(
        '"node" may only appear inside "tree"',
        head.line,
        head.column,
      );
    }
    if (name === 'menuitem') {
      throw new WireloomError(
        '"menuitem" may only appear inside "menu"',
        head.line,
        head.column,
      );
    }
    if (name === 'separator') {
      throw new WireloomError(
        '"separator" may only appear inside "menu"',
        head.line,
        head.column,
      );
    }
    if (name === 'crumb') {
      throw new WireloomError(
        '"crumb" may only appear inside "breadcrumb"',
        head.line,
        head.column,
      );
    }
    if (name === 'header') return this.parseHeader();
    if (name === 'footer') return this.parseFooter();
    return this.parseContainerChildNamed(name);
  }

  // --- Header / Footer ------------------------------------------------------

  private parseHeader(): HeaderNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('header');
    const hasChildren = this.parseTerminator('header', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: 'header', attributes, children, position };
  }

  private parseFooter(): FooterNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('footer');
    const hasChildren = this.parseTerminator('footer', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: 'footer', attributes, children, position };
  }

  // --- Container children ---------------------------------------------------

  private parseContainerChildren(): ContainerChild[] {
    const children: ContainerChild[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      children.push(this.parseContainerChild());
    }
    this.expectKind('dedent', 'children block did not close cleanly');
    return children;
  }

  private parseContainerChild(): ContainerChild {
    const head = this.peek();
    if (head.kind !== 'ident') {
      throw new WireloomError(
        `expected a primitive, got ${describeToken(head)}`,
        head.line,
        head.column,
      );
    }
    const name = head.identValue ?? head.raw;
    if (!VALID_PRIMITIVES.has(name)) {
      throw new WireloomError(unknownPrimitiveMessage(name), head.line, head.column);
    }
    if (!CONTAINER_CHILD_PRIMITIVES.has(name)) {
      const reason =
        name === 'tab'
          ? '"tab" may only appear inside "tabs"'
          : name === 'item'
            ? '"item" may only appear inside "list"'
            : name === 'header'
              ? '"header" may only appear directly inside "window"'
              : name === 'footer'
                ? '"footer" may only appear directly inside "window" or "slot"'
                : name === 'window'
                  ? '"window" cannot be nested'
                  : name === 'cell'
                    ? '"cell" may only appear inside "grid"'
                    : name === 'resource'
                      ? '"resource" may only appear inside "resourcebar"'
                      : name === 'stat'
                        ? '"stat" may only appear inside "stats"'
                        : name === 'node'
                          ? '"node" may only appear inside "tree"'
                          : name === 'menuitem'
                            ? '"menuitem" may only appear inside "menu"'
                            : name === 'separator'
                              ? '"separator" may only appear inside "menu"'
                              : name === 'crumb'
                                ? '"crumb" may only appear inside "breadcrumb"'
                                : `"${name}" is not allowed here`;
      throw new WireloomError(reason, head.line, head.column);
    }
    return this.parseContainerChildNamed(name);
  }

  private parseContainerChildNamed(name: string): ContainerChild {
    switch (name) {
      case 'panel':
        return this.parsePanel();
      case 'section':
        return this.parseSection();
      case 'tabs':
        return this.parseTabs();
      case 'row':
        return this.parseRow();
      case 'col':
        return this.parseCol();
      case 'list':
        return this.parseList();
      case 'slot':
        return this.parseSlot();
      case 'text':
        return this.parseText();
      case 'button':
        return this.parseButton();
      case 'input':
        return this.parseInput();
      case 'combo':
        return this.parseCombo();
      case 'slider':
        return this.parseSlider();
      case 'kv':
        return this.parseKv();
      case 'image':
        return this.parseImage();
      case 'icon':
        return this.parseIcon();
      case 'divider':
        return this.parseDivider();
      case 'grid':
        return this.parseGrid();
      case 'resourcebar':
        return this.parseResourceBar();
      case 'stats':
        return this.parseStats();
      case 'progress':
        return this.parseProgress();
      case 'chart':
        return this.parseChart();
      case 'tree':
        return this.parseTree();
      case 'menubar':
        return this.parseMenubar();
      case 'menu':
        return this.parseMenu();
      case 'breadcrumb':
        return this.parseBreadcrumb();
      case 'checkbox':
        return this.parseCheckbox();
      case 'radio':
        return this.parseRadio();
      case 'toggle':
        return this.parseToggle();
      case 'chip':
        return this.parseChip();
      case 'avatar':
        return this.parseAvatar();
      case 'spinner':
        return this.parseSpinner();
      case 'status':
        return this.parseStatus();
      default: {
        const head = this.peek();
        throw new WireloomError(unknownPrimitiveMessage(name), head.line, head.column);
      }
    }
  }

  // --- Panel / Section / Row / Col ------------------------------------------

  private parsePanel(): PanelNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('panel');
    const hasChildren = this.parseTerminator('panel', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: 'panel', attributes, children, position };
  }

  private parseSection(): SectionNode {
    const head = this.consume();
    const position = positionOf(head);
    const title = this.expectKind(
      'string',
      '"section" requires a title string (e.g., section "Economy":)',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('section');
    const hasChildren = this.parseTerminator('section', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: 'section', title, attributes, children, position };
  }

  private parseTabs(): TabsNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('tabs');
    const hasChildren = this.parseTerminator('tabs', head);
    const children = hasChildren ? this.parseTabChildren() : [];
    return { kind: 'tabs', attributes, children, position };
  }

  private parseTabChildren(): TabNode[] {
    const children: TabNode[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const head = this.peek();
      if (head.kind !== 'ident') {
        throw new WireloomError(
          `expected a "tab" primitive, got ${describeToken(head)}`,
          head.line,
          head.column,
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== 'tab') {
        throw new WireloomError(
          `"tabs" accepts only "tab" children (got "${name}")`,
          head.line,
          head.column,
        );
      }
      children.push(this.parseTab());
    }
    this.expectKind('dedent', 'tabs block did not close cleanly');
    return children;
  }

  private parseTab(): TabNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"tab" requires a string label (e.g., tab "Government")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('tab');
    this.parseLeafTerminator('tab', head);
    return { kind: 'tab', label, attributes, position };
  }

  private parseRow(): RowNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('row');
    const hasChildren = this.parseTerminator('row', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: 'row', attributes, children, position };
  }

  private parseCol(): ColNode {
    const head = this.consume();
    const position = positionOf(head);

    let width: ColWidth = { kind: 'fill' };

    // Optional width positional: either a pixel NUMBER or the bare identifier
    // `fill`. Percent / fr units are not accepted as a positional — they're
    // grammar errors here, not a silently-different sizing mode.
    const next = this.peek();
    if (next.kind === 'number') {
      const tok = this.consume();
      const unit = tok.unit ?? 'px';
      if (unit !== 'px') {
        throw new WireloomError(
          `"col" positional width must be a pixel number or "fill"; got "${tok.raw}"`,
          tok.line,
          tok.column,
        );
      }
      width = { kind: 'length', value: tok.numericValue ?? 0, unit: 'px' };
    } else if (next.kind === 'ident' && next.identValue === 'fill') {
      this.consume();
      width = { kind: 'fill' };
    }

    const attributes = this.parseAttributes('col');
    const hasChildren = this.parseTerminator('col', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: 'col', width, attributes, children, position };
  }

  // --- List / Item / Slot ---------------------------------------------------

  private parseList(): ListNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('list');
    const hasChildren = this.parseTerminator('list', head);
    const children = hasChildren ? this.parseListChildren() : [];
    return { kind: 'list', attributes, children, position };
  }

  private parseListChildren(): (ItemNode | SlotNode)[] {
    const children: (ItemNode | SlotNode)[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const head = this.peek();
      if (head.kind !== 'ident') {
        throw new WireloomError(
          `expected "item" or "slot", got ${describeToken(head)}`,
          head.line,
          head.column,
        );
      }
      const name = head.identValue ?? head.raw;
      if (!LIST_CHILD_PRIMITIVES.has(name)) {
        throw new WireloomError(
          `"list" accepts only "item" or "slot" children (got "${name}")`,
          head.line,
          head.column,
        );
      }
      if (name === 'item') {
        children.push(this.parseItem());
      } else {
        children.push(this.parseSlot());
      }
    }
    this.expectKind('dedent', 'list block did not close cleanly');
    return children;
  }

  private parseItem(): ItemNode {
    const head = this.consume();
    const position = positionOf(head);
    const text = this.expectKind(
      'string',
      '"item" requires a string text argument (e.g., item "Home")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('item');
    this.parseLeafTerminator('item', head);
    return { kind: 'item', text, attributes, position };
  }

  private parseSlot(): SlotNode {
    const head = this.consume();
    const position = positionOf(head);
    const title = this.expectKind(
      'string',
      '"slot" requires a title string (e.g., slot "Colonial Defense Pact":)',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('slot');
    const hasChildren = this.parseTerminator('slot', head);
    const { children, slotFooter } = hasChildren
      ? this.parseSlotChildren()
      : { children: [] as ContainerChild[], slotFooter: undefined };
    const node: SlotNode = { kind: 'slot', title, attributes, children, position };
    if (slotFooter) node.slotFooter = slotFooter;
    return node;
  }

  /**
   * Parse children of a `slot`. Accepts standard container children plus an
   * optional trailing `footer:` block (at most one, must be the last child).
   */
  private parseSlotChildren(): { children: ContainerChild[]; slotFooter?: SlotFooterNode } {
    const children: ContainerChild[] = [];
    let slotFooter: SlotFooterNode | undefined;
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const head = this.peek();
      const name = head.kind === 'ident' ? head.identValue ?? head.raw : undefined;
      if (name === 'footer') {
        if (slotFooter !== undefined) {
          throw new WireloomError(
            '"slot" may contain at most one "footer" block',
            head.line,
            head.column,
          );
        }
        slotFooter = this.parseSlotFooter();
        continue;
      }
      // Non-footer child: if a footer is already parsed, that footer wasn't last.
      if (slotFooter !== undefined) {
        throw new WireloomError(
          '"footer" inside "slot" must be the last child',
          head.line,
          head.column,
        );
      }
      children.push(this.parseContainerChild());
    }
    this.expectKind('dedent', 'slot children block did not close cleanly');
    return slotFooter ? { children, slotFooter } : { children };
  }

  private parseSlotFooter(): SlotFooterNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('slotFooter');
    const hasChildren = this.parseTerminator('footer', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: 'slotFooter', attributes, children, position };
  }

  // --- Leaves ---------------------------------------------------------------

  private parseText(): TextNode {
    const head = this.consume();
    const position = positionOf(head);
    const content = this.expectKind(
      'string',
      '"text" requires a string argument (e.g., text "Hello")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('text');
    this.parseLeafTerminator('text', head);
    return { kind: 'text', content, attributes, position };
  }

  private parseButton(): ButtonNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"button" requires a string label (e.g., button "Save")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('button');
    this.parseLeafTerminator('button', head);
    return { kind: 'button', label, attributes, position };
  }

  private parseInput(): InputNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('input');
    this.parseLeafTerminator('input', head);
    return { kind: 'input', attributes, position };
  }

  private parseCombo(): ComboNode {
    const head = this.consume();
    const position = positionOf(head);
    let label: string | undefined;
    if (this.peek().kind === 'string') {
      label = this.consume().stringValue;
    }
    const attributes = this.parseAttributes('combo');
    this.parseLeafTerminator('combo', head);
    const node: ComboNode = { kind: 'combo', attributes, position };
    if (label !== undefined) node.label = label;
    return node;
  }

  private parseSlider(): SliderNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('slider');
    this.parseLeafTerminator('slider', head);
    return { kind: 'slider', attributes, position };
  }

  private parseKv(): KvNode {
    const head = this.consume();
    const position = positionOf(head);
    const labelTok = this.expectKind(
      'string',
      '"kv" requires a label string (e.g., kv "Tax Rate" "30%")',
    );
    const label = labelTok.stringValue ?? '';

    // Common mistake: writing both label and value as a single combined
    // string (e.g., `kv "Tax Rate=30%"`). Detect and emit a targeted hint
    // so the user doesn't have to guess what went wrong.
    if (this.peek().kind !== 'string' && /[=:]/.test(label)) {
      const splitChar = label.includes('=') ? '=' : ':';
      const idx = label.indexOf(splitChar);
      const left = label.slice(0, idx).trim();
      const right = label.slice(idx + 1).trim();
      throw new WireloomError(
        `"kv" needs two separate strings (label, value). Got only "${label}" — if you meant to split on "${splitChar}", try: kv "${left}" "${right}"`,
        labelTok.line,
        labelTok.column,
      );
    }

    const value = this.expectKind(
      'string',
      '"kv" requires a value string after the label (e.g., kv "Tax Rate" "30%")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('kv');
    this.parseLeafTerminator('kv', head);
    return { kind: 'kv', label, value, attributes, position };
  }

  private parseImage(): ImageNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('image');
    this.parseLeafTerminator('image', head);
    return { kind: 'image', attributes, position };
  }

  private parseIcon(): IconNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('icon');
    this.parseLeafTerminator('icon', head);
    return { kind: 'icon', attributes, position };
  }

  private parseDivider(): DividerNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('divider');
    this.parseLeafTerminator('divider', head);
    return { kind: 'divider', attributes, position };
  }

  private parseProgress(): ProgressNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('progress');
    this.parseLeafTerminator('progress', head);
    return { kind: 'progress', attributes, position };
  }

  private parseChart(): ChartNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('chart');
    this.parseLeafTerminator('chart', head);
    return { kind: 'chart', attributes, position };
  }

  // --- Grid / Cell ----------------------------------------------------------

  private parseGrid(): GridNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('grid');
    const cols = getAttrNumberValue(attributes, 'cols');
    const rows = getAttrNumberValue(attributes, 'rows');
    if (cols === undefined || cols < 1) {
      throw new WireloomError(
        '"grid" requires cols=N with N>=1 (e.g., grid cols=5 rows=5:)',
        head.line,
        head.column,
      );
    }
    if (rows === undefined || rows < 1) {
      throw new WireloomError(
        '"grid" requires rows=N with N>=1 (e.g., grid cols=5 rows=5:)',
        head.line,
        head.column,
      );
    }
    const hasChildren = this.parseTerminator('grid', head);
    const children = hasChildren ? this.parseGridChildren() : [];
    return { kind: 'grid', cols, rows, attributes, children, position };
  }

  private parseGridChildren(): CellNode[] {
    const children: CellNode[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const head = this.peek();
      if (head.kind !== 'ident') {
        throw new WireloomError(
          `expected "cell", got ${describeToken(head)}`,
          head.line,
          head.column,
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== 'cell') {
        throw new WireloomError(
          `"grid" accepts only "cell" children (got "${name}")`,
          head.line,
          head.column,
        );
      }
      children.push(this.parseCell());
    }
    this.expectKind('dedent', 'grid block did not close cleanly');
    return children;
  }

  private parseCell(): CellNode {
    const head = this.consume();
    const position = positionOf(head);
    let label: string | undefined;
    if (this.peek().kind === 'string') {
      label = this.consume().stringValue;
    }
    const attributes = this.parseAttributes('cell');
    const rowAttr = getAttrNumberValue(attributes, 'row');
    const colAttr = getAttrNumberValue(attributes, 'col');
    const hasChildren = this.parseTerminator('cell', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    const node: CellNode = { kind: 'cell', attributes, children, position };
    if (label !== undefined) node.label = label;
    if (rowAttr !== undefined) node.row = rowAttr;
    if (colAttr !== undefined) node.col = colAttr;
    return node;
  }

  // --- ResourceBar / Resource ----------------------------------------------

  private parseResourceBar(): ResourceBarNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('resourcebar');
    const hasChildren = this.parseTerminator('resourcebar', head);
    const children = hasChildren ? this.parseResourceChildren() : [];
    return { kind: 'resourcebar', attributes, children, position };
  }

  private parseResourceChildren(): ResourceNode[] {
    const children: ResourceNode[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const head = this.peek();
      if (head.kind !== 'ident') {
        throw new WireloomError(
          `expected "resource", got ${describeToken(head)}`,
          head.line,
          head.column,
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== 'resource') {
        throw new WireloomError(
          `"resourcebar" accepts only "resource" children (got "${name}")`,
          head.line,
          head.column,
        );
      }
      children.push(this.parseResource());
    }
    this.expectKind('dedent', 'resourcebar block did not close cleanly');
    return children;
  }

  private parseResource(): ResourceNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('resource');
    const name = getAttrStringValue(attributes, 'name');
    const value = getAttrStringValue(attributes, 'value');
    if (name === undefined) {
      throw new WireloomError(
        '"resource" requires name="…" (e.g., resource name="Credits" value="1,500")',
        head.line,
        head.column,
      );
    }
    if (value === undefined) {
      throw new WireloomError(
        '"resource" requires value="…" (e.g., resource name="Credits" value="1,500")',
        head.line,
        head.column,
      );
    }
    this.parseLeafTerminator('resource', head);
    return { kind: 'resource', name, value, attributes, position };
  }

  // --- Stats / Stat --------------------------------------------------------

  private parseStats(): StatsNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('stats');
    const hasChildren = this.parseTerminator('stats', head);
    const children = hasChildren ? this.parseStatChildren() : [];
    return { kind: 'stats', attributes, children, position };
  }

  private parseStatChildren(): StatNode[] {
    const children: StatNode[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const head = this.peek();
      if (head.kind !== 'ident') {
        throw new WireloomError(
          `expected "stat", got ${describeToken(head)}`,
          head.line,
          head.column,
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== 'stat') {
        throw new WireloomError(
          `"stats" accepts only "stat" children (got "${name}")`,
          head.line,
          head.column,
        );
      }
      children.push(this.parseStat());
    }
    this.expectKind('dedent', 'stats block did not close cleanly');
    return children;
  }

  private parseStat(): StatNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"stat" requires a label string (e.g., stat "INT" "4")',
    ).stringValue ?? '';
    const value = this.expectKind(
      'string',
      '"stat" requires a value string after the label (e.g., stat "INT" "4")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('stat');
    this.parseLeafTerminator('stat', head);
    return { kind: 'stat', label, value, attributes, position };
  }

  // --- Tree / node ---------------------------------------------------------

  private parseTree(): TreeNode_ {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('tree');
    const hasChildren = this.parseTerminator('tree', head);
    const children = hasChildren ? this.parseTreeChildren() : [];
    return { kind: 'tree', attributes, children, position };
  }

  private parseTreeChildren(): TreeItemNode[] {
    const children: TreeItemNode[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const head = this.peek();
      if (head.kind !== 'ident') {
        throw new WireloomError(
          `expected "node", got ${describeToken(head)}`,
          head.line,
          head.column,
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== 'node') {
        throw new WireloomError(
          `"tree" accepts only "node" children (got "${name}")`,
          head.line,
          head.column,
        );
      }
      children.push(this.parseTreeNode());
    }
    this.expectKind('dedent', 'tree block did not close cleanly');
    return children;
  }

  private parseTreeNode(): TreeItemNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"node" requires a label string (e.g., node "src":)',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('treeNode');
    const hasChildren = this.parseTerminator('node', head);
    const children = hasChildren ? this.parseTreeChildren() : [];
    return { kind: 'treeNode', label, attributes, children, position };
  }

  // --- Menubar / Menu ------------------------------------------------------

  private parseMenubar(): MenubarNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('menubar');
    const hasChildren = this.parseTerminator('menubar', head);
    const children = hasChildren ? this.parseMenubarChildren() : [];
    return { kind: 'menubar', attributes, children, position };
  }

  private parseMenubarChildren(): MenuNode[] {
    const children: MenuNode[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const head = this.peek();
      if (head.kind !== 'ident') {
        throw new WireloomError(
          `expected "menu", got ${describeToken(head)}`,
          head.line,
          head.column,
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== 'menu') {
        throw new WireloomError(
          `"menubar" accepts only "menu" children (got "${name}")`,
          head.line,
          head.column,
        );
      }
      children.push(this.parseMenu());
    }
    this.expectKind('dedent', 'menubar block did not close cleanly');
    return children;
  }

  private parseMenu(): MenuNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"menu" requires a label string (e.g., menu "File":)',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('menu');
    const hasChildren = this.parseTerminator('menu', head);
    const children = hasChildren ? this.parseMenuChildren() : [];
    return { kind: 'menu', label, attributes, children, position };
  }

  private parseMenuChildren(): MenuChild[] {
    const children: MenuChild[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const head = this.peek();
      if (head.kind !== 'ident') {
        throw new WireloomError(
          `expected "menuitem", "separator", or "menu", got ${describeToken(head)}`,
          head.line,
          head.column,
        );
      }
      const name = head.identValue ?? head.raw;
      if (name === 'menuitem') {
        children.push(this.parseMenuItem());
      } else if (name === 'separator') {
        children.push(this.parseSeparator());
      } else if (name === 'menu') {
        children.push(this.parseMenu());
      } else {
        throw new WireloomError(
          `"menu" accepts only "menuitem", "separator", or nested "menu" (got "${name}")`,
          head.line,
          head.column,
        );
      }
    }
    this.expectKind('dedent', 'menu block did not close cleanly');
    return children;
  }

  private parseMenuItem(): MenuItemNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"menuitem" requires a label string (e.g., menuitem "Open…")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('menuitem');
    this.parseLeafTerminator('menuitem', head);
    return { kind: 'menuitem', label, attributes, position };
  }

  private parseSeparator(): SeparatorNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('separator');
    this.parseLeafTerminator('separator', head);
    return { kind: 'separator', attributes, position };
  }

  // --- Breadcrumb / crumb --------------------------------------------------

  private parseBreadcrumb(): BreadcrumbNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('breadcrumb');
    const hasChildren = this.parseTerminator('breadcrumb', head);
    const children = hasChildren ? this.parseBreadcrumbChildren() : [];
    return { kind: 'breadcrumb', attributes, children, position };
  }

  private parseBreadcrumbChildren(): CrumbNode[] {
    const children: CrumbNode[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const head = this.peek();
      if (head.kind !== 'ident') {
        throw new WireloomError(
          `expected "crumb", got ${describeToken(head)}`,
          head.line,
          head.column,
        );
      }
      const name = head.identValue ?? head.raw;
      if (name !== 'crumb') {
        throw new WireloomError(
          `"breadcrumb" accepts only "crumb" children (got "${name}")`,
          head.line,
          head.column,
        );
      }
      children.push(this.parseCrumb());
    }
    this.expectKind('dedent', 'breadcrumb block did not close cleanly');
    return children;
  }

  private parseCrumb(): CrumbNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"crumb" requires a label string (e.g., crumb "Documents")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('crumb');
    this.parseLeafTerminator('crumb', head);
    return { kind: 'crumb', label, attributes, position };
  }

  // --- Form controls -------------------------------------------------------

  private parseCheckbox(): CheckboxNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"checkbox" requires a label string (e.g., checkbox "Enable")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('checkbox');
    this.parseLeafTerminator('checkbox', head);
    return { kind: 'checkbox', label, attributes, position };
  }

  private parseRadio(): RadioNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"radio" requires a label string (e.g., radio "Light" group="theme")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('radio');
    this.parseLeafTerminator('radio', head);
    return { kind: 'radio', label, attributes, position };
  }

  private parseToggle(): ToggleNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"toggle" requires a label string (e.g., toggle "Dark mode" on)',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('toggle');
    this.parseLeafTerminator('toggle', head);
    return { kind: 'toggle', label, attributes, position };
  }

  // --- Chip / avatar -------------------------------------------------------

  private parseChip(): ChipNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"chip" requires a label string (e.g., chip "Filter")',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('chip');
    this.parseLeafTerminator('chip', head);
    return { kind: 'chip', label, attributes, position };
  }

  private parseAvatar(): AvatarNode {
    const head = this.consume();
    const position = positionOf(head);
    const raw = this.expectKind(
      'string',
      '"avatar" requires an initials string (e.g., avatar "BW")',
    ).stringValue ?? '';
    // Initials are truncated to two characters at render time; preserve the
    // source value in the AST so serialization roundtrips byte-identical.
    const attributes = this.parseAttributes('avatar');
    this.parseLeafTerminator('avatar', head);
    return { kind: 'avatar', initials: raw, attributes, position };
  }

  // --- Spinner / status ----------------------------------------------------

  private parseSpinner(): SpinnerNode {
    const head = this.consume();
    const position = positionOf(head);
    let label: string | undefined;
    if (this.peek().kind === 'string') {
      label = this.consume().stringValue;
    }
    const attributes = this.parseAttributes('spinner');
    this.parseLeafTerminator('spinner', head);
    const node: SpinnerNode = { kind: 'spinner', attributes, position };
    if (label !== undefined) node.label = label;
    return node;
  }

  private parseStatus(): StatusNode {
    const head = this.consume();
    const position = positionOf(head);
    const label = this.expectKind(
      'string',
      '"status" requires a label string (e.g., status "Saved" kind=success)',
    ).stringValue ?? '';
    const attributes = this.parseAttributes('status');
    const kindAttr = getAttrIdentValue(attributes, 'kind');
    if (kindAttr === undefined) {
      throw new WireloomError(
        '"status" requires kind=success|info|warning|error',
        head.line,
        head.column,
      );
    }
    this.parseLeafTerminator('status', head);
    return { kind: 'status', label, attributes, position };
  }

  // --- Attributes / terminators --------------------------------------------

  private parseAttributes(primitive: string): Attribute[] {
    const rules = ATTR_RULES[primitive] ?? { attrs: {}, flags: [] };
    const attrs: Attribute[] = [];

    while (this.peek().kind === 'ident') {
      const keyTok = this.consume();
      const key = keyTok.identValue ?? keyTok.raw;
      const position = positionOf(keyTok);

      if (this.match('equals')) {
        const valueTok = this.consume();
        // `id="…"` is universal — valid on every primitive. Used as the
        // target of `annotation` nodes. No uniqueness check in the parser;
        // layout uses the first match if duplicates are present.
        const spec: AttrSpec | undefined =
          key === 'id' ? UNIVERSAL_ID_SPEC : rules.attrs[key];
        if (spec === undefined) {
          const suggestion = suggestMatch(key, Object.keys(rules.attrs));
          const hint = suggestion ? `. Did you mean "${suggestion}"?` : '';
          throw new WireloomError(
            `unknown attribute "${key}" on "${primitive}"${hint}`,
            keyTok.line,
            keyTok.column,
          );
        }
        const value = coerceAttributeValue(valueTok, spec, key, primitive);
        const pair: AttributePair = { kind: 'pair', key, value, position };
        attrs.push(pair);
      } else {
        if (!rules.flags.includes(key)) {
          const suggestion = suggestMatch(key, rules.flags);
          const hint = suggestion ? `. Did you mean "${suggestion}"?` : '';
          throw new WireloomError(
            `unknown flag "${key}" on "${primitive}"${hint}`,
            keyTok.line,
            keyTok.column,
          );
        }
        attrs.push({ kind: 'flag', flag: key, position });
      }
    }

    return attrs;
  }

  /** Returns true if a children block follows, false for a leaf. */
  private parseTerminator(primitive: string, headToken: Token): boolean {
    if (this.match('colon')) {
      this.expectKind('newline', `expected newline after "${primitive}:"`);
      if (this.peek().kind !== 'indent') {
        throw new WireloomError(
          `"${primitive}" ends with ":" but has no indented children`,
          headToken.line,
          headToken.column,
        );
      }
      this.consume(); // indent
      return true;
    }
    this.expectKind('newline', `expected newline after "${primitive}"`);
    return false;
  }

  private parseLeafTerminator(primitive: string, headToken: Token): void {
    if (this.peek().kind === 'colon') {
      throw new WireloomError(
        `"${primitive}" cannot have children`,
        headToken.line,
        headToken.column,
      );
    }
    this.expectKind('newline', `expected newline after "${primitive}"`);
  }

  // --- Token helpers --------------------------------------------------------

  private peek(offset = 0): Token {
    const idx = this.pos + offset;
    const tok = this.tokens[idx];
    if (tok !== undefined) return tok;
    const last = this.tokens[this.tokens.length - 1];
    if (last === undefined) {
      throw new WireloomError('empty token stream', 1, 1);
    }
    return last;
  }

  private consume(): Token {
    const tok = this.peek();
    this.pos++;
    return tok;
  }

  private match(kind: TokenKind): Token | null {
    if (this.peek().kind === kind) {
      return this.consume();
    }
    return null;
  }

  private expectKind(kind: TokenKind, message: string): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new WireloomError(message, t.line, t.column);
    }
    return this.consume();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function positionOf(token: Token): SourcePosition {
  return { line: token.line, column: token.column };
}

function getAttrStringValue(attrs: readonly Attribute[], key: string): string | undefined {
  for (const a of attrs) {
    if (a.kind === 'pair' && a.key === key && a.value.kind === 'string') {
      return a.value.value;
    }
  }
  return undefined;
}

function getAttrNumberValue(attrs: readonly Attribute[], key: string): number | undefined {
  for (const a of attrs) {
    if (a.kind === 'pair' && a.key === key && a.value.kind === 'number') {
      return a.value.value;
    }
  }
  return undefined;
}

function getAttrIdentValue(attrs: readonly Attribute[], key: string): string | undefined {
  for (const a of attrs) {
    if (a.kind === 'pair' && a.key === key && a.value.kind === 'identifier') {
      return a.value.value;
    }
  }
  return undefined;
}

function describeToken(token: Token): string {
  switch (token.kind) {
    case 'ident':
      return `identifier "${token.identValue ?? token.raw}"`;
    case 'string':
      return `string ${JSON.stringify(token.stringValue ?? '')}`;
    case 'number':
      return `number ${token.numericValue}`;
    case 'range':
      return `range ${token.rangeMin}-${token.rangeMax}`;
    case 'newline':
      return 'end of line';
    case 'eof':
      return 'end of file';
    case 'indent':
      return 'indentation';
    case 'dedent':
      return 'dedent';
    case 'colon':
      return '":"';
    case 'equals':
      return '"="';
  }
}

function coerceAttributeValue(
  token: Token,
  spec: AttrSpec,
  key: string,
  primitive: string,
): AttributeValue {
  const position = positionOf(token);

  switch (spec.kind) {
    case 'string':
      if (token.kind !== 'string') {
        throw new WireloomError(
          `attribute "${key}" on "${primitive}" expects a string value, got ${describeToken(token)}`,
          token.line,
          token.column,
        );
      }
      return { kind: 'string', value: token.stringValue ?? '', position };

    case 'number':
      if (token.kind !== 'number') {
        throw new WireloomError(
          `attribute "${key}" on "${primitive}" expects a number value, got ${describeToken(token)}`,
          token.line,
          token.column,
        );
      }
      return {
        kind: 'number',
        value: token.numericValue ?? 0,
        unit: token.unit ?? 'px',
        position,
      };

    case 'range':
      if (token.kind !== 'range') {
        throw new WireloomError(
          `attribute "${key}" on "${primitive}" expects a range value like "0-100", got ${describeToken(token)}`,
          token.line,
          token.column,
        );
      }
      if ((token.rangeMax ?? 0) <= (token.rangeMin ?? 0)) {
        throw new WireloomError(
          `range must be N-M with M > N, got "${token.rangeMin}-${token.rangeMax}"`,
          token.line,
          token.column,
        );
      }
      return {
        kind: 'range',
        min: token.rangeMin ?? 0,
        max: token.rangeMax ?? 0,
        position,
      };

    case 'ident':
      if (token.kind !== 'ident') {
        throw new WireloomError(
          `attribute "${key}" on "${primitive}" expects an identifier value, got ${describeToken(token)}`,
          token.line,
          token.column,
        );
      }
      return {
        kind: 'identifier',
        value: token.identValue ?? token.raw,
        position,
      };

    case 'enum': {
      if (token.kind !== 'ident') {
        throw new WireloomError(
          `attribute "${key}" on "${primitive}" expects an identifier value, got ${describeToken(token)}`,
          token.line,
          token.column,
        );
      }
      const value = token.identValue ?? token.raw;
      if (!spec.values.includes(value)) {
        const suggestion = suggestMatch(value, spec.values);
        const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
        throw new WireloomError(
          `"${value}" is not a valid ${key} on "${primitive}" (expected one of: ${spec.values.join(', ')}).${hint}`,
          token.line,
          token.column,
        );
      }
      return { kind: 'identifier', value, position };
    }
  }
}

function unknownPrimitiveMessage(name: string): string {
  // Suggestions should only point at source-level keywords; `treeNode` and
  // `slotFooter` are AST-only names that users never write.
  const suggestion = suggestMatch(name, [...VALID_PRIMITIVES]);
  const base = `unknown primitive "${name}" (valid: ${PRIMITIVE_LIST_HUMAN})`;
  return suggestion ? `${base}. Did you mean "${suggestion}"?` : base;
}

/**
 * Returns the closest candidate string to `input` within a small edit-distance
 * threshold, or `undefined` if nothing close enough is found. Used to power
 * "did you mean?" hints in error messages.
 */
export function suggestMatch(input: string, candidates: readonly string[]): string | undefined {
  if (input.length < 2 || candidates.length === 0) return undefined;
  let best: string | undefined;
  let bestDist = Infinity;
  for (const cand of candidates) {
    const d = levenshtein(input, cand);
    if (d < bestDist) {
      bestDist = d;
      best = cand;
    }
  }
  // Only offer a suggestion when the edit distance is small relative to the
  // input — prevents noisy suggestions for wildly off inputs.
  const threshold = Math.min(2, Math.floor(input.length / 2));
  if (best !== undefined && bestDist <= threshold) return best;
  return undefined;
}

/** Standard Levenshtein edit distance. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    prev = [...curr];
  }
  return prev[n] ?? 0;
}
