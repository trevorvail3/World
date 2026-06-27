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

  // --- Aldric, out in the Knuckle Hills where you begin (opening quest-giver) ---
  {
    id: "aldric", kind: "npc", x: 23, y: 16, name: "Aldric",
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

  // --- The town square: a fountain at the crossroads ---
  { id: "fountain_1", kind: "fountain", x: 60, y: 52, name: "The Ironvale Fountain", lines: ["Bright water over green-stained stone. Children dare each other to drink from it; nobody knows where the spring beneath it rises."] },

  // --- The Carpenter's sawmill, in the artisans' yard (Woodcraft) ---
  { id: "sawmill_1", kind: "sawmill", x: 49, y: 57, name: "Carpenter's Sawmill" },

  // --- Townsfolk going about the day (they wander the streets and squares) ---
  {
    id: "town_fishwife", kind: "npc", x: 66, y: 55, name: "A Fishwife",
    lines: [
      "Greyfin, fresh off the Redrun! Well — fresh enough. You'll not get better this side of the estuary.",
      "My man rows the river. Says the water's been running redder than it ought. I tell him it's the season. He doesn't argue, but he doesn't smile either.",
    ],
  },
  {
    id: "town_guard", kind: "npc", x: 62, y: 47, name: "An Off-Duty Guard",
    lines: [
      "Long as the gates hold and the lamps are lit, Ironvale sleeps easy. Mostly.",
      "They've got me on the new watchtower come spring. Watching for what, nobody'll say. That's the part that keeps me up.",
    ],
  },
  {
    id: "town_child", kind: "npc", x: 58, y: 53, name: "A Child",
    lines: [
      "Bet you can't toss a coin in the fountain and have it land flat. Nobody can. I've seen a hundred try.",
      "My gran says the old coins the rats dig up are unlucky. I keep one anyway. It's warm. Feel.",
    ],
  },
  {
    id: "town_pilgrim", kind: "npc", x: 51, y: 56, name: "A Pilgrim",
    lines: [
      "I walked from the Heartmoor to stand a day in a city that still has walls. It's a comfort, walls.",
      "They say the Spine is Orun's own back. I came to see it. I'll go home and say I saw a mountain. Both are true, I think.",
    ],
  },
  {
    id: "town_drunk", kind: "npc", x: 73, y: 56, name: "A Cheerful Drunk",
    lines: [
      "Friend! Friend. You've an honest face and a full purse, I can tell these things.",
      "I'll tell you a secret for a coin. No? Then I'll tell you for free: the moon watches, and she does not blink. Sleep on that.",
    ],
  },
  {
    id: "town_courier", kind: "npc", x: 65, y: 45, name: "An Ironvale Courier",
    lines: [
      "Riders out at dawn, riders in at dusk. The Courier never stops; the roads don't let us.",
      "Greyoak, the Spine, the Heartmoor — I've carried word to all of them. Everything in Varath runs through this market eventually.",
    ],
  },

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
  // A hill kiln by the starting clearing, so the opening quest (mine -> smelt ->
  // bring Aldric a bar) can be done right where you begin.
  { id: "furnace_hill", kind: "furnace", x: 21, y: 17, name: "Hill Kiln" },
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
  { id: "sawmill_mill", kind: "sawmill", x: 26, y: 55, name: "The Grey Oak Mill Bench" },
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

  // === STREET DRESSING & THE COURIER WAYSTONES ==============================
  // Lamps (lit at night), fingerpost signs at the gates, and the Courier's
  // waystone network — pay a toll to ride between them (a gold sink + fast travel).

  // --- Ironvale street lamps (around the square, streets and gates) ---
  { id: "lamp_1", kind: "lamppost", x: 57, y: 49, name: "Street Lamp" },
  { id: "lamp_2", kind: "lamppost", x: 63, y: 49, name: "Street Lamp" },
  { id: "lamp_3", kind: "lamppost", x: 57, y: 55, name: "Street Lamp" },
  { id: "lamp_4", kind: "lamppost", x: 63, y: 55, name: "Street Lamp" },
  { id: "lamp_5", kind: "lamppost", x: 49, y: 52, name: "Street Lamp" },
  { id: "lamp_6", kind: "lamppost", x: 71, y: 52, name: "Street Lamp" },
  { id: "lamp_7", kind: "lamppost", x: 60, y: 41, name: "Gate Lamp" },
  { id: "lamp_8", kind: "lamppost", x: 60, y: 64, name: "Gate Lamp" },

  // --- Fingerpost signs at the city's approaches ---
  { id: "sign_west", kind: "signpost", x: 42, y: 54, name: "Fingerpost", lines: ["◀ GREYOAK WOOD — the Lodge road.   IRONVALE ▶, the gate behind you."] },
  { id: "sign_north", kind: "signpost", x: 57, y: 35, name: "Fingerpost", lines: ["▲ THE SPINE — the high pass, and the Marrow caves beyond.   IRONVALE ▼."] },
  { id: "sign_south", kind: "signpost", x: 62, y: 70, name: "Fingerpost", lines: ["▼ THE ASHFEN FLATS, and the HEARTMOOR away south-west.   IRONVALE ▲."] },
  { id: "sign_east", kind: "signpost", x: 84, y: 52, name: "Fingerpost", lines: ["▶ THE REDRUN and the river road to the sea.   IRONVALE ◀."] },

  // --- The Courier waystones (one in the city, one per region) ---
  { id: "ws_ironvale", kind: "waystone", x: 58, y: 50, name: "Ironvale", target: { x: 57, y: 50 } },
  { id: "ws_greyoak", kind: "waystone", x: 20, y: 53, name: "Greyoak Wood", target: { x: 21, y: 53 } },
  { id: "ws_spine", kind: "waystone", x: 44, y: 8, name: "The Spine", target: { x: 43, y: 7 } },
  { id: "ws_heartmoor", kind: "waystone", x: 19, y: 82, name: "Heartmoor", target: { x: 18, y: 81 } },
  { id: "ws_ashfen", kind: "waystone", x: 62, y: 86, name: "Ashfen Flats", target: { x: 61, y: 87 } },
  { id: "ws_marrow", kind: "waystone", x: 90, y: 16, name: "The Marrow Deeps", target: { x: 89, y: 15 } },
  { id: "ws_redrun", kind: "waystone", x: 90, y: 70, name: "The Redrun", target: { x: 91, y: 71 } },

  // === WILDLIFE — ambient critters (wander, flee, don't block) ==============
  // City strays + birds:
  { id: "cr_cat", kind: "critter", species: "cat", x: 58, y: 60, name: "A Cat" },
  { id: "cr_pigeon1", kind: "critter", species: "crow", x: 61, y: 54, name: "Pigeons" },
  { id: "cr_bfly_city", kind: "critter", species: "butterfly", x: 55, y: 56, name: "A Butterfly" },
  // Knuckle Hills (around the city):
  { id: "cr_hare1", kind: "critter", species: "rabbit", x: 48, y: 30, name: "A Moor Hare" },
  { id: "cr_hare2", kind: "critter", species: "rabbit", x: 72, y: 31, name: "A Moor Hare" },
  { id: "cr_crow1", kind: "critter", species: "crow", x: 63, y: 25, name: "A Crow" },
  { id: "cr_sheep1", kind: "critter", species: "sheep", x: 50, y: 34, name: "A Hill Sheep" },
  { id: "cr_bfly_hill", kind: "critter", species: "butterfly", x: 58, y: 27, name: "Butterflies" },
  // Greyoak Wood:
  { id: "cr_deer1", kind: "critter", species: "deer", x: 16, y: 52, name: "A Roe Deer" },
  { id: "cr_deer2", kind: "critter", species: "deer", x: 24, y: 58, name: "A Roe Deer" },
  { id: "cr_hare3", kind: "critter", species: "rabbit", x: 10, y: 50, name: "A Wood Hare" },
  { id: "cr_crow2", kind: "critter", species: "crow", x: 27, y: 48, name: "A Crow" },
  // The Spine (the walkable pass):
  { id: "cr_crow3", kind: "critter", species: "crow", x: 43, y: 9, name: "A Crag Crow" },
  { id: "cr_sheep2", kind: "critter", species: "sheep", x: 45, y: 13, name: "A Mountain Goat" },
  // Heartmoor:
  { id: "cr_frog1", kind: "critter", species: "frog", x: 18, y: 86, name: "A Marsh Frog" },
  { id: "cr_frog2", kind: "critter", species: "frog", x: 26, y: 91, name: "A Marsh Frog" },
  { id: "cr_duck1", kind: "critter", species: "duck", x: 14, y: 89, name: "A Moor Duck" },
  { id: "cr_heron", kind: "critter", species: "crow", x: 22, y: 88, name: "A Bog Heron" },
  // Ashfen Flats:
  { id: "cr_bfly_ash", kind: "critter", species: "butterfly", x: 56, y: 88, name: "Ash-Moths" },
  { id: "cr_crow4", kind: "critter", species: "crow", x: 61, y: 95, name: "A Crow" },
  // The Redrun banks:
  { id: "cr_duck2", kind: "critter", species: "duck", x: 91, y: 66, name: "A River Duck" },
  { id: "cr_duck3", kind: "critter", species: "duck", x: 92, y: 74, name: "A River Duck" },
  { id: "cr_frog3", kind: "critter", species: "frog", x: 95, y: 78, name: "A River Frog" },
  { id: "cr_crow5", kind: "critter", species: "crow", x: 96, y: 68, name: "A River Crow" },

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

  // --- Audit fix: gathering nodes the action graph assumed but never spawned ---
  // (gold + silica ore, and the high-tier Forestry trees above Greyoak). Tiles
  // chosen by the placement finder: each sits on land with a reachable adjacent
  // walkable tile, validated against buildWalkability + a spawn-reachability BFS.
  { id: "silica_1", kind: "rock", x: 91, y: 63, name: "Silica Sands", resource: "mine_silica" },
  { id: "silica_2", kind: "rock", x: 92, y: 63, name: "Silica Sands", resource: "mine_silica" },
  { id: "silica_3", kind: "rock", x: 93, y: 63, name: "Silica Sands", resource: "mine_silica" },
  { id: "gold_1", kind: "rock", x: 44, y: 16, name: "Gold Vein", resource: "mine_gold" },
  { id: "gold_2", kind: "rock", x: 45, y: 16, name: "Gold Vein", resource: "mine_gold" },
  { id: "gold_3", kind: "rock", x: 46, y: 16, name: "Gold Vein", resource: "mine_gold" },
  { id: "tree_stonewood_1", kind: "tree", x: 10, y: 46, name: "Stonewood", resource: "fell_stonewood", species: "stonewood" },
  { id: "tree_stonewood_2", kind: "tree", x: 11, y: 46, name: "Stonewood", resource: "fell_stonewood", species: "stonewood" },
  { id: "tree_stonewood_3", kind: "tree", x: 12, y: 46, name: "Stonewood", resource: "fell_stonewood", species: "stonewood" },
  { id: "tree_ironbark_1", kind: "tree", x: 28, y: 48, name: "Ironbark", resource: "fell_ironbark", species: "ironbark" },
  { id: "tree_ironbark_2", kind: "tree", x: 29, y: 48, name: "Ironbark", resource: "fell_ironbark", species: "ironbark" },
  { id: "tree_ironbark_3", kind: "tree", x: 27, y: 49, name: "Ironbark", resource: "fell_ironbark", species: "ironbark" },
  { id: "tree_ruewood_1", kind: "tree", x: 9, y: 56, name: "Ruewood", resource: "fell_ruewood", species: "ruewood" },
  { id: "tree_ruewood_2", kind: "tree", x: 10, y: 56, name: "Ruewood", resource: "fell_ruewood", species: "ruewood" },
  { id: "tree_ruewood_3", kind: "tree", x: 11, y: 56, name: "Ruewood", resource: "fell_ruewood", species: "ruewood" },
  { id: "tree_heartoak_1", kind: "tree", x: 29, y: 55, name: "Heartoak", resource: "fell_heartoak", species: "heartoak" },
  { id: "tree_heartoak_2", kind: "tree", x: 30, y: 55, name: "Heartoak", resource: "fell_heartoak", species: "heartoak" },
  { id: "tree_deeproot_1", kind: "tree", x: 23, y: 59, name: "Deeproot", resource: "fell_deeproot", species: "deeproot" },
  { id: "tree_deeproot_2", kind: "tree", x: 24, y: 59, name: "Deeproot", resource: "fell_deeproot", species: "deeproot" },

  // --- Agility courses: two circuits trained by clearing each leg in order ---
  // A beginner yard just outside Ironvale (NE), and a tougher Knuckle Hills
  // scramble (NW, Agility 20+). Tiles + exits validated reachable.
  { id: "course_yard_0", kind: "agility_obstacle", x: 73, y: 31, name: "Ironvale Training Yard: Balance Log", course: "course_yard", order: 0, exit: { x: 74, y: 31 }, xp: 40, levelReq: 1, obstacle: "log" },
  { id: "course_yard_1", kind: "agility_obstacle", x: 75, y: 32, name: "Ironvale Training Yard: Climbing Net", course: "course_yard", order: 1, exit: { x: 75, y: 33 }, xp: 40, levelReq: 1, obstacle: "net" },
  { id: "course_yard_2", kind: "agility_obstacle", x: 75, y: 37, name: "Ironvale Training Yard: Rope Swing", course: "course_yard", order: 2, exit: { x: 74, y: 37 }, xp: 40, levelReq: 1, obstacle: "rope" },
  { id: "course_yard_3", kind: "agility_obstacle", x: 71, y: 37, name: "Ironvale Training Yard: Wall Scramble", course: "course_yard", order: 3, exit: { x: 71, y: 36 }, xp: 40, levelReq: 1, obstacle: "wall" },
  { id: "course_yard_4", kind: "agility_obstacle", x: 70, y: 33, name: "Ironvale Training Yard: Stepping Stones", course: "course_yard", order: 4, exit: { x: 71, y: 33 }, xp: 40, levelReq: 1, obstacle: "stones" },
  { id: "course_scramble_0", kind: "agility_obstacle", x: 18, y: 21, name: "Knuckle Hills Scramble: Balance Log", course: "course_scramble", order: 0, exit: { x: 19, y: 21 }, xp: 100, levelReq: 20, obstacle: "log" },
  { id: "course_scramble_1", kind: "agility_obstacle", x: 21, y: 23, name: "Knuckle Hills Scramble: Climbing Net", course: "course_scramble", order: 1, exit: { x: 21, y: 24 }, xp: 100, levelReq: 20, obstacle: "net" },
  { id: "course_scramble_2", kind: "agility_obstacle", x: 20, y: 27, name: "Knuckle Hills Scramble: Rope Swing", course: "course_scramble", order: 2, exit: { x: 19, y: 27 }, xp: 100, levelReq: 20, obstacle: "rope" },
  { id: "course_scramble_3", kind: "agility_obstacle", x: 16, y: 27, name: "Knuckle Hills Scramble: Wall Scramble", course: "course_scramble", order: 3, exit: { x: 16, y: 26 }, xp: 100, levelReq: 20, obstacle: "wall" },
  { id: "course_scramble_4", kind: "agility_obstacle", x: 15, y: 23, name: "Knuckle Hills Scramble: Stepping Stones", course: "course_scramble", order: 4, exit: { x: 16, y: 23 }, xp: 100, levelReq: 20, obstacle: "stones" },

  // === FOUND LORE — discoverable relics (the Archive / exploration layer) ===
  // Each sits beside a landmark whose mystery it deepens; tiles chosen by the
  // placement finder (free, on land, with a reachable adjacent walkable tile).
  // Reading one the first time records the fragment and pays a finder's reward.
  { id: "relic_knuckle", kind: "relic", x: 21, y: 11, name: "Scratched Stone", loreId: "lore_two_quarrel" },
  { id: "relic_windshrine", kind: "relic", x: 53, y: 6, name: "Worn Verse", loreId: "lore_two_moonwatch" },
  { id: "relic_blackwater", kind: "relic", x: 85, y: 23, name: "Pressed Page", loreId: "lore_two_dreaming" },
  { id: "relic_coldvein", kind: "relic", x: 7, y: 32, name: "Torn Page", loreId: "lore_underloft_rite" },
  { id: "relic_ferry", kind: "relic", x: 94, y: 69, name: "Carved Stone", loreId: "lore_underloft_ferry" },
  { id: "relic_peat", kind: "relic", x: 19, y: 92, name: "Folded Note", loreId: "lore_underloft_bog" },
  { id: "relic_tendedseam", kind: "relic", x: 65, y: 95, name: "Weighted Page", loreId: "lore_orun_catechism" },
  { id: "relic_falseseam", kind: "relic", x: 11, y: 83, name: "Half-Burned Page", loreId: "lore_orun_heresy" },
  { id: "relic_watchtower", kind: "relic", x: 73, y: 42, name: "Nailed Tally", loreId: "lore_varath_muster" },
  { id: "relic_smoothwalls", kind: "relic", x: 90, y: 18, name: "Wall Rubbing", loreId: "lore_varath_masons" },

  // === ROAD OUTLAWS — lawless camps along the roads (named locations) ========
  // New humanoid threat: bandit camps and waylays in the gaps between regions,
  // each a landmark with a cluster of escalating outlaws (footpad -> captain).
  // Tiles chosen by the placement finder (landmarks reachable-adjacent; every
  // outlaw on a reachable walkable tile, no overlaps).
  { id: "lm_gallows_oak", kind: "shrine", x: 28, y: 19, name: "The Gallows Oak", lines: ["A lightning-split oak the Ironvale watch uses for its rough justice. The rope is always there; usually, so is something on it."] },
  { id: "lm_cutpurse_steps", kind: "shrine", x: 60, y: 72, name: "The Cutpurse Steps", lines: ["Worn steps where the south road bottlenecks — and where light fingers work the crowd. Keep a hand on your purse, and an eye on the man who tells you to."] },
  { id: "lm_waylayers_bend", kind: "shrine", x: 38, y: 55, name: "Waylayer's Bend", lines: ["Where the Lodge road kinks blind around a stand of pine. Good cover for an honest forester. Better cover for the men who wait for one."] },
  { id: "lm_poachers_blind", kind: "shrine", x: 32, y: 51, name: "The Poacher's Blind", lines: ["A hunter's hide, well used and not by the Lodge. Snares set for game, and for the warden who comes to cut them."] },
  { id: "lm_toll_stones", kind: "shrine", x: 52, y: 37, name: "The Toll Stones", lines: ["Two standing stones with a chain hung between, and a board that reads TOLL in fresh paint. Nobody collecting it has any right to. Everybody pays."] },
  { id: "lm_burnt_waystation", kind: "shrine", x: 82, y: 55, name: "The Burnt Waystation", lines: ["A Courier post burned to its sills. The riders don't stop here now. Something else does."] },
  { id: "lm_cutthroat_hollow", kind: "shrine", x: 33, y: 79, name: "Cutthroat Hollow", lines: ["A dell the road can't avoid and the watch won't enter. The men who hole up here are past robbery. Go around, if you can find the way."] },
  { id: "lm_drovers_loss", kind: "shrine", x: 58, y: 80, name: "The Drover's Loss", lines: ["Where a whole cattle-drive went missing in a night — beasts, drovers and all. The grass grew back greener over whatever was left."] },
  { id: "lm_smugglers_landing", kind: "shrine", x: 94, y: 72, name: "Smuggler's Landing", lines: ["A shingle beach where boats come in without papers and leave without witnesses. The Redrun keeps their secrets; the men keep their knives."] },
  { id: "lm_brigands_roost", kind: "shrine", x: 34, y: 42, name: "The Brigand's Roost", lines: ["The camp the road-gangs answer to — a ring of stolen canvas and a captain who's never been taken. Bring friends, or bring nothing they can use."] },

  // --- Outlaw spawns (each cluster guards its landmark) ---
  { id: "out_gallows_oak_0", kind: "monster", monster: "footpad", x: 27, y: 18, name: "Footpad" },
  { id: "out_gallows_oak_1", kind: "monster", monster: "footpad", x: 28, y: 18, name: "Footpad" },
  { id: "out_gallows_oak_2", kind: "monster", monster: "cutpurse", x: 29, y: 18, name: "Cutpurse" },
  { id: "out_cutpurse_steps_0", kind: "monster", monster: "cutpurse", x: 59, y: 71, name: "Cutpurse" },
  { id: "out_cutpurse_steps_1", kind: "monster", monster: "cutpurse", x: 60, y: 71, name: "Cutpurse" },
  { id: "out_cutpurse_steps_2", kind: "monster", monster: "footpad", x: 61, y: 71, name: "Footpad" },
  { id: "out_waylayers_bend_0", kind: "monster", monster: "bandit", x: 37, y: 54, name: "Bandit" },
  { id: "out_waylayers_bend_1", kind: "monster", monster: "bandit", x: 38, y: 54, name: "Bandit" },
  { id: "out_waylayers_bend_2", kind: "monster", monster: "footpad", x: 39, y: 54, name: "Footpad" },
  { id: "out_poachers_blind_0", kind: "monster", monster: "poacher", x: 31, y: 50, name: "Poacher" },
  { id: "out_poachers_blind_1", kind: "monster", monster: "poacher", x: 32, y: 50, name: "Poacher" },
  { id: "out_poachers_blind_2", kind: "monster", monster: "bandit", x: 33, y: 50, name: "Bandit" },
  { id: "out_toll_stones_0", kind: "monster", monster: "bandit", x: 51, y: 36, name: "Bandit" },
  { id: "out_toll_stones_1", kind: "monster", monster: "highwayman", x: 52, y: 36, name: "Highwayman" },
  { id: "out_burnt_waystation_0", kind: "monster", monster: "highwayman", x: 81, y: 54, name: "Highwayman" },
  { id: "out_burnt_waystation_1", kind: "monster", monster: "highwayman", x: 82, y: 54, name: "Highwayman" },
  { id: "out_burnt_waystation_2", kind: "monster", monster: "outlaw_archer", x: 83, y: 54, name: "Outlaw Archer" },
  { id: "out_cutthroat_hollow_0", kind: "monster", monster: "cutthroat", x: 32, y: 78, name: "Cutthroat" },
  { id: "out_cutthroat_hollow_1", kind: "monster", monster: "cutthroat", x: 33, y: 78, name: "Cutthroat" },
  { id: "out_cutthroat_hollow_2", kind: "monster", monster: "outlaw_archer", x: 34, y: 78, name: "Outlaw Archer" },
  { id: "out_drovers_loss_0", kind: "monster", monster: "cutthroat", x: 57, y: 79, name: "Cutthroat" },
  { id: "out_drovers_loss_1", kind: "monster", monster: "marauder", x: 58, y: 79, name: "Marauder" },
  { id: "out_smugglers_landing_0", kind: "monster", monster: "outlaw_archer", x: 93, y: 71, name: "Outlaw Archer" },
  { id: "out_smugglers_landing_1", kind: "monster", monster: "outlaw_archer", x: 94, y: 71, name: "Outlaw Archer" },
  { id: "out_smugglers_landing_2", kind: "monster", monster: "marauder", x: 94, y: 70, name: "Marauder" },
  { id: "out_brigands_roost_0", kind: "monster", monster: "outlaw_captain", x: 33, y: 41, name: "Outlaw Captain" },
  { id: "out_brigands_roost_1", kind: "monster", monster: "cutthroat", x: 34, y: 41, name: "Cutthroat" },
  { id: "out_brigands_roost_2", kind: "monster", monster: "cutthroat", x: 35, y: 41, name: "Cutthroat" },
  { id: "out_brigands_roost_3", kind: "monster", monster: "marauder", x: 33, y: 42, name: "Marauder" },
  { id: "out_brigands_roost_4", kind: "monster", monster: "bandit", x: 35, y: 42, name: "Bandit" },

  // === OUTLYING SETTLEMENTS — small hamlets in the open country ==============
  // Three clusters of roofed cottages (see BUILDINGS / step 4d in map.ts), each
  // with its own folk, hearth and dressing. Ground laid for player housing
  // later. Tiles validated walkable + reachable by the placement finder.

  // --- REDMOUTH: a fisherfolk hamlet on the Redrun's east bank. Mourne the
  //     Deep Watcher keeps his bounty board here, at the river's grim last mile. ---
  {
    id: "mourne", kind: "npc", x: 90, y: 60, name: "Mourne, the Deep Watcher",
    lines: [
      "You're loud. The river hears you coming. So does what's in it.",
      "Mourne. I watch the deep places — the Marrow's dark, and the Redrun's last mile down to the grey. When a thing climbs out that shouldn't, I write its name on the board, and I pay the one who unwrites it.",
      "I don't send children to the deep. Come back when the Hills and the Spine have nothing left to teach you, and I'll have work for you.",
    ],
  },
  {
    id: "redmouth_warin", kind: "npc", x: 82, y: 60, name: "Warin, an Old Fisher",
    lines: [
      "Redmouth, this. Three roofs and a smokehouse, and we've buried better men for less.",
      "I've rowed the Redrun forty years. The water's wrong this season — runs red past the time of year for it, and the greyfin come up thin and few. My girl's wed downstream, near the estuary. Even she's stopped telling me it's nothing.",
    ],
  },
  {
    id: "redmouth_neila", kind: "npc", x: 86, y: 62, name: "Neila, a Net-Mender",
    lines: [
      "Mind the nets drying on the rail — a season's work, that, and a careless boot undoes a week of mending.",
      "My sister hawks our catch up in the Ironvale market — the fishwife by the square, you'll have heard her. She tells the city the red water's just the season. Out here we don't trouble to lie to ourselves about it.",
    ],
  },
  { id: "bounty_board_redmouth", kind: "bounty_board", x: 88, y: 61, name: "The Watcher's Board" },
  { id: "fire_redmouth", kind: "fire", x: 86, y: 59, name: "Smokehouse Fire" },
  { id: "cart_redmouth", kind: "cart", x: 87, y: 61, name: "Fish Cart", lines: ["A handcart of greyfin and river-perch, salted down for the smoke."] },
  { id: "lamp_redmouth_1", kind: "lamppost", x: 82, y: 57, name: "Bank Lamp" },
  { id: "lamp_redmouth_2", kind: "lamppost", x: 90, y: 58, name: "Bank Lamp" },
  { id: "sign_redmouth", kind: "signpost", x: 84, y: 57, name: "Fingerpost", lines: ["REDMOUTH — the fisherfolk of the Redrun. Smoked fish, and a board for those who'd hunt the deep."] },

  // --- THE DROVER'S REST: a waystation on the south road, victualling the
  //     herds up from the Ashfen — and shaken since the Drover's Loss. ---
  {
    id: "drover_tamsin", kind: "npc", x: 69, y: 75, name: "Tamsin, the Reeve",
    lines: [
      "Sit, traveller. The Rest's still standing — which is more than the last drove through here can say.",
      "We victual the herds coming up from the Ashfen and the moor. Did, anyway. A whole drive went down in the hollow south of here, one night — beasts, drovers and all. Now we keep the lamps lit late and the gate barred, and we charge for a bed and don't apologise for the price.",
    ],
  },
  {
    id: "drover_hodd", kind: "npc", x: 71, y: 77, name: "Hodd, a Drover",
    lines: [
      "Twelve mile a day, rain or the moor's mood — that's a drove. You learn to sleep walking.",
      "I'll not take the herd through the Drover's Loss after dark. The reeve says I've gone soft. The reeve didn't hear what I heard, the night the moor took the others.",
    ],
  },
  { id: "fire_drover", kind: "fire", x: 67, y: 75, name: "The Rest's Hearth" },
  { id: "cart_drover", kind: "cart", x: 69, y: 78, name: "Drover's Wagon", lines: ["A high-sided wagon, axle-deep in dried mud from the moor road."] },
  { id: "lamp_drover_1", kind: "lamppost", x: 64, y: 74, name: "Gate Lamp" },
  { id: "lamp_drover_2", kind: "lamppost", x: 72, y: 78, name: "Yard Lamp" },
  { id: "sign_drover", kind: "signpost", x: 63, y: 73, name: "Fingerpost", lines: ["THE DROVER'S REST — bed, board and a barred gate. ▲ IRONVALE. ▼ THE ASHFEN FLATS."] },

  // --- THE FOLD: an upland shepherds' croft in the northern Knuckle Hills,
  //     plagued by Rook's wolf-that-is-no-wolf. ---
  {
    id: "fold_brannog", kind: "npc", x: 63, y: 16, name: "Brannog, the Shepherd",
    lines: [
      "Up here it's sheep, stone and weather, and little else. Suits me. Suits the flock well enough.",
      "Old Rook, down the hills, keeps on about a wolf that's no wolf — clever, lame, takes a lamb clean and leaves no track. I've lost three this spring. I've stopped calling it a wolf. I just count the flock twice over now, and sleep the less for it.",
    ],
  },
  {
    id: "fold_wyn", kind: "npc", x: 64, y: 17, name: "Wyn, a Shepherd's Daughter",
    lines: [
      "You came up the Fold lane? Then it's the croft you'll be wanting, not me. I only mind the lambs.",
      "Da says I'm not to go past the lambing shed after dark. I don't argue it. Something's been at the flock, and it's not shy of the lamplight.",
    ],
  },
  { id: "fire_fold", kind: "fire", x: 61, y: 16, name: "Croft Hearth" },
  { id: "cart_fold", kind: "cart", x: 65, y: 17, name: "Wool Cart", lines: ["Sacks of greasy fleece, bound for the Ironvale cloth stalls."] },
  { id: "lamp_fold_1", kind: "lamppost", x: 59, y: 14, name: "Croft Lamp" },
  { id: "lamp_fold_2", kind: "lamppost", x: 66, y: 18, name: "Fold Lamp" },
  { id: "sign_fold", kind: "signpost", x: 58, y: 19, name: "Fingerpost", lines: ["THE FOLD — an upland croft. Mind the flock, and mind what minds the flock."] },
  { id: "cr_fold_sheep1", kind: "critter", species: "sheep", x: 66, y: 16, name: "A Hill Sheep" },
  { id: "cr_fold_sheep2", kind: "critter", species: "sheep", x: 59, y: 18, name: "A Hill Sheep" },

  // === PLAYER HOUSING — claim a lot, then build INSIDE its private interior ==
  // Each homestead lot has a plot marker (claim it) and a door into the home's
  // own instanced interior (a plank room in the hidden band, see INTERIORS in
  // map.ts). The build footings live INSIDE, ringing the room: bed / kitchen /
  // storage / workshop (functional stations) and table / hall (decor). A plot's
  // `target` is the interior entry tile — also where a built bed respawns you.

  // --- Redmouth homestead (lot south of the river bank; interior at x0=2) ---
  { id: "home_redmouth", kind: "housing_plot", x: 81, y: 64, name: "the Redmouth Homestead", target: { x: 7, y: 131 } },
  { id: "door_redmouth", kind: "house_door", x: 84, y: 65, name: "the Redmouth Home", plot: "home_redmouth", target: { x: 7, y: 131 }, lines: ["You step inside your home."] },
  { id: "exit_redmouth", kind: "house_door", x: 7, y: 132, name: "the Door Out", target: { x: 84, y: 66 }, lines: ["You step back out onto the lot."] },
  { id: "hs_redmouth_bed", kind: "build_hotspot", x: 4, y: 126, name: "Bed Space", category: "bed", plot: "home_redmouth" },
  { id: "hs_redmouth_hall", kind: "build_hotspot", x: 7, y: 126, name: "Hall Wall", category: "hall", plot: "home_redmouth" },
  { id: "hs_redmouth_storage", kind: "build_hotspot", x: 10, y: 126, name: "Storage Space", category: "storage", plot: "home_redmouth" },
  { id: "hs_redmouth_kitchen", kind: "build_hotspot", x: 4, y: 129, name: "Kitchen Space", category: "kitchen", plot: "home_redmouth" },
  { id: "hs_redmouth_table", kind: "build_hotspot", x: 7, y: 129, name: "Table Space", category: "table", plot: "home_redmouth" },
  { id: "hs_redmouth_workshop", kind: "build_hotspot", x: 10, y: 129, name: "Workshop Space", category: "workshop", plot: "home_redmouth" },

  // --- The Drover's Rest homestead (lot east of the yard; interior at x0=16) ---
  { id: "home_drover", kind: "housing_plot", x: 74, y: 73, name: "the Drover's Rest Homestead", target: { x: 21, y: 131 } },
  { id: "door_drover", kind: "house_door", x: 77, y: 74, name: "the Drover's Rest Home", plot: "home_drover", target: { x: 21, y: 131 }, lines: ["You step inside your home."] },
  { id: "exit_drover", kind: "house_door", x: 21, y: 132, name: "the Door Out", target: { x: 77, y: 75 }, lines: ["You step back out onto the lot."] },
  { id: "hs_drover_bed", kind: "build_hotspot", x: 18, y: 126, name: "Bed Space", category: "bed", plot: "home_drover" },
  { id: "hs_drover_hall", kind: "build_hotspot", x: 21, y: 126, name: "Hall Wall", category: "hall", plot: "home_drover" },
  { id: "hs_drover_storage", kind: "build_hotspot", x: 24, y: 126, name: "Storage Space", category: "storage", plot: "home_drover" },
  { id: "hs_drover_kitchen", kind: "build_hotspot", x: 18, y: 129, name: "Kitchen Space", category: "kitchen", plot: "home_drover" },
  { id: "hs_drover_table", kind: "build_hotspot", x: 21, y: 129, name: "Table Space", category: "table", plot: "home_drover" },
  { id: "hs_drover_workshop", kind: "build_hotspot", x: 24, y: 129, name: "Workshop Space", category: "workshop", plot: "home_drover" },

  // --- The Fold homestead (lot north of the croft; interior at x0=30) ---
  { id: "home_fold", kind: "housing_plot", x: 59, y: 8, name: "the Fold Homestead", target: { x: 35, y: 131 } },
  { id: "door_fold", kind: "house_door", x: 62, y: 9, name: "the Fold Home", plot: "home_fold", target: { x: 35, y: 131 }, lines: ["You step inside your home."] },
  { id: "exit_fold", kind: "house_door", x: 35, y: 132, name: "the Door Out", target: { x: 62, y: 10 }, lines: ["You step back out onto the lot."] },
  { id: "hs_fold_bed", kind: "build_hotspot", x: 32, y: 126, name: "Bed Space", category: "bed", plot: "home_fold" },
  { id: "hs_fold_hall", kind: "build_hotspot", x: 35, y: 126, name: "Hall Wall", category: "hall", plot: "home_fold" },
  { id: "hs_fold_storage", kind: "build_hotspot", x: 38, y: 126, name: "Storage Space", category: "storage", plot: "home_fold" },
  { id: "hs_fold_kitchen", kind: "build_hotspot", x: 32, y: 129, name: "Kitchen Space", category: "kitchen", plot: "home_fold" },
  { id: "hs_fold_table", kind: "build_hotspot", x: 35, y: 129, name: "Table Space", category: "table", plot: "home_fold" },
  { id: "hs_fold_workshop", kind: "build_hotspot", x: 38, y: 129, name: "Workshop Space", category: "workshop", plot: "home_fold" },
];

/** Where the player first appears — a clearing in the Knuckle Hills, by Aldric
 *  and the knucklestone outcrop, so the opening quest is right at hand. */
export const playerSpawn = { x: 22, y: 16 };
