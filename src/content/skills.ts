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

// Each skill carries a short blurb — how you train it, and what levelling it
// gives you — shown at the top of its detail popup so a newcomer can tell at a
// glance what the skill is for.
export const skills: Record<SkillId, { name: string; icon: string; blurb: string }> = {
  // --- The 13 trainable (gathering + processing) skills ---
  mining: { name: "Mining", icon: "⛏️", blurb: "Swing a pickaxe at rock seams to win ore. Higher Mining lets you work richer, tougher veins — and mine them faster." },
  smithing: { name: "Smithing", icon: "🔨", blurb: "Smelt ore into bars at a furnace, then hammer bars into tools, weapons and armour at an anvil. Higher Smithing unlocks stronger metals and gear." },
  forestry: { name: "Forestry", icon: "🌲", blurb: "Chop trees for logs. Higher Forestry opens denser woods and fells them quicker." },
  woodcraft: { name: "Woodcraft", icon: "🪚", blurb: "Saw logs into planks, bows and tackle at a workbench. Higher Woodcraft unlocks finer wooden goods." },
  hunter: { name: "Hunter", icon: "🪤", blurb: "Lay traps and snares for beasts to take hides, sinew and meat. Higher Hunter catches rarer, wilier quarry." },
  fishing: { name: "Fishing", icon: "🎣", blurb: "Fish at marked spots for a raw catch. Higher Fishing lands bigger fish from harder waters." },
  cooking: { name: "Cooking", icon: "🍳", blurb: "Cook raw food at a fire or range into meals that heal you. Higher Cooking unlocks heartier dishes — and burns fewer of them." },
  firemaking: { name: "Firemaking", icon: "🔥", blurb: "Strike flint against logs to light campfires wherever you stand. Higher Firemaking burns tougher logs for more experience — and a fire to cook at." },
  farming: { name: "Farming", icon: "🌾", blurb: "Sow seeds in tilled patches and return when they ripen. Higher Farming unlocks better crops and trees with richer yields." },
  survivalist: { name: "Survivalist", icon: "🏕️", blurb: "Forage the wilds for herbs and field goods. Higher Survivalist turns up scarcer, more valuable finds." },
  herblore: { name: "Herblore", icon: "⚗️", blurb: "Brew gathered herbs into potions at a cauldron. Higher Herblore unlocks stronger, longer-lasting brews." },
  construction: { name: "Construction", icon: "🏗️", blurb: "Build and upgrade the furniture and rooms of your house from materials. Higher Construction unlocks grander, finer fittings." },
  crafting: { name: "Crafting", icon: "✂️", blurb: "Cut gems, tan leather and make jewellery and kit. Higher Crafting unlocks more intricate, valuable pieces." },
  bounty: { name: "Bounty", icon: "🎯", blurb: "Take slay-tasks from a Bounty board and fill them for Hunt Marks. Higher Bounty offers tougher contracts and better rewards." },
  agility: { name: "Agility", icon: "👟", blurb: "Trained simply by running. The more ground you sprint, the longer your wind lasts and the faster your energy recovers." },
  // --- The 5 combat skills ---
  vitality: { name: "Vitality", icon: "❤️", blurb: "Your life force. Trained by taking hits in combat; each level raises your maximum Hitpoints." },
  edge: { name: "Edge", icon: "⚔️", blurb: "Melee accuracy. Trained on the Edge attack style — raises your chance to land blows." },
  vigour: { name: "Vigour", icon: "💪", blurb: "Melee power. Trained on the Vigour attack style — raises the damage your hits deal." },
  ward: { name: "Ward", icon: "🛡️", blurb: "Melee defence. Trained on the Ward attack style — lowers your chance of being hit." },
  draw: { name: "Draw", icon: "🏹", blurb: "Archery. Trained by attacking with a bow — raises your ranged accuracy and damage." },
  faith: { name: "Devotion", icon: "🔮", blurb: "Magic and prayer, fused. Trained by fighting with a staff and by burying bones. Raises your casting power and your Grace pool — the fuel for spells, refilled at shrines and altars. Each level adds one to your Grace." },
};
