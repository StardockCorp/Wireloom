/**
 * Performance sanity check — not a hard gate, but catches gross regressions.
 * The Colonial Charter example is the largest real-world test case and
 * should render in well under 50ms warm.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderWireframe } from '../../src/renderer/index.js';

const examplesDir = join(__dirname, '..', '..', 'examples');

describe('render performance sanity', () => {
  it('renders the Colonial Charter in under 50ms warm', () => {
    const src = readFileSync(join(examplesDir, '11-colonial-charter.wireloom'), 'utf8');
    // Warm up (JIT + module caches).
    for (let i = 0; i < 5; i++) renderWireframe(src);

    const start = performance.now();
    const iterations = 20;
    for (let i = 0; i < iterations; i++) renderWireframe(src);
    const elapsed = performance.now() - start;
    const perRender = elapsed / iterations;

    expect(perRender).toBeLessThan(50);
  });

  it('renders a minimal wireframe in under 5ms warm', () => {
    const src = 'window:\n  text "hello"';
    for (let i = 0; i < 5; i++) renderWireframe(src);
    const start = performance.now();
    for (let i = 0; i < 100; i++) renderWireframe(src);
    const elapsed = performance.now() - start;
    const perRender = elapsed / 100;
    expect(perRender).toBeLessThan(5);
  });
});
