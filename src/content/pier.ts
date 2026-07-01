/**
 * src/content/pier.ts
 * -------------------
 * Data for the Drowned Pier fishing minigame off the Redrun estuary: the species
 * you can hook in the deep water, and the rival anglers whose catches seed the
 * pier's records board.
 *
 * Each species rolls a random weight (kg) and length (cm) within its range. The
 * roll is biased toward the top of the range by the player's Fishing level and
 * rod tier (see worldCore.rollPierFish), so a higher level + finer rod genuinely
 * lands bigger fish — and the rarer, heavier species only bite once you're
 * skilled enough (`minLevel`). The board keeps the five heaviest catches ever.
 */

import type { PierFishDef, FishRecord } from "../core/types.ts";

export const PIER_FISH: PierFishDef[] = [
  {
    id: "saltgill",
    name: "Saltgill",
    rarity: 10,
    minLevel: 1,
    weight: [0.6, 4.5],
    length: [28, 58],
    xpPerKg: 100,
    goldPerKg: 9,
  },
  {
    id: "pale_flounder",
    name: "Pale Flounder",
    rarity: 8,
    minLevel: 15,
    weight: [2, 8],
    length: [34, 70],
    xpPerKg: 94,
    goldPerKg: 10,
  },
  {
    id: "eyeless_bass",
    name: "Eyeless Bass",
    rarity: 6,
    minLevel: 35,
    weight: [4, 16],
    length: [45, 95],
    xpPerKg: 86,
    goldPerKg: 11,
  },
  {
    id: "redrun_greatpike",
    name: "Redrun Greatpike",
    rarity: 3,
    minLevel: 55,
    weight: [9, 32],
    length: [70, 150],
    xpPerKg: 78,
    goldPerKg: 13,
  },
  {
    id: "eyeless_leviathan",
    name: "Eyeless Leviathan",
    rarity: 1,
    minLevel: 75,
    weight: [22, 62],
    length: [130, 280],
    xpPerKg: 70,
    goldPerKg: 16,
  },
];

/** Rival anglers already on the board — something to beat from day one. The
 *  player's heavier catches push these off, smallest first. */
export const PIER_RECORDS: FishRecord[] = [
  { species: "Eyeless Bass", weight: 7.5, length: 62, angler: "Old Coll" },
  { species: "Pale Flounder", weight: 5.5, length: 55, angler: "Mirren the Net" },
  { species: "Pale Flounder", weight: 4.2, length: 48, angler: "The Saltreach Guild" },
  { species: "Saltgill", weight: 3.0, length: 48, angler: "Brannoch Tide" },
  { species: "Saltgill", weight: 2.0, length: 40, angler: "A Saltreach lad" },
];
