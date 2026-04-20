import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { layout } from '../../src/renderer/layout.js';
import { emitSvg } from '../../src/renderer/svg.js';
import { DEFAULT_THEME, DARK_THEME } from '../../src/renderer/themes.js';

function layoutSource(source: string) {
  const doc = parse(source);
  if (!doc.root) throw new Error('source has no root window');
  return layout(doc, DEFAULT_THEME);
}

function svgOf(source: string, dark = false): string {
  const doc = parse(source);
  const theme = dark ? DARK_THEME : DEFAULT_THEME;
  return emitSvg(layout(doc, theme), theme);
}

describe('v0.4.5 layout', () => {
  it('tree expands height with each node row', () => {
    const a = layoutSource('window:\n  tree:\n    node "a"\n');
    const b = layoutSource('window:\n  tree:\n    node "a"\n    node "b"\n');
    expect(b.root.height).toBeGreaterThan(a.root.height);
  });

  it('collapsed tree node hides its children in the flattened row count', () => {
    const open = layoutSource(
      'window:\n  tree:\n    node "a":\n      node "b"\n      node "c"\n',
    );
    const closed = layoutSource(
      'window:\n  tree:\n    node "a" collapsed:\n      node "b"\n      node "c"\n',
    );
    expect(closed.root.height).toBeLessThan(open.root.height);
  });

  it('menubar renders one rect per top-level menu', () => {
    const svg = svgOf(
      'window:\n  menubar:\n    menu "File":\n      menuitem "Open"\n    menu "Edit":\n      menuitem "Cut"\n',
    );
    expect(svg).toContain('>File<');
    expect(svg).toContain('>Edit<');
  });

  it('breadcrumb emits chevrons between crumbs', () => {
    const svg = svgOf(
      'window:\n  breadcrumb:\n    crumb "A"\n    crumb "B"\n    crumb "C"\n',
    );
    // Two chevrons between three crumbs.
    const matches = svg.match(/›/g);
    expect(matches?.length).toBe(2);
  });

  it('checkbox renders a check path when checked', () => {
    const on = svgOf('window:\n  checkbox "X" checked\n');
    const off = svgOf('window:\n  checkbox "X"\n');
    expect(on).toContain('path');
    expect(off.length).toBeLessThan(on.length);
  });

  it('radio fills inner dot when selected', () => {
    const sel = svgOf('window:\n  radio "X" selected\n');
    // Two circles when selected (ring + dot), one when not.
    const count = (sel.match(/<circle/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('toggle on uses toggleOnColor fill', () => {
    const on = svgOf('window:\n  toggle "X" on\n');
    expect(on).toContain(DEFAULT_THEME.toggleOnColor);
  });

  it('chip closable renders an X', () => {
    const svg = svgOf('window:\n  chip "Filter" closable\n');
    // Two diagonal lines in the X glyph.
    expect((svg.match(/<line/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('avatar centers initials and scales with size attribute', () => {
    const small = layoutSource('window:\n  avatar "BW" size=small\n');
    const large = layoutSource('window:\n  avatar "BW" size=large\n');
    // Compare the avatar leaf directly — window padding obscures raw width.
    const findAvatar = (root: { children: { node: { kind: string }; width: number }[] }) =>
      root.children.find((c) => c.node.kind === 'avatar');
    const s = findAvatar(small.root as never);
    const l = findAvatar(large.root as never);
    expect(l?.width).toBeGreaterThan(s?.width ?? 0);
  });

  it('spinner with label renders dashed ring + text', () => {
    const svg = svgOf('window:\n  spinner "Loading…"\n');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('Loading…');
  });

  it('status kind=error uses error palette', () => {
    const svg = svgOf('window:\n  status "Failed" kind=error\n');
    expect(svg).toContain(DEFAULT_THEME.statusColors.error.bg);
  });

  it('status kind=success uses success palette', () => {
    const svg = svgOf('window:\n  status "Saved" kind=success\n');
    expect(svg).toContain(DEFAULT_THEME.statusColors.success.bg);
  });

  it('menu standalone renders a bordered dropdown box with items', () => {
    const svg = svgOf(
      'window:\n  menu "File":\n    menuitem "Open" shortcut="Ctrl+O"\n    separator\n    menuitem "Quit"\n',
    );
    expect(svg).toContain('Open');
    expect(svg).toContain('Ctrl+O');
    expect(svg).toContain('Quit');
  });

  it('dark theme renders all new primitives without throwing', () => {
    const svg = svgOf(
      [
        'window:',
        '  tree:',
        '    node "a"',
        '  checkbox "x" checked',
        '  radio "y" selected',
        '  toggle "z" on',
        '  chip "q" selected',
        '  avatar "AB"',
        '  breadcrumb:',
        '    crumb "a"',
        '    crumb "b"',
        '  spinner "loading"',
        '  status "ok" kind=success',
        '',
      ].join('\n'),
      true,
    );
    expect(svg.length).toBeGreaterThan(0);
  });
});
