/**
 * src/content/items.ts
 * --------------------
 * The item registry. Names, ids and flavour text are taken from the Varath
 * idle game's source so the two games describe the same objects identically.
 */

import type { ItemDef, ItemId } from "../core/types.ts";

export const items: Record<ItemId, ItemDef> = {
  ashwood_log: {
    id: "ashwood_log",
    name: "Ashwood Log",
    description: "Pale and light. Common as dirt across Varath. Burns fast; works fast.",
  },
  knucklestone_ore: {
    id: "knucklestone_ore",
    name: "Knucklestone",
    description:
      "The most common stone of the Knuckle Hills. Soft and grey-brown, worked easily by any hand.",
  },
  knucklestone_bar: {
    id: "knucklestone_bar",
    name: "Knucklestone Bar",
    description:
      "Brittle but workable. A beginner's first bar, smelted from the grey stone of the Knuckle Hills.",
  },
  ashfin_raw: {
    id: "ashfin_raw",
    name: "Raw Ashfin",
    description:
      "Small and silver. Every child in Varath has caught one. Barely worth cleaning alone.",
  },
  ashfin_cooked: {
    id: "ashfin_cooked",
    name: "Cooked Ashfin",
    description: "Barely a meal, but warm. Better than nothing on a cold night.",
    heals: 10,
  },
  raw_rat_meat: {
    id: "raw_rat_meat",
    name: "Raw Rat Meat",
    description: "Stringy and gamey. It cooks up edible, if you're hungry enough.",
  },
  cooked_rat_meat: {
    id: "cooked_rat_meat",
    name: "Cooked Rat Meat",
    description: "Charred and chewy. It fills a hollow belly and little else.",
    heals: 6,
  },
  raw_hide: {
    id: "raw_hide",
    name: "Raw Hide",
    description: "An untreated animal hide. The tannery turns these into leather.",
  },
  rat_tail: {
    id: "rat_tail",
    name: "Rat Tail",
    description: "A long, scaly tail. Some apothecaries ask no questions and pay coin.",
  },
  raw_wolf_meat: {
    id: "raw_wolf_meat",
    name: "Raw Wolf Meat",
    description: "Lean, dark meat. Tough, but it keeps a hunter going.",
  },
  cooked_wolf_meat: {
    id: "cooked_wolf_meat",
    name: "Cooked Wolf Meat",
    description: "Dark and rich over the coals. A proper meal for a long day.",
    heals: 14,
  },
  wolf_pelt: {
    id: "wolf_pelt",
    name: "Wolf Pelt",
    description: "A grey hill-wolf pelt. Warm, and worth a fair bit cured.",
  },
  wolf_fang: {
    id: "wolf_fang",
    name: "Wolf Fang",
    description: "A long curved fang. Strung on a cord, it marks a hunter.",
  },
  worn_coin: {
    id: "worn_coin",
    name: "Worn Coin",
    description: "Old Varath mintage, too eroded to read. The dead still pay the living.",
  },
  shard_of_orun: {
    id: "shard_of_orun",
    name: "Shard of Orun",
    description:
      "A fragment of jet-black stone, warm to the touch. Found on the slain. Warm rock, or the god remembering — no one can prove which.",
  },
};
