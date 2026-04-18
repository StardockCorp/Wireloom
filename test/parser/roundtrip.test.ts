/**
 * Roundtrip idempotence tests.
 *
 * For every example in the corpus:
 *   source1 → parse → ast1 → serialize → source2 → parse → ast2
 *   assert ast1 == ast2
 *
 * This catches parser/serializer asymmetries: anything the parser accepts
 * but the serializer can't emit, and anything the serializer emits but
 * the parser rejects.
 *
 * Source identity is NOT checked — comments, blank lines, and whitespace
 * variations are lost through the AST. Only AST equality matters.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../../src/parser/parser.js';
import { serialize } from '../../src/parser/serializer.js';

const examplesDir = join(__dirname, '..', '..', 'examples');
const exampleFiles = readdirSync(examplesDir)
  .filter((f) => f.endsWith('.wireloom'))
  .sort();

/** Strip source-derived metadata fields (positions, sourceLines) so
 * location-only drift from comment-stripping / whitespace collapsing
 * doesn't cause false failures. These are parser outputs derived from
 * the raw source, not part of the document's semantic content. */
function stripMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMetadata);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'position' || k === 'sourceLines') continue;
      out[k] = stripMetadata(v);
    }
    return out;
  }
  return value;
}

describe('roundtrip idempotence', () => {
  for (const file of exampleFiles) {
    it(`${file} — serialize then re-parse yields the same AST`, () => {
      const source1 = readFileSync(join(examplesDir, file), 'utf8');
      const ast1 = parse(source1);
      const source2 = serialize(ast1);
      const ast2 = parse(source2);
      expect(stripMetadata(ast2)).toEqual(stripMetadata(ast1));
    });
  }

  it('is stable across multiple roundtrips (no drift)', () => {
    const source1 = readFileSync(join(examplesDir, '11-colonial-charter.wireloom'), 'utf8');
    const ast1 = parse(source1);
    const source2 = serialize(ast1);
    const source3 = serialize(parse(source2));
    const source4 = serialize(parse(source3));
    expect(source3).toBe(source2);
    expect(source4).toBe(source3);
  });
});
