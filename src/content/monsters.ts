/**
 * src/content/monsters.ts
 * -----------------------
 * Combat stats and loot tables for every monster, ported verbatim from the
 * Varath idle game's `MONSTERS` table. 30 monsters: the open-world
 * creatures of all six zones, the quest-only foes, and the four dungeon bosses.
 *
 * GENERATED from varath_21.html — see docs/CANON_LEDGER.md (Phase 1e). `acc`,
 * `def`, `speed`, `attackStyle` and `weakness` are carried for the combat-math
 * upgrade; today's simplified combat reads hp/maxHit/xp. Drop `tier` is the
 * canon rarity label. TypeScript validates every drop item id against ItemId.
 */

import type { MonsterStats } from "../core/types.ts";

export const monsters: Record<string, MonsterStats> = {
  "moor_rat": {
    "id": "moor_rat",
    "name": "Moor Rat",
    "icon": "🐀",
    "level": 1,
    "hp": 5,
    "acc": 1,
    "def": 1,
    "maxHit": 1,
    "speed": 3000,
    "xp": 8,
    "attackStyle": "stab",
    "weakness": [
      "slash"
    ],
    "desc": "A bristling, overgrown rat of the hill moors. More nuisance than threat.",
    "drops": [
      {
        "item": "raw_rat_meat",
        "chance": 1,
        "tier": "always"
      },
      {
        "item": "raw_hide",
        "chance": 0.4,
        "tier": "common"
      },
      {
        "item": "rat_tail",
        "chance": 0.25,
        "tier": "common"
      },
      {
        "item": "seed_ashweed",
        "chance": 0.05,
        "tier": "common"
      },
      {
        "item": "worn_coin",
        "chance": 0.05,
        "tier": "uncommon"
      },
      {
        "item": "rat_king_ear",
        "chance": 0.005,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.001,
        "tier": "legendary"
      }
    ]
  },
  "hill_wolf": {
    "id": "hill_wolf",
    "name": "Hill Wolf",
    "icon": "🐺",
    "level": 5,
    "hp": 14,
    "acc": 6,
    "def": 4,
    "maxHit": 3,
    "speed": 3200,
    "xp": 18,
    "attackStyle": "slash",
    "weakness": [
      "stab"
    ],
    "desc": "A lean grey wolf that hunts the Knuckle Hills in the cold months. Quick and wary.",
    "drops": [
      {
        "item": "raw_wolf_meat",
        "chance": 1,
        "tier": "always"
      },
      {
        "item": "wolf_pelt",
        "chance": 0.5,
        "tier": "common"
      },
      {
        "item": "wolf_fang",
        "chance": 0.1,
        "tier": "uncommon"
      },
      {
        "item": "seed_thornroot",
        "chance": 0.04,
        "tier": "common"
      },
      {
        "item": "silver_wolf_pelt",
        "chance": 0.005,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.001,
        "tier": "legendary"
      }
    ]
  },
  "wild_boar": {
    "id": "wild_boar",
    "name": "Wild Boar",
    "icon": "🐗",
    "level": 12,
    "hp": 28,
    "acc": 12,
    "def": 9,
    "maxHit": 5,
    "speed": 3600,
    "xp": 36,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "A heavy, ill-tempered boar of the Greyoak understory. It charges before it thinks.",
    "drops": [
      {
        "item": "raw_boar_meat",
        "chance": 1,
        "tier": "always"
      },
      {
        "item": "boar_hide",
        "chance": 0.6,
        "tier": "common"
      },
      {
        "item": "boar_tusk",
        "chance": 0.15,
        "tier": "uncommon"
      },
      {
        "item": "seed_bloodberry",
        "chance": 0.04,
        "tier": "common"
      },
      {
        "item": "bristle_crown",
        "chance": 0.004,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.001,
        "tier": "legendary"
      }
    ]
  },
  "forest_bear": {
    "id": "forest_bear",
    "name": "Forest Bear",
    "icon": "🐻",
    "level": 22,
    "hp": 50,
    "acc": 20,
    "def": 16,
    "maxHit": 9,
    "speed": 4000,
    "xp": 68,
    "attackStyle": "crush",
    "weakness": [
      "slash"
    ],
    "desc": "A great bear of the deep Greyoak. Slow to rouse, devastating once roused.",
    "drops": [
      {
        "item": "raw_bear_meat",
        "chance": 1,
        "tier": "always"
      },
      {
        "item": "bear_pelt",
        "chance": 0.7,
        "tier": "common"
      },
      {
        "item": "bear_claw",
        "chance": 0.2,
        "tier": "uncommon"
      },
      {
        "item": "forest_bear_skull",
        "chance": 0.003,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.002,
        "tier": "legendary"
      }
    ]
  },
  "ridge_wolf": {
    "id": "ridge_wolf",
    "name": "Ridge Wolf",
    "icon": "🐺",
    "level": 28,
    "hp": 38,
    "acc": 22,
    "def": 18,
    "maxHit": 6,
    "speed": 2600,
    "xp": 55,
    "attackStyle": "slash",
    "weakness": [
      "stab"
    ],
    "desc": "A mountain wolf, larger and meaner than its forest cousins.",
    "drops": [
      {
        "item": "raw_wolf_meat",
        "chance": 0.8,
        "tier": "always"
      },
      {
        "item": "wolf_fang",
        "chance": 0.5,
        "tier": "common"
      },
      {
        "item": "wolf_pelt",
        "chance": 0.25,
        "tier": "uncommon"
      },
      {
        "item": "silver_wolf_pelt",
        "chance": 0.02,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.001,
        "tier": "legendary"
      }
    ]
  },
  "stone_crawler": {
    "id": "stone_crawler",
    "name": "Stone Crawler",
    "icon": "🦎",
    "level": 35,
    "hp": 55,
    "acc": 28,
    "def": 30,
    "maxHit": 8,
    "speed": 3200,
    "xp": 85,
    "attackStyle": "stab",
    "weakness": [
      "crush"
    ],
    "desc": "An armoured reptile that moves across cliff faces. Its shell absorbs blows.",
    "drops": [
      {
        "item": "knucklestone_ore",
        "chance": 0.7,
        "tier": "always"
      },
      {
        "item": "ribstone_ore",
        "chance": 0.15,
        "tier": "uncommon"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.001,
        "tier": "legendary"
      }
    ]
  },
  "mountain_troll": {
    "id": "mountain_troll",
    "name": "Mountain Troll",
    "icon": "👹",
    "level": 42,
    "hp": 90,
    "acc": 33,
    "def": 22,
    "maxHit": 12,
    "speed": 3500,
    "xp": 130,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "Slow. Extremely strong. Does not like being poked.",
    "drops": [
      {
        "item": "ribstone_ore",
        "chance": 0.6,
        "tier": "common"
      },
      {
        "item": "worn_coin",
        "chance": 0.35,
        "tier": "common"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.002,
        "tier": "legendary"
      }
    ]
  },
  "spine_wraith": {
    "id": "spine_wraith",
    "name": "Spine Wraith",
    "icon": "👻",
    "level": 45,
    "hp": 50,
    "acc": 40,
    "def": 10,
    "maxHit": 9,
    "speed": 1800,
    "xp": 155,
    "attackStyle": "slash",
    "weakness": [
      "slash"
    ],
    "desc": "A fast, barely-visible thing that moves between rocks. Believed to be a remnant of something older.",
    "drops": [
      {
        "item": "shard_of_orun",
        "chance": 0.008,
        "tier": "legendary"
      }
    ]
  },
  "marsh_lurker": {
    "id": "marsh_lurker",
    "name": "Marsh Lurker",
    "icon": "🐊",
    "level": 48,
    "hp": 70,
    "acc": 38,
    "def": 28,
    "maxHit": 10,
    "speed": 2800,
    "xp": 165,
    "attackStyle": "stab",
    "weakness": [
      "crush"
    ],
    "desc": "A bog reptile that waits beneath the surface. The first sign is often the last.",
    "drops": [
      {
        "item": "raw_boar_meat",
        "chance": 0.6,
        "tier": "common"
      },
      {
        "item": "boar_hide",
        "chance": 0.3,
        "tier": "common"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.001,
        "tier": "legendary"
      }
    ]
  },
  "heartmoor_hound": {
    "id": "heartmoor_hound",
    "name": "Heartmoor Hound",
    "icon": "🐕",
    "level": 55,
    "hp": 65,
    "acc": 44,
    "def": 20,
    "maxHit": 12,
    "speed": 2200,
    "xp": 200,
    "attackStyle": "stab",
    "weakness": [
      "stab"
    ],
    "desc": "Pack hunters of the Heartmoor. Faster than they look. Work in groups.",
    "drops": [
      {
        "item": "raw_wolf_meat",
        "chance": 0.7,
        "tier": "always"
      },
      {
        "item": "wolf_fang",
        "chance": 0.4,
        "tier": "common"
      },
      {
        "item": "wolf_pelt",
        "chance": 0.2,
        "tier": "uncommon"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.001,
        "tier": "legendary"
      }
    ]
  },
  "bog_knight": {
    "id": "bog_knight",
    "name": "Bog Knight",
    "icon": "🧟",
    "level": 61,
    "hp": 100,
    "acc": 48,
    "def": 35,
    "maxHit": 14,
    "speed": 3000,
    "xp": 255,
    "attackStyle": "slash",
    "weakness": [
      "crush"
    ],
    "desc": "Something armoured that was buried in the mire and did not stay buried.",
    "drops": [
      {
        "item": "worn_coin",
        "chance": 0.8,
        "tier": "common"
      },
      {
        "item": "ashiron_bar",
        "chance": 0.15,
        "tier": "uncommon"
      },
      {
        "item": "ribstone_bar",
        "chance": 0.05,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.003,
        "tier": "legendary"
      }
    ]
  },
  "mire_serpent": {
    "id": "mire_serpent",
    "name": "Mire Serpent",
    "icon": "🐍",
    "level": 64,
    "hp": 85,
    "acc": 52,
    "def": 25,
    "maxHit": 18,
    "speed": 2400,
    "xp": 310,
    "attackStyle": "stab",
    "weakness": [
      "slash"
    ],
    "desc": "An enormous reptile that makes its home in the Heartmoor fens. Venomous.",
    "drops": [
      {
        "item": "raw_boar_meat",
        "chance": 0.5,
        "tier": "common"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.004,
        "tier": "legendary"
      }
    ]
  },
  "cave_crawler": {
    "id": "cave_crawler",
    "name": "Cave Crawler",
    "icon": "🕷️",
    "level": 68,
    "hp": 80,
    "acc": 55,
    "def": 30,
    "maxHit": 14,
    "speed": 2600,
    "xp": 335,
    "attackStyle": "stab",
    "weakness": [
      "crush"
    ],
    "desc": "A large, pale spider that has never seen light. Moves quickly in darkness.",
    "drops": [
      {
        "item": "ashiron_ore",
        "chance": 0.2,
        "tier": "uncommon"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.002,
        "tier": "legendary"
      }
    ]
  },
  "deep_bat": {
    "id": "deep_bat",
    "name": "Deep Bat",
    "icon": "🦇",
    "level": 72,
    "hp": 55,
    "acc": 60,
    "def": 15,
    "maxHit": 11,
    "speed": 1600,
    "xp": 290,
    "attackStyle": "slash",
    "weakness": [
      "slash"
    ],
    "desc": "Enormous bats that hunt in the Marrow Deeps. Incredibly fast, somewhat fragile.",
    "drops": [
      {
        "item": "raw_rat_meat",
        "chance": 0.6,
        "tier": "common"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.002,
        "tier": "legendary"
      }
    ]
  },
  "marrow_wraith": {
    "id": "marrow_wraith",
    "name": "Marrow Wraith",
    "icon": "💀",
    "level": 78,
    "hp": 70,
    "acc": 65,
    "def": 20,
    "maxHit": 18,
    "speed": 2200,
    "xp": 425,
    "attackStyle": "slash",
    "weakness": [
      "crush"
    ],
    "desc": "A remnant that has absorbed the minerals of the deep. Bone without flesh.",
    "drops": [
      {
        "item": "worn_coin",
        "chance": 0.6,
        "tier": "common"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.005,
        "tier": "legendary"
      }
    ]
  },
  "marrow_keeper": {
    "id": "marrow_keeper",
    "name": "The Marrow Keeper",
    "icon": "💀",
    "level": 72,
    "hp": 350,
    "acc": 65,
    "def": 55,
    "maxHit": 25,
    "speed": 3500,
    "xp": 1400,
    "attackStyle": "crush",
    "weakness": [
      "slash"
    ],
    "desc": "The thing that was left to watch the vault. It is still watching.",
    "drops": [
      {
        "item": "marrow_keep_plate",
        "chance": 0.08,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.02,
        "tier": "legendary"
      }
    ]
  },
  "deep_golem": {
    "id": "deep_golem",
    "name": "Deepstone Golem",
    "icon": "🗿",
    "level": 83,
    "hp": 180,
    "acc": 60,
    "def": 65,
    "maxHit": 22,
    "speed": 4000,
    "xp": 580,
    "attackStyle": "crush",
    "weakness": [
      "crush"
    ],
    "desc": "An animated construct of compressed deeprock. Slow, almost unkillable, hits like a falling wall.",
    "drops": [
      {
        "item": "hearthite_ore",
        "chance": 0.1,
        "tier": "uncommon"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.008,
        "tier": "legendary"
      }
    ]
  },
  "river_serpent": {
    "id": "river_serpent",
    "name": "River Serpent",
    "icon": "🐲",
    "level": 86,
    "hp": 130,
    "acc": 68,
    "def": 42,
    "maxHit": 24,
    "speed": 2800,
    "xp": 640,
    "attackStyle": "stab",
    "weakness": [
      "slash"
    ],
    "desc": "An ancient serpent from the Redrun tributaries. The river looks different than it used to.",
    "drops": [
      {
        "item": "raw_bear_meat",
        "chance": 0.65,
        "tier": "common"
      },
      {
        "item": "eyeless_scale",
        "chance": 0.3,
        "tier": "uncommon"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.007,
        "tier": "legendary"
      }
    ]
  },
  "redrun_brigand": {
    "id": "redrun_brigand",
    "name": "Redrun Brigand",
    "icon": "🗡️",
    "level": 90,
    "hp": 115,
    "acc": 72,
    "def": 50,
    "maxHit": 20,
    "speed": 2400,
    "xp": 700,
    "attackStyle": "stab",
    "weakness": [
      "slash"
    ],
    "desc": "An outlaw of the Redrun crossings. Armed, armoured, and motivated.",
    "drops": [
      {
        "item": "worn_coin",
        "chance": 0.9,
        "tier": "always"
      },
      {
        "item": "bloodore_ore",
        "chance": 0.5,
        "tier": "common"
      },
      {
        "item": "bloodore_bar",
        "chance": 0.12,
        "tier": "uncommon"
      },
      {
        "item": "hearthite_ore",
        "chance": 0.06,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.005,
        "tier": "legendary"
      }
    ]
  },
  "ancient_orc": {
    "id": "ancient_orc",
    "name": "Ancient Orc",
    "icon": "👹",
    "level": 94,
    "hp": 160,
    "acc": 76,
    "def": 55,
    "maxHit": 28,
    "speed": 2600,
    "xp": 870,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "A very old orc warrior. Carries centuries of fighting experience. Approach respectfully.",
    "drops": [
      {
        "item": "hearthite_ore",
        "chance": 0.25,
        "tier": "uncommon"
      },
      {
        "item": "hearthite_bar",
        "chance": 0.05,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.008,
        "tier": "legendary"
      }
    ]
  },
  "dread_ferryman": {
    "id": "dread_ferryman",
    "name": "The Dread Ferryman",
    "icon": "⛵",
    "level": 98,
    "hp": 250,
    "acc": 82,
    "def": 60,
    "maxHit": 35,
    "speed": 2400,
    "xp": 1200,
    "attackStyle": "slash",
    "weakness": [
      "stab",
      "crush"
    ],
    "desc": "The ferryman of the Redrun. He has been here longer than the river. He wants payment.",
    "drops": [
      {
        "item": "worn_coin",
        "chance": 1,
        "tier": "always"
      },
      {
        "item": "waterlogged_coin",
        "chance": 0.55,
        "tier": "common"
      },
      {
        "item": "hearthite_bar",
        "chance": 0.4,
        "tier": "uncommon"
      },
      {
        "item": "redrun_pearl",
        "chance": 0.08,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.02,
        "tier": "legendary"
      }
    ]
  },
  "aelveth_white_wolf": {
    "id": "aelveth_white_wolf",
    "name": "Aelveth White Wolf",
    "icon": "🐺",
    "level": 15,
    "hp": 35,
    "acc": 14,
    "def": 10,
    "maxHit": 6,
    "speed": 2800,
    "xp": 45,
    "attackStyle": "slash",
    "weakness": [
      "stab"
    ],
    "desc": "Something older and stranger than a hill wolf. It moves without sound and looks at you like it already knows the outcome.",
    "drops": []
  },
  "berric_fighter": {
    "id": "berric_fighter",
    "name": "Berric",
    "icon": "🔨",
    "level": 20,
    "hp": 45,
    "acc": 18,
    "def": 14,
    "maxHit": 8,
    "speed": 3200,
    "xp": 60,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "A smith who spent thirty years shaping iron. His grip remembers every hammer swing.",
    "drops": []
  },
  "greymane_boar": {
    "id": "greymane_boar",
    "name": "The Greymane Boar",
    "icon": "🐗",
    "level": 25,
    "hp": 65,
    "acc": 22,
    "def": 18,
    "maxHit": 10,
    "speed": 3400,
    "xp": 90,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "The same boar that walked away from three Lodge hunting parties. Scarred, iron-grey, and considerably more patient than you.",
    "drops": [
      {
        "item": "shard_of_orun",
        "chance": 0.002,
        "tier": "legendary"
      }
    ]
  },
  "cult_devotee": {
    "id": "cult_devotee",
    "name": "Cult Devotee",
    "icon": "🧙",
    "level": 32,
    "hp": 55,
    "acc": 26,
    "def": 20,
    "maxHit": 9,
    "speed": 2800,
    "xp": 80,
    "attackStyle": "crush",
    "weakness": [
      "slash"
    ],
    "desc": "A true believer of the Heartmoor Cult. Fights like the seam is worth their life — because to them, it is.",
    "drops": []
  },
  "ashforge_enforcer": {
    "id": "ashforge_enforcer",
    "name": "Ashforge Enforcer",
    "icon": "⚔️",
    "level": 38,
    "hp": 70,
    "acc": 32,
    "def": 26,
    "maxHit": 11,
    "speed": 2600,
    "xp": 100,
    "attackStyle": "slash",
    "weakness": [
      "crush"
    ],
    "desc": "A trained Brotherhood fighter. Vorn did not come himself, but he sent someone who knows how to finish things.",
    "drops": []
  },
  "lodge_warden_npc": {
    "id": "lodge_warden_npc",
    "name": "Lodge Warden",
    "icon": "🏹",
    "level": 35,
    "hp": 65,
    "acc": 28,
    "def": 24,
    "maxHit": 10,
    "speed": 2800,
    "xp": 88,
    "attackStyle": "stab",
    "weakness": [
      "slash"
    ],
    "desc": "A Lodge warden sent to seal the seam. Principled. Persistent. Standing exactly between you and what you came for.",
    "drops": []
  },
  "hollow_warden": {
    "id": "hollow_warden",
    "name": "The Hollow Warden",
    "icon": "💀",
    "level": 38,
    "hp": 120,
    "acc": 32,
    "def": 28,
    "maxHit": 14,
    "speed": 3000,
    "xp": 450,
    "attackStyle": "slash",
    "weakness": [
      "crush"
    ],
    "desc": "An armoured revenant. It carries a weapon from before smithing had names.",
    "drops": [
      {
        "item": "blade_of_graves",
        "chance": 0.12,
        "tier": "legendary"
      },
      {
        "item": "marrow_flail",
        "chance": 0.1,
        "tier": "legendary"
      },
      {
        "item": "ashward_shield",
        "chance": 0.1,
        "tier": "legendary"
      },
      {
        "item": "greymail_plate",
        "chance": 0.08,
        "tier": "legendary"
      },
      {
        "item": "barrow_helm",
        "chance": 0.1,
        "tier": "legendary"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.05,
        "tier": "legendary"
      },
      {
        "item": "worn_coin",
        "chance": 1,
        "min": 80,
        "max": 200,
        "tier": "always"
      },
      {
        "item": "ribstone_bar",
        "chance": 0.4,
        "tier": "common"
      },
      {
        "item": "bloodore_bar",
        "chance": 0.15,
        "tier": "uncommon"
      }
    ]
  },
  "spine_warlord": {
    "id": "spine_warlord",
    "name": "The Spine Warlord",
    "icon": "👹",
    "level": 60,
    "hp": 200,
    "acc": 52,
    "def": 45,
    "maxHit": 22,
    "speed": 2800,
    "xp": 900,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "An orc warlord who refused to die. The Spine took him in instead.",
    "drops": [
      {
        "item": "orun_reaver",
        "chance": 0.1,
        "tier": "legendary"
      },
      {
        "item": "coldbone_bow",
        "chance": 0.1,
        "tier": "legendary"
      },
      {
        "item": "stoneguard_plate",
        "chance": 0.08,
        "tier": "legendary"
      },
      {
        "item": "ironveil_legs",
        "chance": 0.1,
        "tier": "legendary"
      },
      {
        "item": "warden_ring",
        "chance": 0.12,
        "tier": "legendary"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.08,
        "tier": "legendary"
      },
      {
        "item": "worn_coin",
        "chance": 1,
        "min": 200,
        "max": 500,
        "tier": "always"
      },
      {
        "item": "bloodore_bar",
        "chance": 0.4,
        "tier": "common"
      }
    ]
  },
  "bog_warden": {
    "id": "bog_warden",
    "name": "The Bog Warden",
    "icon": "🧟",
    "level": 42,
    "hp": 220,
    "acc": 45,
    "def": 38,
    "maxHit": 16,
    "speed": 3200,
    "xp": 800,
    "attackStyle": "slash",
    "weakness": [
      "crush"
    ],
    "desc": "Something that was buried in the mire with purpose. It has been here longer than the settlement that forgot it.",
    "drops": [
      {
        "item": "worn_coin",
        "chance": 1,
        "min": 80,
        "max": 200,
        "tier": "always"
      },
      {
        "item": "ribstone_bar",
        "chance": 0.5,
        "tier": "common"
      },
      {
        "item": "ashiron_bar",
        "chance": 0.8,
        "tier": "common"
      },
      {
        "item": "bog_ward_helm",
        "chance": 0.1,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.015,
        "tier": "legendary"
      }
    ]
  }
};
