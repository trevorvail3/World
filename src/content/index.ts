/**
 * src/content/index.ts
 * --------------------
 * Bundles all the game DATA into a single `Content` object that gets handed
 * to the core when a world is created. The core reads from this; it never
 * reaches into the individual content files itself.
 */

import type { Content } from "../core/types.ts";
import { items } from "./items.ts";
import { map } from "./map.ts";
import { objects, playerSpawn } from "./spawns.ts";
import { skills } from "./skills.ts";
import { xpForLevel } from "./xpCurve.ts";

export const content: Content = {
  map,
  objects,
  items,
  xpForLevel,
  skills,
};

/** The player's starting tile, re-exported for main.ts to place them. */
export const playerStart = playerSpawn;
