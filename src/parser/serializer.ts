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
  AnyNode,
  Attribute,
  AttributeFlag,
  AttributePair,
  AttributeValue,
  ColNode,
  ComboNode,
  Document,
  ItemNode,
  KvNode,
  SectionNode,
  SlotNode,
  TabNode,
  TextNode,
  WindowNode,
} from './ast.js';

export function serialize(doc: Document): string {
  if (!doc.root) return '';
  const lines: string[] = [];
  serializeNode(doc.root, 0, lines);
  return lines.join('\n') + '\n';
}

function serializeNode(node: AnyNode, depth: number, out: string[]): void {
  const indent = '  '.repeat(depth);
  const parts: string[] = [node.kind];

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
    case 'item':
      parts.push(quoteString((node as ItemNode).text));
      break;
    case 'text':
      parts.push(quoteString((node as TextNode).content));
      break;
    case 'button':
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
    default:
      // No positional args for header/footer/panel/tabs/row/list/input/slider/image/icon/divider.
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
