/**
 * src/content/bounty.ts
 * ---------------------
 * The Bounty skill's data, ported from the idle game's BOUNTY_GUIDES +
 * BOUNTY_TASKS + the Bounty (Hunt-Marks) shop.
 *
 * Bounty is a meta-loop layered over combat: a guide hands you a "slay N of
 * monster X" task; killing those monsters anywhere in the world tracks toward
 * it; you return to the board to claim Bounty XP + Hunt Marks, then spend the
 * marks at the board's shop. Three guides cover six zone-pools and scale the
 * flat task rewards (rougher territory pays more).
 */

import type { BountyGuide, BountyShopListing, BountyTaskDef } from "../core/types.ts";

export const bountyGuides: BountyGuide[] = [
  {
    id: "rook",
    name: "Rook",
    title: "The Fieldwarden",
    icon: "🪶",
    desc: "An old tracker who patrols the Knuckle Hills. Sends new hunters after small game and common prey.",
    levelReq: 1,
    zones: ["knuckle_hills", "greyoak_wood"],
    xpMult: 1.0,
    marksMult: 1.0,
  },
  {
    id: "serath",
    name: "Serath",
    title: "The Spine Warden",
    icon: "🗡️",
    desc: "A scarred warrior stationed at the Spine passes. Assigns tasks in rougher territory for seasoned hunters.",
    levelReq: 30,
    zones: ["spine", "heartmoor"],
    xpMult: 1.6,
    marksMult: 1.6,
  },
  {
    id: "mourne",
    name: "Mourne",
    title: "The Deep Watcher",
    icon: "💀",
    desc: "Speaks little. Posts bounties in the Marrow Deeps and Redrun for hunters who have earned the right.",
    levelReq: 65,
    zones: ["marrow_deeps", "redrun"],
    xpMult: 2.5,
    marksMult: 2.5,
  },
];

/**
 * Task templates keyed by zone. `monster` matches a MonsterStats id (and the
 * `monster` tag on placed world objects, so kills track). `required`, `xp` and
 * `marks` are the flat values; the assigning guide scales xp/marks.
 */
export const bountyTasks: Record<string, BountyTaskDef[]> = {
  knuckle_hills: [
    { monster: "moor_rat", required: 25, xp: 300, marks: 10, minLevel: 1 },
    { monster: "moor_rat", required: 60, xp: 650, marks: 22, minLevel: 10 },
    { monster: "hill_wolf", required: 15, xp: 500, marks: 20, minLevel: 5 },
    { monster: "hill_wolf", required: 35, xp: 1100, marks: 45, minLevel: 15 },
  ],
  greyoak_wood: [
    { monster: "wild_boar", required: 15, xp: 800, marks: 32, minLevel: 10 },
    { monster: "wild_boar", required: 30, xp: 1500, marks: 60, minLevel: 20 },
    { monster: "forest_bear", required: 10, xp: 1200, marks: 50, minLevel: 15 },
    { monster: "forest_bear", required: 20, xp: 2400, marks: 100, minLevel: 30 },
  ],
  spine: [
    { monster: "ridge_wolf", required: 10, xp: 1200, marks: 50, minLevel: 25 },
    { monster: "ridge_wolf", required: 25, xp: 2800, marks: 115, minLevel: 35 },
    { monster: "stone_crawler", required: 8, xp: 1800, marks: 75, minLevel: 30 },
    { monster: "stone_crawler", required: 20, xp: 4000, marks: 165, minLevel: 45 },
    { monster: "mountain_troll", required: 5, xp: 2200, marks: 90, minLevel: 38 },
    { monster: "mountain_troll", required: 12, xp: 5000, marks: 200, minLevel: 50 },
    { monster: "spine_wraith", required: 5, xp: 2800, marks: 115, minLevel: 43 },
  ],
  heartmoor: [
    { monster: "marsh_lurker", required: 8, xp: 2500, marks: 100, minLevel: 45 },
    { monster: "marsh_lurker", required: 20, xp: 5500, marks: 225, minLevel: 55 },
    { monster: "heartmoor_hound", required: 10, xp: 3000, marks: 125, minLevel: 50 },
    { monster: "heartmoor_hound", required: 25, xp: 7000, marks: 285, minLevel: 62 },
    { monster: "bog_knight", required: 5, xp: 4000, marks: 165, minLevel: 58 },
    { monster: "mire_serpent", required: 4, xp: 4500, marks: 185, minLevel: 62 },
  ],
  marrow_deeps: [
    { monster: "cave_crawler", required: 8, xp: 4000, marks: 165, minLevel: 65 },
    { monster: "cave_crawler", required: 20, xp: 9000, marks: 370, minLevel: 72 },
    { monster: "deep_bat", required: 10, xp: 3500, marks: 145, minLevel: 68 },
    { monster: "marrow_wraith", required: 5, xp: 5500, marks: 225, minLevel: 75 },
    { monster: "marrow_wraith", required: 12, xp: 12000, marks: 490, minLevel: 80 },
    { monster: "deep_golem", required: 3, xp: 8000, marks: 330, minLevel: 80 },
  ],
  redrun: [
    { monster: "river_serpent", required: 5, xp: 8000, marks: 330, minLevel: 83 },
    { monster: "river_serpent", required: 12, xp: 18000, marks: 740, minLevel: 88 },
    { monster: "redrun_brigand", required: 8, xp: 7000, marks: 285, minLevel: 87 },
    { monster: "redrun_brigand", required: 20, xp: 16000, marks: 660, minLevel: 92 },
    { monster: "ancient_orc", required: 3, xp: 12000, marks: 490, minLevel: 91 },
    { monster: "ancient_orc", required: 8, xp: 28000, marks: 1150, minLevel: 95 },
  ],
};

/** The Bounty board's Hunt-Marks shop (ported subset that exists in our items). */
export const bountyShop: BountyShopListing[] = [
  // The signature reward first — a hunter's helm that rewards staying on-task.
  { item: "bounty_helm", cost: 450, qty: 1, label: "Bounty Helm", desc: "+10% damage against the creature your active bounty names. A serious edge on long tasks." },
  { item: "hunters_kit", cost: 150, qty: 1, label: "Hunter's Kit", desc: "Hold one when you claim a task: +50% Bounty XP, consumed on claim." },
  { item: "battle_ration", cost: 60, qty: 1, label: "Battle Ration", desc: "Field food — heals on the spot, no cooking needed." },
  { item: "health_elixir", cost: 40, qty: 1, label: "Health Elixir", desc: "Restores health instantly." },
  { item: "arrow_ashiron", cost: 25, qty: 15, label: "Ashiron Arrows ×15", desc: "A bundle of fifteen ashiron-tipped arrows." },
  { item: "bloodore_arrow", cost: 60, qty: 15, label: "Bloodore Arrows ×15", desc: "A bundle of fifteen bloodore arrows." },
];
