/**
 * src/client/itemColors.ts
 * ------------------------
 * The little swatch colour used to draw each item's icon. Shared by the HUD
 * inventory and the bank UI so they stay consistent.
 */

import type { ItemId } from "../core/types.ts";

export const ITEM_COLORS: Record<ItemId, string> = {
  ashwood_log: "#8a6a44",
  knucklestone_ore: "#6f7079",
  knucklestone_bar: "#9aa0a8",
  ashfin_raw: "#5d7488",
  ashfin_cooked: "#b07c4e",
  raw_rat_meat: "#9c6b5a",
  cooked_rat_meat: "#7a4e38",
  raw_hide: "#7a5638",
  rat_tail: "#866a54",
  raw_wolf_meat: "#8a4f44",
  cooked_wolf_meat: "#6f3f30",
  wolf_pelt: "#8f8a7e",
  wolf_fang: "#d8d2c2",
  worn_coin: "#c9a24a",
  shard_of_orun: "#2a2320",
};
