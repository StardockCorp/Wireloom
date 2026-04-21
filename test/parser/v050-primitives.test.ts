import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { serialize } from '../../src/parser/serializer.js';
import { WireloomError } from '../../src/parser/errors.js';
import type { NavbarNode, RowNode, SpacerNode } from '../../src/parser/ast.js';

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

describe('v0.50 — navbar primitive', () => {
  it('parses navbar with leading and trailing slots', () => {
    const doc = parse(
      [
        'window:',
        '  navbar:',
        '    leading:',
        '      button "Back"',
        '    trailing:',
        '      button "Edit"',
        '      button "New" primary',
        '',
      ].join('\n'),
    );
    const nav = doc.root?.children[0] as NavbarNode;
    expect(nav.kind).toBe('navbar');
    expect(nav.leading?.kind).toBe('navbarLeading');
    expect(nav.leading?.children.length).toBe(1);
    expect(nav.trailing?.kind).toBe('navbarTrailing');
    expect(nav.trailing?.children.length).toBe(2);
  });

  it('parses navbar with only leading', () => {
    const doc = parse('window:\n  navbar:\n    leading:\n      button "Back"\n');
    const nav = doc.root?.children[0] as NavbarNode;
    expect(nav.leading).toBeDefined();
    expect(nav.trailing).toBeUndefined();
  });

  it('parses navbar with only trailing', () => {
    const doc = parse('window:\n  navbar:\n    trailing:\n      button "Done"\n');
    const nav = doc.root?.children[0] as NavbarNode;
    expect(nav.trailing).toBeDefined();
    expect(nav.leading).toBeUndefined();
  });

  it('accepts the universal id attribute on navbar', () => {
    const doc = parse('window:\n  navbar id="top-bar":\n    leading:\n      button "X"\n');
    const nav = doc.root?.children[0] as NavbarNode;
    expect(nav.attributes.some((a) => a.kind === 'pair' && a.key === 'id')).toBe(true);
  });

  it('rejects navbar inside a row', () => {
    const err = expectParseError('window:\n  row:\n    navbar:\n      leading:\n        text "x"\n');
    expect(err.message).toMatch(/navbar.*only appear directly inside.*window/);
  });

  it('rejects navbar inside a panel', () => {
    const err = expectParseError(
      'window:\n  panel:\n    navbar:\n      leading:\n        text "x"\n',
    );
    expect(err.message).toMatch(/navbar.*only appear directly inside.*window/);
  });

  it('rejects leading: at the window level', () => {
    const err = expectParseError('window:\n  leading:\n    button "X"\n');
    expect(err.message).toMatch(/leading.*only appear inside.*navbar/);
  });

  it('rejects trailing: at the window level', () => {
    const err = expectParseError('window:\n  trailing:\n    button "X"\n');
    expect(err.message).toMatch(/trailing.*only appear inside.*navbar/);
  });

  it('rejects non-leading/trailing children inside navbar', () => {
    const err = expectParseError('window:\n  navbar:\n    text "Hello"\n');
    expect(err.message).toMatch(/navbar.*accepts only "leading:" or "trailing:"/);
  });

  it('rejects duplicate leading: blocks', () => {
    const err = expectParseError(
      [
        'window:',
        '  navbar:',
        '    leading:',
        '      button "A"',
        '    leading:',
        '      button "B"',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/at most one "leading:"/);
  });

  it('rejects duplicate trailing: blocks', () => {
    const err = expectParseError(
      [
        'window:',
        '  navbar:',
        '    trailing:',
        '      button "A"',
        '    trailing:',
        '      button "B"',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/at most one "trailing:"/);
  });

  it('rejects navbar without a child block', () => {
    const err = expectParseError('window:\n  navbar\n');
    expect(err.message).toMatch(/navbar.*requires "leading:" and\/or "trailing:"/);
  });

  it('rejects a window containing both navbar and header (navbar first)', () => {
    const err = expectParseError(
      [
        'window:',
        '  navbar:',
        '    leading:',
        '      button "Back"',
        '  header:',
        '    text "Hi"',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/navbar and header cannot both appear/);
  });

  it('rejects a window containing both header and navbar (header first)', () => {
    const err = expectParseError(
      [
        'window:',
        '  header:',
        '    text "Hi"',
        '  navbar:',
        '    leading:',
        '      button "Back"',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/navbar and header cannot both appear/);
  });

  it('roundtrips a navbar with both slots', () => {
    roundtripEquals(
      [
        'window:',
        '  navbar:',
        '    leading:',
        '      button "Back"',
        '    trailing:',
        '      button "Edit"',
        '      button "Done" primary',
        '',
      ].join('\n'),
    );
  });

  it('roundtrips a navbar with only trailing', () => {
    roundtripEquals('window:\n  navbar:\n    trailing:\n      button "Done"\n');
  });
});
