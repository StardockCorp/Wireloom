import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { layout } from '../../src/renderer/layout.js';
import { emitSvg } from '../../src/renderer/svg.js';
import { DEFAULT_THEME, DARK_THEME } from '../../src/renderer/themes.js';

function svgOf(source: string, dark = false): string {
  const doc = parse(source);
  const theme = dark ? DARK_THEME : DEFAULT_THEME;
  return emitSvg(layout(doc, theme), theme);
}

describe('v0.5 chevron flag — renderer', () => {
  it('emits a trailing chevron path on flagged items but not on unflagged items', () => {
    const withChev = svgOf('window:\n  list:\n    item "Open" chevron\n');
    const plain = svgOf('window:\n  list:\n    item "Open"\n');
    // Item renderer never emits a <path> without chevron; the flagged version must.
    const chevPaths = (withChev.match(/<path[^>]*stroke-linecap="round"/g) ?? []).length;
    expect(chevPaths).toBeGreaterThan(0);
    expect(withChev.length).toBeGreaterThan(plain.length);
  });

  it('draws the chevron glyph with the theme muted color, not a unicode character', () => {
    const svg = svgOf('window:\n  list:\n    item "Open" chevron\n');
    // Must not use the ›  unicode fallback; must be a <path>.
    expect(svg).toContain('<path');
    expect(svg).toContain(`stroke="${DEFAULT_THEME.chevronGlyphColor}"`);
  });

  it('renders chevron only on flagged rows in a mixed list', () => {
    const svg = svgOf(
      [
        'window:',
        '  list:',
        '    item "Profile" chevron',
        '    item "About"',
        '    item "Privacy" chevron',
        '',
      ].join('\n'),
    );
    // Two chevrons for two flagged rows.
    const chevrons = svg.match(/stroke-linecap="round" stroke-linejoin="round" \/>/g) ?? [];
    expect(chevrons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders chevron on the slot title row when the flag is set', () => {
    const svg = svgOf(
      'window:\n  list:\n    slot "Billing" chevron:\n      text "Visa"\n',
    );
    expect(svg).toContain('<path');
    expect(svg).toContain(DEFAULT_THEME.chevronGlyphColor);
  });

  it('chevron on a slot with many children still anchors trailing on the title row', () => {
    const svg = svgOf(
      [
        'window:',
        '  list:',
        '    slot "Account" chevron:',
        '      text "line 1"',
        '      text "line 2"',
        '      text "line 3"',
        '      button "Action"',
        '',
      ].join('\n'),
    );
    // Extract the chevron path command. Its y ordinate must fall within the
    // title band (roughly the first slotTitleHeight + padding pixels of the slot).
    const match = svg.match(/<path d="M ([\d.]+) ([\d.]+) L/);
    expect(match).not.toBeNull();
    const chevY = Number(match?.[2]);
    // Title band ends near windowPad + sectionPad + slotPadding + slotTitleHeight.
    const titleBandBottom =
      DEFAULT_THEME.titleBarHeight +
      DEFAULT_THEME.windowPadding * 2 +
      DEFAULT_THEME.slotPadding +
      DEFAULT_THEME.slotTitleHeight +
      DEFAULT_THEME.chevronGlyphSize; // path starts slightly above cy
    expect(chevY).toBeLessThan(titleBandBottom + 10);
  });

  it('dark theme uses the dark chevronGlyphColor', () => {
    const svg = svgOf('window:\n  list:\n    item "Settings" chevron\n', true);
    expect(svg).toContain(`stroke="${DARK_THEME.chevronGlyphColor}"`);
  });
});
