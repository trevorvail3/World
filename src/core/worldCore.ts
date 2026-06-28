/**
 * src/core/worldCore.ts
 * ---------------------
 * The pure "rules engine" of Varath World.
 *
 * RULE 1 — PURITY: there is no DOM, no Date.now(), no Math.random() in this
 * file. The current time and a random-number generator arrive through the
 * `Ctx` argument. That makes the core deterministic: feed it the same inputs
 * and it produces the same outputs, which is exactly what a multiplayer
 * server needs to keep every player in sync.
 *
 * RULE 2 — INTENTS: the only ways to change the world are `applyIntent`
 * (the player asked for something) and `tick` (time passed). Both return a
 * list of WorldEvents describing what happened, so the client can react
 * (log lines, dialogue, hit-splats) without ever touching state itself.
 *
 * RULE 3 — CONTENT IS DATA: all the numbers that describe *what exists*
 * (the map, items, XP curve, where things spawn) come in via the `Content`
 * bundle. This file only holds the *behaviour*.
 */

import type {
  AchievementCond,
  BountyTaskDef,
  Content,
  CropDef,
  Ctx,
  EquipSlot,
  Intent,
  ItemDef,
  ItemId,
  MonsterStats,
  ObjKind,
  Player,
  QuestDef,
  QuestState,
  RepChange,
  SkillAction,
  SkillId,
  Vec2,
  WorldEvent,
  WorldObjectDef,
  WorldObjectState,
  WorldState,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Tunable game constants. These are behaviour, so they live here (not content).
// Times are in milliseconds.
// ---------------------------------------------------------------------------

const MOVE_SPEED = 1.8; // tiles per second — a deliberately slow walk
const MOUNT_SPEED_MULT = 1.1; // a worn mount gives a modest travel boost on top of everything

// Run/walk (OSRS-style): running moves SPRINT_MULT× faster but drains run energy
// per tile travelled; energy recovers while walking or standing still. Walking is
// slow on purpose; sprinting (~3.6 tiles/s) is the comfortable pace, so the run
// bar — and Agility, which stretches it — actually matter.
const SPRINT_MULT = 2.0;
const ENERGY_MAX = 100;
const ENERGY_DRAIN = 1.7; // energy spent per tile sprinted (~58 tiles on a full bar)
const ENERGY_REGEN = 7; // energy recovered per second when not sprinting
const ENERGY_RECOVER = 20; // after running dry, you must regen this much before sprinting again
// Agility trains by running and pays it back: at the level cap, drain is halved
// (runs last ~2× longer) and regen is doubled (recovers ~2× faster).
const AGILITY_DRAIN_REDUCTION = 0.5;
const AGILITY_REGEN_BONUS = 1.0;
// Agility is trained on obstacle courses; clearing a full lap pays a bonus equal
// to this multiple of the course's total per-obstacle XP.
const AGILITY_LAP_BONUS_MULT = 1.0;

// Predators that strike when you stray too close (everything else waits to be
// attacked). Kept here rather than in content so it's easy to tune.
const AGGRESSIVE = new Set<string>([
  "hill_wolf", "ridge_wolf", "heartmoor_hound", "wild_boar", "greymane_boar",
  "forest_bear", "stone_crawler", "cave_crawler", "mountain_troll", "deep_golem",
  "spine_wraith", "marrow_wraith", "mire_serpent",
  "hollow_warden", "bog_warden", "spine_warlord", "marrow_keeper",
]);
const AGGRO_RANGE = 1.5; // tiles — only monsters you walk right up to engage you
// On death you drop a tenth of your coin (a real but gentle setback).
const DEATH_GOLD_FRACTION = 0.1;
const DEATH_GOLD_CAP = 250;
// The Shard of Orun is a rare drop, but this many kills without one guarantees
// the next — so q_first_shard (and the whole main story) can't be RNG-walled.
const SHARD_PITY = 250;
const SHARD_ID = "shard_of_orun" as ItemId;

// Playable level ceiling. The XP table (content) is built a little past this so
// look-ups never fall off the end, but a skill never *reads* above the cap.
// Keep in step with LEVEL_CAP in src/content/xpCurve.ts.
const LEVEL_CAP = 110;

// Idle wandering for npcs + monsters. They drift one tile at a time within a
// small box around their spawn, pausing between steps, and hold still when the
// player is right beside them (so you can talk / engage without them sliding
// off). Movement is sub-tile and interpolated, like the player's.
const WANDER = {
  /** Max Chebyshev distance (tiles) a creature may stray from its spawn. */
  radius: 2,
  /** Wander walk speed (tiles/sec) — an unhurried amble, slower than the player. */
  speed: 1.6,
  /** Idle pause between steps is a random ms in [pauseMin, pauseMax]. */
  pauseMin: 1400,
  pauseMax: 4200,
};

// `deplete` is the chance, on a successful gather, that the node runs out and
// the player stops — otherwise they keep gathering until the pack is full.
// Gathering rates (rebalanced): gathering used to lag the processing it feeds by
// ~12× (Mining was a ~160h slog feeding a ~13h Smithing). Faster swings, higher
// success, and less depletion downtime bring it into a healthier ~45–60h band —
// still the input bottleneck, no longer a wall. Mining and Hunter got the most.
const WOODCUTTING = { interval: 1400, success: 0.5, xp: 25, respawn: 7000, deplete: 0.25 };
const MINING = { interval: 1500, success: 0.52, xp: 30, respawn: 7000, deplete: 0.25 };
const FISHING = { interval: 1300, success: 0.55, xp: 20 };
// Hunter: a snare you set and check. A catch "springs" the trap (it depletes),
// then the game wanders back and the trap resets after a short wait. It has no
// tool to speed it, so the constants carry the whole buff.
const HUNTER = { interval: 1900, success: 0.55, respawn: 8000, deplete: 0.3 };

// Re-tuned: one station-craft step every CRAFT_INTERVAL ms (the idle game's
// per-recipe baseTimes are far slower; a single snappy interval feels right
// when you're standing at the station).
const CRAFT_INTERVAL = 1200;

/** Which actions each station offers, by the station's ObjKind. */
export function stationActions(content: Content, station: string): SkillAction[] {
  return content.actions.filter((a) => {
    if (!a.produces) return false;
    if (station === "fire") {
      return a.skill === "cooking" || (a.skill === "survivalist" && a.group === "fire");
    }
    if (station === "furnace") return a.id.startsWith("smelt_");
    // The anvil forges everything smithing that isn't smelting or reforging.
    if (station === "anvil") {
      return a.skill === "smithing" && !a.id.startsWith("smelt_") && !a.meltAll;
    }
    // The cauldron brews all Herblore; the workbench builds all Construction;
    // the crafting table tans leather, blows glass and makes jewellery.
    if (station === "cauldron") return a.skill === "herblore";
    if (station === "workbench") return a.skill === "construction";
    if (station === "crafting_table") return a.skill === "crafting";
    if (station === "sawmill") return a.skill === "woodcraft";
    return false;
  });
}

const PLAYER_RESPAWN = 4000;

// Combat math, ported from the Varath idle game (see docs/CANON_LEDGER.md).
const COMBAT = {
  /** Default melee swing interval (ms) when no weapon speed is set. */
  playerMeleeSpeed: 2400,
  /** Fallback monster swing interval (ms) if a monster has no `speed`. */
  monsterSpeed: 3000,
  /** Hit-chance = clamp(base + (att - def) * slope, floor, cap). */
  hitBase: 0.5,
  hitSlope: 0.012,
  hitFloor: 0.05,
  hitCap: 0.95,
  /** Exploiting a weakness multiplies accuracy / damage. */
  weaknessAcc: 1.2,
  weaknessDmg: 1.1,
  /** Ward soaks floor(defence / this) flat damage per hit. */
  wardDivisor: 15,
  /** Small flat bonus the matching style grants. */
  styleBonus: 3,
  /** How long a slain monster stays down before respawning (ms). */
  respawn: 9000,
};

/** Base max HP before the Vitality level is added. */
const BASE_MAX_HP = 10;

const INVENTORY_SIZE = 28;

/** A small starting purse so the market isn't dead on arrival. */
const STARTING_GOLD = 30;

// ---------------------------------------------------------------------------
// Walkability — shared with the client's pathfinder.
// ---------------------------------------------------------------------------

// Fixed solid objects: the player always stops *next to* these, never on them.
// NPCs and monsters block too, but they wander, so their tiles are tracked live
// in state.creatureTiles rather than baked into the static set below.
const BLOCKING_KINDS = new Set([
  "tree",
  "rock",
  "bank",
  "fire",
  "furnace",
  "anvil",
  "shrine",
  "plant_patch",
  "tree_patch",
  "portal",
  "trap",
  "bounty_board",
  "cauldron",
  "workbench",
  "crafting_table",
  "cart",
  "fountain",
  "sawmill",
  "lamppost",
  "signpost",
  "waystone",
  "relic",
  "build_hotspot",
  "house_door",
]);

/** A creature's live tile if it's wandering, else its fixed def coordinates. */
export function objectPos(
  def: WorldObjectDef,
  st: WorldObjectState | undefined,
): Vec2 {
  return st?.pos ? { x: st.pos.x, y: st.pos.y } : { x: def.x, y: def.y };
}

/**
 * Build a fast "can I stand on this tile?" function. Water and the deep terrain
 * block movement; fixed solid objects block their tile; and wandering creatures
 * block wherever they currently stand (read live from `state`, which the tick
 * keeps up to date) — so the player always stops *next to* things, even after a
 * creature has drifted from its spawn.
 */
export function buildWalkability(
  content: Content,
  state: WorldState,
): (x: number, y: number) => boolean {
  const blocked = new Set<string>();
  // Sealed add-on doorways block until their extension is built — keyed live, so
  // the wing opens for pathfinding the moment you build it (no rebuild needed).
  const seals = new Map<string, string>();
  for (const obj of content.objects) {
    // Rug footings are floor coverings — you walk over them, so they don't block.
    if (obj.kind === "build_hotspot" && obj.category === "rug") continue;
    if (BLOCKING_KINDS.has(obj.kind)) blocked.add(`${obj.x},${obj.y}`);
    else if (obj.kind === "room_seal") seals.set(`${obj.x},${obj.y}`, obj.id);
  }
  const { map } = content;
  return (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const tile = map.tiles[y * map.width + x];
    if (tile === "water" || tile === "mountain" || tile === "cave_wall" || tile === "deep" || tile === "wall") {
      return false;
    }
    const key = `${x},${y}`;
    if (blocked.has(key)) return false;
    const seal = seals.get(key);
    if (seal && !state.objects[seal]?.owned) return false; // wing not built yet
    if (state.creatureTiles.has(key)) return false;
    return true;
  };
}

// ---------------------------------------------------------------------------
// Creating a fresh world.
// ---------------------------------------------------------------------------

export function createWorld(
  content: Content,
  spawn: Vec2,
  ctx: Ctx,
): WorldState {
  const objects: Record<string, WorldObjectState> = {};
  const creatureTiles = new Set<string>();
  for (const def of content.objects) {
    const base: WorldObjectState = {
      id: def.id,
      available: true,
      respawnAt: 0,
    };
    if (def.kind === "monster") base.hp = monsterFor(content, def)?.hp ?? 1;
    // NPCs and monsters start at their spawn tile and amble from there; stagger
    // their first step so they don't all set off in lockstep.
    if (def.kind === "npc" || def.kind === "monster" || def.kind === "critter") {
      base.pos = { x: def.x, y: def.y };
      base.wanderTarget = null;
      base.nextWanderAt = ctx.now + Math.floor(ctx.rng() * WANDER.pauseMax);
      // Critters don't block (the player walks through ambient wildlife).
      if (def.kind !== "critter") creatureTiles.add(`${def.x},${def.y}`);
    }
    objects[def.id] = base;
  }

  const skills = {} as Player["skills"];
  (Object.keys(content.skills) as SkillId[]).forEach((id) => {
    skills[id] = { xp: 0, level: 1 };
  });

  const maxHp = BASE_MAX_HP + (skills.vitality?.level ?? 1);
  const player: Player = {
    pos: { x: spawn.x, y: spawn.y },
    path: [],
    hp: maxHp,
    maxHp,
    spawn: { x: spawn.x, y: spawn.y },
    skills,
    inventory: new Array<Player["inventory"][number]>(INVENTORY_SIZE).fill(null),
    bank: {},
    // Start carrying the basic tier-1 tools (a hatchet in hand, pickaxe and rod
    // in the pack). Gathering auto-wields whichever tool the job needs, so the
    // one mainhand slot is never a chore — and there's a clear upgrade path.
    equipment: { mainhand: "hatchet_1" },
    quiver: 0,
    combatStyle: "vigour",
    running: true,
    energy: ENERGY_MAX,
    winded: false,
    agilityLap: null,
    quests: {},
    questsDone: [],
    lore: [],
    flags: [],
    gold: STARTING_GOLD,
    reputation: { ashforge: 0, lodge: 0, pale_record: 0, heartmoor_cult: 0 },
    stats: { goldEarned: 0, monstersSlain: 0 },
    killsSinceShard: 0,
    achievements: [],
    appearance: {
      name: "Wanderer", skin: "#e3bd92", hair: "#4a3320", tunic: "#6b6157",
      legColor: "#9a5a2a", shoeColor: "#3a2c20",
      hairStyle: "short", facial: "none", top: "plain", legs: "trousers", shoes: "boots",
    },
    bounty: { marks: 0, guideId: content.bountyGuides[0]?.id ?? "rook", task: null },
    buffs: {},
    activity: { kind: "idle", targetId: null, actionId: null, nextActionAt: 0, actionInterval: 0 },
    pendingInteractId: null,
    pendingInteractMode: null,
    station: null,
    alive: true,
    respawnAt: 0,
  };

  // The starter pickaxe and rod ride in the pack; the hatchet is in hand.
  player.inventory[0] = { item: "pickaxe_1" as ItemId, qty: 1 };
  player.inventory[1] = { item: "rod_1" as ItemId, qty: 1 };

  return {
    map: content.map,
    player,
    objects,
    creatureTiles,
    lastTick: ctx.now,
  };
}

// ---------------------------------------------------------------------------
// Small internal helpers (all pure).
// ---------------------------------------------------------------------------

function findObjectDef(content: Content, id: string): WorldObjectDef | undefined {
  return content.objects.find((o) => o.id === id);
}

/** The combat stats for a monster object, or undefined for non-monsters. */
function monsterFor(
  content: Content,
  def: WorldObjectDef,
): MonsterStats | undefined {
  return def.monster ? content.monsters[def.monster] : undefined;
}

/** The default tier-1 gathering action for each resource-node kind. */
const DEFAULT_RESOURCE: Record<string, string> = {
  tree: "fell_ashwood",
  rock: "mine_knucklestone",
  fishing_spot: "fish_ashfin",
  trap: "hunt_hare",
};

/** The SkillAction a resource node yields (its `resource`, or the kind default). */
function gatherAction(content: Content, def: WorldObjectDef): SkillAction | undefined {
  const id = def.resource ?? DEFAULT_RESOURCE[def.kind];
  return id ? content.actions.find((a) => a.id === id) : undefined;
}

/**
 * Start gathering a resource node: resolve its action, check the skill level,
 * and set the activity (carrying the action id). Returns false if it can't
 * start (unknown resource or too low a level), having logged why.
 */
function beginGather(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  objId: string,
  kind: "woodcutting" | "mining" | "fishing" | "trapping",
  interval: number,
  ctx: Ctx,
  events: WorldEvent[],
): boolean {
  const { player } = state;
  const action = gatherAction(content, def);
  if (!action) return false;
  if (skillLvl(player, action.skill) < action.levelReq) {
    events.push({
      type: "LOG",
      message: `You need ${content.skills[action.skill].name} level ${action.levelReq} for that.`,
    });
    return false;
  }
  // This kind of gathering needs the matching tool wielded in the mainhand; a
  // better tool tier gathers faster. If the right tool isn't in hand we try to
  // wield one from the pack, so you never have to swap tools by hand. (Trapping
  // needs no tool.)
  const toolKind = GATHER_TOOL[kind];
  let speedMult = 1;
  if (toolKind) {
    const tier = wieldGatherTool(player, content, toolKind, events);
    if (tier === null) {
      events.push({ type: "LOG", message: TOOL_MISSING[toolKind] ?? "You need the right tool for that." });
      return false;
    }
    speedMult = TOOL_TIER_SPEED[tier] ?? 1;
  }
  // A gathering tincture speeds every gather (fishing has no tool but still buffs).
  speedMult *= 1 - Math.min(0.6, buffVal(player, "gather_speed"));
  const stepInterval = Math.round(interval * speedMult);
  player.activity = {
    kind,
    targetId: objId,
    actionId: action.id,
    nextActionAt: ctx.now + stepInterval,
    actionInterval: stepInterval,
  };
  return true;
}

/** What to tell the player when they try to gather without the right tool. */
const TOOL_MISSING: Record<string, string> = {
  hatchet: "You need a hatchet to chop here.",
  pickaxe: "You need a pickaxe to mine here.",
  rod: "You need a fishing rod to fish here.",
};

/**
 * Make sure the player is wielding a usable tool of `toolKind`, auto-swapping
 * the best one out of the pack if their hands are empty or holding the wrong
 * thing. Returns the wielded tool's tier, or null if they own no usable tool.
 * "Usable" means the player's gathering level meets the tool's wield requirement.
 */
function wieldGatherTool(
  player: Player,
  content: Content,
  toolKind: "hatchet" | "pickaxe" | "rod",
  events: WorldEvent[],
): number | null {
  const level = skillLvl(player, TOOL_SLOT_SKILL[toolKind]);
  const usable = (id: ItemId | undefined): boolean => {
    if (!id) return false;
    const d = content.items[id];
    if (!d || d.tool !== toolKind) return false;
    return level >= (TOOL_TIER_REQS[d.tier ?? 1] ?? 1);
  };

  // Already holding a usable tool of this kind?
  const inHand = player.equipment.mainhand;
  if (usable(inHand)) return content.items[inHand!].tier ?? 1;

  // Otherwise wield the best usable one from the pack (swap with whatever's
  // in hand). Tools are unique per tier, so this is a clean 1-for-1 swap.
  let bestIdx = -1;
  let bestTier = -1;
  for (let i = 0; i < player.inventory.length; i++) {
    const slot = player.inventory[i];
    if (!slot || !usable(slot.item)) continue;
    const t = content.items[slot.item].tier ?? 1;
    if (t > bestTier) { bestTier = t; bestIdx = i; }
  }
  if (bestIdx === -1) return null;

  const toolId = player.inventory[bestIdx]!.item;
  const displaced = player.equipment.mainhand;
  player.equipment.mainhand = toolId;
  player.inventory[bestIdx] = displaced ? { item: displaced, qty: 1 } : null;
  events.push({ type: "LOG", message: `You ready your ${content.items[toolId].name}.` });
  return bestTier;
}

function levelFromXp(xpTable: number[], xp: number): number {
  let level = 1;
  while (
    level < LEVEL_CAP &&
    level + 1 < xpTable.length &&
    (xpTable[level + 1] ?? Infinity) <= xp
  ) {
    level++;
  }
  return level;
}

function grantXp(
  state: WorldState,
  content: Content,
  skill: SkillId,
  amount: number,
  events: WorldEvent[],
): void {
  const s = state.player.skills[skill];
  const before = s.level;
  // A summoned skilling companion sweetens XP for its own skill. Kept fractional
  // so a small % still accrues on low-XP actions (the display rounds it).
  const comp = activeCompanion(state.player, content);
  if (comp?.meta?.["petSkill"] === skill && typeof comp.meta["bonusAmt"] === "number") {
    amount = amount * (1 + (comp.meta["bonusAmt"] as number));
  }
  // A smoked-fish XP boost lifts all XP gains while it lasts.
  amount = amount * (1 + buffVal(state.player, "xp_boost"));
  s.xp += amount;
  events.push({ type: "XP_GAINED", skill, amount });
  const after = levelFromXp(content.xpForLevel, s.xp);
  if (after > before) {
    s.level = after;
    events.push({ type: "LEVEL_UP", skill, level: after });
  }
}

/** Add an item to the inventory (items stack by id). Returns success. */
function addItem(
  player: Player,
  item: ItemId,
  qty: number,
  events: WorldEvent[],
): boolean {
  const existing = player.inventory.find((slot) => slot?.item === item);
  if (existing) {
    existing.qty += qty;
    events.push({ type: "ITEM_GAINED", item, qty });
    return true;
  }
  const emptyIndex = player.inventory.findIndex((slot) => slot === null);
  if (emptyIndex === -1) {
    events.push({ type: "INVENTORY_FULL" });
    return false;
  }
  player.inventory[emptyIndex] = { item, qty };
  events.push({ type: "ITEM_GAINED", item, qty });
  return true;
}

function clearActivity(player: Player): void {
  player.activity = { kind: "idle", targetId: null, actionId: null, nextActionAt: 0, actionInterval: 0 };
}

/** Does the player hold at least one of this item? */
function hasItem(player: Player, item: ItemId): boolean {
  return player.inventory.some((slot) => slot?.item === item && slot.qty > 0);
}

/** Is there room in the pack for this item (a matching stack or an empty slot)? */
function canAddItem(player: Player, item: ItemId): boolean {
  return player.inventory.some((slot) => slot === null || slot.item === item);
}

/** Buy one listing (its whole bundle) from a shop — needs gold and pack room. */
function buyFromShop(
  player: Player,
  content: Content,
  shopId: string,
  item: ItemId,
  events: WorldEvent[],
): void {
  const shop = content.shops.find((s) => s.id === shopId);
  const line = shop?.stock.find((s) => s.item === item);
  if (!line) return;
  if (player.gold < line.price) {
    events.push({ type: "LOG", message: "You can't afford that." });
    return;
  }
  if (!canAddItem(player, item)) {
    events.push({ type: "INVENTORY_FULL" });
    return;
  }
  player.gold -= line.price;
  addItem(player, item, line.qty, events);
  const name = content.items[item].name;
  const bundle = line.qty > 1 ? `${line.qty}× ` : "";
  events.push({ type: "LOG", message: `Bought ${bundle}${name} for ${line.price}g.` });
}

/** Sell up to `qty` of an item from the pack at the market for its gold value. */
function sellToMarket(
  player: Player,
  content: Content,
  item: ItemId,
  qty: number,
  events: WorldEvent[],
): void {
  const def = content.items[item];
  const value = def?.sell ?? 0;
  if (value <= 0) {
    events.push({ type: "LOG", message: `No one will buy the ${def?.name ?? "item"}.` });
    return;
  }
  const toSell = Math.min(Math.max(0, Math.floor(qty)), countItem(player, item));
  if (toSell <= 0) return;
  for (let i = 0; i < toSell; i++) removeOneItem(player, item);
  player.gold += value * toSell;
  player.stats.goldEarned += value * toSell;
  const bundle = toSell > 1 ? `${toSell}× ` : "";
  events.push({ type: "LOG", message: `Sold ${bundle}${def.name} for ${value * toSell}g.` });
}

/** Does the player hold everything a recipe needs (requires + requiresAny)? */
function hasIngredients(player: Player, action: SkillAction): boolean {
  if (action.requires) {
    for (const [item, qty] of Object.entries(action.requires)) {
      if (countItem(player, item as ItemId) < (qty ?? 0)) return false;
    }
  }
  if (action.requiresAny && action.requiresAny.length > 0) {
    if (!action.requiresAny.some((item) => hasItem(player, item))) return false;
  }
  return true;
}

/** Consume one batch of a recipe's inputs from the pack. */
function consumeIngredients(player: Player, action: SkillAction): void {
  if (action.requires) {
    for (const [item, qty] of Object.entries(action.requires)) {
      for (let i = 0; i < (qty ?? 0); i++) removeOneItem(player, item as ItemId);
    }
  }
  if (action.requiresAny && action.requiresAny.length > 0) {
    const choice = action.requiresAny.find((item) => hasItem(player, item));
    if (choice) removeOneItem(player, choice);
  }
}

/** Remove a single unit of an item from the inventory. */
function removeOneItem(player: Player, item: ItemId): void {
  const idx = player.inventory.findIndex(
    (slot) => slot?.item === item && slot.qty > 0,
  );
  if (idx === -1) return;
  const slot = player.inventory[idx]!;
  slot.qty -= 1;
  if (slot.qty <= 0) player.inventory[idx] = null;
}

/** How many of an item the player is carrying (across all stacks). */
function countItem(player: Player, item: ItemId): number {
  let n = 0;
  for (const slot of player.inventory) {
    if (slot?.item === item) n += slot.qty;
  }
  return n;
}

/**
 * Sum a combat stat ("acc", "dmg" or "def") across everything the player is
 * wearing. This is how worn gear feeds into the fight without the core knowing
 * item names — it just reads the numbers content gave each piece.
 */
function equipStat(
  player: Player,
  content: Content,
  field: "acc" | "dmg" | "def",
): number {
  let total = 0;
  for (const [slot, id] of Object.entries(player.equipment)) {
    if (!id) continue;
    // The bow and arrows feed ranged math only — never melee accuracy/damage.
    if (slot === "ranged" || slot === "ammo") continue;
    total += content.items[id][field] ?? 0;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Handling intents (RULE 2: the only player-driven way to change the world).
// ---------------------------------------------------------------------------

export function applyIntent(
  state: WorldState,
  content: Content,
  intent: Intent,
  ctx: Ctx,
): WorldEvent[] {
  const events: WorldEvent[] = [];
  const { player } = state;
  if (!player.alive) return events; // dead players can't act until they respawn

  switch (intent.type) {
    case "MOVE": {
      player.path = intent.path.map((p) => ({ x: p.x, y: p.y }));
      player.pendingInteractId = null;
      player.pendingInteractMode = null;
      player.station = null; // walking away leaves the counter
      clearActivity(player);
      break;
    }
    case "INTERACT": {
      player.path = intent.path.map((p) => ({ x: p.x, y: p.y }));
      player.pendingInteractId = intent.objId;
      player.pendingInteractMode = intent.mode ?? null;
      player.station = null; // a fresh interaction; startInteraction re-sets it
      clearActivity(player);
      // If we're already standing next to it, act immediately.
      if (player.path.length === 0) {
        startInteraction(state, content, intent.objId, ctx, events);
      }
      break;
    }
    case "CANCEL": {
      player.path = [];
      player.pendingInteractId = null;
      player.station = null;
      clearActivity(player);
      break;
    }
    case "EAT": {
      eatSlot(player, content, intent.slot, ctx, events);
      break;
    }
    case "DEPOSIT": {
      if (!atStation(player, "bank", "the bank", events)) break;
      depositAll(player, intent.item);
      break;
    }
    case "WITHDRAW": {
      if (!atStation(player, "bank", "the bank", events)) break;
      withdrawOne(player, intent.item, events);
      break;
    }
    case "EQUIP": {
      equipSlot(player, content, intent.slot, events);
      break;
    }
    case "UNEQUIP": {
      unequipSlot(player, content, intent.equipSlot, events);
      break;
    }
    case "CRAFT": {
      startCraft(state, content, intent.actionId, intent.objId, ctx, events);
      break;
    }
    case "CHOOSE": {
      applyChoice(state, content, intent.quest, intent.option, events);
      break;
    }
    case "BUY": {
      if (player.station?.kind !== "shop" || player.station.id !== intent.shop) {
        events.push({ type: "LOG", message: "You need to be at that shop to buy." });
        break;
      }
      buyFromShop(player, content, intent.shop, intent.item, events);
      break;
    }
    case "TRAVEL": {
      travelTo(state, content, intent.to, events);
      break;
    }
    case "SELL": {
      if (!atStation(player, "shop", "a shop", events)) break;
      sellToMarket(player, content, intent.item, intent.qty, events);
      break;
    }
    case "PLANT": {
      plantSeed(state, content, intent.patchId, intent.crop, ctx, events);
      break;
    }
    case "BOUNTY_TASK": {
      if (!atStation(player, "bounty", "the bounty board", events)) break;
      takeBountyTask(state, content, intent.guideId, ctx, events);
      break;
    }
    case "BOUNTY_CLAIM": {
      if (!atStation(player, "bounty", "the bounty board", events)) break;
      claimBountyTask(state, content, events);
      break;
    }
    case "BOUNTY_ABANDON": {
      if (!atStation(player, "bounty", "the bounty board", events)) break;
      abandonBountyTask(player, events);
      break;
    }
    case "BOUNTY_BUY": {
      if (!atStation(player, "bounty", "the bounty board", events)) break;
      buyBountyItem(player, content, intent.item, events);
      break;
    }
    case "SET_STYLE": {
      player.combatStyle = intent.style;
      events.push({
        type: "LOG",
        message: `Combat style: ${intent.style[0]!.toUpperCase()}${intent.style.slice(1)}.`,
      });
      break;
    }
    case "TOGGLE_RUN": {
      player.running = !player.running;
      break;
    }
    case "CLAIM_PLOT": {
      const obj = state.objects[intent.plotId];
      const def = findObjectDef(content, intent.plotId);
      if (obj && def && def.kind === "housing_plot" && !obj.owned) {
        obj.owned = true;
        events.push({ type: "LOG", message: `You claim ${def.name}.` });
      }
      break;
    }
    case "BUILD_FURNITURE": {
      buildFurniture(state, content, intent.hotspotId, intent.furnitureId, events);
      break;
    }
    case "REMOVE_FURNITURE": {
      removeFurniture(state, content, intent.hotspotId, events);
      break;
    }
    case "USE_FURNITURE": {
      useFurniture(state, content, intent.hotspotId, events);
      break;
    }
    case "BUILD_ROOM": {
      buildRoom(state, content, intent.sealId, events);
      break;
    }
  }
  return events;
}

/** The wearable equipment slots (canon `equip` values we support). */
const EQUIP_SLOTS = new Set<string>([
  "mainhand",
  "offhand",
  "helmet",
  "armor",
  "legs",
  "boots",
  "ring",
  "necklace",
  "cape",
  "companion",
  "ranged",
  "ammo",
  "mount",
]);

/** Chance, per successful skill action, of a matching skilling-pet companion. */
const PET_DROP_CHANCE = 0.004;

/** The companion currently summoned, or undefined. */
function activeCompanion(player: Player, content: Content): ItemDef | undefined {
  const id = player.equipment.companion;
  return id ? content.items[id] : undefined;
}

/** Does the player already have this companion anywhere (pack/bank/summoned)? */
function ownsItem(player: Player, item: ItemId): boolean {
  if (player.equipment.companion === item) return true;
  if ((player.bank[item] ?? 0) > 0) return true;
  return player.inventory.some((s) => s?.item === item);
}

/**
 * A successful action in a gathering/processing skill can turn up that skill's
 * companion (a rare pet), once. Skilling pets carry meta.petSkill === skill.
 */
function tryPetDrop(
  state: WorldState,
  content: Content,
  skill: SkillId,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  if (ctx.rng() >= PET_DROP_CHANCE) return;
  const player = state.player;
  for (const id of Object.keys(content.items) as ItemId[]) {
    const def = content.items[id];
    if (def.slot !== "companion" || def.meta?.["petSkill"] !== skill) continue;
    if (ownsItem(player, id) || !canAddItem(player, id)) return;
    addItem(player, id, 1, events);
    events.push({ type: "COMPANION_FOUND", item: id });
    events.push({ type: "LOG", message: `A companion has found you: ${def.name}!` });
    return;
  }
}

/** Combat level needed to equip each gear tier (idle game GEAR_TIER_REQS). */
const GEAR_TIER_REQS = [0, 1, 10, 20, 30, 40, 50, 55, 60, 65, 72];

/** Which gathering skill each tool kind serves. */
const TOOL_SLOT_SKILL: Record<"hatchet" | "pickaxe" | "rod", SkillId> = {
  hatchet: "forestry",
  pickaxe: "mining",
  rod: "fishing",
};

/** The tool kind each gather activity needs wielded. */
const GATHER_TOOL: Partial<Record<string, "hatchet" | "pickaxe" | "rod">> = {
  woodcutting: "hatchet",
  mining: "pickaxe",
  fishing: "rod",
};

/** Gathering-skill level needed to wield each tool tier (index = tier 1–10). */
const TOOL_TIER_REQS = [0, 1, 10, 15, 30, 40, 45, 55, 60, 60, 75];

/** Tool tier → gather-interval multiplier: better tools gather faster. A steeper
 *  ramp so upgrading your pickaxe/hatchet/rod is a real late-game speed reward
 *  (top tier ≈ 2.2× the base rate), giving gathering room to scale with progress. */
const TOOL_TIER_SPEED = [1, 1, 0.93, 0.86, 0.78, 0.72, 0.66, 0.6, 0.55, 0.5, 0.45];

/**
 * The skill + level a piece of gear or a tool needs before it can be worn.
 * Tools gate on their gathering skill; combat gear gates on combat level.
 * Exported so the UI can show the same requirement the equip check enforces.
 */
export function equipRequirement(
  content: Content,
  itemId: ItemId,
): { skill: SkillId | "combat"; level: number } | null {
  const def = content.items[itemId];
  if (!def || def.tier === undefined) return null;
  if (def.tool) {
    const level = TOOL_TIER_REQS[def.tier] ?? 1;
    return level > 1 ? { skill: TOOL_SLOT_SKILL[def.tool], level } : null;
  }
  const level = GEAR_TIER_REQS[def.tier] ?? 0;
  return level > 1 ? { skill: "combat", level } : null;
}

/** Guard a counter intent: true only while the player stands at that station. */
function atStation(
  player: Player,
  kind: "shop" | "bank" | "bounty",
  what: string,
  events: WorldEvent[],
): boolean {
  if (player.station?.kind === kind) return true;
  events.push({ type: "LOG", message: `You need to be at ${what} to do that.` });
  return false;
}

/** The player's combat level (idle game formula). */
function combatLevel(player: Player): number {
  const e = skillLvl(player, "edge");
  const v = skillLvl(player, "vigour");
  const w = skillLvl(player, "ward");
  const d = skillLvl(player, "draw");
  const vit = skillLvl(player, "vitality");
  return Math.floor((w + vit) / 4 + Math.max((e + v) / 4, d / 2));
}

/** Wear the gear in an inventory slot, swapping out anything already worn. */
function equipSlot(
  player: Player,
  content: Content,
  slot: number,
  events: WorldEvent[],
): void {
  const data = player.inventory[slot];
  if (!data) return;
  const def = content.items[data.item];
  const eslot = def.slot;
  if (!eslot || !EQUIP_SLOTS.has(eslot)) {
    events.push({ type: "LOG", message: `You can't wear the ${def.name}.` });
    return;
  }
  // Arrows are worn as a whole stack into the quiver, not one at a time.
  if (eslot === "ammo") {
    equipAmmo(player, content, slot, events);
    return;
  }
  // Honour the level requirement: tools gate on their gathering skill, combat
  // gear on combat level (e.g. a Ribstone Pickaxe needs Mining 30 to wield).
  const req = equipRequirement(content, data.item);
  if (req) {
    const have = req.skill === "combat" ? combatLevel(player) : skillLvl(player, req.skill);
    if (have < req.level) {
      const what = req.skill === "combat" ? "combat" : content.skills[req.skill].name;
      events.push({
        type: "LOG",
        message: `You need ${what} level ${req.level} to wield the ${def.name}.`,
      });
      return;
    }
  }

  const target = eslot as EquipSlot;
  const newItem = data.item;
  const previously = player.equipment[target];

  // Everything that this equip will displace back into the pack: the piece in
  // the target slot, plus any hand-conflict that has to be stowed.
  const offId = player.equipment.offhand;
  const mainId = player.equipment.mainhand;
  const stowOff = target === "mainhand" && !!def.twoHand && !!offId;
  const stowMain =
    target === "offhand" && !!mainId && !!content.items[mainId].twoHand;
  const displaced: ItemId[] = [];
  if (previously) displaced.push(previously);
  if (stowOff) displaced.push(offId!);
  if (stowMain) displaced.push(mainId!);

  // Make sure every displaced item has a home BEFORE touching anything — taking
  // the new item out frees its slot only if it wasn't a stack. If something
  // wouldn't fit, abort the whole swap so a worn item can never be destroyed.
  const sim = player.inventory.map((s) => (s ? { item: s.item, qty: s.qty } : null));
  const src = sim[slot]!;
  src.qty -= 1;
  if (src.qty <= 0) sim[slot] = null;
  for (const it of displaced) {
    const stack = sim.find((s) => s?.item === it);
    if (stack) { stack.qty += 1; continue; }
    const empty = sim.findIndex((s) => s === null);
    if (empty === -1) {
      events.push({ type: "INVENTORY_FULL" });
      events.push({ type: "LOG", message: "You've no room to stow your old gear." });
      return;
    }
    sim[empty] = { item: it, qty: 1 };
  }

  // Feasible — now perform it for real (every addItem below is guaranteed room).
  data.qty -= 1;
  if (data.qty <= 0) player.inventory[slot] = null;
  player.equipment[target] = newItem;
  if (previously) addItem(player, previously, 1, events);
  if (stowOff) {
    delete player.equipment.offhand;
    addItem(player, offId!, 1, events);
  }
  if (stowMain) {
    delete player.equipment.mainhand;
    addItem(player, mainId!, 1, events);
  }
  events.push({ type: "LOG", message: `You equip the ${def.name}.` });
}

/** Nock a whole stack of arrows into the quiver, returning any other type held. */
function equipAmmo(
  player: Player,
  content: Content,
  slot: number,
  events: WorldEvent[],
): void {
  const data = player.inventory[slot];
  if (!data) return;
  const def = content.items[data.item];
  const current = player.equipment.ammo;
  const addQty = data.qty;
  // Take the whole stack out — freeing this slot guarantees room for any arrows
  // of a different type we hand back.
  player.inventory[slot] = null;
  if (current === data.item) {
    player.quiver += addQty;
  } else {
    if (current) addItem(player, current, player.quiver, events);
    player.equipment.ammo = data.item;
    player.quiver = addQty;
  }
  events.push({ type: "LOG", message: `You ready ${player.quiver}× ${def.name}.` });
}

/** Take a worn item off and return it to the pack (if there's room). */
function unequipSlot(
  player: Player,
  content: Content,
  eslot: EquipSlot,
  events: WorldEvent[],
): void {
  const worn = player.equipment[eslot];
  if (!worn) return;
  if (!canAddItem(player, worn)) {
    events.push({ type: "INVENTORY_FULL" });
    return;
  }
  // Arrows return as the whole nocked stack and reset the quiver.
  if (eslot === "ammo") {
    const qty = Math.max(1, player.quiver);
    delete player.equipment.ammo;
    player.quiver = 0;
    addItem(player, worn, qty, events);
    events.push({ type: "LOG", message: `You unstring ${qty}× ${content.items[worn].name}.` });
    return;
  }
  delete player.equipment[eslot];
  addItem(player, worn, 1, events);
  events.push({
    type: "LOG",
    message: `You unequip the ${content.items[worn].name}.`,
  });
}

/**
 * Begin repeating a station recipe (cooking/smelting/smithing/firemaking). The
 * actual making happens each tick in processActivity; this just validates the
 * choice and starts the activity so the client shows progress on the station.
 */
function startCraft(
  state: WorldState,
  content: Content,
  actionId: string,
  objId: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const action = content.actions.find((a) => a.id === actionId);
  if (!action || !action.produces) return;
  if (skillLvl(player, action.skill) < action.levelReq) {
    events.push({
      type: "LOG",
      message: `You need ${content.skills[action.skill].name} level ${action.levelReq}.`,
    });
    return;
  }
  if (!hasIngredients(player, action)) {
    events.push({ type: "LOG", message: "You don't have the materials." });
    return;
  }
  player.activity = {
    kind: "crafting",
    targetId: objId,
    actionId,
    nextActionAt: ctx.now + CRAFT_INTERVAL,
    actionInterval: CRAFT_INTERVAL,
  };
}

/** Eat the food in a slot, restoring HP (no-op if it's not food or full). */
function eatSlot(
  player: Player,
  content: Content,
  slot: number,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const data = player.inventory[slot];
  if (!data) return;
  const def = content.items[data.item];
  const canHeal = !!def.heals;
  const canBuff = !!(def.buff && def.buffMs);
  if (!canHeal && !canBuff) {
    events.push({ type: "LOG", message: `You can't use the ${def.name}.` });
    return;
  }
  // Don't waste a pure-heal at full HP; a buffed item is still worth using.
  if (canHeal && !canBuff && player.hp >= player.maxHp) {
    events.push({ type: "LOG", message: "You are already at full health." });
    return;
  }

  let msg = canHeal && def.buff ? `You drink the ${def.name}.` : `You ${def.cat === "Food" || canHeal ? "eat" : "drink"} the ${def.name}.`;
  if (canHeal) {
    player.hp = Math.min(player.maxHp, player.hp + def.heals!);
    msg += ` (+${def.heals})`;
  }
  if (canBuff) {
    player.buffs[def.buff!] = { amount: def.buffAmt ?? 0, until: ctx.now + def.buffMs! };
    msg += ` ${BUFF_LABEL[def.buff!] ?? def.buff} for ${Math.round(def.buffMs! / 60000)} min.`;
  }
  data.qty -= 1;
  if (data.qty <= 0) player.inventory[slot] = null;
  events.push({ type: "LOG", message: msg });
}

/** Player-facing names for each buff kind (used in the log + HUD). */
const BUFF_LABEL: Record<string, string> = {
  melee_acc: "+Accuracy",
  ranged_acc: "+Accuracy",
  melee_dmg: "+Damage",
  ranged_dmg: "+Damage",
  defence: "+Defence",
  gather_speed: "+Gathering speed",
  xp_boost: "+XP",
};

/** The amount of an active buff kind, or 0 if none is active. */
function buffVal(player: Player, kind: string): number {
  return player.buffs[kind]?.amount ?? 0;
}

/** Move every one of an item from the pack into the bank. */
function depositAll(player: Player, item: ItemId): void {
  let moved = 0;
  for (let i = 0; i < player.inventory.length; i++) {
    const slot = player.inventory[i];
    if (slot && slot.item === item) {
      moved += slot.qty;
      player.inventory[i] = null;
    }
  }
  if (moved > 0) player.bank[item] = (player.bank[item] ?? 0) + moved;
}

/** Withdraw one of an item from the bank into the pack (if there's room). */
function withdrawOne(player: Player, item: ItemId, events: WorldEvent[]): void {
  const have = player.bank[item] ?? 0;
  if (have <= 0) return;
  if (!addItem(player, item, 1, events)) return; // pack full; bank untouched
  if (have - 1 <= 0) delete player.bank[item];
  else player.bank[item] = have - 1;
}

function startInteraction(
  state: WorldState,
  content: Content,
  objId: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const def = findObjectDef(content, objId);
  if (!def) return;
  const obj = state.objects[objId];
  if (!obj) return;
  const { player } = state;
  const mode = player.pendingInteractMode;
  player.pendingInteractId = null;
  player.pendingInteractMode = null;

  switch (def.kind) {
    case "tree": {
      if (!obj.available) {
        events.push({ type: "LOG", message: "The tree has been felled." });
        return;
      }
      if (!beginGather(state, content, def, objId, "woodcutting", WOODCUTTING.interval, ctx, events)) {
        return;
      }
      events.push({ type: "LOG", message: "You swing your axe at the tree." });
      break;
    }

    case "rock": {
      if (!obj.available) {
        events.push({ type: "LOG", message: "The rock is depleted." });
        return;
      }
      if (!beginGather(state, content, def, objId, "mining", MINING.interval, ctx, events)) {
        return;
      }
      events.push({ type: "LOG", message: "You swing your pick at the rock." });
      break;
    }

    case "fishing_spot": {
      if (!beginGather(state, content, def, objId, "fishing", FISHING.interval, ctx, events)) {
        return;
      }
      events.push({ type: "LOG", message: "You cast your line into the water." });
      break;
    }

    case "trap": {
      if (!obj.available) {
        events.push({ type: "LOG", message: "The trap has sprung — give it time to reset." });
        return;
      }
      if (!beginGather(state, content, def, objId, "trapping", HUNTER.interval, ctx, events)) {
        return;
      }
      events.push({ type: "LOG", message: "You set the snare and wait for game." });
      break;
    }

    case "bounty_board": {
      player.station = { kind: "bounty" };
      events.push({ type: "OPEN_BOUNTY", objId });
      break;
    }

    case "npc": {
      // A shopkeeper can be talked to OR traded with. "shop" forces the trade
      // window; "talk" forces dialogue (and any quest); with no explicit mode,
      // the shop opens unless a quest step needs them right now.
      const shop = content.shops.find((s) => s.npc === def.id);
      const wantsShop = mode === "shop" || (mode !== "talk" && !questStepTargets(state.player, content, def.id));
      if (shop && wantsShop) {
        player.station = { kind: "shop", id: shop.id };
        events.push({ type: "OPEN_SHOP", shop: shop.id });
        break;
      }
      const lines = handleNpcTalk(state, content, def, events);
      if (lines.length > 0) {
        events.push({ type: "DIALOGUE", npc: def.name, lines });
      }
      break;
    }

    case "shrine":
    case "cart":
    case "fountain":
    case "critter":
    case "lamppost":
    case "signpost":
      // Examine-only landmark / city dressing / wildlife / signage.
      events.push({
        type: "LOG",
        message: def.lines?.[0] ?? `You study the ${def.name}.`,
      });
      break;

    case "waystone":
      events.push({ type: "OPEN_TRAVEL", objId });
      break;

    case "relic":
      readRelic(state, content, def, events);
      break;

    case "agility_obstacle":
      traverseObstacle(state, content, def, events);
      break;

    case "monster": {
      if (!obj.available) {
        events.push({ type: "LOG", message: "There is nothing here to fight." });
        return;
      }
      // Each side keeps its own swing clock: the player swings on weapon speed,
      // the monster on its own. Both start one interval out.
      const pSpeed = playerSpeed(player, content);
      const mSpeed = monsterFor(content, def)?.speed ?? COMBAT.monsterSpeed;
      player.activity = {
        kind: "combat",
        targetId: objId,
        actionId: null,
        nextActionAt: ctx.now + pSpeed,
        actionInterval: pSpeed,
      };
      obj.nextAttackAt = ctx.now + mSpeed;
      events.push({ type: "LOG", message: `You engage the ${def.name}.` });
      break;
    }

    case "bank":
      player.station = { kind: "bank" };
      events.push({ type: "OPEN_BANK" });
      break;

    // The processing stations open a recipe menu; the client lists what the
    // player can make (from content.actions) and sends back a CRAFT intent.
    case "fire":
    case "furnace":
    case "anvil":
    case "cauldron":
    case "workbench":
    case "crafting_table":
    case "sawmill":
      events.push({ type: "OPEN_CRAFT", station: def.kind, objId });
      break;

    case "plant_patch":
    case "tree_patch":
      interactPatch(state, content, def, obj, ctx, events);
      break;

    case "housing_plot":
      interactPlot(state, content, def, obj, events);
      break;

    case "build_hotspot":
      interactHotspot(state, def, obj, events);
      break;

    case "house_door": {
      // The outdoor door is gated on owning the plot; the interior door (no
      // plot) always lets you back out. Either way it just teleports you.
      if (def.plot && !state.objects[def.plot]?.owned) {
        events.push({ type: "LOG", message: "You'd need to claim this homestead before you could go in." });
        break;
      }
      usePortal(state, def, events);
      break;
    }

    case "room_seal": {
      if (obj.owned) { // already built — the doorway stands open
        events.push({ type: "LOG", message: "The doorway to your workshop wing stands open." });
        break;
      }
      events.push({
        type: "OPEN_EXTENSION", sealId: def.id,
        name: WORKSHOP_EXTENSION.name, levelReq: WORKSHOP_EXTENSION.levelReq,
        materials: WORKSHOP_EXTENSION.materials,
      });
      break;
    }

    case "portal":
      usePortal(state, def, events);
      break;
  }
}

/**
 * A homestead plot. Unclaimed → claim it (free; you're a frontier homesteader).
 * Claimed → report its standing (its tally of comfort across built furniture),
 * a gentle nudge toward the build hotspots that ring it.
 */
function interactPlot(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  events: WorldEvent[],
): void {
  if (!obj.owned) {
    obj.owned = true;
    if (!state.player.flags.includes("homesteader")) state.player.flags.push("homesteader");
    events.push({ type: "LOG", message: `You claim ${def.name}. Step inside and build to make it your own.` });
    return;
  }
  const comfort = homeComfort(state, content, def.id);
  events.push({
    type: "LOG",
    message: comfort > 0
      ? `${def.name} — by its comforts, ${comfortTitle(comfort)} (comfort ${comfort}). Keep upgrading the furnishings to raise its standing.`
      : `${def.name} — your home, bare as yet. Step inside and build to furnish it.`,
  });
}

/** A home's "rating" from its total comfort — the visible reward for furnishing. */
function comfortTitle(comfort: number): string {
  if (comfort >= 280) return "a Palace";
  if (comfort >= 190) return "an Estate";
  if (comfort >= 120) return "a Manor";
  if (comfort >= 60) return "a Fine Home";
  if (comfort >= 25) return "a Cottage";
  return "a Hovel";
}

/** Set comfort-tier story flags for a home (drive the housing achievements). */
function markHomeStanding(player: Player, content: Content, state: WorldState, plotId: string): void {
  const c = homeComfort(state, content, plotId);
  const set = (f: string) => { if (!player.flags.includes(f)) player.flags.push(f); };
  if (c >= 25) set("home_cottage");
  if (c >= 120) set("home_manor");
  if (c >= 280) set("home_palace");
}

/** Sum the comfort of every built piece across one plot's hotspots. */
function homeComfort(state: WorldState, content: Content, plotId: string): number {
  let total = 0;
  for (const d of content.objects) {
    if (d.kind !== "build_hotspot" || d.plot !== plotId) continue;
    const fid = state.objects[d.id]?.furniture;
    const f = fid ? content.furniture[fid] : undefined;
    if (f) total += f.comfort;
  }
  return total;
}

/**
 * A build hotspot. Only usable once its plot is claimed; then it opens the
 * furniture build/replace menu for its category (the client lists the pieces).
 */
function interactHotspot(
  state: WorldState,
  def: WorldObjectDef,
  obj: WorldObjectState,
  events: WorldEvent[],
): void {
  const plot = def.plot ? state.objects[def.plot] : undefined;
  if (!plot?.owned) {
    events.push({ type: "LOG", message: "You'd need to claim this homestead before building on it." });
    return;
  }
  events.push({
    type: "OPEN_BUILD",
    hotspotId: def.id,
    category: def.category ?? "hall",
    current: obj.furniture ?? null,
  });
}

/** Build (or replace) a furniture piece at a hotspot — the Construction sink. */
function buildFurniture(
  state: WorldState,
  content: Content,
  hotspotId: string,
  furnitureId: string,
  events: WorldEvent[],
): void {
  const { player } = state;
  const obj = state.objects[hotspotId];
  const def = findObjectDef(content, hotspotId);
  const f = content.furniture[furnitureId];
  if (!obj || !def || !f) return;
  const plot = def.plot ? state.objects[def.plot] : undefined;
  if (!plot?.owned) {
    events.push({ type: "LOG", message: "You don't own this homestead." });
    return;
  }
  if (f.category !== def.category) {
    events.push({ type: "LOG", message: `A ${f.name} doesn't belong at this footing.` });
    return;
  }
  if (obj.furniture === furnitureId) {
    events.push({ type: "LOG", message: `A ${f.name} already stands here.` });
    return;
  }
  if (skillLvl(player, "construction") < f.levelReq) {
    events.push({ type: "LOG", message: `You need Construction level ${f.levelReq} to build the ${f.name}.` });
    return;
  }
  // Check, then consume, every required material.
  for (const [item, qty] of Object.entries(f.materials)) {
    if (countItem(player, item as ItemId) < (qty ?? 0)) {
      events.push({ type: "LOG", message: `You're short of materials for the ${f.name}.` });
      return;
    }
  }
  for (const [item, qty] of Object.entries(f.materials)) {
    for (let i = 0; i < (qty ?? 0); i++) removeOneItem(player, item as ItemId);
  }
  obj.furniture = furnitureId;
  grantXp(state, content, "construction", f.xp, events);
  if (def.plot) markHomeStanding(player, content, state, def.plot); // comfort-tier flags → achievements
  // A bed makes the homestead your home: you respawn here from now on.
  if (f.bed && def.plot) {
    const plotDef = findObjectDef(content, def.plot);
    if (plotDef?.target) {
      player.spawn = { x: plotDef.target.x, y: plotDef.target.y };
      events.push({ type: "LOG", message: `You build the ${f.name}. This is your home now — you'll wake here.` });
      return;
    }
  }
  events.push({ type: "LOG", message: `You build the ${f.name}.` });
}

/** The one add-on wing you can build onto a home: the Workshop (forge/alch/bench). */
const WORKSHOP_EXTENSION = {
  name: "Workshop",
  levelReq: 15,
  materials: { plank_stonewood: 6, timber_frame: 4, mortar_basic: 4, stone_block: 4 } as Record<string, number>,
};

/** Build an add-on room: consume the materials, open the sealed doorway. */
function buildRoom(
  state: WorldState,
  content: Content,
  sealId: string,
  events: WorldEvent[],
): void {
  const { player } = state;
  const obj = state.objects[sealId];
  const def = findObjectDef(content, sealId);
  if (!obj || !def || def.kind !== "room_seal") return;
  if (obj.owned) { events.push({ type: "LOG", message: "That wing is already built." }); return; }
  if (def.plot && !state.objects[def.plot]?.owned) {
    events.push({ type: "LOG", message: "You don't own this homestead." });
    return;
  }
  const ext = WORKSHOP_EXTENSION;
  if (skillLvl(player, "construction") < ext.levelReq) {
    events.push({ type: "LOG", message: `Building the ${ext.name} wing needs Construction level ${ext.levelReq}.` });
    return;
  }
  for (const [item, qty] of Object.entries(ext.materials)) {
    if (countItem(player, item as ItemId) < qty) {
      events.push({ type: "LOG", message: `You're short of materials to raise the ${ext.name} wing.` });
      return;
    }
  }
  for (const [item, qty] of Object.entries(ext.materials)) {
    for (let i = 0; i < qty; i++) removeOneItem(player, item as ItemId);
  }
  obj.owned = true; // the doorway opens (walkability reads this live)
  grantXp(state, content, "construction", 220, events);
  events.push({ type: "LOG", message: `You raise the ${ext.name} wing. The doorway opens onto your new room.` });
}

/** Use a built functional piece as a station — bank / cook / build, at home. */
function useFurniture(
  state: WorldState,
  content: Content,
  hotspotId: string,
  events: WorldEvent[],
): void {
  const obj = state.objects[hotspotId];
  const f = obj?.furniture ? content.furniture[obj.furniture] : undefined;
  if (!obj || !f || !f.station) {
    events.push({ type: "LOG", message: "There's nothing here to use." });
    return;
  }
  if (f.station === "bank") {
    state.player.station = { kind: "bank" };
    events.push({ type: "OPEN_BANK" });
    return;
  }
  // Any other station value is a crafting-station ObjKind (fire/workbench/etc).
  events.push({ type: "OPEN_CRAFT", station: f.station as ObjKind, objId: hotspotId });
}

/** Clear a hotspot's furniture (no refund — you scrap the piece). */
function removeFurniture(
  state: WorldState,
  content: Content,
  hotspotId: string,
  events: WorldEvent[],
): void {
  const obj = state.objects[hotspotId];
  const def = findObjectDef(content, hotspotId);
  if (!obj || !def) return;
  if (!obj.furniture) {
    events.push({ type: "LOG", message: "There's nothing built here to clear." });
    return;
  }
  const f = content.furniture[obj.furniture];
  delete obj.furniture;
  events.push({ type: "LOG", message: `You clear away the ${f?.name ?? "furniture"}.` });
}

/**
 * Read a relic out in the world. The first time, record the lore fragment in the
 * Archive and pay a small one-time finder's reward; either way, show the passage.
 * The relic stays put so it can be re-read — the reward is gated by player.lore.
 */
function readRelic(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  events: WorldEvent[],
): void {
  const { player } = state;
  const entry = def.loreId ? content.lore.find((l) => l.id === def.loreId) : undefined;
  if (!entry) {
    events.push({ type: "LOG", message: `You study the ${def.name}, but make nothing of it.` });
    return;
  }
  if (!player.lore.includes(entry.id)) {
    player.lore.push(entry.id);
    events.push({ type: "LOG", message: `Archive — you uncover "${entry.title}".` });
    const r = entry.reward;
    if (r?.gold) {
      player.gold += r.gold;
      player.stats.goldEarned += r.gold;
      events.push({ type: "LOG", message: `A finder's reward: ${r.gold} gold.` });
    }
    if (r?.xp) grantXp(state, content, r.xp.skill, r.xp.amount, events);
  }
  // Show the passage in the dialogue box, the relic's title at its head.
  events.push({ type: "DIALOGUE", npc: entry.title, lines: entry.text });
}

/** Empty patch → pick a seed; growing → time left; ripe → harvest. */
function interactPatch(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const patchType = def.kind === "tree_patch" ? "tree" : "plant";
  if (!obj.crop) {
    events.push({ type: "OPEN_PLANT", patchId: def.id, patchType });
    return;
  }
  const crop = content.crops[obj.crop];
  if (!crop) { delete obj.crop; return; }
  const readyAt = (obj.plantedAt ?? 0) + crop.growthMs;
  if (ctx.epoch < readyAt) {
    const mins = Math.ceil((readyAt - ctx.epoch) / 60000);
    events.push({ type: "LOG", message: `${crop.name} is still growing — about ${mins} min left.` });
    return;
  }
  harvestPatch(state, content, obj, crop, ctx, events);
}

/** Harvest a ripe patch: roll survival, grant produce + XP, clear the patch. */
function harvestPatch(
  state: WorldState,
  content: Content,
  obj: WorldObjectState,
  crop: CropDef,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  delete obj.crop;
  delete obj.plantedAt;
  if (ctx.rng() >= crop.baseChance) {
    grantXp(state, content, "farming", Math.floor(crop.xpHarvest * 0.1), events);
    events.push({ type: "LOG", message: `Your ${crop.name} withered before harvest.` });
    return;
  }
  const qty = randInt(ctx, crop.produceMin, crop.produceMax);
  addItem(player, crop.produce, qty, events);
  grantXp(state, content, "farming", crop.xpHarvest, events);
  events.push({ type: "LOG", message: `You harvest ${qty}× ${content.items[crop.produce].name}.` });
  if (crop.bonusDrop && crop.bonusChance && ctx.rng() < crop.bonusChance && content.items[crop.bonusDrop]) {
    if (canAddItem(player, crop.bonusDrop)) addItem(player, crop.bonusDrop, 1, events);
  }
}

/** Plant a crop's seed in an empty patch (consumes the seed, grants plant XP). */
function plantSeed(
  state: WorldState,
  content: Content,
  patchId: string,
  cropId: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const obj = state.objects[patchId];
  const def = findObjectDef(content, patchId);
  const crop = content.crops[cropId];
  if (!obj || !def || !crop) return;
  const patchType = def.kind === "tree_patch" ? "tree" : "plant";
  if (crop.type !== patchType) {
    events.push({ type: "LOG", message: `That seed doesn't belong in this patch.` });
    return;
  }
  if (obj.crop) {
    events.push({ type: "LOG", message: "Something is already growing here." });
    return;
  }
  if (skillLvl(player, "farming") < crop.levelReq) {
    events.push({ type: "LOG", message: `You need Farming level ${crop.levelReq} to plant ${crop.name}.` });
    return;
  }
  if (countItem(player, crop.seed) < 1) {
    events.push({ type: "LOG", message: `You have no ${content.items[crop.seed].name}.` });
    return;
  }
  removeOneItem(player, crop.seed);
  obj.crop = cropId;
  obj.plantedAt = ctx.epoch;
  grantXp(state, content, "farming", crop.xpPlant, events);
  const mins = Math.ceil(crop.growthMs / 60000);
  events.push({ type: "LOG", message: `You plant ${crop.name}. Ready in about ${mins} min.` });
}

/** The Courier's toll between two points — scales with distance, with a floor. */
export function travelFare(from: Vec2, destTarget: Vec2): number {
  const d = Math.max(Math.abs(from.x - destTarget.x), Math.abs(from.y - destTarget.y));
  return Math.max(15, Math.round(d));
}

/** Pay the toll and fast-travel to a waystone's arrival tile. */
function travelTo(
  state: WorldState,
  content: Content,
  toObjId: string,
  events: WorldEvent[],
): void {
  const def = findObjectDef(content, toObjId);
  if (!def || def.kind !== "waystone" || !def.target) return;
  const { player } = state;
  const fare = travelFare(player.pos, def.target);
  if (player.gold < fare) {
    events.push({ type: "LOG", message: `The toll to ${def.name} is ${fare}g — you can't cover it.` });
    return;
  }
  player.gold -= fare;
  player.pos = { x: def.target.x, y: def.target.y };
  player.path = [];
  player.pendingInteractId = null;
  clearActivity(player);
  events.push({ type: "LOG", message: `You pay the Courier ${fare}g and ride to ${def.name}.` });
}

/**
 * Clear one leg of an Agility circuit. Obstacles must be taken in order; the
 * first (order 0) starts a lap, the last pays a lap-completion bonus. Each clear
 * grants Agility XP and hops the player to the obstacle's far side.
 */
function traverseObstacle(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  events: WorldEvent[],
): void {
  const { player } = state;
  const course = def.course;
  const order = def.order ?? 0;
  if (!course) return;

  // Course-wide level gate (every obstacle carries the requirement).
  const req = def.levelReq ?? 1;
  if (skillLvl(player, "agility") < req) {
    events.push({ type: "LOG", message: `You need Agility level ${req} to train here.` });
    return;
  }

  const lap = player.agilityLap;
  const isStart = order === 0;
  const inSequence = lap && lap.course === course && lap.next === order;
  if (!isStart && !inSequence) {
    events.push({ type: "LOG", message: `Start at the beginning of the ${def.name.replace(/:.*$/, "")} course.` });
    return;
  }

  // The obstacles of this course, to know where the lap ends.
  const legs = content.objects.filter((o) => o.kind === "agility_obstacle" && o.course === course);
  const lastOrder = legs.reduce((m, o) => Math.max(m, o.order ?? 0), 0);

  grantXp(state, content, "agility", def.xp ?? 10, events);
  // Hop to the far side (and re-arm the run clock so a hop never feels stuck).
  if (def.exit) {
    player.pos = { x: def.exit.x, y: def.exit.y };
    player.path = [];
    player.pendingInteractId = null;
  }

  if (order >= lastOrder) {
    // Lap complete — pay the bonus and reset for another circuit.
    const total = legs.reduce((s, o) => s + (o.xp ?? 0), 0);
    const bonus = Math.round(total * AGILITY_LAP_BONUS_MULT);
    if (bonus > 0) grantXp(state, content, "agility", bonus, events);
    player.agilityLap = null;
    events.push({ type: "LOG", message: "Lap complete! You catch your breath, pleased with the run." });
  } else {
    player.agilityLap = { course, next: order + 1 };
  }
}

/** A portal teleports the player to its paired destination (boss arena ↔ home). */
function usePortal(
  state: WorldState,
  def: WorldObjectDef,
  events: WorldEvent[],
): void {
  if (!def.target) return;
  const { player } = state;
  player.pos = { x: def.target.x, y: def.target.y };
  player.path = [];
  player.pendingInteractId = null;
  clearActivity(player);
  if (def.lines?.[0]) events.push({ type: "LOG", message: def.lines[0] });
}

// ---------------------------------------------------------------------------
// The tick: advancing time. Movement, activities, combat and respawns.
// ---------------------------------------------------------------------------

/** A guaranteed-standable respawn point: the spawn tile, or the nearest land. */
function respawnTile(content: Content, spawn: Vec2): Vec2 {
  const { map } = content;
  const solid = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
    const t = map.tiles[y * map.width + x];
    return t === "water" || t === "mountain" || t === "cave_wall" || t === "deep" || t === "wall";
  };
  if (!solid(spawn.x, spawn.y)) return { x: spawn.x, y: spawn.y };
  for (let r = 1; r <= 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!solid(spawn.x + dx, spawn.y + dy)) return { x: spawn.x + dx, y: spawn.y + dy };
      }
    }
  }
  return { x: spawn.x, y: spawn.y };
}

/**
 * Aggressive monsters strike first. If the player is idle/walking (not already
 * fighting, gathering or crafting) and steps within AGGRO_RANGE of an awake
 * predator, that monster pulls them into combat and gets the first swing — so
 * the wilderness can no longer be strolled through untouched.
 */
function checkAggro(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  if (!player.alive || player.activity.kind !== "idle") return;
  for (const def of content.objects) {
    if (def.kind !== "monster" || !AGGRESSIVE.has(def.monster ?? "")) continue;
    const obj = state.objects[def.id];
    if (!obj || !obj.available || obj.hp === undefined) continue;
    const mp = obj.pos ?? { x: def.x, y: def.y };
    if (Math.hypot(mp.x - player.pos.x, mp.y - player.pos.y) > AGGRO_RANGE) continue;
    const pSpeed = playerSpeed(player, content);
    const mSpeed = monsterFor(content, def)?.speed ?? COMBAT.monsterSpeed;
    player.path = [];
    player.pendingInteractId = null;
    player.station = null;
    player.activity = {
      kind: "combat",
      targetId: def.id,
      actionId: null,
      nextActionAt: ctx.now + pSpeed,
      actionInterval: pSpeed,
    };
    obj.nextAttackAt = ctx.now + Math.floor(mSpeed / 2); // it gets the jump on you
    events.push({ type: "LOG", message: `The ${def.name} attacks!` });
    return; // one engagement per tick
  }
}

export function tick(
  state: WorldState,
  content: Content,
  ctx: Ctx,
): WorldEvent[] {
  const events: WorldEvent[] = [];
  // Clamp dt so a backgrounded tab doesn't teleport everything at once.
  const dt = Math.min(Math.max(ctx.now - state.lastTick, 0), 250);
  state.lastTick = ctx.now;

  const { player } = state;

  // 0) Keep max HP in step with the Vitality level (leveling up heals you).
  syncMaxHp(player);

  // 0b) Expire any temporary buffs whose time is up.
  for (const kind of Object.keys(player.buffs)) {
    if (ctx.now >= player.buffs[kind]!.until) {
      delete player.buffs[kind];
      events.push({ type: "LOG", message: `Your ${(BUFF_LABEL[kind] ?? kind).replace(/^\+/, "")} boost fades.` });
    }
  }

  // 1) Respawn the player if they're dead and their timer is up.
  if (!player.alive) {
    if (ctx.now >= player.respawnAt) {
      player.alive = true;
      player.hp = player.maxHp;
      player.pos = respawnTile(content, player.spawn);
      player.path = [];
      clearActivity(player);
      events.push({ type: "PLAYER_RESPAWNED" });
    }
  } else {
    // 2) Movement. Sprinting drains run energy; otherwise it recovers.
    const wasMoving = player.path.length > 0;
    const sprintTiles = wasMoving ? stepMovement(player, dt) : 0;
    if (sprintTiles <= 0) {
      if (player.energy < ENERGY_MAX) {
        const regen = (ENERGY_REGEN * agilityRegenMult(player) * dt) / 1000;
        player.energy = Math.min(ENERGY_MAX, player.energy + regen);
      }
      if (player.winded && player.energy >= ENERGY_RECOVER) player.winded = false; // caught your breath
    }
    const arrived = wasMoving && player.path.length === 0;
    if (arrived && player.pendingInteractId) {
      startInteraction(state, content, player.pendingInteractId, ctx, events);
    }

    // 3) Whatever the player is busy doing (only when standing still).
    if (player.path.length === 0) {
      processActivity(state, content, ctx, events);
    }

    // 3b) Auto-advance any "gather X" quest objective now satisfied.
    checkGatherQuests(state, content, events);

    // 3c) Aggressive monsters you've wandered too close to strike first.
    checkAggro(state, content, ctx, events);
  }

  // 4) Respawn depleted resources / dead monsters whose timers are up.
  for (const def of content.objects) {
    const obj = state.objects[def.id];
    if (!obj || obj.available) continue;
    if (ctx.now >= obj.respawnAt) {
      obj.available = true;
      if (def.kind === "monster") {
        obj.hp = monsterFor(content, def)?.hp ?? 1;
        obj.nextAttackAt = 0;
        // A slain monster comes back at its spawn, not where it wandered to die.
        obj.pos = { x: def.x, y: def.y };
        obj.wanderTarget = null;
        obj.nextWanderAt = ctx.now + WANDER.pauseMin;
        // Fresh boss fight: reset its special-move state.
        obj.swings = 0;
        obj.enraged = false;
        obj.healed = false;
      }
      events.push({ type: "OBJECT_RESPAWNED", objId: def.id });
    }
  }

  // 5) Idle wandering: npcs + monsters amble within reach of their spawn.
  wanderCreatures(state, content, ctx, dt);

  // 6) Light up any newly-earned achievements.
  checkAchievements(state, content, events);

  return events;
}

/**
 * Step every wandering creature one unhurried tile-walk at a time, within
 * WANDER.radius of its spawn. Creatures hold still while the player is right
 * beside them (so talking / engaging is never a moving target) and while a
 * monster is the player's active combat target. Rebuilds state.creatureTiles
 * from live positions so the player's pathfinder routes around them.
 */
function wanderCreatures(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  dt: number,
): void {
  const { player } = state;
  const walk = baseWalkable(content);
  const pTile = { x: Math.round(player.pos.x), y: Math.round(player.pos.y) };

  // Rebuild the live occupancy set from where creatures currently stand (and the
  // tiles they're stepping into), so reservations are honoured within this pass.
  const occupied = state.creatureTiles;
  occupied.clear();
  for (const def of content.objects) {
    if (def.kind === "critter") continue; // ambient wildlife doesn't block
    const obj = state.objects[def.id];
    if (!obj || !obj.pos || !obj.available) continue;
    occupied.add(`${Math.round(obj.pos.x)},${Math.round(obj.pos.y)}`);
    if (obj.wanderTarget) occupied.add(`${obj.wanderTarget.x},${obj.wanderTarget.y}`);
  }

  for (const def of content.objects) {
    if (def.kind !== "npc" && def.kind !== "monster" && def.kind !== "critter") continue;
    const obj = state.objects[def.id];
    if (!obj || !obj.pos || !obj.available) continue;
    const isCritter = def.kind === "critter";

    // Mid-step: keep walking toward the reserved target tile.
    if (obj.wanderTarget) {
      const speed = isCritter ? WANDER.speed * 1.6 : WANDER.speed; // critters are quick
      const reached = stepToward(obj.pos, obj.wanderTarget, (speed * dt) / 1000);
      if (reached) {
        obj.pos = { x: obj.wanderTarget.x, y: obj.wanderTarget.y };
        obj.wanderTarget = null;
        obj.nextWanderAt = ctx.now + randRange(ctx, WANDER.pauseMin, WANDER.pauseMax);
      }
      continue;
    }

    // Standing still: hold position while engaged or while the player is beside
    // us; otherwise, when the pause elapses, pick the next step.
    const here = { x: Math.round(obj.pos.x), y: Math.round(obj.pos.y) };
    const engaged = player.activity.kind === "combat" && player.activity.targetId === def.id;
    const playerBeside = Math.max(Math.abs(here.x - pTile.x), Math.abs(here.y - pTile.y)) <= 1;
    if (engaged || playerBeside) {
      // A startled critter bolts a step away instead of freezing.
      if (isCritter && playerBeside && !engaged) {
        const ax = here.x + (here.x === pTile.x ? (ctx.rng() < 0.5 ? 1 : -1) : Math.sign(here.x - pTile.x));
        const ay = here.y + (here.y === pTile.y ? (ctx.rng() < 0.5 ? 1 : -1) : Math.sign(here.y - pTile.y));
        for (const [nx, ny] of [[ax, here.y], [here.x, ay], [ax, ay]] as const) {
          if (Math.max(Math.abs(nx - def.x), Math.abs(ny - def.y)) > WANDER.radius + 3) continue;
          if (!walk(nx, ny) || (nx === pTile.x && ny === pTile.y)) continue;
          obj.wanderTarget = { x: nx, y: ny };
          break;
        }
        continue;
      }
      obj.nextWanderAt = ctx.now + WANDER.pauseMin;
      continue;
    }
    if (ctx.now < (obj.nextWanderAt ?? 0)) continue;

    // Candidate steps: the four neighbours, shuffled, that stay in range and are
    // free of terrain, fixed objects, the player and other creatures.
    const steps = shuffle4(ctx);
    let moved = false;
    for (const [dx, dy] of steps) {
      const nx = here.x + dx;
      const ny = here.y + dy;
      if (Math.max(Math.abs(nx - def.x), Math.abs(ny - def.y)) > WANDER.radius) continue;
      if (!walk(nx, ny)) continue;
      if (nx === pTile.x && ny === pTile.y) continue;
      if (occupied.has(`${nx},${ny}`)) continue;
      obj.wanderTarget = { x: nx, y: ny };
      occupied.add(`${nx},${ny}`); // reserve so the next creature won't pick it
      moved = true;
      break;
    }
    // Boxed in for now — try again after a short pause.
    if (!moved) obj.nextWanderAt = ctx.now + WANDER.pauseMin;
  }
}

/** Move `pos` toward `target` by up to `budget` tiles; true if it arrives. */
function stepToward(pos: Vec2, target: Vec2, budget: number): boolean {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= budget || dist < 1e-6) return true;
  pos.x += (dx / dist) * budget;
  pos.y += (dy / dist) * budget;
  return false;
}

/** Terrain + fixed-object walkability only (ignores creatures), for wandering. */
const baseWalkCache = new WeakMap<Content, (x: number, y: number) => boolean>();
function baseWalkable(content: Content): (x: number, y: number) => boolean {
  let fn = baseWalkCache.get(content);
  if (fn) return fn;
  const blocked = new Set<string>();
  for (const obj of content.objects) {
    if (BLOCKING_KINDS.has(obj.kind)) blocked.add(`${obj.x},${obj.y}`);
  }
  const { map } = content;
  fn = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const tile = map.tiles[y * map.width + x];
    if (tile === "water" || tile === "mountain" || tile === "cave_wall" || tile === "deep" || tile === "wall") {
      return false;
    }
    return !blocked.has(`${x},${y}`);
  };
  baseWalkCache.set(content, fn);
  return fn;
}

const STEP4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** The four cardinal steps in a rng-shuffled order. */
function shuffle4(ctx: Ctx): Array<readonly [number, number]> {
  const a = STEP4.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

/** A random integer ms in [min, max]. */
function randRange(ctx: Ctx, min: number, max: number): number {
  return min + Math.floor(ctx.rng() * (max - min + 1));
}

/** Higher Agility drains run energy more slowly (0..1 of full drain). */
function agilityDrainMult(player: Player): number {
  const lvl = player.skills.agility?.level ?? 1;
  return 1 - AGILITY_DRAIN_REDUCTION * ((lvl - 1) / (LEVEL_CAP - 1));
}

/** Higher Agility recovers run energy faster (1..1+bonus). */
function agilityRegenMult(player: Player): number {
  const lvl = player.skills.agility?.level ?? 1;
  return 1 + AGILITY_REGEN_BONUS * ((lvl - 1) / (LEVEL_CAP - 1));
}

/** Advance the player along their path; returns the tiles travelled while sprinting. */
function stepMovement(player: Player, dt: number): number {
  const sprinting = player.running && player.energy > 0 && !player.winded;
  const speed =
    MOVE_SPEED * (player.equipment.mount ? MOUNT_SPEED_MULT : 1) * (sprinting ? SPRINT_MULT : 1);
  const startBudget = (speed * dt) / 1000; // tiles of travel allowed this tick
  let budget = startBudget;
  while (budget > 0 && player.path.length > 0) {
    const target = player.path[0]!;
    const dx = target.x - player.pos.x;
    const dy = target.y - player.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= budget || dist < 1e-6) {
      player.pos = { x: target.x, y: target.y };
      player.path.shift();
      budget -= dist;
    } else {
      player.pos = {
        x: player.pos.x + (dx / dist) * budget,
        y: player.pos.y + (dy / dist) * budget,
      };
      budget = 0;
    }
  }
  const moved = startBudget - budget; // tiles actually walked this tick
  if (sprinting && moved > 0) {
    player.energy = Math.max(0, player.energy - moved * ENERGY_DRAIN * agilityDrainMult(player));
    if (player.energy <= 0) player.winded = true; // out of breath — walk to recover
    return moved;
  }
  return 0;
}

function processActivity(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const act = player.activity;
  if (act.kind === "idle" || act.targetId === null) return;

  const obj = state.objects[act.targetId];
  const def = findObjectDef(content, act.targetId);
  if (!obj || !def) {
    clearActivity(player);
    return;
  }

  // Combat has two independent clocks (player + monster), so it can't use the
  // single-timer gate below — it manages its own timing.
  if (act.kind === "combat") {
    resolveCombat(state, content, def, obj, ctx, events);
    return;
  }

  if (ctx.now < act.nextActionAt) return;

  switch (act.kind) {
    case "woodcutting":
      gatherStep(state, content, obj, ctx, events, WOODCUTTING, true);
      break;
    case "mining":
      gatherStep(state, content, obj, ctx, events, MINING, true);
      break;
    case "fishing":
      gatherStep(state, content, obj, ctx, events, FISHING, false);
      break;
    case "trapping":
      gatherStep(state, content, obj, ctx, events, HUNTER, true);
      break;
    case "crafting":
      processCraft(state, content, ctx, events);
      break;
  }
}

/**
 * One gathering "swing": roll for success, give the node's item + XP (read from
 * the action the node yields), roll any rare drop, and — for depleting nodes —
 * roll whether the node runs out. Continuous nodes (fishing) never deplete.
 */
function gatherStep(
  state: WorldState,
  content: Content,
  obj: WorldObjectState,
  ctx: Ctx,
  events: WorldEvent[],
  beh: { interval: number; success: number; deplete?: number; respawn?: number },
  depletes: boolean,
): void {
  const { player } = state;
  const act = player.activity;
  const action = act.actionId
    ? content.actions.find((a) => a.id === act.actionId)
    : undefined;
  if (!action || !action.produces) {
    clearActivity(player);
    return;
  }
  if (depletes && !obj.available) {
    clearActivity(player);
    return;
  }
  if (ctx.rng() < beh.success) {
    if (!canAddItem(player, action.produces)) {
      events.push({ type: "INVENTORY_FULL" });
      clearActivity(player);
      return;
    }
    grantXp(state, content, action.skill, action.xp, events);
    addItem(player, action.produces, action.produceQty ?? 1, events);
    events.push({
      type: "LOG",
      message: `You get ${content.items[action.produces].name}.`,
    });
    tryPetDrop(state, content, action.skill, ctx, events);
    // A node's rare drop (bird nest, gem, etc.).
    if (
      action.rareDrop &&
      ctx.rng() < action.rareDrop.chance &&
      canAddItem(player, action.rareDrop.item)
    ) {
      addItem(player, action.rareDrop.item, 1, events);
    }
    if (depletes && ctx.rng() < (beh.deplete ?? 0)) {
      obj.available = false;
      obj.respawnAt = ctx.now + (beh.respawn ?? 7000);
      const dname = content.objects.find((d) => d.id === obj.id)?.name ?? "node";
      events.push({ type: "LOG", message: `The ${dname} is worked out — it'll recover shortly.` });
      events.push({ type: "OBJECT_DEPLETED", objId: obj.id });
      clearActivity(player);
      return;
    }
  }
  // Use the activity's interval (already adjusted for tool tier), not the base.
  act.nextActionAt = ctx.now + (act.actionInterval || beh.interval);
}

/**
 * Make one unit of the activity's recipe, then keep going. Stops cleanly when
 * the materials run out, the pack is full, or the level no longer qualifies.
 */
function processCraft(
  state: WorldState,
  content: Content,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const act = player.activity;
  const action = act.actionId
    ? content.actions.find((a) => a.id === act.actionId)
    : undefined;
  if (!action || !action.produces) {
    clearActivity(player);
    return;
  }
  if (skillLvl(player, action.skill) < action.levelReq) {
    clearActivity(player);
    return;
  }
  if (!hasIngredients(player, action)) {
    events.push({ type: "LOG", message: "You've run out of materials." });
    clearActivity(player);
    return;
  }
  if (!canAddItem(player, action.produces)) {
    events.push({ type: "INVENTORY_FULL" });
    clearActivity(player);
    return;
  }
  consumeIngredients(player, action);
  grantXp(state, content, action.skill, action.xp, events);
  addItem(player, action.produces, action.produceQty ?? 1, events);
  events.push({
    type: "LOG",
    message: `You make ${content.items[action.produces].name}.`,
  });
  tryPetDrop(state, content, action.skill, ctx, events);
  act.nextActionAt = ctx.now + CRAFT_INTERVAL;
}

// --- Quests --------------------------------------------------------------

/** Does any active quest's current step (talk/deliver/choice) target this NPC? */
function questStepTargets(
  player: Player,
  content: Content,
  npcId: string,
): boolean {
  for (const qid of Object.keys(player.quests)) {
    const def = content.quests.find((q) => q.id === qid);
    if (!def) continue;
    const step = def.steps[player.quests[qid]!.step];
    if (!step) continue;
    if (
      (step.type === "talk" || step.type === "deliver" || step.type === "choice") &&
      step.npc === npcId
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Decide what an NPC says when talked to, handling quest accept / progress /
 * turn-in along the way. Returns the dialogue lines to show.
 */
function handleNpcTalk(
  state: WorldState,
  content: Content,
  npcDef: WorldObjectDef,
  events: WorldEvent[],
): string[] {
  const { player } = state;
  const npcId = npcDef.id;

  // 1) Progress any active quest whose CURRENT step targets THIS npc. Steps may
  //    point at any NPC, not just the quest's giver — a giver can send you to
  //    talk to, deliver to, or be questioned by someone across the map.
  for (const qid of Object.keys(player.quests)) {
    const def = content.quests.find((q) => q.id === qid);
    if (!def) continue;
    const st = player.quests[qid]!;
    const obj = def.steps[st.step];
    if (!obj) continue;
    if (obj.type === "talk" && obj.npc === npcId) {
      return advanceQuest(state, content, def, st, events);
    }
    if (obj.type === "deliver" && obj.npc === npcId) {
      if (countItem(player, obj.item) >= obj.count) {
        for (let i = 0; i < obj.count; i++) removeOneItem(player, obj.item);
        return advanceQuest(state, content, def, st, events);
      }
      return [`Bring me ${obj.count} ${content.items[obj.item].name} — ${obj.text.toLowerCase()}.`];
    }
    if (obj.type === "choice" && obj.npc === npcId) {
      // Don't advance — ask the client to present the options (no dialogue box).
      events.push({
        type: "QUEST_CHOICE",
        quest: qid,
        prompt: obj.prompt,
        options: obj.options.map((o) => o.label),
      });
      return [];
    }
  }

  // 2) A quest from THIS giver is active, but its current step is elsewhere —
  //    nudge the player toward whatever it's asking for.
  for (const qid of Object.keys(player.quests)) {
    const def = content.quests.find((q) => q.id === qid);
    if (!def || def.giver !== npcId) continue;
    const obj = def.steps[player.quests[qid]!.step];
    if (obj) return [`You're not done yet: ${obj.text}.`];
  }

  // 3) Offer the next available quest from this NPC.
  const offer = content.quests.find((q) => q.giver === npcId && questAvailable(player, q));
  if (offer) {
    player.quests[offer.id] = { step: 0, killCount: 0 };
    events.push({ type: "QUEST_STARTED", quest: offer.id });
    events.push({ type: "LOG", message: `Quest started: ${offer.name}.` });
    return offer.intro;
  }

  // 4) Otherwise, ordinary chatter.
  return npcDef.lines ?? ["..."];
}

/**
 * Advance an active quest one step. If that finishes it, grant the reward and
 * return the outro lines; otherwise log the next objective. Returns lines for
 * dialogue (callers that aren't talking just ignore them).
 */
function advanceQuest(
  state: WorldState,
  content: Content,
  def: QuestDef,
  st: QuestState,
  events: WorldEvent[],
): string[] {
  const { player } = state;
  st.step += 1;
  st.killCount = 0;
  if (st.step >= def.steps.length) {
    grantQuestReward(state, content, def, events);
    delete player.quests[def.id];
    if (!player.questsDone.includes(def.id)) player.questsDone.push(def.id);
    events.push({ type: "QUEST_COMPLETED", quest: def.id });
    events.push({ type: "LOG", message: `Quest complete: ${def.name}!` });
    return def.outro;
  }
  events.push({ type: "QUEST_ADVANCED", quest: def.id });
  events.push({ type: "LOG", message: `${def.name}: ${def.steps[st.step]!.text}.` });
  return [`${def.steps[st.step]!.text}.`];
}

function grantQuestReward(
  state: WorldState,
  content: Content,
  def: QuestDef,
  events: WorldEvent[],
): void {
  const { player } = state;
  for (const x of def.reward.xp ?? []) {
    grantXp(state, content, x.skill, x.amount, events);
  }
  for (const it of def.reward.items ?? []) {
    // A reward must never be lost to a full pack — if it won't fit, bank it.
    if (canAddItem(player, it.item)) {
      addItem(player, it.item, it.qty, events);
    } else {
      player.bank[it.item] = (player.bank[it.item] ?? 0) + it.qty;
      events.push({ type: "ITEM_GAINED", item: it.item, qty: it.qty });
      events.push({ type: "LOG", message: `Your pack was full — ${content.items[it.item].name} was sent to your bank.` });
    }
  }
  for (const f of def.reward.flags ?? []) {
    if (!player.flags.includes(f)) player.flags.push(f);
  }
  if (def.reward.gold) {
    player.gold += def.reward.gold;
    player.stats.goldEarned += def.reward.gold;
    events.push({ type: "LOG", message: `You receive ${def.reward.gold}g.` });
  }
  applyRep(player, content, def.reward.rep, events);
}

/** How many distinct companion items the player owns (pack/bank/summoned). */
export function companionCount(player: Player, content: Content): number {
  const owned = new Set<ItemId>();
  for (const s of player.inventory) {
    if (s && content.items[s.item]?.slot === "companion") owned.add(s.item);
  }
  for (const id of Object.keys(player.bank) as ItemId[]) {
    if ((player.bank[id] ?? 0) > 0 && content.items[id]?.slot === "companion") owned.add(id);
  }
  if (player.equipment.companion) owned.add(player.equipment.companion);
  return owned.size;
}

/** Evaluate one achievement condition: current value, target, and met? */
export function evalAchievement(
  player: Player,
  content: Content,
  cond: AchievementCond,
): { cur: number; target: number; met: boolean } {
  const done = (cur: number, target: number) => ({ cur, target, met: cur >= target });
  const skillLevels = Object.values(player.skills).map((s) => s.level);
  switch (cond.type) {
    case "skillLevel":
      return done(skillLvl(player, cond.skill), cond.level);
    case "anySkillLevel":
      return done(Math.max(...skillLevels), cond.level);
    case "totalLevel":
      return done(skillLevels.reduce((n, l) => n + l, 0), cond.total);
    case "combatLevel":
      return done(combatLevel(player), cond.level);
    case "questDone":
      return done(player.questsDone.includes(cond.quest) ? 1 : 0, 1);
    case "flag":
      return done(player.flags.includes(cond.flag) ? 1 : 0, 1);
    case "goldEarned":
      return done(player.stats.goldEarned, cond.amount);
    case "monstersSlain":
      return done(player.stats.monstersSlain, cond.count);
    case "companions":
      return done(companionCount(player, content), cond.count);
    case "anyRepAtLeast":
      return done(Math.max(...Object.values(player.reputation)), cond.amount);
  }
}

/** Unlock any newly-earned achievements and announce them. */
function checkAchievements(
  state: WorldState,
  content: Content,
  events: WorldEvent[],
): void {
  const { player } = state;
  for (const a of content.achievements) {
    if (player.achievements.includes(a.id)) continue;
    if (evalAchievement(player, content, a.cond).met) {
      player.achievements.push(a.id);
      events.push({ type: "ACHIEVEMENT", id: a.id, name: a.name });
      events.push({ type: "LOG", message: `Achievement unlocked: ${a.name}!` });
    }
  }
}

/** Adjust faction standing and announce each change. */
function applyRep(
  player: Player,
  content: Content,
  changes: RepChange[] | undefined,
  events: WorldEvent[],
): void {
  for (const c of changes ?? []) {
    player.reputation[c.faction] = (player.reputation[c.faction] ?? 0) + c.amount;
    const name = content.factions.find((f) => f.id === c.faction)?.name ?? c.faction;
    const sign = c.amount >= 0 ? "+" : "";
    events.push({ type: "LOG", message: `${name}: ${sign}${c.amount} standing.` });
  }
}

/** Is a quest offerable now (not active/done, prerequisites + flag gates met)? */
function questAvailable(player: Player, q: QuestDef): boolean {
  if (player.quests[q.id] || player.questsDone.includes(q.id)) return false;
  if (q.requires && !player.questsDone.includes(q.requires)) return false;
  if (q.requiresFlags && !q.requiresFlags.every((f) => player.flags.includes(f))) return false;
  if (q.blockedByFlags && q.blockedByFlags.some((f) => player.flags.includes(f))) return false;
  return true;
}

/** Apply a player's pick at a quest's "choice" step, then advance the quest. */
function applyChoice(
  state: WorldState,
  content: Content,
  questId: string,
  option: number,
  events: WorldEvent[],
): void {
  const { player } = state;
  const def = content.quests.find((q) => q.id === questId);
  const st = player.quests[questId];
  if (!def || !st) return;
  const obj = def.steps[st.step];
  if (!obj || obj.type !== "choice") return;
  const pick = obj.options[option];
  if (!pick) return;
  for (const f of pick.flags) if (!player.flags.includes(f)) player.flags.push(f);
  // A "sell" option hands over an item for coin — only pay if it's in the pack.
  let paid = true;
  if (pick.takeItem) {
    if (countItem(player, pick.takeItem) > 0) removeOneItem(player, pick.takeItem);
    else paid = false;
  }
  if (pick.gold && paid) {
    player.gold += pick.gold;
    player.stats.goldEarned += pick.gold;
    events.push({ type: "LOG", message: `You're paid ${pick.gold}g.` });
  }
  applyRep(player, content, pick.rep, events);
  if (pick.reply) events.push({ type: "LOG", message: pick.reply });
  advanceQuest(state, content, def, st, events);
}

/** A kill counts toward any active quest hunting that monster. */
function advanceKillQuests(
  state: WorldState,
  content: Content,
  monster: string | undefined,
  events: WorldEvent[],
): void {
  if (!monster) return;
  const { player } = state;
  for (const qid of Object.keys(player.quests)) {
    const def = content.quests.find((q) => q.id === qid);
    if (!def) continue;
    const st = player.quests[qid]!;
    const obj = def.steps[st.step];
    if (!obj || obj.type !== "kill" || obj.monster !== monster) continue;
    st.killCount += 1;
    if (st.killCount >= obj.count) {
      advanceQuest(state, content, def, st, events);
    } else {
      events.push({
        type: "LOG",
        message: `${obj.text}: ${st.killCount}/${obj.count}.`,
      });
    }
  }
}

// --- Bounty: a slay-task board, ported from the idle game's bounty loop -------

/** A kill counts toward the active bounty task if it targets that monster. */
function trackBountyKill(
  player: Player,
  content: Content,
  monster: string | undefined,
  events: WorldEvent[],
): void {
  if (!monster) return;
  const task = player.bounty.task;
  if (!task || task.monster !== monster) return;
  if (task.progress >= task.required) return; // already done; don't overcount
  task.progress += 1;
  const name = content.monsters[monster]?.name ?? monster;
  if (task.progress >= task.required) {
    events.push({ type: "LOG", message: `Bounty complete — return to the board to claim it.` });
  } else {
    events.push({ type: "LOG", message: `Bounty: ${task.progress}/${task.required} ${name}.` });
  }
}

/** Take a fresh task from a guide: roll its zone pool, filtered by Bounty level. */
function takeBountyTask(
  state: WorldState,
  content: Content,
  guideId: string,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  player.bounty.guideId = guideId;
  if (player.bounty.task) {
    events.push({ type: "LOG", message: "Finish or abandon your current task first." });
    return;
  }
  const guide = content.bountyGuides.find((g) => g.id === guideId);
  if (!guide) return;
  const level = skillLvl(player, "bounty");
  if (level < guide.levelReq) {
    events.push({ type: "LOG", message: `${guide.name} won't deal with you until Bounty ${guide.levelReq}.` });
    return;
  }
  const pool: BountyTaskDef[] = [];
  for (const zone of guide.zones) {
    for (const t of content.bountyTasks[zone] ?? []) {
      if (level >= t.minLevel) pool.push(t);
    }
  }
  if (pool.length === 0) {
    events.push({ type: "LOG", message: "No tasks available — try a lower-tier guide." });
    return;
  }
  const pick = pool[Math.floor(ctx.rng() * pool.length)]!;
  const xp = Math.round(pick.xp * guide.xpMult);
  const marks = Math.round(pick.marks * guide.marksMult);
  player.bounty.task = {
    monster: pick.monster,
    required: pick.required,
    progress: 0,
    xp,
    marks,
    guideId,
  };
  const name = content.monsters[pick.monster]?.name ?? pick.monster;
  events.push({ type: "LOG", message: `${guide.name}: slay ${pick.required} ${name}.` });
}

/** Claim a finished task: pay Hunt Marks + Bounty XP (Hunter's Kit boosts XP). */
function claimBountyTask(
  state: WorldState,
  content: Content,
  events: WorldEvent[],
): void {
  const { player } = state;
  const task = player.bounty.task;
  if (!task) {
    events.push({ type: "LOG", message: "You have no bounty to claim." });
    return;
  }
  if (task.progress < task.required) {
    const name = content.monsters[task.monster]?.name ?? task.monster;
    events.push({ type: "LOG", message: `Not yet — ${task.required - task.progress} more ${name} to go.` });
    return;
  }
  // A Hunter's Kit in the pack sweetens the XP and is consumed on claim.
  const hasKit = hasItem(player, "hunters_kit");
  const xp = hasKit ? Math.round(task.xp * 1.5) : task.xp;
  if (hasKit) removeOneItem(player, "hunters_kit");
  player.bounty.marks += task.marks;
  player.bounty.task = null;
  grantXp(state, content, "bounty", xp, events);
  events.push({
    type: "LOG",
    message: hasKit
      ? `Bounty claimed! +${task.marks} Hunt Marks · +${xp} Bounty XP (Hunter's Kit bonus).`
      : `Bounty claimed! +${task.marks} Hunt Marks · +${xp} Bounty XP.`,
  });
}

/** Abandon the current task — no reward, but the board is free again. */
function abandonBountyTask(player: Player, events: WorldEvent[]): void {
  if (!player.bounty.task) return;
  player.bounty.task = null;
  events.push({ type: "LOG", message: "Bounty abandoned." });
}

/** Spend Hunt Marks at the Bounty board's shop. */
function buyBountyItem(
  player: Player,
  content: Content,
  item: ItemId,
  events: WorldEvent[],
): void {
  const line = content.bountyShop.find((l) => l.item === item);
  if (!line) return;
  if (player.bounty.marks < line.cost) {
    events.push({ type: "LOG", message: `You need ${line.cost} Hunt Marks for that.` });
    return;
  }
  if (!canAddItem(player, item)) {
    events.push({ type: "INVENTORY_FULL" });
    return;
  }
  player.bounty.marks -= line.cost;
  addItem(player, item, line.qty, events);
  events.push({ type: "LOG", message: `Bought ${content.items[item]?.name ?? item}.` });
}

/** Auto-advance any passive objective ("gather" / "reach") now satisfied. */
function checkGatherQuests(
  state: WorldState,
  content: Content,
  events: WorldEvent[],
): void {
  const { player } = state;
  for (const qid of Object.keys(player.quests)) {
    const def = content.quests.find((q) => q.id === qid);
    if (!def) continue;
    const st = player.quests[qid]!;
    const obj = def.steps[st.step];
    if (!obj) continue;
    if (obj.type === "gather" && countItem(player, obj.item) >= obj.count) {
      advanceQuest(state, content, def, st, events);
    } else if (obj.type === "reach" && skillLvl(player, obj.skill) >= obj.level) {
      advanceQuest(state, content, def, st, events);
    } else if (obj.type === "claim" && ownsAnyPlot(state)) {
      advanceQuest(state, content, def, st, events);
    } else if (obj.type === "build" && hasBuilt(state, content, obj.category)) {
      advanceQuest(state, content, def, st, events);
    }
  }
}

/** True once the player has claimed any homestead plot. */
function ownsAnyPlot(state: WorldState): boolean {
  return Object.values(state.objects).some((o) => o.owned);
}

/** True once a piece (optionally of `category`) is built at any home footing. */
function hasBuilt(state: WorldState, content: Content, category?: string): boolean {
  for (const o of Object.values(state.objects)) {
    if (!o.furniture) continue;
    if (!category) return true;
    if (content.furniture[o.furniture]?.category === category) return true;
  }
  return false;
}

// --- Combat math, ported faithfully from the idle game (CANON_LEDGER 1e) -----

/** A skill's current level (1 if somehow absent). */
function skillLvl(player: Player, skill: SkillId): number {
  return player.skills[skill]?.level ?? 1;
}

/** The attack style of the worn main-hand weapon (slash/stab/crush), if any. */
function weaponStyle(player: Player, content: Content): string | undefined {
  const id = player.equipment.mainhand;
  return id ? content.items[id].attackStyle : undefined;
}

/**
 * Player accuracy rating: Edge + summed gear acc (weapon, ring, amulet) + the
 * Edge-style bonus. equipStat sums the field across every worn item, and only
 * weapons/rings/amulets carry `acc`, so this matches the idle game's sum.
 */
function playerAccuracy(player: Player, content: Content): number {
  const styleBonus = player.combatStyle === "edge" ? COMBAT.styleBonus : 0;
  return skillLvl(player, "edge") + equipStat(player, content, "acc") + styleBonus + buffVal(player, "melee_acc");
}

/** Player max hit: Vigour + summed gear dmg (weapon, amulet) + Vigour bonus. */
function playerMaxHit(player: Player, content: Content): number {
  const styleBonus = player.combatStyle === "vigour" ? COMBAT.styleBonus : 0;
  return skillLvl(player, "vigour") + equipStat(player, content, "dmg") + styleBonus + buffVal(player, "melee_dmg");
}

/** Is the player set to fight at range? (a bow worn in the ranged slot). */
function isRanged(player: Player): boolean {
  return !!player.equipment.ranged;
}

/** Ranged accuracy: Draw + bow + arrow accuracy + any ranged-accuracy buff. */
function rangedAccuracy(player: Player, content: Content): number {
  const bow = player.equipment.ranged;
  const ammo = player.equipment.ammo;
  const ba = bow ? content.items[bow].acc ?? 0 : 0;
  const aa = ammo ? content.items[ammo].acc ?? 0 : 0;
  return skillLvl(player, "draw") + ba + aa + buffVal(player, "ranged_acc");
}

/** Ranged max hit: Draw + bow + arrow damage + any ranged-damage buff. */
function rangedMaxHit(player: Player, content: Content): number {
  const bow = player.equipment.ranged;
  const ammo = player.equipment.ammo;
  const bd = bow ? content.items[bow].dmg ?? 0 : 0;
  const ad = ammo ? content.items[ammo].dmg ?? 0 : 0;
  return skillLvl(player, "draw") + bd + ad + buffVal(player, "ranged_dmg");
}

/** Player defence rating: Ward + summed armour defence (+ any Defence buff). */
function playerDefence(player: Player, content: Content): number {
  return skillLvl(player, "ward") + equipStat(player, content, "def") + buffVal(player, "defence");
}

/** The player's swing interval (ms): the active weapon's speed, or default. */
function playerSpeed(player: Player, content: Content): number {
  const id = isRanged(player) ? player.equipment.ranged : player.equipment.mainhand;
  const speed = id ? content.items[id].speed : undefined;
  return speed || COMBAT.playerMeleeSpeed;
}

/** Keep max HP = base + Vitality level; growing it tops up current HP too. */
function syncMaxHp(player: Player): void {
  const m = BASE_MAX_HP + skillLvl(player, "vitality");
  if (m > player.maxHp) player.hp += m - player.maxHp;
  player.maxHp = m;
  if (player.hp > player.maxHp) player.hp = player.maxHp;
}

/** The shared linear hit-chance: clamp(0.5 + (att - def) * 0.012, 0.05, 0.95). */
function hitChance(att: number, def: number): number {
  const c = COMBAT.hitBase + (att - def) * COMBAT.hitSlope;
  return Math.max(COMBAT.hitFloor, Math.min(COMBAT.hitCap, c));
}

/** A uniform integer in [lo, hi] inclusive, drawn from the injected RNG. */
function randInt(ctx: Ctx, lo: number, hi: number): number {
  return Math.floor(ctx.rng() * (hi - lo + 1)) + lo;
}

/**
 * Resolve combat for this tick. Player and monster each have their own swing
 * clock; we process whichever swings are due, earliest first (player wins ties),
 * exactly like the idle game's timestamp scheduler.
 */
function resolveCombat(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const stats = monsterFor(content, def);
  if (!obj.available || obj.hp === undefined || !stats) {
    clearActivity(player);
    return;
  }
  if (!obj.nextAttackAt) obj.nextAttackAt = ctx.now + (stats.speed ?? COMBAT.monsterSpeed);

  // Bounded loop: at most a handful of swings can come due in one 250ms tick.
  let guard = 0;
  while (
    guard++ < 16 &&
    obj.available &&
    player.alive &&
    obj.hp !== undefined &&
    (ctx.now >= player.activity.nextActionAt || ctx.now >= obj.nextAttackAt)
  ) {
    const playerDue = ctx.now >= player.activity.nextActionAt;
    const monsterDue = ctx.now >= obj.nextAttackAt;
    const doPlayer =
      playerDue && (!monsterDue || player.activity.nextActionAt <= obj.nextAttackAt);

    if (doPlayer) {
      player.activity.nextActionAt += playerSpeed(player, content);
      playerSwing(state, content, def, obj, stats, ctx, events);
    } else {
      obj.nextAttackAt += stats.speed ?? COMBAT.monsterSpeed;
      monsterSwing(state, content, def, obj, stats, ctx, events);
    }
  }
}

function playerSwing(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  stats: MonsterStats,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  if (obj.hp === undefined) return;

  const ranged = isRanged(player);

  // Ranged fighting spends one arrow per loosed shot; with an empty quiver the
  // attack simply can't continue.
  if (ranged) {
    if (player.quiver <= 0 || !player.equipment.ammo) {
      events.push({ type: "LOG", message: "You're out of arrows." });
      clearActivity(player);
      return;
    }
    player.quiver -= 1;
    if (player.quiver <= 0) delete player.equipment.ammo;
  }

  // The player's attack "style" is the worn weapon's (slash/stab/crush), or
  // "ranged" when fighting with a bow. Matching one of the monster's weaknesses
  // multiplies accuracy and damage — the heart of the combat triangle, and what
  // gives ranged a job: many fliers, wraiths and brutes are weak to it alone.
  const wStyle = ranged ? "ranged" : weaponStyle(player, content);
  const exploits = wStyle !== undefined && (stats.weakness ?? []).includes(wStyle);
  const baseAcc = ranged ? rangedAccuracy(player, content) : playerAccuracy(player, content);
  const acc = exploits ? Math.round(baseAcc * COMBAT.weaknessAcc) : baseAcc;
  const maxHit = ranged ? rangedMaxHit(player, content) : playerMaxHit(player, content);

  if (ctx.rng() < hitChance(acc, stats.def ?? 0)) {
    const base = randInt(ctx, 1, Math.max(1, maxHit));
    const dmg = exploits ? Math.ceil(base * COMBAT.weaknessDmg) : base;
    obj.hp -= dmg;
    events.push({ type: "DAMAGE", targetId: obj.id, amount: dmg, weak: exploits });
    // OSRS-style combat XP, earned per point of damage dealt (not on the kill):
    // 4 xp to the attack skill (Draw for ranged, the chosen melee style else),
    // and 1.33 (4/3) xp to Vitality — the Hitpoints model, ranged included.
    grantXp(state, content, ranged ? "draw" : player.combatStyle, dmg * 4, events);
    grantXp(state, content, "vitality", Math.round((dmg * 4) / 3), events);
  } else {
    events.push({ type: "DAMAGE", targetId: obj.id, amount: 0 });
  }

  if (obj.hp <= 0) {
    obj.hp = 0;
    obj.available = false;
    obj.respawnAt = ctx.now + COMBAT.respawn;
    obj.nextAttackAt = 0;
    // Combat XP is granted per hit (see above), OSRS-style — not on the kill.
    player.killsSinceShard += 1;
    rollDrops(player, stats, ctx, events); // resets killsSinceShard if the shard drops
    // Pity guarantee: once the count crosses the threshold without a shard, the
    // next kill yields one and the count resets — a rare drop that can't wall you.
    if (player.killsSinceShard >= SHARD_PITY && canAddItem(player, SHARD_ID)) {
      addItem(player, SHARD_ID, 1, events);
      player.killsSinceShard = 0;
      events.push({ type: "LOG", message: `Among the spoils: a warm black Shard of Orun.` });
    }
    player.stats.monstersSlain += 1;
    events.push({ type: "MONSTER_KILLED", objId: obj.id });
    events.push({ type: "LOG", message: `You defeat the ${def.name}.` });
    advanceKillQuests(state, content, def.monster, events);
    trackBountyKill(player, content, def.monster, events);
    clearActivity(player);
  }
}

function monsterSwing(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  obj: WorldObjectState,
  stats: MonsterStats,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  const mechanics = stats.mechanics ?? [];

  // --- HP-threshold triggers (each fires once): enrage, self-heal ---
  if (mechanics.length && obj.hp !== undefined) {
    const frac = obj.hp / stats.hp;
    for (const m of mechanics) {
      if (m.type === "enrage" && !obj.enraged && frac < m.below) {
        obj.enraged = true;
        events.push({ type: "LOG", message: m.tell });
      }
      if (m.type === "selfheal" && !obj.healed && frac < m.below) {
        obj.healed = true;
        obj.hp = Math.min(stats.hp, obj.hp + m.amount);
        events.push({ type: "LOG", message: m.tell });
      }
    }
  }

  // --- This swing's damage multiplier: a periodic "heavy" blow + enrage ---
  obj.swings = (obj.swings ?? 0) + 1;
  let dmgMult = 1;
  for (const m of mechanics) {
    if (m.type === "heavy" && obj.swings % m.every === 0) {
      dmgMult *= m.mult;
      events.push({ type: "LOG", message: m.tell });
    }
    if (m.type === "enrage" && obj.enraged) dmgMult *= m.mult;
  }

  if (ctx.rng() < hitChance(stats.acc ?? 0, playerDefence(player, content))) {
    const raw = randInt(ctx, 1, stats.maxHit);
    const soak = Math.floor(playerDefence(player, content) / COMBAT.wardDivisor);
    const dmg = Math.max(1, Math.round((raw - soak) * dmgMult));
    const before = player.hp;
    player.hp -= dmg;
    events.push({ type: "DAMAGE", targetId: "player", amount: dmg });
    // A one-time warning the moment you drop into the danger zone.
    const lowAt = player.maxHp * 0.3;
    if (before > lowAt && player.hp > 0 && player.hp <= lowAt) {
      events.push({ type: "LOG", message: "You're badly wounded — heal or run!" });
    }
    // Life-drain: the boss heals a fraction of the harm it does.
    const ld = mechanics.find((m) => m.type === "lifedrain");
    if (ld && ld.type === "lifedrain" && obj.hp !== undefined && obj.hp < stats.hp) {
      obj.hp = Math.min(stats.hp, obj.hp + Math.max(1, Math.round(dmg * ld.frac)));
      if (ctx.rng() < 0.4) events.push({ type: "LOG", message: ld.tell });
    }
  } else {
    events.push({ type: "DAMAGE", targetId: "player", amount: 0 });
  }

  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
    player.respawnAt = ctx.now + PLAYER_RESPAWN;
    player.path = [];
    clearActivity(player);
    // A gentle setback: drop a tenth of your carried coin (capped).
    const lost = Math.min(DEATH_GOLD_CAP, Math.floor(player.gold * DEATH_GOLD_FRACTION));
    if (lost > 0) {
      player.gold -= lost;
      events.push({ type: "LOG", message: `The ${def.name} knocks you out! You lose ${lost}g.` });
    } else {
      events.push({ type: "LOG", message: `The ${def.name} knocks you out!` });
    }
    events.push({ type: "PLAYER_DIED" });
  }
}

/** Roll a monster's loot table; each drop is an independent chance. */
function rollDrops(
  player: Player,
  stats: MonsterStats,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  for (const drop of stats.drops) {
    if (ctx.rng() >= drop.chance) continue;
    const min = drop.min ?? 1;
    const max = drop.max ?? min;
    const qty = min + Math.floor(ctx.rng() * (max - min + 1));
    addItem(player, drop.item, qty, events);
    if (drop.item === "shard_of_orun") {
      player.killsSinceShard = 0; // a natural drop re-arms the pity timer
      events.push({
        type: "LOG",
        message: "A Shard of Orun — warm and black. The hills give one up.",
      });
    }
  }
}
