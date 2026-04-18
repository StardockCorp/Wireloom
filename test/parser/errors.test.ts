import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { WireloomError } from '../../src/parser/errors.js';

function expectParseError(source: string): WireloomError {
  try {
    parse(source);
  } catch (err) {
    if (err instanceof WireloomError) return err;
    throw new Error(`expected WireloomError, got ${(err as Error).message}`);
  }
  throw new Error('expected parse error, got success');
}

describe('parser — error messages', () => {
  it('rejects tabs in indentation with a clear message', () => {
    const err = expectParseError('window:\n\ttext "hi"');
    expect(err.line).toBe(2);
    expect(err.message).toContain('tab in indentation');
    expect(err.message).toContain('use 2 spaces');
  });

  it('rejects odd indentation with the actual count', () => {
    const err = expectParseError('window:\n   text "hi"');
    expect(err.line).toBe(2);
    expect(err.message).toContain('3 spaces is not a multiple of 2');
  });

  it('rejects unknown primitives with the full valid list', () => {
    const err = expectParseError('window:\n  widget "oops"');
    expect(err.line).toBe(2);
    expect(err.message).toContain('unknown primitive "widget"');
    expect(err.message).toContain('window, header, footer');
  });

  it('rejects missing required positional arg on text', () => {
    const err = expectParseError('window:\n  text');
    expect(err.line).toBe(2);
    expect(err.message).toContain('"text" requires a string argument');
  });

  it('rejects missing required positional arg on button', () => {
    const err = expectParseError('window:\n  button');
    expect(err.line).toBe(2);
    expect(err.message).toContain('"button" requires a string label');
  });

  it('rejects unterminated string literals', () => {
    const err = expectParseError('window:\n  text "hello');
    expect(err.line).toBe(2);
    expect(err.message).toContain('unterminated string');
  });

  it('rejects unknown attributes with primitive name', () => {
    const err = expectParseError('window:\n  input rainbow=true');
    expect(err.line).toBe(2);
    expect(err.message).toContain('unknown attribute "rainbow" on "input"');
  });

  it('rejects unknown flags with primitive name', () => {
    const err = expectParseError('window:\n  button "x" sparkle');
    expect(err.line).toBe(2);
    expect(err.message).toContain('unknown flag "sparkle" on "button"');
  });

  it('rejects colon on leaf primitives', () => {
    const err = expectParseError('window:\n  text "hi":\n    text "bad"');
    expect(err.line).toBe(2);
    expect(err.message).toContain('"text" cannot have children');
  });

  it('rejects non-window root nodes', () => {
    const err = expectParseError('panel:\n  text "hi"');
    expect(err.line).toBe(1);
    expect(err.message).toContain('root node must be "window"');
  });

  it('rejects nested window nodes', () => {
    const err = expectParseError('window:\n  window:\n    text "hi"');
    expect(err.line).toBe(2);
    expect(err.message).toContain('"window" cannot be nested');
  });

  it('rejects colon with no children block following', () => {
    const err = expectParseError('window:\n');
    expect(err.line).toBe(1);
    expect(err.message).toContain('has no indented children');
  });

  it('rejects multiple root windows', () => {
    const err = expectParseError('window:\n  text "a"\nwindow:\n  text "b"');
    expect(err.message).toContain('only one root "window" node is allowed');
  });

  it('rejects invalid escape sequences in strings', () => {
    const err = expectParseError('window:\n  text "bad\\xescape"');
    expect(err.line).toBe(2);
    expect(err.message).toContain('invalid escape sequence');
  });

  it('rejects indentation that jumps multiple levels at once', () => {
    const err = expectParseError('window:\n      text "too deep"');
    expect(err.line).toBe(2);
    expect(err.message).toContain('indentation jumped');
  });

  it('rejects "header" as a container child', () => {
    const err = expectParseError('window:\n  panel:\n    header:\n      text "nope"');
    expect(err.message).toContain('"header" is not allowed here');
  });
});
