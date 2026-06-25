/**
 * src/content/spawns.ts
 * ---------------------
 * Where every interactive object sits in The Knuckle Hills. Pure DATA.
 *
 * Coordinates are tile positions and are chosen to line up with the art in
 * map.ts: trees on the dirt grove, rocks on the stone outcrop, fishing spots
 * on the pond's edge, Aldric on the path, and the boar out on the grass.
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

  // --- Fishing spots on the pond edge (these sit on water) ---
  { id: "fish_1", kind: "fishing_spot", x: 7, y: 12, name: "Fishing Spot" },
  { id: "fish_2", kind: "fishing_spot", x: 10, y: 12, name: "Fishing Spot" },

  // --- NPC ---
  { id: "aldric", kind: "npc", x: 14, y: 8, name: "Aldric" },

  // --- Monster (Combat) ---
  { id: "boar_1", kind: "monster", x: 20, y: 10, name: "Knuckle Boar" },
];

/** Where the player first appears (a path tile, next to Aldric). */
export const playerSpawn = { x: 13, y: 9 };
