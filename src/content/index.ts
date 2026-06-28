/**
 * src/content/index.ts
 * --------------------
 * Bundles all the game DATA into a single `Content` object that gets handed
 * to the core when a world is created. The core reads from this; it never
 * reaches into the individual content files itself.
 */

import type { Content } from "../core/types.ts";
import { actions } from "./actions.ts";
import { items } from "./items.ts";
import { map } from "./map.ts";
import { monsters } from "./monsters.ts";
import { quests } from "./quests.ts";
import { lore } from "./lore.ts";
import { shops } from "./shops.ts";
import { factions } from "./factions.ts";
import { achievements } from "./achievements.ts";
import { diaries } from "./diaries.ts";
import { crops } from "./crops.ts";
import { furniture } from "./furniture.ts";
import { bountyGuides, bountyShop, bountyTasks } from "./bounty.ts";
import { objects, playerSpawn } from "./spawns.ts";
import { skills } from "./skills.ts";
import { xpForLevel } from "./xpCurve.ts";

export const content: Content = {
  map,
  objects,
  items,
  monsters,
  actions,
  quests,
  lore,
  shops,
  factions,
  achievements,
  diaries,
  crops,
  furniture,
  bountyGuides,
  bountyTasks,
  bountyShop,
  xpForLevel,
  skills,
};

/** The player's starting tile, re-exported for main.ts to place them. */
export const playerStart = playerSpawn;
