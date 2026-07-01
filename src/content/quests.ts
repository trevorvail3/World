/**
 * src/content/quests.ts
 * ---------------------
 * The canon Varath main story. Pure DATA — the core (worldCore.ts) tracks
 * progress, fires the branching choices, sets the story flags and grants the
 * rewards. This is a faithful adaptation of the idle game's QUESTS data to the
 * world engine's verbs (talk / kill / gather / deliver / reach / choice).
 *
 * The spine is three acts and four factions — the Ashforge Brotherhood, the
 * Warden's Lodge, the Pale Record and the Heartmoor — converging on a single
 * stone and a single question that cannot be answered: is the warmth a god?
 *
 *   Act I   — the worn coin, the first warm shard, and four doors opening.
 *   Act II  — earning rank, the traitor Berric, and the Seam Question.
 *   Act III — the descent to the Marrow Keeper and the last choice.
 *
 * Quest ids, flag names, choice branches and the four endings are kept faithful
 * to the source. Where the source used dungeons, combat sequences or a gold
 * economy the engine doesn't model, the beat is mapped onto the nearest verb
 * (a boss-clear becomes a kill; a sale becomes a remembered choice).
 */

import type { QuestDef } from "../core/types.ts";

export const quests: QuestDef[] = [
  // ===========================================================================
  // ACT I
  // ===========================================================================

  {
    id: "q_ash_and_knuckle",
    name: "Ash and Knuckle",
    act: 1,
    giver: "aldric",
    intro: [
      "You're new — I can tell, because you're watching me work instead of doing any.",
      "East wall's gone soft and I'm too old to quarry it. Know stone at all? Bring me a worked bar and I'll make it worth your while.",
      "Mine a few pieces of Knucklestone from the outcrop. Smelt one to a bar at the furnace. Then come back to me.",
    ],
    steps: [
      { type: "gather", item: "knucklestone_ore", count: 3, text: "Mine 3 pieces of Knucklestone" },
      { type: "gather", item: "knucklestone_bar", count: 1, text: "Smelt a Knucklestone Bar at the furnace" },
      { type: "deliver", npc: "aldric", item: "knucklestone_bar", count: 1, text: "Bring the bar to Aldric" },
    ],
    outro: [
      "Good metal. Honest work. Here — take this for your trouble.",
      "Found it in the turned earth by the wall. Old Varath mintage, worn smooth, and no coin I've ever known. The moor rats keep turning the things up. A dead king's money, in a rat's hole. Why?",
      "Keep it. A thing to carry, and a question to carry with it.",
    ],
    reward: {
      xp: [
        { skill: "mining", amount: 60 },
        { skill: "smithing", amount: 50 },
      ],
      items: [{ item: "worn_coin", qty: 1 }],
      flags: ["q_ash_and_knuckle_complete", "met_aldric", "has_aldric_coin"],
    },
  },

  {
    id: "q_first_shard",
    name: "The First Shard",
    act: 1,
    giver: "calder",
    requiresFlags: ["q_ash_and_knuckle_complete"],
    intro: [
      "Forgive the road manners. You've got a piece of warm stone on you — jet-black, holds heat that isn't the sun's. A Shard of Orun.",
      "I'm Calder. I carry word for the Heartmoor, and we pay well for warm stone. Bring me one and we'll talk like honest people.",
    ],
    steps: [
      { type: "gather", item: "shard_of_orun", count: 1, text: "Take a Shard of Orun from the moor's beasts — they carry one, rarely, and always by the time you've cleared a few hundred", from: "moor_rat" },
      {
        type: "choice",
        npc: "calder",
        text: "Decide the shard's fate with Calder",
        prompt: "The warm shard — what do you do with it?",
        options: [
          {
            label: "Sell it to Calder. The Heartmoor pays (1500g).",
            flags: ["q_first_shard_sold_cult", "shard_answer_warm"],
            gold: 1500,
            takeItem: "shard_of_orun",
            rep: [{ faction: "heartmoor_cult", amount: 15 }],
            reply: "Calder weighs the coin into your hand and the warmth into his. 'The Heartmoor thanks you.'",
          },
          {
            label: "Keep it. Understand it before you sell it.",
            flags: ["q_first_shard_kept"],
            rep: [{ faction: "heartmoor_cult", amount: 3 }],
            reply: "Calder smiles, not unkindly. 'A person who wants to understand a thing first is the only kind I trust. The offer keeps.'",
          },
          {
            label: "Sell it to Skritt the goblin instead (1800g).",
            flags: ["q_first_shard_kept", "q_first_shard_prefers_skritt"],
            gold: 1800,
            takeItem: "shard_of_orun",
            rep: [{ faction: "heartmoor_cult", amount: -5 }],
            reply: "Calder's smile thins. 'The goblin's coin spends the same. But the Heartmoor remembers who it dealt with.'",
          },
        ],
      },
    ],
    outro: [
      "Whatever you decide, the road keeps a fire and a meal for whoever it gives out on.",
      "Go careful past the pools. And think on the stone. It's older than anyone's selling it for.",
    ],
    reward: {
      flags: ["q_first_shard_resolved", "act1_first_shard_done", "met_calder"],
    },
  },

  {
    id: "q_hammer_and_name",
    name: "The Hammer and the Name",
    act: 1,
    giver: "vorn",
    requiresFlags: ["act1_first_shard_done"],
    intro: [
      "You're not bad — for someone who taught themselves on cold ash and guesswork.",
      "The Ashforge Brotherhood doesn't recruit. We warn a man what the hammer costs and wait to see if he picks it up. Prove your hand: forge me five Ashiron bars and bring them here.",
      "Word to the wise: ashiron won't smelt clean on its own. You'll want embercite for flux — they cut it out on the Ashfen Flats, south of here.",
    ],
    steps: [
      { type: "reach", skill: "smithing", level: 20, text: "Reach Smithing level 20" },
      { type: "deliver", npc: "vorn", item: "ashiron_bar", count: 5, text: "Forge & deliver 5 Ashiron Bars (each bar needs Embercite flux from the Ashfen Flats)" },
      {
        type: "choice",
        npc: "vorn",
        text: "Hear Vorn out about Berric",
        prompt: "Vorn says a council man named Berric sells seam surveys. What do you say?",
        options: [
          {
            label: "Why tell me this now?",
            flags: ["npc_vorn_confided"],
            reply: "'Because you'll hear it crooked from someone else if you don't hear it straight from me.'",
          },
          {
            label: "Who's he selling to?",
            flags: ["vorn_asked_buyer"],
            reply: "'That's the question, isn't it. I have a guess, and I don't like it.'",
          },
          {
            label: "Not my problem.",
            flags: ["npc_vorn_disappointed"],
            reply: "Vorn studies you a moment, then turns back to the fire. 'No. I suppose it isn't.'",
          },
          {
            label: "I'll look into it — with you.",
            flags: ["npc_vorn_partner", "vorn_asked_buyer"],
            reply: "'Then we're partners in it. Don't move on Berric without me — a cornered man does damage.'",
          },
        ],
      },
    ],
    outro: [
      "That's a Brotherhood hand. Take the hammer — it'll serve you better than guesswork.",
      "Welcome in. Mind Berric, and mind yourself.",
    ],
    reward: {
      xp: [{ skill: "smithing", amount: 250 }],
      items: [{ item: "ashforge_hammer", qty: 1 }],
      flags: ["guild_ashforge_joined", "met_vorn"],
      rep: [{ faction: "ashforge", amount: 10 }],
    },
  },

  {
    id: "q_white_in_the_trees",
    name: "The White in the Trees",
    act: 1,
    giver: "maret",
    requiresFlags: ["act1_first_shard_done"],
    intro: [
      "Stranger on the Lodge road. There's a wolf at the treeline — old, white, bigger than any wolf has a right to be. She's looking at you.",
      "How you treat the wood now tells me everything I need to know about you.",
    ],
    steps: [
      {
        type: "choice",
        npc: "maret",
        text: "Decide how to meet the white wolf",
        prompt: "The white wolf watches you from the trees. What do you do?",
        options: [
          {
            label: "Follow it.",
            flags: ["wolf_followed"],
            reply: "The wolf turns and pads into the wood, glancing back once to be sure you're coming.",
          },
          {
            label: "Leave it be. Walk on.",
            flags: ["wolf_ignored"],
            reply: "You walk on. The wolf watches you go, and something in the wood cools toward you.",
          },
          {
            label: "Draw your weapon.",
            flags: ["wolf_hunt_chosen", "npc_maret_wolf_killed_by_player", "lenne_became_contact"],
            reply: "Steel rings. The wolf does not run. When it's done you hold a white pelt — and Maret will never look at you the same way. Lenne will have to be your road into the Lodge now.",
          },
        ],
      },
      { type: "kill", monster: "wild_boar", count: 6, text: "Clear 6 Wild Boar for the Lodge" },
      { type: "talk", npc: "maret", text: "Report back to Maret" },
    ],
    outro: [
      "Cleanly done — and you came back. Not everyone does both.",
      "You can come back to this fire. The Lodge remembers a steady hand. Take the token; it'll open doors in the wood.",
    ],
    reward: {
      xp: [
        { skill: "vigour", amount: 150 },
        { skill: "survivalist", amount: 100 },
      ],
      items: [{ item: "lodge_token", qty: 1 }],
      flags: ["guild_lodge_contacted"],
      rep: [{ faction: "lodge", amount: 10 }],
    },
  },

  {
    id: "q_worn_coin",
    name: "What the Coin Remembers",
    act: 1,
    giver: "aldric",
    requiresFlags: ["has_aldric_coin"],
    intro: [
      "That coin's still bothering you, I can see it. Good. It should.",
      "There's a reader in Ironvale — Sera, of the Pale Record. If anyone can tell you what you're carrying, it's her. Take the coin to her.",
    ],
    steps: [
      { type: "talk", npc: "sera", text: "Bring the worn coin to Sera" },
      { type: "gather", item: "worn_coin", count: 3, text: "Gather 3 more worn coins from the moor rats", from: "moor_rat" },
      { type: "talk", npc: "ashfen_tender", text: "Investigate the warm workings the cult tends" },
      {
        type: "choice",
        npc: "sera",
        text: "Decide the coin's fate with Sera",
        prompt: "Sera has read the coin. What becomes of it?",
        options: [
          {
            label: "Leave it with the Order.",
            flags: ["order_has_aldric_coin"],
            reply: "Sera sets it among the catalogued dead. 'A person who gives knowledge a home instead of a shelf over their hearth. We'll work well.'",
          },
          {
            label: "Keep it. It was given to you.",
            flags: ["kept_aldric_coin"],
            reply: "'Then keep it well. It is the only one of its kind I have ever held that someone still carries.'",
          },
        ],
      },
    ],
    outro: [
      "Underloft mintage. They buried their dead with the warm stone — the Shards — and someone is robbing those graves to sell what the cult will pay for.",
      "You've found the edge of something old and ugly. Come down to the Underloft when you're ready to read further. The Pale Record could use eyes like yours.",
    ],
    reward: {
      xp: [{ skill: "mining", amount: 150 }],
      items: [{ item: "order_cipher_key", qty: 1 }, { item: "mount_pony", qty: 1 }],
      flags: ["guild_pale_record_contacted", "met_sera", "knows_underloft", "act1_complete"],
      rep: [{ faction: "pale_record", amount: 10 }],
    },
  },

  // ===========================================================================
  // ACT II
  // ===========================================================================

  {
    id: "q_forge_apprentice",
    name: "The Apprentice's Mark",
    act: 2,
    giver: "vorn",
    requiresFlags: ["guild_ashforge_joined"],
    intro: [
      "Time you proved you're past the basics. Forge me a Ribstone blade — we call it the Apprentice's Mark.",
      "Berric will come at you while you work. He always does. Watch what he offers, and watch what it costs.",
    ],
    steps: [
      { type: "reach", skill: "smithing", level: 30, text: "Reach Smithing level 30" },
      {
        type: "choice",
        npc: "berric",
        text: "Hear out Berric's offer",
        prompt: "Berric offers you cheap, cut Ribstone — no questions. What do you say?",
        options: [
          {
            label: "Press him — who's really buying?",
            flags: ["learned_berric_sells_to_cult", "has_berric_evidence"],
            reply: "Berric's voice drops. 'Heartmoor money. The cult. And we never had this talk.' Now you have something Vorn can use.",
          },
          {
            label: "I'll do it the Brotherhood's way.",
            flags: ["berric_rebuffed"],
            reply: "'Suit yourself. Sentiment's expensive, friend.' He drifts off, disappointed.",
          },
          {
            label: "Sounds profitable. I'm in.",
            flags: ["berric_full_trust"],
            reply: "'Now you're thinking like a man with a future.' His smile doesn't reach his eyes.",
          },
        ],
      },
      { type: "gather", item: "ribstone_bar", count: 1, text: "Forge a Ribstone Bar for the Mark" },
      { type: "deliver", npc: "vorn", item: "ribstone_bar", count: 1, text: "Present the Mark to Vorn" },
    ],
    outro: [
      "That's a Mark, and a good one. You're Rank Two in the Brotherhood now.",
      "And if you learned what I think you learned from Berric — keep it close. We'll need it.",
    ],
    reward: {
      xp: [{ skill: "smithing", amount: 500 }],
      items: [{ item: "apprentice_mark_blade", qty: 1 }, { item: "mount_ironboar", qty: 1 }],
      flags: ["guild_ashforge_rank_2"],
      rep: [{ faction: "ashforge", amount: 15 }],
    },
  },

  {
    id: "q_berric_question",
    name: "The Seam and the Man",
    act: 2,
    giver: "vorn",
    requiresFlags: ["guild_ashforge_rank_2"],
    intro: [
      "I've sat with this a week and I'm done sitting. Berric sells our seams to the cult, and it ends now.",
      "How it ends is the only thing left, and I want your read. Choose, then go to him.",
    ],
    steps: [
      {
        type: "choice",
        npc: "vorn",
        text: "Choose how to deal with Berric",
        prompt: "Berric has to be answered for. How?",
        options: [
          {
            label: "By the council. Have him exiled.",
            flags: ["berric_exiled", "reckoning_approach_formal"],
            reply: "'The clean way. The slow way. The council it is.'",
          },
          {
            label: "By the blade. Confront him yourself.",
            flags: ["berric_defeated_in_combat", "reckoning_approach_direct"],
            reply: "'Don't move on him without me — a cornered man does damage. But if it must be steel, make it quick.'",
          },
          {
            label: "By the ledger. Break him with the truth.",
            flags: ["berric_reckoned", "reckoning_approach_ledger"],
            reply: "'Whatever you put in front of him, make it the thing a hammer wouldn't.'",
          },
        ],
      },
      { type: "talk", npc: "berric", text: "Bring Berric to his reckoning" },
      { type: "talk", npc: "vorn", text: "Report the outcome to Vorn" },
    ],
    outro: [
      "It's done. The seam's ours again, and the house knows it.",
      "Take the ledger — the Pale Record will want it, and you may want a friend there before this is through. Rest. The hard part's still coming.",
    ],
    reward: {
      xp: [
        { skill: "smithing", amount: 300 },
        { skill: "edge", amount: 300 },
      ],
      items: [{ item: "berric_ledger", qty: 1 }],
      flags: ["act2_berric_dealt_with"],
      rep: [{ faction: "ashforge", amount: 15 }],
    },
  },

  {
    id: "q_lodge_trial",
    name: "The Lodge Trial",
    act: 2,
    giver: "maret",
    requiresFlags: ["guild_lodge_contacted"],
    blockedByFlags: ["npc_maret_wolf_killed_by_player"],
    intro: [
      "You've done enough small contracts that I trust your hands. Now I need to know if I can trust your eyes — and your silence.",
      "Go into the deep growth. Read what's there. Survive what hunts it. Then I'll tell you the thing I've told no one.",
    ],
    steps: [
      { type: "reach", skill: "forestry", level: 25, text: "Reach Forestry level 25" },
      { type: "reach", skill: "survivalist", level: 25, text: "Reach Survivalist level 25" },
      { type: "kill", monster: "ridge_wolf", count: 4, text: "Survive the deep pack — slay 4 Ridge Wolves" },
      {
        type: "choice",
        npc: "maret",
        text: "Hear Maret's secret",
        prompt: "The old growth is retreating. Something is returning. What do you tell Maret?",
        options: [
          {
            label: "Tell the Lodge. They have to know.",
            flags: ["urged_maret_tell"],
            reply: "'Maybe. Maybe they'd only panic and cut what's left. Let me carry it a while longer.'",
          },
          {
            label: "Keep watching. Quietly, with you.",
            flags: ["pledged_to_watch_with_maret"],
            reply: "Maret holds your eyes a long moment. 'Then we watch it together. That's not nothing, to me.'",
          },
        ],
      },
    ],
    outro: [
      "You're a Warden now — full standing, full trust.",
      "Take the longbow. It was Caelwyn's. And keep what you saw between us, until the wood tells us what it means.",
    ],
    reward: {
      xp: [
        { skill: "survivalist", amount: 400 },
        { skill: "forestry", amount: 300 },
        { skill: "vitality", amount: 200 },
      ],
      items: [{ item: "warden_longbow", qty: 1 }, { item: "mount_silverwolf", qty: 1 }],
      flags: ["guild_lodge_rank_2", "knows_forest_retreat"],
      rep: [{ faction: "lodge", amount: 15 }],
    },
  },

  {
    id: "q_pale_record_open",
    name: "The Reader's Coin",
    act: 2,
    giver: "sera",
    requiresFlags: ["guild_pale_record_contacted"],
    intro: [
      "I've been stuck on the same four words since the Equinox: 'the stone remembered.'",
      "Bring me a clean Shard, and clear the Bog Barrow of what guards the Underloft dead. With both, I can assemble the rite — and finally learn what it does.",
    ],
    steps: [
      { type: "gather", item: "shard_of_orun", count: 1, text: "Acquire a clean Shard of Orun" },
      { type: "kill", monster: "bog_knight", count: 1, text: "Clear the Bog Barrow's guardian" },
      {
        type: "choice",
        npc: "sera",
        text: "Answer Sera's question of belief",
        prompt: "Sera asks, quietly: what do you actually believe the warmth is?",
        options: [
          {
            label: "I think the warmth is him. A god.",
            flags: ["player_belief_believer"],
            reply: "'Maybe. I won't tell you you're wrong. I can't.'",
          },
          {
            label: "It's warm rock. The meaning is ours.",
            flags: ["player_belief_skeptic"],
            reply: "'The honest skeptic's position. I've held it myself, on the cold days.'",
          },
          {
            label: "I don't know, and I won't pretend.",
            flags: ["player_belief_agnostic"],
            reply: "Sera almost smiles. 'That's the only answer I trust. The rest is people deciding before they know.'",
          },
        ],
      },
    ],
    outro: [
      "The rite assembles. 'The stone remembered' — it's a recipe, not a prayer. And it works. What it summons, I won't guess at.",
      "You're a Chronicler of the Pale Record now — Rank One. When I learn what this is, you'll be the first I tell.",
    ],
    reward: {
      xp: [{ skill: "vitality", amount: 500 }],
      items: [
        { item: "chronicler_seal", qty: 1 },
        { item: "order_cipher_key", qty: 1 },
        { item: "mount_courier", qty: 1 },
      ],
      flags: ["guild_pale_record_rank_1", "knows_rite_partial"],
      rep: [{ faction: "pale_record", amount: 15 }],
    },
  },

  {
    id: "q_seam_question",
    name: "The Seam Question",
    act: 2,
    giver: "serath",
    requiresFlags: ["knows_rite_partial"],
    intro: [
      "They've all sent word to me, because I keep the pass and I take no side. The richest seam ever found, in contested ground. Four hands reaching for it.",
      "The Brotherhood. The Lodge. The Order. The Heartmoor. None of them is lying to you — that's what makes this hard. Hear them, then decide. Your choice settles it.",
    ],
    steps: [
      {
        type: "choice",
        npc: "serath",
        text: "Settle the Seam Question",
        prompt: "The contested seam — whose hands does it go to?",
        options: [
          {
            label: "The Brotherhood works it.",
            flags: ["act2_seam_choice_mining"],
            rep: [
              { faction: "ashforge", amount: 25 },
              { faction: "heartmoor_cult", amount: -20 },
              { faction: "lodge", amount: -15 },
              { faction: "pale_record", amount: -10 },
            ],
            reply: "Vorn's people move in with picks and ledgers. The cult and the Lodge will remember you didn't choose them.",
          },
          {
            label: "The Lodge protects it.",
            flags: ["act2_seam_choice_lodge"],
            rep: [
              { faction: "lodge", amount: 25 },
              { faction: "heartmoor_cult", amount: -30 },
              { faction: "ashforge", amount: -10 },
              { faction: "pale_record", amount: -5 },
            ],
            reply: "The Wardens close the ground and let the wood take it back. The cult comes for it — and you stand with Maret when they do.",
          },
          {
            label: "The Order seals and studies it.",
            flags: ["act2_seam_choice_order"],
            rep: [
              { faction: "pale_record", amount: 25 },
              { faction: "ashforge", amount: -10 },
              { faction: "lodge", amount: -5 },
              { faction: "heartmoor_cult", amount: -15 },
            ],
            reply: "Sera's people ward the seam and read it slowly. No one digs; no one prays. The question stays open.",
          },
          {
            label: "Keep it active. For the Heartmoor.",
            flags: ["act2_seam_choice_sabotage", "cult_path_committed"],
            rep: [
              { faction: "heartmoor_cult", amount: 25 },
              { faction: "ashforge", amount: -20 },
              { faction: "lodge", amount: -30 },
              { faction: "pale_record", amount: -10 },
            ],
            reply: "You keep the warm stone flowing to Calder's people. The Brotherhood and the Lodge call it betrayal. The cult calls you faithful.",
          },
        ],
      },
    ],
    outro: [
      "Four hands. One seam. Whatever you chose, three of them remember that you didn't choose them.",
      "It's done, and it can't be undone. Go and live with it. We all will.",
    ],
    reward: {
      xp: [
        { skill: "mining", amount: 600 },
        { skill: "edge", amount: 400 },
      ],
      flags: ["act2_complete"],
    },
  },

  // ===========================================================================
  // ACT III
  // ===========================================================================

  {
    id: "q_the_shard_returns",
    name: "The Shard Returns",
    act: 3,
    giver: "serath",
    requiresFlags: ["act2_complete"],
    intro: [
      "The seam's producing warmstone that won't cool. Whatever you decided up here, it woke something below.",
      "There's one left who knows — the Marrow Keeper, last of the Underloft, sealed in the deepest dark. Go down. Reach the door it opened from the inside. Then ask.",
    ],
    steps: [
      { type: "kill", monster: "marrow_wraith", count: 1, text: "Descend past the Marrow Wraith" },
      { type: "kill", monster: "deep_golem", count: 1, text: "Break the Deepstone Golem guarding the vault" },
      { type: "talk", npc: "marrow_keeper", text: "Reach the Marrow Keeper" },
      {
        type: "choice",
        npc: "marrow_keeper",
        text: "Hear the Keeper, or take the shard",
        prompt: "The Keeper offers the watch, and the truth that even he doesn't know what the warmth is. What do you do?",
        options: [
          {
            label: "Listen. Take the watch.",
            flags: ["keeper_blessing", "learned_keeper_uncertainty"],
            reply: "'The watch passes to you for as long as you hold it. Even I cannot tell you if the warmth is a god. Carry the not-knowing honestly.'",
          },
          {
            label: "Just give me the shard.",
            flags: ["keeper_impatient", "took_shard_without_listening"],
            reply: "The Keeper says nothing more. The intact shard is warm in your hand, and the door will not open again behind you.",
          },
        ],
      },
    ],
    outro: [
      "It is yours now — the intact burial shard, the whole question made solid.",
      "The watch passes to you. Take the plate; you'll need it for what's left. The door closes behind you for the last time.",
    ],
    reward: {
      xp: [
        { skill: "vitality", amount: 1000 },
        { skill: "edge", amount: 500 },
      ],
      items: [
        { item: "marrow_keep_plate", qty: 1 },
        { item: "intact_burial_shard", qty: 1 },
      ],
      flags: ["act3_staged", "has_intact_burial_shard"],
    },
  },

  {
    id: "q_the_four_positions",
    name: "The Four Positions",
    act: 3,
    giver: "serath",
    requiresFlags: ["act3_staged"],
    intro: [
      "The rite is possible now, and the Shard is in your hands. Before you decide what it's for, the people who shaped this have each earned the right to say where they stand.",
      "Vorn would destroy it. Sera would keep it sealed and unread. Calder would have you complete the rite. Maret would have you walk away. Hear them — then settle your own belief, honestly, just once.",
    ],
    steps: [
      {
        type: "choice",
        npc: "serath",
        text: "Settle your own belief, once and for all",
        prompt: "After everything — what do you believe the warmth is?",
        options: [
          {
            label: "The warmth is him. A god waits below.",
            flags: ["player_belief_believer", "belief_finalized"],
            reply: "You say it plainly, and it doesn't shake. Belief, then.",
          },
          {
            label: "It's stone. The meaning was always ours.",
            flags: ["player_belief_skeptic", "belief_finalized"],
            reply: "Warm rock and the stories people hang on it. You'll hold that line to the end.",
          },
          {
            label: "Not even the Keeper knew. Nor will I pretend.",
            flags: ["player_belief_agnostic", "belief_keeper_wisdom", "belief_finalized"],
            reply: "The Keeper stood here longer than the kingdom and did not know. You'll carry the not-knowing as he did.",
          },
        ],
      },
    ],
    outro: [
      "Each of them has spoken, and you've answered yourself. That's the hardest part done.",
      "Now only the doing is left. Come back when you're ready to end it.",
    ],
    reward: {
      flags: ["act3_finale_ready"],
    },
  },

  {
    id: "q_the_last_choice",
    name: "The Last Choice",
    act: 3,
    giver: "serath",
    requiresFlags: ["act3_finale_ready"],
    intro: [
      "The Shard is warm in your hand, the way it was the first day in the Knuckle Hills, before you knew what anyone wanted it for.",
      "You know now. And it comes down to four roads — only the ones your story left open. Choose.",
    ],
    steps: [
      {
        type: "choice",
        npc: "serath",
        text: "Make the last choice",
        prompt: "One stone. Four roads. What do you do with the Shard?",
        options: [
          {
            label: "Destroy it. End the question.",
            flags: ["chose_destroy", "endgame_shard_destroyed"],
            reply: "✦ NOTHING LASTS FOREVER ✦  You burn the Shard in the deepest fire. The warmth goes out forever, and the question can never be asked again.",
          },
          {
            label: "Secure it. Keep the question open.",
            flags: ["chose_secure", "endgame_shard_secured"],
            reply: "✦ KEEP THE RECORD ✦  You seal the unread Shard in the Order's inner vault. The mystery is kept, holy by staying unknown.",
          },
          {
            label: "Use it. Perform the rite.",
            flags: ["chose_use", "endgame_shard_used", "the_warmth_answered"],
            reply: "✦ THE WARMTH BENEATH ✦  You speak the rite. The warmth moves down — and something deep answers. It is never named, and never explained.",
          },
          {
            label: "Walk away. Choose what's yours.",
            flags: ["chose_personal", "endgame_shard_walked_away"],
            reply: "✦ A QUIET THING ✦  You set the Shard down and step out of the story, into a smaller, truer life.",
          },
        ],
      },
    ],
    outro: [
      "It's done. Whatever the warmth was, it is yours to have answered — or to have left unanswered, forever.",
      "The story closes here. What you carry out of it is the only thing that was ever really yours.",
    ],
    reward: {
      xp: [
        { skill: "edge", amount: 1000 },
        { skill: "vigour", amount: 1000 },
        { skill: "vitality", amount: 1000 },
      ],
      items: [{ item: "mount_destrier", qty: 1 }],
      flags: ["varath_main_story_complete"],
    },
  },

  // ===========================================================================
  // LANDMARK SIDE-QUESTS — small, self-contained tasks tied to the gazetteer's
  // named places (World Bible §X). Each hangs off an NPC already out in that
  // region; none touch the main line. Offered once that giver's main quest (if
  // any) is done.
  // ===========================================================================

  {
    id: "q_rooks_wolf",
    name: "The Wolf That Isn't",
    giver: "rook",
    intro: [
      "There's a wolf working these hills that doesn't move like a wolf. Old. Lame. Clever as a person.",
      "The shepherds tell it three ways and all of them are wrong. Thin the pack a while and you'll find the truth's plainer than the rumour — and harder.",
      "Put a few of the hill wolves down. The lame one shows itself when the young ones are gone.",
    ],
    steps: [
      { type: "kill", monster: "hill_wolf", count: 5, text: "Thin the hill wolves (0/5)" },
      { type: "talk", npc: "rook", text: "Tell Rook what you found" },
    ],
    outro: [
      "Lame back leg, half its teeth, and it had learned to wait. Not a monster. Just old, and clever, and hungry. That's the worst kind of plain.",
      "You did it clean. Take this — field rations, for the next cold watch.",
    ],
    reward: {
      xp: [{ skill: "vigour", amount: 350 }, { skill: "vitality", amount: 150 }],
      items: [{ item: "battle_ration", qty: 2 }],
    },
  },

  {
    id: "q_charburner_fuel",
    name: "Fuel for the Mound",
    giver: "charburner",
    intro: [
      "The mound's hungry and my back's gone. Turf-capped, slow-burning — it eats wood faster than I can cut it.",
      "Bring me six good ashwood logs and I'll cap a fresh burn. I'll pay you in charcoal — better than coin out here, if you ask the smiths.",
    ],
    steps: [
      { type: "deliver", npc: "charburner", item: "ashwood_log", count: 6, text: "Bring the charburner 6 ashwood logs" },
    ],
    outro: [
      "That'll see the mound through the week. Here — six measures of charcoal, clean-burned. Burns hot and quiet.",
      "Come back when you've news. The wood's gone quiet and I like to know who's still walking it.",
    ],
    reward: {
      xp: [{ skill: "survivalist", amount: 280 }],
      items: [{ item: "charcoal", qty: 6 }],
    },
  },

  {
    id: "q_lenne_trapline",
    name: "Lenne's Trapline",
    giver: "lenne",
    intro: [
      "I'm working the deep wood and my line's gone untended three days. The boar have been at it — fouling the snares, springing them for nothing.",
      "Put a few of them down so the line runs clean again. Mind the understory; they don't give ground.",
    ],
    steps: [
      { type: "kill", monster: "wild_boar", count: 4, text: "Clear the boar from the trapline (0/4)" },
      { type: "talk", npc: "lenne", text: "Report back to Lenne" },
    ],
    outro: [
      "Good. The line'll hold now. One of them had been at the same snare every night — habit, not hunger. Animals have habits, same as us.",
      "Take the meat off them; I've no use for it deep in. Quiet roads to you.",
    ],
    reward: {
      xp: [{ skill: "hunter", amount: 320 }, { skill: "draw", amount: 120 }],
      items: [{ item: "raw_boar_meat", qty: 3 }],
    },
  },

  {
    id: "q_ashfen_witness",
    name: "Witness the Heat",
    giver: "ashfen_tender",
    intro: [
      "You feel it through your boots — warmer the deeper you cut. I won't ask you to help. Only to witness.",
      "Cut eight measures of embercite from the warm seam and bring them up. Not for me. For the doing of it, and what the doing tells you. The discomfort is the point.",
    ],
    steps: [
      { type: "gather", item: "embercite_ore", count: 8, text: "Cut 8 Embercite from the warm seam" },
      { type: "talk", npc: "ashfen_tender", text: "Return to the Cult Tender" },
    ],
    outro: [
      "You felt it, then. Whether the warmth is a god or only the ground, you carry the question out the same as I do. That is the whole of it.",
      "Keep the embercite. And take these — flasks, for whatever you brew with what you've learned.",
    ],
    reward: {
      xp: [{ skill: "smithing", amount: 300 }, { skill: "herblore", amount: 200 }],
      items: [{ item: "glass_flask", qty: 3 }],
    },
  },

  {
    id: "q_marrow_marks",
    name: "The Masons' Marks",
    giver: "marrow_keeper",
    intro: [
      "You came down the long dark and the door let you. While you are here — there are marks on the smooth walls. Tool-dressed stone, older than any living hand.",
      "The crawlers nest thick between here and the dressed stone. Clear them, and look on the marks. Tell me if they carry the spine-shape — the shape on the coins the hills keep giving up.",
    ],
    steps: [
      { type: "kill", monster: "cave_crawler", count: 5, text: "Clear a path to the Smooth Walls (0/5)" },
      { type: "talk", npc: "marrow_keeper", text: "Tell the Keeper what the marks carry" },
    ],
    outro: [
      "The spine-shape. You saw it too. It proves nothing — a mason's habit, a thousand years of the same hand. Or it proves everything. I have stood here long enough not to need the answer.",
      "You walked where few do, and came back. That is worth something. Take it, and go up to the light.",
    ],
    reward: {
      xp: [{ skill: "ward", amount: 400 }, { skill: "vitality", amount: 200 }],
      items: [{ item: "battle_ration", qty: 3 }],
    },
  },

  {
    id: "q_calder_peat",
    name: "What the Bog Kept",
    requires: "q_first_shard",
    giver: "calder",
    intro: [
      "A cutter's spade turned something up in the peat cuttings — something the bog kept whole, longer than the bog's been here.",
      "The lurkers have the cuttings now and the cutters won't go back. Make it safe to work. Then we'll see what the moor gave up, and whether it's ours to name.",
    ],
    steps: [
      { type: "kill", monster: "marsh_lurker", count: 4, text: "Make the peat cuttings safe (0/4)" },
      { type: "talk", npc: "calder", text: "Return to Calder at the moor's edge" },
    ],
    outro: [
      "The cutters can work again. As for what the spade turned up — we covered it back over. Some things the bog kept for a reason, and naming them isn't always a kindness.",
      "You did right by the moor's-edge fire. There's always a meal here for you. Go warm.",
    ],
    reward: {
      xp: [{ skill: "vitality", amount: 350 }, { skill: "ward", amount: 150 }],
      items: [{ item: "battle_ration", qty: 2 }],
    },
  },

  // ===========================================================================
  // THE HEARTMOOR — a faction line for the one power with no rank quests.
  // Opens once you've met Calder (the main story's first shard). Choices set
  // the hm_* flags + Heartmoor reputation; rejecting the faith ends the line.
  // ===========================================================================

  {
    id: "q_hm_welcome",
    name: "The Warmth's Welcome",
    giver: "calder",
    requiresFlags: ["met_calder"],
    intro: [
      "You keep turning up at the moor's edge. The road notices that. I notice that.",
      "If you want to understand the warm stone instead of just selling it, come and feel where it comes from. Cut some embercite from the Ashfen seam — work it with your own hands — and bring it back to my fire.",
    ],
    steps: [
      { type: "gather", item: "embercite_ore", count: 5, text: "Cut 5 Embercite from the warm Ashfen seam" },
      {
        type: "choice",
        npc: "calder",
        text: "Tell Calder what the warmth is to you",
        prompt: "You've felt the heat that isn't the sun's. What is the Heartmoor to you?",
        options: [
          {
            label: "Swear to the warmth. I'll keep its fires.",
            flags: ["hm_joined", "hm_committed", "hm_welcome_done"],
            rep: [{ faction: "heartmoor_cult", amount: 20 }],
            reply: "Calder presses a warm black stone into your palm. 'Then you're one of us, in the way that matters. Welcome to the fire.'",
          },
          {
            label: "I'll witness, but swear to nothing.",
            flags: ["hm_joined", "hm_welcome_done"],
            rep: [{ faction: "heartmoor_cult", amount: 8 }],
            reply: "Calder nods slowly. 'Witness is enough. The faith was never about the swearing. Stay near the fire as long as you like.'",
          },
          {
            label: "It's warm rock. Nothing more.",
            flags: ["hm_rejected", "hm_welcome_done"],
            rep: [{ faction: "heartmoor_cult", amount: -4 }],
            reply: "Calder doesn't argue. 'Maybe so. The meal's still here when the road gives out on you. It always is.'",
          },
        ],
      },
    ],
    outro: [
      "Go careful past the pools. The moor keeps what it takes — and it's begun to keep more than it used to.",
    ],
    reward: {
      xp: [{ skill: "mining", amount: 220 }],
      gold: 200,
    },
  },

  {
    id: "q_hm_seam",
    name: "Tend the Seam",
    giver: "ashfen_tender",
    requiresFlags: ["hm_joined"],
    intro: [
      "Calder sent word you'd come. Good — the warm seam needs hands it can trust, and the moor has turned mean.",
      "The lurkers have crept up from the pools to the warm ground, and they foul the cuttings. Put them down, then bring up embercite to bank the fire. Witness the heat while you work. The discomfort is the point.",
    ],
    steps: [
      { type: "kill", monster: "marsh_lurker", count: 4, text: "Drive the lurkers off the warm ground (0/4)" },
      { type: "gather", item: "embercite_ore", count: 6, text: "Bank the fire with 6 Embercite" },
      {
        type: "choice",
        npc: "ashfen_tender",
        text: "Settle the matter of the doubting acolyte",
        prompt: "A young acolyte wants to leave the seam — the heat frightens her. What do you counsel?",
        options: [
          {
            label: "Let her go. Faith forced isn't faith.",
            flags: ["hm_seam_done", "hm_mercy"],
            rep: [{ faction: "heartmoor_cult", amount: 10 }],
            reply: "The Tender watches her walk back toward the road. 'You'd have made a poor zealot and a fine priest. The warmth keeps who it keeps.'",
          },
          {
            label: "Persuade her to stay and witness.",
            flags: ["hm_seam_done", "hm_zealous"],
            rep: [{ faction: "heartmoor_cult", amount: 15 }],
            reply: "She stays, white-knuckled, by the seam. The Tender is pleased. 'One more pair of eyes on the heat. That is how a faith outlasts a winter.'",
          },
        ],
      },
    ],
    outro: [
      "The seam runs clean again, and the fire's banked deep. Take this — the Heartmoor looks after its own.",
    ],
    reward: {
      xp: [{ skill: "mining", amount: 280 }, { skill: "vitality", amount: 150 }],
      items: [{ item: "cult_offering", qty: 1 }],
      flags: ["hm_rank_tender"],
      rep: [{ faction: "heartmoor_cult", amount: 12 }],
      gold: 350,
    },
  },

  {
    id: "q_hm_devotion",
    name: "What the Warmth Asks",
    giver: "calder",
    requiresFlags: ["hm_seam_done"],
    intro: [
      "You've tended the seam and you're still here. The Heartmoor's ready to ask something harder of you.",
      "A bog knight stands its old watch at the Barrow, and it will not let the faithful pass to the warm deep below. Put it down — prove the warmth is worth a hard thing — then come back, and we'll talk about what the Heartmoor becomes next.",
    ],
    steps: [
      { type: "kill", monster: "bog_knight", count: 1, text: "Break the Bog Barrow's old watch (0/1)" },
      {
        type: "choice",
        npc: "calder",
        text: "Counsel the Heartmoor's path",
        prompt: "The faith could carry its fires up the road, into the towns. Should it?",
        options: [
          {
            label: "Carry the warmth to the road. Let it grow.",
            flags: ["hm_devotion_done", "hm_expansionist"],
            rep: [{ faction: "heartmoor_cult", amount: 18 }],
            reply: "Calder's eyes catch the firelight. 'Then we go where the cold is worst. The road will be warmer for it — or it will fear us. Both are a kind of faith.'",
          },
          {
            label: "Keep to the moor. A quiet fire lasts longest.",
            flags: ["hm_devotion_done", "hm_quietist"],
            rep: [{ faction: "heartmoor_cult", amount: 18 }],
            reply: "Calder nods, something easing in him. 'A quiet fire it is. Let Ironvale keep its walls. We'll keep the meal and the warmth, and that will be enough.'",
          },
        ],
      },
    ],
    outro: [
      "Whatever the Heartmoor becomes, you helped decide it. That's not a small thing — most never get the choosing.",
      "You're faithful now, in the way that matters. The fire's yours as much as mine.",
    ],
    reward: {
      xp: [{ skill: "vitality", amount: 400 }, { skill: "ward", amount: 200 }],
      items: [{ item: "ring_3", qty: 1 }],
      flags: ["hm_faithful", "hm_devotion_done"],
      rep: [{ faction: "heartmoor_cult", amount: 20 }],
      gold: 600,
    },
  },

  // ===========================================================================
  // SIDE QUESTS — Skyrim-style: a hook, a journey, and a choice that sticks.
  // Given by the folk of Ironvale and the road, on the sq_* flags.
  // ===========================================================================

  {
    id: "q_sq_roost",
    name: "The Crown of the Roost",
    giver: "town_guard",
    intro: [
      "Off the record, since the watch won't march that far: there's a camp out west the road-gangs answer to. The Brigand's Roost. A captain holds it, and he's never been taken.",
      "Thin out his cutthroats, then take the captain himself. Do that and Ironvale sleeps a little easier — and I'll see you're paid out of the watch's own purse.",
    ],
    steps: [
      { type: "kill", monster: "cutthroat", count: 3, text: "Thin the Roost's cutthroats (0/3)" },
      { type: "kill", monster: "outlaw_captain", count: 1, text: "Take the Outlaw Captain (0/1)" },
      {
        type: "choice",
        npc: "town_guard",
        text: "Report how the Roost fell",
        prompt: "The captain's strongbox is yours to account for. What do you tell the watch?",
        options: [
          {
            label: "Turn it all in. Let the watch ledger it.",
            flags: ["sq_roost_done", "sq_roost_lawful"],
            gold: 800,
            reply: "The guard counts it twice and pays you the bounty straight. 'Honest hands. Ironvale could use more of you.'",
          },
          {
            label: "Keep the captain's gear. Report the rest.",
            flags: ["sq_roost_done", "sq_roost_loot"],
            gold: 250,
            reply: "He eyes the blade on your hip and says nothing about it. 'Spoils of a hard job. We'll call the bounty light, then.'",
          },
          {
            label: "Say you found the camp already empty.",
            flags: ["sq_roost_done", "sq_roost_mercy"],
            gold: 100,
            reply: "He frowns. 'Empty. Right.' The survivors you waved off the back of the camp are someone else's problem now — or someone else's mercy.",
          },
        ],
      },
    ],
    outro: [
      "The Roost's quiet for the first time in years. Won't last — these things never do — but a quiet season is worth something. You earned the thanks of a city, whether it ever learns your name.",
    ],
    reward: {
      xp: [{ skill: "vigour", amount: 300 }, { skill: "vitality", amount: 150 }],
      items: [{ item: "sword_4", qty: 1 }],
    },
  },

  // ===========================================================================
  // THE BONE COLLECTOR — a short, grim hunt the watch won't put on the ledger.
  // Offered by the Off-Duty Guard once you've taken the Roost (sq_roost_done).
  // A choice with Lenne reveals the Boneman's lair (boneman_revealed), which
  // un-hides the mid-tier boss in the old wood — the only source of the
  // Bonewrought set and the Bonesaw.
  // ===========================================================================
  {
    id: "q_boneman",
    name: "The Bone Collector",
    giver: "town_guard",
    requiresFlags: ["sq_roost_done"],
    intro: [
      "You took the Roost, so I'll trust you with the one that keeps me up at night. This doesn't go in the ledger — the watch pretends it isn't happening.",
      "Years now, people go missing off the quiet roads. We find them later, if we find them — and never the bones. He takes the bones. Wears them, they say. Folk call him the Boneman, and call it a story so they can sleep.",
      "It's no story. He keeps to the deep wood west of here, where even the Lodge won't mark the maps. Find Lenne the tracker — she watches that treeline. If anyone knows where his cairns are, it's her.",
    ],
    steps: [
      {
        type: "choice",
        npc: "lenne",
        text: "Find Lenne the tracker in the Greyoak wood",
        prompt: "Lenne has tracked the bone-cairns to a hollow in the old growth. 'I'll take you to the edge of it. How do you mean to do this?'",
        options: [
          {
            label: "Straight in. Before he moves the cairns again.",
            flags: ["boneman_revealed", "boneman_hunt_direct"],
            reply: "Lenne leads you to the treeline and points. 'The Bonefield's through there. I go no further — that's a place for one set of footprints, and they shouldn't be mine. Make them yours.'",
          },
          {
            label: "Quietly. Read his ground first, then strike.",
            flags: ["boneman_revealed", "boneman_hunt_careful"],
            reply: "Lenne nods, approving. 'A tracker's answer. I'll show you the trail in. Read the cairns, learn how he moves — then end him on your terms. The Bonefield's waiting.'",
          },
        ],
      },
      { type: "kill", monster: "boneman", count: 1, text: "Put the Boneman down in the Bonefield (0/1)" },
      { type: "talk", npc: "town_guard", text: "Bring the Off-Duty Guard the grim news" },
    ],
    outro: [
      "Dead, then. After all these years. You'll forgive me if I don't celebrate a thing like that — but the roads are safer tonight than they've been in a long while.",
      "Keep what you took off him. The watch wants no part of it — but a person who'll do the job nobody ledgers has earned the spoils nobody else will touch. He won't stay down for long; his kind never do. Come back to the Bonefield whenever you've the stomach for it.",
    ],
    reward: {
      xp: [
        { skill: "edge", amount: 650 },
        { skill: "ward", amount: 350 },
        { skill: "vitality", amount: 350 },
      ],
      items: [{ item: "marrow_shard", qty: 2 }],
      gold: 600,
      flags: ["q_boneman_complete"],
    },
  },

  {
    id: "q_sq_courier",
    name: "The Overdue Rider",
    giver: "town_courier",
    intro: [
      "One of ours didn't come in. Young rider, the Greyoak run — the road's been thick with footpads and worse this season.",
      "I can't leave the dispatch desk to go looking. You can. Put down the bandits working that stretch, and if you turn up the satchel… well. Bring me word, at least.",
    ],
    steps: [
      { type: "kill", monster: "bandit", count: 4, text: "Clear the bandits off the Greyoak road (0/4)" },
      {
        type: "choice",
        npc: "town_courier",
        text: "Tell the Courier what you found",
        prompt: "You found the rider's satchel in the brush — and the rider, long past help. What do you carry back?",
        options: [
          {
            label: "Bring back the satchel and the truth.",
            flags: ["sq_courier_done", "sq_courier_truth"],
            gold: 400,
            reply: "The Courier closes their eyes a moment. 'I'll write the family. Thank you for not making me wonder.' They press the bounty into your hand.",
          },
          {
            label: "Say the rider may yet turn up. Spare them.",
            flags: ["sq_courier_done", "sq_courier_kind"],
            gold: 250,
            reply: "'Maybe,' the Courier says, wanting to believe it. 'Maybe they're holed up somewhere.' You let them keep the maybe. It's a kind of mercy, and a kind of lie.",
          },
        ],
      },
    ],
    outro: [
      "The road's a little safer for the next rider. That's the whole job, in the end — making the road safe for the next one. Ride easy.",
    ],
    reward: {
      xp: [{ skill: "edge", amount: 220 }, { skill: "vigour", amount: 120 }],
      items: [{ item: "arrow_ashiron", qty: 30 }],
      gold: 150,
    },
  },

  {
    id: "q_sq_redriver",
    name: "The River Runs Red",
    giver: "town_fishwife",
    intro: [
      "You'll think me a fool, but hear it: the Redrun's running redder than it ought, and my man won't say it's nothing anymore. He just doesn't smile.",
      "Go down to the river. Whatever's in the water — the serpents, or something fouler upstream — see it with your own eyes, and come tell me straight. I'd rather a hard truth than a soft lie.",
    ],
    steps: [
      { type: "kill", monster: "river_serpent", count: 2, text: "Face whatever moves in the Redrun (0/2)" },
      {
        type: "choice",
        npc: "town_fishwife",
        text: "Tell the Fishwife what reddens the river",
        prompt: "It's bloodore — the red metal washing down from the cut hills, not blood at all. What do you tell her?",
        options: [
          {
            label: "The truth: it's only ore in the water.",
            flags: ["sq_redriver_done", "sq_redriver_truth"],
            gold: 300,
            reply: "She lets out a breath she's held for weeks. 'Ore. Just ore.' She'll sleep tonight, and her man will smile again. 'Bless you for the plainness of it.'",
          },
          {
            label: "Tell her it's the serpents. Let the rest lie.",
            flags: ["sq_redriver_done", "sq_redriver_lie"],
            gold: 300,
            reply: "'The serpents,' she repeats, comforted by a danger with a shape. You leave the deeper strangeness of the red water unsaid. Some comforts are worth more than the truth.",
          },
        ],
      },
    ],
    outro: [
      "Whatever you told me, you went and looked, and that's more than the watch would. Take some of the catch — fresh enough, I swear it.",
    ],
    reward: {
      xp: [{ skill: "fishing", amount: 200 }],
      items: [{ item: "redrun_chowder", qty: 2 }],
    },
  },

  {
    id: "q_sq_drunk",
    name: "A Secret for a Coin",
    giver: "town_drunk",
    intro: [
      "Friend! You've an honest face and — let me see — an honest purse. I'll trade you a secret for it. A real one.",
      "Two of those old worn coins the rats dig up, that's all. Buy a man a drink and a man remembers things. Useful things. Where things are buried, say.",
    ],
    steps: [
      { type: "deliver", npc: "town_drunk", item: "worn_coin", count: 2, text: "Bring the drunk 2 worn coins for his drink" },
      {
        type: "choice",
        npc: "town_drunk",
        text: "Hear the drunk's secret",
        prompt: "He leans in: 'A cache, under the old Gallows Oak. I marked it. Do you believe a drunk?'",
        options: [
          {
            label: "I believe you. (Take the tip.)",
            flags: ["sq_drunk_done", "sq_drunk_believed"],
            reply: "He grins, gap-toothed. 'Knew it. Honest face. It's there — I'd swear it on the moon, and she's watching, so I'd better mean it.' He sketches you the spot.",
          },
          {
            label: "Humour him and pocket the wisdom anyway.",
            flags: ["sq_drunk_done"],
            reply: "'Suit yourself,' he says, happy with his drink money. 'But check under the Oak. For me. For science.' He taps his nose and topples off the bench.",
          },
        ],
      },
    ],
    outro: [
      "There really was something under the Oak — the drunk earned his drink. The moon watches, he said. You find you can't quite laugh it off.",
    ],
    reward: {
      xp: [{ skill: "agility", amount: 120 }],
      items: [{ item: "cut_gem", qty: 1 }],
      gold: 500,
    },
  },

  {
    id: "q_sq_greyoak",
    name: "The Treeline's Retreat",
    giver: "lenne",
    intro: [
      "Stand still a moment. There — the old growth's pulled back another pace since last season. We mark it, and we don't ask what walks in the cleared ground.",
      "The bears have come down into the new gap, bolder than they should be. Thin them, and bring me greyoak from the old treeline so I can read the rings. Then help me decide what the Lodge does with what we learn.",
    ],
    steps: [
      { type: "kill", monster: "forest_bear", count: 2, text: "Thin the bears in the cleared ground (0/2)" },
      { type: "gather", item: "greyoak_log", count: 3, text: "Cut 3 Greyoak from the old treeline" },
      {
        type: "choice",
        npc: "lenne",
        text: "Decide what the Lodge is told",
        prompt: "The wood is retreating faster than the records admit. What do we do with that?",
        options: [
          {
            label: "Report it. The Lodge must know the truth.",
            flags: ["sq_greyoak_done", "sq_greyoak_reported"],
            rep: [{ faction: "lodge", amount: 12 }],
            reply: "Lenne marks the rings and seals the count. 'Maret won't thank us for the worry. But a warden who hides the treeline isn't a warden. Well done.'",
          },
          {
            label: "Keep watching with Lenne. Don't raise alarm yet.",
            flags: ["sq_greyoak_done", "sq_greyoak_watch"],
            rep: [{ faction: "lodge", amount: 6 }],
            reply: "Lenne nods, quiet. 'We watch, then. Just us, and the treeline, and whatever's pulling it back. Tell no one until we're sure. Some truths spook worse than they help.'",
          },
        ],
      },
    ],
    outro: [
      "The wood gives a little more each year, and we mark it, and we keep the road behind us safe. That's the work. You've a tracker's patience — the Lodge could use you.",
    ],
    reward: {
      xp: [{ skill: "forestry", amount: 250 }, { skill: "woodcraft", amount: 150 }],
      items: [{ item: "greyoak_log", qty: 5 }],
      gold: 250,
    },
  },

  // ===========================================================================
  // THE SKRITT CONTRABAND LINE — a goblin fence's three jobs. Reachable now that
  // a shopkeeper can be TALKED to (the Talk option), not just traded with. No
  // faction; pays in coin. Cutting Skritt out (sk_freelance) sours the finale.
  // ===========================================================================

  {
    id: "q_skritt_smalltime",
    name: "Small-Time",
    giver: "shop_trader",
    intro: [
      "Pssst. You've a careful look — Skritt likes careful. Skritt has work that pays better than honest and asks fewer questions.",
      "Rough stones. The outlaws sit on them, the hills hide them. Bring Skritt three uncut gems and we see what kind of runner you are.",
    ],
    steps: [
      { type: "gather", item: "rough_gem", count: 3, text: "Get 3 rough gems (outlaws carry them; so do the deep rocks)" },
      { type: "deliver", npc: "shop_trader", item: "rough_gem", count: 3, text: "Bring the stones to Skritt" },
      {
        type: "choice",
        npc: "shop_trader",
        text: "Tell Skritt what kind of runner you are",
        prompt: "Skritt weighs the stones, and weighs you. 'So. What is Skritt buying, with you?'",
        options: [
          {
            label: "Discreet. I don't ask questions.",
            flags: ["sk_smalltime_done", "met_skritt", "sk_discreet"],
            gold: 350,
            reply: "Skritt's grin widens. 'Discreet. Good word. Expensive word. Here — discreet money for a discreet face.'",
          },
          {
            label: "Greedy. I want the bigger cut.",
            flags: ["sk_smalltime_done", "met_skritt", "sk_greedy"],
            gold: 450,
            reply: "Skritt pays it, slow, eyeing you. 'Greedy is fine. Greedy Skritt understands. Greedy Skritt also watches. Take your coin.'",
          },
          {
            label: "Honest. This is the last shady thing I do.",
            flags: ["sk_smalltime_done", "met_skritt", "sk_reluctant"],
            gold: 250,
            reply: "Skritt cackles. 'The last one. They all say the last one. The coin spends the same either way, honest friend. Off you go.'",
          },
        ],
      },
    ],
    outro: [
      "Come back when your conscience is quiet and your pockets are empty. Skritt always has work.",
    ],
    reward: {
      xp: [{ skill: "crafting", amount: 180 }],
    },
  },

  {
    id: "q_skritt_runner",
    name: "The Quiet Road",
    giver: "shop_trader",
    requiresFlags: ["sk_smalltime_done"],
    intro: [
      "A shipment of Skritt's went out and didn't come in. The cutthroats at the Roost took it — bold, even for them.",
      "Go take it back. Put down enough of them that the rest learn the lesson. Then bring word, and we'll talk about where the goods go.",
    ],
    steps: [
      { type: "kill", monster: "cutthroat", count: 4, text: "Take back the shipment from the cutthroats (0/4)" },
      {
        type: "choice",
        npc: "shop_trader",
        text: "Settle what happens to the recovered shipment",
        prompt: "The shipment's yours to account for, and the Ironvale watch checks the gates. What do you do with it?",
        options: [
          {
            label: "Run it past the watch for Skritt.",
            flags: ["sk_runner_done", "sk_smuggler"],
            gold: 500,
            reply: "Skritt's eyes shine. 'Past the watch and into Skritt's hands, clean as a whistle. You're a runner now, friend. A real one.'",
          },
          {
            label: "Hold out for double — it's risky work.",
            flags: ["sk_runner_done", "sk_hardball"],
            gold: 850,
            reply: "Skritt pays, but the warmth's gone from the grin. 'Double. Fine. Skritt remembers double. Skritt remembers everything, friend.'",
          },
          {
            label: "Keep the shipment. Sell it myself.",
            flags: ["sk_runner_done", "sk_freelance"],
            gold: 600,
            reply: "Skritt's face shutters. 'Cut Skritt out of Skritt's own goods. Bold. Stupid-bold.' He pockets nothing, and forgets nothing. The road just got lonelier.",
          },
        ],
      },
    ],
    outro: [
      "The Roost will think twice before touching a Skritt shipment again. Whether they touch a Skritt partner — that's still being decided.",
    ],
    reward: {
      xp: [{ skill: "edge", amount: 220 }, { skill: "vigour", amount: 120 }],
      items: [{ item: "arrow_ashiron", qty: 40 }],
      gold: 150,
    },
  },

  {
    id: "q_skritt_partner",
    name: "Goblin's Trust",
    giver: "shop_trader",
    requiresFlags: ["sk_runner_done"],
    blockedByFlags: ["sk_freelance"],
    intro: [
      "Skritt has watched you run, and Skritt has decided. There's a partnership in it, if you want one — a whole quiet network, gates and roads and the warm stone too.",
      "One last test. A rival fence runs highwaymen on the east road. Take two of them down — take their stones — and bring the prize to Skritt. Then we decide what you become.",
    ],
    steps: [
      { type: "kill", monster: "highwayman", count: 2, text: "Rob the rival fence's highwaymen (0/2)" },
      {
        type: "choice",
        npc: "shop_trader",
        text: "Decide the fate of Skritt's network",
        prompt: "The whole quiet trade is on the table now. What do you make of it?",
        options: [
          {
            label: "Partner up. Run the network together.",
            flags: ["sk_network_done", "sk_partner"],
            gold: 800,
            reply: "Skritt clasps your wrist, goblin-style, hard. 'Partners. Skritt and the careful one. The gates will never sleep easy again, and Skritt will never be alone at a counter again. Good.'",
          },
          {
            label: "Take the network for yourself.",
            flags: ["sk_network_done", "sk_boss"],
            gold: 1300,
            reply: "You lay out exactly how much you know, and exactly who you could tell. Skritt goes very still. 'So. The runner runs the run now.' He smiles like a closing door. 'Skritt works for you. For now.'",
          },
          {
            label: "Walk the whole thing to the watch.",
            flags: ["sk_network_done", "sk_busted"],
            gold: 500,
            reply: "The watch pays informants in clean coin and no thanks. By the time you've told it, Skritt's cart is gone from the trade row, and the row is a little duller, and a little more honest, for the loss.",
          },
        ],
      },
    ],
    outro: [
      "Whatever the quiet trade becomes — partner, master, or memory — you decided it. Few get to decide a whole hidden world. Spend the coin while it's warm.",
    ],
    reward: {
      xp: [{ skill: "crafting", amount: 300 }, { skill: "agility", amount: 150 }],
      items: [{ item: "cut_gem", qty: 2 }],
      gold: 400,
    },
  },

  // ===========================================================================
  // HEARTH & HOME — the introduction to player-owned housing
  // ===========================================================================
  {
    id: "q_roof_of_your_own",
    name: "A Roof of Your Own",
    giver: "drover_tamsin",
    intro: [
      "You've the look of someone tired of sleeping under hedgerows. Sit. As reeve here I keep the rolls — and the lot east of the yard has stood empty a year.",
      "It's yours, if you'll have it. Find the plot marker on it and claim it; the cottage comes with the ground, and its door opens onto your own four walls to do with as you please.",
      "A bed comes first of all. Fell an ashwood and mill the logs to planks at any builder's bench — there's one in Ironvale's artisans' yard — then build the bed inside. After that, a home is only as bare as you leave it.",
    ],
    steps: [
      { type: "claim", text: "Claim the empty homestead lot east of the Rest" },
      { type: "build", category: "bed", text: "Mill Ashwood Planks at a bench, then build a bed inside your home" },
      { type: "talk", npc: "drover_tamsin", text: "Tell Tamsin you've settled in" },
    ],
    outro: [
      "Settled, then. There's no sound in the world like your own door shutting behind you — you'll learn it.",
      "Here — a housewarming. Timber, stone and fittings enough to make a kitchen of the hearth-space, a strongbox of the corner, a workbench against the wall. Cook, bank and build under your own roof now, not the town's.",
      "Raise it however suits you. And mind — sleep in your own bed, and the road will always carry you home to it.",
    ],
    reward: {
      xp: [{ skill: "construction", amount: 250 }],
      items: [
        { item: "plank_greyoak", qty: 6 },
        { item: "plank_stonewood", qty: 6 },
        { item: "timber_frame", qty: 4 },
        { item: "mortar_basic", qty: 4 },
        { item: "stone_block", qty: 6 },
        { item: "ashiron_rivet", qty: 4 },
      ],
      gold: 120,
      flags: ["q_roof_of_your_own_complete", "homesteader"],
    },
  },
  {
    id: "q_drowned_pier",
    name: "The Drowned Pier",
    giver: "pier_warden",
    intro: [
      "You've a fisher's patience about you — good. The deck's nearly re-laid, but I'll not send a stranger out over the deep on my say-so alone.",
      "Land me eight ashfin from the estuary shallows. Show me your hands know a rod, and the end of the pier is yours. The deep water keeps the big ones.",
    ],
    steps: [
      { type: "deliver", npc: "pier_warden", item: "ashfin_raw", count: 8, text: "Bring Jacob 8 raw ashfin" },
      { type: "talk", npc: "pier_warden", text: "Return to Jacob at the pier" },
    ],
    outro: [
      "Eight clean ashfin — and you didn't snap a line bringing them. The deck'll hold for you.",
      "The end of the pier is open. Cast into the deep, ease off when she runs, and haul when she tires. Every great catch goes up on the board — make them remember your name.",
    ],
    reward: {
      xp: [{ skill: "fishing", amount: 750 }],
      gold: 150,
      flags: ["pier_access"],
    },
  },

  // ===========================================================================
  // REGIONAL MID-GAME CONTRACTS — the outer settlements' own folk finally have
  // work to give. Each is a self-contained side-quest that sends you out to see
  // a place with your own eyes (the "visit" objective), thin what's grown too
  // bold there, and decide what to carry back. Level ~28–48; no faction ties.
  // ===========================================================================

  {
    id: "q_frostgate_streams",
    name: "The Cold Streams",
    giver: "npc_frostgate_trader",
    intro: [
      "Another porter didn't come down the pass last night. Third this season. Either the wolves have got bold, or something higher up is driving them onto the road.",
      "I keep the gate; I can't go and look. You can. Climb to the Cold Streams where the melt runs — see the ground with your own eyes — then thin the ridge pack working that stretch. Come back and tell me straight what's up there.",
    ],
    steps: [
      { type: "visit", x: 57, y: 14, text: "Climb to the Cold Streams, high on the pass" },
      { type: "kill", monster: "ridge_wolf", count: 5, text: "Thin the ridge pack (0/5)" },
      {
        type: "choice",
        npc: "npc_frostgate_trader",
        text: "Tell Hesk what the pass keeps",
        prompt: "You found a porter's pack in the snow — and no porter. What do you carry back to the gate?",
        options: [
          {
            label: "The truth. Show him the pack.",
            flags: ["frostgate_streams_done", "frostgate_truth"],
            gold: 400,
            reply: "Hesk turns the pack over once and sets it down gently. 'I'll send word to his people. Better a hard truth than a family that waits at a window. Thank you.'",
          },
          {
            label: "Say the pass runs clear now.",
            flags: ["frostgate_streams_done", "frostgate_kind"],
            gold: 300,
            reply: "'Clear,' Hesk repeats, wanting it. 'Then the next porter comes down whole.' You keep the pack, and the knowing, to yourself. Some kindnesses cost the truth.",
          },
        ],
      },
    ],
    outro: [
      "The road's safer up high for a while, and I know more than I did. That's the whole of the warden's job — knowing what walks the pass before it walks down onto the road.",
    ],
    reward: {
      xp: [{ skill: "survivalist", amount: 420 }, { skill: "vigour", amount: 260 }],
      items: [{ item: "warriors_draught", qty: 2 }],
      gold: 150,
    },
  },

  {
    id: "q_deeplight_blackwater",
    name: "Lights in the Deep",
    giver: "npc_deeplight_trader",
    intro: [
      "Lamps keep going out in the far cut. Not guttering down — going out, all at once, like the dark itself takes a breath and blows them. My delvers won't work past the Black Water anymore.",
      "You've a steady hand and steadier nerve. Go down to the Black Water, clear the crawlers nesting in the deep cut, and bring me up a couple of rough gems from the seams no one dares work. Prove the dark's just dark, and I'll pay you well for the proving.",
    ],
    steps: [
      { type: "visit", x: 125, y: 28, text: "Descend to the Black Water in the far cut" },
      { type: "kill", monster: "stone_crawler", count: 4, text: "Clear the crawlers from the deep cut (0/4)" },
      { type: "gather", item: "rough_gem", count: 2, text: "Win 2 rough gems from the deep seams" },
    ],
    outro: [
      "Two clean stones and the crawlers thinned — and you'll notice you came back up with your lamp still lit. So it's just bad air and worse rumour after all. Mostly. Probably.",
      "Here's your pay, and a flask on top. My delvers will work the far cut again knowing someone walked it and came out. That's worth more than the gems.",
    ],
    reward: {
      xp: [{ skill: "mining", amount: 480 }, { skill: "crafting", amount: 220 }],
      items: [{ item: "cut_gem", qty: 1 }, { item: "glass_flask", qty: 2 }],
      gold: 350,
    },
  },

  {
    id: "q_mirehold_sunkenline",
    name: "The Sunken Line",
    giver: "npc_mirehold_trader",
    intro: [
      "My cutting line's gone bad. The lurkers have crept up out of the deep pools onto the good peat, and a cutter won't set spade to ground a lurker's claimed. Can't say I blame him.",
      "Walk the line first — the Peat Cuttings, down by the pools — see how far up they've come. Then drive enough of them back that the ground runs clean again. Do that and I'll pay you in more than peat.",
    ],
    steps: [
      { type: "visit", x: 13, y: 146, text: "Walk Tam's line, down at the Peat Cuttings" },
      { type: "kill", monster: "marsh_lurker", count: 5, text: "Drive the lurkers back to the pools (0/5)" },
      {
        type: "choice",
        npc: "npc_mirehold_trader",
        text: "Tell Tam what the spade turned up",
        prompt: "Cutting clean ground, your spade struck something the bog kept whole — an old blade, black with age, no rust on it at all. What do you do with it?",
        options: [
          {
            label: "Give it to Tam. It's his ground.",
            flags: ["mirehold_line_done", "mirehold_gave_blade"],
            gold: 300,
            reply: "Tam holds it a long moment. 'No rust. A hundred years in the wet and no rust.' He wraps it in oilcloth. 'The bog gives things back when it's ready. I'll keep it ready. Take your pay, and my thanks.'",
          },
          {
            label: "Keep it. The bog gave it to your hand.",
            flags: ["mirehold_line_done", "mirehold_kept_blade"],
            gold: 200,
            reply: "Tam watches you pocket it and doesn't argue. 'Aye, your spade, your find. Mind how you carry a thing the bog kept — it kept it for a reason, and reasons in the moor are seldom kind.'",
          },
        ],
      },
    ],
    outro: [
      "The line runs clean and the cutters will work it again. The moor gives up peat, and swords, and older things — and you took the measure of all three today without flinching. That's rare out here.",
    ],
    reward: {
      xp: [{ skill: "vitality", amount: 520 }, { skill: "survivalist", amount: 300 }],
      items: [{ item: "redrun_chowder", qty: 2 }, { item: "bone_broth", qty: 1 }],
      gold: 300,
    },
  },
];

// ---------------------------------------------------------------------------
// Quest-log grouping. Tagged here in one place (rather than on every quest) so
// the Quests tab can split Main Story / Faction / Side. The shard-and-warmth
// spine everyone walks is "main"; the four guild + Heartmoor rank lines are
// "faction"; everything else defaults to "side".
// ---------------------------------------------------------------------------
const MAIN_QUESTS = new Set<string>([
  "q_ash_and_knuckle", "q_first_shard", "q_worn_coin",
  "q_seam_question", "q_the_shard_returns", "q_the_four_positions", "q_the_last_choice",
]);
const FACTION_QUESTS = new Set<string>([
  // Ashforge Brotherhood
  "q_hammer_and_name", "q_forge_apprentice", "q_berric_question",
  // Warden's Lodge
  "q_white_in_the_trees", "q_lodge_trial",
  // The Pale Record
  "q_pale_record_open",
  // The Heartmoor
  "q_hm_welcome", "q_hm_seam", "q_hm_devotion",
]);
for (const q of quests) {
  q.type = MAIN_QUESTS.has(q.id) ? "main" : FACTION_QUESTS.has(q.id) ? "faction" : "side";
}
