import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { serialize } from '../../src/parser/serializer.js';
import { WireloomError } from '../../src/parser/errors.js';
import type { SheetNode } from '../../src/parser/ast.js';

function expectParseError(source: string): WireloomError {
  try {
    parse(source);
  } catch (err) {
    if (err instanceof WireloomError) return err;
    throw new Error(`expected WireloomError, got ${(err as Error).message}`);
  }
  throw new Error('expected parse error, got success');
}

function roundtripEquals(src: string): void {
  const ast1 = parse(src);
  const src2 = serialize(ast1);
  const src3 = serialize(parse(src2));
  expect(src3).toBe(src2);
}

describe('v0.50 — sheet primitive', () => {
  it('parses a bottom sheet with a list of options', () => {
    const doc = parse(
      [
        'window:',
        '  text "Base content"',
        '  sheet:',
        '    list:',
        '      item "Share"',
        '      item "Copy link"',
        '      item "Delete"',
        '',
      ].join('\n'),
    );
    const children = doc.root?.children ?? [];
    const sheet = children.find((c) => c.kind === 'sheet') as SheetNode;
    expect(sheet).toBeDefined();
    expect(sheet.placement).toBe('bottom');
    expect(sheet.title).toBeUndefined();
    expect(sheet.children).toHaveLength(1);
  });

  it('parses a center sheet with a title attribute', () => {
    const doc = parse(
      [
        'window:',
        '  sheet position=center title="Confirm":',
        '    text "Delete this file?"',
        '    row align=right:',
        '      button "Cancel"',
        '      button "Delete" primary',
        '',
      ].join('\n'),
    );
    const sheet = doc.root?.children[0] as SheetNode;
    expect(sheet.kind).toBe('sheet');
    expect(sheet.placement).toBe('center');
    expect(sheet.title).toBe('Confirm');
  });

  it('defaults to bottom placement when position is omitted', () => {
    const doc = parse('window:\n  sheet:\n    text "hi"\n');
    const sheet = doc.root?.children[0] as SheetNode;
    expect(sheet.placement).toBe('bottom');
  });

  it('rejects a second sheet in the same window', () => {
    const err = expectParseError(
      [
        'window:',
        '  sheet:',
        '    text "first"',
        '  sheet position=center:',
        '    text "second"',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/only one "sheet".*per "window"/);
  });

  it('rejects sheet nested inside a panel', () => {
    const err = expectParseError(
      [
        'window:',
        '  panel:',
        '    sheet:',
        '      text "nope"',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/"sheet" may only appear directly inside "window"/);
  });

  it('rejects unknown position value and lists valid options', () => {
    const err = expectParseError(
      'window:\n  sheet position=top:\n    text "hi"\n',
    );
    expect(err.message).toMatch(/not a valid position/);
    expect(err.message).toMatch(/bottom, center/);
  });

  it('accepts the universal id attribute', () => {
    const doc = parse(
      'window:\n  sheet id="share-sheet":\n    text "hi"\n',
    );
    const sheet = doc.root?.children[0] as SheetNode;
    const idAttr = sheet.attributes.find(
      (a) => a.kind === 'pair' && a.key === 'id',
    );
    expect(idAttr).toBeDefined();
  });

  it('roundtrips a bottom sheet without title', () => {
    roundtripEquals(
      [
        'window:',
        '  text "Base"',
        '  sheet:',
        '    list:',
        '      item "A"',
        '      item "B"',
        '',
      ].join('\n'),
    );
  });

  it('roundtrips a center sheet with title and children', () => {
    roundtripEquals(
      [
        'window:',
        '  sheet position=center title="Confirm":',
        '    text "Delete this file?"',
        '    row align=right:',
        '      button "Cancel"',
        '      button "Delete" primary',
        '',
      ].join('\n'),
    );
  });
});
