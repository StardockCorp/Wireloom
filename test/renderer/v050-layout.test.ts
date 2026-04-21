import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { layout } from '../../src/renderer/layout.js';
import { DEFAULT_THEME } from '../../src/renderer/themes.js';

function layoutSource(source: string) {
  const doc = parse(source);
  if (!doc.root) throw new Error('source has no root window');
  return layout(doc, DEFAULT_THEME).root;
}

function findRow(root: ReturnType<typeof layoutSource>): {
  x: number;
  y: number;
  width: number;
  height: number;
  children: ReturnType<typeof layoutSource>['children'];
} {
  // Rows live under a col (the direct child of window when wrapped in a col).
  const stack = [...root.children];
  while (stack.length > 0) {
    const n = stack.shift()!;
    if (n.node.kind === 'row') return n;
    stack.push(...n.children);
  }
  throw new Error('no row found');
}

describe('v0.50 layout — spacer', () => {
  it('anchors siblings to opposite edges with a single spacer', () => {
    // Wrap the row in a wide fixed-width column so there is slack to consume.
    const root = layoutSource(
      'window:\n  col 600:\n    row:\n      button "Cancel"\n      spacer\n      button "Done" primary\n',
    );
    const row = findRow(root);
    const [cancel, , done] = row.children;
    // Cancel sits at the row's left edge.
    expect(cancel!.x).toBeCloseTo(row.x, 1);
    // Done's right edge aligns with the row's right edge.
    expect(done!.x + done!.width).toBeCloseTo(row.x + row.width, 1);
  });

  it('distributes slack equally between multiple spacers', () => {
    const root = layoutSource(
      'window:\n  col 600:\n    row:\n      button "A"\n      spacer\n      button "B"\n      spacer\n      button "C"\n',
    );
    const row = findRow(root);
    const [a, sp1, b, sp2, c] = row.children;
    expect(sp1!.width).toBeCloseTo(sp2!.width, 1);
    // Layout preserves source order: A first, C last.
    expect(a!.x).toBeLessThan(b!.x);
    expect(b!.x).toBeLessThan(c!.x);
    expect(c!.x + c!.width).toBeCloseTo(row.x + row.width, 1);
  });

  it('fill col beats spacer when both appear on the same row', () => {
    // Fill consumes all slack; the spacer ends up zero-width.
    const root = layoutSource(
      'window:\n  col 600:\n    row:\n      button "A"\n      spacer\n      col fill:\n        text "mid"\n      button "B"\n',
    );
    const row = findRow(root);
    const spacer = row.children.find((c) => c.node.kind === 'spacer');
    expect(spacer?.width).toBe(0);
  });

  it('spacer contributes zero height to the row', () => {
    // A row of only spacers collapses to zero height.
    const root = layoutSource(
      'window:\n  col 600:\n    row:\n      spacer\n      spacer\n',
    );
    const row = findRow(root);
    expect(row.height).toBe(0);
  });
});

describe('v0.50 layout — row justify', () => {
  it('justify=end pushes all children to the right edge', () => {
    const root = layoutSource(
      'window:\n  col 600:\n    row justify=end:\n      button "One"\n      button "Two"\n',
    );
    const row = findRow(root);
    const [, two] = row.children;
    expect(two!.x + two!.width).toBeCloseTo(row.x + row.width, 1);
  });

  it('justify=between puts first at start, last at end', () => {
    const root = layoutSource(
      'window:\n  col 600:\n    row justify=between:\n      button "A"\n      button "B"\n      button "C"\n',
    );
    const row = findRow(root);
    const [a, b, c] = row.children;
    expect(a!.x).toBeCloseTo(row.x, 1);
    expect(c!.x + c!.width).toBeCloseTo(row.x + row.width, 1);
    // B sits in the middle-ish — equal slack on each side is spec for between.
    const leftGap = b!.x - (a!.x + a!.width);
    const rightGap = c!.x - (b!.x + b!.width);
    expect(leftGap).toBeCloseTo(rightGap, 1);
    expect(leftGap).toBeGreaterThan(0);
  });

  it('justify=around gives equal padding on both sides of each child', () => {
    const root = layoutSource(
      'window:\n  col 600:\n    row justify=around:\n      text "A"\n      text "B"\n      text "C"\n',
    );
    const row = findRow(root);
    const [a, b, c] = row.children;
    // Leading pad before A equals trailing pad after C.
    const leadPad = a!.x - row.x;
    const trailPad = row.x + row.width - (c!.x + c!.width);
    expect(leadPad).toBeCloseTo(trailPad, 1);
    // Interior half-gaps on each side of B collectively equal the full between-gap.
    const leftGap = b!.x - (a!.x + a!.width);
    const rightGap = c!.x - (b!.x + b!.width);
    expect(leftGap).toBeCloseTo(rightGap, 1);
  });

  it('justify=start is the default and matches unspecified behavior', () => {
    const base = layoutSource(
      'window:\n  col 600:\n    row:\n      button "A"\n      button "B"\n',
    );
    const explicit = layoutSource(
      'window:\n  col 600:\n    row justify=start:\n      button "A"\n      button "B"\n',
    );
    const rBase = findRow(base);
    const rExp = findRow(explicit);
    expect(rExp.children[0]!.x).toBeCloseTo(rBase.children[0]!.x, 1);
    expect(rExp.children[1]!.x).toBeCloseTo(rBase.children[1]!.x, 1);
  });

  it('spacer wins when both spacer and justify are present', () => {
    // Spacer splits slack 50/50 between A and B. justify=around is ignored.
    const root = layoutSource(
      'window:\n  col 600:\n    row justify=around:\n      button "A"\n      spacer\n      button "B"\n',
    );
    const row = findRow(root);
    const [a, , b] = row.children;
    expect(a!.x).toBeCloseTo(row.x, 1);
    expect(b!.x + b!.width).toBeCloseTo(row.x + row.width, 1);
  });

  it('fill col wins when fill + justify both appear', () => {
    const root = layoutSource(
      'window:\n  col 600:\n    row justify=between:\n      col 100:\n        text "L"\n      col fill:\n        text "M"\n      col 100:\n        text "R"\n',
    );
    const row = findRow(root);
    const [left, fill, right] = row.children;
    // Left at start, right at end, fill eats the middle — between contributes nothing.
    expect(left!.x).toBeCloseTo(row.x, 1);
    expect(right!.x + right!.width).toBeCloseTo(row.x + row.width, 1);
    expect(fill!.width).toBeGreaterThan(0);
  });
});

describe('v0.50 layout — navbar', () => {
  function findNavbar(root: ReturnType<typeof layoutSource>) {
    const stack = [...root.children];
    while (stack.length > 0) {
      const n = stack.shift()!;
      if (n.node.kind === 'navbar') return n;
      stack.push(...n.children);
    }
    throw new Error('no navbar found');
  }

  it('anchors leading children to the left and trailing to the right', () => {
    const root = layoutSource(
      [
        'window:',
        '  navbar:',
        '    leading:',
        '      button "Back"',
        '    trailing:',
        '      button "Edit"',
        '      button "Done" primary',
        '  text "body"',
        '',
      ].join('\n'),
    );
    const nav = findNavbar(root);
    const [leadingSlot, trailingSlot] = nav.children;
    // Leading slot starts at the navbar's inner-left padding edge.
    expect(leadingSlot!.x).toBeGreaterThanOrEqual(nav.x);
    expect(leadingSlot!.x).toBeLessThan(nav.x + nav.width / 2);
    // Trailing slot's right edge sits at the navbar's inner-right padding edge.
    const trailingRight = trailingSlot!.x + trailingSlot!.width;
    expect(trailingRight).toBeLessThanOrEqual(nav.x + nav.width);
    expect(trailingRight).toBeGreaterThan(nav.x + nav.width / 2);
  });

  it('renders cleanly with only leading (no trailing slot present)', () => {
    const root = layoutSource(
      'window:\n  navbar:\n    leading:\n      button "Back"\n  text "body"\n',
    );
    const nav = findNavbar(root);
    expect(nav.children.length).toBe(1);
    expect(nav.children[0]!.node.kind).toBe('navbarLeading');
  });

  it('renders cleanly with only trailing (no leading slot present)', () => {
    const root = layoutSource(
      'window:\n  navbar:\n    trailing:\n      button "Done"\n  text "body"\n',
    );
    const nav = findNavbar(root);
    expect(nav.children.length).toBe(1);
    expect(nav.children[0]!.node.kind).toBe('navbarTrailing');
    // Trailing-only still right-anchors.
    const slot = nav.children[0]!;
    expect(slot.x + slot.width).toBeLessThanOrEqual(nav.x + nav.width);
  });

  it('navbar sits above the body — body content starts below it', () => {
    const root = layoutSource(
      'window:\n  navbar:\n    leading:\n      button "Back"\n  text "body"\n',
    );
    const nav = findNavbar(root);
    const body = root.children.find((c) => c.node.kind === 'text');
    expect(body).toBeDefined();
    expect(body!.y).toBeGreaterThanOrEqual(nav.y + nav.height);
  });
});
