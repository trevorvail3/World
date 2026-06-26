/**
 * src/content/forging.ts
 * ----------------------
 * Smithing recipes for the anvil. Pure DATA. Each turns a number of
 * Knucklestone Bars into one piece of gear and grants Smithing XP. Costs and
 * XP rise with how much metal the piece needs, mirroring the Varath idle game.
 */

import type { ForgeRecipe } from "../core/types.ts";

export const forging: ForgeRecipe[] = [
  { output: "dagger_1", input: "knucklestone_bar", count: 1, xp: 25 },
  { output: "helm_1", input: "knucklestone_bar", count: 2, xp: 45 },
  { output: "shield_1", input: "knucklestone_bar", count: 3, xp: 70 },
  { output: "armor_1", input: "knucklestone_bar", count: 5, xp: 120 },
];
