import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderWireframe } from '../../src/renderer/index.js';

const examplesDir = join(__dirname, '..', '..', 'examples');

const exampleFiles = readdirSync(examplesDir)
  .filter((f) => f.endsWith('.wireloom'))
  .sort();

describe('svg renderer — example corpus', () => {
  for (const file of exampleFiles) {
    it(`renders ${file} to stable SVG matching the golden snapshot`, async () => {
      const src = readFileSync(join(examplesDir, file), 'utf8');
      const svg = renderWireframe(src);
      // Pretty-print one top-level element per line for easier diffing.
      const pretty = svg.replace(/></g, '>\n<');
      await expect(pretty).toMatchFileSnapshot(
        join(__dirname, 'fixtures', `${file.replace('.wireloom', '')}.svg`),
      );
    });
  }

  it('produces identical output for the same source on repeated calls', () => {
    const src = readFileSync(join(examplesDir, '02-login-form.wireloom'), 'utf8');
    const a = renderWireframe(src);
    const b = renderWireframe(src);
    expect(a).toBe(b);
  });

  it('emits valid <svg> with xmlns, viewBox, and dimensions', () => {
    const svg = renderWireframe('window:\n  text "hi"');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toMatch(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/viewBox="0 0 \d/);
    expect(svg).toMatch(/width="\d/);
    expect(svg).toMatch(/height="\d/);
  });

  it('escapes HTML-sensitive characters in text content', () => {
    const svg = renderWireframe('window:\n  text "a < b & c > d"');
    expect(svg).toContain('a &lt; b &amp; c &gt; d');
    expect(svg).not.toContain('a < b & c > d'); // raw form must not leak
  });

  it('returns an empty SVG for empty source', () => {
    expect(renderWireframe('')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>',
    );
  });

  it('renders primary button with emphasized fill', () => {
    const svg = renderWireframe('window:\n  button "Save" primary');
    expect(svg).toContain('fill="#3a3a3a"'); // primaryButtonFill from default theme
  });

  it('renders disabled button with reduced opacity', () => {
    const svg = renderWireframe('window:\n  button "Off" disabled');
    expect(svg).toContain('opacity="0.55"');
  });

  it('supports the dark theme when requested', () => {
    const svg = renderWireframe('window:\n  text "hello"', { theme: 'dark' });
    expect(svg).toContain('fill="#1e1e1e"'); // dark background
    expect(svg).toContain('fill="#e0e0e0"'); // dark text
  });
});
