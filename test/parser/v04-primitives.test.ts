import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { WireloomError } from '../../src/parser/errors.js';
import type {
  CellNode,
  GridNode,
  ResourceBarNode,
  ResourceNode,
  SlotNode,
  StatNode,
  StatsNode,
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

describe('v0.4 — grid and cell', () => {
  it('parses a grid with explicit cell positions and auto-flow', () => {
    const doc = parse(
      [
        'window:',
        '  grid cols=3 rows=2:',
        '    cell "A"',
        '    cell "B" row=1 col=3',
        '    cell "C"',
        '',
      ].join('\n'),
    );
    const grid = doc.root?.children[0] as GridNode;
    expect(grid.kind).toBe('grid');
    expect(grid.cols).toBe(3);
    expect(grid.rows).toBe(2);
    expect(grid.children.length).toBe(3);
    const c0 = grid.children[0] as CellNode;
    expect(c0.label).toBe('A');
  });

  it('requires cols= and rows= on grid', () => {
    const err = expectParseError('window:\n  grid cols=3:\n    cell "A"\n');
    expect(err.message).toMatch(/rows=/);
  });

  it('rejects cell outside of grid', () => {
    const err = expectParseError('window:\n  cell "stray"\n');
    expect(err.message).toMatch(/cell.*only appear inside.*grid/);
  });

  it('rejects non-cell children of grid', () => {
    const err = expectParseError(
      'window:\n  grid cols=1 rows=1:\n    text "nope"\n',
    );
    expect(err.message).toMatch(/grid.*only.*cell/);
  });

  it('accepts unified state values on cell', () => {
    const doc = parse(
      [
        'window:',
        '  grid cols=2 rows=1:',
        '    cell "A" state=purchased',
        '    cell "B" state=locked',
        '',
      ].join('\n'),
    );
    const grid = doc.root?.children[0] as GridNode;
    expect(grid.children.length).toBe(2);
  });

  it('rejects unknown state values with an enum error', () => {
    const err = expectParseError(
      'window:\n  grid cols=1 rows=1:\n    cell state=bananas\n',
    );
    expect(err.message).toMatch(/not a valid state/);
  });
});

describe('v0.4 — resourcebar', () => {
  it('parses resource children with name + value', () => {
    const doc = parse(
      [
        'window:',
        '  resourcebar:',
        '    resource name="Credits" value="1,500"',
        '    resource name="Research" value="240"',
        '',
      ].join('\n'),
    );
    const bar = doc.root?.children[0] as ResourceBarNode;
    expect(bar.kind).toBe('resourcebar');
    expect(bar.children.length).toBe(2);
    const r0 = bar.children[0] as ResourceNode;
    expect(r0.name).toBe('Credits');
    expect(r0.value).toBe('1,500');
  });

  it('rejects resource outside of resourcebar', () => {
    const err = expectParseError(
      'window:\n  resource name="Credits" value="1"\n',
    );
    expect(err.message).toMatch(/resource.*only appear inside.*resourcebar/);
  });

  it('requires name= on resource', () => {
    const err = expectParseError(
      'window:\n  resourcebar:\n    resource value="1"\n',
    );
    expect(err.message).toMatch(/resource.*name=/);
  });
});

describe('v0.4 — stats', () => {
  it('parses inline stat children', () => {
    const doc = parse(
      [
        'window:',
        '  stats:',
        '    stat "INT" "4"',
        '    stat "LOY" "75" bold',
        '',
      ].join('\n'),
    );
    const stats = doc.root?.children[0] as StatsNode;
    expect(stats.children.length).toBe(2);
    const s0 = stats.children[0] as StatNode;
    expect(s0.label).toBe('INT');
    expect(s0.value).toBe('4');
  });

  it('requires two strings on stat', () => {
    const err = expectParseError('window:\n  stats:\n    stat "INT"\n');
    expect(err.message).toMatch(/stat.*value/);
  });
});

describe('v0.4 — progress + chart', () => {
  it('accepts progress with value/max/label/accent', () => {
    const doc = parse(
      [
        'window:',
        '  progress value=50 max=100 label="Credits" accent=wealth',
        '',
      ].join('\n'),
    );
    const p = doc.root?.children[0];
    expect(p?.kind).toBe('progress');
  });

  it('accepts chart with kind and optional label', () => {
    const doc = parse(
      [
        'window:',
        '  chart kind=bar label="Maintenance"',
        '  chart kind=line',
        '  chart kind=pie',
        '',
      ].join('\n'),
    );
    expect(doc.root?.children.length).toBe(3);
  });

  it('rejects unknown chart kind', () => {
    const err = expectParseError('window:\n  chart kind=sparkle\n');
    expect(err.message).toMatch(/not a valid kind/);
  });
});

describe('v0.4 — slot footer', () => {
  it('parses a footer child inside slot as a trailing action block', () => {
    const doc = parse(
      [
        'window:',
        '  slot "Deal":',
        '    text "Body"',
        '    footer:',
        '      button "Cancel"',
        '      button "Accept" primary',
        '',
      ].join('\n'),
    );
    const slot = doc.root?.children[0] as SlotNode;
    expect(slot.slotFooter).toBeDefined();
    expect(slot.slotFooter?.children.length).toBe(2);
  });

  it('rejects footer as a non-last child of slot', () => {
    const err = expectParseError(
      [
        'window:',
        '  slot "Deal":',
        '    footer:',
        '      button "Cancel"',
        '    text "Body"',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/footer.*must be the last/);
  });

  it('rejects a second footer in the same slot', () => {
    const err = expectParseError(
      [
        'window:',
        '  slot "Deal":',
        '    footer:',
        '      button "A"',
        '    footer:',
        '      button "B"',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/at most one/);
  });

  it('still rejects footer as a non-slot, non-window child', () => {
    const err = expectParseError(
      [
        'window:',
        '  panel:',
        '    footer:',
        '      button "nope"',
        '',
      ].join('\n'),
    );
    expect(err.message).toMatch(/footer.*may only appear directly inside.*window.*slot/);
  });
});

describe('v0.4 — accent enum', () => {
  it('accepts accent on slot, section, cell, button, and icon', () => {
    const doc = parse(
      [
        'window:',
        '  section "Econ" accent=wealth:',
        '    slot "Deal" accent=industry:',
        '      text "ok"',
        '    row:',
        '      button "Go" accent=military',
        '      icon name="credits" accent=research',
        '  grid cols=1 rows=1:',
        '    cell "X" accent=danger',
        '',
      ].join('\n'),
    );
    expect(doc.root).toBeDefined();
  });

  it('rejects unknown accent value', () => {
    const err = expectParseError(
      'window:\n  slot "x" accent=neon:\n    text "y"\n',
    );
    expect(err.message).toMatch(/not a valid accent/);
  });
});
