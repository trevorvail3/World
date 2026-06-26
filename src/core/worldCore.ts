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
  Intent,
  ItemId,
  MonsterStats,
  Player,
  Recipe,
  SkillId,
  Vec2,
  WorldEvent,
  WorldObjectDef,
  WorldObjectState,
  WorldState,
} from "./types.ts";
import { COMBAT_SKILLS } from "./types.ts";

// ---------------------------------------------------------------------------
// Tunable game constants. These are behaviour, so they live here (not content).
// Times are in milliseconds.
// ---------------------------------------------------------------------------

const MOVE_SPEED = 3.5; // tiles per second

const WOODCUTTING = { interval: 1500, success: 0.45, xp: 25, respawn: 7000 };
const MINING = { interval: 1800, success: 0.4, xp: 30, respawn: 8000 };
const FISHING = { interval: 1400, success: 0.5, xp: 20 };
const COOKING_INTERVAL = 1400;
const SMELTING_INTERVAL = 1800;

const PLAYER_MAX_HP = 10;
const PLAYER_RESPAWN = 4000;

const COMBAT = {
  attackInterval: 1200,
  playerMaxHit: 3,
  respawn: 9000,
};

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

  const player: Player = {
    pos: { x: spawn.x, y: spawn.y },
    path: [],
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    spawn: { x: spawn.x, y: spawn.y },
    skills,
    inventory: new Array<Player["inventory"][number]>(INVENTORY_SIZE).fill(null),
    bank: {},
    activity: { kind: "idle", targetId: null, nextActionAt: 0 },
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
  player.activity = { kind: "idle", targetId: null, nextActionAt: 0 };
}

/** Does the player hold at least one of this item? */
function hasItem(player: Player, item: ItemId): boolean {
  return player.inventory.some((slot) => slot?.item === item && slot.qty > 0);
}

/** Does the player hold any input for one of these recipes? */
function hasRecipeInput(player: Player, recipes: Recipe[]): boolean {
  return recipes.some((r) => hasItem(player, r.input));
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
  }
  return events;
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
    case "tree":
      if (!obj.available) {
        events.push({ type: "LOG", message: "The tree has been felled." });
        return;
      }
      player.activity = {
        kind: "woodcutting",
        targetId: objId,
        nextActionAt: ctx.now + WOODCUTTING.interval,
      };
      events.push({ type: "LOG", message: "You swing your axe at the tree." });
      break;

    case "rock":
      if (!obj.available) {
        events.push({ type: "LOG", message: "The rock is depleted." });
        return;
      }
      player.activity = {
        kind: "mining",
        targetId: objId,
        nextActionAt: ctx.now + MINING.interval,
      };
      events.push({ type: "LOG", message: "You swing your pick at the rock." });
      break;

    case "fishing_spot":
      player.activity = {
        kind: "fishing",
        targetId: objId,
        nextActionAt: ctx.now + FISHING.interval,
      };
      events.push({ type: "LOG", message: "You cast your line into the pond." });
      break;

    case "npc":
      events.push({
        type: "DIALOGUE",
        npc: def.name,
        lines: [
          "You've an honest look about you. Good — there's a thing that's been gnawing at me.",
          "Found this old coin in the dirt by my wall. Old Varath mintage, struck before my grandfather's grandfather drew breath. Worn smooth — and no coin I've ever known.",
          "Here's the strange of it: the moor rats keep turning the things up in their nests. A dead king's money, in a rat's hole. Why?",
          "Humour an old man. Put one of those rats down and see what it carries. Hold a thing to study it first — then strike.",
          "Ash and knuckle, that's all these hills are. But every road in Varath starts on one like it.",
        ],
      });
      break;

    case "monster":
      if (!obj.available) {
        events.push({ type: "LOG", message: "There is nothing here to fight." });
        return;
      }
      player.activity = {
        kind: "combat",
        targetId: objId,
        nextActionAt: ctx.now + COMBAT.attackInterval,
      };
      events.push({ type: "LOG", message: `You engage the ${def.name}.` });
      break;

    case "bank":
      events.push({ type: "OPEN_BANK" });
      break;

    case "fire":
      if (!hasRecipeInput(player, content.recipes.cooking)) {
        events.push({ type: "LOG", message: "You've nothing to cook." });
        return;
      }
      player.activity = {
        kind: "cooking",
        targetId: objId,
        nextActionAt: ctx.now + COOKING_INTERVAL,
      };
      events.push({ type: "LOG", message: "You set your catch over the fire." });
      break;

    case "furnace":
      if (!hasRecipeInput(player, content.recipes.smelting)) {
        events.push({ type: "LOG", message: "You've no ore to smelt." });
        return;
      }
      player.activity = {
        kind: "smelting",
        targetId: objId,
        nextActionAt: ctx.now + SMELTING_INTERVAL,
      };
      events.push({ type: "LOG", message: "You feed ore into the furnace." });
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
      if (def.kind === "monster") obj.hp = monsterFor(content, def)?.hp ?? 1;
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
  if (ctx.now < act.nextActionAt) return;

  const obj = state.objects[act.targetId];
  const def = findObjectDef(content, act.targetId);
  if (!obj || !def) {
    clearActivity(player);
    return;
  }

  switch (act.kind) {
    case "woodcutting": {
      if (!obj.available) {
        clearActivity(player);
        return;
      }
      if (ctx.rng() < WOODCUTTING.success) {
        grantXp(state, content, "forestry", WOODCUTTING.xp, events);
        addItem(player, "ashwood_log", 1, events);
        events.push({ type: "LOG", message: "You get some Ashwood Logs." });
        obj.available = false;
        obj.respawnAt = ctx.now + WOODCUTTING.respawn;
        events.push({ type: "OBJECT_DEPLETED", objId: obj.id });
        clearActivity(player);
      } else {
        act.nextActionAt = ctx.now + WOODCUTTING.interval;
      }
      break;
    }

    case "mining": {
      if (!obj.available) {
        clearActivity(player);
        return;
      }
      if (ctx.rng() < MINING.success) {
        grantXp(state, content, "mining", MINING.xp, events);
        addItem(player, "knucklestone_ore", 1, events);
        events.push({ type: "LOG", message: "You mine some Knucklestone." });
        obj.available = false;
        obj.respawnAt = ctx.now + MINING.respawn;
        events.push({ type: "OBJECT_DEPLETED", objId: obj.id });
        clearActivity(player);
      } else {
        act.nextActionAt = ctx.now + MINING.interval;
      }
      break;
    }

    case "fishing": {
      if (ctx.rng() < FISHING.success) {
        grantXp(state, content, "fishing", FISHING.xp, events);
        addItem(player, "ashfin_raw", 1, events);
        events.push({ type: "LOG", message: "You catch an Ashfin." });
      }
      act.nextActionAt = ctx.now + FISHING.interval; // continuous
      break;
    }

    case "combat": {
      resolveCombatSwing(state, content, def, obj, ctx, events);
      break;
    }

    case "cooking": {
      const done = processOneRecipe(
        state,
        content,
        content.recipes.cooking,
        "cooking",
        events,
      );
      if (done) {
        events.push({ type: "LOG", message: "There's nothing left to cook." });
        clearActivity(player);
      } else {
        act.nextActionAt = ctx.now + COOKING_INTERVAL;
      }
      break;
    }

    case "smelting": {
      const done = processOneRecipe(
        state,
        content,
        content.recipes.smelting,
        "smithing",
        events,
      );
      if (done) {
        events.push({ type: "LOG", message: "There's no more ore to smelt." });
        clearActivity(player);
      } else {
        act.nextActionAt = ctx.now + SMELTING_INTERVAL;
      }
      break;
    }
  }
}

/**
 * Convert one input item into its output for a station. Returns true when
 * there is nothing left to process (so the caller stops the activity).
 */
function processOneRecipe(
  state: WorldState,
  content: Content,
  recipes: Recipe[],
  skill: SkillId,
  events: WorldEvent[],
): boolean {
  const { player } = state;
  const recipe = recipes.find((r) => hasItem(player, r.input));
  if (!recipe) return true;
  removeOneItem(player, recipe.input);
  grantXp(state, content, skill, recipe.xp, events);
  addItem(player, recipe.output, 1, events);
  events.push({
    type: "LOG",
    message: `You make ${content.items[recipe.output].name}.`,
  });
  return false;
}

function resolveCombatSwing(
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

  // Player hits the monster.
  const hit = Math.floor(ctx.rng() * (COMBAT.playerMaxHit + 1));
  obj.hp -= hit;
  events.push({ type: "DAMAGE", targetId: obj.id, amount: hit });

  if (obj.hp <= 0) {
    obj.hp = 0;
    obj.available = false;
    obj.respawnAt = ctx.now + COMBAT.respawn;
    // Combat trains the whole trio (Vitality, Edge, Vigour) on a kill.
    for (const skill of COMBAT_SKILLS) {
      grantXp(state, content, skill, stats.xp, events);
    }
    rollDrops(player, stats, ctx, events);
    events.push({ type: "MONSTER_KILLED", objId: obj.id });
    events.push({ type: "LOG", message: `You defeat the ${def.name}.` });
    clearActivity(player);
    return;
  }

  // Monster hits back.
  const back = Math.floor(ctx.rng() * (stats.maxHit + 1));
  player.hp -= back;
  events.push({ type: "DAMAGE", targetId: "player", amount: back });

  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
    player.respawnAt = ctx.now + PLAYER_RESPAWN;
    player.path = [];
    clearActivity(player);
    events.push({ type: "PLAYER_DIED" });
    events.push({ type: "LOG", message: `The ${def.name} knocks you out!` });
    return;
  }

  act_continue(player, ctx);
}

function act_continue(player: Player, ctx: Ctx): void {
  player.activity.nextActionAt = ctx.now + COMBAT.attackInterval;
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
