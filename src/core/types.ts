/**
 * src/core/types.ts
 * ------------------
 * The shared "contract" of Varath World.
 *
 * RULE 1: the core is PURE. There is no DOM, no Date.now(), no Math.random()
 * anywhere in src/core. Anything that needs the current time or a random
 * number receives a `Ctx` argument instead (see below). This file only
 * declares *shapes* (types), so it is automatically pure.
 *
 * Keeping all the types in one place means the client and the (future)
 * multiplayer server can both speak exactly the same language.
 */

// ---------------------------------------------------------------------------
// Time + randomness are injected, never read from globals.
// ---------------------------------------------------------------------------

/**
 * Everything the core needs from "the outside world":
 *  - now: the current time in milliseconds (a plain number).
 *  - rng: a function that returns a random number in [0, 1), like Math.random.
 *
 * The client supplies these. A multiplayer server would supply its own
 * (e.g. a seeded RNG so every player sees the same outcome). The core never
 * calls Date.now() or Math.random() itself.
 */
export interface Ctx {
  now: number;
  rng: () => number;
}

// ---------------------------------------------------------------------------
// Skills + items (the *names* are data; see src/content).
// ---------------------------------------------------------------------------

/**
 * Skills, named per the Varath canon. The three gathering skills plus the
 * combat trio (Vitality = health, Edge = accuracy, Vigour = damage). Ward
 * (defence) and Draw (ranged) exist in the wider game and will join once
 * armour and bows do.
 */
export type SkillId =
  | "mining"
  | "forestry"
  | "fishing"
  | "cooking"
  | "smithing"
  | "vitality"
  | "edge"
  | "vigour";

/** The combat skills that train on every kill. */
export const COMBAT_SKILLS: SkillId[] = ["vitality", "edge", "vigour"];

/** One unlocked skill on the player: how much XP, and the level it implies. */
export interface SkillState {
  xp: number;
  level: number;
}

export type ItemId =
  | "ashwood_log"
  | "knucklestone_ore"
  | "knucklestone_bar"
  | "ashfin_raw"
  | "ashfin_cooked"
  | "raw_rat_meat"
  | "cooked_rat_meat"
  | "raw_hide"
  | "rat_tail"
  | "raw_wolf_meat"
  | "cooked_wolf_meat"
  | "wolf_pelt"
  | "wolf_fang"
  | "worn_coin"
  | "shard_of_orun";

/** A static description of an item. Lives in src/content/items.ts. */
export interface ItemDef {
  id: ItemId;
  name: string;
  /** Short flavour text shown in tooltips / the log. */
  description: string;
  /** Food only: hit points restored when eaten. */
  heals?: number;
}

/** One occupied inventory slot. The inventory is an array of 28 of these. */
export interface InventorySlot {
  item: ItemId;
  qty: number;
}

// ---------------------------------------------------------------------------
// The map (tiles).
// ---------------------------------------------------------------------------

export type TileType = "grass" | "dirt" | "path" | "stone" | "water";

/** The hand-made zone, decoded from the text map in src/content/map.ts. */
export interface WorldMap {
  name: string;
  width: number;
  height: number;
  /** Row-major grid of tile types: tiles[y * width + x]. */
  tiles: TileType[];
}

// ---------------------------------------------------------------------------
// World objects (trees, rocks, fishing spots, the NPC, the monster).
// ---------------------------------------------------------------------------

export type ObjKind =
  | "tree"
  | "rock"
  | "fishing_spot"
  | "npc"
  | "monster"
  | "bank"
  | "fire"
  | "furnace";

/**
 * The *definition* of an object placed in the world: its kind and where it
 * sits. This is content (src/content/spawns.ts). The live, changing parts
 * (depleted? current HP? respawn timer?) live in WorldObjectState below so
 * that content stays separate from player/runtime state (RULE 3).
 */
export interface WorldObjectDef {
  id: string;
  kind: ObjKind;
  /** Tile coordinates of the object. */
  x: number;
  y: number;
  /** Display name, e.g. "Aldric" or "Hill Wolf". */
  name: string;
  /** Monsters only: which MonsterStats (in Content.monsters) this uses. */
  monster?: string;
}

/** One possible drop from a monster: an item with an independent roll chance. */
export interface Drop {
  item: ItemId;
  /** Probability in [0, 1] that this item drops on a kill. */
  chance: number;
  /** Optional quantity range (defaults to 1). */
  min?: number;
  max?: number;
}

/** The combat stats + loot table for a kind of monster (pure data). */
export interface MonsterStats {
  id: string;
  name: string;
  level: number;
  hp: number;
  /** Highest damage the monster can deal in one hit. */
  maxHit: number;
  /** Combat XP granted (to each combat skill) on a kill. */
  xp: number;
  drops: Drop[];
  desc: string;
}

/** The mutable runtime state for a single world object. */
export interface WorldObjectState {
  id: string;
  /** Resources: false while depleted and waiting to respawn. */
  available: boolean;
  /** Time (ms) at which a depleted/dead object comes back. */
  respawnAt: number;
  /** Monsters only: current hit points (undefined for non-combat objects). */
  hp?: number;
}

// ---------------------------------------------------------------------------
// The player.
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

/** What the player is currently busy doing, if anything. */
export type ActivityKind =
  | "idle"
  | "woodcutting"
  | "mining"
  | "fishing"
  | "combat"
  | "cooking"
  | "smelting";

export interface Activity {
  kind: ActivityKind;
  /** The world object this activity targets (e.g. the tree being chopped). */
  targetId: string | null;
  /** Time (ms) of the next "swing"/roll for this activity. */
  nextActionAt: number;
  /** How long one swing/roll takes (ms) — lets the client show progress. */
  actionInterval: number;
}

export interface Player {
  /**
   * Smooth position in *tile units* (e.g. {x: 4.5, y: 7} is halfway across
   * tile 4 on row 7). The core advances this a little each tick so movement
   * looks smooth; the client just draws wherever the player currently is.
   */
  pos: Vec2;
  /** Tiles still to be walked, in order. Empty when standing still. */
  path: Vec2[];
  hp: number;
  maxHp: number;
  /** Where the player respawns after dying. */
  spawn: Vec2;
  skills: Record<SkillId, SkillState>;
  /** Fixed-length array of length 28; empty slots are null. */
  inventory: (InventorySlot | null)[];
  /** The bank chest: unlimited, stacked storage (item id -> quantity). */
  bank: Partial<Record<ItemId, number>>;
  activity: Activity;
  /**
   * A pending interaction queued while the player walks toward something:
   * once the path finishes, the core starts this interaction. Null when the
   * player is just walking to a spot.
   */
  pendingInteractId: string | null;
  alive: boolean;
  /** Time (ms) at which a dead player respawns. */
  respawnAt: number;
}

// ---------------------------------------------------------------------------
// The whole world state (everything the core owns and the client renders).
// ---------------------------------------------------------------------------

export interface WorldState {
  map: WorldMap;
  player: Player;
  /** Live state for every world object, keyed by object id. */
  objects: Record<string, WorldObjectState>;
  /** The last time tick() ran, so we can measure elapsed time. */
  lastTick: number;
}

// ---------------------------------------------------------------------------
// Intents: the ONLY way the client asks the world to change (RULE 2).
// ---------------------------------------------------------------------------

/** "Walk to this tile." The client has already pathfound; it sends the path. */
export interface MoveIntent {
  type: "MOVE";
  path: Vec2[];
}

/**
 * "Walk next to this object, then interact with it." The client provides a
 * path to a tile adjacent to the object; the core performs the interaction
 * once the player arrives.
 */
export interface InteractIntent {
  type: "INTERACT";
  objId: string;
  path: Vec2[];
}

/** "Stop whatever I'm doing" (cancels movement and current activity). */
export interface CancelIntent {
  type: "CANCEL";
}

/** "Eat the food in this inventory slot" (restores HP). */
export interface EatIntent {
  type: "EAT";
  slot: number;
}

/** "Deposit every one of this item from my pack into the bank." */
export interface DepositIntent {
  type: "DEPOSIT";
  item: ItemId;
}

/** "Withdraw one of this item from the bank into my pack." */
export interface WithdrawIntent {
  type: "WITHDRAW";
  item: ItemId;
}

export type Intent =
  | MoveIntent
  | InteractIntent
  | CancelIntent
  | EatIntent
  | DepositIntent
  | WithdrawIntent;

// ---------------------------------------------------------------------------
// Events: what the core reports back after handling an intent or a tick.
// The client reads these to update the log, open dialogue, play effects, etc.
// The client must NOT change state from events — state already lives in the
// WorldState the core returns; events are just notifications.
// ---------------------------------------------------------------------------

export type WorldEvent =
  | { type: "LOG"; message: string }
  | { type: "XP_GAINED"; skill: SkillId; amount: number }
  | { type: "LEVEL_UP"; skill: SkillId; level: number }
  | { type: "ITEM_GAINED"; item: ItemId; qty: number }
  | { type: "INVENTORY_FULL" }
  | { type: "DIALOGUE"; npc: string; lines: string[] }
  | { type: "DAMAGE"; targetId: string; amount: number }
  | { type: "OBJECT_DEPLETED"; objId: string }
  | { type: "OBJECT_RESPAWNED"; objId: string }
  | { type: "MONSTER_KILLED"; objId: string }
  | { type: "PLAYER_DIED" }
  | { type: "PLAYER_RESPAWNED" }
  | { type: "OPEN_BANK" };

// ---------------------------------------------------------------------------
// Content bundle: all the game DATA handed to the core when a world is made.
// ---------------------------------------------------------------------------

/** A processing recipe: one input item becomes one output item, for XP. */
export interface Recipe {
  input: ItemId;
  output: ItemId;
  xp: number;
}

export interface Content {
  map: WorldMap;
  objects: WorldObjectDef[];
  items: Record<ItemId, ItemDef>;
  /** Monster combat stats + loot, keyed by MonsterStats id. */
  monsters: Record<string, MonsterStats>;
  /** Processing recipes for the camp stations. */
  recipes: { cooking: Recipe[]; smelting: Recipe[] };
  /** XP needed to *reach* each level. xpForLevel[1] = 0, etc. */
  xpForLevel: number[];
  /** Player-facing skill metadata (display name, etc.). */
  skills: Record<SkillId, { name: string }>;
}
