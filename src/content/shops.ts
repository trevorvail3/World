/**
 * src/content/shops.ts
 * --------------------
 * The Ironvale market. Pure DATA (RULE 3). Each shop lists what its keeper
 * SELLS to you (a bundle of `qty` units for `price` gold). You can SELL anything
 * back at the market for its own `sell` value (items.ts) at any counter.
 *
 * Prices are faithful to the idle game:
 *   - The General Store stock and prices are the canon `generalStoreHTML` list,
 *     verbatim.
 *   - Other counters price each item at round(sell × 1.3) — the buy/sell markup
 *     the canon store prices imply (≈1.25–1.33). Every buy price is kept above
 *     the item's sell value, so there is no buy-low/sell-high arbitrage.
 */

import type { ShopDef } from "../core/types.ts";

export const shops: ShopDef[] = [
  {
    id: "shop_general",
    npc: "shop_quartermaster",
    name: "Ironvale General Store",
    greeting: "Hespa's counter — tools, seeds and sundries. Sell me your odds and ends, too.",
    stock: [
      // Canon generalStoreHTML stock + prices, exactly.
      { item: "plant_fiber", price: 15, qty: 1 },
      { item: "ashwood_shaft", price: 80, qty: 10 },
      { item: "embercite_ore", price: 90, qty: 5 },
      { item: "seed_ashweed", price: 20, qty: 3 },
      { item: "seed_thornroot", price: 38, qty: 3 },
      { item: "seed_bloodberry", price: 69, qty: 3 },
      { item: "seed_coldmoss", price: 108, qty: 3 },
      { item: "seed_ashwood", price: 60, qty: 3 },
      // Higher Farming/Herblore seeds — these had no source before, so the herb
      // line above Coldmoss (and the brews that need those herbs) was unreachable.
      { item: "seed_ironleaf", price: 150, qty: 2 },
      { item: "seed_greybloom", price: 220, qty: 2 },
      { item: "seed_spinethistle", price: 320, qty: 2 },
      { item: "seed_ruevine", price: 480, qty: 2 },
      { item: "seed_duskshade", price: 700, qty: 2 },
      { item: "seed_marrowflower", price: 1000, qty: 2 },
      { item: "seed_hearthbloom", price: 1500, qty: 2 },
      { item: "seed_orunroot", price: 2200, qty: 2 },
      { item: "fertilizer_basic", price: 55, qty: 1 },
      { item: "forage_mushroom", price: 52, qty: 5 },
      // Glass for Herblore — tinctures take a small vial, full brews a flask
      // (blow your own once Crafting's glassblowing is open; buy them meanwhile).
      { item: "glass_vial", price: 25, qty: 2 },
      { item: "glass_flask", price: 45, qty: 1 },
      // Starter gathering tools (round(sell × 1.3)).
      { item: "pickaxe_1", price: 20, qty: 1 },
      { item: "hatchet_1", price: 20, qty: 1 },
      { item: "rod_1", price: 65, qty: 1 },
      { item: "pickaxe_3", price: 104, qty: 1 },
      { item: "hatchet_3", price: 104, qty: 1 },
      // Better rods (Woodcraft makes its own once that bench is open).
      { item: "rod_2", price: 130, qty: 1 },
      { item: "rod_3", price: 240, qty: 1 },
    ],
  },
  {
    id: "shop_armoury",
    npc: "shop_armourer",
    name: "Doran's Armoury",
    greeting: "Ashforge seconds and field steel, tiers I through III. The heavy stuff you forge yourself. Sell me your scrap, too.",
    // A tiered ladder of weapons and armour, priced at round(sell × 1.3). Higher
    // tiers (VI/IX/X) are left to the forge and to drops.
    stock: [
      // --- Tier I — Knucklestone (combat 1) ---
      { item: "dagger_1", price: 26, qty: 1 },
      { item: "sword_1", price: 33, qty: 1 },
      { item: "hammer_1", price: 36, qty: 1 },
      { item: "spear_1", price: 36, qty: 1 },
      { item: "claymore_1", price: 42, qty: 1 },
      { item: "shield_1", price: 33, qty: 1 },
      { item: "helm_1", price: 26, qty: 1 },
      { item: "armor_1", price: 46, qty: 1 },
      { item: "legs_1", price: 33, qty: 1 },
      { item: "boot_1", price: 16, qty: 1 },
      // --- Tier III — Ashiron (combat 20) ---
      { item: "sword_3", price: 169, qty: 1 },
      { item: "hammer_3", price: 189, qty: 1 },
      { item: "claymore_3", price: 215, qty: 1 },
      { item: "shield_3", price: 150, qty: 1 },
      { item: "helm_3", price: 124, qty: 1 },
      { item: "armor_3", price: 234, qty: 1 },
      { item: "legs_3", price: 150, qty: 1 },
      { item: "boot_3", price: 72, qty: 1 },
      // --- Tier IV — Ribstone (combat 30) ---
      { item: "sword_4", price: 325, qty: 1 },
      { item: "claymore_4", price: 416, qty: 1 },
      { item: "shield_4", price: 254, qty: 1 },
      { item: "helm_4", price: 208, qty: 1 },
      { item: "armor_4", price: 449, qty: 1 },
      { item: "legs_4", price: 254, qty: 1 },
      { item: "boot_4", price: 117, qty: 1 },
    ],
  },
  {
    id: "shop_goblin",
    npc: "shop_trader",
    name: "Skritt's Sundries",
    greeting: "Heh. Goblin prices — better than honest, worse than fair. Skritt buys the warm stone, mind.",
    // A goblin's odd lot. He'll buy anything off you, especially Shards of Orun.
    stock: [
      { item: "crude_shortbow", price: 26, qty: 1 },
      { item: "arrow_knucklestone", price: 390, qty: 25 },
      { item: "ring_1", price: 46, qty: 1 },
      { item: "plant_fiber", price: 16, qty: 1 },
      { item: "battle_ration", price: 65, qty: 1 },
    ],
  },
  {
    id: "shop_capes",
    npc: "cape_master",
    name: "The Hall of Capes",
    greeting: "Bring a skill to ninety-nine and its cape is yours — a million gold, and well earned. Master every one, and the Cape of Varath is your right.",
    // Mastery rewards: one cape per skill at level 99, and the all-99 max cape.
    // The core gates each purchase on the level requirement (and all-99 for Varath).
    stock: [
      { item: "cape_mining", price: 1000000, qty: 1 },
      { item: "cape_smithing", price: 1000000, qty: 1 },
      { item: "cape_forestry", price: 1000000, qty: 1 },
      { item: "cape_woodcraft", price: 1000000, qty: 1 },
      { item: "cape_hunter", price: 1000000, qty: 1 },
      { item: "cape_fishing", price: 1000000, qty: 1 },
      { item: "cape_cooking", price: 1000000, qty: 1 },
      { item: "cape_farming", price: 1000000, qty: 1 },
      { item: "cape_survivalist", price: 1000000, qty: 1 },
      { item: "cape_herblore", price: 1000000, qty: 1 },
      { item: "cape_construction", price: 1000000, qty: 1 },
      { item: "cape_crafting", price: 1000000, qty: 1 },
      { item: "cape_bounty", price: 1000000, qty: 1 },
      { item: "cape_agility", price: 1000000, qty: 1 },
      { item: "cape_vitality", price: 1000000, qty: 1 },
      { item: "cape_edge", price: 1000000, qty: 1 },
      { item: "cape_vigour", price: 1000000, qty: 1 },
      { item: "cape_ward", price: 1000000, qty: 1 },
      { item: "cape_draw", price: 1000000, qty: 1 },
      { item: "cape_max", price: 1000000, qty: 1 },
    ],
  },
];
