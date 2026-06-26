/**
 * src/client/glyph.ts
 * -------------------
 * Procedural UI glyphs — the line-art that replaces every emoji in the chrome
 * (tab rail, skill icons, buffs, factions, achievements, the gold line …). One
 * `iconize()` call maps an emoji to a small inline SVG drawn in the same warm
 * line style as the rest of the game, inheriting its colour from the
 * surrounding text via `currentColor`. Content data keeps its emoji; only the
 * rendering swaps them out, so nothing in the core or content has to change.
 */

const VB = `viewBox="0 0 24 24" class="g-ico" xmlns="http://www.w3.org/2000/svg"`;
// Stroke-based glyph (most icons): inherits colour, no fill.
const line = (inner: string): string =>
  `<svg ${VB} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
// Solid glyph (heart, sparkle, coin …): filled with the text colour.
const solid = (inner: string): string =>
  `<svg ${VB} fill="currentColor" stroke="none">${inner}</svg>`;

// name → SVG. Kept small and recognisable at ~20px.
const GLYPHS: Record<string, string> = {
  pickaxe: line(`<path d="M4 9 Q12 4 20 9"/><line x1="12" y1="7" x2="12" y2="20"/>`),
  hammer: line(`<rect x="5" y="5" width="11" height="5" rx="1"/><path d="M10.5 10 L13 20"/>`),
  pine: line(`<path d="M12 3 L7 11 L17 11 Z"/><path d="M12 8 L6 16 L18 16 Z"/><line x1="12" y1="16" x2="12" y2="21"/>`),
  saw: line(`<path d="M4 17 L14 7 L17 10 L7 20 Z"/><path d="M16 9 L20 5"/>`),
  snare: line(`<path d="M5 12 Q12 6 19 12"/><path d="M5 12 Q12 18 19 12"/><line x1="12" y1="12" x2="12" y2="21"/>`),
  fish: line(`<path d="M3 12 Q9 6 16 12 Q9 18 3 12 Z"/><path d="M16 12 L21 8 M16 12 L21 16"/><circle cx="13" cy="11" r="0.9" fill="currentColor"/>`),
  pot: line(`<path d="M5 12 H19 L18 19 Q18 20 16 20 H8 Q6 20 6 19 Z"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M10 8 Q11 6 10 4 M14 8 Q15 6 14 4"/>`),
  wheat: line(`<line x1="12" y1="21" x2="12" y2="8"/><path d="M12 9 Q9 7 8 10 M12 9 Q15 7 16 10 M12 13 Q9 11 8 14 M12 13 Q15 11 16 14 M12 17 Q9 15 8 18 M12 17 Q15 15 16 18"/>`),
  tent: line(`<path d="M4 19 L12 5 L20 19 Z"/><path d="M12 5 L12 19 M9 19 L12 14 L15 19"/>`),
  flask: line(`<path d="M10 4 H14 M11 4 V10 L6 18 Q6 20 8 20 H16 Q18 20 18 18 L13 10 V4"/><line x1="8.5" y1="15" x2="15.5" y2="15"/>`),
  wall: line(`<rect x="4" y="6" width="16" height="12" rx="1"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="8" y1="12" x2="8" y2="18"/><line x1="16" y1="12" x2="16" y2="18"/>`),
  scissors: line(`<circle cx="7" cy="17" r="2.4"/><circle cx="7" cy="7" r="2.4"/><path d="M9 15.5 L20 5 M9 8.5 L20 19"/>`),
  target: line(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`),
  heart: solid(`<path d="M12 20 Q4 14 4 9 Q4 5 8 5 Q11 5 12 8 Q13 5 16 5 Q20 5 20 9 Q20 14 12 20 Z"/>`),
  swords: line(`<path d="M5 18 L15 8 M15 5 H19 V9 M16 6 L13 9 M11 11 L7 15"/><path d="M19 18 L9 8 M9 5 H5 V9 M8 6 L11 9 M13 11 L17 15"/>`),
  dumbbell: line(`<line x1="7" y1="12" x2="17" y2="12"/><rect x="3" y="8.5" width="3" height="7" rx="1"/><rect x="18" y="8.5" width="3" height="7" rx="1"/>`),
  shield: line(`<path d="M12 3 L19 6 V12 Q19 18 12 21 Q5 18 5 12 V6 Z"/>`),
  bow: line(`<path d="M7 4 Q17 12 7 20"/><line x1="7" y1="4" x2="7" y2="20"/><path d="M7 12 L18 12 M18 12 L15.5 10 M18 12 L15.5 14"/>`),
  backpack: line(`<path d="M5 9 H19 V19 Q19 20 18 20 H6 Q5 20 5 19 Z"/><path d="M8 9 V7 Q8 4 12 4 Q16 4 16 7 V9"/><rect x="9" y="13" width="6" height="5" rx="1"/>`),
  scroll: line(`<path d="M7 4 H17 Q19 4 19 6 V18 Q19 20 17 20 H7 Q5 20 5 18 V6 Q5 4 7 4 Z"/><line x1="8.5" y1="9" x2="15.5" y2="9"/><line x1="8.5" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="15" x2="13" y2="15"/>`),
  person: line(`<circle cx="12" cy="8" r="3.5"/><path d="M5 20 Q5 13 12 13 Q19 13 19 20"/>`),
  clipboard: line(`<rect x="6" y="5" width="12" height="15" rx="1.5"/><rect x="9" y="3.5" width="6" height="3" rx="1"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="14" x2="15" y2="14"/>`),
  banner: line(`<path d="M7 4 H18 L15 9 L18 14 H7 Z"/><line x1="7" y1="4" x2="7" y2="21"/>`),
  paw: solid(`<ellipse cx="12" cy="16" rx="4.2" ry="3.4"/><circle cx="6.5" cy="11" r="1.7"/><circle cx="10" cy="8" r="1.7"/><circle cx="14" cy="8" r="1.7"/><circle cx="17.5" cy="11" r="1.7"/>`),
  trophy: line(`<path d="M8 4 H16 V8 Q16 12 12 12 Q8 12 8 8 Z"/><path d="M8 6 H5 Q5 9 8 9 M16 6 H19 Q19 9 16 9"/><line x1="12" y1="12" x2="12" y2="16"/><path d="M9 19 H15 L14 16 H10 Z"/>`),
  gear: line(`<circle cx="12" cy="12" r="3"/><path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21 M5.2 5.2 L7.3 7.3 M16.7 16.7 L18.8 18.8 M18.8 5.2 L16.7 7.3 M7.3 16.7 L5.2 18.8"/>`),
  map: line(`<path d="M4 6 L9 4 L15 6 L20 4 V18 L15 20 L9 18 L4 20 Z"/><line x1="9" y1="4" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="20"/>`),
  coin: line(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>`),
  lock: line(`<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11 V8 Q8.5 4 12 4 Q15.5 4 15.5 8 V11"/>`),
  candle: line(`<rect x="10" y="9" width="4" height="11" rx="1"/><path d="M12 9 Q12 5 12 3.5 Q14.5 6 13 8.2 Q12 9 12 9"/><line x1="8.5" y1="20" x2="15.5" y2="20"/>`),
  feather: line(`<path d="M6 18 Q14 18 18 6 Q9 8 6 18 Z"/><line x1="6" y1="18" x2="11" y2="12"/>`),
  skull: line(`<path d="M6 11 Q6 5 12 5 Q18 5 18 11 Q18 14 16 15 V18 H8 V15 Q6 14 6 11 Z"/><circle cx="9.5" cy="11" r="1.5" fill="currentColor"/><circle cx="14.5" cy="11" r="1.5" fill="currentColor"/>`),
  sparkle: solid(`<path d="M12 3 L13.6 10.4 L21 12 L13.6 13.6 L12 21 L10.4 13.6 L3 12 L10.4 10.4 Z"/>`),
  peak: line(`<path d="M3 19 L9 8 L13 14 L16 9 L21 19 Z"/><path d="M7.5 11 L9 9.5 L10.5 11"/>`),
  question: line(`<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5 Q9.5 6.5 12 6.5 Q14.5 6.5 14.5 9 Q14.5 11 12 12 V14"/><circle cx="12" cy="17" r="0.9" fill="currentColor"/>`),
  boot: line(`<path d="M9 4 L13 4 L13 13 L19 15 Q21 16 21 18 L21 20 L9 20 Z"/><path d="M9 17 H21"/><path d="M3 9 H6 M2 13 H5"/>`),
};

// Every emoji that ever renders → a glyph name above.
const EMOJI: Record<string, string> = {
  "⛏️": "pickaxe", "🔨": "hammer", "🌲": "pine", "🪚": "saw", "🪤": "snare",
  "🎣": "fish", "🍳": "pot", "🌾": "wheat", "🏕️": "tent", "⚗️": "flask",
  "🏗️": "wall", "✂️": "scissors", "🎯": "target", "❤️": "heart", "⚔️": "swords",
  "💪": "dumbbell", "🛡️": "shield", "🏹": "bow", "🎒": "backpack", "📜": "scroll",
  "👤": "person", "📋": "clipboard", "🤝": "banner", "🐾": "paw", "🏆": "trophy",
  "⚙️": "gear", "🪙": "coin", "💰": "coin", "✨": "sparkle", "❓": "question",
  "🌱": "wheat", "🛠️": "hammer", "📘": "scroll", "🎓": "trophy", "🏛️": "wall",
  "🗡️": "swords", "💀": "skull", "🧰": "backpack", "👑": "trophy", "🜚": "flask",
  "🏔️": "peak", "⛰️": "peak", "✦": "sparkle", "🦜": "feather", "⚒️": "hammer",
  "🕯️": "candle", "🪶": "feather", "🗺": "map", "🗺️": "map", "🔒": "lock",
  "👟": "boot", "🥾": "boot",
};

/** A named glyph's SVG (falls back to a neutral dot if unknown). */
export function glyph(name: string): string {
  return GLYPHS[name] ?? GLYPHS.question!;
}

/**
 * Swap an emoji for its line-art glyph. If `s` isn't a known emoji it's
 * returned unchanged (so plain text and symbols like ✓ ▶ pass straight
 * through). Strips the VS16 selector so "⛏️" and "⛏" both match.
 */
export function iconize(s: string): string {
  const key = s.trim();
  const name = EMOJI[key] ?? EMOJI[key.replace(/️/g, "")];
  return name ? glyph(name) : s;
}
