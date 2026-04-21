import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { serialize } from '../../src/parser/serializer.js';
import { WireloomError } from '../../src/parser/errors.js';
import type { RowNode, SpacerNode } from '../../src/parser/ast.js';

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

describe('v0.50 — spacer primitive', () => {
  it('parses spacer as a leaf child of row', () => {
    const doc = parse(
      ['window:', '  row:', '    button "Cancel"', '    spacer', '    button "Done" primary', ''].join('\n'),
    );
    const row = doc.root?.children[0] as RowNode;
    expect(row.kind).toBe('row');
    expect(row.children.length).toBe(3);
    const spacer = row.children[1] as SpacerNode;
    expect(spacer.kind).toBe('spacer');
    expect(spacer.attributes.length).toBe(0);
  });

  it('accepts the universal id attribute on spacer', () => {
    const doc = parse('window:\n  row:\n    button "A"\n    spacer id="gap"\n    button "B"\n');
    const row = doc.root?.children[0] as RowNode;
    const spacer = row.children[1] as SpacerNode;
    expect(spacer.attributes.some((a) => a.kind === 'pair' && a.key === 'id')).toBe(true);
  });

  it('rejects spacer at the window level', () => {
    const err = expectParseError('window:\n  spacer\n');
    expect(err.message).toMatch(/spacer.*only appear inside.*row/);
  });

  it('rejects spacer inside a col', () => {
    const err = expectParseError('window:\n  col:\n    spacer\n');
    expect(err.message).toMatch(/spacer.*only appear inside.*row/);
  });

  it('rejects spacer inside a panel', () => {
    const err = expectParseError('window:\n  panel:\n    spacer\n');
    expect(err.message).toMatch(/spacer.*only appear inside.*row/);
  });

  it('rejects spacer with a positional string', () => {
    const err = expectParseError('window:\n  row:\n    spacer "nope"\n');
    // The positional string is unexpected — either the line fails to parse
    // cleanly as a newline-terminated leaf, or it throws on the string token.
    expect(err).toBeInstanceOf(WireloomError);
  });

  it('rejects spacer with children', () => {
    const err = expectParseError('window:\n  row:\n    spacer:\n      text "x"\n');
    expect(err.message).toMatch(/spacer.*cannot have children/);
  });

  it('rejects unknown flags on spacer', () => {
    const err = expectParseError('window:\n  row:\n    spacer glow\n');
    expect(err.message).toMatch(/unknown flag "glow" on "spacer"/);
  });

  it('roundtrips a row with spacer between buttons', () => {
    roundtripEquals(
      ['window:', '  row:', '    button "Cancel"', '    spacer', '    button "Done" primary', ''].join('\n'),
    );
  });

  it('suggests spacer in the empty-container error', () => {
    const err = expectParseError('window:\n  row:\n');
    expect(err.message).toContain('has no indented children');
    expect(err.message).toContain('spacer');
  });
});

describe('v0.50 — row justify attribute', () => {
  it('accepts justify=start, between, around, end', () => {
    for (const v of ['start', 'between', 'around', 'end']) {
      const doc = parse(`window:\n  row justify=${v}:\n    text "a"\n    text "b"\n`);
      const row = doc.root?.children[0] as RowNode;
      expect(row.attributes.some((a) => a.kind === 'pair' && a.key === 'justify')).toBe(true);
    }
  });

  it('rejects unknown justify values with a listing of valid options', () => {
    const err = expectParseError('window:\n  row justify=spaceout:\n    text "a"\n');
    expect(err.message).toMatch(/justify/);
    expect(err.message).toContain('start');
    expect(err.message).toContain('between');
    expect(err.message).toContain('around');
    expect(err.message).toContain('end');
  });

  it('suggests the closest justify value for a typo', () => {
    const err = expectParseError('window:\n  row justify=betwen:\n    text "a"\n');
    expect(err.message).toMatch(/Did you mean "between"/);
  });

  it('roundtrips a row with justify=between', () => {
    roundtripEquals('window:\n  row justify=between:\n    text "A"\n    text "B"\n');
  });
});
