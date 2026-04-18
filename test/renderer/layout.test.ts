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

  // -------------------------------------------------------------------------
  // v0.2 layout scenarios
  // -------------------------------------------------------------------------

  it('distributes row slack to a single fill col', () => {
    const root = layoutSource(
      'window:\n  row:\n    col 240:\n      text "L"\n    col:\n      text "M"\n    col 200:\n      text "R"',
    );
    const row = root.children.find((c) => c.node.kind === 'row');
    expect(row).toBeDefined();
    const [left, middle, right] = row!.children;
    expect(left?.width).toBe(240);
    expect(right?.width).toBe(200);
    expect(middle?.width).toBeGreaterThan(200);
    // Middle fills the remaining space: start after left+gap, end before right-gap
    const expectedMiddleWidth =
      row!.width - 240 - 200 - DEFAULT_THEME.rowGap * 2;
    expect(middle?.width).toBeCloseTo(expectedMiddleWidth, 1);
  });

  it('splits slack evenly between multiple fill cols', () => {
    const root = layoutSource(
      'window:\n  row:\n    col fill:\n      text "A"\n    col fill:\n      text "B"',
    );
    const row = root.children.find((c) => c.node.kind === 'row');
    const [a, b] = row!.children;
    expect(a?.width).toBeCloseTo(b?.width ?? -1, 1);
  });

  it('right-aligns row children when align=right', () => {
    const root = layoutSource(
      'window:\n  row align=right:\n    button "One"\n    button "Two"',
    );
    const row = root.children.find((c) => c.node.kind === 'row');
    expect(row).toBeDefined();
    const [_a, b] = row!.children;
    // Last button's right edge equals the row's right edge.
    expect(b!.x + b!.width).toBeCloseTo(row!.x + row!.width, 1);
  });

  it('lays out tabs horizontally in a tabs container', () => {
    const root = layoutSource(
      'window:\n  tabs:\n    tab "One" active\n    tab "Two"\n    tab "Three"',
    );
    const tabs = root.children.find((c) => c.node.kind === 'tabs');
    expect(tabs).toBeDefined();
    const [first, second, third] = tabs!.children;
    expect(first?.x).toBeLessThan(second!.x);
    expect(second!.x).toBeLessThan(third!.x);
    expect(first?.y).toBe(second!.y);
    expect(tabs!.height).toBe(DEFAULT_THEME.tabHeight);
  });

  it('gives sections a title band above their children', () => {
    const root = layoutSource(
      'window:\n  section "Economy":\n    kv "Tax" "30%"',
    );
    const section = root.children.find((c) => c.node.kind === 'section');
    expect(section).toBeDefined();
    const firstChild = section!.children[0]!;
    // First child starts below the section title band.
    expect(firstChild.y).toBeGreaterThan(section!.y + DEFAULT_THEME.sectionTitleHeight);
  });

  it('kv rows take the full width assigned by parent', () => {
    const root = layoutSource(
      'window:\n  panel:\n    kv "Label" "Value"',
    );
    const panel = root.children.find((c) => c.node.kind === 'panel');
    const kv = panel!.children[0]!;
    const expectedWidth = panel!.width - DEFAULT_THEME.panelPadding * 2;
    expect(kv.width).toBeCloseTo(expectedWidth, 1);
  });

  it('slots reserve height for title band plus padding', () => {
    const root = layoutSource(
      'window:\n  list:\n    slot "Title":\n      text "Body"',
    );
    const list = root.children.find((c) => c.node.kind === 'list');
    const slot = list!.children[0]!;
    expect(slot.height).toBeGreaterThan(
      DEFAULT_THEME.slotTitleHeight + DEFAULT_THEME.slotPadding * 2,
    );
  });

  it('items sit below each other in a list', () => {
    const root = layoutSource(
      'window:\n  list:\n    item "One"\n    item "Two"\n    item "Three"',
    );
    const list = root.children.find((c) => c.node.kind === 'list');
    const ys = list!.children.map((c) => c.y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1] ?? 0);
    }
  });

  it('sliders render at their theme default width when inside a panel', () => {
    const root = layoutSource(
      'window:\n  panel:\n    slider range=0-100 value=30',
    );
    const panel = root.children.find((c) => c.node.kind === 'panel');
    const slider = panel!.children[0]!;
    expect(slider.width).toBeGreaterThanOrEqual(DEFAULT_THEME.sliderDefaultWidth);
  });

  it('combos honor their minimum width', () => {
    const root = layoutSource(
      'window:\n  panel:\n    combo value="Dark"',
    );
    const panel = root.children.find((c) => c.node.kind === 'panel');
    const combo = panel!.children[0]!;
    expect(combo.width).toBeGreaterThanOrEqual(DEFAULT_THEME.comboMinWidth);
  });

  it('images honor explicit width/height attributes', () => {
    const root = layoutSource(
      'window:\n  image width=200 height=140',
    );
    const image = root.children.find((c) => c.node.kind === 'image');
    expect(image!.width).toBe(200);
    expect(image!.height).toBe(140);
  });
});
