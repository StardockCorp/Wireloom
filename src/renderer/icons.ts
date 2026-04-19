/**
 * Named icon registry. Each glyph is drawn in a 16×16 logical box with a
 * single-stroke / single-fill style, then emitted as a `<g>` translated and
 * scaled into the caller's target rect. Unknown names fall back to a boxed
 * first-letter placeholder (the v0.3 behavior), so older mockups keep rendering.
 *
 * Adding a new icon: append an entry to `ICON_PATHS` keyed by its short name.
 * Keep shapes minimal — wireframes, not production iconography.
 */

/**
 * SVG markup fragments drawn inside a 16×16 viewBox with `currentColor` for
 * stroke/fill. The caller wraps each one in a colored `<g transform>`.
 */
const ICON_PATHS: Record<string, string> = {
  // Economy / wealth
  credits:
    '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4" />' +
    '<text x="8" y="11.3" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="currentColor">$</text>',

  // Research / science
  research:
    '<path d="M 6 2 L 6 6 L 3 13 Q 3 14 4 14 L 12 14 Q 13 14 13 13 L 10 6 L 10 2 Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />' +
    '<line x1="5.5" y1="2" x2="10.5" y2="2" stroke="currentColor" stroke-width="1.4" />',

  // Military / combat
  military:
    '<path d="M 8 2 L 13 4 L 13 8 Q 13 12 8 14 Q 3 12 3 8 L 3 4 Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />',

  // Industry / production
  industry:
    '<path d="M 2 14 L 2 8 L 7 10 L 7 7 L 12 10 L 12 4 L 14 4 L 14 14 Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />',

  // Influence / speech
  influence:
    '<path d="M 3 4 L 13 4 Q 14 4 14 5 L 14 10 Q 14 11 13 11 L 8 11 L 5 14 L 5 11 L 3 11 Q 2 11 2 10 L 2 5 Q 2 4 3 4 Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />',

  // Approval / loyalty (simple heart)
  approval:
    '<path d="M 8 14 Q 2 10 2 6 Q 2 3 5 3 Q 7 3 8 5 Q 9 3 11 3 Q 14 3 14 6 Q 14 10 8 14 Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />',

  // Faith / ideology
  faith:
    '<path d="M 8 2 L 9.6 6.5 L 14 6.5 L 10.5 9.2 L 11.8 14 L 8 11.2 L 4.2 14 L 5.5 9.2 L 2 6.5 L 6.4 6.5 Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />',

  // Authority / admin
  authority:
    '<path d="M 3 14 L 3 5 L 5 5 L 5 3 L 11 3 L 11 5 L 13 5 L 13 14 Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />' +
    '<line x1="8" y1="5" x2="8" y2="14" stroke="currentColor" stroke-width="1" />',

  // Computation / AI compute
  computation:
    '<rect x="4" y="4" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />' +
    '<line x1="2" y1="6" x2="4" y2="6" stroke="currentColor" stroke-width="1" />' +
    '<line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" stroke-width="1" />' +
    '<line x1="12" y1="6" x2="14" y2="6" stroke="currentColor" stroke-width="1" />' +
    '<line x1="12" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1" />' +
    '<line x1="6" y1="2" x2="6" y2="4" stroke="currentColor" stroke-width="1" />' +
    '<line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" stroke-width="1" />' +
    '<line x1="6" y1="12" x2="6" y2="14" stroke="currentColor" stroke-width="1" />' +
    '<line x1="10" y1="12" x2="10" y2="14" stroke="currentColor" stroke-width="1" />',

  // Tech / research tree node
  tech:
    '<polygon points="8,2 14,6 14,10 8,14 2,10 2,6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />' +
    '<circle cx="8" cy="8" r="2" fill="currentColor" />',

  // Policy / document
  policy:
    '<path d="M 4 2 L 11 2 L 13 4 L 13 14 L 4 14 Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />' +
    '<line x1="6" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="1" />' +
    '<line x1="6" y1="10" x2="11" y2="10" stroke="currentColor" stroke-width="1" />',

  // Ship
  ship:
    '<path d="M 2 10 L 14 10 L 12 14 L 4 14 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />' +
    '<line x1="8" y1="2" x2="8" y2="10" stroke="currentColor" stroke-width="1.4" />' +
    '<path d="M 8 3 L 12 7 L 8 7 Z" fill="currentColor" />',

  // Planet
  planet:
    '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.4" />' +
    '<ellipse cx="8" cy="8" rx="7" ry="2" fill="none" stroke="currentColor" stroke-width="1" transform="rotate(-20 8 8)" />',

  // Leader / person
  leader:
    '<circle cx="8" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.4" />' +
    '<path d="M 3 14 Q 3 9 8 9 Q 13 9 13 14 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />',

  // Gear
  gear:
    '<path d="M 8 2 L 9 3.5 L 11 3 L 11.5 5 L 13 6 L 12.5 8 L 13 10 L 11.5 11 L 11 13 L 9 12.5 L 8 14 L 7 12.5 L 5 13 L 4.5 11 L 3 10 L 3.5 8 L 3 6 L 4.5 5 L 5 3 L 7 3.5 Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />' +
    '<circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.2" />',

  // Warning
  warning:
    '<path d="M 8 2 L 14 13 L 2 13 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />' +
    '<line x1="8" y1="6" x2="8" y2="9" stroke="currentColor" stroke-width="1.6" />' +
    '<circle cx="8" cy="11" r="0.8" fill="currentColor" />',

  // Lock
  lock:
    '<rect x="3.5" y="7" width="9" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />' +
    '<path d="M 5.5 7 L 5.5 5 Q 5.5 2.5 8 2.5 Q 10.5 2.5 10.5 5 L 10.5 7" fill="none" stroke="currentColor" stroke-width="1.4" />',

  // Check
  check:
    '<path d="M 3 8 L 7 12 L 13 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />',

  // Star
  star:
    '<path d="M 8 2 L 9.6 6.5 L 14 6.5 L 10.5 9.2 L 11.8 14 L 8 11.2 L 4.2 14 L 5.5 9.2 L 2 6.5 L 6.4 6.5 Z" ' +
    'fill="currentColor" stroke="none" />',

  // Plus / minus (handy extras for UI chrome)
  plus:
    '<line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />' +
    '<line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />',
  minus:
    '<line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />',
};

export function hasIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICON_PATHS, name);
}

/**
 * Emit a named icon as SVG markup, painted in `color`, fit into a box at
 * (x, y) of `size` pixels square. Returns `undefined` when the name is
 * unknown so the caller can fall back to its previous rendering.
 */
export function emitIconByName(
  name: string,
  x: number,
  y: number,
  size: number,
  color: string,
): string | undefined {
  const body = ICON_PATHS[name];
  if (body === undefined) return undefined;
  const scale = size / 16;
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})" color="${color}">` +
    body +
    `</g>`
  );
}

/** Returns the list of all named icons the library knows about. */
export function listIcons(): string[] {
  return Object.keys(ICON_PATHS).sort();
}
