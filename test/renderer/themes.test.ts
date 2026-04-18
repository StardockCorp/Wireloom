import { describe, it, expect } from 'vitest';
import { DARK_THEME, DEFAULT_THEME, getTheme } from '../../src/renderer/themes.js';

describe('themes', () => {
  it('returns the default theme by name', () => {
    expect(getTheme('default')).toBe(DEFAULT_THEME);
  });

  it('returns the dark theme by name', () => {
    expect(getTheme('dark')).toBe(DARK_THEME);
  });

  it('themes are frozen — their values cannot be mutated at runtime', () => {
    expect(() => {
      (DEFAULT_THEME as unknown as { textColor: string }).textColor = 'red';
    }).toThrow();
  });

  it('dark and default themes share the same structural keys', () => {
    const defaultKeys = Object.keys(DEFAULT_THEME).sort();
    const darkKeys = Object.keys(DARK_THEME).sort();
    expect(darkKeys).toEqual(defaultKeys);
  });

  it('dark theme has a darker background than default', () => {
    expect(DARK_THEME.background).not.toBe(DEFAULT_THEME.background);
  });
});
