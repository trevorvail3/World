/**
 * src/content/spawns.ts
 * ---------------------
 * Where every interactive object sits in the world. Pure DATA.
 *
 * The Knuckle Hills (north): Ashwood trees on the dirt grove, Knucklestone rocks
 * on the stone outcrop, fishing on the head of the Redrun, the camp stations,
 * Aldric on the path, and Moor Rats / a Hill Wolf out on the grass.
 *
 * Greyoak Wood (south): old lowland forest reached by the road. Coldpine at the
 * forest edge and wide greyoak in the deep (Forestry); Wild Boar in the
 * understory, Forest Bears deeper, and the rare Greymane Boar in the oldest
 * growth; Maret keeps the Greyoak Lodge in the clearing. (Bible §X.)
 */

import type { WorldObjectDef } from "../core/types.ts";

export const objects: WorldObjectDef[] = [
  // === THE KNUCKLE HILLS =====================================================

  // --- Trees (Forestry) on the dirt grove ---
  { id: "tree_1", kind: "tree", x: 4, y: 2, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_2", kind: "tree", x: 7, y: 3, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_3", kind: "tree", x: 3, y: 4, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },

  // --- Rocks (Mining) on the stone outcrop ---
  { id: "rock_1", kind: "rock", x: 20, y: 2, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_2", kind: "rock", x: 23, y: 3, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_3", kind: "rock", x: 21, y: 4, name: "Knucklestone Rock", resource: "mine_knucklestone" },

  // --- Fishing on the head of the Redrun (these sit on water) ---
  { id: "fish_1", kind: "fishing_spot", x: 7, y: 12, name: "Fishing Spot", resource: "fish_ashfin" },
  { id: "fish_2", kind: "fishing_spot", x: 10, y: 12, name: "Fishing Spot", resource: "fish_ashfin" },

  // --- The camp: bank chest, cooking fire, furnace, and a forge anvil ---
  { id: "bank_1", kind: "bank", x: 16, y: 10, name: "Bank Chest" },
  { id: "fire_1", kind: "fire", x: 17, y: 11, name: "Cooking Fire" },
  { id: "furnace_1", kind: "furnace", x: 18, y: 10, name: "Furnace" },
  { id: "anvil_1", kind: "anvil", x: 19, y: 11, name: "Anvil" },

  // --- Aldric, on the path ---
  {
    id: "aldric",
    kind: "npc",
    x: 14,
    y: 8,
    name: "Aldric",
    lines: [
      "You've an honest look about you. Good — there's a thing that's been gnawing at me.",
      "Found this old coin in the dirt by my wall. Old Varath mintage, struck before my grandfather's grandfather drew breath. Worn smooth — and no coin I've ever known.",
      "Here's the strange of it: the moor rats keep turning the things up in their nests. A dead king's money, in a rat's hole. Why?",
      "Humour an old man. Put one of those rats down and see what it carries. Hold a thing to study it first — then strike.",
      "Ash and knuckle, that's all these hills are. But every road in Varath starts on one like it. Follow the south road and you'll come to Greyoak.",
    ],
  },

  // --- Monsters (Combat) ---
  { id: "rat_1", kind: "monster", monster: "moor_rat", x: 19, y: 10, name: "Moor Rat" },
  { id: "rat_2", kind: "monster", monster: "moor_rat", x: 22, y: 12, name: "Moor Rat" },
  { id: "wolf_1", kind: "monster", monster: "hill_wolf", x: 24, y: 9, name: "Hill Wolf" },

  // === GREYOAK WOOD ==========================================================

  // --- Coldpine at the forest edge (Forestry 20) ---
  { id: "gw_pine_1", kind: "tree", x: 5, y: 19, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_2", kind: "tree", x: 8, y: 21, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_3", kind: "tree", x: 20, y: 19, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_4", kind: "tree", x: 22, y: 21, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_5", kind: "tree", x: 6, y: 22, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },

  // --- Wide greyoak in the deep wood (Forestry 45) ---
  { id: "gw_oak_1", kind: "tree", x: 4, y: 29, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_2", kind: "tree", x: 8, y: 31, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_3", kind: "tree", x: 21, y: 30, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_4", kind: "tree", x: 23, y: 28, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_5", kind: "tree", x: 18, y: 32, name: "Greyoak (Old Growth)", resource: "fell_greyoak", species: "greyoak" },

  // --- Maret, keeper of the Greyoak Lodge (in the clearing) ---
  {
    id: "maret",
    kind: "npc",
    x: 16,
    y: 25,
    name: "Maret",
    lines: [
      "Stranger on the Lodge road. You'll forgive the look — the wood teaches you to measure people.",
      "This is Greyoak. Old before Ironvale was a name. The boar keep to the understory; give the deep wood its distance and it gives you yours.",
      "Every season the old growth pulls back a little further. We mark the new treeline against the last. We do not ask what walks in the cleared ground.",
      "Bring an axe worth the name and the greyoak will pay you in timber. Bring less and it will only blunt you.",
    ],
  },

  // --- Boar in the understory; bears and the Greymane in the deep ---
  { id: "gw_boar_1", kind: "monster", monster: "wild_boar", x: 9, y: 21, name: "Wild Boar" },
  { id: "gw_boar_2", kind: "monster", monster: "wild_boar", x: 18, y: 22, name: "Wild Boar" },
  { id: "gw_boar_3", kind: "monster", monster: "wild_boar", x: 11, y: 28, name: "Wild Boar" },
  { id: "gw_bear_1", kind: "monster", monster: "forest_bear", x: 5, y: 30, name: "Forest Bear" },
  { id: "gw_bear_2", kind: "monster", monster: "forest_bear", x: 22, y: 32, name: "Forest Bear" },
  { id: "gw_greymane", kind: "monster", monster: "greymane_boar", x: 15, y: 32, name: "Greymane Boar" },
];

/** Where the player first appears (a path tile, next to Aldric). */
export const playerSpawn = { x: 13, y: 9 };
