/**
 * src/content/crops.ts
 * --------------------
 * The farmable crops — 12 plants and 6 trees — ported verbatim from the idle
 * game's CROPS. Pure DATA (RULE 3). `growthMs` is REAL milliseconds: a patch
 * matures in wall-clock time (even while you're away), not game ticks.
 */

import type { CropDef } from "../core/types.ts";

const MIN = 60 * 1000;
const HR = 60 * MIN;

export const crops: Record<string, CropDef> = {
  // --- Plants (herbs) ---
  ashweed: { id: "ashweed", name: "Ashweed", type: "plant", icon: "🌿", seed: "seed_ashweed", produce: "herb_ashweed", levelReq: 1, growthMs: 5 * MIN, baseChance: 0.70, xpPlant: 8, xpHarvest: 15, produceMin: 2, produceMax: 4, bonusDrop: "seed_ashweed", bonusChance: 0.15 },
  thornroot: { id: "thornroot", name: "Thornroot", type: "plant", icon: "🌿", seed: "seed_thornroot", produce: "herb_thornroot", levelReq: 5, growthMs: 12 * MIN, baseChance: 0.65, xpPlant: 14, xpHarvest: 28, produceMin: 2, produceMax: 3 },
  bloodberry: { id: "bloodberry", name: "Bloodberry", type: "plant", icon: "🍒", seed: "seed_bloodberry", produce: "herb_bloodberry", levelReq: 10, growthMs: 20 * MIN, baseChance: 0.65, xpPlant: 22, xpHarvest: 44, produceMin: 3, produceMax: 5, bonusDrop: "forage_thornberry", bonusChance: 0.20 },
  coldmoss: { id: "coldmoss", name: "Coldmoss", type: "plant", icon: "🌿", seed: "seed_coldmoss", produce: "herb_coldmoss", levelReq: 15, growthMs: 40 * MIN, baseChance: 0.60, xpPlant: 35, xpHarvest: 70, produceMin: 2, produceMax: 4 },
  ironleaf: { id: "ironleaf", name: "Ironleaf", type: "plant", icon: "🌿", seed: "seed_ironleaf", produce: "herb_ironleaf", levelReq: 20, growthMs: 60 * MIN, baseChance: 0.55, xpPlant: 52, xpHarvest: 104, produceMin: 2, produceMax: 3, bonusDrop: "bark_strip", bonusChance: 0.15 },
  greybloom: { id: "greybloom", name: "Greybloom", type: "plant", icon: "🌸", seed: "seed_greybloom", produce: "herb_greybloom", levelReq: 25, growthMs: 90 * MIN, baseChance: 0.55, xpPlant: 75, xpHarvest: 150, produceMin: 1, produceMax: 3 },
  spinethistle: { id: "spinethistle", name: "Spinethistle", type: "plant", icon: "🌿", seed: "seed_spinethistle", produce: "herb_spinethistle", levelReq: 32, growthMs: 2 * HR, baseChance: 0.50, xpPlant: 105, xpHarvest: 210, produceMin: 2, produceMax: 4 },
  ruevine: { id: "ruevine", name: "Ruevine", type: "plant", icon: "🌿", seed: "seed_ruevine", produce: "herb_ruevine", levelReq: 42, growthMs: 3 * HR, baseChance: 0.48, xpPlant: 145, xpHarvest: 290, produceMin: 2, produceMax: 3 },
  duskshade: { id: "duskshade", name: "Duskshade", type: "plant", icon: "🌿", seed: "seed_duskshade", produce: "herb_duskshade", levelReq: 52, growthMs: 4 * HR, baseChance: 0.45, xpPlant: 200, xpHarvest: 400, produceMin: 1, produceMax: 2 },
  marrowflower: { id: "marrowflower", name: "Marrowflower", type: "plant", icon: "🌸", seed: "seed_marrowflower", produce: "herb_marrowflower", levelReq: 62, growthMs: 6 * HR, baseChance: 0.40, xpPlant: 280, xpHarvest: 560, produceMin: 1, produceMax: 2 },
  hearthbloom: { id: "hearthbloom", name: "Hearthbloom", type: "plant", icon: "🌸", seed: "seed_hearthbloom", produce: "herb_hearthbloom", levelReq: 76, growthMs: 8 * HR, baseChance: 0.35, xpPlant: 380, xpHarvest: 760, produceMin: 1, produceMax: 1 },
  orunroot: { id: "orunroot", name: "Orunroot", type: "plant", icon: "🖤", seed: "seed_orunroot", produce: "herb_orunroot", levelReq: 90, growthMs: 12 * HR, baseChance: 0.25, xpPlant: 500, xpHarvest: 1000, produceMin: 1, produceMax: 1, bonusDrop: "seed_orunroot", bonusChance: 0.10 },

  // --- Trees (logs) ---
  tree_ashwood: { id: "tree_ashwood", name: "Ashwood", type: "tree", icon: "🌳", seed: "seed_ashwood", produce: "ashwood_log", levelReq: 1, growthMs: 2 * HR, baseChance: 0.60, xpPlant: 25, xpHarvest: 100, produceMin: 8, produceMax: 12, bonusDrop: "seed_coldpine", bonusChance: 0.20 },
  tree_coldpine: { id: "tree_coldpine", name: "Coldpine", type: "tree", icon: "🌲", seed: "seed_coldpine", produce: "coldpine_log", levelReq: 20, growthMs: 6 * HR, baseChance: 0.50, xpPlant: 82, xpHarvest: 330, produceMin: 8, produceMax: 12, bonusDrop: "seed_coldpine", bonusChance: 0.15 },
  tree_stonewood: { id: "tree_stonewood", name: "Stonewood", type: "tree", icon: "🌳", seed: "seed_stonewood", produce: "stonewood_log", levelReq: 30, growthMs: 8 * HR, baseChance: 0.45, xpPlant: 125, xpHarvest: 500, produceMin: 8, produceMax: 10, bonusDrop: "ironwood_sap", bonusChance: 0.20 },
  tree_greyoak: { id: "tree_greyoak", name: "Greyoak", type: "tree", icon: "🌳", seed: "seed_greyoak", produce: "greyoak_log", levelReq: 40, growthMs: 12 * HR, baseChance: 0.42, xpPlant: 180, xpHarvest: 720, produceMin: 8, produceMax: 10, bonusDrop: "greyoak_gall", bonusChance: 0.25 },
  tree_ruewood: { id: "tree_ruewood", name: "Ruewood", type: "tree", icon: "🌳", seed: "seed_ruewood", produce: "ruewood_log", levelReq: 55, growthMs: 16 * HR, baseChance: 0.38, xpPlant: 250, xpHarvest: 1000, produceMin: 6, produceMax: 10, bonusDrop: "ruewood_splinter", bonusChance: 0.30 },
  tree_deeproot: { id: "tree_deeproot", name: "Deeproot", type: "tree", icon: "🌲", seed: "seed_deeproot", produce: "deeproot_log", levelReq: 85, growthMs: 24 * HR, baseChance: 0.25, xpPlant: 460, xpHarvest: 1840, produceMin: 3, produceMax: 6, bonusDrop: "deeproot_chip", bonusChance: 0.20 },
};
