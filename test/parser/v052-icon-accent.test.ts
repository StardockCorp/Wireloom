import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { serialize } from '../../src/parser/serializer.js';
import { WireloomError } from '../../src/parser/errors.js';
import type {
  ButtonNode,
  KvNode,
  StatNode,
  StatsNode,
  TextNode,
} from '../../src/parser/ast.js';

function expectParseError(source: string): WireloomError {
  try {
    parse(source);
  } catch (err) {
    if (err instanceof WireloomError) return err;
    throw new Error(`expected WireloomError, got ${(err as Error).message}`);
  }
  throw new Error('expected parse error, got success');
}

function attrPair(node: { attributes: readonly { kind: string; key?: string }[] }, key: string) {
  return node.attributes.find(
    (a): a is { kind: 'pair'; key: string; value: { kind: string; value: unknown } } & {
      kind: string;
      key?: string;
    } => a.kind === 'pair' && (a as { key: string }).key === key,
  );
}

describe('v0.5.2 — icon= on button / kv / stat', () => {
  it('parses button with icon= and a label (icon+text form)', () => {
    const doc = parse('window:\n  button "Search" icon="search"\n');
    const btn = doc.root?.children[0] as ButtonNode;
    expect(btn.kind).toBe('button');
    expect(btn.label).toBe('Search');
    const icon = attrPair(btn, 'icon');
    expect(icon?.value.kind).toBe('string');
    expect((icon?.value as { value: string }).value).toBe('search');
  });

  it('parses button with empty label as icon-only', () => {
    const doc = parse('window:\n  button "" icon="gear"\n');
    const btn = doc.root?.children[0] as ButtonNode;
    expect(btn.label).toBe('');
    expect(attrPair(btn, 'icon')).toBeDefined();
  });

  it('parses kv with leading icon', () => {
    const doc = parse('window:\n  kv "Approval" "+15%" icon="approval"\n');
    const kv = doc.root?.children[0] as KvNode;
    expect(kv.kind).toBe('kv');
    expect(kv.label).toBe('Approval');
    expect(attrPair(kv, 'icon')).toBeDefined();
  });

  it('parses stat with leading icon inside stats strip', () => {
    const doc = parse(
      ['window:', '  stats:', '    stat "GDP" "+12%" icon="industry"', ''].join('\n'),
    );
    const stats = doc.root?.children[0] as StatsNode;
    const stat = stats.children[0] as StatNode;
    expect(stat.kind).toBe('stat');
    expect(stat.label).toBe('GDP');
    expect(attrPair(stat, 'icon')).toBeDefined();
  });

  it('round-trips icon= through serialize → parse', () => {
    const src = ['window:', '  button "Find" icon="search"', ''].join('\n');
    const ast1 = parse(src);
    const src2 = serialize(ast1);
    const src3 = serialize(parse(src2));
    expect(src3).toBe(src2);
  });
});

describe('v0.5.2 — accent= on text / kv / stat', () => {
  it('parses text with accent=success', () => {
    const doc = parse('window:\n  text "Surplus" accent=success\n');
    const t = doc.root?.children[0] as TextNode;
    expect(t.kind).toBe('text');
    const accent = attrPair(t, 'accent');
    expect(accent?.value.kind).toBe('identifier');
    expect((accent?.value as { value: string }).value).toBe('success');
  });

  it('parses kv with accent=danger on the value side', () => {
    const doc = parse('window:\n  kv "Loyalty" "-10%" accent=danger\n');
    const kv = doc.root?.children[0] as KvNode;
    expect((attrPair(kv, 'accent')?.value as { value: string }).value).toBe('danger');
  });

  it('parses stat with accent=warning', () => {
    const doc = parse(
      ['window:', '  stats:', '    stat "Crime" "Rising" accent=warning', ''].join('\n'),
    );
    const stats = doc.root?.children[0] as StatsNode;
    const stat = stats.children[0] as StatNode;
    expect((attrPair(stat, 'accent')?.value as { value: string }).value).toBe('warning');
  });

  it('rejects accent=bogus on text with a clear error', () => {
    const err = expectParseError('window:\n  text "Hi" accent=bogus\n');
    expect(err.message.toLowerCase()).toContain('accent');
  });

  it('rejects accent= on a primitive that does not accept it', () => {
    // input does not accept accent=
    expectParseError('window:\n  input accent=success\n');
  });

  it('round-trips accent= through serialize → parse', () => {
    const src = ['window:', '  kv "Approval" "+15%" accent=success', ''].join('\n');
    const ast1 = parse(src);
    const src2 = serialize(ast1);
    const src3 = serialize(parse(src2));
    expect(src3).toBe(src2);
  });
});

describe('v0.5.2 — combined icon + accent', () => {
  it('parses kv with both icon and accent in one declaration', () => {
    const doc = parse(
      'window:\n  kv "Modifier" "+15%" icon="approval" accent=success\n',
    );
    const kv = doc.root?.children[0] as KvNode;
    expect(attrPair(kv, 'icon')).toBeDefined();
    expect(attrPair(kv, 'accent')).toBeDefined();
  });
});
