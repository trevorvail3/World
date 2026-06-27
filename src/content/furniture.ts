/**
 * src/content/furniture.ts
 * ------------------------
 * Buildable housing furniture (pure DATA). Built at a home's interior
 * `build_hotspot` whose `category` matches; consumes the Construction skill's
 * own outputs (planks, frames, beams, mortar, dressed stone) and pays
 * Construction XP. This is the long-missing *sink* for Construction.
 *
 * Six interior categories, one footing each per home:
 *   bed     — a place to rest (a built bed sets your respawn to this home)
 *   kitchen — a cooking station (use it to cook, at home)
 *   storage — your bank, at home
 *   workshop— a Construction bench, at home
 *   table   — board to sit at (decor)
 *   hall    — the showpiece wall feature (decor)
 *
 * `station` makes a piece functional: "bank" opens storage; a crafting-station
 * ObjKind ("fire" to cook, "workbench" to build) opens that station's recipes.
 * `comfort` is a cosmetic "home value" tallied across a home.
 */

import type { FurnitureDef } from "../core/types.ts";

export const furniture: Record<string, FurnitureDef> = {
  // --- Bed: sets your respawn to this home -----------------------------------
  fur_bed_pallet: {
    id: "fur_bed_pallet", name: "Straw Pallet", category: "bed",
    levelReq: 1, xp: 30, comfort: 3, bed: true,
    materials: { plank_ashwood: 3 },
    blurb: "Boards and a straw tick. Sleep here and the road will carry you home to it.",
  },
  fur_bed_cot: {
    id: "fur_bed_cot", name: "Carved Cot", category: "bed",
    levelReq: 20, xp: 95, comfort: 9, bed: true,
    materials: { plank_greyoak: 4, timber_frame: 1 },
    blurb: "A framed greyoak cot with a proper headboard. A bed a body could grow old in.",
  },
  fur_bed_heartoak: {
    id: "fur_bed_heartoak", name: "Heartoak Bed", category: "bed",
    levelReq: 70, xp: 320, comfort: 20, bed: true,
    materials: { plank_heartoak: 4, heartoak_beam: 1 },
    blurb: "Heartoak, joined without a nail, dark as old wine. The bed of someone who has arrived.",
  },

  // --- Kitchen: a cooking station at home -------------------------------------
  fur_kitchen_hearth: {
    id: "fur_kitchen_hearth", name: "Cooking Hearth", category: "kitchen",
    levelReq: 1, xp: 45, comfort: 5, station: "fire",
    materials: { stone_block: 3, mortar_basic: 2 },
    blurb: "A mortared firebox with a pot-hook. Use it to cook your catch without trudging to town.",
  },
  fur_kitchen_range: {
    id: "fur_kitchen_range", name: "Kitchen Range", category: "kitchen",
    levelReq: 35, xp: 190, comfort: 15, station: "fire",
    materials: { cut_coldvein: 4, ashiron_bar: 2 },
    blurb: "An iron range with a proper flue — the heart of a real kitchen. Cooks anything the fire would.",
  },

  // --- Storage: your bank at home --------------------------------------------
  fur_store_chest: {
    id: "fur_store_chest", name: "Oak Chest", category: "storage",
    levelReq: 10, xp: 70, comfort: 6, station: "bank",
    materials: { plank_greyoak: 4, ashiron_rivet: 2 },
    blurb: "A banded greyoak chest. Opens onto the same stores as the Ironvale vault — your goods, at home.",
  },
  fur_store_strongbox: {
    id: "fur_store_strongbox", name: "Ironbound Strongbox", category: "storage",
    levelReq: 45, xp: 240, comfort: 17, station: "bank",
    materials: { plank_heartoak: 3, bloodore_bar: 2 },
    blurb: "Heartoak bound in bloodore straps. A strongbox that would shrug off a siege — and your bank besides.",
  },

  // --- Workshop: a Construction bench at home --------------------------------
  fur_shop_bench: {
    id: "fur_shop_bench", name: "Joiner's Bench", category: "workshop",
    levelReq: 15, xp: 90, comfort: 7, station: "workbench",
    materials: { plank_stonewood: 4, timber_frame: 1 },
    blurb: "A racked bench of saws and chisels. Build your Construction work right here at home.",
  },
  fur_shop_stoneworks: {
    id: "fur_shop_stoneworks", name: "Stoneworks Bench", category: "workshop",
    levelReq: 50, xp: 260, comfort: 18, station: "workbench",
    materials: { stonewood_beam: 2, mortar_spinite: 2 },
    blurb: "A mason's heavy bench, stone-topped and true. A master's station, under your own roof.",
  },

  // --- Table: a board to sit at (decor) --------------------------------------
  fur_table_trestle: {
    id: "fur_table_trestle", name: "Trestle Table", category: "table",
    levelReq: 5, xp: 50, comfort: 5,
    materials: { plank_ashwood: 4, timber_frame: 1 },
    blurb: "Planks on a knock-down frame. Sits four at a push, six if they're friendly.",
  },
  fur_table_oak: {
    id: "fur_table_oak", name: "Oak Board", category: "table",
    levelReq: 30, xp: 140, comfort: 12,
    materials: { plank_greyoak: 5, ashiron_rivet: 4 },
    blurb: "A riveted greyoak board, thick enough to dance on. It will outlast the house around it.",
  },

  // --- Hall: the showpiece wall feature (decor) ------------------------------
  fur_hall_timber: {
    id: "fur_hall_timber", name: "Timber Frame Wall", category: "hall",
    levelReq: 10, xp: 75, comfort: 8,
    materials: { timber_frame: 2, plank_stonewood: 3 },
    blurb: "An honest framed-and-boarded wall, the bones of the building made handsome.",
  },
  fur_hall_mantel: {
    id: "fur_hall_mantel", name: "Stonework Mantel", category: "hall",
    levelReq: 50, xp: 220, comfort: 16,
    materials: { stonewood_beam: 2, mortar_spinite: 3 },
    blurb: "A beamed and stone-set mantel wall — the kind of work a master leaves their mark on.",
  },
  fur_hall_gallery: {
    id: "fur_hall_gallery", name: "Vaulted Gallery", category: "hall",
    levelReq: 75, xp: 600, comfort: 30,
    materials: { vault_stone: 2, heartoak_beam: 1 },
    blurb: "Dressed vault stone over a heartoak span. Fortress-grade work, in a shepherd's home. Why not.",
  },
};

/** Furniture pieces that fit a given hotspot category, level-ordered. */
export function furnitureFor(category: string): FurnitureDef[] {
  return Object.values(furniture)
    .filter((f) => f.category === category)
    .sort((a, b) => a.levelReq - b.levelReq);
}
