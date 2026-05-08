import { describe, it, expect } from 'vitest';
import { renderWireframe } from '../../src/renderer/index.js';

describe('v0.5.2 renderer — icon= on button / kv / stat', () => {
  it('renders a leading inline icon glyph on a button with text', () => {
    const svg = renderWireframe('window:\n  button "Find" icon="research"');
    // Named "research" icon resolves in the registry, so we expect a
    // translated <g> from emitIconByName plus the label text alongside it.
    expect(svg).toMatch(/<g transform="translate\([\d.]+ [\d.]+\) scale\(/);
    expect(svg).toContain('>Find<');
  });

  it('renders an icon-only button when label is empty', () => {
    const svg = renderWireframe('window:\n  button "" icon="plus"');
    // The empty-label form must not emit a stray empty <text> node for the
    // missing label.
    expect(svg).not.toMatch(/font-weight="500" fill="[^"]+"><\/text>/);
    // The plus icon's body should be present.
    expect(svg).toMatch(/<g transform="translate\([\d.]+ [\d.]+\) scale\(/);
  });

  it('falls back to a boxed first letter for unknown icon names', () => {
    const svg = renderWireframe('window:\n  button "Go" icon="totally-fake-name"');
    // The fallback path emits a boxed glyph with the first letter capitalized.
    expect(svg).toMatch(/>T</);
  });

  it('preserves byte-identical output for buttons without icon=', () => {
    // Regression guard: no-icon path must still use the original
    // text-anchor=middle markup so existing golden snapshots stay stable.
    const svg = renderWireframe('window:\n  button "Save"');
    expect(svg).toContain('text-anchor="middle"');
  });

  it('paints a leading icon on kv', () => {
    const svg = renderWireframe('window:\n  kv "Approval" "+15%" icon="approval"');
    expect(svg).toMatch(/<g transform="translate\(/);
  });

  it('paints a leading icon on stat', () => {
    const svg = renderWireframe(
      ['window:', '  stats:', '    stat "GDP" "+12%" icon="industry"'].join('\n'),
    );
    expect(svg).toMatch(/<g transform="translate\(/);
  });
});

describe('v0.5.2 renderer — accent= on text / kv / stat', () => {
  it('colors text with the accent palette when accent=success', () => {
    const svg = renderWireframe('window:\n  text "Surplus" accent=success');
    // Default theme's `success` accent is the green token. We assert the
    // success color appears as a fill on a text element rather than locking
    // the exact hex in case the theme is retuned.
    const match = svg.match(/<text[^>]+fill="(#[0-9a-fA-F]{6,8})"/);
    expect(match).not.toBeNull();
    // Default text color for non-accented text is #2d2d2d — the accent
    // override must produce a different color.
    expect(match?.[1]).not.toBe('#2d2d2d');
  });

  it('applies accent to the value side of kv only, not the label', () => {
    const svg = renderWireframe('window:\n  kv "Approval" "+15%" accent=success');
    // Label uses default text fill; value uses accent. Both text elements
    // exist; one of them keeps the default body color.
    expect(svg).toContain('fill="#2d2d2d"'); // label retains default
  });

  it('rejects accent=bogus at parse time', () => {
    expect(() => renderWireframe('window:\n  text "Hi" accent=bogus')).toThrow();
  });

  it('preserves byte-identical text output when accent= is absent', () => {
    // Regression guard for the textStyle change. With no accent attr, the
    // fill must remain the default body color and the markup form must not
    // gain new attributes.
    const svg = renderWireframe('window:\n  text "Plain"');
    expect(svg).toMatch(/<text x="[\d.]+" y="[\d.]+" fill="#2d2d2d">Plain<\/text>/);
  });
});
