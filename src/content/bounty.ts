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

import type { BountyGuide, BountyShopListing, BountyTaskDef, BountyUnlock } from "../core/types.ts";

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
    zones: ["spine", "heartmoor", "outlaws"],
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
  {
    id: "kaeda",
    name: "Kaeda",
    title: "The Reckoner",
    icon: "☠️",
    desc: "Keeps a ledger of Varath's named monsters and who among the living has put one down. Assigns single-target boss hunts — the richest marks in the land, for those who can collect.",
    levelReq: 60,
    zones: ["boss_hunts"],
    xpMult: 3.0,
    marksMult: 3.0,
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
    { monster: "greymane_boar", required: 12, xp: 1400, marks: 56, minLevel: 18 },
    { monster: "mountain_lion", required: 10, xp: 1600, marks: 64, minLevel: 20 },
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
    { monster: "cult_acolyte", required: 15, xp: 1600, marks: 65, minLevel: 30 },
    { monster: "cult_zealot", required: 10, xp: 3200, marks: 130, minLevel: 42 },
    { monster: "bog_knight", required: 5, xp: 4000, marks: 165, minLevel: 58 },
    { monster: "mire_serpent", required: 4, xp: 4500, marks: 185, minLevel: 62 },
  ],
  // The lawless roads — outlaw gangs from footpad to captain, ranging the whole
  // map. Serath posts these alongside the Spine and moor work.
  outlaws: [
    { monster: "outlaw_archer", required: 12, xp: 1500, marks: 60, minLevel: 25 },
    { monster: "outlaw_archer", required: 25, xp: 3000, marks: 125, minLevel: 35 },
    { monster: "cutthroat", required: 10, xp: 1800, marks: 75, minLevel: 30 },
    { monster: "marauder", required: 8, xp: 2400, marks: 100, minLevel: 38 },
    { monster: "outlaw_captain", required: 5, xp: 3500, marks: 145, minLevel: 45 },
  ],
  marrow_deeps: [
    { monster: "cave_crawler", required: 8, xp: 4000, marks: 165, minLevel: 65 },
    { monster: "cave_crawler", required: 20, xp: 9000, marks: 370, minLevel: 72 },
    { monster: "deep_bat", required: 10, xp: 3500, marks: 145, minLevel: 68 },
    { monster: "cult_magus", required: 6, xp: 5000, marks: 210, minLevel: 66 },
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
  // Kaeda's ledger — single-target hunts for Varath's named bosses. Base values
  // are large and the guide triples them, so one clean boss kill pays like a
  // long grind. Quest bosses carry a requiresFlag so they're only ever assigned
  // to a hunter who has unlocked their lair.
  boss_hunts: [
    { monster: "bog_warden", required: 2, xp: 4000, marks: 200, minLevel: 60 },
    { monster: "hollow_warden", required: 2, xp: 4000, marks: 200, minLevel: 60 },
    { monster: "green_baron", required: 1, xp: 5000, marks: 240, minLevel: 62, requiresFlag: "q_green_baron_complete" },
    { monster: "hollow_prophet", required: 1, xp: 5500, marks: 260, minLevel: 64, requiresFlag: "q_hollow_prophet_complete" },
    { monster: "spine_warlord", required: 1, xp: 6000, marks: 280, minLevel: 66 },
    { monster: "boneman", required: 1, xp: 6500, marks: 300, minLevel: 68, requiresFlag: "q_boneman_complete" },
    { monster: "marrow_keeper", required: 1, xp: 7000, marks: 320, minLevel: 70 },
    { monster: "ashen_wyrm", required: 1, xp: 9000, marks: 420, minLevel: 75 },
    { monster: "dread_ferryman", required: 1, xp: 10000, marks: 460, minLevel: 78 },
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
  { item: "arrow_hearthite", cost: 130, qty: 20, label: "Hearthite Arrows ×20", desc: "A bundle of twenty hearthite-tipped arrows — for the hardest hunts." },
  { item: "hunters_kit", cost: 400, qty: 3, label: "Hunter's Kit ×3", desc: "Three field kits at a bulk rate. Bank them for your biggest claims." },
];

/**
 * Permanent Hunt-Marks unlocks (bought once, owned forever), in the OSRS
 * Slayer-reward vein. Effects are resolved by id in the core:
 *  - "superior"  → task monsters can rise as a Superior (rare, tougher kill →
 *                  a burst of bonus Marks + XP and a shot at an ultra-rare).
 *  - "keen_eye"  → Superior encounters come half again as often.
 *  - "wider_net" → block list grows from 3 slots to 6.
 */
export const bountyUnlocks: BountyUnlock[] = [
  { id: "superior", name: "Bigger & Badder", cost: 750, desc: "Unlocks Superior encounters — while on a task, the creature you hunt can rarely rise as a Superior: a tougher kill that showers bonus Hunt Marks and Bounty XP, with a slim chance at an ultra-rare Hunter's trophy." },
  { id: "keen_eye", name: "The Hunter's Eye", cost: 600, desc: "You learn the signs. Superior encounters appear roughly half again as often. (Requires Bigger & Badder.)" },
  { id: "wider_net", name: "Warden's Ledger", cost: 400, desc: "Kaeda lets you keep a longer list of refusals — your block list grows from 3 monsters to 6." },
];
