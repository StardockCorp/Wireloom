import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { layout } from '../../src/renderer/layout.js';
import { DEFAULT_THEME } from '../../src/renderer/themes.js';

function layoutSource(source: string) {
  const doc = parse(source);
  if (!doc.root) throw new Error('source has no root window');
  return layout(doc.root, DEFAULT_THEME);
}

describe('layout engine', () => {
  it('sizes a minimal window to wrap its content', () => {
    const root = layoutSource('window:\n  text "hello"');
    expect(root.width).toBeGreaterThan(0);
    expect(root.height).toBeGreaterThan(0);
    expect(root.x).toBe(0);
    expect(root.y).toBe(0);
  });

  it('gives windows with titles a title bar of titleBarHeight', () => {
    const titled = layoutSource('window "Title":\n  text "x"');
    const untitled = layoutSource('window:\n  text "x"');
    expect(titled.height).toBeGreaterThan(untitled.height);
    expect(titled.height - untitled.height).toBe(DEFAULT_THEME.titleBarHeight);
  });

  it('increases height when a header is present', () => {
    const withHeader = layoutSource(
      'window:\n  header:\n    text "Hi"\n  panel:\n    text "body"',
    );
    const withoutHeader = layoutSource('window:\n  panel:\n    text "body"');
    expect(withHeader.height).toBeGreaterThan(withoutHeader.height);
  });

  it('lays out panel children sequentially in Y', () => {
    const root = layoutSource(
      'window:\n  panel:\n    text "a"\n    text "b"\n    text "c"',
    );
    const panel = root.children.find((c) => c.node.kind === 'panel');
    expect(panel).toBeDefined();
    const ys = panel!.children.map((c) => c.y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1] ?? 0);
    }
  });

  it('honors explicit column widths', () => {
    const root = layoutSource(
      'window:\n  row:\n    col 240:\n      text "L"\n    col 180:\n      text "R"',
    );
    const row = root.children.find((c) => c.node.kind === 'row');
    expect(row).toBeDefined();
    const [left, right] = row!.children;
    expect(left?.width).toBe(240);
    expect(right?.width).toBe(180);
    // Right column starts after left + gap.
    expect(right?.x).toBeGreaterThan(left!.x + left!.width);
  });

  it('positions right-aligned buttons in a footer', () => {
    const root = layoutSource(
      'window:\n  panel:\n    text "body"\n  footer:\n    button "Cancel"\n    button "OK" primary',
    );
    const footer = root.children.find((c) => c.node.kind === 'footer');
    expect(footer).toBeDefined();
    const [a, b] = footer!.children;
    // Both buttons right-aligned: b's right edge should equal footer inner right edge.
    const footerRightInner = footer!.x + footer!.width - DEFAULT_THEME.windowPadding;
    expect(b!.x + b!.width).toBeCloseTo(footerRightInner, 1);
    // Cancel comes before OK.
    expect(a!.x).toBeLessThan(b!.x);
  });

  it('produces non-overlapping vertical children in a col', () => {
    const root = layoutSource(
      'window:\n  col:\n    text "1"\n    text "2"\n    text "3"',
    );
    const col = root.children.find((c) => c.node.kind === 'col');
    expect(col).toBeDefined();
    const children = col!.children;
    for (let i = 1; i < children.length; i++) {
      const prev = children[i - 1]!;
      const cur = children[i]!;
      expect(cur.y).toBeGreaterThanOrEqual(prev.y + prev.height);
    }
  });
});
