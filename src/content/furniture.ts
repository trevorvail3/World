/**
 * src/content/furniture.ts
 * ------------------------
 * Buildable housing furniture (pure DATA) — the heart of player housing, and
 * the Construction skill's great sink. Built at a home's interior
 * `build_hotspot` whose `category` matches; consumes materials drawn from the
 * whole crafting economy (planks, beams, mortar, dressed stone, bars, leather,
 * pelts, glass, gems, gold) and pays Construction XP.
 *
 * ELEVEN categories, one footing each per home. Every category is a TIER LADDER:
 * each tier needs a higher Construction level, costs more and richer materials,
 * looks better, and is worth more `comfort` (a "home value" tallied per home).
 *
 *   bed     — sets your respawn here          kitchen — cook station ("fire")
 *   forge   — smith station ("anvil")         alchemy — brew station ("cauldron")
 *   storage — your bank ("bank")              workshop— build station ("workbench")
 *   table · seating · hall · lighting · display — décor and showpieces.
 *
 * `station` makes a piece functional; `bed` sets respawn; `light` makes the
 * piece glow at night (a lit home). Build the dream house: a master can stand
 * a heartoak canopy bed, a grand range, an ashforge anvil, a crystal
 * chandelier and a display case of trophies all under one roof.
 */

import type { FurnitureDef } from "../core/types.ts";

export const furniture: Record<string, FurnitureDef> = {
  // ===== BED — sets your respawn to this home ================================
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
  fur_bed_feather: {
    id: "fur_bed_feather", name: "Feather Bed", category: "bed",
    levelReq: 45, xp: 210, comfort: 18, bed: true,
    materials: { plank_ironbark: 4, cured_leather: 3, wolf_pelt: 2 },
    blurb: "Down ticking on an ironbark frame, dressed in pelts. You will not want to rise.",
  },
  fur_bed_canopy: {
    id: "fur_bed_canopy", name: "Heartoak Canopy Bed", category: "bed",
    levelReq: 75, xp: 360, comfort: 32, bed: true,
    materials: { plank_heartoak: 5, heartoak_beam: 1, master_leather: 2, cut_gem: 2 },
    blurb: "Heartoak posts, drawn drapes, gem-headed nails. The bed of someone who has truly arrived.",
  },

  // ===== KITCHEN — a cooking station at home ("fire") =======================
  fur_kitchen_hearth: {
    id: "fur_kitchen_hearth", name: "Cooking Hearth", category: "kitchen",
    levelReq: 1, xp: 45, comfort: 5, station: "fire",
    materials: { stone_block: 3, mortar_basic: 2 },
    blurb: "A mortared firebox with a pot-hook. Cook your catch without trudging to town.",
  },
  fur_kitchen_range: {
    id: "fur_kitchen_range", name: "Kitchen Range", category: "kitchen",
    levelReq: 35, xp: 190, comfort: 15, station: "fire",
    materials: { cut_coldvein: 4, ashiron_bar: 2 },
    blurb: "An iron range with a proper flue — the heart of a real kitchen.",
  },
  fur_kitchen_grand: {
    id: "fur_kitchen_grand", name: "Grand Range", category: "kitchen",
    levelReq: 65, xp: 330, comfort: 26, station: "fire",
    materials: { cut_ribstone: 4, mortar_spinite: 3, hearthite_bar: 2 },
    blurb: "A double-hearthed range banked with hearthite that never quite goes cold. Feeds a feast.",
  },

  // ===== FORGE — a smithing station at home ("anvil") =======================
  fur_forge_anvil: {
    id: "fur_forge_anvil", name: "Stone Anvil", category: "forge",
    levelReq: 25, xp: 150, comfort: 10, station: "anvil",
    materials: { stone_block: 4, ashiron_bar: 3 },
    blurb: "A bench anvil bedded in dressed stone. Beat out your own gear by your own fire.",
  },
  fur_forge_ashforge: {
    id: "fur_forge_ashforge", name: "Ashforge Anvil", category: "forge",
    levelReq: 60, xp: 320, comfort: 22, station: "anvil",
    materials: { cut_coldvein: 4, bloodore_bar: 3, hearthite_bar: 1 },
    blurb: "Brotherhood-pattern work — a hearthite-set anvil that rings true. A master smiths at home.",
  },

  // ===== ALCHEMY — a brewing station at home ("cauldron") ===================
  fur_alch_cauldron: {
    id: "fur_alch_cauldron", name: "Herbalist's Cauldron", category: "alchemy",
    levelReq: 30, xp: 160, comfort: 11, station: "cauldron",
    materials: { knucklestone_bar: 3, glass_vial: 4 },
    blurb: "A black pot on a trivet, racked with vials. Brew your draughts at your own coals.",
  },
  fur_alch_still: {
    id: "fur_alch_still", name: "Alchemist's Still", category: "alchemy",
    levelReq: 65, xp: 330, comfort: 24, station: "cauldron",
    materials: { ashiron_bar: 3, glass_flask: 4, cut_gem: 1 },
    blurb: "Copper coil and glasswork, a gem in the condenser. The brews come out cleaner and stronger.",
  },

  // ===== STORAGE — your bank, at home ("bank") ==============================
  fur_store_chest: {
    id: "fur_store_chest", name: "Oak Chest", category: "storage",
    levelReq: 10, xp: 70, comfort: 6, station: "bank",
    materials: { plank_greyoak: 4, ashiron_rivet: 2 },
    blurb: "A banded greyoak chest. Opens onto the same stores as the Ironvale vault.",
  },
  fur_store_strongbox: {
    id: "fur_store_strongbox", name: "Ironbound Strongbox", category: "storage",
    levelReq: 45, xp: 240, comfort: 17, station: "bank",
    materials: { plank_heartoak: 3, bloodore_bar: 2 },
    blurb: "Heartoak bound in bloodore straps. A strongbox that would shrug off a siege.",
  },
  fur_store_vault: {
    id: "fur_store_vault", name: "Vault Cabinet", category: "storage",
    levelReq: 80, xp: 420, comfort: 30, station: "bank",
    materials: { vault_stone: 2, voidstone_bar: 2, cut_gem: 1 },
    blurb: "Vault-stone and voidsteel, gem-locked. Nothing leaves this but by your own hand.",
  },

  // ===== WORKSHOP — a Construction bench at home ("workbench") ===============
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
    blurb: "A mason's heavy bench, stone-topped and true. A master's station under your own roof.",
  },
  fur_shop_master: {
    id: "fur_shop_master", name: "Master's Workshop", category: "workshop",
    levelReq: 85, xp: 500, comfort: 30, station: "workbench",
    materials: { heartoak_beam: 2, vault_stone: 1, master_leather: 1 },
    blurb: "Every tool a builder dreams of, racked and oiled. The finest work begins here.",
  },

  // ===== TABLE — a board to sit at (décor) ==================================
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
    blurb: "A riveted greyoak board, thick enough to dance on. It will outlast the house.",
  },
  fur_table_banquet: {
    id: "fur_table_banquet", name: "Banquet Table", category: "table",
    levelReq: 60, xp: 300, comfort: 24,
    materials: { plank_heartoak: 6, gold_bar: 2 },
    blurb: "A heartoak banquet board inlaid with gold. Set it, and the hall expects guests.",
  },

  // ===== SEATING — chairs and benches (décor) ===============================
  fur_seat_stools: {
    id: "fur_seat_stools", name: "Joint Stools", category: "seating",
    levelReq: 5, xp: 40, comfort: 3,
    materials: { plank_ashwood: 2 },
    blurb: "A pair of three-legged stools. Honest, hard, and they never wobble for long.",
  },
  fur_seat_settle: {
    id: "fur_seat_settle", name: "Settle Bench", category: "seating",
    levelReq: 25, xp: 120, comfort: 9,
    materials: { plank_greyoak: 3, cured_leather: 2 },
    blurb: "A high-backed settle with a padded seat — the warmest chair by the fire.",
  },
  fur_seat_armchairs: {
    id: "fur_seat_armchairs", name: "Carved Armchairs", category: "seating",
    levelReq: 55, xp: 280, comfort: 20,
    materials: { plank_ironbark: 3, master_leather: 2, bear_pelt: 1 },
    blurb: "Deep ironbark armchairs in master leather, a bearskin thrown across. Sink in and stay.",
  },

  // ===== HALL — the showpiece wall feature (décor) ==========================
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
    blurb: "Dressed vault stone over a heartoak span. Fortress-grade work, in a home. Why not.",
  },

  // ===== LIGHTING — lamps that light the home at night (décor) ===============
  fur_light_candles: {
    id: "fur_light_candles", name: "Candle Stand", category: "lighting",
    levelReq: 5, xp: 40, comfort: 4, light: true,
    materials: { knucklestone_bar: 1, plank_ashwood: 1 },
    blurb: "A floor stand of tallow candles. Modest light, and a smell of warm wax.",
  },
  fur_light_sconces: {
    id: "fur_light_sconces", name: "Iron Sconces", category: "lighting",
    levelReq: 30, xp: 150, comfort: 10, light: true,
    materials: { ashiron_bar: 2, glass_bead: 3 },
    blurb: "Glass-shaded iron sconces that throw a steady, even glow across the room.",
  },
  fur_light_chandelier: {
    id: "fur_light_chandelier", name: "Crystal Chandelier", category: "lighting",
    levelReq: 70, xp: 360, comfort: 28, light: true,
    materials: { gold_bar: 2, cut_gem: 3, glass_bead: 6 },
    blurb: "A gold ring hung with cut crystal. It scatters the candlelight into a hundred sparks.",
  },

  // ===== DISPLAY — trophies and curios, the home's pride (décor) =============
  fur_disp_shelf: {
    id: "fur_disp_shelf", name: "Curio Shelf", category: "display",
    levelReq: 15, xp: 80, comfort: 6,
    materials: { plank_greyoak: 3, glass_bead: 2 },
    blurb: "A glazed shelf for the small finds of a wandering life. Everyone studies it.",
  },
  fur_disp_trophy: {
    id: "fur_disp_trophy", name: "Trophy Mount", category: "display",
    levelReq: 40, xp: 190, comfort: 14,
    materials: { plank_ironbark: 2, bear_pelt: 1, greymane_pelt: 1 },
    blurb: "Pelts and a mounted skull on a board. The hunters who visit will want the story.",
  },
  fur_disp_case: {
    id: "fur_disp_case", name: "Display Case", category: "display",
    levelReq: 70, xp: 360, comfort: 26,
    materials: { glass_flask: 4, gold_bar: 2, cut_gem: 2 },
    blurb: "A gold-framed glass case, lit from within. Whatever you set in it looks like treasure.",
  },
};

/** Furniture pieces that fit a given hotspot category, level-ordered. */
export function furnitureFor(category: string): FurnitureDef[] {
  return Object.values(furniture)
    .filter((f) => f.category === category)
    .sort((a, b) => a.levelReq - b.levelReq);
}
