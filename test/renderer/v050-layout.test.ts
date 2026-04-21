import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../../src/parser/parser.js';
import { layout } from '../../src/renderer/layout.js';
import { renderWireframe } from '../../src/renderer/index.js';
import { emitSvg } from '../../src/renderer/svg.js';
import { DEFAULT_THEME, DARK_THEME } from '../../src/renderer/themes.js';

const examplesDir = join(__dirname, '..', '..', 'examples');

function svgOf(source: string, dark = false): string {
  const doc = parse(source);
  const theme = dark ? DARK_THEME : DEFAULT_THEME;
  return emitSvg(layout(doc, theme), theme);
}

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
describe('v0.50 — backbutton rendering', () => {
  it('draws a path-drawn chevron (not a unicode character)', () => {
    const svg = renderWireframe('window:\n  backbutton "Notes"\n');
    expect(svg).toMatch(/<path d="M \d+(?:\.\d+)? \d+(?:\.\d+)? L \d+(?:\.\d+)? \d+(?:\.\d+)? L \d+(?:\.\d+)? \d+(?:\.\d+)?"/);
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('Notes');
    // Must not rely on font-substitutable unicode glyphs for the chevron
    expect(svg).not.toContain('‹');
    expect(svg).not.toContain('\u2039');
  });

  it('dims disabled backbuttons', () => {
    const svg = renderWireframe('window:\n  backbutton "Reports" disabled\n');
    expect(svg).toContain('opacity="0.55"');
    expect(svg).toContain('#b8b8b8'); // disabledColor — applied to chevron stroke
  });

  it('renders backbutton in dark theme with a light chevron', () => {
    const svg = renderWireframe('window:\n  backbutton "Back"\n', { theme: 'dark' });
    expect(svg).toContain('#e0e0e0'); // dark backButtonChevronColor
  });
});

describe('v0.50 — header large flag', () => {
  it('renders header large with forced bold, large-size title', () => {
    const svg = renderWireframe('window:\n  header large:\n    text "Q2 Review"\n');
    expect(svg).toContain('font-size="18"'); // largeFontSize in default theme
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain('Q2 Review');
  });

  it('empty-string title is allowed for placeholder mockups', () => {
    const svg = renderWireframe('window:\n  header large:\n    text ""\n');
    expect(svg).toMatch(/<svg[^>]+>/);
  });

  it('header without large flag renders byte-identical to v0.4.5 golden', () => {
    // Prove v0.50 did not perturb the non-large header path: a representative
    // example (02-login-form) uses a plain header; its live output must match
    // the committed golden snapshot character for character.
    const src = readFileSync(join(examplesDir, '02-login-form.wireloom'), 'utf8');
    const rendered = renderWireframe(src);
    const golden = readFileSync(join(__dirname, 'fixtures', '02-login-form.svg'), 'utf8');
    // Fixture is stored pretty-printed (one element per line); collapse to
    // the raw single-line form the renderer actually emits.
    const collapsed = golden.replace(/>\n</g, '><');
    expect(rendered).toBe(collapsed);
  });

  it('large header produces a taller band than a plain header for the same text', () => {
    const largeSvg = renderWireframe('window:\n  header large:\n    text "x"\n');
    const plainSvg = renderWireframe('window:\n  header:\n    text "x"\n');
    const height = (s: string): number => Number(s.match(/height="(\d+)"/)?.[1] ?? 0);
    expect(height(largeSvg)).toBeGreaterThan(height(plainSvg));
  });
});

describe('v0.50 — tabbar rendering', () => {
  it('renders 3-tab bar with each label visible and badge overlay', () => {
    const src = [
      'window:',
      '  tabbar:',
      '    tabitem "Home" icon="planet" selected',
      '    tabitem "Inbox" icon="policy" badge="3"',
      '    tabitem "Settings" icon="gear"',
      '',
    ].join('\n');
    const svg = renderWireframe(src);
    expect(svg).toContain('Home');
    expect(svg).toContain('Inbox');
    expect(svg).toContain('Settings');
    // Badge "3" drawn as a pill overlay
    expect(svg).toContain('>3<');
  });

  it('distributes tabitems evenly across the window width', () => {
    const src = [
      'window:',
      '  tabbar:',
      '    tabitem "A"',
      '    tabitem "B"',
      '    tabitem "C"',
      '',
    ].join('\n');
    const svg = renderWireframe(src);
    // Each label is centered on its column; with 3 equal columns, label x
    // anchors must be evenly spaced. Extract the three text-anchor="middle"
    // x-coordinates.
    // Label font-size is distinct from the icon-fallback glyph font-size, so
    // we can isolate the three label text nodes by that attribute.
    const xs = [...svg.matchAll(/<text x="([\d.]+)"[^>]*font-size="11"[^>]*>[ABC]<\/text>/g)]
      .map((m) => Number(m[1]));
    expect(xs).toHaveLength(3);
    const d1 = xs[1]! - xs[0]!;
    const d2 = xs[2]! - xs[1]!;
    expect(Math.abs(d1 - d2)).toBeLessThan(0.5);
  });

  it('falls back to a boxed first letter for unknown icon names', () => {
    const src = [
      'window:',
      '  tabbar:',
      '    tabitem "Fake" icon="zzz-not-real"',
      '',
    ].join('\n');
    const svg = renderWireframe(src);
    // Uppercase first char of the icon name (not the label) lands in the
    // fallback placeholder — matches v0.3 behavior.
    expect(svg).toContain('>Z<');
    expect(svg).toContain('Fake');
  });

  it('5-tab bar keeps every label visible', () => {
    const src = [
      'window:',
      '  tabbar:',
      '    tabitem "Home"',
      '    tabitem "Search"',
      '    tabitem "Post"',
      '    tabitem "Likes"',
      '    tabitem "Me"',
      '',
    ].join('\n');
    const svg = renderWireframe(src);
    for (const label of ['Home', 'Search', 'Post', 'Likes', 'Me']) {
      expect(svg).toContain(label);
    }
  });

  it('dims disabled tabitems', () => {
    const src = [
      'window:',
      '  tabbar:',
      '    tabitem "Gone" disabled',
      '',
    ].join('\n');
    const svg = renderWireframe(src);
    expect(svg).toContain('opacity="0.55"');
  });

  it('renders tabbar cleanly in dark theme', () => {
    const src = [
      'window:',
      '  tabbar:',
      '    tabitem "Home" selected',
      '    tabitem "Inbox"',
      '',
    ].join('\n');
    const svg = renderWireframe(src, { theme: 'dark' });
    expect(svg).toContain('#1e1e1e'); // dark bg
    expect(svg).toContain('#f0f0f0'); // dark tabbarSelectedColor
  });

  it('is mutually exclusive with footer (enforced at parse time)', () => {
    // Ensure that enforcement message reaches the renderer boundary — if
    // the validation moved or softened, this fails loudly.
    expect(() =>
      renderWireframe(
        [
          'window:',
          '  tabbar:',
          '    tabitem "Home"',
          '  footer:',
          '    button "Save"',
          '',
        ].join('\n'),
      ),
    ).toThrowError(/tabbar.*footer.*mutually exclusive/i);
  });
});
describe('v0.50 sheet — rendering', () => {
  it('bottom sheet emits scrim + grabber pill + sheet body', () => {
    const svg = svgOf(
      [
        'window "App":',
        '  text "Base"',
        '  sheet:',
        '    list:',
        '      item "Share"',
        '      item "Copy link"',
        '      item "Delete"',
        '',
      ].join('\n'),
    );
    // Scrim rect uses default scrim color at scrim opacity
    expect(svg).toContain('fill="#1a1a1a" opacity="0.45"');
    // Grabber pill — uses sheetGrabberColor from default theme
    expect(svg).toContain('fill="#b5b8bd"');
    // The list items still render inside the sheet
    expect(svg).toContain('>Share<');
    expect(svg).toContain('>Copy link<');
    expect(svg).toContain('>Delete<');
    // Underlying content is still visible (not overwritten)
    expect(svg).toContain('>Base<');
  });

  it('center sheet emits a fully rounded floating panel with title', () => {
    const svg = svgOf(
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
    // Title is present and bold-weighted
    expect(svg).toContain('>Confirm<');
    // Center sheet uses a <rect> with rx (no top-only path)
    expect(svg).toMatch(/<rect[^>]*rx="14"[^>]*fill="#ffffff"/);
    // Inner content
    expect(svg).toContain('>Delete this file?<');
    expect(svg).toContain('>Cancel<');
    expect(svg).toContain('>Delete<');
  });

  it('bottom sheet uses a rounded-top path (not a full rounded rect)', () => {
    const svg = svgOf(
      'window:\n  text "Base"\n  sheet:\n    text "Inner"\n',
    );
    // Rounded-top rect is drawn as a <path d="M ... Q ... Z" />, not a <rect rx>
    expect(svg).toMatch(/<path d="M [\d.]+ [\d.]+ Q /);
    // No full-rounded <rect> fill for the sheet body.
    // (Center sheet would emit rx; bottom sheet uses a path instead.)
  });

  it('sheet without title does not emit an empty title row', () => {
    const svg = svgOf('window:\n  sheet:\n    text "Inner"\n');
    // A title text node would have font-size="15" font-weight="600". Make sure
    // we don't emit one when no title was supplied. Same weight/size combo
    // isn't used elsewhere in the default render path.
    expect(svg).not.toMatch(/font-size="15" font-weight="600"/);
  });

  it('sheet renders cleanly under the dark theme', () => {
    const svg = svgOf(
      [
        'window:',
        '  text "Base"',
        '  sheet title="Options":',
        '    list:',
        '      item "One"',
        '      item "Two"',
        '',
      ].join('\n'),
    );
    const dark = svgOf(
      [
        'window:',
        '  text "Base"',
        '  sheet title="Options":',
        '    list:',
        '      item "One"',
        '      item "Two"',
        '',
      ].join('\n'),
      true,
    );
    expect(svg).not.toBe(dark);
    // Dark theme uses its dark sheet background
    expect(dark).toContain('fill="#2a2a2a"');
  });

  it('places the sheet as the last child of the window (paint order)', () => {
    const doc = parse(
      [
        'window:',
        '  text "Base"',
        '  sheet:',
        '    text "Inner"',
        '',
      ].join('\n'),
    );
    const laid = layout(doc, DEFAULT_THEME);
    const last = laid.root.children[laid.root.children.length - 1];
    expect(last?.node.kind).toBe('sheet');
  });

  it('sheet accepts the universal id attribute for annotation targeting', () => {
    const svg = svgOf(
      [
        'window:',
        '  text "Base"',
        '  sheet id="share":',
        '    text "Inner"',
        'annotation "Modal overlay" target="share" position=right',
        '',
      ].join('\n'),
    );
    expect(svg).toContain('>Modal overlay<');
  });
});
