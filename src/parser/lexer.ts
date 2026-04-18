/**
 * Wireloom lexer.
 *
 * Converts a source string into a token stream including synthetic
 * INDENT/DEDENT markers that let the parser handle indentation
 * structurally instead of counting spaces on every line.
 */

import { WireloomError } from './errors.js';
import type { LengthUnit } from './ast.js';

export type TokenKind =
  | 'ident'
  | 'string'
  | 'number'
  | 'range'
  | 'equals'
  | 'colon'
  | 'newline'
  | 'indent'
  | 'dedent'
  | 'eof';

export interface Token {
  kind: TokenKind;
  /** Raw source text this token was produced from (for error messages). */
  raw: string;
  /** For `string` tokens, the unescaped string value. */
  stringValue?: string;
  /** For `number` tokens, the parsed numeric value. */
  numericValue?: number;
  /** For `number` tokens, the unit suffix (`px` by default). */
  unit?: LengthUnit;
  /** For `range` tokens, the minimum bound. */
  rangeMin?: number;
  /** For `range` tokens, the maximum bound. */
  rangeMax?: number;
  /** For `ident` tokens, the identifier text. */
  identValue?: string;
  line: number;
  column: number;
}

const INDENT_SIZE = 2;

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  // Normalize line endings.
  const src = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = src.split('\n');
  const indentStack: number[] = [0];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx] ?? '';
    const lineNo = lineIdx + 1;

    // Detect tab in leading whitespace — forbidden.
    const leadingWhitespace = /^[ \t]*/.exec(rawLine)?.[0] ?? '';
    if (leadingWhitespace.includes('\t')) {
      const tabColumn = leadingWhitespace.indexOf('\t') + 1;
      throw new WireloomError(
        'tab in indentation (use 2 spaces, not tabs)',
        lineNo,
        tabColumn,
      );
    }

    // A line consisting only of whitespace, or only a comment after whitespace,
    // is a "logical blank" and does not participate in indentation tracking.
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const indentSpaces = leadingWhitespace.length;
    if (indentSpaces % INDENT_SIZE !== 0) {
      throw new WireloomError(
        `indentation of ${indentSpaces} spaces is not a multiple of ${INDENT_SIZE}`,
        lineNo,
        1,
      );
    }

    const currentLevel = indentStack[indentStack.length - 1] ?? 0;

    if (indentSpaces > currentLevel) {
      if (indentSpaces - currentLevel !== INDENT_SIZE) {
        throw new WireloomError(
          `indentation jumped ${indentSpaces - currentLevel} spaces (only one level at a time is allowed)`,
          lineNo,
          1,
        );
      }
      indentStack.push(indentSpaces);
      tokens.push({
        kind: 'indent',
        raw: ' '.repeat(INDENT_SIZE),
        line: lineNo,
        column: 1,
      });
    } else if (indentSpaces < currentLevel) {
      while ((indentStack[indentStack.length - 1] ?? 0) > indentSpaces) {
        indentStack.pop();
        tokens.push({
          kind: 'dedent',
          raw: '',
          line: lineNo,
          column: 1,
        });
      }
      const backTo = indentStack[indentStack.length - 1] ?? 0;
      if (backTo !== indentSpaces) {
        throw new WireloomError(
          `indentation does not match any outer level (found ${indentSpaces}, open levels: ${indentStack.join(', ')})`,
          lineNo,
          1,
        );
      }
    }

    // Tokenize the line content after leading whitespace.
    tokenizeLineContent(rawLine, indentSpaces, lineNo, tokens);
    tokens.push({
      kind: 'newline',
      raw: '\n',
      line: lineNo,
      column: rawLine.length + 1,
    });
  }

  // Emit DEDENTs for any remaining open levels.
  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({
      kind: 'dedent',
      raw: '',
      line: lines.length + 1,
      column: 1,
    });
  }

  tokens.push({
    kind: 'eof',
    raw: '',
    line: lines.length + 1,
    column: 1,
  });
  return tokens;
}

function tokenizeLineContent(
  rawLine: string,
  startColumn0: number,
  lineNo: number,
  tokens: Token[],
): void {
  let col = startColumn0;
  const end = rawLine.length;

  while (col < end) {
    const ch = rawLine[col];

    // Whitespace between tokens.
    if (ch === ' ') {
      col++;
      continue;
    }

    // Inline comment — terminates the line.
    if (ch === '#') {
      return;
    }

    // String literal.
    if (ch === '"') {
      const start = col;
      let value = '';
      col++; // consume opening quote
      while (col < end) {
        const c = rawLine[col];
        if (c === '"') {
          col++;
          tokens.push({
            kind: 'string',
            raw: rawLine.slice(start, col),
            stringValue: value,
            line: lineNo,
            column: start + 1,
          });
          break;
        }
        if (c === '\\') {
          const next = rawLine[col + 1];
          if (next === '"') {
            value += '"';
            col += 2;
            continue;
          }
          if (next === '\\') {
            value += '\\';
            col += 2;
            continue;
          }
          if (next === 'n') {
            value += '\n';
            col += 2;
            continue;
          }
          throw new WireloomError(
            `invalid escape sequence "\\${next ?? ''}" (supported: \\", \\\\, \\n)`,
            lineNo,
            col + 1,
          );
        }
        value += c;
        col++;
      }
      if (col > end || rawLine[col - 1] !== '"') {
        throw new WireloomError(
          'unterminated string literal',
          lineNo,
          start + 1,
        );
      }
      continue;
    }

    // Number or range literal.
    if (ch !== undefined && /[0-9]/.test(ch)) {
      const start = col;
      while (col < end && /[0-9]/.test(rawLine[col] ?? '')) {
        col++;
      }
      const digits = rawLine.slice(start, col);

      // Check for range form: digits "-" digits (no whitespace).
      // A range is unambiguous here: `-` can't start an identifier (idents start
      // with a letter/underscore), and negative numbers aren't in the grammar.
      if (rawLine[col] === '-' && /[0-9]/.test(rawLine[col + 1] ?? '')) {
        col++; // consume "-"
        const maxStart = col;
        while (col < end && /[0-9]/.test(rawLine[col] ?? '')) {
          col++;
        }
        const maxDigits = rawLine.slice(maxStart, col);
        tokens.push({
          kind: 'range',
          raw: rawLine.slice(start, col),
          rangeMin: Number.parseInt(digits, 10),
          rangeMax: Number.parseInt(maxDigits, 10),
          line: lineNo,
          column: start + 1,
        });
        continue;
      }

      let unit: LengthUnit = 'px';
      if (rawLine.slice(col, col + 2) === 'px') {
        unit = 'px';
        col += 2;
      } else if (rawLine[col] === '%') {
        unit = 'percent';
        col += 1;
      } else if (rawLine.slice(col, col + 2) === 'fr') {
        unit = 'fr';
        col += 2;
      }
      tokens.push({
        kind: 'number',
        raw: rawLine.slice(start, col),
        numericValue: Number.parseInt(digits, 10),
        unit,
        line: lineNo,
        column: start + 1,
      });
      continue;
    }

    // `=`
    if (ch === '=') {
      tokens.push({
        kind: 'equals',
        raw: '=',
        line: lineNo,
        column: col + 1,
      });
      col++;
      continue;
    }

    // `:`
    if (ch === ':') {
      tokens.push({
        kind: 'colon',
        raw: ':',
        line: lineNo,
        column: col + 1,
      });
      col++;
      continue;
    }

    // Identifier.
    if (ch !== undefined && /[a-zA-Z_]/.test(ch)) {
      const start = col;
      while (
        col < end &&
        /[a-zA-Z0-9_-]/.test(rawLine[col] ?? '')
      ) {
        col++;
      }
      const ident = rawLine.slice(start, col);
      tokens.push({
        kind: 'ident',
        raw: ident,
        identValue: ident,
        line: lineNo,
        column: start + 1,
      });
      continue;
    }

    throw new WireloomError(
      `unexpected character "${ch}"`,
      lineNo,
      col + 1,
    );
  }
}
