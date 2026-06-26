/**
 * src/content/spawns.ts
 * ---------------------
 * Where every interactive object sits in the world. Pure DATA.
 *
 * The Knuckle Hills (north): Ashwood trees on the dirt grove, Knucklestone rocks
 * on the stone outcrop, fishing on the head of the Redrun, the camp stations,
 * Aldric on the path, and Moor Rats / a Hill Wolf out on the grass.
 *
 * Greyoak Wood (south): old lowland forest reached by the road. Coldpine at the
 * forest edge and wide greyoak in the deep (Forestry); Wild Boar in the
 * understory, Forest Bears deeper, and the rare Greymane Boar in the oldest
 * growth; Maret keeps the Greyoak Lodge in the clearing. (Bible §X.)
 */

import type { WorldObjectDef } from "../core/types.ts";

export const objects: WorldObjectDef[] = [
  // === THE KNUCKLE HILLS =====================================================

  // --- Trees (Forestry) on the dirt grove ---
  { id: "tree_1", kind: "tree", x: 4, y: 2, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_2", kind: "tree", x: 7, y: 3, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_3", kind: "tree", x: 3, y: 4, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },

  // --- Rocks (Mining) on the stone outcrop ---
  { id: "rock_1", kind: "rock", x: 20, y: 2, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_2", kind: "rock", x: 23, y: 3, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_3", kind: "rock", x: 21, y: 4, name: "Knucklestone Rock", resource: "mine_knucklestone" },

  // --- Fishing on the lake along Ironvale's west wall (these sit on water) ---
  { id: "fish_1", kind: "fishing_spot", x: 7, y: 12, name: "Fishing Spot", resource: "fish_ashfin" },
  { id: "fish_2", kind: "fishing_spot", x: 5, y: 12, name: "Fishing Spot", resource: "fish_ashfin" },

  // --- Ironvale's market: bank chest, cooking fire, furnace, and the anvil ---
  { id: "bank_1", kind: "bank", x: 16, y: 10, name: "Bank Chest" },
  { id: "fire_1", kind: "fire", x: 17, y: 11, name: "Cooking Fire" },
  { id: "furnace_1", kind: "furnace", x: 18, y: 10, name: "Furnace" },
  { id: "anvil_1", kind: "anvil", x: 19, y: 11, name: "Anvil" },

  // --- The Ironvale market traders (shops to come) ---
  {
    id: "shop_quartermaster",
    kind: "npc",
    x: 15,
    y: 12,
    name: "Hespa, Quartermaster",
    lines: [
      "Ironvale's market, friend. Cramped, loud, and the only honest counter for three days' walk.",
      "Tools, packs, rations — I'll stock the lot once the road's safe enough to bring it in. Come back and the stall'll be full.",
    ],
  },
  {
    id: "shop_armourer",
    kind: "npc",
    x: 20,
    y: 13,
    name: "Doran, Armourer",
    lines: [
      "You stand like someone who's been hit before. Good — means you'll buy mail and mean it.",
      "Shields, helms, plate — Ashforge work, when I've a case to sell from. Mind the anvil's busy; Vorn doesn't share the fire.",
    ],
  },
  {
    id: "shop_trader",
    kind: "npc",
    x: 11,
    y: 13,
    name: "Skritt",
    lines: [
      "Pssst. Goblin prices, friend — better than honest, worse than fair.",
      "Skritt buys what others won't, sells what others can't. The warm stone especially. Skritt is always interested in the warm stone.",
    ],
  },

  // --- Aldric, on the path ---
  {
    id: "aldric",
    kind: "npc",
    x: 14,
    y: 8,
    name: "Aldric",
    lines: [
      "You've an honest look about you. Good — there's a thing that's been gnawing at me.",
      "Found this old coin in the dirt by my wall. Old Varath mintage, struck before my grandfather's grandfather drew breath. Worn smooth — and no coin I've ever known.",
      "Here's the strange of it: the moor rats keep turning the things up in their nests. A dead king's money, in a rat's hole. Why?",
      "Humour an old man. Put one of those rats down and see what it carries. Hold a thing to study it first — then strike.",
      "Ash and knuckle, that's all these hills are. But every road in Varath starts on one like it. Follow the south road and you'll come to Greyoak.",
    ],
  },

  // --- Vorn, the Ashforge master, at the furnace ---
  {
    id: "vorn",
    kind: "npc",
    x: 17,
    y: 9,
    name: "Vorn",
    lines: [
      "Hot work, smith. Mind the slag and we'll get along.",
      "The Ashforge Brotherhood doesn't recruit. We warn a man what the hammer costs, and then we wait to see if he picks it up anyway.",
      "Teach yourself on cold ash and guesswork long enough and the metal starts telling you things. Stay, and I'll tell you the rest.",
    ],
  },

  // --- Sera, archivist of the Pale Record ---
  {
    id: "sera",
    kind: "npc",
    x: 12,
    y: 10,
    name: "Sera",
    lines: [
      "Careful with the dust — half of it is older than the kingdom.",
      "The Pale Record keeps what the world would rather forget. The Underloft. The warm stone they buried their dead with. The coins that keep surfacing.",
      "Bring me a thing with a question on it and I'll give it a home instead of a shelf over a hearth.",
    ],
  },

  // --- Berric, of the Ashforge inner council ---
  {
    id: "berric",
    kind: "npc",
    x: 21,
    y: 9,
    name: "Berric",
    lines: [
      "New blood. Vorn's project, are you. He does like to collect strays.",
      "Stone's stone, friend. A seam doesn't care who surveys it or who buys the map after. Only a fool leaves money in the ground out of sentiment.",
      "We should talk properly some time. Quietly.",
    ],
  },

  // --- Aldric's farmstead, west of Ironvale: plant + tree patches ---
  { id: "patch_1", kind: "plant_patch", x: 2, y: 7, name: "Plant Patch" },
  { id: "patch_2", kind: "plant_patch", x: 4, y: 7, name: "Plant Patch" },
  { id: "patch_3", kind: "plant_patch", x: 6, y: 7, name: "Plant Patch" },
  { id: "patch_4", kind: "plant_patch", x: 2, y: 9, name: "Plant Patch" },
  { id: "patch_5", kind: "plant_patch", x: 4, y: 9, name: "Plant Patch" },
  { id: "patch_6", kind: "plant_patch", x: 6, y: 9, name: "Plant Patch" },
  { id: "treepatch_1", kind: "tree_patch", x: 2, y: 16, name: "Tree Patch" },
  { id: "treepatch_2", kind: "tree_patch", x: 6, y: 16, name: "Tree Patch" },

  // --- Monsters (Combat) — kept outside Ironvale's walls, in the hills ---
  { id: "rat_1", kind: "monster", monster: "moor_rat", x: 20, y: 5, name: "Moor Rat" },
  { id: "rat_2", kind: "monster", monster: "moor_rat", x: 22, y: 5, name: "Moor Rat" },
  { id: "wolf_1", kind: "monster", monster: "hill_wolf", x: 18, y: 16, name: "Hill Wolf" },

  // === GREYOAK WOOD ==========================================================

  // --- Coldpine at the forest edge (Forestry 20) ---
  { id: "gw_pine_1", kind: "tree", x: 5, y: 19, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_2", kind: "tree", x: 8, y: 21, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_3", kind: "tree", x: 20, y: 19, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_4", kind: "tree", x: 22, y: 21, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_5", kind: "tree", x: 6, y: 22, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },

  // --- Wide greyoak in the deep wood (Forestry 45) ---
  { id: "gw_oak_1", kind: "tree", x: 4, y: 29, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_2", kind: "tree", x: 8, y: 31, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_3", kind: "tree", x: 21, y: 30, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_4", kind: "tree", x: 23, y: 28, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_5", kind: "tree", x: 18, y: 32, name: "Greyoak (Old Growth)", resource: "fell_greyoak", species: "greyoak" },

  // --- Maret, keeper of the Greyoak Lodge (in the clearing) ---
  {
    id: "maret",
    kind: "npc",
    x: 16,
    y: 25,
    name: "Maret",
    lines: [
      "Stranger on the Lodge road. You'll forgive the look — the wood teaches you to measure people.",
      "This is Greyoak. Old before Ironvale was a name. The boar keep to the understory; give the deep wood its distance and it gives you yours.",
      "Every season the old growth pulls back a little further. We mark the new treeline against the last. We do not ask what walks in the cleared ground.",
      "Bring an axe worth the name and the greyoak will pay you in timber. Bring less and it will only blunt you.",
    ],
  },

  // --- Lenne, the Lodge tracker, working the near trees ---
  {
    id: "lenne",
    kind: "npc",
    x: 14,
    y: 24,
    name: "Lenne",
    lines: [
      "Quiet, now. You'll learn more standing still in this wood than talking in it.",
      "I track for the Lodge. Maret keeps the fire; I keep the treeline. We both watch the same thing pulling back.",
      "If the old growth ever decides you're worth its notice, you'll feel it before you see it. Don't run.",
    ],
  },

  // --- Boar in the understory; bears and the Greymane in the deep ---
  { id: "gw_boar_1", kind: "monster", monster: "wild_boar", x: 9, y: 21, name: "Wild Boar" },
  { id: "gw_boar_2", kind: "monster", monster: "wild_boar", x: 18, y: 22, name: "Wild Boar" },
  { id: "gw_boar_3", kind: "monster", monster: "wild_boar", x: 11, y: 28, name: "Wild Boar" },
  { id: "gw_bear_1", kind: "monster", monster: "forest_bear", x: 5, y: 30, name: "Forest Bear" },
  { id: "gw_bear_2", kind: "monster", monster: "forest_bear", x: 22, y: 32, name: "Forest Bear" },
  { id: "gw_greymane", kind: "monster", monster: "greymane_boar", x: 15, y: 32, name: "Greymane Boar" },

  // === THE SPINE =============================================================
  // Orun's backbone: mining the Spinite Cut, and the long climb past ridge
  // wolves, stone crawlers, trolls and wraiths. (Bible §X.)

  // --- Serath the Spine Warden, at the head of the pass ---
  {
    id: "serath",
    kind: "npc",
    x: 32,
    y: 6,
    name: "Serath",
    lines: [
      "Far enough, for now. This is the Spine — Orun's backbone, the faithful say. Whatever it is, it does not forgive carelessness.",
      "Ridge wolves on the low passes. Higher, the stone crawlers and the trolls. And the wraiths, where the wind never stops. Go up only as far as you can come down.",
      "The Cut yields good metal — ashiron, and ribstone deeper. Bring a pick that can take the cold.",
      "Two things you'll find and not understand: the Wind-Shrine, worn to the shape of a vertebra, and the Vault, shut from the inside. Measure them if you must. Don't pretend to read them.",
    ],
  },

  // --- The Spinite Cut: ashiron (Mining 20) and ribstone (Mining 30) ---
  { id: "sp_rock_1", kind: "rock", x: 32, y: 11, name: "Ashiron Seam", resource: "mine_ashiron" },
  { id: "sp_rock_2", kind: "rock", x: 35, y: 15, name: "Ashiron Seam", resource: "mine_ashiron" },
  { id: "sp_rock_3", kind: "rock", x: 42, y: 22, name: "Ribstone Seam", resource: "mine_ribstone" },
  { id: "sp_rock_4", kind: "rock", x: 46, y: 29, name: "Ribstone Seam", resource: "mine_ribstone" },

  // --- Monsters, by altitude ---
  { id: "sp_wolf_1", kind: "monster", monster: "ridge_wolf", x: 36, y: 7, name: "Ridge Wolf" },
  { id: "sp_wolf_2", kind: "monster", monster: "ridge_wolf", x: 37, y: 12, name: "Ridge Wolf" },
  { id: "sp_crawler_1", kind: "monster", monster: "stone_crawler", x: 35, y: 18, name: "Stone Crawler" },
  { id: "sp_crawler_2", kind: "monster", monster: "stone_crawler", x: 44, y: 16, name: "Stone Crawler" },
  { id: "sp_troll_1", kind: "monster", monster: "mountain_troll", x: 45, y: 25, name: "Mountain Troll" },
  { id: "sp_wraith_1", kind: "monster", monster: "spine_wraith", x: 46, y: 20, name: "Spine Wraith" },
  { id: "sp_wraith_2", kind: "monster", monster: "spine_wraith", x: 42, y: 33, name: "Spine Wraith" },

  // --- Landmarks (examine-only) ---
  {
    id: "spine_wind_shrine",
    kind: "shrine",
    x: 44,
    y: 5,
    name: "The Wind-Shrine",
    lines: [
      "A standing stone the wind has worn to the shape of a vertebra. Orun's, the believers say. A rock worn by weather, say the rest. The shrine settles nothing.",
    ],
  },
  {
    id: "spine_vault",
    kind: "shrine",
    x: 44,
    y: 30,
    name: "The Spine Vault",
    lines: [
      "A door of dressed stone set into the mountain — shut, and shut from the inside. The ward-stones around it have not been moved in a very long time.",
    ],
  },

  // === HEARTMOOR =============================================================
  // Open southern moor: hounds, bog knights and mire serpents; the Cult's edge.
  {
    id: "calder",
    kind: "npc",
    x: 9,
    y: 36,
    name: "Calder",
    lines: [
      "Cold road, isn't it. Sit a moment — there's always a fire going at the moor's edge, and food for whoever the road gives out on.",
      "We're the Heartmoor faithful. No, don't make the face. We feed people. What you do with the rest of it is your business.",
      "The peat keeps things. Bog-bodies, old swords, older questions. And the warm seams — Hearthite, black and almost living. Rock, the miners say. We say otherwise. Both are true of the same stone.",
      "Go careful past the pools. The bog knights don't sleep, and the serpents are patient.",
    ],
  },
  { id: "hm_lurker_1", kind: "monster", monster: "marsh_lurker", x: 8, y: 41, name: "Marsh Lurker" },
  { id: "hm_lurker_2", kind: "monster", monster: "marsh_lurker", x: 20, y: 44, name: "Marsh Lurker" },
  { id: "hm_hound_1", kind: "monster", monster: "heartmoor_hound", x: 6, y: 48, name: "Heartmoor Hound" },
  { id: "hm_hound_2", kind: "monster", monster: "heartmoor_hound", x: 22, y: 50, name: "Heartmoor Hound" },
  { id: "hm_serpent_1", kind: "monster", monster: "mire_serpent", x: 17, y: 39, name: "Mire Serpent" },
  { id: "hm_knight_1", kind: "monster", monster: "bog_knight", x: 12, y: 53, name: "Bog Knight" },
  {
    id: "heartmoor_barrow",
    kind: "shrine",
    x: 5,
    y: 53,
    name: "The Bog Barrow",
    lines: [
      "A grave the moor grew up around — older than the bog, they say, built before the land here settled. Whatever waits inside has waited a very long time.",
    ],
  },

  // === THE ASHFEN FLATS =====================================================
  // Warm geothermal ground south of the Spine: the Embercite workings, kept by
  // the Cult as a secondary sacred site.
  {
    id: "ashfen_tender",
    kind: "npc",
    x: 38,
    y: 38,
    name: "Cult Tender",
    lines: [
      "You feel it through your boots — the ground's warm here, warmer the deeper you cut. The miners work short shifts. We don't mind the heat.",
      "Embercite comes out of this rock. The smiths swear by it for flux. We keep the seam clean and leave what we owe.",
      "I won't ask you to help. Only to witness. The discomfort is the point.",
    ],
  },
  { id: "af_rock_1", kind: "rock", x: 32, y: 40, name: "Embercite Working", resource: "mine_embercite" },
  { id: "af_rock_2", kind: "rock", x: 40, y: 46, name: "Embercite Working", resource: "mine_embercite" },
  { id: "af_rock_3", kind: "rock", x: 36, y: 52, name: "Embercite Working", resource: "mine_embercite" },

  // === THE MARROW DEEPS =====================================================
  // Caves beneath the Spine: total dark. Cave crawlers, deep bats, wraiths and
  // deepstone golems; voidstone in the deepest shafts; the sealed Marrow Vault.
  { id: "md_crawler_1", kind: "monster", monster: "cave_crawler", x: 51, y: 6, name: "Cave Crawler" },
  { id: "md_crawler_2", kind: "monster", monster: "cave_crawler", x: 57, y: 11, name: "Cave Crawler" },
  { id: "md_bat_1", kind: "monster", monster: "deep_bat", x: 55, y: 4, name: "Deep Bat" },
  { id: "md_bat_2", kind: "monster", monster: "deep_bat", x: 59, y: 17, name: "Deep Bat" },
  { id: "md_wraith_1", kind: "monster", monster: "marrow_wraith", x: 50, y: 21, name: "Marrow Wraith" },
  { id: "md_golem_1", kind: "monster", monster: "deep_golem", x: 59, y: 23, name: "Deepstone Golem" },
  { id: "md_rock_1", kind: "rock", x: 54, y: 16, name: "Voidstone Shaft", resource: "mine_voidstone" },
  { id: "md_rock_2", kind: "rock", x: 58, y: 22, name: "Voidstone Shaft", resource: "mine_voidstone" },
  {
    id: "marrow_vault",
    kind: "shrine",
    x: 61,
    y: 8,
    name: "The Marrow Vault",
    lines: [
      "Walls too smooth to be the dark's work, and a door that was opened from the inside. Whatever stayed down here, stayed because it chose to.",
    ],
  },
  // --- The Marrow Keeper: last Underloft guardian, waiting by the vault ---
  {
    id: "marrow_keeper",
    kind: "npc",
    x: 60,
    y: 9,
    name: "The Marrow Keeper",
    lines: [
      "You came down the long dark and the door let you. Few things it lets through.",
      "I kept the watch when there was an order to keep it for. Now there is only the watch, and the stone, and the warmth that will not cool.",
      "Ask what you came to ask. But know that I have stood here longer than your kingdom, and even I cannot tell you whether the warmth is a god.",
    ],
  },

  // === THE REDRUN & THE EYELESS SEA =========================================
  // The long red river to the estuary and the open grey. Bloodore on the banks,
  // fishing from river to sea, brigands, an old Orc, and the Dread Ferryman.
  { id: "rd_rock_1", kind: "rock", x: 50, y: 32, name: "Bloodore Vein", resource: "mine_bloodore" },
  { id: "rd_rock_2", kind: "rock", x: 51, y: 40, name: "Bloodore Vein", resource: "mine_bloodore" },
  { id: "rd_fish_greyfin", kind: "fishing_spot", x: 54, y: 34, name: "Greyfin Pool", resource: "fish_greyfin" },
  { id: "rd_fish_1", kind: "fishing_spot", x: 54, y: 33, name: "Ribvault Shallows", resource: "fish_ribperch" },
  { id: "rd_fish_2", kind: "fishing_spot", x: 58, y: 41, name: "The Estuary", resource: "fish_redgill" },
  { id: "rd_fish_3", kind: "fishing_spot", x: 59, y: 48, name: "The Eyeless Sea", resource: "fish_deepscale" },
  { id: "rd_fish_4", kind: "fishing_spot", x: 61, y: 51, name: "The Eyeless Deep", resource: "fish_eyeless_pike" },
  { id: "rd_brigand_1", kind: "monster", monster: "redrun_brigand", x: 50, y: 36, name: "Redrun Brigand" },
  { id: "rd_serpent_1", kind: "monster", monster: "river_serpent", x: 51, y: 44, name: "River Serpent" },
  { id: "rd_orc_1", kind: "monster", monster: "ancient_orc", x: 51, y: 48, name: "Ancient Orc" },
  { id: "rd_ferryman", kind: "monster", monster: "dread_ferryman", x: 51, y: 45, name: "The Dread Ferryman" },

  // === HUNTER & BOUNTY ======================================================
  // Snares (Hunter) sit on the game-runs in each zone — a depleting gather that
  // yields hide + meat, tiered by Hunter level. The Bounty board in Ironvale
  // hands out slay-tasks, paid in Hunt Marks.

  // --- The Ironvale bounty board, by the market ---
  { id: "bounty_board_1", kind: "bounty_board", x: 13, y: 11, name: "Bounty Board" },

  // --- Hare snares: open Knuckle Hills (Hunter 1) ---
  { id: "trap_hare_1", kind: "trap", x: 24, y: 6, name: "Snare", resource: "hunt_hare" },
  { id: "trap_hare_2", kind: "trap", x: 26, y: 8, name: "Snare", resource: "hunt_hare" },

  // --- Boar snares: Greyoak understory (Hunter 20) ---
  { id: "trap_boar_1", kind: "trap", x: 11, y: 20, name: "Boar Snare", resource: "hunt_boar" },
  { id: "trap_boar_2", kind: "trap", x: 20, y: 23, name: "Boar Snare", resource: "hunt_boar" },

  // --- Wolf snares: Greyoak deep wood (Hunter 30) ---
  { id: "trap_wolf_1", kind: "trap", x: 13, y: 29, name: "Wolf Snare", resource: "hunt_wolf" },

  // --- Bear snares: the cleared ground at the wood's edge (Hunter 45) ---
  { id: "trap_bear_1", kind: "trap", x: 7, y: 31, name: "Bear Snare", resource: "hunt_bear" },
  { id: "trap_bear_2", kind: "trap", x: 20, y: 30, name: "Bear Snare", resource: "hunt_bear" },

  // --- Stag snares: the open Heartmoor (Hunter 60) ---
  { id: "trap_stag_1", kind: "trap", x: 10, y: 45, name: "Stag Snare", resource: "hunt_stag" },
  { id: "trap_stag_2", kind: "trap", x: 19, y: 47, name: "Stag Snare", resource: "hunt_stag" },

  // --- Aurochs snares: deep Heartmoor, the largest game (Hunter 90) ---
  { id: "trap_aurochs_1", kind: "trap", x: 14, y: 50, name: "Aurochs Snare", resource: "hunt_aurochs" },

  // === BOSS DUNGEONS ========================================================
  // Each boss has its own sealed arena in the hidden band below the overworld.
  // An overworld portal teleports you in; a return portal brings you home. The
  // boss drops its loot + a rare chance at its companion pet.

  // --- The Hollow Barrows (Knuckle Hills · combat 30) — arena at x=2 ---
  {
    id: "portal_hollow", kind: "portal", x: 25, y: 4, name: "The Hollow Barrows",
    dungeon: "hollow_barrows", target: { x: 8, y: 66 },
    lines: ["You descend into the Hollow Barrows."],
  },
  { id: "ret_hollow", kind: "portal", x: 8, y: 67, name: "Barrow Exit", target: { x: 24, y: 4 }, lines: ["You climb back into the daylight."] },
  { id: "boss_hollow", kind: "monster", monster: "hollow_warden", x: 8, y: 63, name: "The Hollow Warden" },
  { id: "hollow_add1", kind: "monster", monster: "wild_boar", x: 5, y: 65, name: "Barrow Boar" },
  { id: "hollow_add2", kind: "monster", monster: "forest_bear", x: 11, y: 65, name: "Barrow Bear" },

  // --- The Bog Barrow (Heartmoor · combat 38) — arena at x=18 ---
  {
    id: "portal_bog", kind: "portal", x: 7, y: 52, name: "The Bog Barrow",
    dungeon: "bog_barrow", target: { x: 24, y: 66 },
    lines: ["You wade down into the Bog Barrow."],
  },
  { id: "ret_bog", kind: "portal", x: 24, y: 67, name: "Barrow Exit", target: { x: 8, y: 52 }, lines: ["You haul yourself back out of the mire."] },
  { id: "boss_bog", kind: "monster", monster: "bog_warden", x: 24, y: 63, name: "The Bog Warden" },
  { id: "bog_add1", kind: "monster", monster: "heartmoor_hound", x: 21, y: 65, name: "Barrow Hound" },
  { id: "bog_add2", kind: "monster", monster: "bog_knight", x: 27, y: 65, name: "Sunken Knight" },

  // --- The Spine Vault (The Spine · combat 55) — arena at x=34 ---
  {
    id: "portal_spine", kind: "portal", x: 42, y: 28, name: "The Spine Vault",
    dungeon: "spine_vault", target: { x: 40, y: 66 },
    lines: ["You break the seal on the Spine Vault."],
  },
  { id: "ret_spine", kind: "portal", x: 40, y: 67, name: "Vault Exit", target: { x: 41, y: 28 }, lines: ["You leave the vault to its silence."] },
  { id: "boss_spine", kind: "monster", monster: "spine_warlord", x: 40, y: 63, name: "The Spine Warlord" },
  { id: "spine_add1", kind: "monster", monster: "stone_crawler", x: 37, y: 65, name: "Vault Crawler" },
  { id: "spine_add2", kind: "monster", monster: "mountain_troll", x: 43, y: 65, name: "Guard Troll" },

  // --- The Marrow Vault (The Marrow Deeps · combat 68) — arena at x=50 ---
  {
    id: "portal_marrow", kind: "portal", x: 58, y: 8, name: "The Marrow Vault",
    dungeon: "marrow_vault", target: { x: 56, y: 66 },
    lines: ["The vault door lets you pass."],
  },
  { id: "ret_marrow", kind: "portal", x: 56, y: 67, name: "Vault Exit", target: { x: 57, y: 8 }, lines: ["The door closes behind you."] },
  { id: "boss_marrow", kind: "monster", monster: "marrow_keeper", x: 56, y: 63, name: "The Marrow Keeper" },
  { id: "marrow_add1", kind: "monster", monster: "cave_crawler", x: 53, y: 65, name: "Deep Crawler" },
  { id: "marrow_add2", kind: "monster", monster: "marrow_wraith", x: 59, y: 65, name: "Vault Wraith" },
];

/** Where the player first appears (a path tile, next to Aldric). */
export const playerSpawn = { x: 13, y: 9 };
