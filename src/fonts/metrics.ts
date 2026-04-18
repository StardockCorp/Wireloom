/**
 * Font metrics used for DOM-free text measurement during layout.
 *
 * v0.1 ships with a single averaged metric table. The renderer todo
 * replaces this with a per-character width table committed as data.
 */

export interface TextMetrics {
  width: number;
  height: number;
}

export interface FontMetricsTable {
  fontFamily: string;
  referenceSize: number;
  /** Average character advance width at {@link referenceSize}. */
  averageCharWidth: number;
  /** Line height (leading + ascent + descent) at {@link referenceSize}. */
  lineHeight: number;
}

const DEFAULT_METRICS: Readonly<FontMetricsTable> = Object.freeze({
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  referenceSize: 14,
  averageCharWidth: 7.2,
  lineHeight: 18,
});

export function getDefaultMetrics(): FontMetricsTable {
  return { ...DEFAULT_METRICS };
}

/**
 * Estimates the rendered bounding box of a single line of text.
 * Replaced in the renderer todo with a per-character metrics lookup.
 */
export function measureText(
  text: string,
  fontSize: number = DEFAULT_METRICS.referenceSize,
): TextMetrics {
  const scale = fontSize / DEFAULT_METRICS.referenceSize;
  return {
    width: text.length * DEFAULT_METRICS.averageCharWidth * scale,
    height: DEFAULT_METRICS.lineHeight * scale,
  };
}
