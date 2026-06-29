/**
 * src/client/gearLook.ts
 * ----------------------
 * Turns a player's worn equipment into a render-ready "gear look" the avatar can
 * draw: which slots show metal plate, what colour the metal is (by material
 * tier), the cape colour, and the held weapon's shape + metal. The mapping lives
 * here so the avatar renderer stays about *drawing*, not item rules.
 *
 * Tier drives the metal colour on the canon 1–10 material ladder. Most gear ids
 * end in `_<tier>` (armor_3, helm_3, shield_3…); we fall back to that when an
 * item omits an explicit `tier`.
 */

import type { Content, EquipSlot, ItemDef, ItemId } from "../core/types.ts";

export interface Metal { base: string; edge: string }
export interface GearLook {
  helmet?: Metal;
  body?: Metal;
  legs?: Metal;
  boots?: Metal;
  shield?: Metal;
  weapon?: Metal & { type: string };
  cape?: { color: string };
}

// The material ladder, tier 1 → 10: bronze, iron, steel, dark steel, silvered,
// mithril-blue, jade, adamant-green, rune-cyan, dragon-crimson.
const TIER_METAL: Metal[] = [
  { base: "#a9712f", edge: "#cf9350" }, // 1 bronze
  { base: "#6f7178", edge: "#9498a0" }, // 2 iron
  { base: "#9aa0ab", edge: "#c6ccd6" }, // 3 steel
  { base: "#5d676f", edge: "#869098" }, // 4 dark steel
  { base: "#b7c0ca", edge: "#e6edf4" }, // 5 silvered
  { base: "#44608d", edge: "#7193cc" }, // 6 mithril
  { base: "#2f7d72", edge: "#54b9a6" }, // 7 jade
  { base: "#2f7d49", edge: "#56bd72" }, // 8 adamant
  { base: "#2f8fb0", edge: "#62c9e2" }, // 9 rune
  { base: "#9e2f26", edge: "#e0a23a" }, // 10 dragon
];

// A small spread of cloth colours for capes that aren't the master/legendary one.
const CAPE_PALETTE = [
  "#7a3a3a", "#3a5a7a", "#4f7a3a", "#6a4a7a", "#2f6b66", "#9a5a2a", "#6b6157", "#8a3060",
];

function tierOf(item: ItemDef): number {
  if (typeof item.tier === "number") return item.tier;
  const m = /_(\d+)$/.exec(item.id);
  return m ? Number(m[1]) : 1;
}

function metalOf(item: ItemDef): Metal {
  const t = Math.max(1, Math.min(10, tierOf(item)));
  return TIER_METAL[t - 1]!;
}

function capeColor(item: ItemDef): string {
  if (/varath|master|legend/i.test(item.id)) return "#e8c45a"; // gold for the grandmaster cape
  let h = 0;
  for (let i = 0; i < item.id.length; i++) h = (h * 31 + item.id.charCodeAt(i)) >>> 0;
  return CAPE_PALETTE[h % CAPE_PALETTE.length]!;
}

/** Resolve worn equipment into the visuals the avatar should layer on. */
export function resolveGear(
  eq: Partial<Record<EquipSlot, ItemId>>,
  content: Content,
): GearLook {
  const get = (slot: EquipSlot): ItemDef | undefined => {
    const id = eq[slot];
    return id ? content.items[id] : undefined;
  };
  const out: GearLook = {};
  const helm = get("helmet"); if (helm) out.helmet = metalOf(helm);
  const body = get("armor"); if (body) out.body = metalOf(body);
  const legs = get("legs"); if (legs) out.legs = metalOf(legs);
  const boots = get("boots"); if (boots) out.boots = metalOf(boots);
  const shield = get("offhand"); if (shield) out.shield = metalOf(shield);
  const cape = get("cape"); if (cape) out.cape = { color: capeColor(cape) };
  // A real weapon shows in hand; gathering tools (which carry `tool`) don't.
  const main = get("mainhand");
  if (main && !main.tool) out.weapon = { ...metalOf(main), type: main.wepType ?? "sword" };
  return out;
}
