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
  Appearance,
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
  /** Arrows nocked behind the worn `ammo` slot. */
  quiver: number;
  /** Run/walk toggle + current run energy. */
  running: boolean;
  energy: number;
  /** Selected melee combat style. */
  combatStyle: string;
  /** Active quests: id -> { step, killCount }. */
  quests: Record<string, { step: number; killCount: number }>;
  /** Completed quest ids. */
  questsDone: string[];
  /** Discovered lore fragment ids (the Archive). */
  lore: string[];
  /** Story flags. */
  flags: string[];
  /** Coins. */
  gold: number;
  /** Faction standings. */
  reputation: Record<string, number>;
  /** Cumulative achievement tallies. */
  stats: { goldEarned: number; monstersSlain: number };
  /** Total active play time in milliseconds. */
  playMs: number;
  /** Kills since the last Shard of Orun (drives the pity guarantee). */
  killsSinceShard: number;
  /** Unlocked achievement ids. */
  achievements: string[];
  /** Claimed Area Diary ids. */
  diariesClaimed: string[];
  /** Name, cosmetic colours and body styles from the character creator. */
  appearance: Appearance;
  /** Bounty progression: Hunt Marks, chosen guide, the active task (if any). */
  bounty: {
    marks: number;
    guideId: string;
    task: { monster: string; required: number; progress: number; xp: number; marks: number; guideId: string } | null;
  };
  /** Farming patches: patch id -> what's planted and when (epoch ms). */
  farms: Record<string, { crop: string; plantedAt: number }>;
  /** Player housing: claimed plot ids + built furniture (hotspot id -> piece id). */
  housing: { plots: string[]; furniture: Record<string, string> };
  hp: number;
  /** Where the player respawns (moved to a homestead once a bed is built). */
  spawn: { x: number; y: number };
  pos: { x: number; y: number };
}

/** Snapshot the player's progress into a plain, serialisable object. */
export function serializePlayer(state: WorldState): SavedProgress {
  const { player } = state;
  const skills: Partial<Record<SkillId, number>> = {};
  (Object.keys(player.skills) as SkillId[]).forEach((id) => {
    skills[id] = player.skills[id].xp;
  });
  const farms: SavedProgress["farms"] = {};
  const housing: SavedProgress["housing"] = { plots: [], furniture: {} };
  for (const id of Object.keys(state.objects)) {
    const o = state.objects[id]!;
    if (o.crop && typeof o.plantedAt === "number") {
      farms[id] = { crop: o.crop, plantedAt: o.plantedAt };
    }
    if (o.owned) housing.plots.push(id);
    if (o.furniture) housing.furniture[id] = o.furniture;
  }
  return {
    farms,
    housing,
    spawn: { x: Math.round(player.spawn.x), y: Math.round(player.spawn.y) },
    version: SAVE_VERSION,
    skills,
    inventory: player.inventory.map((s) => (s ? { item: s.item, qty: s.qty } : null)),
    bank: { ...player.bank } as Record<string, number>,
    equipment: { ...player.equipment } as Record<string, string>,
    quiver: player.quiver,
    running: player.running,
    energy: player.energy,
    combatStyle: player.combatStyle,
    quests: JSON.parse(JSON.stringify(player.quests)) as SavedProgress["quests"],
    questsDone: [...player.questsDone],
    lore: [...player.lore],
    flags: [...player.flags],
    gold: player.gold,
    reputation: { ...player.reputation },
    stats: { ...player.stats },
    playMs: player.playMs,
    achievements: [...player.achievements],
    diariesClaimed: [...player.diariesClaimed],
    killsSinceShard: player.killsSinceShard,
    appearance: { ...player.appearance },
    bounty: {
      marks: player.bounty.marks,
      guideId: player.bounty.guideId,
      task: player.bounty.task ? { ...player.bounty.task } : null,
    },
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
        const qty = finiteNum(rawQty) && rawQty > 0 ? Math.floor(rawQty) : 1;
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
      if (key in content.items && finiteNum(qty) && qty > 0) {
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
  // Arrows nocked behind the `ammo` slot. Keep the count and the slot in sync:
  // no quiver without arrows worn, and an empty quiver clears the slot.
  const savedQuiver = raw["quiver"];
  player.quiver = finiteNum(savedQuiver) && savedQuiver > 0 ? Math.floor(savedQuiver) : 0;
  if (!player.equipment.ammo) player.quiver = 0;
  else if (player.quiver <= 0) delete player.equipment.ammo;

  // Run/walk preference + energy (winded is derived, never persisted).
  if (typeof raw["running"] === "boolean") player.running = raw["running"];
  const savedEnergy = raw["energy"];
  if (finiteNum(savedEnergy)) player.energy = Math.max(0, Math.min(100, savedEnergy));
  player.winded = player.energy <= 0;
  player.agilityLap = null; // lap progress is transient — start fresh on load
  // Tools are wielded in the mainhand now. Make sure the player still owns each
  // basic tool so saves from before this change can gather: if they hold no
  // tool of a kind anywhere (hand, pack or bank), drop a tier-1 one in the pack.
  const STARTER_TOOLS: ItemId[] = ["hatchet_1", "pickaxe_1", "rod_1"] as ItemId[];
  const ownsTool = (kind: string): boolean => {
    const has = (id: ItemId | undefined) => !!id && content.items[id]?.tool === kind;
    if (has(player.equipment.mainhand)) return true;
    if (player.inventory.some((s) => s && has(s.item))) return true;
    return Object.keys(player.bank).some((id) => has(id as ItemId));
  };
  for (const id of STARTER_TOOLS) {
    if (!(id in content.items)) continue;
    const kind = content.items[id].tool;
    if (!kind || ownsTool(kind)) continue;
    const empty = player.inventory.findIndex((s) => s === null);
    if (empty !== -1) player.inventory[empty] = { item: id, qty: 1 };
  }

  // --- Combat style (preference) ---
  const style = raw["combatStyle"];
  if (style === "edge" || style === "vigour" || style === "ward") {
    player.combatStyle = style;
  }

  // --- Quests (only ids this build knows; clamp step into range) ---
  const savedDone = raw["questsDone"];
  if (Array.isArray(savedDone)) {
    player.questsDone = savedDone.filter(
      (id): id is string => typeof id === "string" && content.quests.some((q) => q.id === id),
    );
  }
  const savedFlags = raw["flags"];
  if (Array.isArray(savedFlags)) {
    player.flags = savedFlags.filter((f): f is string => typeof f === "string");
  }
  // Discovered lore (only ids this build still defines; drop the rest gracefully).
  const savedLore = raw["lore"];
  if (Array.isArray(savedLore)) {
    player.lore = savedLore.filter(
      (id): id is string => typeof id === "string" && content.lore.some((l) => l.id === id),
    );
  }
  const savedGold = raw["gold"];
  if (typeof savedGold === "number" && Number.isFinite(savedGold) && savedGold >= 0) {
    player.gold = Math.floor(savedGold);
  }
  const savedRep = raw["reputation"];
  if (isRecord(savedRep)) {
    for (const fid of Object.keys(player.reputation) as (keyof typeof player.reputation)[]) {
      const v = savedRep[fid];
      if (typeof v === "number" && Number.isFinite(v)) player.reputation[fid] = Math.round(v);
    }
  }
  const savedStats = raw["stats"];
  if (isRecord(savedStats)) {
    const g = savedStats["goldEarned"], k = savedStats["monstersSlain"];
    if (finiteNum(g) && g >= 0) player.stats.goldEarned = Math.floor(g);
    if (finiteNum(k) && k >= 0) player.stats.monstersSlain = Math.floor(k);
  }
  const savedPlay = raw["playMs"];
  if (finiteNum(savedPlay) && savedPlay >= 0) player.playMs = Math.floor(savedPlay);
  const savedPity = raw["killsSinceShard"];
  if (finiteNum(savedPity) && savedPity >= 0) player.killsSinceShard = Math.floor(savedPity);
  const savedAch = raw["achievements"];
  if (Array.isArray(savedAch)) {
    player.achievements = savedAch.filter(
      (id): id is string => typeof id === "string" && content.achievements.some((a) => a.id === id),
    );
  }
  const savedDiaries = raw["diariesClaimed"];
  if (Array.isArray(savedDiaries)) {
    player.diariesClaimed = savedDiaries.filter(
      (id): id is string => typeof id === "string" && content.diaries.some((d) => d.id === id),
    );
  }
  // Appearance (name + colours); only accept well-formed string fields.
  const savedApp = raw["appearance"];
  if (isRecord(savedApp)) {
    const a = player.appearance;
    if (typeof savedApp["name"] === "string" && savedApp["name"].trim()) a.name = savedApp["name"].slice(0, 16);
    // Colours: only accept valid hex; otherwise keep the default already set.
    for (const k of ["skin", "hair", "tunic", "legColor", "shoeColor"] as const) {
      const v = savedApp[k];
      if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) a[k] = v;
    }
    // Styles: any non-empty string; the renderer falls back for unknown ids, so
    // a save from a future build with an unrecognised style still draws safely.
    for (const k of ["hairStyle", "facial", "top", "legs", "shoes"] as const) {
      const v = savedApp[k];
      if (typeof v === "string" && v.length > 0 && v.length < 24) a[k] = v;
    }
  }
  // Bounty: restore marks, the chosen guide, and any active task — all guarded so
  // a save from before Bounty existed (no `bounty` key) just keeps the fresh state.
  const savedBounty = raw["bounty"];
  if (isRecord(savedBounty)) {
    const marks = savedBounty["marks"];
    if (finiteNum(marks) && marks >= 0) player.bounty.marks = Math.floor(marks);
    const gid = savedBounty["guideId"];
    if (typeof gid === "string" && content.bountyGuides.some((g) => g.id === gid)) {
      player.bounty.guideId = gid;
    }
    const t = savedBounty["task"];
    if (
      isRecord(t) &&
      typeof t["monster"] === "string" &&
      t["monster"] in content.monsters &&
      finiteNum(t["required"]) &&
      finiteNum(t["progress"]) &&
      finiteNum(t["xp"]) &&
      finiteNum(t["marks"])
    ) {
      const guideId = typeof t["guideId"] === "string" ? t["guideId"] : player.bounty.guideId;
      player.bounty.task = {
        monster: t["monster"],
        required: Math.max(1, Math.floor(t["required"])),
        progress: Math.max(0, Math.floor(t["progress"])),
        xp: Math.max(0, Math.floor(t["xp"])),
        marks: Math.max(0, Math.floor(t["marks"])),
        guideId,
      };
    }
  }
  // Farming patches keep growing in real time: restore what was planted + when.
  const savedFarms = raw["farms"];
  if (isRecord(savedFarms)) {
    for (const id of Object.keys(savedFarms)) {
      const f = savedFarms[id];
      const obj = state.objects[id];
      if (!obj || !isRecord(f)) continue;
      if (typeof f["crop"] === "string" && f["crop"] in content.crops && typeof f["plantedAt"] === "number") {
        obj.crop = f["crop"];
        obj.plantedAt = f["plantedAt"];
      }
    }
  }
  // Player housing: re-claim owned plots and re-place built furniture, dropping
  // any id this build no longer defines (gracefully, like everything else here).
  const savedHousing = raw["housing"];
  if (isRecord(savedHousing)) {
    const plots = savedHousing["plots"];
    if (Array.isArray(plots)) {
      for (const id of plots) {
        const obj = typeof id === "string" ? state.objects[id] : undefined;
        const def = content.objects.find((o) => o.id === id);
        // Claimed plots, and built add-on wings (room seals) — both stored as `owned`.
        if (obj && def && (def.kind === "housing_plot" || def.kind === "room_seal")) obj.owned = true;
      }
    }
    const furn = savedHousing["furniture"];
    if (isRecord(furn)) {
      for (const id of Object.keys(furn)) {
        const obj = state.objects[id];
        const def = content.objects.find((o) => o.id === id);
        const fid = furn[id];
        if (obj && def && def.kind === "build_hotspot" && typeof fid === "string" && fid in content.furniture) {
          obj.furniture = fid;
        }
      }
    }
  }
  const savedQuests = raw["quests"];
  if (isRecord(savedQuests)) {
    const quests: Player["quests"] = {};
    for (const id of Object.keys(savedQuests)) {
      const def = content.quests.find((q) => q.id === id);
      const s = savedQuests[id];
      if (!def || !isRecord(s)) continue;
      if (player.questsDone.includes(id)) continue; // done wins over active
      const step = finiteNum(s["step"]) ? s["step"] : 0;
      const killCount = finiteNum(s["killCount"]) ? s["killCount"] : 0;
      if (step >= 0 && step < def.steps.length) {
        quests[id] = { step: Math.floor(step), killCount: Math.max(0, Math.floor(killCount)) };
      }
    }
    player.quests = quests;
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

  // Respawn point (set to a homestead once a bed is built). Validate like pos.
  const sp = raw["spawn"];
  if (isRecord(sp) && typeof sp["x"] === "number" && typeof sp["y"] === "number") {
    const x = Math.round(sp["x"]);
    const y = Math.round(sp["y"]);
    const m = state.map;
    if (x >= 0 && y >= 0 && x < m.width && y < m.height && m.tiles[y * m.width + x] !== "water") {
      player.spawn = { x, y };
    }
  }

  // Always resume in a clean, alive, idle state — runtime timers don't persist.
  player.alive = true;
  if (player.hp <= 0) player.hp = player.maxHp;
  player.path = [];
  player.pendingInteractId = null;
  player.pendingInteractMode = null;
  player.station = null;
  player.activity = { kind: "idle", targetId: null, actionId: null, nextActionAt: 0, actionInterval: 0 };
  player.respawnAt = 0;
  return true;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** A real, finite number — rejects NaN and ±Infinity from a corrupt save. */
function finiteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function levelFromTable(table: number[], xp: number): number {
  for (let L = table.length - 1; L >= 1; L--) {
    if (xp >= (table[L] ?? Infinity)) return L;
  }
  return 1;
}
