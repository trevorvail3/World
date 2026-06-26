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
      { type: "gather", item: "shard_of_orun", count: 1, text: "Cut a Shard of Orun from a warm seam in the Knuckle Hills (or take one off the slain)" },
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
      { type: "gather", item: "worn_coin", count: 3, text: "Gather 3 more worn coins from the moor rats" },
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
      items: [{ item: "order_cipher_key", qty: 1 }],
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
      items: [{ item: "apprentice_mark_blade", qty: 1 }],
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
      items: [{ item: "warden_longbow", qty: 1 }],
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
];
