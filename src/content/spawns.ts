/**
 * src/content/spawns.ts
 * ---------------------
 * Where every interactive object sits in the world. Pure DATA.
 *
 * Ironvale stands at the CENTRE of the map: a walled city with a civic yard to
 * the west (bank, forge, stations) and a market street to the east (shop stalls
 * with their keepers beside them). The home Knuckle Hills wrap the city — a
 * grove, a rock outcrop, a lake and Aldric's farmstead. The six wilderness
 * regions ring the city and keep the exact internal layout they always had;
 * their coordinates here were translated as whole blocks to their new homes
 * (see REGION_OFFSET in map.ts), so every node sits on the same terrain as before.
 */

import type { WorldObjectDef } from "../core/types.ts";
import { CITY_SPAWN } from "./map.ts";

export const objects: WorldObjectDef[] = [
  // === IRONVALE — the central city =========================================

  // --- Civic yard (north-west): the forge stations, the bank, the crafting
  //     stations — an open yard ringed by the Ashforge, the Vault and the
  //     Pale Record buildings. ---
  { id: "furnace_1", kind: "furnace", x: 49, y: 43, name: "Furnace" },
  { id: "anvil_1", kind: "anvil", x: 50, y: 43, name: "Anvil" },
  { id: "bank_1", kind: "bank", x: 54, y: 43, name: "Bank Chest" },
  { id: "fire_1", kind: "fire", x: 56, y: 43, name: "Cooking Fire" },
  { id: "cauldron_1", kind: "cauldron", x: 53, y: 48, name: "Herbalist's Cauldron" },
  { id: "workbench_1", kind: "workbench", x: 55, y: 48, name: "Builder's Workbench" },
  { id: "crafting_1", kind: "crafting_table", x: 57, y: 48, name: "Artisan's Table" },

  // --- Civic NPCs (the forge & archive folk) ---
  {
    id: "vorn", kind: "npc", x: 51, y: 43, name: "Vorn",
    lines: [
      "Hot work, smith. Mind the slag and we'll get along.",
      "The Ashforge Brotherhood doesn't recruit. We warn a man what the hammer costs, and then we wait to see if he picks it up anyway.",
      "Teach yourself on cold ash and guesswork long enough and the metal starts telling you things. Stay, and I'll tell you the rest.",
    ],
  },
  {
    id: "sera", kind: "npc", x: 49, y: 48, name: "Sera",
    lines: [
      "Careful with the dust — half of it is older than the kingdom.",
      "The Pale Record keeps what the world would rather forget. The Underloft. The warm stone they buried their dead with. The coins that keep surfacing.",
      "Bring me a thing with a question on it and I'll give it a home instead of a shelf over a hearth.",
    ],
  },
  {
    id: "berric", kind: "npc", x: 51, y: 48, name: "Berric",
    lines: [
      "New blood. Vorn's project, are you. He does like to collect strays.",
      "Stone's stone, friend. A seam doesn't care who surveys it or who buys the map after. Only a fool leaves money in the ground out of sentiment.",
      "We should talk properly some time. Quietly.",
    ],
  },

  // --- Aldric, by the central crossroads (the opening quest-giver) ---
  {
    id: "aldric", kind: "npc", x: 56, y: 54, name: "Aldric",
    lines: [
      "You've an honest look about you. Good — there's a thing that's been gnawing at me.",
      "Found this old coin in the dirt by my wall. Old Varath mintage, struck before my grandfather's grandfather drew breath. Worn smooth — and no coin I've ever known.",
      "Here's the strange of it: the moor rats keep turning the things up in their nests. A dead king's money, in a rat's hole. Why?",
      "Humour an old man. Put one of those rats down and see what it carries. Hold a thing to study it first — then strike.",
      "Ash and knuckle, that's all these hills are. But every road in Varath starts on one like it. The wood lies west; the Spine, north.",
    ],
  },

  // --- Market square (north-east): the shopkeepers stand at their stalls in
  //     front of the Store and the Armoury, the rest of the square full of carts. ---
  {
    id: "shop_quartermaster", kind: "npc", x: 64, y: 42, name: "Hespa, Quartermaster",
    lines: [
      "Ironvale's market, friend. Cramped, loud, and the only honest counter for three days' walk.",
      "Tools, packs, rations, seeds — it's all on the stall. Sell me your odds and ends, too.",
    ],
  },
  { id: "cart_hespa", kind: "cart", x: 63, y: 42, name: "Quartermaster's Stall", lines: ["Hespa's stall — tools and sundries stacked to the awning."] },
  {
    id: "shop_armourer", kind: "npc", x: 70, y: 42, name: "Doran, Armourer",
    lines: [
      "You stand like someone who's been hit before. Good — means you'll buy mail and mean it.",
      "Shields, helms, plate — Ashforge seconds, tiers I through III. The heavy stuff you forge yourself.",
    ],
  },
  { id: "cart_doran", kind: "cart", x: 71, y: 42, name: "Armourer's Stall", lines: ["A rack of field steel and dented Ashforge seconds."] },
  { id: "cart_produce", kind: "cart", x: 64, y: 47, name: "Produce Cart", lines: ["Moor greens and river fish, laid out on straw."] },
  { id: "cart_cloth", kind: "cart", x: 70, y: 47, name: "Cloth Stall", lines: ["Bolts of undyed wool and a few faded bright ones."] },
  { id: "cart_spice", kind: "cart", x: 67, y: 45, name: "Spice Cart", lines: ["Dried herbs and ground roots in little horn scoops."] },
  // --- Skritt keeps his exchange on the south-east trade row ---
  {
    id: "shop_trader", kind: "npc", x: 64, y: 63, name: "Skritt",
    lines: [
      "Pssst. Goblin prices, friend — better than honest, worse than fair.",
      "Skritt buys what others won't, sells what others can't. The warm stone especially. Skritt is always interested in the warm stone.",
    ],
  },
  { id: "cart_skritt", kind: "cart", x: 63, y: 63, name: "Skritt's Cart", lines: ["A goblin's cart, piled with things best not examined too closely."] },

  // --- The bounty board, on the market square ---
  { id: "bounty_board_1", kind: "bounty_board", x: 66, y: 49, name: "Bounty Board" },

  // === THE KNUCKLE HILLS — the home hills wrapping the city =================

  // --- Ashwood trees on the dirt grove, north of the city (Forestry) ---
  { id: "tree_1", kind: "tree", x: 54, y: 28, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_2", kind: "tree", x: 60, y: 26, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_3", kind: "tree", x: 66, y: 29, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },

  // --- Knucklestone rocks on the outcrop, north-east (Mining) ---
  { id: "rock_1", kind: "rock", x: 84, y: 32, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_2", kind: "rock", x: 87, y: 30, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_3", kind: "rock", x: 90, y: 34, name: "Knucklestone Rock", resource: "mine_knucklestone" },

  // --- Fishing on the lake, south-west of the city ---
  { id: "fish_1", kind: "fishing_spot", x: 37, y: 72, name: "Fishing Spot", resource: "fish_ashfin" },
  { id: "fish_2", kind: "fishing_spot", x: 37, y: 76, name: "Fishing Spot", resource: "fish_ashfin" },

  // --- Aldric's farmstead (plant + tree patches) on the east apron ---
  { id: "patch_1", kind: "plant_patch", x: 81, y: 42, name: "Plant Patch" },
  { id: "patch_2", kind: "plant_patch", x: 83, y: 42, name: "Plant Patch" },
  { id: "patch_3", kind: "plant_patch", x: 85, y: 42, name: "Plant Patch" },
  { id: "patch_4", kind: "plant_patch", x: 81, y: 44, name: "Plant Patch" },
  { id: "patch_5", kind: "plant_patch", x: 83, y: 44, name: "Plant Patch" },
  { id: "patch_6", kind: "plant_patch", x: 85, y: 44, name: "Plant Patch" },
  { id: "treepatch_1", kind: "tree_patch", x: 82, y: 47, name: "Tree Patch" },
  { id: "treepatch_2", kind: "tree_patch", x: 85, y: 47, name: "Tree Patch" },

  // --- Starter game on the hill grass, and hare snares (Hunter 1) ---
  { id: "rat_1", kind: "monster", monster: "moor_rat", x: 44, y: 30, name: "Moor Rat" },
  { id: "rat_2", kind: "monster", monster: "moor_rat", x: 47, y: 32, name: "Moor Rat" },
  { id: "wolf_1", kind: "monster", monster: "hill_wolf", x: 76, y: 33, name: "Hill Wolf" },
  { id: "trap_hare_1", kind: "trap", x: 52, y: 31, name: "Snare", resource: "hunt_hare" },
  { id: "trap_hare_2", kind: "trap", x: 74, y: 32, name: "Snare", resource: "hunt_hare" },

  // --- The Hollow Barrows portal, up in the grove (arena at x=2) ---
  {
    id: "portal_hollow", kind: "portal", x: 70, y: 28, name: "The Hollow Barrows",
    dungeon: "hollow_barrows", target: { x: 8, y: 118 },
    lines: ["You descend into the Hollow Barrows."],
  },
  { id: "ret_hollow", kind: "portal", x: 8, y: 119, name: "Barrow Exit", target: { x: 70, y: 29 }, lines: ["You climb back into the daylight."] },
  { id: "boss_hollow", kind: "monster", monster: "hollow_warden", x: 8, y: 115, name: "The Hollow Warden" },
  { id: "hollow_add1", kind: "monster", monster: "wild_boar", x: 5, y: 117, name: "Barrow Boar" },
  { id: "hollow_add2", kind: "monster", monster: "forest_bear", x: 11, y: 117, name: "Barrow Bear" },

  // === GREYOAK WOOD (west) ==================================================
  { id: "gw_pine_1", kind: "tree", x: 11, y: 47, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_2", kind: "tree", x: 14, y: 49, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_3", kind: "tree", x: 26, y: 47, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_4", kind: "tree", x: 28, y: 49, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_5", kind: "tree", x: 12, y: 50, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_oak_1", kind: "tree", x: 10, y: 57, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_2", kind: "tree", x: 14, y: 59, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_3", kind: "tree", x: 27, y: 58, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_4", kind: "tree", x: 29, y: 56, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_5", kind: "tree", x: 24, y: 60, name: "Greyoak (Old Growth)", resource: "fell_greyoak", species: "greyoak" },
  { id: "maret", kind: "npc", x: 22, y: 53, name: "Maret", lines: ["Stranger on the Lodge road. You'll forgive the look — the wood teaches you to measure people.","This is Greyoak. Old before Ironvale was a name. The boar keep to the understory; give the deep wood its distance and it gives you yours.","Every season the old growth pulls back a little further. We mark the new treeline against the last. We do not ask what walks in the cleared ground.","Bring an axe worth the name and the greyoak will pay you in timber. Bring less and it will only blunt you."] },
  { id: "lenne", kind: "npc", x: 20, y: 52, name: "Lenne", lines: ["Quiet, now. You'll learn more standing still in this wood than talking in it.","I track for the Lodge. Maret keeps the fire; I keep the treeline. We both watch the same thing pulling back.","If the old growth ever decides you're worth its notice, you'll feel it before you see it. Don't run."] },
  { id: "gw_boar_1", kind: "monster", monster: "wild_boar", x: 15, y: 49, name: "Wild Boar" },
  { id: "gw_boar_2", kind: "monster", monster: "wild_boar", x: 24, y: 50, name: "Wild Boar" },
  { id: "gw_boar_3", kind: "monster", monster: "wild_boar", x: 17, y: 56, name: "Wild Boar" },
  { id: "gw_bear_1", kind: "monster", monster: "forest_bear", x: 11, y: 58, name: "Forest Bear" },
  { id: "gw_bear_2", kind: "monster", monster: "forest_bear", x: 28, y: 60, name: "Forest Bear" },
  { id: "gw_greymane", kind: "monster", monster: "greymane_boar", x: 21, y: 60, name: "Greymane Boar" },
  { id: "trap_boar_1", kind: "trap", x: 17, y: 48, name: "Boar Snare", resource: "hunt_boar" },
  { id: "trap_boar_2", kind: "trap", x: 26, y: 51, name: "Boar Snare", resource: "hunt_boar" },
  { id: "trap_wolf_1", kind: "trap", x: 19, y: 57, name: "Wolf Snare", resource: "hunt_wolf" },
  { id: "trap_bear_1", kind: "trap", x: 13, y: 59, name: "Bear Snare", resource: "hunt_bear" },
  { id: "trap_bear_2", kind: "trap", x: 26, y: 58, name: "Bear Snare", resource: "hunt_bear" },

  // === THE SPINE (north) ====================================================
  { id: "serath", kind: "npc", x: 42, y: 8, name: "Serath", lines: ["Far enough, for now. This is the Spine — Orun's backbone, the faithful say. Whatever it is, it does not forgive carelessness.","Ridge wolves on the low passes. Higher, the stone crawlers and the trolls. And the wraiths, where the wind never stops. Go up only as far as you can come down.","The Cut yields good metal — ashiron, and ribstone deeper. Bring a pick that can take the cold.","Two things you'll find and not understand: the Wind-Shrine, worn to the shape of a vertebra, and the Vault, shut from the inside. Measure them if you must. Don't pretend to read them."] },
  { id: "sp_rock_1", kind: "rock", x: 42, y: 13, name: "Ashiron Seam", resource: "mine_ashiron" },
  { id: "sp_rock_2", kind: "rock", x: 45, y: 17, name: "Ashiron Seam", resource: "mine_ashiron" },
  { id: "sp_rock_3", kind: "rock", x: 52, y: 24, name: "Ribstone Seam", resource: "mine_ribstone" },
  { id: "sp_rock_4", kind: "rock", x: 56, y: 31, name: "Ribstone Seam", resource: "mine_ribstone" },
  { id: "sp_wolf_1", kind: "monster", monster: "ridge_wolf", x: 46, y: 9, name: "Ridge Wolf" },
  { id: "sp_wolf_2", kind: "monster", monster: "ridge_wolf", x: 47, y: 14, name: "Ridge Wolf" },
  { id: "sp_crawler_1", kind: "monster", monster: "stone_crawler", x: 45, y: 20, name: "Stone Crawler" },
  { id: "sp_crawler_2", kind: "monster", monster: "stone_crawler", x: 54, y: 18, name: "Stone Crawler" },
  { id: "sp_troll_1", kind: "monster", monster: "mountain_troll", x: 55, y: 27, name: "Mountain Troll" },
  { id: "sp_wraith_1", kind: "monster", monster: "spine_wraith", x: 56, y: 22, name: "Spine Wraith" },
  { id: "sp_wraith_2", kind: "monster", monster: "spine_wraith", x: 52, y: 35, name: "Spine Wraith" },
  { id: "spine_wind_shrine", kind: "shrine", x: 54, y: 7, name: "The Wind-Shrine", lines: ["A standing stone the wind has worn to the shape of a vertebra. Orun's, the believers say. A rock worn by weather, say the rest. The shrine settles nothing."] },
  { id: "spine_vault", kind: "shrine", x: 54, y: 32, name: "The Spine Vault", lines: ["A door of dressed stone set into the mountain — shut, and shut from the inside. The ward-stones around it have not been moved in a very long time."] },
  { id: "portal_spine", kind: "portal", x: 52, y: 30, name: "The Spine Vault", dungeon: "spine_vault", target: { x: 40, y: 118 }, lines: ["You break the seal on the Spine Vault."] },

  // === HEARTMOOR (south-west) ===============================================
  { id: "calder", kind: "npc", x: 17, y: 82, name: "Calder", lines: ["Cold road, isn't it. Sit a moment — there's always a fire going at the moor's edge, and food for whoever the road gives out on.","We're the Heartmoor faithful. No, don't make the face. We feed people. What you do with the rest of it is your business.","The peat keeps things. Bog-bodies, old swords, older questions. And the warm seams — Hearthite, black and almost living. Rock, the miners say. We say otherwise. Both are true of the same stone.","Go careful past the pools. The bog knights don't sleep, and the serpents are patient."] },
  { id: "hm_lurker_1", kind: "monster", monster: "marsh_lurker", x: 16, y: 87, name: "Marsh Lurker" },
  { id: "hm_lurker_2", kind: "monster", monster: "marsh_lurker", x: 28, y: 90, name: "Marsh Lurker" },
  { id: "hm_hound_1", kind: "monster", monster: "heartmoor_hound", x: 14, y: 94, name: "Heartmoor Hound" },
  { id: "hm_hound_2", kind: "monster", monster: "heartmoor_hound", x: 30, y: 96, name: "Heartmoor Hound" },
  { id: "hm_serpent_1", kind: "monster", monster: "mire_serpent", x: 25, y: 85, name: "Mire Serpent" },
  { id: "hm_knight_1", kind: "monster", monster: "bog_knight", x: 20, y: 99, name: "Bog Knight" },
  { id: "heartmoor_barrow", kind: "shrine", x: 13, y: 99, name: "The Bog Barrow", lines: ["A grave the moor grew up around — older than the bog, they say, built before the land here settled. Whatever waits inside has waited a very long time."] },
  { id: "trap_stag_1", kind: "trap", x: 18, y: 91, name: "Stag Snare", resource: "hunt_stag" },
  { id: "trap_stag_2", kind: "trap", x: 27, y: 93, name: "Stag Snare", resource: "hunt_stag" },
  { id: "trap_aurochs_1", kind: "trap", x: 22, y: 96, name: "Aurochs Snare", resource: "hunt_aurochs" },
  { id: "portal_bog", kind: "portal", x: 15, y: 98, name: "The Bog Barrow", dungeon: "bog_barrow", target: { x: 24, y: 118 }, lines: ["You wade down into the Bog Barrow."] },

  // === THE ASHFEN FLATS (south) =============================================
  { id: "ashfen_tender", kind: "npc", x: 60, y: 86, name: "Cult Tender", lines: ["You feel it through your boots — the ground's warm here, warmer the deeper you cut. The miners work short shifts. We don't mind the heat.","Embercite comes out of this rock. The smiths swear by it for flux. We keep the seam clean and leave what we owe.","I won't ask you to help. Only to witness. The discomfort is the point."] },
  { id: "af_rock_1", kind: "rock", x: 54, y: 88, name: "Embercite Working", resource: "mine_embercite" },
  { id: "af_rock_2", kind: "rock", x: 62, y: 94, name: "Embercite Working", resource: "mine_embercite" },
  { id: "af_rock_3", kind: "rock", x: 58, y: 100, name: "Embercite Working", resource: "mine_embercite" },

  // === THE MARROW DEEPS (north-east) ========================================
  { id: "md_crawler_1", kind: "monster", monster: "cave_crawler", x: 85, y: 12, name: "Cave Crawler" },
  { id: "md_crawler_2", kind: "monster", monster: "cave_crawler", x: 91, y: 17, name: "Cave Crawler" },
  { id: "md_bat_1", kind: "monster", monster: "deep_bat", x: 89, y: 10, name: "Deep Bat" },
  { id: "md_bat_2", kind: "monster", monster: "deep_bat", x: 93, y: 23, name: "Deep Bat" },
  { id: "md_wraith_1", kind: "monster", monster: "marrow_wraith", x: 84, y: 27, name: "Marrow Wraith" },
  { id: "md_golem_1", kind: "monster", monster: "deep_golem", x: 93, y: 29, name: "Deepstone Golem" },
  { id: "md_rock_1", kind: "rock", x: 88, y: 22, name: "Voidstone Shaft", resource: "mine_voidstone" },
  { id: "md_rock_2", kind: "rock", x: 92, y: 28, name: "Voidstone Shaft", resource: "mine_voidstone" },
  { id: "marrow_vault", kind: "shrine", x: 95, y: 14, name: "The Marrow Vault", lines: ["Walls too smooth to be the dark's work, and a door that was opened from the inside. Whatever stayed down here, stayed because it chose to."] },
  { id: "marrow_keeper", kind: "npc", x: 94, y: 15, name: "The Marrow Keeper", lines: ["You came down the long dark and the door let you. Few things it lets through.","I kept the watch when there was an order to keep it for. Now there is only the watch, and the stone, and the warmth that will not cool.","Ask what you came to ask. But know that I have stood here longer than your kingdom, and even I cannot tell you whether the warmth is a god."] },
  { id: "portal_marrow", kind: "portal", x: 92, y: 14, name: "The Marrow Vault", dungeon: "marrow_vault", target: { x: 56, y: 118 }, lines: ["The vault door lets you pass."] },

  // === THE REDRUN & THE EYELESS SEA (east) =================================
  { id: "rd_rock_1", kind: "rock", x: 92, y: 64, name: "Bloodore Vein", resource: "mine_bloodore" },
  { id: "rd_rock_2", kind: "rock", x: 93, y: 72, name: "Bloodore Vein", resource: "mine_bloodore" },
  { id: "rd_fish_greyfin", kind: "fishing_spot", x: 96, y: 66, name: "Greyfin Pool", resource: "fish_greyfin" },
  { id: "rd_fish_1", kind: "fishing_spot", x: 96, y: 65, name: "Ribvault Shallows", resource: "fish_ribperch" },
  { id: "rd_fish_2", kind: "fishing_spot", x: 100, y: 73, name: "The Estuary", resource: "fish_redgill" },
  { id: "rd_fish_3", kind: "fishing_spot", x: 101, y: 80, name: "The Eyeless Sea", resource: "fish_deepscale" },
  { id: "rd_fish_4", kind: "fishing_spot", x: 103, y: 83, name: "The Eyeless Deep", resource: "fish_eyeless_pike" },
  { id: "rd_brigand_1", kind: "monster", monster: "redrun_brigand", x: 92, y: 68, name: "Redrun Brigand" },
  { id: "rd_serpent_1", kind: "monster", monster: "river_serpent", x: 93, y: 76, name: "River Serpent" },
  { id: "rd_orc_1", kind: "monster", monster: "ancient_orc", x: 93, y: 80, name: "Ancient Orc" },
  { id: "rd_ferryman", kind: "monster", monster: "dread_ferryman", x: 93, y: 77, name: "The Dread Ferryman" },

  // === NAMED LANDMARKS — the gazetteer (discovery layer) ====================
  // Drawn from the World Bible §X. Examine-only places that give each area
  // depth and reward exploring; a few carry small extra nodes.

  // --- The open Knuckle Hills (north-west country) ---
  {
    id: "rook", kind: "npc", x: 11, y: 9, name: "Rook, the Fieldwarden",
    lines: [
      "Cold firepit, warm welcome. Rook — I keep the watch over these hills, such as it is.",
      "I post the early bounties down at the Ironvale board. Small game, common prey. Everyone starts on a hill like this.",
      "There's a wolf out here that doesn't move like a wolf. Old, lame, clever. The truth of it is plainer and harder than the rumour. Most things up here are.",
    ],
  },
  { id: "lm_knuckle", kind: "shrine", x: 22, y: 12, name: "The Knuckle", lines: ["The bald stone fist the hills are named for. Old scratch-marks are worked into the rock — a mason's tally, or something older. Sera would copy them and still not pretend to know."] },
  { id: "rock_knuckle", kind: "rock", x: 20, y: 14, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "lm_coldvein", kind: "shrine", x: 8, y: 33, name: "The Coldvein Scar", lines: ["A surface cutting worked dry two generations back. A retired miner still walks up for one last look before his knees give out — not after ore, he says. Just the look."] },
  { id: "lm_redrun_head", kind: "shrine", x: 27, y: 32, name: "The Redrun Head", lines: ["Where a dozen hill-streams braid into the head of the Redrun. The whole long river starts as this — thin water over pale stone."] },
  { id: "fish_tarn", kind: "fishing_spot", x: 33, y: 30, name: "The Head-Stream Pool", resource: "fish_ashfin" },
  { id: "tree_hill_1", kind: "tree", x: 16, y: 20, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_hill_2", kind: "tree", x: 20, y: 22, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },

  // --- Ironvale's districts (the city's named institutions) ---
  { id: "lm_watchtower", kind: "shrine", x: 74, y: 43, name: "The Watchtower", lines: ["A timber frame going up against the inside of the wall. Nobody finishes the sentence about what it's for. Ironvale is beginning to think defensively — against what, no one writes down."] },
  { id: "lm_mending", kind: "shrine", x: 54, y: 63, name: "The Mending House", lines: ["Where Ironvale brings what the world breaks. The cots are seldom all empty, and seldom all full."] },
  { id: "lm_wayfarers", kind: "shrine", x: 70, y: 63, name: "The Wayfarers' Lodge", lines: ["Where civilians are kitted and sent out into the world, and usually return. A board by the door lists expeditions overdue. Usually it is short."] },

  // --- Greyoak Wood ---
  { id: "lm_oldgrowth", kind: "shrine", x: 12, y: 63, name: "The Old Growth Edge", lines: ["Last year's boundary stakes stand a full pace inside this year's living wood. You can mark the retreat. You do not learn what walks in the cleared ground."] },
  { id: "lm_mill", kind: "shrine", x: 28, y: 55, name: "The Grey Oak Mill", lines: ["The saws that feed Ironvale's beams, running dawn to dusk. The best blade keeps dulling too fast; the foreman has a suspect, and he's half wrong."] },
  {
    id: "charburner", kind: "npc", x: 5, y: 67, name: "The Charburner",
    lines: [
      "Mind the mound — turf-capped, slow-burning, and it'll take a boot off if you're careless.",
      "I trade fuel for news and news for company. Sit a while. The wood's quieter than it was, and I like to know who's still walking the Lodge road.",
    ],
  },
  { id: "fire_charburner", kind: "fire", x: 7, y: 68, name: "Charburner's Fire" },

  // --- The Spine ---
  { id: "lm_serath_post", kind: "shrine", x: 44, y: 6, name: "Serath's Post", lines: ["A stone bothy on the high pass, banked against the wind. Serath's relief is always days overdue; the road closes when the weather decides it should."] },
  { id: "lm_cold_streams", kind: "shrine", x: 49, y: 12, name: "The Cold Streams", lines: ["Meltwater off the high snow, running fast and clear and cold enough to ache. Something long and pale moves in the deeper channels. The old hands call it an eel and leave it at that."] },
  { id: "lm_spinite_cut", kind: "shrine", x: 51, y: 23, name: "The Spinite Cut", lines: ["Where the Spine's own metal comes out of the rock. A cutter's been pulling stone that fractures wrong — the flaw is in the seam, and he knew it before you did."] },

  // --- Heartmoor ---
  { id: "lm_false_seam", kind: "shrine", x: 12, y: 84, name: "The False Seam", lines: ["A cut that gives off the warmth but yields no stone. Dying, or never real — settle it if you can. Best leave the theology where it lies."] },
  { id: "lm_nightshade", kind: "shrine", x: 26, y: 86, name: "Nightshade Hollow", lines: ["A low, still dell where the dangerous green things grow best. There is one hour the plants are worth taking, and the herbalists guard it jealously."] },
  { id: "lm_peat", kind: "shrine", x: 20, y: 93, name: "The Peat Cuttings", lines: ["Black trenches squared off across the moor. A cutter's spade turned up something the bog kept whole. Name it before they decide to sell it."] },
  { id: "lm_mire_crossing", kind: "shrine", x: 31, y: 88, name: "The Mire Crossing", lines: ["Where solid ground is a rumour. The water moved last season; the safe line of stakes goes under if you lose your way reading it."] },

  // --- The Marrow Deeps ---
  { id: "lm_smooth_walls", kind: "shrine", x: 90, y: 19, name: "The Smooth Walls", lines: ["Tool-dressed stone, older than any living hand. The masons' marks here might match the spine-shape on the Worn Coins. Suggestive. It proves nothing."] },
  { id: "lm_golem_gallery", kind: "shrine", x: 95, y: 30, name: "The Golem Gallery", lines: ["Stone figures still carrying out a forgotten order. One has stopped where the others move. Observe it and report why — without giving it a reason to mind you."] },
  { id: "lm_black_water", kind: "shrine", x: 86, y: 24, name: "The Black Water", lines: ["A still pool that swallows torchlight whole. Something pale lives in it — a blind cave-fish, by any plain account. One miner won't go near the water anymore."] },
  { id: "lm_fringe", kind: "shrine", x: 84, y: 10, name: "The Fringe Diggings", lines: ["The last lit edge before the dark goes total. Skritt's deep miner works it, and never asks what he's selling — nor who's buying."] },

  // --- The Redrun & the sea ---
  { id: "lm_ferry_stones", kind: "shrine", x: 95, y: 70, name: "The Ferry Stones", lines: ["Dressed Underloft stones that surface mid-channel at low water. Record them before the river rises — another mark for Sera's slow map of the dead."] },
  { id: "lm_brigand_camp", kind: "shrine", x: 90, y: 66, name: "The Brigand Camp", lines: ["A mean fire kept by people the road failed. One of them wants out, and offers what he knows for safe passage. Trust him or don't, and live with it."] },
  { id: "lm_river_mouth", kind: "shrine", x: 102, y: 82, name: "The River Mouth", lines: ["The last fresh water before the open grey. An old deep-water fisher is the only soul who's seen the Eyeless Pike and rowed home. Earn the telling; it gates nothing."] },
  { id: "lm_orcs_ground", kind: "shrine", x: 93, y: 78, name: "The Orc's Ground", lines: ["Kept ground, tended by an old Orc. Bring the correct offering, done completely, and he speaks once. Get it wrong and he simply doesn't."] },

  // --- The Ashfen Flats ---
  { id: "lm_short_shift", kind: "shrine", x: 56, y: 90, name: "The Short-Shift Diggings", lines: ["Cuttings worked in bursts, because no one can stand the heat for long. A miner won't come up at the end of his shift — geology, or zeal. Left open."] },
  { id: "lm_tended_seam", kind: "shrine", x: 66, y: 96, name: "The Tended Seam", lines: ["A warm patch kept clean of debris by hands that leave offerings, not tools. A Cult tender asks you to witness, not help. The discomfort is the point."] },

  // === BOSS ARENAS (sealed band below the overworld) ========================
  { id: "ret_bog", kind: "portal", x: 24, y: 119, name: "Barrow Exit", target: { x: 16, y: 98 }, lines: ["You haul yourself back out of the mire."] },
  { id: "boss_bog", kind: "monster", monster: "bog_warden", x: 24, y: 115, name: "The Bog Warden" },
  { id: "bog_add1", kind: "monster", monster: "heartmoor_hound", x: 21, y: 117, name: "Barrow Hound" },
  { id: "bog_add2", kind: "monster", monster: "bog_knight", x: 27, y: 117, name: "Sunken Knight" },
  { id: "ret_spine", kind: "portal", x: 40, y: 119, name: "Vault Exit", target: { x: 51, y: 30 }, lines: ["You leave the vault to its silence."] },
  { id: "boss_spine", kind: "monster", monster: "spine_warlord", x: 40, y: 115, name: "The Spine Warlord" },
  { id: "spine_add1", kind: "monster", monster: "stone_crawler", x: 37, y: 117, name: "Vault Crawler" },
  { id: "spine_add2", kind: "monster", monster: "mountain_troll", x: 43, y: 117, name: "Guard Troll" },
  { id: "ret_marrow", kind: "portal", x: 56, y: 119, name: "Vault Exit", target: { x: 91, y: 14 }, lines: ["The door closes behind you."] },
  { id: "boss_marrow", kind: "monster", monster: "marrow_keeper", x: 56, y: 115, name: "The Marrow Keeper" },
  { id: "marrow_add1", kind: "monster", monster: "cave_crawler", x: 53, y: 117, name: "Deep Crawler" },
  { id: "marrow_add2", kind: "monster", monster: "marrow_wraith", x: 59, y: 117, name: "Vault Wraith" },
];

/** Where the player first appears — the civic yard at the heart of Ironvale. */
export const playerSpawn = CITY_SPAWN;
