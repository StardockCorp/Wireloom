/**
 * AST → source serializer.
 *
 * Emits a canonical wireloom source string from a {@link Document}. Used
 * primarily for roundtrip idempotence tests and as a building block for
 * future tooling (formatter, structural diff). Output is not byte-identical
 * to hand-written source — comments and non-canonical whitespace are lost —
 * but re-parsing the output must yield an AST that deep-equals the input.
 */

import type {
  AnnotationNode,
  AnyNode,
  Attribute,
  AttributeFlag,
  AttributePair,
  AttributeValue,
  AvatarNode,
  CellNode,
  TabItemNode,
  CheckboxNode,
  ChipNode,
  ColNode,
  ComboNode,
  CrumbNode,
  Document,
  GridNode,
  ItemNode,
  KvNode,
  MenuItemNode,
  MenuNode,
  NavbarNode,
  RadioNode,
  SectionNode,
  SegmentNode,
  SlotNode,
  SpinnerNode,
  StatNode,
  StatusNode,
  TabNode,
  TextNode,
  ToggleNode,
  TreeItemNode,
  WindowNode,
} from './ast.js';

export function serialize(doc: Document): string {
  if (!doc.root) return '';
  const lines: string[] = [];
  serializeNode(doc.root, 0, lines);
  if (doc.annotations) {
    for (const a of doc.annotations) {
      serializeNode(a, 0, lines);
    }
  }
  return lines.join('\n') + '\n';
}

function serializeNode(node: AnyNode, depth: number, out: string[]): void {
  const indent = '  '.repeat(depth);
  const keyword =
    node.kind === 'slotFooter'
      ? 'footer'
      : node.kind === 'treeNode'
        ? 'node'
        : node.kind === 'navbarLeading'
          ? 'leading'
          : node.kind === 'navbarCenter'
            ? 'center'
            : node.kind === 'navbarTrailing'
              ? 'trailing'
              : node.kind;
  const parts: string[] = [keyword];

  // Positional args by kind.
  switch (node.kind) {
    case 'window':
      if ((node as WindowNode).title !== undefined) {
        parts.push(quoteString((node as WindowNode).title as string));
      }
      break;
    case 'section':
      parts.push(quoteString((node as SectionNode).title));
      break;
    case 'slot':
      parts.push(quoteString((node as SlotNode).title));
      break;
    case 'tab':
      parts.push(quoteString((node as TabNode).label));
      break;
    case 'tabitem':
      parts.push(quoteString((node as TabItemNode).label));
      break;
    case 'item':
      parts.push(quoteString((node as ItemNode).text));
      break;
    case 'text':
      parts.push(quoteString((node as TextNode).content));
      break;
    case 'button':
      parts.push(quoteString(node.label));
      break;
    case 'backbutton':
      parts.push(quoteString(node.label));
      break;
    case 'kv':
      parts.push(quoteString((node as KvNode).label));
      parts.push(quoteString((node as KvNode).value));
      break;
    case 'combo':
      if ((node as ComboNode).label !== undefined) {
        parts.push(quoteString((node as ComboNode).label as string));
      }
      break;
    case 'col': {
      const col = node as ColNode;
      if (col.width.kind === 'length' && col.width.unit === 'px') {
        parts.push(String(col.width.value));
      }
      // `fill` and default are both emitted as no positional — identical re-parse.
      break;
    }
    case 'cell': {
      const cell = node as CellNode;
      if (cell.label !== undefined) {
        parts.push(quoteString(cell.label));
      }
      break;
    }
    case 'stat':
      parts.push(quoteString((node as StatNode).label));
      parts.push(quoteString((node as StatNode).value));
      break;
    case 'annotation':
      parts.push(quoteString((node as AnnotationNode).body));
      break;
    case 'treeNode':
      parts.push(quoteString((node as TreeItemNode).label));
      break;
    case 'menu':
      parts.push(quoteString((node as MenuNode).label));
      break;
    case 'menuitem':
      parts.push(quoteString((node as MenuItemNode).label));
      break;
    case 'crumb':
      parts.push(quoteString((node as CrumbNode).label));
      break;
    case 'checkbox':
      parts.push(quoteString((node as CheckboxNode).label));
      break;
    case 'radio':
      parts.push(quoteString((node as RadioNode).label));
      break;
    case 'toggle':
      parts.push(quoteString((node as ToggleNode).label));
      break;
    case 'chip':
      parts.push(quoteString((node as ChipNode).label));
      break;
    case 'avatar':
      parts.push(quoteString((node as AvatarNode).initials));
      break;
    case 'spinner': {
      const sp = node as SpinnerNode;
      if (sp.label !== undefined) parts.push(quoteString(sp.label));
      break;
    }
    case 'status':
      parts.push(quoteString((node as StatusNode).label));
      break;
    case 'segment':
      parts.push(quoteString((node as SegmentNode).label));
      break;
    default:
      // No positional args for header/footer/panel/tabs/row/list/input/slider/image/icon/divider/
      // grid/resourcebar/resource/stats/progress/chart/slotFooter.
      break;
  }

  // Attributes
  for (const attr of node.attributes) {
    parts.push(serializeAttribute(attr));
  }

  const children = nodeChildren(node);
  if (children.length > 0) {
    out.push(indent + parts.join(' ') + ':');
    for (const child of children) {
      serializeNode(child, depth + 1, out);
    }
  } else {
    out.push(indent + parts.join(' '));
  }
}

function nodeChildren(node: AnyNode): AnyNode[] {
  if (node.kind === 'slot') {
    const slot = node as SlotNode;
    const kids: AnyNode[] = [...slot.children];
    if (slot.slotFooter) kids.push(slot.slotFooter);
    return kids;
  }
  if (node.kind === 'navbar') {
    // navbar's "children" in source order are leading then trailing — the AST
    // shape stores them as named optional fields rather than a flat array.
    const navbar = node as NavbarNode;
    const kids: AnyNode[] = [];
    if (navbar.leading) kids.push(navbar.leading);
    if (navbar.center) kids.push(navbar.center);
    if (navbar.trailing) kids.push(navbar.trailing);
    return kids;
  }
  if (node.kind === 'grid') return (node as GridNode).children;
  if (node.kind === 'resource') return [];
  // Most other branches just forward their children array.
  if ('children' in node && Array.isArray((node as unknown as { children: AnyNode[] }).children)) {
    return (node as unknown as { children: AnyNode[] }).children;
  }
  return [];
}

function serializeAttribute(attr: Attribute): string {
  if (attr.kind === 'flag') {
    return (attr as AttributeFlag).flag;
  }
  const pair = attr as AttributePair;
  return `${pair.key}=${serializeValue(pair.value)}`;
}

function serializeValue(v: AttributeValue): string {
  switch (v.kind) {
    case 'string':
      return quoteString(v.value);
    case 'number':
      if (v.unit === 'percent') return `${v.value}%`;
      if (v.unit === 'fr') return `${v.value}fr`;
      return String(v.value);
    case 'range':
      return `${v.min}-${v.max}`;
    case 'identifier':
      return v.value;
  }
}

function quoteString(s: string): string {
  return (
    '"' +
    s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n') +
    '"'
  );
}
