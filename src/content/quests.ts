/**
 * src/content/quests.ts
 * ---------------------
 * The quest chains. Pure DATA. Each quest is a linear set of objectives offered
 * by a giver NPC; the core tracks progress and grants the reward on turn-in.
 *
 * The opening chain follows Aldric's hook from the World Bible — the worn coin
 * the moor rats keep turning up — then the smith's first lesson, and on to the
 * Greyoak Lodge.
 */

import type { QuestDef } from "../core/types.ts";

export const quests: QuestDef[] = [
  {
    id: "q_coin_in_the_dirt",
    name: "The Coin in the Dirt",
    giver: "aldric",
    intro: [
      "So you'll humour an old man. Good.",
      "Put a few of those moor rats down and see what they carry. A dead king's money in a rat's hole — I want to know it's real.",
    ],
    steps: [
      { type: "kill", monster: "moor_rat", count: 3, text: "Put down 3 Moor Rats" },
      { type: "talk", npc: "aldric", text: "Return to Aldric" },
    ],
    outro: [
      "A Worn Coin. Old Varath mintage, like I said — and no rat minted it.",
      "Keep it. A thing to carry, and a question to carry with it. Now — if you mean to make your way, you'll need to learn a trade.",
    ],
    reward: {
      xp: [
        { skill: "vitality", amount: 80 },
        { skill: "edge", amount: 80 },
        { skill: "vigour", amount: 80 },
      ],
      items: [{ item: "worn_coin", qty: 1 }],
    },
  },
  {
    id: "q_ash_and_knuckle",
    name: "Ash and Knuckle",
    giver: "aldric",
    requires: "q_coin_in_the_dirt",
    intro: [
      "Every road in Varath starts the same way: a hand that can take stone and give back metal.",
      "Mine a piece of Knucklestone from the outcrop. Smelt it to a bar at the furnace. Then bring the bar back to me.",
    ],
    steps: [
      { type: "gather", item: "knucklestone_ore", count: 1, text: "Mine a piece of Knucklestone" },
      { type: "gather", item: "knucklestone_bar", count: 1, text: "Smelt a Knucklestone Bar at the furnace" },
      { type: "deliver", npc: "aldric", item: "knucklestone_bar", count: 1, text: "Bring the bar to Aldric" },
    ],
    outro: [
      "Ash and knuckle — that's the whole of it, and the start of everything.",
      "Take this pick; it'll serve you better than your hands. The wood to the south is Greyoak. Maret keeps the Lodge there. Tell her Aldric sent you.",
    ],
    reward: {
      xp: [
        { skill: "mining", amount: 140 },
        { skill: "smithing", amount: 140 },
      ],
      items: [{ item: "pickaxe_1", qty: 1 }],
    },
  },
  {
    id: "q_lodge_measure",
    name: "The Lodge's Measure",
    giver: "maret",
    requires: "q_ash_and_knuckle",
    intro: [
      "Aldric sent you. He sends me people he thinks the wood won't waste.",
      "Prove the measure, then. The boar are thick in the understory this season. Thin two of them — carefully — and come back.",
    ],
    steps: [
      { type: "kill", monster: "wild_boar", count: 2, text: "Hunt 2 Wild Boar in Greyoak" },
      { type: "talk", npc: "maret", text: "Return to Maret" },
    ],
    outro: [
      "Clean work, and you came back. Not everyone does both.",
      "The Lodge remembers a steady hand. Walk the wood as you like — and mind the deep growth.",
    ],
    reward: {
      xp: [
        { skill: "vigour", amount: 200 },
        { skill: "forestry", amount: 120 },
      ],
    },
  },
];
