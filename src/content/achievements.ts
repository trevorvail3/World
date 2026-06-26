/**
 * src/content/achievements.ts
 * ---------------------------
 * Milestones the player can unlock, grouped by category. Pure DATA (RULE 3).
 * Each is a condition checked against the player's state; once met it stays
 * unlocked (the core remembers it). Modelled on the idle game's achievements.
 */

import type { AchievementDef } from "../core/types.ts";

export const achievements: AchievementDef[] = [
  // --- Skills ---
  { id: "ach_first_steps", name: "First Steps", desc: "Reach level 10 in any skill.", icon: "🌱", category: "Skills", cond: { type: "anySkillLevel", level: 10 } },
  { id: "ach_journeyman", name: "Journeyman", desc: "Reach level 30 in any skill.", icon: "🛠️", category: "Skills", cond: { type: "anySkillLevel", level: 30 } },
  { id: "ach_master", name: "Master of a Craft", desc: "Reach level 50 in any skill.", icon: "📘", category: "Skills", cond: { type: "anySkillLevel", level: 50 } },
  { id: "ach_renaissance", name: "Renaissance", desc: "Reach a total level of 200.", icon: "🎓", category: "Skills", cond: { type: "totalLevel", total: 200 } },
  { id: "ach_polymath", name: "Polymath", desc: "Reach a total level of 500.", icon: "🏛️", category: "Skills", cond: { type: "totalLevel", total: 500 } },

  // --- Combat ---
  { id: "ach_blooded", name: "Blooded", desc: "Slay 10 monsters.", icon: "🗡️", category: "Combat", cond: { type: "monstersSlain", count: 10 } },
  { id: "ach_veteran", name: "Veteran", desc: "Slay 100 monsters.", icon: "⚔️", category: "Combat", cond: { type: "monstersSlain", count: 100 } },
  { id: "ach_slayer", name: "Slayer", desc: "Slay 500 monsters.", icon: "💀", category: "Combat", cond: { type: "monstersSlain", count: 500 } },
  { id: "ach_warrior", name: "Warrior", desc: "Reach combat level 30.", icon: "🛡️", category: "Combat", cond: { type: "combatLevel", level: 30 } },
  { id: "ach_champion", name: "Champion", desc: "Reach combat level 60.", icon: "🏆", category: "Combat", cond: { type: "combatLevel", level: 60 } },

  // --- Wealth ---
  { id: "ach_first_coin", name: "First Coin", desc: "Earn 100 gold.", icon: "🪙", category: "Wealth", cond: { type: "goldEarned", amount: 100 } },
  { id: "ach_purse", name: "A Heavy Purse", desc: "Earn 1,000 gold.", icon: "💰", category: "Wealth", cond: { type: "goldEarned", amount: 1000 } },
  { id: "ach_coffer", name: "Filled Coffer", desc: "Earn 10,000 gold.", icon: "🧰", category: "Wealth", cond: { type: "goldEarned", amount: 10000 } },
  { id: "ach_magnate", name: "Magnate", desc: "Earn 100,000 gold.", icon: "👑", category: "Wealth", cond: { type: "goldEarned", amount: 100000 } },

  // --- Story ---
  { id: "ach_the_coin", name: "The Coin in the Dirt", desc: "Help Aldric with his strange old coin.", icon: "🜚", category: "Story", cond: { type: "questDone", quest: "q_ash_and_knuckle" } },
  { id: "ach_act1", name: "The Hills Behind You", desc: "Complete Act I.", icon: "🏔️", category: "Story", cond: { type: "flag", flag: "act1_complete" } },
  { id: "ach_seam", name: "The Seam Question", desc: "Settle the contested seam.", icon: "⛰️", category: "Story", cond: { type: "flag", flag: "act2_complete" } },
  { id: "ach_finale", name: "The Last Choice", desc: "See the story of the Shard to its end.", icon: "✦", category: "Story", cond: { type: "flag", flag: "varath_main_story_complete" } },

  // --- Standing & Companions ---
  { id: "ach_sworn", name: "Sworn", desc: "Reach Allied standing with any faction.", icon: "🤝", category: "Standing", cond: { type: "anyRepAtLeast", amount: 60 } },
  { id: "ach_a_friend", name: "A Friend on the Road", desc: "Befriend your first companion.", icon: "🐾", category: "Companions", cond: { type: "companions", count: 1 } },
  { id: "ach_menagerie", name: "Menagerie", desc: "Gather five companions.", icon: "🦜", category: "Companions", cond: { type: "companions", count: 5 } },
];
