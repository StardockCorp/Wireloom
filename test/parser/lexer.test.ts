import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/parser/lexer.js';

function kinds(source: string): string[] {
  return tokenize(source).map((t) => t.kind);
}

describe('lexer', () => {
  it('tokenizes the empty string as EOF only', () => {
    expect(kinds('')).toEqual(['eof']);
  });

  it('skips blank lines and comments', () => {
    const tokens = tokenize('\n# comment\n\n# another\n');
    expect(tokens.map((t) => t.kind)).toEqual(['eof']);
  });

  it('emits INDENT and DEDENT around nested children', () => {
    const tokens = kinds('window:\n  text "hi"\n');
    expect(tokens).toEqual([
      'ident',
      'colon',
      'newline',
      'indent',
      'ident',
      'string',
      'newline',
      'dedent',
      'eof',
    ]);
  });

  it('parses number literals with units', () => {
    const tokens = tokenize('col 340:\n  text "x"');
    const numberToken = tokens.find((t) => t.kind === 'number');
    expect(numberToken?.numericValue).toBe(340);
    expect(numberToken?.unit).toBe('px');
  });

  it('parses percent and fr units', () => {
    const pct = tokenize('col 50%:\n  text "x"').find((t) => t.kind === 'number');
    const fr = tokenize('col 1fr:\n  text "x"').find((t) => t.kind === 'number');
    expect(pct?.unit).toBe('percent');
    expect(fr?.unit).toBe('fr');
  });

  it('handles escape sequences in strings', () => {
    const tokens = tokenize('window:\n  text "line1\\nline2 with \\"quotes\\""');
    const str = tokens.find((t) => t.kind === 'string');
    expect(str?.stringValue).toBe('line1\nline2 with "quotes"');
  });

  it('handles inline comments at end of line', () => {
    const tokens = tokenize('window:  # root note\n  text "hi"  # inline\n');
    // Comments must not show up as tokens.
    expect(tokens.some((t) => t.raw.includes('#'))).toBe(false);
  });

  it('preserves line and column info on every token', () => {
    const tokens = tokenize('window:\n  text "hi"');
    const textToken = tokens.find((t) => t.kind === 'ident' && t.identValue === 'text');
    expect(textToken?.line).toBe(2);
    expect(textToken?.column).toBe(3);
  });

  it('normalizes CRLF to LF', () => {
    const tokens = tokenize('window:\r\n  text "hi"\r\n');
    const textToken = tokens.find((t) => t.identValue === 'text');
    expect(textToken?.line).toBe(2);
  });
});
