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
  // Gathering + processing skills (the 13 trainable skills of Varath).
  | "mining"
  | "smithing"
  | "forestry"
  | "woodcraft"
  | "hunter"
  | "fishing"
  | "cooking"
  | "farming"
  | "survivalist"
  | "herblore"
  | "construction"
  | "crafting"
  | "bounty"
  // Combat skills.
  | "vitality"
  | "edge"
  | "vigour"
  | "ward"
  | "draw";

/**
 * The combat skills that train on every melee kill. Ward (defence) and Draw
 * (ranged) are registered skills but don't auto-train yet — they need the
 * combat-style / bow hooks, which arrive in a later bundle.
 */
export const COMBAT_SKILLS: SkillId[] = ["vitality", "edge", "vigour"];

/**
 * The melee combat style the player is using. It decides which combat skill
 * trains on a kill and grants a small bonus (Edge → accuracy, Vigour → damage,
 * Ward → defence/none), mirroring the idle game's style toggle.
 */
export type CombatStyle = "edge" | "vigour" | "ward";

/** One unlocked skill on the player: how much XP, and the level it implies. */
export interface SkillState {
  xp: number;
  level: number;
}

export type ItemId =
  | "knucklestone_ore"
  | "embercite_ore"
  | "ashiron_ore"
  | "ribstone_ore"
  | "gold_ore"
  | "bloodore_ore"
  | "hearthite_ore"
  | "voidstone_ore"
  | "knucklestone_bar"
  | "ashiron_bar"
  | "ribstone_bar"
  | "gold_bar"
  | "bloodore_bar"
  | "hearthite_bar"
  | "voidstone_bar"
  | "pickaxe_1"
  | "pickaxe_3"
  | "pickaxe_4"
  | "pickaxe_6"
  | "pickaxe_9"
  | "pickaxe_10"
  | "hatchet_1"
  | "hatchet_3"
  | "hatchet_4"
  | "hatchet_6"
  | "hatchet_9"
  | "hatchet_10"
  | "rod_1"
  | "rod_2"
  | "rod_3"
  | "rod_4"
  | "rod_5"
  | "rod_6"
  | "plank_ashwood"
  | "plank_briarwood"
  | "plank_coldpine"
  | "plank_stonewood"
  | "plank_greyoak"
  | "plank_ruewood"
  | "plank_ironbark"
  | "plank_heartoak"
  | "stone_block"
  | "cut_coldvein"
  | "cut_ribstone"
  | "ashiron_rivet"
  | "mortar_basic"
  | "mortar_refined"
  | "mortar_spinite"
  | "timber_frame"
  | "stonewood_beam"
  | "watchtower_frame"
  | "vault_stone"
  | "heartoak_beam"
  | "ashwood_log"
  | "coldpine_log"
  | "stonewood_log"
  | "greyoak_log"
  | "ruewood_log"
  | "deeproot_log"
  | "ironbark_log"
  | "heartoak_log"
  | "ashwood_shaft"
  | "coldpine_shaft"
  | "greyoak_shaft"
  | "ruewood_shaft"
  | "deeproot_shaft"
  | "stonewood_haft"
  | "crude_shortbow"
  | "shortbow"
  | "longbow"
  | "greyoak_longbow"
  | "ruewood_shortbow"
  | "duskwood_warbow"
  | "deeproot_warbow"
  | "ashfin_raw"
  | "greyfin_raw"
  | "ribperch_raw"
  | "redgill_raw"
  | "deepscale_raw"
  | "eyeless_pike_raw"
  | "river_stone"
  | "old_hook"
  | "waterlogged_coin"
  | "redrun_pearl"
  | "eyeless_scale"
  | "ashfin_cooked"
  | "speckletrout_cooked"
  | "greyfin_cooked"
  | "ribperch_cooked"
  | "coldwater_eel_cooked"
  | "redgill_cooked"
  | "deepscale_cooked"
  | "eyeless_pike_cooked"
  | "sword_1"
  | "sword_3"
  | "sword_4"
  | "sword_6"
  | "sword_9"
  | "sword_10"
  | "armor_1"
  | "armor_3"
  | "armor_4"
  | "armor_6"
  | "armor_9"
  | "armor_10"
  | "raw_rat_meat"
  | "raw_wolf_meat"
  | "raw_boar_meat"
  | "raw_bear_meat"
  | "rat_meat_cooked"
  | "wolf_meat_cooked"
  | "boar_meat_cooked"
  | "bear_meat_cooked"
  | "venison_cooked"
  | "aurochs_cooked"
  | "wolf_pelt"
  | "boar_hide"
  | "bear_pelt"
  | "venison"
  | "aurochs_cut"
  | "thick_hide"
  | "sinew"
  | "trophy"
  | "rat_tail"
  | "worn_coin"
  | "wolf_fang"
  | "boar_tusk"
  | "bear_claw"
  | "rat_king_ear"
  | "silver_wolf_pelt"
  | "bristle_crown"
  | "forest_bear_skull"
  | "pet_mining"
  | "pet_smithing"
  | "pet_forestry"
  | "pet_woodcraft"
  | "pet_fishing"
  | "pet_cooking"
  | "pet_farming"
  | "pet_survivalist"
  | "pet_herblore"
  | "pet_bounty"
  | "pet_construction"
  | "pet_crafting"
  | "pet_hunter"
  | "pet_hollow_warden"
  | "pet_bog_warden"
  | "pet_spine_warlord"
  | "pet_marrow_keeper"
  | "ribstone_arrow"
  | "bloodore_arrow"
  | "voidstone_arrow"
  | "wood_ash"
  | "fine_charcoal"
  | "ashroot_compound"
  | "dawnspore_elixir"
  | "smoked_speckletrout"
  | "smoked_greyfin"
  | "smoked_ribperch"
  | "smoked_redgill"
  | "hill_stew"
  | "forest_roast"
  | "bone_broth"
  | "redrun_chowder"
  | "deepmeat_stew"
  | "battle_ration"
  | "warriors_draught"
  | "shield_oil"
  | "hunters_kit"
  | "helm_1"
  | "helm_3"
  | "helm_4"
  | "helm_6"
  | "helm_9"
  | "helm_10"
  | "legs_1"
  | "legs_3"
  | "legs_4"
  | "legs_6"
  | "legs_8"
  | "boot_1"
  | "boot_3"
  | "boot_4"
  | "boot_6"
  | "boot_9"
  | "boot_10"
  | "shield_1"
  | "shield_3"
  | "shield_4"
  | "shield_6"
  | "shield_9"
  | "shield_10"
  | "spear_1"
  | "spear_3"
  | "spear_4"
  | "spear_6"
  | "spear_9"
  | "spear_10"
  | "dagger_1"
  | "dagger_3"
  | "dagger_4"
  | "dagger_6"
  | "dagger_9"
  | "dagger_10"
  | "hammer_1"
  | "hammer_3"
  | "hammer_4"
  | "hammer_6"
  | "hammer_9"
  | "hammer_10"
  | "claymore_1"
  | "claymore_3"
  | "claymore_4"
  | "claymore_6"
  | "claymore_9"
  | "claymore_10"
  | "ring_1"
  | "ring_3"
  | "ring_5"
  | "ring_8"
  | "neck_war"
  | "neck_ward"
  | "neck_hunt"
  | "mount_pony"
  | "mount_horse"
  | "mount_destrier"
  | "mount_galloper"
  | "mount_hound"
  | "mount_runemarked"
  | "mount_mule"
  | "mount_craggoat"
  | "mount_palecrawler"
  | "mount_deepstrider"
  | "mount_ox"
  | "mount_bristleback"
  | "mount_aurochs"
  | "mount_packbear"
  | "mount_greymane"
  | "mount_ridgewolf"
  | "mount_ironboar"
  | "mount_spinecharger"
  | "mount_silverwolf"
  | "mount_courier"
  | "mount_marshstrider"
  | "mount_stormhound"
  | "mount_dustrunner"
  | "mount_ferryman"
  | "mount_nighthound"
  | "mount_bogwisp"
  | "mount_deepwing"
  | "mount_wraithsteed"
  | "mount_lodgeoutrider"
  | "mount_hollowsteed"
  | "prosp_helmet"
  | "prosp_jacket"
  | "prosp_trousers"
  | "prosp_boots"
  | "lumber_hat"
  | "lumber_top"
  | "lumber_legs"
  | "lumber_boots"
  | "angler_hat"
  | "angler_top"
  | "angler_waders"
  | "angler_boots"
  | "farmer_hat"
  | "farmer_jacket"
  | "farmer_legs"
  | "farmer_boots"
  | "cape_mining"
  | "cape_smithing"
  | "cape_forestry"
  | "cape_woodcraft"
  | "cape_fishing"
  | "cape_cooking"
  | "cape_farming"
  | "cape_survivalist"
  | "cape_bounty"
  | "cape_vitality"
  | "cape_edge"
  | "cape_vigour"
  | "cape_ward"
  | "cape_draw"
  | "cape_construction"
  | "cape_herblore"
  | "cape_crafting"
  | "cape_hunter"
  | "cape_max"
  | "cape_ironvale"
  | "charcoal"
  | "raw_hide"
  | "tanned_leather"
  | "cured_leather"
  | "hardened_leather"
  | "master_leather"
  | "silica_sand"
  | "glass_vial"
  | "glass_bead"
  | "glass_flask"
  | "rough_gem"
  | "cut_gem"
  | "leath_helm"
  | "leath_body"
  | "leath_legs"
  | "leath_boots"
  | "cured_helm"
  | "cured_body"
  | "cured_legs"
  | "cured_boots"
  | "hard_helm"
  | "hard_body"
  | "hard_legs"
  | "hard_boots"
  | "master_helm"
  | "master_body"
  | "master_legs"
  | "master_boots"
  | "craft_ring_1"
  | "craft_ring_2"
  | "craft_ring_3"
  | "craft_ring_gem"
  | "pearl_ring"
  | "stone_ring"
  | "craft_neck_power"
  | "craft_neck_shield"
  | "craft_neck_hunter"
  | "craft_neck_gem"
  | "sigil_knuckle"
  | "sigil_spine"
  | "crest_shield"
  | "crest_shield_master"
  | "herald_cape_ash"
  | "herald_cape_deep"
  | "tip_knucklestone"
  | "tip_ashiron"
  | "tip_ribstone"
  | "tip_bloodore"
  | "tip_hearthite"
  | "tip_voidstone"
  | "arrow_knucklestone"
  | "arrow_ashiron"
  | "arrow_ashiron_resin"
  | "arrow_hearthite"
  | "plant_fiber"
  | "unstrung_crude"
  | "unstrung_short"
  | "unstrung_long"
  | "unstrung_greyoak"
  | "unstrung_ruewood"
  | "unstrung_dusk"
  | "unstrung_deep"
  | "bird_nest"
  | "bark_strip"
  | "pine_resin"
  | "ironwood_sap"
  | "greyoak_gall"
  | "ruewood_splinter"
  | "dusk_bark"
  | "deeproot_chip"
  | "resin_shaft"
  | "mushroom_broth"
  | "thornberry_tonic"
  | "hearthroot_tea"
  | "nightshade_brew"
  | "ashroot_elixir"
  | "dawnspore_draught"
  | "deepmoss_broth"
  | "ashbloom_tea"
  | "health_elixir"
  | "token_spine"
  | "token_heartmoor"
  | "token_marrow"
  | "token_redrun"
  | "shard_of_orun"
  | "blade_of_graves"
  | "marrow_flail"
  | "ashward_shield"
  | "greymail_plate"
  | "barrow_helm"
  | "orun_reaver"
  | "coldbone_bow"
  | "stoneguard_plate"
  | "ironveil_legs"
  | "warden_ring"
  | "bog_ward_helm"
  | "marrow_keep_plate"
  | "seed_ashweed"
  | "seed_thornroot"
  | "seed_bloodberry"
  | "seed_coldmoss"
  | "seed_ironleaf"
  | "seed_greybloom"
  | "seed_spinethistle"
  | "seed_ruevine"
  | "seed_duskshade"
  | "seed_marrowflower"
  | "seed_hearthbloom"
  | "seed_orunroot"
  | "seed_ashwood"
  | "seed_coldpine"
  | "seed_stonewood"
  | "seed_greyoak"
  | "seed_ruewood"
  | "seed_deeproot"
  | "herb_ashweed"
  | "herb_thornroot"
  | "herb_bloodberry"
  | "herb_coldmoss"
  | "herb_ironleaf"
  | "herb_greybloom"
  | "herb_spinethistle"
  | "herb_ruevine"
  | "herb_duskshade"
  | "herb_marrowflower"
  | "herb_hearthbloom"
  | "herb_orunroot"
  | "fertilizer_basic"
  | "fertilizer_rich"
  | "forage_mushroom"
  | "forage_thornberry"
  | "forage_hearthroot"
  | "forage_nightshade"
  | "forage_ashroot"
  | "forage_dawnspore"
  | "forage_deepmoss"
  | "forage_ashbloom"
  | "potion_wildroot"
  | "potion_greensap"
  | "potion_thornbrew"
  | "potion_ironbrew"
  | "potion_spinedraught"
  | "potion_gallbrew"
  | "potion_bloodfire"
  | "potion_coldedge"
  | "potion_runeward"
  | "potion_duskdraught"
  | "potion_swifteye"
  | "potion_trueshot"
  | "potion_hearthblaze"
  | "potion_orunsap"
  | "potion_stonebind"
  | "potion_deepcalm"
  | "potion_ashbloom"
  | "forge_token"
  | "pale_record_pass"
  | "seam_marker"
  | "greyoak_bough"
  | "orun_shard_large"
  | "cult_offering"
  | "berric_notes"
  | "maret_key"
  | "sera_lens"
  | "lenne_token"
  | "lodge_badge"
  | "greymane_pelt"
  | "greymane_tusk"
  | "ashforge_hammer"
  | "intact_burial_shard"
  | "sera_cipher_pendant"
  | "lodge_token"
  | "order_cipher_key"
  | "apprentice_mark_blade"
  | "berric_ledger"
  | "warden_longbow"
  | "chronicler_seal"
  | "ironbark_shard"
  | "heartoak_amber";

/**
 * The wearable equipment slots, named per the idle game's canon `equip` values.
 * A piece of gear declares which one it fills via ItemDef.slot; the player wears
 * one item per slot. (Tool/meta slots like pickaxe/mount aren't worn here yet.)
 */
export type EquipSlot =
  | "mainhand"
  | "offhand"
  | "helmet"
  | "armor"
  | "legs"
  | "boots"
  | "ring"
  | "necklace"
  | "cape";

/**
 * A static description of an item. Lives in src/content/items.ts.
 *
 * Most fields are copied verbatim from the Varath idle game's `ITEMS` table so
 * the two games describe the same objects identically. Many are pure data that
 * the spatial game doesn't use yet (canon `slot`, weapon `acc`, food `buff`s,
 * mount/pet/cape `meta`); they're carried losslessly so nothing is invented or
 * dropped when the systems that consume them arrive. See docs/CANON_LEDGER.md.
 */
export interface ItemDef {
  id: ItemId;
  name: string;
  /** Short flavour text shown in tooltips / the log. */
  description: string;
  /** Canon icon glyph. */
  icon?: string;
  /** Canon category label, e.g. "Ores", "Weapons", "Food". */
  cat?: string;
  /** Sell value in gold (from the idle game's GOLD_VALUES). */
  sell?: number;
  /** Food only: hit points restored when eaten. */
  heals?: number;

  // --- Gear ---
  /**
   * Canon equip/tool slot string: "mainhand", "armor", "helmet", "legs",
   * "boots", "offhand", "ring", "necklace", "cape" (wearable) or "pickaxe"/
   * "hatchet"/"rod"/"ranged"/"ammo"/"mount"/"companion" (not worn here yet).
   * An item is equippable when this matches one of the EquipSlot values.
   */
  slot?: string;
  /** Tier on the canon material ladder (1–10). */
  tier?: number;
  /** Weapon accuracy bonus. */
  acc?: number;
  /** Weapon damage bonus / added to max hit. */
  dmg?: number;
  /** Armour defence bonus. */
  def?: number;
  /** Weapon attack interval (ms). */
  speed?: number;
  /** Weapon attack style: "slash" | "stab" | "crush". */
  attackStyle?: string;
  /** Weapon family, e.g. "sword", "dagger", "claymore". */
  wepType?: string;
  /** Whether the weapon occupies both hands (no shield). */
  twoHand?: boolean;
  /** Crafting tier for leather armour (1–4). */
  craftTier?: number;
  /** Rarity label, e.g. "legendary". */
  rarity?: string;
  /** Lore/dungeon tag for legendary drops. */
  lore?: string;

  // --- Food / potion buffs (data only until the buff hook lands) ---
  buff?: string;
  buffAmt?: number;
  buffMs?: number;

  /** Lossless passthrough for meta-system fields (mount/pet/cape perks). */
  meta?: Record<string, string | number | boolean>;
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
  | "furnace"
  | "anvil";

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
  /** Canon rarity label: "always" | "common" | "uncommon" | "rare" | "legendary". */
  tier?: string;
}

/**
 * The combat stats + loot table for a kind of monster, ported verbatim from the
 * idle game's `MONSTERS` table. `acc`/`def`/`speed`/`attackStyle`/`weakness` are
 * carried so the combat-math upgrade can use them; today's simplified combat
 * uses `maxHit`/`hp`/`xp` only. See docs/CANON_LEDGER.md.
 */
export interface MonsterStats {
  id: string;
  name: string;
  /** Canon icon glyph. */
  icon?: string;
  level: number;
  hp: number;
  /** Attack accuracy rating. */
  acc?: number;
  /** Defence rating (reduces the player's hit chance). */
  def?: number;
  /** Highest damage the monster can deal in one hit. */
  maxHit: number;
  /** Attack interval in ms. */
  speed?: number;
  /** Combat XP granted (to each combat skill) on a kill. */
  xp: number;
  /** Attack style: "slash" | "stab" | "crush". */
  attackStyle?: string;
  /** Styles this monster is weak to (extra damage). */
  weakness?: string[];
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
  /** Monsters only: time (ms) of the monster's next attack while in combat. */
  nextAttackAt?: number;
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
  /** Any station recipe (cooking, smelting, smithing, firemaking…). */
  | "crafting";

export interface Activity {
  kind: ActivityKind;
  /** The world object this activity targets (e.g. the tree being chopped). */
  targetId: string | null;
  /** Crafting only: the SkillAction id being repeated at a station. */
  actionId: string | null;
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
  /** Worn gear: one item id per equipment slot (absent slots are empty). */
  equipment: Partial<Record<EquipSlot, ItemId>>;
  /** The melee combat style trained on the next kill. */
  combatStyle: CombatStyle;
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

/** "Wear the gear in this inventory slot" (swapping out anything already worn). */
export interface EquipIntent {
  type: "EQUIP";
  slot: number;
}

/** "Take off whatever I'm wearing in this slot" (back into the pack). */
export interface UnequipIntent {
  type: "UNEQUIP";
  equipSlot: EquipSlot;
}

/**
 * "Make this recipe at the station I'm standing at." The actionId is a
 * SkillAction id (see src/content/actions.ts); objId is the station, so the
 * client can show progress on it. The core repeats it until materials run out.
 */
export interface CraftIntent {
  type: "CRAFT";
  actionId: string;
  objId: string;
}

/** "Switch my melee combat style" (which combat skill the next kill trains). */
export interface SetStyleIntent {
  type: "SET_STYLE";
  style: CombatStyle;
}

export type Intent =
  | MoveIntent
  | InteractIntent
  | CancelIntent
  | EatIntent
  | DepositIntent
  | WithdrawIntent
  | EquipIntent
  | UnequipIntent
  | CraftIntent
  | SetStyleIntent;

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
  | { type: "OPEN_BANK" }
  /** Open the recipe menu for a station (fire/furnace/anvil). */
  | { type: "OPEN_CRAFT"; station: ObjKind; objId: string };

// ---------------------------------------------------------------------------
// Content bundle: all the game DATA handed to the core when a world is made.
// ---------------------------------------------------------------------------

/**
 * One skill action, ported verbatim from the idle game's `SKILLS[*].actions`.
 * This is the canonical recipe/gathering data for every gathering and
 * processing skill. Station crafting (cooking/smelting/smithing/firemaking)
 * runs directly off these. See src/content/actions.ts.
 */
export interface SkillAction {
  id: string;
  /** Which skill trains this action. */
  skill: SkillId;
  name: string;
  /** Level in `skill` required to perform it. */
  levelReq: number;
  /** XP granted on a successful action. */
  xp: number;
  /** Canon action time in ms (the spatial game may re-tune pacing). */
  baseTime?: number;
  /** Inputs consumed, item id -> quantity. */
  requires?: Partial<Record<ItemId, number>>;
  /** Inputs where any one of these items satisfies the recipe. */
  requiresAny?: ItemId[];
  /** The item produced (absent for a few pure-effect actions). */
  produces?: ItemId;
  /** How many of `produces` are made per action (default 1). */
  produceQty?: number;
  /** UI grouping key, e.g. "arrows", "smoked", "quarry". */
  group?: string;
  /** Designer note / flavour shown in tooltips. */
  note?: string;
  /** Gather location key (fishing). */
  location?: string;
  /** Whether this is a timed bonus-window catch (fishing). */
  window?: boolean;
  /** Reforge-only: melts all gear instead of producing an item. */
  meltAll?: boolean;
  /** An extra rare drop on success. */
  rareDrop?: { item: ItemId; chance: number };
  /** A chance to also get a seed (forestry). */
  seedDrop?: { item: ItemId; chance: number };
  /** A chance to also get wood shards (forestry). */
  woodShardDrop?: { chance: number };
}

export interface Content {
  map: WorldMap;
  objects: WorldObjectDef[];
  items: Record<ItemId, ItemDef>;
  /** Monster combat stats + loot, keyed by MonsterStats id. */
  monsters: Record<string, MonsterStats>;
  /** The full canon skill-action registry — drives gathering + station crafting. */
  actions: SkillAction[];
  /** XP needed to *reach* each level. xpForLevel[1] = 0, etc. */
  xpForLevel: number[];
  /** Player-facing skill metadata (display name + icon glyph). */
  skills: Record<SkillId, { name: string; icon: string }>;
}
