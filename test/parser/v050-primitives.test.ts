import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { serialize } from '../../src/parser/serializer.js';
import { WireloomError } from '../../src/parser/errors.js';
import type { BackButtonNode, HeaderNode } from '../../src/parser/ast.js';

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

describe('v0.50 — backbutton', () => {
  it('parses backbutton with a parent label', () => {
    const doc = parse(['window:', '  backbutton "Notes"', ''].join('\n'));
    const back = doc.root?.children[0] as BackButtonNode;
    expect(back.kind).toBe('backbutton');
    expect(back.label).toBe('Notes');
  });

  it('accepts the disabled flag', () => {
    const doc = parse(['window:', '  backbutton "Reports" disabled', ''].join('\n'));
    const back = doc.root?.children[0] as BackButtonNode;
    expect(back.attributes.some((a) => a.kind === 'flag' && a.flag === 'disabled')).toBe(true);
  });

  it('can nest inside row, panel, and header', () => {
    parse(['window:', '  row:', '    backbutton "Back"', ''].join('\n'));
    parse(['window:', '  panel:', '    backbutton "Back"', ''].join('\n'));
    parse(['window:', '  header:', '    backbutton "Back"', ''].join('\n'));
  });

  it('rejects unknown flags on backbutton', () => {
    const err = expectParseError('window:\n  backbutton "Back" primary\n');
    expect(err.message).toMatch(/unknown flag "primary"/);
  });

  it('requires a string label', () => {
    const err = expectParseError('window:\n  backbutton\n');
    expect(err.message).toMatch(/requires a parent label/);
  });

  it('roundtrips through serializer', () => {
    roundtripEquals(
      [
        'window:',
        '  row:',
        '    backbutton "Notes"',
        '    backbutton "Reports" disabled',
        '',
      ].join('\n'),
    );
  });
});

describe('v0.50 — header large flag', () => {
  it('parses header with large flag', () => {
    const doc = parse(['window:', '  header large:', '    text "Q2 Review"', ''].join('\n'));
    const header = doc.root?.children[0] as HeaderNode;
    expect(header.kind).toBe('header');
    expect(header.attributes.some((a) => a.kind === 'flag' && a.flag === 'large')).toBe(true);
  });

  it('accepts large header with empty text placeholder', () => {
    const doc = parse(['window:', '  header large:', '    text ""', ''].join('\n'));
    expect(doc.root?.children[0]?.kind).toBe('header');
  });

  it('rejects unknown flags on header', () => {
    const err = expectParseError('window:\n  header huge:\n    text "X"\n');
    expect(err.message).toMatch(/unknown flag "huge"/);
  });

  it('roundtrips large header through serializer', () => {
    roundtripEquals(['window:', '  header large:', '    text "Q2 Review"', ''].join('\n'));
  });
});
