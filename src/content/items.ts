/**
 * src/content/items.ts
 * --------------------
 * The item registry: every item that can exist in Varath World, as DATA.
 * The core never hard-codes item names; it looks them up here.
 */

import type { ItemDef, ItemId } from "../core/types.ts";

export const items: Record<ItemId, ItemDef> = {
  ashwood_log: {
    id: "ashwood_log",
    name: "Ashwood Log",
    description: "A pale, ash-streaked log cut from the hill trees.",
  },
  knucklestone_ore: {
    id: "knucklestone_ore",
    name: "Knucklestone Ore",
    description: "A knobbly chunk of ore prised from the grey rock.",
  },
  ashfin: {
    id: "ashfin",
    name: "Ashfin",
    description: "A soot-grey fish that haunts the cold hill pond.",
  },
  boar_hide: {
    id: "boar_hide",
    name: "Boar Hide",
    description: "The coarse, bristled hide of a Knuckle Boar.",
  },
  worn_coin: {
    id: "worn_coin",
    name: "Worn Coin",
    description: "An old coin, its face rubbed smooth by many hands.",
  },
};
