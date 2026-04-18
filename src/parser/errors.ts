/**
 * Parse-time errors. All user-facing errors from the lexer and parser
 * go through this class so they carry precise line/column information
 * and a consistent message format.
 */

export class WireloomError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(`Line ${line}, col ${column}: ${message}`);
    this.name = 'WireloomError';
    this.line = line;
    this.column = column;
  }
}
