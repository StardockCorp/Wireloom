import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { layout } from '../../src/renderer/layout.js';
import { emitSvg } from '../../src/renderer/svg.js';
import { DEFAULT_THEME, DARK_THEME } from '../../src/renderer/themes.js';

function svgOf(source: string, dark = false): string {
  const doc = parse(source);
  const theme = dark ? DARK_THEME : DEFAULT_THEME;
  return emitSvg(layout(doc, theme), theme);
}

describe('v0.5 segmented — renderer', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('draws equal-width segments with middle selected inverted', () => {
    const svg = svgOf(
      [
        'window:',
        '  segmented:',
        '    segment "Day"',
        '    segment "Week" selected',
        '    segment "Month"',
        '',
      ].join('\n'),
    );
    // Outer pill uses segmentedBg.
    expect(svg).toContain(`fill="${DEFAULT_THEME.segmentedBg}"`);
    // Selected middle uses segmentedSelectedBg.
    expect(svg).toContain(`fill="${DEFAULT_THEME.segmentedSelectedBg}"`);
    expect(svg).toContain('>Day<');
    expect(svg).toContain('>Week<');
    expect(svg).toContain('>Month<');
  });

  it('renders a two-segment control with dimmed disabled segment', () => {
    const svg = svgOf(
      [
        'window:',
        '  segmented:',
        '    segment "On"',
        '    segment "Off" disabled',
        '',
      ].join('\n'),
    );
    // Disabled opacity dim applied to at least one label.
    expect(svg).toMatch(/opacity="0\.45"[^>]*>Off</);
  });

  it('produces segments of equal width regardless of label length', () => {
    const doc = parse(
      [
        'window:',
        '  segmented:',
        '    segment "Hi"',
        '    segment "Longer Label"',
        '    segment "Mid"',
        '',
      ].join('\n'),
    );
    const laid = layout(doc, DEFAULT_THEME);
    const segmented = laid.root.children[0];
    expect(segmented?.children.length).toBe(3);
    const widths = segmented!.children.map((c) => c.width);
    // All segments are identical width.
    expect(new Set(widths.map((w) => w.toFixed(3))).size).toBe(1);
  });

  it('omits dividers adjacent to a selected segment', () => {
    const svgSelected = svgOf(
      [
        'window:',
        '  segmented:',
        '    segment "A"',
        '    segment "B" selected',
        '    segment "C"',
        '',
      ].join('\n'),
    );
    const svgPlain = svgOf(
      [
        'window:',
        '  segmented:',
        '    segment "A"',
        '    segment "B"',
        '    segment "C"',
        '',
      ].join('\n'),
    );
    const dividersSelected = (svgSelected.match(/stroke="[^"]*" stroke-width="1" \/>/g) ?? []).length;
    const dividersPlain = (svgPlain.match(/stroke="[^"]*" stroke-width="1" \/>/g) ?? []).length;
    expect(dividersSelected).toBeLessThan(dividersPlain);
  });

  it('is visually distinct from tabs: rounded pill vs underlined bar', () => {
    const segmented = svgOf(
      [
        'window:',
        '  segmented:',
        '    segment "A"',
        '    segment "B" selected',
        '',
      ].join('\n'),
    );
    const tabs = svgOf(
      ['window:', '  tabs:', '    tab "A"', '    tab "B" active', ''].join('\n'),
    );
    // Only the segmented pill carries an rx corner radius.
    expect(segmented).toMatch(/rx="\d/);
    // Tabs do not emit a rounded container rect — they rely on an underline.
    expect(tabs).not.toMatch(/rx="6"/);
  });

  it('renders correctly under the dark theme', () => {
    const svg = svgOf(
      [
        'window:',
        '  segmented:',
        '    segment "A"',
        '    segment "B" selected',
        '',
      ].join('\n'),
      true,
    );
    expect(svg).toContain(`fill="${DARK_THEME.segmentedBg}"`);
    expect(svg).toContain(`fill="${DARK_THEME.segmentedSelectedBg}"`);
  });
});
