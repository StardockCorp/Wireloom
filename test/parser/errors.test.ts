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
    expect(err.message).toContain('2 or 4 spaces');
  });

  it('rejects odd indentation at first-line detection', () => {
    const err = expectParseError('window:\n   text "hi"');
    expect(err.line).toBe(2);
    expect(err.message).toContain('3 spaces');
    expect(err.message).toContain('2 or 4 spaces');
  });

  it('rejects an inconsistent indent unit once the unit is locked', () => {
    // First indented line uses 2 → file locks to 2-space. A later line using
    // 3 must fail as "not a multiple of 2".
    const err = expectParseError('window:\n  panel:\n   text "wrong"');
    expect(err.line).toBe(3);
    expect(err.message).toContain('not a multiple of 2');
  });

  it('accepts 4-space indentation when used consistently', () => {
    const doc = parse('window:\n    text "four-space"');
    expect(doc.root?.children.length).toBe(1);
  });

  it('locks to 4-space once detected; rejects 2-space inside a 4-space file', () => {
    const err = expectParseError('window:\n    panel:\n        text "a"\n  text "b"');
    expect(err.message).toContain('multiple of 4');
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
    // Detection sees 2 on panel line; text line jumps from 2 to 6 which is
    // both a multiple of 2 AND a jump of two levels — must fail.
    const err = expectParseError('window:\n  panel:\n      text "too deep"');
    expect(err.line).toBe(3);
    expect(err.message).toContain('indentation jumped');
  });

  it('rejects "header" as a container child', () => {
    const err = expectParseError('window:\n  panel:\n    header:\n      text "nope"');
    expect(err.message).toContain('"header"');
    expect(err.message).toContain('"window"');
  });

  // ---------------------------------------------------------------------------
  // v0.2 error cases
  // ---------------------------------------------------------------------------

  it('rejects "tab" outside "tabs"', () => {
    const err = expectParseError('window:\n  tab "Stray"');
    expect(err.message).toContain('"tab"');
    expect(err.message).toContain('"tabs"');
  });

  it('rejects "item" outside "list"', () => {
    const err = expectParseError('window:\n  item "Stray"');
    expect(err.message).toContain('"item"');
    expect(err.message).toContain('"list"');
  });

  it('rejects non-tab children inside "tabs"', () => {
    const err = expectParseError('window:\n  tabs:\n    text "oops"');
    expect(err.message).toContain('"tabs"');
    expect(err.message).toContain('"tab"');
  });

  it('rejects non-item/slot children inside "list"', () => {
    const err = expectParseError('window:\n  list:\n    text "oops"');
    expect(err.message).toContain('"list"');
  });

  it('rejects missing title on "section"', () => {
    const err = expectParseError('window:\n  section:\n    text "x"');
    expect(err.message).toContain('"section" requires a title');
  });

  it('rejects missing title on "slot"', () => {
    const err = expectParseError('window:\n  list:\n    slot:\n      text "x"');
    expect(err.message).toContain('"slot" requires a title');
  });

  it('rejects missing positionals on "kv"', () => {
    const err = expectParseError('window:\n  kv "Only Label"');
    expect(err.message).toContain('"kv" requires a value string');
  });

  it('rejects invalid weight value on "text"', () => {
    const err = expectParseError('window:\n  text "x" weight=extrabold');
    expect(err.message).toContain('"extrabold"');
    expect(err.message).toContain('weight');
    expect(err.message).toContain('light, regular, semibold, bold');
  });

  it('rejects invalid size value on "text"', () => {
    const err = expectParseError('window:\n  text "x" size=massive');
    expect(err.message).toContain('"massive"');
    expect(err.message).toContain('size');
  });

  it('rejects invalid align value on "row"', () => {
    const err = expectParseError('window:\n  row align=justified:\n    text "x"');
    expect(err.message).toContain('"justified"');
    expect(err.message).toContain('align');
  });

  it('rejects range with M <= N on slider', () => {
    const err = expectParseError('window:\n  slider range=100-0 value=50');
    expect(err.message).toContain('M > N');
  });

  it('rejects non-range value for slider range', () => {
    const err = expectParseError('window:\n  slider range=100 value=50');
    expect(err.message).toContain('range');
  });

  it('rejects "bold" flag on non-text/kv primitive', () => {
    const err = expectParseError('window:\n  button "Go" bold');
    expect(err.message).toContain('"bold"');
    expect(err.message).toContain('"button"');
  });

  it('accepts col with `fill` positional', () => {
    const doc = parse('window:\n  row:\n    col fill:\n      text "a"');
    expect(doc.root).toBeDefined();
  });

  it('defaults bare col to fill width (v0.2 behavior change)', () => {
    const doc = parse('window:\n  row:\n    col:\n      text "a"');
    const row = doc.root?.children[0];
    if (row?.kind !== 'row') throw new Error('expected row');
    const col = row.children[0];
    if (col?.kind !== 'col') throw new Error('expected col');
    expect(col.width.kind).toBe('fill');
  });

  // ---------------------------------------------------------------------------
  // v0.3 — "did you mean?" suggestions
  // ---------------------------------------------------------------------------

  it('suggests the closest primitive for a typo', () => {
    const err = expectParseError('window:\n  sectoin "Economy":\n    text "x"');
    expect(err.message).toContain('unknown primitive "sectoin"');
    expect(err.message).toContain('Did you mean "section"?');
  });

  it('suggests the closest primitive for a single-character typo', () => {
    const err = expectParseError('window:\n  secton "Economy":\n    text "x"');
    expect(err.message).toContain('Did you mean "section"?');
  });

  it('does not suggest anything for completely unrelated input', () => {
    const err = expectParseError('window:\n  xyzzyzy "blah"');
    expect(err.message).toContain('unknown primitive');
    expect(err.message).not.toContain('Did you mean');
  });

  it('suggests the closest attribute for a typo', () => {
    const err = expectParseError('window:\n  input plcaeholder="Email"');
    expect(err.message).toContain('unknown attribute "plcaeholder"');
    expect(err.message).toContain('Did you mean "placeholder"?');
  });

  it('suggests the closest flag for a typo', () => {
    const err = expectParseError('window:\n  button "X" prmary');
    expect(err.message).toContain('unknown flag "prmary"');
    expect(err.message).toContain('Did you mean "primary"?');
  });

  it('suggests the closest enum value for weight typo', () => {
    const err = expectParseError('window:\n  text "x" weight=bld');
    expect(err.message).toContain('"bld"');
    expect(err.message).toContain('Did you mean "bold"?');
  });

  // ---------------------------------------------------------------------------
  // v0.3 — kv hint for single-string-with-separator mistake
  // ---------------------------------------------------------------------------

  it('emits a targeted hint when kv is given a single string with embedded =', () => {
    const err = expectParseError('window:\n  kv "Tax Rate=30%"');
    expect(err.message).toContain('"kv" needs two separate strings');
    expect(err.message).toContain('kv "Tax Rate" "30%"');
  });

  it('emits a targeted hint when kv is given a single string with embedded :', () => {
    const err = expectParseError('window:\n  kv "Name: Admiral Voss"');
    expect(err.message).toContain('"kv" needs two separate strings');
    expect(err.message).toContain('kv "Name" "Admiral Voss"');
  });

  it('still emits the generic kv error when no separator is present', () => {
    const err = expectParseError('window:\n  kv "LonelyLabel"');
    expect(err.message).toContain('"kv" requires a value string after the label');
    expect(err.message).not.toContain('split on');
  });
});
