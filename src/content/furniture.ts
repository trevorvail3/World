/**
 * src/content/furniture.ts
 * ------------------------
 * Buildable housing furniture (pure DATA). Each piece is built at a homestead
 * `build_hotspot` whose `category` matches, consuming the Construction skill's
 * own outputs (planks, frames, beams, mortar, dressed stone) and paying
 * Construction XP. This is the long-missing *sink* for Construction: the planks
 * and beams you mill now have a home to go into.
 *
 * Four categories, one hotspot each per plot:
 *   hearth — the home's fire        bed   — a place to rest (sets your respawn)
 *   table  — board to sit and eat   hall  — the showpiece wall feature
 *
 * `comfort` is a cosmetic "home value" tallied across a homestead. A `bed`
 * piece additionally moves the player's respawn point to that homestead.
 */

import type { FurnitureDef } from "../core/types.ts";

export const furniture: Record<string, FurnitureDef> = {
  // --- Hearth: the home fire -------------------------------------------------
  fur_hearth_cobble: {
    id: "fur_hearth_cobble", name: "Cobble Hearth", category: "hearth",
    levelReq: 1, xp: 40, comfort: 4,
    materials: { stone_block: 3, mortar_basic: 2 },
    blurb: "A rough ring of mortared stone. Smoke-stained within a week, and all the homelier for it.",
  },
  fur_hearth_ribstone: {
    id: "fur_hearth_ribstone", name: "Ribstone Hearth", category: "hearth",
    levelReq: 40, xp: 180, comfort: 12,
    materials: { cut_coldvein: 4, mortar_refined: 3 },
    blurb: "A deep coldvein firebox that throws heat to the rafters. The mark of a settled house.",
  },

  // --- Bed: sets your respawn to this homestead ------------------------------
  fur_bed_pallet: {
    id: "fur_bed_pallet", name: "Straw Pallet", category: "bed",
    levelReq: 1, xp: 30, comfort: 3, bed: true,
    materials: { plank_ashwood: 3 },
    blurb: "Boards and a straw tick. Not much — but sleep here and the road will carry you back to it.",
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

  // --- Table: a board to sit at ----------------------------------------------
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

  // --- Hall: the showpiece wall feature --------------------------------------
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
    blurb: "Dressed vault stone over a heartoak span. Fortress-grade work, in a shepherd's croft. Why not.",
  },
};

/** Furniture pieces that fit a given hotspot category, level-ordered. */
export function furnitureFor(category: string): FurnitureDef[] {
  return Object.values(furniture)
    .filter((f) => f.category === category)
    .sort((a, b) => a.levelReq - b.levelReq);
}
