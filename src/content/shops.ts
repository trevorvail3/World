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
    // Canon generalStoreHTML stock + prices, exactly.
    stock: [
      { item: "plant_fiber", price: 15, qty: 1 },
      { item: "ashwood_shaft", price: 80, qty: 10 },
      { item: "embercite_ore", price: 90, qty: 5 },
      { item: "seed_ashweed", price: 20, qty: 3 },
      { item: "seed_thornroot", price: 38, qty: 3 },
      { item: "fertilizer_basic", price: 55, qty: 1 },
      { item: "forage_mushroom", price: 52, qty: 5 },
    ],
  },
  {
    id: "shop_armoury",
    npc: "shop_armourer",
    name: "Doran's Armoury",
    greeting: "Ashforge seconds and starter steel. Buy a kit, or sell me your battlefield scrap.",
    // Tier-1 starter gear, priced at round(sell × 1.3).
    stock: [
      { item: "dagger_1", price: 26, qty: 1 },
      { item: "hammer_1", price: 36, qty: 1 },
      { item: "claymore_1", price: 42, qty: 1 },
      { item: "shield_1", price: 33, qty: 1 },
      { item: "helm_1", price: 26, qty: 1 },
      { item: "armor_1", price: 46, qty: 1 },
      { item: "legs_1", price: 33, qty: 1 },
      { item: "boot_1", price: 16, qty: 1 },
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
      { item: "plant_fiber", price: 16, qty: 1 },
      { item: "battle_ration", price: 65, qty: 1 },
    ],
  },
];
