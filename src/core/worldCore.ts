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
  Content,
  Ctx,
  EquipSlot,
  Intent,
  ItemId,
  MonsterStats,
  Player,
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

const MOVE_SPEED = 3.5; // tiles per second

// `deplete` is the chance, on a successful gather, that the node runs out and
// the player stops — otherwise they keep gathering until the pack is full.
const WOODCUTTING = { interval: 1500, success: 0.45, xp: 25, respawn: 7000, deplete: 0.25 };
const MINING = { interval: 1800, success: 0.4, xp: 30, respawn: 8000, deplete: 0.3 };
const FISHING = { interval: 1400, success: 0.5, xp: 20 };

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

// ---------------------------------------------------------------------------
// Walkability — shared with the client's pathfinder.
// ---------------------------------------------------------------------------

const BLOCKING_KINDS = new Set([
  "tree",
  "rock",
  "npc",
  "monster",
  "bank",
  "fire",
  "furnace",
  "anvil",
]);

/**
 * Build a fast "can I stand on this tile?" function from the content.
 * Water blocks movement, and any tile occupied by a solid object (tree,
 * rock, NPC, monster) blocks movement too — so the player always stops
 * *next to* things and never on top of them. Object positions are fixed,
 * so this is computed once.
 */
export function buildWalkability(
  content: Content,
): (x: number, y: number) => boolean {
  const blocked = new Set<string>();
  for (const obj of content.objects) {
    if (BLOCKING_KINDS.has(obj.kind)) blocked.add(`${obj.x},${obj.y}`);
  }
  const { map } = content;
  return (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const tile = map.tiles[y * map.width + x];
    if (tile === "water") return false;
    if (blocked.has(`${x},${y}`)) return false;
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
  for (const def of content.objects) {
    const base: WorldObjectState = {
      id: def.id,
      available: true,
      respawnAt: 0,
    };
    if (def.kind === "monster") base.hp = monsterFor(content, def)?.hp ?? 1;
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
    equipment: {},
    combatStyle: "vigour",
    activity: { kind: "idle", targetId: null, actionId: null, nextActionAt: 0, actionInterval: 0 },
    pendingInteractId: null,
    alive: true,
    respawnAt: 0,
  };

  return {
    map: content.map,
    player,
    objects,
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
  kind: "woodcutting" | "mining" | "fishing",
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
  player.activity = {
    kind,
    targetId: objId,
    actionId: action.id,
    nextActionAt: ctx.now + interval,
    actionInterval: interval,
  };
  return true;
}

function levelFromXp(xpTable: number[], xp: number): number {
  let level = 1;
  while (level + 1 < xpTable.length && (xpTable[level + 1] ?? Infinity) <= xp) {
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
  for (const id of Object.values(player.equipment)) {
    if (!id) continue;
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
      clearActivity(player);
      break;
    }
    case "INTERACT": {
      player.path = intent.path.map((p) => ({ x: p.x, y: p.y }));
      player.pendingInteractId = intent.objId;
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
      clearActivity(player);
      break;
    }
    case "EAT": {
      eatSlot(player, content, intent.slot, events);
      break;
    }
    case "DEPOSIT": {
      depositAll(player, intent.item);
      break;
    }
    case "WITHDRAW": {
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
    case "SET_STYLE": {
      player.combatStyle = intent.style;
      events.push({
        type: "LOG",
        message: `Combat style: ${intent.style[0]!.toUpperCase()}${intent.style.slice(1)}.`,
      });
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
]);

/** Combat level needed to equip each gear tier (idle game GEAR_TIER_REQS). */
const GEAR_TIER_REQS = [0, 1, 10, 20, 30, 40, 50, 55, 60, 65, 72];

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
  // Honour the gear-tier combat-level requirement.
  if (def.tier !== undefined) {
    const req = GEAR_TIER_REQS[def.tier] ?? 0;
    if (combatLevel(player) < req) {
      events.push({
        type: "LOG",
        message: `You need combat level ${req} to wield the ${def.name}.`,
      });
      return;
    }
  }

  const target = eslot as EquipSlot;
  const newItem = data.item;
  const previously = player.equipment[target];

  // Take one of the new item out of the pack…
  data.qty -= 1;
  if (data.qty <= 0) player.inventory[slot] = null;
  // …wear it, and drop whatever was there back into the freed space.
  player.equipment[target] = newItem;
  if (previously) addItem(player, previously, 1, events);

  // A two-handed weapon can't share with a shield: stow the off-hand.
  if (target === "mainhand" && def.twoHand && player.equipment.offhand) {
    const off = player.equipment.offhand;
    delete player.equipment.offhand;
    addItem(player, off, 1, events);
  }
  // Equipping an off-hand while a two-hander is worn stows the two-hander.
  if (target === "offhand" && player.equipment.mainhand) {
    const main = player.equipment.mainhand;
    if (content.items[main].twoHand) {
      delete player.equipment.mainhand;
      addItem(player, main, 1, events);
    }
  }
  events.push({ type: "LOG", message: `You equip the ${def.name}.` });
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
  events: WorldEvent[],
): void {
  const data = player.inventory[slot];
  if (!data) return;
  const def = content.items[data.item];
  if (!def.heals) {
    events.push({ type: "LOG", message: `You can't eat the ${def.name}.` });
    return;
  }
  if (player.hp >= player.maxHp) {
    events.push({ type: "LOG", message: "You are already at full health." });
    return;
  }
  player.hp = Math.min(player.maxHp, player.hp + def.heals);
  data.qty -= 1;
  if (data.qty <= 0) player.inventory[slot] = null;
  events.push({
    type: "LOG",
    message: `You eat the ${def.name}. (+${def.heals})`,
  });
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
  player.pendingInteractId = null;

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

    case "npc":
      events.push({
        type: "DIALOGUE",
        npc: def.name,
        lines: def.lines ?? ["..."],
      });
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
      events.push({ type: "OPEN_BANK" });
      break;

    // The processing stations open a recipe menu; the client lists what the
    // player can make (from content.actions) and sends back a CRAFT intent.
    case "fire":
    case "furnace":
    case "anvil":
      events.push({ type: "OPEN_CRAFT", station: def.kind, objId });
      break;
  }
}

// ---------------------------------------------------------------------------
// The tick: advancing time. Movement, activities, combat and respawns.
// ---------------------------------------------------------------------------

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

  // 1) Respawn the player if they're dead and their timer is up.
  if (!player.alive) {
    if (ctx.now >= player.respawnAt) {
      player.alive = true;
      player.hp = player.maxHp;
      player.pos = { x: player.spawn.x, y: player.spawn.y };
      player.path = [];
      clearActivity(player);
      events.push({ type: "PLAYER_RESPAWNED" });
    }
  } else {
    // 2) Movement.
    const wasMoving = player.path.length > 0;
    if (wasMoving) stepMovement(player, dt);
    const arrived = wasMoving && player.path.length === 0;
    if (arrived && player.pendingInteractId) {
      startInteraction(state, content, player.pendingInteractId, ctx, events);
    }

    // 3) Whatever the player is busy doing (only when standing still).
    if (player.path.length === 0) {
      processActivity(state, content, ctx, events);
    }
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
      }
      events.push({ type: "OBJECT_RESPAWNED", objId: def.id });
    }
  }

  return events;
}

function stepMovement(player: Player, dt: number): void {
  let budget = (MOVE_SPEED * dt) / 1000; // tiles of travel allowed this tick
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
      events.push({ type: "OBJECT_DEPLETED", objId: obj.id });
      clearActivity(player);
      return;
    }
  }
  act.nextActionAt = ctx.now + beh.interval;
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
  act.nextActionAt = ctx.now + CRAFT_INTERVAL;
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
  return skillLvl(player, "edge") + equipStat(player, content, "acc") + styleBonus;
}

/** Player max hit: Vigour + summed gear dmg (weapon, amulet) + Vigour bonus. */
function playerMaxHit(player: Player, content: Content): number {
  const styleBonus = player.combatStyle === "vigour" ? COMBAT.styleBonus : 0;
  return skillLvl(player, "vigour") + equipStat(player, content, "dmg") + styleBonus;
}

/** Player defence rating: Ward + summed armour defence. */
function playerDefence(player: Player, content: Content): number {
  return skillLvl(player, "ward") + equipStat(player, content, "def");
}

/** The player's swing interval (ms): the main-hand weapon's speed, or default. */
function playerSpeed(player: Player, content: Content): number {
  const id = player.equipment.mainhand;
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
      monsterSwing(state, content, def, stats, ctx, events);
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

  const wStyle = weaponStyle(player, content);
  const exploits = wStyle !== undefined && (stats.weakness ?? []).includes(wStyle);
  const acc = exploits
    ? Math.round(playerAccuracy(player, content) * COMBAT.weaknessAcc)
    : playerAccuracy(player, content);

  if (ctx.rng() < hitChance(acc, stats.def ?? 0)) {
    const base = randInt(ctx, 1, Math.max(1, playerMaxHit(player, content)));
    const dmg = exploits ? Math.ceil(base * COMBAT.weaknessDmg) : base;
    obj.hp -= dmg;
    events.push({ type: "DAMAGE", targetId: obj.id, amount: dmg });
  } else {
    events.push({ type: "DAMAGE", targetId: obj.id, amount: 0 });
  }

  if (obj.hp <= 0) {
    obj.hp = 0;
    obj.available = false;
    obj.respawnAt = ctx.now + COMBAT.respawn;
    obj.nextAttackAt = 0;
    // Vitality always trains; the chosen style trains its own skill.
    grantXp(state, content, "vitality", Math.floor(stats.xp * 0.33), events);
    grantXp(state, content, player.combatStyle, Math.floor(stats.xp), events);
    rollDrops(player, stats, ctx, events);
    events.push({ type: "MONSTER_KILLED", objId: obj.id });
    events.push({ type: "LOG", message: `You defeat the ${def.name}.` });
    clearActivity(player);
  }
}

function monsterSwing(
  state: WorldState,
  content: Content,
  def: WorldObjectDef,
  stats: MonsterStats,
  ctx: Ctx,
  events: WorldEvent[],
): void {
  const { player } = state;
  if (ctx.rng() < hitChance(stats.acc ?? 0, playerDefence(player, content))) {
    const raw = randInt(ctx, 1, stats.maxHit);
    const soak = Math.floor(playerDefence(player, content) / COMBAT.wardDivisor);
    const dmg = Math.max(1, raw - soak);
    player.hp -= dmg;
    events.push({ type: "DAMAGE", targetId: "player", amount: dmg });
  } else {
    events.push({ type: "DAMAGE", targetId: "player", amount: 0 });
  }

  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
    player.respawnAt = ctx.now + PLAYER_RESPAWN;
    player.path = [];
    clearActivity(player);
    events.push({ type: "PLAYER_DIED" });
    events.push({ type: "LOG", message: `The ${def.name} knocks you out!` });
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
      events.push({
        type: "LOG",
        message: "A Shard of Orun — warm and black. The hills give one up.",
      });
    }
  }
}
