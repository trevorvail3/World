/**
 * src/core/save.ts
 * ----------------
 * The save *format* and its validation. This is part of the pure core (RULE 1):
 * no DOM, no localStorage — just turning a Player into a plain, versioned data
 * object and safely loading one back. The client (src/client/storage.ts) is
 * what actually reads and writes the browser's localStorage.
 *
 * What we persist: only the player's *progress* — skill XP, inventory, HP and
 * position. We deliberately do NOT persist world object timers (respawns) or
 * the clock, because those live in runtime milliseconds that reset on reload;
 * the world is recreated fresh and the saved player is laid back on top.
 */

import type {
  Content,
  EquipSlot,
  ItemId,
  Player,
  SkillId,
  WorldState,
} from "./types.ts";

/** Bump this whenever the save shape changes; older saves are then ignored. */
export const SAVE_VERSION = 1;

export interface SavedProgress {
  version: number;
  /** XP per skill. */
  skills: Partial<Record<SkillId, number>>;
  /** Fixed-length inventory; null = empty slot. */
  inventory: ({ item: string; qty: number } | null)[];
  /** Banked items: item id -> quantity. */
  bank: Record<string, number>;
  /** Worn gear: equip slot -> item id. */
  equipment: Record<string, string>;
  /** Selected melee combat style. */
  combatStyle: string;
  hp: number;
  pos: { x: number; y: number };
}

/** Snapshot the player's progress into a plain, serialisable object. */
export function serializePlayer(player: Player): SavedProgress {
  const skills: Partial<Record<SkillId, number>> = {};
  (Object.keys(player.skills) as SkillId[]).forEach((id) => {
    skills[id] = player.skills[id].xp;
  });
  return {
    version: SAVE_VERSION,
    skills,
    inventory: player.inventory.map((s) => (s ? { item: s.item, qty: s.qty } : null)),
    bank: { ...player.bank } as Record<string, number>,
    equipment: { ...player.equipment } as Record<string, string>,
    combatStyle: player.combatStyle,
    hp: player.hp,
    pos: { x: Math.round(player.pos.x), y: Math.round(player.pos.y) },
  };
}

/**
 * Validate and apply a saved blob onto a freshly-created world. Returns true if
 * anything was loaded. Anything malformed, unknown, or from an older version is
 * ignored rather than trusted — a corrupt save can never crash the game.
 */
export function hydratePlayer(
  state: WorldState,
  content: Content,
  raw: unknown,
): boolean {
  if (!isRecord(raw) || raw["version"] !== SAVE_VERSION) return false;
  const { player } = state;

  // --- Skills (only ids this build knows; XP must be a sane number) ---
  const savedSkills = raw["skills"];
  if (isRecord(savedSkills)) {
    (Object.keys(player.skills) as SkillId[]).forEach((id) => {
      const xp = savedSkills[id];
      if (typeof xp === "number" && Number.isFinite(xp) && xp >= 0) {
        player.skills[id].xp = xp;
        player.skills[id].level = levelFromTable(content.xpForLevel, xp);
      }
    });
  }

  // --- Inventory (drop unknown/renamed items gracefully) ---
  const savedInv = raw["inventory"];
  if (Array.isArray(savedInv)) {
    const inv: Player["inventory"] = new Array(player.inventory.length).fill(null);
    for (let i = 0; i < inv.length; i++) {
      const slot = savedInv[i];
      if (
        isRecord(slot) &&
        typeof slot["item"] === "string" &&
        slot["item"] in content.items
      ) {
        const rawQty = slot["qty"];
        const qty = typeof rawQty === "number" && rawQty > 0 ? Math.floor(rawQty) : 1;
        inv[i] = { item: slot["item"] as ItemId, qty };
      }
    }
    player.inventory = inv;
  }

  // --- Bank (drop unknown/renamed items gracefully) ---
  const savedBank = raw["bank"];
  if (isRecord(savedBank)) {
    const bank: Player["bank"] = {};
    for (const key of Object.keys(savedBank)) {
      const qty = savedBank[key];
      if (key in content.items && typeof qty === "number" && qty > 0) {
        bank[key as ItemId] = Math.floor(qty);
      }
    }
    player.bank = bank;
  }

  // --- Equipment (only items that exist and sit in the slot they claim) ---
  const savedEquip = raw["equipment"];
  if (isRecord(savedEquip)) {
    const equipment: Player["equipment"] = {};
    for (const slot of Object.keys(savedEquip)) {
      const id = savedEquip[slot];
      if (typeof id !== "string" || !(id in content.items)) continue;
      const def = content.items[id as ItemId];
      if (def.slot === slot) equipment[slot as EquipSlot] = id as ItemId;
    }
    player.equipment = equipment;
  }

  // --- Combat style (preference) ---
  const style = raw["combatStyle"];
  if (style === "edge" || style === "vigour" || style === "ward") {
    player.combatStyle = style;
  }

  // --- Max HP follows the loaded Vitality level, then HP clamps to it ---
  player.maxHp = 10 + player.skills.vitality.level;

  // --- HP (clamped to the player's range) ---
  const hp = raw["hp"];
  if (typeof hp === "number" && Number.isFinite(hp)) {
    player.hp = Math.max(1, Math.min(player.maxHp, Math.floor(hp)));
  }

  // --- Position (only onto a real, non-water tile) ---
  const pos = raw["pos"];
  if (isRecord(pos) && typeof pos["x"] === "number" && typeof pos["y"] === "number") {
    const x = Math.round(pos["x"]);
    const y = Math.round(pos["y"]);
    const m = state.map;
    const inBounds = x >= 0 && y >= 0 && x < m.width && y < m.height;
    if (inBounds && m.tiles[y * m.width + x] !== "water") {
      player.pos = { x, y };
    }
  }

  // Always resume in a clean, alive, idle state — runtime timers don't persist.
  player.alive = true;
  if (player.hp <= 0) player.hp = player.maxHp;
  player.path = [];
  player.pendingInteractId = null;
  player.activity = { kind: "idle", targetId: null, actionId: null, nextActionAt: 0, actionInterval: 0 };
  player.respawnAt = 0;
  return true;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function levelFromTable(table: number[], xp: number): number {
  for (let L = table.length - 1; L >= 1; L--) {
    if (xp >= (table[L] ?? Infinity)) return L;
  }
  return 1;
}
