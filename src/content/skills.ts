/**
 * src/content/skills.ts
 * ---------------------
 * Player-facing skill metadata, named and ordered per the Varath idle game's
 * `SKILLS` + `COMBAT_SKILLS` (the full 18-skill registry). Display names and
 * icon glyphs are copied from canon.
 *
 * Some skills (farming, construction, bounty) are registered here so they show
 * in the panel, but their interactions land in later bundles — see the
 * CANON_LEDGER. The order matches the idle game's SKILL_ORDER + COMBAT_ORDER.
 */

import type { SkillId } from "../core/types.ts";

export const skills: Record<SkillId, { name: string; icon: string }> = {
  // --- The 13 trainable (gathering + processing) skills ---
  mining: { name: "Mining", icon: "⛏️" },
  smithing: { name: "Smithing", icon: "🔨" },
  forestry: { name: "Forestry", icon: "🌲" },
  woodcraft: { name: "Woodcraft", icon: "🪚" },
  hunter: { name: "Hunter", icon: "🪤" },
  fishing: { name: "Fishing", icon: "🎣" },
  cooking: { name: "Cooking", icon: "🍳" },
  farming: { name: "Farming", icon: "🌾" },
  survivalist: { name: "Survivalist", icon: "🏕️" },
  herblore: { name: "Herblore", icon: "⚗️" },
  construction: { name: "Construction", icon: "🏗️" },
  crafting: { name: "Crafting", icon: "✂️" },
  bounty: { name: "Bounty", icon: "🎯" },
  // --- The 5 combat skills ---
  vitality: { name: "Vitality", icon: "❤️" },
  edge: { name: "Edge", icon: "⚔️" },
  vigour: { name: "Vigour", icon: "💪" },
  ward: { name: "Ward", icon: "🛡️" },
  draw: { name: "Draw", icon: "🏹" },
};
