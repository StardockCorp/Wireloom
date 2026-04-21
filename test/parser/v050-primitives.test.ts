import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { serialize } from '../../src/parser/serializer.js';
import { WireloomError } from '../../src/parser/errors.js';
import type {
  BackButtonNode,
  HeaderNode,
  TabBarNode,
  TabItemNode,
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

describe('v0.50 — tabbar / tabitem', () => {
  it('parses tabbar with tabitems', () => {
    const doc = parse(
      [
        'window:',
        '  tabbar:',
        '    tabitem "Home" icon="planet" selected',
        '    tabitem "Inbox" badge="3"',
        '    tabitem "Settings"',
        '',
      ].join('\n'),
    );
    const bar = doc.root?.children[0] as TabBarNode;
    expect(bar.kind).toBe('tabbar');
    expect(bar.children.length).toBe(3);
    const first = bar.children[0] as TabItemNode;
    expect(first.label).toBe('Home');
    expect(first.attributes.some((a) => a.kind === 'flag' && a.flag === 'selected')).toBe(true);
  });

  it('accepts icon and badge attrs on tabitem', () => {
    const doc = parse(
      ['window:', '  tabbar:', '    tabitem "Alerts" icon="warning" badge="12"', ''].join('\n'),
    );
    const bar = doc.root?.children[0] as TabBarNode;
    const item = bar.children[0] as TabItemNode;
    expect(item.attributes.some((a) => a.kind === 'pair' && a.key === 'icon')).toBe(true);
    expect(item.attributes.some((a) => a.kind === 'pair' && a.key === 'badge')).toBe(true);
  });

  it('rejects non-tabitem children inside tabbar', () => {
    const err = expectParseError(
      ['window:', '  tabbar:', '    button "Nope"', ''].join('\n'),
    );
    expect(err.message).toMatch(/tabbar.*only.*tabitem/i);
  });

  it('rejects tabbar + footer in the same window', () => {
    const err = expectParseError(
      [
        'window:',
        '  tabbar:',
        '    tabitem "Home"',
        '  footer:',
        '    button "Save"',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/tabbar.*footer.*mutually exclusive/i);
  });

  it('rejects tabbar as a deep container child (window-only)', () => {
    const err = expectParseError(
      ['window:', '  panel:', '    tabbar:', '      tabitem "X"', ''].join('\n'),
    );
    expect(err.message).toMatch(/tabbar.*only.*direct child.*window/i);
  });

  it('rejects tabitem outside of tabbar', () => {
    const err = expectParseError('window:\n  tabitem "Home"\n');
    expect(err.message).toMatch(/tabitem.*only appear inside.*tabbar/i);
  });

  it('rejects unknown flag on tabitem', () => {
    const err = expectParseError(
      ['window:', '  tabbar:', '    tabitem "Home" primary', ''].join('\n'),
    );
    expect(err.message).toMatch(/unknown flag "primary"/);
  });

  it('roundtrips tabbar through serializer', () => {
    roundtripEquals(
      [
        'window:',
        '  tabbar:',
        '    tabitem "Home" icon="planet" selected',
        '    tabitem "Inbox" badge="3"',
        '    tabitem "Settings" disabled',
        '',
      ].join('\n'),
    );
  });
});
