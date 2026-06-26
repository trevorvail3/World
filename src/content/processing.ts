/**
 * src/content/processing.ts
 * -------------------------
 * Recipes for the camp's processing stations. Pure DATA. Cooking turns raw
 * food into cooked food at the fire; smelting turns ore into bars at the
 * furnace. The XP values are taken from the Varath idle game.
 */

import type { Recipe } from "../core/types.ts";

export const recipes: { cooking: Recipe[]; smelting: Recipe[] } = {
  cooking: [
    { input: "ashfin_raw", output: "ashfin_cooked", xp: 30 },
    { input: "raw_rat_meat", output: "cooked_rat_meat", xp: 20 },
    { input: "raw_wolf_meat", output: "cooked_wolf_meat", xp: 40 },
  ],
  smelting: [
    { input: "knucklestone_ore", output: "knucklestone_bar", xp: 15 },
  ],
};
