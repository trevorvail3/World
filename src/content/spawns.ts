/**
 * src/content/spawns.ts
 * ---------------------
 * Where every interactive object sits in The Knuckle Hills. Pure DATA.
 *
 * Canon-aligned: Ashwood trees on the dirt grove, Knucklestone rocks on the
 * stone outcrop, fishing on the head of the Redrun, Aldric on the path, and
 * Moor Rats / a Hill Wolf out on the grass.
 */

import type { WorldObjectDef } from "../core/types.ts";

export const objects: WorldObjectDef[] = [
  // --- Trees (Forestry) on the dirt grove ---
  { id: "tree_1", kind: "tree", x: 4, y: 2, name: "Ashwood Tree" },
  { id: "tree_2", kind: "tree", x: 7, y: 3, name: "Ashwood Tree" },
  { id: "tree_3", kind: "tree", x: 3, y: 4, name: "Ashwood Tree" },

  // --- Rocks (Mining) on the stone outcrop ---
  { id: "rock_1", kind: "rock", x: 20, y: 2, name: "Knucklestone Rock" },
  { id: "rock_2", kind: "rock", x: 23, y: 3, name: "Knucklestone Rock" },
  { id: "rock_3", kind: "rock", x: 21, y: 4, name: "Knucklestone Rock" },

  // --- Fishing on the head of the Redrun (these sit on water) ---
  { id: "fish_1", kind: "fishing_spot", x: 7, y: 12, name: "Fishing Spot" },
  { id: "fish_2", kind: "fishing_spot", x: 10, y: 12, name: "Fishing Spot" },

  // --- The camp: bank chest, cooking fire, and a smelting furnace ---
  { id: "bank_1", kind: "bank", x: 16, y: 10, name: "Bank Chest" },
  { id: "fire_1", kind: "fire", x: 17, y: 11, name: "Cooking Fire" },
  { id: "furnace_1", kind: "furnace", x: 18, y: 10, name: "Furnace" },

  // --- NPC ---
  { id: "aldric", kind: "npc", x: 14, y: 8, name: "Aldric" },

  // --- Monsters (Combat) ---
  { id: "rat_1", kind: "monster", monster: "moor_rat", x: 19, y: 10, name: "Moor Rat" },
  { id: "rat_2", kind: "monster", monster: "moor_rat", x: 22, y: 12, name: "Moor Rat" },
  { id: "wolf_1", kind: "monster", monster: "hill_wolf", x: 24, y: 9, name: "Hill Wolf" },
];

/** Where the player first appears (a path tile, next to Aldric). */
export const playerSpawn = { x: 13, y: 9 };
