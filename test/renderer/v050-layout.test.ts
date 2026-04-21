import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderWireframe } from '../../src/renderer/index.js';

const examplesDir = join(__dirname, '..', '..', 'examples');

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
