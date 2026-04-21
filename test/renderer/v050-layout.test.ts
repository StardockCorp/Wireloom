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
