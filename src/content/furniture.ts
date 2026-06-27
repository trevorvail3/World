/**
 * src/content/furniture.ts
 * ------------------------
 * Buildable housing furniture (pure DATA) — the great Construction sink and the
 * reward loop of player housing. EVERY piece is part of an upgrade ladder: a
 * category climbs from rough wood up through carved wood, worked metal/stone,
 * and finally gold/crystal — each tier needs a higher Construction level, costs
 * more and richer materials, is worth more `comfort`, and looks visibly better.
 *
 * Categories (one+ footing each, spread across the home's rooms):
 *   bed · table · seating · rug · lighting · display · hall  — décor (4 tiers)
 *   kitchen · storage · workshop · forge · alchemy           — stations (3 tiers)
 *
 * `station` makes a piece functional (cook/bank/build/forge/brew at home);
 * `bed` sets your respawn; `light` glows at night; `rug` is a floor covering
 * you walk over (its footing doesn't block).
 */

import type { FurnitureDef } from "../core/types.ts";

export const furniture: Record<string, FurnitureDef> = {
  // ===== BED — sets your respawn ============================================
  fur_bed_pallet: { id: "fur_bed_pallet", name: "Straw Pallet", category: "bed", levelReq: 1, xp: 30, comfort: 3, bed: true, materials: { plank_ashwood: 3 }, blurb: "Boards and a straw tick. Sleep here and the road carries you home." },
  fur_bed_wood: { id: "fur_bed_wood", name: "Wooden Bed", category: "bed", levelReq: 25, xp: 110, comfort: 11, bed: true, materials: { plank_greyoak: 4, cured_leather: 2 }, blurb: "A solid greyoak bed with a leather-strung frame. A proper night's rest." },
  fur_bed_carved: { id: "fur_bed_carved", name: "Carved Bed", category: "bed", levelReq: 50, xp: 250, comfort: 20, bed: true, materials: { plank_ironbark: 4, hardened_leather: 3, wolf_pelt: 2 }, blurb: "Ironbark, carved and pelt-dressed. The bed of a settled, prosperous house." },
  fur_bed_canopy: { id: "fur_bed_canopy", name: "Heartoak Canopy Bed", category: "bed", levelReq: 75, xp: 380, comfort: 34, bed: true, materials: { plank_heartoak: 5, heartoak_beam: 1, master_leather: 2, cut_gem: 2 }, blurb: "Heartoak posts, drawn drapes, gem-headed nails. The bed of someone who has arrived." },

  // ===== TABLE — décor ======================================================
  fur_table_wood: { id: "fur_table_wood", name: "Wooden Table", category: "table", levelReq: 1, xp: 45, comfort: 4, materials: { plank_ashwood: 4 }, blurb: "Four planks and four legs. Sits the household, and takes a knife-scar without complaint." },
  fur_table_carved: { id: "fur_table_carved", name: "Carved Table", category: "table", levelReq: 25, xp: 130, comfort: 11, materials: { plank_greyoak: 5, ashiron_rivet: 2 }, blurb: "Greyoak with turned legs and a carved apron. Handsome enough to keep clean." },
  fur_table_iron: { id: "fur_table_iron", name: "Iron-Bound Table", category: "table", levelReq: 50, xp: 240, comfort: 19, materials: { plank_ironbark: 5, ashiron_bar: 3 }, blurb: "Ironbark on iron straps — a banquet board that won't warp in a hundred winters." },
  fur_table_gold: { id: "fur_table_gold", name: "Golden Table", category: "table", levelReq: 75, xp: 400, comfort: 30, materials: { plank_heartoak: 6, gold_bar: 3, cut_gem: 1 }, blurb: "Heartoak inlaid with gold and a single set gem. Set it, and the hall expects kings." },

  // ===== SEATING — décor ====================================================
  fur_seat_stool: { id: "fur_seat_stool", name: "Wooden Stools", category: "seating", levelReq: 1, xp: 35, comfort: 3, materials: { plank_ashwood: 2 }, blurb: "Three-legged stools. Honest, hard, and they never wobble for long." },
  fur_seat_chair: { id: "fur_seat_chair", name: "Carved Chairs", category: "seating", levelReq: 25, xp: 120, comfort: 9, materials: { plank_greyoak: 3, cured_leather: 2 }, blurb: "High-backed greyoak chairs with leather seats. You can sit out a long evening in them." },
  fur_seat_armchair: { id: "fur_seat_armchair", name: "Padded Armchairs", category: "seating", levelReq: 50, xp: 250, comfort: 18, materials: { plank_ironbark: 3, hardened_leather: 2, bear_pelt: 1 }, blurb: "Deep armchairs in hardened leather, a bearskin thrown over. Sink in and stay." },
  fur_seat_throne: { id: "fur_seat_throne", name: "Gilded Throne", category: "seating", levelReq: 75, xp: 400, comfort: 30, materials: { plank_heartoak: 4, gold_bar: 2, master_leather: 2 }, blurb: "A gold-leafed throne in master leather. Sit in it and try not to give orders." },

  // ===== RUG — a floor covering you walk over (footing doesn't block) ========
  fur_rug_hide: { id: "fur_rug_hide", name: "Hide Mat", category: "rug", levelReq: 1, xp: 30, comfort: 3, materials: { raw_hide: 2 }, blurb: "A pegged-out hide. Keeps the cold of the boards off your feet, just." },
  fur_rug_woven: { id: "fur_rug_woven", name: "Woven Rug", category: "rug", levelReq: 20, xp: 100, comfort: 9, materials: { tanned_leather: 2, glass_bead: 2 }, blurb: "A patterned rug worked in dyed wool and bead. The first thing a guest remarks on." },
  fur_rug_fur: { id: "fur_rug_fur", name: "Fur Carpet", category: "rug", levelReq: 45, xp: 200, comfort: 17, materials: { bear_pelt: 2, greymane_pelt: 1 }, blurb: "Bear and greymane pelts seamed into one great carpet. Warm as a hearth underfoot." },
  fur_rug_plush: { id: "fur_rug_plush", name: "Plush Carpet", category: "rug", levelReq: 70, xp: 320, comfort: 28, materials: { silver_wolf_pelt: 2, master_leather: 1, cut_gem: 1 }, blurb: "Silver-wolf plush bordered in gem-stitched leather. You'll feel guilty walking on it." },

  // ===== LIGHTING — glows at night ==========================================
  fur_light_candle: { id: "fur_light_candle", name: "Candle Stand", category: "lighting", levelReq: 1, xp: 35, comfort: 4, light: true, materials: { knucklestone_bar: 1, plank_ashwood: 1 }, blurb: "A floor stand of tallow candles. Modest light, and the smell of warm wax." },
  fur_light_knuckle: { id: "fur_light_knuckle", name: "Knucklestone Lamp", category: "lighting", levelReq: 25, xp: 120, comfort: 10, light: true, materials: { knucklestone_bar: 3, glass_bead: 2 }, blurb: "A cast lamp with a glass chimney — a steady, even flame that doesn't gutter." },
  fur_light_iron: { id: "fur_light_iron", name: "Iron Chandelier", category: "lighting", levelReq: 50, xp: 240, comfort: 18, light: true, materials: { ashiron_bar: 3, glass_bead: 4 }, blurb: "A wrought-iron ring of lamps hung from the beam. Lights the whole room at a stroke." },
  fur_light_gold: { id: "fur_light_gold", name: "Gold Lamp", category: "lighting", levelReq: 75, xp: 380, comfort: 30, light: true, materials: { gold_bar: 2, cut_gem: 3, glass_bead: 4 }, blurb: "A gold standard hung with cut crystal. It scatters the flame into a hundred sparks." },

  // ===== DISPLAY — trophies and curios ======================================
  fur_disp_shelf: { id: "fur_disp_shelf", name: "Curio Shelf", category: "display", levelReq: 1, xp: 40, comfort: 4, materials: { plank_greyoak: 2, glass_bead: 1 }, blurb: "A glazed shelf for the small finds of a wandering life. Everyone studies it." },
  fur_disp_trophy: { id: "fur_disp_trophy", name: "Trophy Mount", category: "display", levelReq: 30, xp: 150, comfort: 12, materials: { plank_ironbark: 2, bear_pelt: 1, greymane_pelt: 1 }, blurb: "Pelts and a mounted skull on a board. The hunters who visit will want the story." },
  fur_disp_cabinet: { id: "fur_disp_cabinet", name: "Glass Cabinet", category: "display", levelReq: 55, xp: 260, comfort: 20, materials: { plank_heartoak: 3, glass_flask: 3, ashiron_bar: 1 }, blurb: "A glazed heartoak cabinet. Whatever you shelve in it suddenly looks important." },
  fur_disp_case: { id: "fur_disp_case", name: "Gold Display Case", category: "display", levelReq: 75, xp: 380, comfort: 30, materials: { glass_flask: 4, gold_bar: 2, cut_gem: 2 }, blurb: "A gold-framed glass case, lit from within. Whatever you set in it looks like treasure." },

  // ===== HALL — the showpiece wall feature ==================================
  fur_hall_plaster: { id: "fur_hall_plaster", name: "Plastered Wall", category: "hall", levelReq: 1, xp: 40, comfort: 4, materials: { mortar_basic: 3, plank_ashwood: 2 }, blurb: "Lime-plastered and lined out — a plain wall made tidy and bright." },
  fur_hall_timber: { id: "fur_hall_timber", name: "Timber Frame Wall", category: "hall", levelReq: 25, xp: 130, comfort: 11, materials: { timber_frame: 2, plank_stonewood: 3 }, blurb: "An honest framed-and-boarded wall, the bones of the building made handsome." },
  fur_hall_mantel: { id: "fur_hall_mantel", name: "Stonework Mantel", category: "hall", levelReq: 50, xp: 240, comfort: 19, materials: { stonewood_beam: 2, mortar_spinite: 3 }, blurb: "A beamed and stone-set mantel wall — the kind of work a master signs." },
  fur_hall_gallery: { id: "fur_hall_gallery", name: "Vaulted Gallery", category: "hall", levelReq: 75, xp: 620, comfort: 32, materials: { vault_stone: 2, heartoak_beam: 1, gold_bar: 1 }, blurb: "Dressed vault stone over a gilded heartoak span. Fortress-grade work, in a home." },

  // ===== KITCHEN — cook station ("fire") ====================================
  fur_kitchen_hearth: { id: "fur_kitchen_hearth", name: "Cooking Hearth", category: "kitchen", levelReq: 1, xp: 45, comfort: 5, station: "fire", materials: { stone_block: 3, mortar_basic: 2 }, blurb: "A mortared firebox with a pot-hook. Cook your catch without trudging to town." },
  fur_kitchen_range: { id: "fur_kitchen_range", name: "Iron Range", category: "kitchen", levelReq: 35, xp: 190, comfort: 15, station: "fire", materials: { cut_coldvein: 4, ashiron_bar: 2 }, blurb: "An iron range with a proper flue — the heart of a real kitchen." },
  fur_kitchen_grand: { id: "fur_kitchen_grand", name: "Grand Range", category: "kitchen", levelReq: 65, xp: 330, comfort: 26, station: "fire", materials: { cut_ribstone: 4, mortar_spinite: 3, hearthite_bar: 2 }, blurb: "A double-hearthed range banked with hearthite that never quite cools. Feeds a feast." },

  // ===== STORAGE — your bank ("bank") =======================================
  fur_store_chest: { id: "fur_store_chest", name: "Oak Chest", category: "storage", levelReq: 10, xp: 70, comfort: 6, station: "bank", materials: { plank_greyoak: 4, ashiron_rivet: 2 }, blurb: "A banded greyoak chest. Opens onto the same stores as the Ironvale vault." },
  fur_store_strongbox: { id: "fur_store_strongbox", name: "Ironbound Strongbox", category: "storage", levelReq: 45, xp: 240, comfort: 17, station: "bank", materials: { plank_heartoak: 3, bloodore_bar: 2 }, blurb: "Heartoak bound in bloodore straps. A strongbox that would shrug off a siege." },
  fur_store_vault: { id: "fur_store_vault", name: "Gold Vault", category: "storage", levelReq: 80, xp: 420, comfort: 30, station: "bank", materials: { vault_stone: 2, gold_bar: 2, cut_gem: 1 }, blurb: "Vault stone and a gold-set door. Nothing leaves it but by your own hand." },

  // ===== WORKSHOP — Construction bench ("workbench") =========================
  fur_shop_bench: { id: "fur_shop_bench", name: "Joiner's Bench", category: "workshop", levelReq: 15, xp: 90, comfort: 7, station: "workbench", materials: { plank_stonewood: 4, timber_frame: 1 }, blurb: "A racked bench of saws and chisels. Build your Construction work at home." },
  fur_shop_stoneworks: { id: "fur_shop_stoneworks", name: "Stoneworks Bench", category: "workshop", levelReq: 50, xp: 260, comfort: 18, station: "workbench", materials: { stonewood_beam: 2, mortar_spinite: 2 }, blurb: "A mason's heavy bench, stone-topped and true. A master's station under your roof." },
  fur_shop_master: { id: "fur_shop_master", name: "Master's Workshop", category: "workshop", levelReq: 85, xp: 500, comfort: 30, station: "workbench", materials: { heartoak_beam: 2, vault_stone: 1, master_leather: 1 }, blurb: "Every tool a builder dreams of, racked and oiled. The finest work begins here." },

  // ===== FORGE — smithing station ("anvil") =================================
  fur_forge_stone: { id: "fur_forge_stone", name: "Stone Anvil", category: "forge", levelReq: 25, xp: 150, comfort: 10, station: "anvil", materials: { stone_block: 4, ashiron_bar: 3 }, blurb: "A bench anvil bedded in dressed stone. Beat out your own gear by your own fire." },
  fur_forge_iron: { id: "fur_forge_iron", name: "Iron Anvil", category: "forge", levelReq: 45, xp: 230, comfort: 17, station: "anvil", materials: { ashiron_bar: 5, cut_coldvein: 2 }, blurb: "A full-size iron anvil on an oak stump. It rings clean and true under the hammer." },
  fur_forge_ashforge: { id: "fur_forge_ashforge", name: "Ashforge Anvil", category: "forge", levelReq: 60, xp: 320, comfort: 24, station: "anvil", materials: { cut_coldvein: 4, bloodore_bar: 3, hearthite_bar: 1 }, blurb: "Brotherhood-pattern work — a hearthite-set anvil that a master smiths at." },

  // ===== ALCHEMY — brewing station ("cauldron") =============================
  fur_alch_cauldron: { id: "fur_alch_cauldron", name: "Herbalist's Cauldron", category: "alchemy", levelReq: 30, xp: 160, comfort: 11, station: "cauldron", materials: { knucklestone_bar: 3, glass_vial: 4 }, blurb: "A black pot on a trivet, racked with vials. Brew your draughts at your own coals." },
  fur_alch_still: { id: "fur_alch_still", name: "Alchemist's Still", category: "alchemy", levelReq: 55, xp: 280, comfort: 20, station: "cauldron", materials: { ashiron_bar: 3, glass_flask: 4, cut_gem: 1 }, blurb: "Copper coil and glasswork, a gem in the condenser. The brews come out cleaner." },
  fur_alch_alembic: { id: "fur_alch_alembic", name: "Grand Alembic", category: "alchemy", levelReq: 80, xp: 420, comfort: 30, station: "cauldron", materials: { gold_bar: 2, glass_flask: 6, cut_gem: 2 }, blurb: "Gold-jointed glass and a gem manifold. Alchemy as the old masters meant it." },
};

/** Furniture pieces that fit a given hotspot category, level-ordered. */
export function furnitureFor(category: string): FurnitureDef[] {
  return Object.values(furniture)
    .filter((f) => f.category === category)
    .sort((a, b) => a.levelReq - b.levelReq);
}

/** A home-comfort "rating" title, the visible reward for furnishing a home. */
export function comfortTitle(comfort: number): string {
  if (comfort >= 280) return "a Palace";
  if (comfort >= 190) return "an Estate";
  if (comfort >= 120) return "a Manor";
  if (comfort >= 60) return "a Fine Home";
  if (comfort >= 25) return "a Cottage";
  if (comfort > 0) return "a Hovel";
  return "bare";
}
