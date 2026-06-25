/**
 * src/content/monsters.ts
 * -----------------------
 * Combat stats and loot tables for the Knuckle Hills monsters, ported from
 * the Varath idle game. Pure DATA — the core reads these to run combat.
 *
 * Canon: the Knuckle Hills are home to the Moor Rat and the Hill Wolf. (Boars
 * belong to Greyoak Wood, a later zone.) Both carry the vanishingly rare
 * Shard of Orun, the world's load-bearing relic.
 */

import type { MonsterStats } from "../core/types.ts";

export const monsters: Record<string, MonsterStats> = {
  moor_rat: {
    id: "moor_rat",
    name: "Moor Rat",
    level: 1,
    hp: 5,
    maxHit: 1,
    xp: 8,
    desc: "A bristling, overgrown rat of the hill moors. More nuisance than threat.",
    drops: [
      { item: "raw_rat_meat", chance: 1.0 },
      { item: "raw_hide", chance: 0.4 },
      { item: "rat_tail", chance: 0.25 },
      { item: "worn_coin", chance: 0.05, min: 1, max: 3 },
      { item: "shard_of_orun", chance: 0.001 },
    ],
  },
  hill_wolf: {
    id: "hill_wolf",
    name: "Hill Wolf",
    level: 5,
    hp: 14,
    maxHit: 3,
    xp: 18,
    desc: "A lean grey wolf that hunts the Knuckle Hills in the cold months. Quick and wary.",
    drops: [
      { item: "raw_wolf_meat", chance: 1.0 },
      { item: "wolf_pelt", chance: 0.5 },
      { item: "wolf_fang", chance: 0.1 },
      { item: "worn_coin", chance: 0.05, min: 1, max: 4 },
      { item: "shard_of_orun", chance: 0.001 },
    ],
  },
};
