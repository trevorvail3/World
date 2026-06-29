/**
 * src/client/itemIcon.ts
 * ----------------------
 * Procedural item icons. Every one of the 467 items gets a recognisable little
 * SVG sprite instead of a flat colour swatch, so they can actually be told
 * apart at a glance: a *silhouette* picked from the item's kind (ore, ingot,
 * sword, potion, ring …) tinted by a *material palette* parsed from its name
 * (Knucklestone grey, Hearthite warm-black, Bloodore red, each wood, leather
 * tier, herb, potion …). Two pickaxes of different metals now look different;
 * so do two potions, two capes, two mounts.
 *
 * Pure + deterministic (no Date/random) — the same item always draws the same
 * icon. Results are cached by id. Returned as an inline <svg> string meant to
 * be dropped into a slot's innerHTML.
 */

import type { ItemDef } from "../core/types.ts";

// ── tiny colour maths ──────────────────────────────────────────────────────
function hexRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgbHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}
function mix(hex: string, target: string, amt: number): string {
  const a = hexRgb(hex), b = hexRgb(target);
  return rgbHex(a[0] + (b[0] - a[0]) * amt, a[1] + (b[1] - a[1]) * amt, a[2] + (b[2] - a[2]) * amt);
}
function hslHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rgbHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexRgb(hex).map((v) => v / 255) as [number, number, number];
  const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0), d = mx - mn;
  const l = (mx + mn) / 2;
  let h = 0, sat = 0;
  if (d) {
    sat = d / (1 - Math.abs(2 * l - 1));
    if (mx === r0) h = ((g0 - b0) / d) % 6;
    else if (mx === g0) h = (b0 - r0) / d + 2;
    else h = (r0 - g0) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, sat * 100, l * 100];
}
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
// Nudge a fixed material colour by a small, id-stable amount so two items of the
// same material (a plank vs a beam) still differ a touch without losing the tier.
function tweak(hex: string, id: string, hA: number, sA: number, lA: number): string {
  const [h, s, l] = rgbHsl(hex);
  const r = hash(id);
  const dh = ((r % 1000) / 999 * 2 - 1) * hA;
  const ds = (((r >>> 10) % 1000) / 999 * 2 - 1) * sA;
  const dl = (((r >>> 20) % 1000) / 999 * 2 - 1) * lA;
  return hslHex(h + dh, clamp(s + ds, 0, 100), clamp(l + dl, 0, 100));
}
// A distinct colour per id within a themed band — three independent hash slices
// (hue, saturation, lightness) make accidental collisions vanishingly rare.
function hashColor(
  id: string, hueLo: number, hueSpan: number,
  satLo: number, satSpan: number, ltLo: number, ltSpan: number,
): string {
  const r = hash(id);
  return hslHex(hueLo + (r % hueSpan), satLo + ((r >>> 9) % satSpan), ltLo + ((r >>> 18) % ltSpan));
}

// ── material palettes (metals, woods, leathers — shared across an item line) ─
// First keyword found in the id+name wins, so a "Hearthite Sword" and a
// "Hearthite Bar" share the same warm-black metal.
const MATS: ReadonlyArray<readonly [string, string]> = [
  // ore / metal tiers
  ["knucklestone", "#8a8275"], ["embercite", "#3c3640"], ["ashiron", "#8b909a"],
  ["ribstone", "#c2b48f"], ["bloodore", "#a5463a"], ["hearthite", "#2f2724"],
  ["voidstone", "#4b4664"], ["gold", "#d8b24a"], ["silver", "#cfd2d8"],
  // woods
  ["ashwood", "#cdb98c"], ["briarwood", "#8a5a44"], ["coldpine", "#90a584"],
  ["stonewood", "#9a8d76"], ["greyoak", "#a7a39a"], ["ruewood", "#7a6a82"],
  ["ruevine", "#7a6a82"], ["deeproot", "#4a3d34"], ["ironbark", "#5e5a52"],
  ["heartoak", "#c98a3a"], ["duskwood", "#6a5f72"],
  // leather tiers (specific before generic)
  ["master", "#4a3526"], ["hardened", "#6a4428"], ["cured", "#8a5a36"],
  ["tanned", "#b07c4e"], ["raw_hide", "#caa07a"], ["leather", "#9a6a3e"],
];

// ── shape classification ────────────────────────────────────────────────────
type Shape =
  | "ore" | "ingot" | "log" | "board" | "shaft" | "pickaxe" | "hatchet" | "rod"
  | "sword" | "dagger" | "claymore" | "spear" | "hammer" | "bow" | "bowU"
  | "arrow" | "arrowhead" | "shield" | "helm" | "body" | "legs" | "boot" | "cape"
  | "ring" | "amulet" | "gem" | "bead" | "vial" | "herb" | "seed" | "mushroom"
  | "fish" | "meat" | "bowl" | "bread" | "hide" | "pet" | "mount" | "coin"
  | "scroll" | "key" | "trophy" | "powder" | "rivet" | "sack" | "rune";

function classify(def: ItemDef): Shape {
  const id = def.id.toLowerCase();
  const name = (def.name ?? "").toLowerCase();
  const cat = def.cat ?? "";
  const slot = def.slot;
  const s = id + " " + name;
  const has = (k: string): boolean => s.includes(k);

  // tools (mainhand, but iconic)
  if (def.tool === "pickaxe" || has("pickaxe")) return "pickaxe";
  if (def.tool === "hatchet" || has("hatchet") || (has("axe") && !has("greataxe"))) return "hatchet";
  if (def.tool === "rod" || has("fishing rod") || id.startsWith("rod_")) return "rod";

  // worn gear by slot (most reliable), with keyword refinements first
  if (slot === "ranged" || has("bow") || has("warbow")) return has("unstrung") ? "bowU" : "bow";
  // NB: match "arrow" as a whole word — otherwise "marrow", "barrow", "narrow"
  // (e.g. Marrowbone Greaves, Marrow Shard) get mis-iconed as arrows.
  if (slot === "ammo" || cat === "Arrows" || (/\barrow\b/.test(s) && !has("arrowhead"))) return "arrow";
  if (slot === "helmet" || has("helm") || id.endsWith("_hat") || has(" hat")) return "helm";
  if (slot === "offhand" || has("shield") || has("ward shield")) return "shield";
  if (slot === "cape" || cat === "Capes" || has("cape")) return "cape";
  if (slot === "ring" || id.startsWith("ring_") || id.includes("_ring") || has("ring")) return "ring";
  if (slot === "necklace" || has("neck") || has("amulet") || has("pendant")) return "amulet";
  if (slot === "mount" || cat === "Mounts") return "mount";
  if (slot === "companion" || cat.includes("Pets")) return "pet";
  if (slot === "boots" || has("boot") || has("waders")) return "boot";
  if (slot === "legs" || has("legs") || has("trousers") || has("greaves")) return "legs";
  if (
    slot === "armor" || cat.includes("Armour") || cat === "Armor" ||
    has("plate") || has("mail") || has("jacket") || has(" top") || has("cuirass") ||
    has("body")
  ) return "body";

  // weapons (mainhand, non-tool)
  if (slot === "mainhand" || cat.includes("Weapon") || cat === "Combat") {
    if (has("dagger")) return "dagger";
    if (has("claymore") || has("greatsword") || has("greataxe") || has("reaver") || has("flail")) return "claymore";
    if (has("spear")) return "spear";
    if (has("hammer") || has("mace")) return "hammer";
    return "sword";
  }

  // materials & consumables by category
  if (cat === "Ores") return "ore";
  if (cat === "Bars") return "ingot";
  if (cat === "Logs") return "log";
  if (cat === "Gems") return "gem";
  if (cat === "Glass") return has("bead") ? "bead" : "vial";
  if (cat === "Potions") return "vial";
  if (cat === "Herbs") return "herb";
  if (cat === "Seeds") return "seed";
  if (cat === "Foraged" || cat === "Forage") return has("mushroom") ? "mushroom" : "herb";
  if (cat === "Fish") return "fish";
  if (cat === "Meat") return "meat";
  if (cat === "Food") {
    if (has("stew") || has("broth") || has("chowder")) return "bowl";
    if (has("ration")) return "bread";
    if (has("smoked") || has("fish") || has("trout") || has("gill") || has("fin") || has("perch") || has("scale") || has("pike") || has("eel")) return "fish";
    if (has("meat") || has("venison") || has("aurochs") || has("roast")) return "meat";
    return "bowl";
  }
  if (cat === "Hides" || cat === "Leathers") return "hide";
  if (cat.includes("Jewellery")) return (has("neck") || has("amulet")) ? "amulet" : "ring";
  if (cat === "Heraldry") return has("cape") ? "cape" : (has("crest") || has("shield")) ? "shield" : "amulet";

  // keyword routing for Materials / Quest / Drops / Finds / misc
  if (has("hammer") || has("mace")) return "hammer";
  if (has("elixir") || has("draught") || has("tonic") || has("brew") || has("potion") || has(" tea") || has("oil")) return "vial";
  if (has("shard") || has("amber") || has("crystal") || has("scale") || has("lens")) return "gem";
  if (has("bough") || has("branch") || has("b'log")) return "log";
  if (has("arrowhead") || id.startsWith("tip_")) return "arrowhead";
  if (has("unstrung")) return "bowU";
  if (has("plank") || has("beam") || has("frame") || has("timber") || id.startsWith("cut_") || has("block") || has("vault")) return "board";
  if (has("shaft") || has("haft")) return "shaft";
  if (has("rivet")) return "rivet";
  if (has("charcoal") || has("ash ") || id.endsWith("_ash") || has("wood_ash") || has("mortar") || has("sand") || has("silica")) return "powder";
  if (has("fertilizer")) return "sack";
  if (has("leather") || has("hide") || has("pelt")) return "hide";
  if (has("seed")) return "seed";
  if (has("pearl") || has("gem")) return "gem";
  if (has("key") || has("lens") || has("cipher pendant")) return "key";
  if (has("scroll") || has("notes") || has("ledger") || has("record") || has("seal") || has("cipher") || has("pass") || has("lens")) return "scroll";
  if (has("fang") || has("tusk") || has("claw") || has("tooth") || has("skull") || has("ear") || has("tail") || has("crown") || has("trophy") || has("bone")) return "trophy";
  if (has("stone") && !has("stonewood")) return "ore";
  if (has("hook") || has("nail")) return "rivet";
  if (has("token") || has("coin") || has("badge") || has("mark") || has("sigil") || has("forge_token")) return "coin";
  if (has("fiber") || has("bark") || has("resin") || has("sap") || has("gall") || has("splinter") || has("chip") || has("nest") || has("sinew") || has("bloom") || has("root") || has("moss")) return "herb";

  return "rune";
}

// ── palette resolution ──────────────────────────────────────────────────────
interface Pal { base: string; dark: string; light: string; edge: string; accent: string; }

function shadeFrom(base: string, accent?: string): Pal {
  return {
    base,
    dark: mix(base, "#000000", 0.34),
    light: mix(base, "#ffffff", 0.42),
    edge: mix(base, "#000000", 0.58),
    accent: accent ?? mix(base, "#ffffff", 0.55),
  };
}

function paletteFor(def: ItemDef, shape: Shape): Pal {
  const id = def.id.toLowerCase();
  const name = (def.name ?? "").toLowerCase();
  const s = id + " " + name;

  // 1) shared material lines (metals, woods, leathers) — keeps a tier consistent,
  //    but nudged per-item so a plank and a beam of the same wood still differ.
  for (const [k, hex] of MATS) {
    if (s.includes(k)) {
      if (shape === "ring" || shape === "amulet") {
        return shadeFrom(tweak(hex, id, 5, 5, 5), hslHex(hash(id) % 360, 62, 56));
      }
      return shadeFrom(tweak(hex, id, 8, 8, 8));
    }
  }

  // 2) gathering gear keeps its green guild look
  if (/^(prosp|lumber|angler|farmer)/.test(id)) return shadeFrom(hashColor(id, 80, 70, 24, 22, 38, 16));

  // 3) per-shape colour bands — three hash dims (hue/sat/light) per item, so two
  //    mounts, two capes, two stews are reliably distinct from one another.
  switch (shape) {
    case "herb": return shadeFrom(hashColor(id, 80, 72, 34, 22, 32, 18));
    case "seed": return shadeFrom(hashColor(id, 24, 50, 34, 22, 42, 18));
    case "mushroom": return shadeFrom(hashColor(id, 0, 42, 34, 24, 38, 18));
    case "vial":
      return def.cat === "Glass"
        ? shadeFrom(tweak("#bcd6de", id, 30, 14, 10))
        : shadeFrom(hashColor(id, 0, 360, 48, 22, 44, 16));
    case "bead": return shadeFrom(hashColor(id, 0, 360, 38, 24, 50, 20));
    case "gem":
      return s.includes("pearl")
        ? shadeFrom("#e6e0d2", "#cfe6ec")
        : shadeFrom(hashColor(id, 175, 130, 44, 24, 44, 18));
    case "fish": return shadeFrom(hashColor(id, 182, 56, 16, 26, 44, 18));
    case "meat": return shadeFrom(hashColor(id, 0, 24, 36, 20, 40, 16));
    case "bowl": return shadeFrom(hashColor(id, 10, 40, 30, 22, 34, 16));
    case "bread": return shadeFrom(hashColor(id, 22, 26, 38, 20, 50, 16));
    case "hide": return shadeFrom(hashColor(id, 14, 34, 30, 22, 32, 18));
    case "cape": return shadeFrom(hashColor(id, 0, 360, 44, 22, 38, 16));
    case "mount": return shadeFrom(hashColor(id, 8, 44, 26, 22, 32, 18));
    case "pet": return shadeFrom(hashColor(id, 70, 100, 30, 24, 40, 18));
    case "ring":
    case "amulet": return shadeFrom(tweak("#d2b24a", id, 6, 8, 8), hslHex(hash(id) % 360, 62, 56));
    case "coin": return shadeFrom(hashColor(id, 36, 18, 48, 18, 44, 16));
    case "scroll": return shadeFrom(tweak("#d8c690", id, 12, 12, 8), hslHex(hash(id) % 360, 45, 45));
    case "key": return shadeFrom(tweak("#b89352", id, 18, 16, 12));
    case "trophy": return shadeFrom(hashColor(id, 28, 26, 12, 22, 62, 18));
    case "powder": return shadeFrom(hashColor(id, 18, 44, 6, 16, 36, 16));
    case "sack": return shadeFrom(hashColor(id, 22, 28, 28, 20, 42, 16));
    case "board":
    case "shaft": return shadeFrom(tweak("#9a7d56", id, 14, 14, 12));
    case "arrow":
    case "arrowhead": return shadeFrom(hashColor(id, 190, 50, 12, 18, 48, 18));
    default: return shadeFrom(hashColor(id, 18, 50, 12, 22, 40, 18));
  }
}

// ── shape drawing (32×32 viewBox) ───────────────────────────────────────────
const WOOD = "#7a5a3a", WOODX = "#3a2a1a";

function draw(shape: Shape, p: Pal, id: string): string {
  const r = (hash(id) % 9) - 4; // gentle per-item rotation for lumpy shapes
  switch (shape) {
    case "ore": return `<g transform="rotate(${r} 16 16)"><polygon points="6,19 9,10 17,7 25,11 26,21 17,26 9,24" fill="${p.base}" stroke="${p.edge}" stroke-width="1.2" stroke-linejoin="round"/><polygon points="9,10 17,7 18,15 11,17" fill="${p.light}"/><polygon points="18,15 25,11 26,21 19,22" fill="${p.dark}"/><circle cx="13" cy="20" r="1" fill="${p.accent}"/></g>`;
    case "ingot": return `<polygon points="6,21 26,21 28,26 4,26" fill="${p.dark}" stroke="${p.edge}" stroke-width="1"/><polygon points="9,16 23,16 26,21 6,21" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><polygon points="10,17 22,17 23,19 9,19" fill="${p.light}" opacity="0.8"/>`;
    case "log": return `<rect x="5" y="11" width="20" height="11" rx="3" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><ellipse cx="24.5" cy="16.5" rx="3" ry="5.4" fill="${p.light}" stroke="${p.edge}" stroke-width="1"/><ellipse cx="24.5" cy="16.5" rx="1.5" ry="2.8" fill="${p.dark}"/><line x1="9" y1="12.5" x2="9" y2="20.5" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/>`;
    case "board": return `<polygon points="7,9 25,12 25,23 7,20" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><line x1="8" y1="13" x2="24" y2="16" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/><line x1="8" y1="16.5" x2="24" y2="19.5" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/>`;
    case "shaft": return `<rect x="14" y="5" width="4" height="22" rx="2" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><line x1="16" y1="6" x2="16" y2="26" stroke="${p.light}" stroke-width="0.8" opacity="0.6"/>`;
    case "pickaxe": return `<rect x="14.5" y="8" width="3" height="19" rx="1.5" fill="${WOOD}" stroke="${WOODX}" stroke-width="0.6"/><path d="M5,11 Q16,6 27,11 L25,14 Q16,10 7,14 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`;
    case "hatchet": return `<rect x="14.5" y="7" width="3" height="20" rx="1.5" fill="${WOOD}" stroke="${WOODX}" stroke-width="0.6"/><path d="M17,8 Q26,9 26,16 Q26,21 17,20 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><path d="M17.5,10 Q23,11 23,16" fill="none" stroke="${p.light}" stroke-width="0.8" opacity="0.6"/>`;
    case "rod": return `<line x1="8" y1="26" x2="24" y2="6" stroke="${WOOD}" stroke-width="2.4" stroke-linecap="round"/><line x1="24" y1="6" x2="20" y2="20" stroke="${p.light}" stroke-width="0.8"/><circle cx="20" cy="21.4" r="1.5" fill="none" stroke="${p.base}" stroke-width="1"/>`;
    case "sword": return `<polygon points="16,4 18,8 18,20 14,20 14,8" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><line x1="16" y1="6" x2="16" y2="19" stroke="${p.light}" stroke-width="0.8" opacity="0.7"/><rect x="10" y="20" width="12" height="2.6" rx="1" fill="#caa24a"/><rect x="15" y="22" width="2" height="5" fill="${WOOD}"/><circle cx="16" cy="27.4" r="1.6" fill="#caa24a"/>`;
    case "dagger": return `<polygon points="16,7 18,10 18,19 14,19 14,10" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><line x1="16" y1="9" x2="16" y2="18" stroke="${p.light}" stroke-width="0.7" opacity="0.7"/><rect x="11" y="19" width="10" height="2.2" rx="1" fill="#caa24a"/><rect x="15" y="21" width="2" height="5" fill="${WOOD}"/>`;
    case "claymore": return `<polygon points="16,3 19,8 19,21 13,21 13,8" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><line x1="16" y1="5" x2="16" y2="20" stroke="${p.light}" stroke-width="1" opacity="0.6"/><rect x="8" y="21" width="16" height="2.8" rx="1" fill="#caa24a"/><rect x="15" y="23" width="2" height="6" fill="${WOOD}"/><circle cx="16" cy="29" r="1.7" fill="#caa24a"/>`;
    case "spear": return `<rect x="15" y="6" width="2" height="22" fill="${WOOD}"/><path d="M16,2 L20,9 Q16,12 12,9 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`;
    case "hammer": return `<rect x="14.8" y="10" width="2.6" height="17" rx="1" fill="${WOOD}"/><rect x="9" y="6" width="14" height="8" rx="1.5" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><rect x="10" y="7" width="12" height="2" fill="${p.light}" opacity="0.6"/>`;
    case "bow": return `<path d="M11,5 Q24,16 11,27" fill="none" stroke="${p.base}" stroke-width="2.4" stroke-linecap="round"/><line x1="11" y1="5" x2="11" y2="27" stroke="#d8cdb0" stroke-width="0.8"/>`;
    case "bowU": return `<path d="M12,5 Q23,16 12,27" fill="none" stroke="${p.base}" stroke-width="2.6" stroke-linecap="round"/>`;
    case "arrow": return `<line x1="7" y1="25" x2="24" y2="8" stroke="${WOOD}" stroke-width="1.6"/><polygon points="25,7 20,8 23,12" fill="${p.base}" stroke="${p.edge}" stroke-width="0.6"/><polygon points="7,25 11,22 11,27 7,28" fill="#b5564a"/>`;
    case "arrowhead": return `<polygon points="16,5 22,20 16,16 10,20" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><line x1="16" y1="16" x2="16" y2="27" stroke="${WOOD}" stroke-width="1.4"/>`;
    case "shield": return `<path d="M16,5 L26,8 Q26,20 16,28 Q6,20 6,8 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1.2" stroke-linejoin="round"/><line x1="16" y1="6" x2="16" y2="27" stroke="${p.dark}" stroke-width="1"/><line x1="7" y1="11" x2="25" y2="11" stroke="${p.dark}" stroke-width="1" opacity="0.6"/><circle cx="16" cy="13" r="2" fill="${p.accent}"/>`;
    case "helm": return `<path d="M8,14 Q8,7 16,7 Q24,7 24,14 L24,22 Q24,25 16,25 Q8,25 8,22 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1.2" stroke-linejoin="round"/><rect x="15" y="12" width="2" height="10" fill="${p.dark}"/><rect x="11" y="15" width="10" height="2" fill="${p.dark}"/><path d="M9,12 Q16,9 23,12" fill="none" stroke="${p.light}" stroke-width="0.8" opacity="0.6"/>`;
    case "body": return `<path d="M9,8 L13,7 Q16,9 19,7 L23,8 L24,13 L21,15 L21,24 Q16,26 11,24 L11,15 L8,13 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1.1" stroke-linejoin="round"/><line x1="16" y1="9" x2="16" y2="24" stroke="${p.dark}" stroke-width="0.8" opacity="0.6"/><path d="M11,16 Q16,18 21,16" fill="none" stroke="${p.light}" stroke-width="0.8" opacity="0.5"/>`;
    case "legs": return `<path d="M9,7 L15,7 L14,26 L10,26 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><path d="M17,7 L23,7 L22,26 L18,26 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><rect x="9" y="7" width="14" height="3" rx="1" fill="${p.dark}"/>`;
    case "boot": return `<path d="M11,6 L16,6 L16,20 L24,20 L24,26 L11,26 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><rect x="11" y="24" width="13" height="2.6" fill="${p.dark}"/>`;
    case "cape": return `<path d="M11,7 Q16,5 21,7 L24,26 Q16,23 8,26 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1.1" stroke-linejoin="round"/><path d="M13,8 Q16,7 19,8 L20,11 Q16,10 12,11 Z" fill="${p.dark}"/><line x1="16" y1="8" x2="16" y2="24" stroke="${p.light}" stroke-width="0.7" opacity="0.5"/>`;
    case "ring": return `<circle cx="16" cy="19" r="7" fill="none" stroke="${p.base}" stroke-width="3"/><circle cx="16" cy="19" r="7" fill="none" stroke="${p.light}" stroke-width="0.8"/><polygon points="16,5 20,10 16,14 12,10" fill="${p.accent}" stroke="${p.edge}" stroke-width="0.6"/>`;
    case "amulet": return `<path d="M9,7 Q16,18 23,7" fill="none" stroke="#caa24a" stroke-width="1.4"/><polygon points="16,13 21,18 16,26 11,18" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><circle cx="16" cy="18.5" r="2" fill="${p.accent}"/>`;
    case "gem": return `<polygon points="16,5 25,13 16,28 7,13" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><polygon points="16,5 25,13 16,16 7,13" fill="${p.light}"/><polygon points="7,13 16,16 16,28" fill="${p.dark}"/><line x1="11" y1="13" x2="16" y2="28" stroke="${p.edge}" stroke-width="0.5" opacity="0.5"/>`;
    case "bead": return `<circle cx="16" cy="17" r="8" fill="${p.base}" opacity="0.7" stroke="${p.edge}" stroke-width="1"/><ellipse cx="13" cy="14" rx="2.4" ry="3.4" fill="#ffffff" opacity="0.4"/>`;
    case "vial": return `<path d="M13,9 L19,9 L23,20 Q23,28 16,28 Q9,28 9,20 Z" fill="#cfe0e6" opacity="0.32" stroke="#9fb4bc" stroke-width="1"/><path d="M11,18 Q16,16 21,18 L22,21 Q16,29 10,21 Z" fill="${p.base}"/><ellipse cx="13" cy="22" rx="1.4" ry="2" fill="${p.light}" opacity="0.6"/><rect x="13" y="4" width="6" height="6" rx="1" fill="#cfe0e6" opacity="0.45" stroke="${p.edge}" stroke-width="0.5"/><rect x="12.5" y="3" width="7" height="2.6" rx="1" fill="${WOOD}"/>`;
    case "herb": return `<path d="M16,28 Q15,18 16,8" fill="none" stroke="#5a6a2a" stroke-width="1.6"/><path d="M16,20 Q9,18 8,12 Q15,13 16,18 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="0.6"/><path d="M16,16 Q23,14 24,8 Q17,9 16,14 Z" fill="${p.light}" stroke="${p.edge}" stroke-width="0.6"/><path d="M16,11 Q12,8 13,4 Q17,6 16,10 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="0.6"/>`;
    case "seed": return `<ellipse cx="13" cy="18" rx="3" ry="5" transform="rotate(-20 13 18)" fill="${p.base}" stroke="${p.edge}" stroke-width="0.8"/><ellipse cx="19" cy="15" rx="2.6" ry="4.4" transform="rotate(25 19 15)" fill="${p.light}" stroke="${p.edge}" stroke-width="0.8"/><ellipse cx="17" cy="22" rx="2.4" ry="4" transform="rotate(10 17 22)" fill="${p.dark}" stroke="${p.edge}" stroke-width="0.8"/>`;
    case "mushroom": return `<rect x="14" y="16" width="4" height="10" rx="1.5" fill="#e6dcc4" stroke="${p.edge}" stroke-width="0.8"/><path d="M7,16 Q7,8 16,8 Q25,8 25,16 Q16,19 7,16 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="13" r="1.3" fill="#ffffff" opacity="0.7"/><circle cx="19" cy="12" r="1" fill="#ffffff" opacity="0.6"/>`;
    case "fish": return `<path d="M5,16 Q12,8 22,12 Q26,14 26,16 Q26,18 22,20 Q12,24 5,16 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><polygon points="5,16 1,11 2,16 1,21" fill="${p.dark}"/><circle cx="21" cy="15" r="1.3" fill="#1a1a1a"/><path d="M14,11 Q16,16 14,21" fill="none" stroke="${p.dark}" stroke-width="0.7" opacity="0.6"/>`;
    case "meat": return `<line x1="9" y1="22" x2="14" y2="17" stroke="#efe6d4" stroke-width="3.2" stroke-linecap="round"/><circle cx="8.5" cy="22.5" r="2.2" fill="#efe6d4"/><circle cx="11" cy="20" r="2.2" fill="#efe6d4"/><ellipse cx="18" cy="13" rx="8" ry="7.5" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><ellipse cx="15" cy="10" rx="2.5" ry="2" fill="${p.light}" opacity="0.55"/>`;
    case "bowl": return `<path d="M5,15 Q16,13 27,15 Q25,25 16,25 Q7,25 5,15 Z" fill="#7a5236" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><ellipse cx="16" cy="15" rx="11" ry="3" fill="${p.base}"/><circle cx="12" cy="15" r="1.2" fill="${p.light}"/><circle cx="19" cy="14.5" r="1" fill="${p.dark}"/>`;
    case "bread": return `<path d="M6,18 Q6,11 16,11 Q26,11 26,18 Q26,23 16,23 Q6,23 6,18 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><line x1="11" y1="13" x2="9" y2="21" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/><line x1="16" y1="12.5" x2="16" y2="22" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/><line x1="21" y1="13" x2="23" y2="21" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/>`;
    case "hide": return `<path d="M16,5 Q21,7 20,12 Q26,14 24,19 Q26,24 20,24 Q18,28 16,24 Q14,28 12,24 Q6,24 8,19 Q6,14 12,12 Q11,7 16,5 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><ellipse cx="16" cy="16" rx="4" ry="6" fill="${p.light}" opacity="0.4"/>`;
    case "pet": return `<ellipse cx="16" cy="20" rx="8" ry="7" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><circle cx="16" cy="12" r="5.5" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><polygon points="11,8 12.5,13 14,10" fill="${p.dark}"/><polygon points="21,8 19.5,13 18,10" fill="${p.dark}"/><circle cx="14" cy="12" r="1" fill="#1a1a1a"/><circle cx="18" cy="12" r="1" fill="#1a1a1a"/><circle cx="16" cy="14" r="0.9" fill="${p.dark}"/>`;
    case "mount": return `<path d="M10,27 L10,16 Q9,11 13,8 L14,4 L16,8 Q22,9 22,16 L21,27 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><polygon points="13,9 11,4 14.5,8" fill="${p.dark}"/><circle cx="17" cy="12" r="1" fill="#1a1a1a"/><path d="M13,8 Q10,12 11,18" fill="none" stroke="${p.dark}" stroke-width="1.4"/>`;
    case "coin": return `<circle cx="16" cy="16" r="10" fill="${p.base}" stroke="${p.edge}" stroke-width="1.2"/><circle cx="16" cy="16" r="7.5" fill="none" stroke="${p.dark}" stroke-width="0.8"/><polygon points="16,10 18,15 23,15 19,18 21,23 16,20 11,23 13,18 9,15 14,15" fill="${p.light}" opacity="0.85"/>`;
    case "scroll": return `<rect x="9" y="7" width="14" height="18" rx="1" fill="#e3d4a8" stroke="#9a7a4a" stroke-width="1"/><rect x="7" y="6" width="18" height="3" rx="1.5" fill="${p.accent}"/><rect x="7" y="23" width="18" height="3" rx="1.5" fill="${p.accent}"/><line x1="12" y1="12" x2="20" y2="12" stroke="#9a7a4a" stroke-width="0.8"/><line x1="12" y1="15" x2="20" y2="15" stroke="#9a7a4a" stroke-width="0.8"/><line x1="12" y1="18" x2="18" y2="18" stroke="#9a7a4a" stroke-width="0.8"/>`;
    case "key": return `<circle cx="11" cy="12" r="5" fill="none" stroke="${p.base}" stroke-width="2.4"/><circle cx="11" cy="12" r="1.6" fill="${p.dark}"/><line x1="14" y1="15" x2="23" y2="24" stroke="${p.base}" stroke-width="2.4"/><line x1="20" y1="21" x2="23" y2="18" stroke="${p.base}" stroke-width="2.4"/>`;
    case "trophy": return `<path d="M12,6 Q20,7 21,14 Q21,24 16,27 Q11,24 11,14 Q11,9 12,6 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><path d="M14,9 Q15,16 16,24" fill="none" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/>`;
    case "powder": return `<path d="M6,24 Q16,13 26,24 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="22" r="1" fill="${p.dark}"/><circle cx="16" cy="20" r="1" fill="${p.light}"/><circle cx="20" cy="22.5" r="1" fill="${p.dark}"/>`;
    case "rivet": return `<circle cx="16" cy="10" r="5" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><polygon points="13,13 19,13 17,26 15,26" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><ellipse cx="14" cy="9" rx="1.6" ry="1" fill="${p.light}" opacity="0.6"/>`;
    case "sack": return `<path d="M9,12 Q9,9 16,9 Q23,9 23,12 L24,24 Q24,27 16,27 Q8,27 8,24 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><path d="M11,11 Q16,7 21,11" fill="none" stroke="${p.dark}" stroke-width="1.4"/><line x1="16" y1="16" x2="16" y2="23" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/>`;
    case "rune": return `<polygon points="16,4 19,13 28,16 19,19 16,28 13,19 4,16 13,13" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><circle cx="16" cy="16" r="2.5" fill="${p.light}"/>`;
  }
}

// ── public API ──────────────────────────────────────────────────────────────
const cache = new Map<string, string>();

/** Inline SVG markup for an item's icon (cached, deterministic). */
export function itemIconSVG(def: ItemDef): string {
  const hit = cache.get(def.id);
  if (hit) return hit;
  const shape = classify(def);
  const pal = paletteFor(def, shape);
  const svg =
    `<svg viewBox="0 0 32 32" class="item-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    draw(shape, pal, def.id) +
    `</svg>`;
  cache.set(def.id, svg);
  return svg;
}
