import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../../src/parser/parser.js';

const examplesDir = join(__dirname, '..', '..', 'examples');

const exampleFiles = readdirSync(examplesDir)
  .filter((f) => f.endsWith('.wireloom'))
  .sort();

describe('parser — example corpus', () => {
  for (const file of exampleFiles) {
    it(`parses ${file} into an AST matching the golden snapshot`, async () => {
      const src = readFileSync(join(examplesDir, file), 'utf8');
      const doc = parse(src);
      await expect(JSON.stringify(doc, null, 2)).toMatchFileSnapshot(
        join(__dirname, 'fixtures', `${file.replace('.wireloom', '')}.ast.json`),
      );
    });
  }

  it('always returns a Document with a root window for valid sources', () => {
    for (const file of exampleFiles) {
      const src = readFileSync(join(examplesDir, file), 'utf8');
      const doc = parse(src);
      expect(doc.kind).toBe('document');
      expect(doc.root).toBeDefined();
      expect(doc.root?.kind).toBe('window');
    }
  });

  it('returns an empty Document for empty source', () => {
    const doc = parse('');
    expect(doc.kind).toBe('document');
    expect(doc.root).toBeUndefined();
  });

  it('returns an empty Document for comment-only source', () => {
    const doc = parse('# just a comment\n# another comment\n');
    expect(doc.kind).toBe('document');
    expect(doc.root).toBeUndefined();
  });
});
