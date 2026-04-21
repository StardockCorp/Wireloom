import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { serialize } from '../../src/parser/serializer.js';
import { WireloomError } from '../../src/parser/errors.js';
import type { ItemNode, ListNode, SlotNode } from '../../src/parser/ast.js';

function expectParseError(source: string): WireloomError {
  try {
    parse(source);
  } catch (err) {
    if (err instanceof WireloomError) return err;
    throw new Error(`expected WireloomError, got ${(err as Error).message}`);
  }
  throw new Error('expected parse error, got success');
}

describe('v0.5 — chevron flag on slot and item', () => {
  it('parses the chevron flag on item', () => {
    const doc = parse(
      ['window:', '  list:', '    item "Profile" chevron', ''].join('\n'),
    );
    const list = doc.root?.children[0] as ListNode;
    const item = list.children[0] as ItemNode;
    expect(item.kind).toBe('item');
    expect(item.attributes.some((a) => a.kind === 'flag' && a.flag === 'chevron')).toBe(true);
  });

  it('parses the chevron flag on slot', () => {
    const doc = parse(
      ['window:', '  list:', '    slot "Colonial Defense Pact" chevron:', '      text "body"', ''].join('\n'),
    );
    const list = doc.root?.children[0] as ListNode;
    const slot = list.children[0] as SlotNode;
    expect(slot.kind).toBe('slot');
    expect(slot.attributes.some((a) => a.kind === 'flag' && a.flag === 'chevron')).toBe(true);
  });

  it('allows chevron to coexist with active on slot', () => {
    const doc = parse(
      ['window:', '  list:', '    slot "Active item" active chevron:', '      text "body"', ''].join('\n'),
    );
    const slot = (doc.root?.children[0] as ListNode).children[0] as SlotNode;
    const flags = slot.attributes.filter((a) => a.kind === 'flag').map((a) => a.kind === 'flag' ? a.flag : '');
    expect(flags).toContain('active');
    expect(flags).toContain('chevron');
  });

  it('rejects chevron as a flag on unrelated primitives', () => {
    const err = expectParseError('window:\n  text "hi" chevron\n');
    expect(err.message).toMatch(/unknown flag "chevron" on "text"/);
  });

  it('round-trips chevron-flagged item and slot', () => {
    const src =
      [
        'window:',
        '  list:',
        '    item "Profile" chevron',
        '    slot "Billing" chevron:',
        '      text "Visa •••• 4242"',
        '',
      ].join('\n');
    const ast1 = parse(src);
    const src2 = serialize(ast1);
    const src3 = serialize(parse(src2));
    expect(src3).toBe(src2);
    expect(src2).toMatch(/item "Profile" chevron/);
    expect(src2).toMatch(/slot "Billing" chevron:/);
  });
});
