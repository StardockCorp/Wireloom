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
