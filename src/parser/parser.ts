/**
 * Wireloom parser — recursive-descent, token-driven.
 *
 * Consumes a tokenized source stream and produces a {@link Document}
 * conforming to ast.ts. Errors are always {@link WireloomError} with
 * line/column information.
 */

import type {
  Attribute,
  AttributePair,
  AttributeValue,
  ButtonNode,
  ColNode,
  ContainerChild,
  DividerNode,
  Document,
  FooterNode,
  HeaderNode,
  InputNode,
  PanelNode,
  RowNode,
  SourcePosition,
  TextNode,
  WindowChild,
  WindowNode,
} from './ast.js';
import { WireloomError } from './errors.js';
import { tokenize, type Token, type TokenKind } from './lexer.js';

/** Attribute rule table — which attributes and flags each primitive accepts. */
type AttrValueKind = 'string' | 'number' | 'ident';
interface AttrRules {
  attrs: Record<string, AttrValueKind>;
  flags: string[];
}

const ATTR_RULES: Record<string, AttrRules> = {
  window: { attrs: {}, flags: [] },
  header: { attrs: {}, flags: [] },
  footer: { attrs: {}, flags: [] },
  panel: { attrs: {}, flags: [] },
  row: { attrs: {}, flags: [] },
  col: { attrs: {}, flags: [] },
  text: { attrs: {}, flags: [] },
  button: { attrs: {}, flags: ['primary', 'disabled'] },
  input: { attrs: { placeholder: 'string', type: 'ident' }, flags: ['disabled'] },
  divider: { attrs: {}, flags: [] },
};

const VALID_PRIMITIVES = new Set(Object.keys(ATTR_RULES));

const CONTAINER_CHILD_PRIMITIVES = new Set([
  'panel',
  'row',
  'col',
  'text',
  'button',
  'input',
  'divider',
]);

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

    if (this.peek().kind !== 'eof') {
      const extra = this.peek();
      throw new WireloomError(
        'only one root "window" node is allowed',
        extra.line,
        extra.column,
      );
    }

    return { kind: 'document', root, sourceLines };
  }

  // -- Window ----------------------------------------------------------------

  private parseWindow(): WindowNode {
    const head = this.consume(); // 'window' ident
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
      const child = this.parseWindowChild();
      children.push(child);
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
    if (name === 'header') return this.parseHeader();
    if (name === 'footer') return this.parseFooter();
    return this.parseContainerChildNamed(name);
  }

  // -- Header / Footer -------------------------------------------------------

  private parseHeader(): HeaderNode {
    const head = this.consume(); // 'header'
    const position = positionOf(head);
    const attributes = this.parseAttributes('header');
    const hasChildren = this.parseTerminator('header', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: 'header', attributes, children, position };
  }

  private parseFooter(): FooterNode {
    const head = this.consume(); // 'footer'
    const position = positionOf(head);
    const attributes = this.parseAttributes('footer');
    const hasChildren = this.parseTerminator('footer', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: 'footer', attributes, children, position };
  }

  // -- Container children (panel/row/col + leaves) ---------------------------

  private parseContainerChildren(): ContainerChild[] {
    const children: ContainerChild[] = [];
    while (this.peek().kind !== 'dedent' && this.peek().kind !== 'eof') {
      const child = this.parseContainerChild();
      children.push(child);
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
      throw new WireloomError(
        `"${name}" is not allowed here (legal inside a container: panel, row, col, text, button, input, divider)`,
        head.line,
        head.column,
      );
    }
    return this.parseContainerChildNamed(name);
  }

  private parseContainerChildNamed(name: string): ContainerChild {
    switch (name) {
      case 'panel':
        return this.parsePanel();
      case 'row':
        return this.parseRow();
      case 'col':
        return this.parseCol();
      case 'text':
        return this.parseText();
      case 'button':
        return this.parseButton();
      case 'input':
        return this.parseInput();
      case 'divider':
        return this.parseDivider();
      default: {
        const head = this.peek();
        throw new WireloomError(unknownPrimitiveMessage(name), head.line, head.column);
      }
    }
  }

  private parsePanel(): PanelNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('panel');
    const hasChildren = this.parseTerminator('panel', head);
    const children = hasChildren ? this.parseContainerChildren() : [];
    return { kind: 'panel', attributes, children, position };
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
    const node: ColNode = {
      kind: 'col',
      attributes: [],
      children: [],
      position,
    };
    if (this.peek().kind === 'number') {
      const tok = this.consume();
      node.width = {
        value: tok.numericValue ?? 0,
        unit: tok.unit ?? 'px',
      };
    }
    node.attributes = this.parseAttributes('col');
    const hasChildren = this.parseTerminator('col', head);
    node.children = hasChildren ? this.parseContainerChildren() : [];
    return node;
  }

  // -- Leaves ----------------------------------------------------------------

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

  private parseDivider(): DividerNode {
    const head = this.consume();
    const position = positionOf(head);
    const attributes = this.parseAttributes('divider');
    this.parseLeafTerminator('divider', head);
    return { kind: 'divider', attributes, position };
  }

  // -- Attributes and terminators -------------------------------------------

  private parseAttributes(primitive: string): Attribute[] {
    const rules = ATTR_RULES[primitive] ?? { attrs: {}, flags: [] };
    const attrs: Attribute[] = [];

    while (this.peek().kind === 'ident') {
      const keyTok = this.consume();
      const key = keyTok.identValue ?? keyTok.raw;
      const position = positionOf(keyTok);

      if (this.match('equals')) {
        const valueTok = this.consume();
        const expectedKind = rules.attrs[key];
        if (expectedKind === undefined) {
          throw new WireloomError(
            `unknown attribute "${key}" on "${primitive}"`,
            keyTok.line,
            keyTok.column,
          );
        }
        const value = coerceAttributeValue(valueTok, expectedKind, key, primitive);
        const pair: AttributePair = { kind: 'pair', key, value, position };
        attrs.push(pair);
      } else {
        if (!rules.flags.includes(key)) {
          throw new WireloomError(
            `unknown flag "${key}" on "${primitive}"`,
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

  // -- Token helpers ---------------------------------------------------------

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

function positionOf(token: Token): SourcePosition {
  return { line: token.line, column: token.column };
}

function describeToken(token: Token): string {
  switch (token.kind) {
    case 'ident':
      return `identifier "${token.identValue ?? token.raw}"`;
    case 'string':
      return `string ${JSON.stringify(token.stringValue ?? '')}`;
    case 'number':
      return `number ${token.numericValue}`;
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
  expected: AttrValueKind,
  key: string,
  primitive: string,
): AttributeValue {
  const position = positionOf(token);
  if (expected === 'string') {
    if (token.kind !== 'string') {
      throw new WireloomError(
        `attribute "${key}" on "${primitive}" expects a string value, got ${describeToken(token)}`,
        token.line,
        token.column,
      );
    }
    return { kind: 'string', value: token.stringValue ?? '', position };
  }
  if (expected === 'number') {
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
  }
  // expected === 'ident'
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
}

function unknownPrimitiveMessage(name: string): string {
  return `unknown primitive "${name}" (valid: window, header, footer, panel, row, col, text, button, input, divider)`;
}
