import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { serialize } from '../../src/parser/serializer.js';
import { WireloomError } from '../../src/parser/errors.js';
import type { SegmentedNode, SegmentNode } from '../../src/parser/ast.js';

function expectParseError(source: string): WireloomError {
  try {
    parse(source);
  } catch (err) {
    if (err instanceof WireloomError) return err;
    throw new Error(`expected WireloomError, got ${(err as Error).message}`);
  }
  throw new Error('expected parse error, got success');
}

describe('v0.5 — segmented / segment primitives', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('parses a three-segment control with a selected middle segment', () => {
    const doc = parse(
      [
        'window:',
        '  segmented:',
        '    segment "Day"',
        '    segment "Week" selected',
        '    segment "Month"',
        '',
      ].join('\n'),
    );
    const seg = doc.root?.children[0] as SegmentedNode;
    expect(seg.kind).toBe('segmented');
    expect(seg.children.length).toBe(3);
    expect(seg.children[1]?.label).toBe('Week');
    expect(seg.children[1]?.attributes.some((a) => a.kind === 'flag' && a.flag === 'selected')).toBe(
      true,
    );
  });

  it('parses segment with disabled flag', () => {
    const doc = parse(
      ['window:', '  segmented:', '    segment "On"', '    segment "Off" disabled', ''].join('\n'),
    );
    const seg = doc.root?.children[0] as SegmentedNode;
    const off = seg.children[1] as SegmentNode;
    expect(off.attributes.some((a) => a.kind === 'flag' && a.flag === 'disabled')).toBe(true);
  });

  it('rejects a segment carrying both selected flags on two siblings', () => {
    const err = expectParseError(
      [
        'window:',
        '  segmented:',
        '    segment "A" selected',
        '    segment "B" selected',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/at most one .*selected/);
  });

  it('rejects a non-segment child inside segmented', () => {
    const err = expectParseError(
      ['window:', '  segmented:', '    text "nope"', ''].join('\n'),
    );
    expect(err.message).toMatch(/segmented.*only.*segment/);
  });

  it('rejects segment outside of segmented', () => {
    const err = expectParseError('window:\n  segment "stray"\n');
    expect(err.message).toMatch(/segment.*only appear inside.*segmented/);
  });

  it('rejects unknown flag on segment', () => {
    const err = expectParseError(
      ['window:', '  segmented:', '    segment "A" bogus', ''].join('\n'),
    );
    expect(err.message).toMatch(/unknown flag "bogus" on "segment"/);
  });

  it('warns on a segmented with a single segment but still parses it', () => {
    const doc = parse(
      ['window:', '  segmented:', '    segment "Only"', ''].join('\n'),
    );
    expect(doc.root?.children.length).toBe(1);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toMatch(/segmented.*1 segment/);
  });

  it('warns on a segmented with zero segments (bare form, no children block)', () => {
    // `segmented:` without an indented body is a hard grammar error, so the
    // zero-segment case is expressed as the bare form `segmented` (no colon).
    const doc = parse(['window:', '  segmented', ''].join('\n'));
    expect((doc.root?.children[0] as SegmentedNode)?.children.length).toBe(0);
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0]?.[0]).toMatch(/segmented.*0 segments/);
  });

  it('round-trips a realistic segmented control', () => {
    const src =
      [
        'window:',
        '  segmented:',
        '    segment "Day"',
        '    segment "Week" selected',
        '    segment "Month" disabled',
        '',
      ].join('\n');
    const ast1 = parse(src);
    const src2 = serialize(ast1);
    const src3 = serialize(parse(src2));
    expect(src3).toBe(src2);
    expect(src2).toMatch(/segmented:/);
    expect(src2).toMatch(/segment "Week" selected/);
    expect(src2).toMatch(/segment "Month" disabled/);
  });
});
