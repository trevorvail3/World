/**
 * src/content/map.ts
 * ------------------
 * The whole of Varath, as one continuous walkable map (RULE 3). Seven regions,
 * arranged roughly 3×2 with the Spine bridging top and bottom, and joined by
 * carved seams (roads/passes) so you can walk the entire continent:
 *
 *        cols 0–27        cols 28–47       cols 48–63
 *   ───────────────────────────────────────────────────────
 *   rows 0–17   Knuckle Hills   The Spine        The Marrow
 *   rows 18–33  Greyoak Wood    (Orun's spine)   Deeps (caves)
 *   rows 34–55  Heartmoor       Ashfen Flats     The Redrun → Eyeless Sea
 *
 * Each region is hand-drawn (the hills) or built by rule. Seams are carved at
 * the end so adjacent regions always connect. (Bible §X.)
 */

import type { TileType, WorldMap } from "../core/types.ts";

const WIDTH = 64;
/** The overworld is rows 0–55; rows 56–71 are a sealed band of boss arenas. */
export const OVERWORLD_HEIGHT = 56;
const ARENA_BAND = 16;
const HEIGHT = OVERWORLD_HEIGHT + ARENA_BAND;

/**
 * The four boss arenas, isolated in the hidden band below the overworld (you can
 * only reach them by a portal that teleports you in). Each is a walled room with
 * a floor tile of its own. x is the left column; the room is ARENA_W × ARENA_H.
 */
export const ARENA_W = 13;
export const ARENA_H = 12;
export const ARENA_TOP = 58;
export const ARENAS: { dungeon: string; x: number; floor: TileType }[] = [
  { dungeon: "hollow_barrows", x: 2, floor: "dirt" },
  { dungeon: "bog_barrow", x: 18, floor: "bog" },
  { dungeon: "spine_vault", x: 34, floor: "stone" },
  { dungeon: "marrow_vault", x: 50, floor: "cave" },
];

// --- The Knuckle Hills + Ironvale, drawn by hand (rows 0–17, cols 0–27) ---
// Ironvale is the walled central city: dressed-stone ramparts ('W') with a
// north and a south gate on the main road, a flag-stoned market plaza inside
// (where the bank, smithy and shops sit), a lake on its west flank, the dirt
// grove and the knucklestone outcrop to the north, and the roads leaving
// through the gates to the Spine, Greyoak and the south.
const HILL_ROWS: string[] = [
  "............................", // 0
  "..,,,,,,,,.......#########...", // 1  dirt grove + knucklestone outcrop
  "..,,,,,,,,.......#########...", // 2
  "..,,,,,,,,.......#########...", // 3
  "..,,,,,,,,.......#########...", // 4
  ".............==.............", // 5  the road approaches Ironvale
  "....====================....", // 6  the main road (east to the Spine)
  ".........WWWW==WWWWWWWWWW....", // 7  north wall + gate
  ".........WWW#==#######WWW...", // 8  ramparts; plaza within (Aldric on the street)
  ".........WWW#==#######WWW...", // 9  Vorn, Berric
  ".........WWW#==#######WWW...", // 10 Sera, the bank, the furnace
  ".........W###==#########W...", // 11 the fire, the anvil
  "....~~~~~W###==#########W...", // 12 lake on the west flank; market plaza
  "....~~~~~W###==#########W...", // 13 the shops
  "....~~~~~WWWW==WWWWWWWWWW....", // 14 south wall + gate
  "....~~~~~....==.............", // 15 the road leaves south for Greyoak
  ".............==.............", // 16
  ".............==.............", // 17
];

const CHAR_TO_TILE: Record<string, TileType> = {
  ".": "grass",
  ",": "dirt",
  "=": "path",
  "#": "stone",
  "~": "water",
  "W": "wall",
};

/** A cheap, stable pseudo-noise so terrain is fixed (not random). */
function noise(x: number, y: number): number {
  const n = Math.sin(x * 157.31 + y * 113.77) * 43758.5453;
  return n - Math.floor(n);
}

// --- Greyoak Wood (cols 0–27, rows 18–33) ---
function forestTile(x: number, y: number): TileType {
  if (x === 13 || x === 14) return "path"; // the Lodge road
  const fringe = x < 2 || x > 25;
  const inClearing = y >= 24 && y <= 27 && x >= 5 && x <= 22;
  if (inClearing) return "dirt";
  return fringe ? "grass" : "moss";
}

// --- The Spine (cols 28–47, rows 0–33) ---
function spineTile(x: number, y: number): TileType {
  const sx = x - 28;
  if ((x === 39 || x === 40) && y >= 9 && y <= 27) return "water"; // Cold Stream
  if (sx <= 3 && y >= 5 && y <= 9) return "stone"; // the pass off the hills
  const peakChance = sx < 6 ? 0.78 : 0.7;
  if (noise(x, y) > peakChance) return "mountain";
  return sx < 6 || y < 5 ? "stone" : "snow";
}

// --- The Marrow Deeps (cols 48–63, rows 0–27): dark caves ---
function marrowTile(x: number, y: number): TileType {
  if (noise(x, y) > 0.6) return "cave_wall";
  return "cave";
}

// --- Heartmoor (cols 0–27, rows 34–55): southern moor ---
function heartmoorTile(x: number, y: number): TileType {
  if (x === 13 || x === 14) return "path"; // the road continues south
  const n = noise(x, y);
  if (n > 0.84) return "water"; // bog pools (impassable)
  if (n < 0.12) return "grass"; // firmer tussocks
  return "bog";
}

// --- The Ashfen Flats (cols 28–47, rows 34–55): warm geothermal ground ---
function ashfenTile(x: number, y: number): TileType {
  if (noise(x, y) > 0.85) return "stone"; // warm outcrops
  return "ash";
}

// --- The Redrun + Eyeless Sea (cols 48–63, rows 28–55) ---
function redrunTile(x: number, y: number): TileType {
  if (y >= 51) return "deep"; // the open Eyeless Sea to the south
  const widen = Math.floor((y - 28) / 7);
  const left = 54 - widen;
  const right = 57 + widen;
  if (x >= left && x <= right) return "water"; // the red river, widening to the estuary
  return noise(x, y) > 0.72 ? "dirt" : "grass"; // banks
}

function decode(): WorldMap {
  const tiles: TileType[] = new Array(WIDTH * HEIGHT).fill("grass");
  const set = (x: number, y: number, t: TileType) => {
    if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) tiles[y * WIDTH + x] = t;
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let t: TileType = "grass";
      if (y >= OVERWORLD_HEIGHT) {
        t = "wall"; // the sealed arena band — carved into rooms below
      } else if (x < 28 && y < 18) {
        const ch = HILL_ROWS[y]?.[x] ?? ".";
        t = CHAR_TO_TILE[ch] ?? "grass";
      } else if (x < 28 && y < 34) t = forestTile(x, y);
      else if (x < 48 && y < 34) t = spineTile(x, y);
      else if (x >= 48 && y < 28) t = marrowTile(x, y);
      else if (x < 28) t = heartmoorTile(x, y);
      else if (x < 48) t = ashfenTile(x, y);
      else t = redrunTile(x, y);
      set(x, y, t);
    }
  }

  // --- Carve each sealed boss arena: a floor room inside the wall band ---
  for (const a of ARENAS) {
    for (let y = ARENA_TOP; y < ARENA_TOP + ARENA_H; y++) {
      for (let x = a.x; x < a.x + ARENA_W; x++) {
        // leave a one-tile wall border around the room
        const edge = x === a.x || x === a.x + ARENA_W - 1 || y === ARENA_TOP || y === ARENA_TOP + ARENA_H - 1;
        set(x, y, edge ? "wall" : a.floor);
      }
    }
  }

  // --- Carve walkable seams so every region connects (roads/passes) ---
  const carve = (x0: number, y0: number, x1: number, y1: number, t: TileType) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
  };
  carve(26, 6, 29, 8, "path"); // Knuckle Hills ↔ Spine (the east pass)
  carve(25, 24, 29, 26, "stone"); // Greyoak ↔ Spine (forest meets foothill)
  carve(12, 32, 15, 35, "path"); // Greyoak ↔ Heartmoor (the road south)
  carve(35, 32, 39, 35, "stone"); // Spine ↔ Ashfen (down off the mountain)
  carve(26, 43, 29, 46, "path"); // Heartmoor ↔ Ashfen
  carve(46, 14, 49, 17, "cave"); // Spine ↔ Marrow Deeps (the cave mouth)
  carve(53, 26, 56, 29, "dirt"); // Marrow ↔ Redrun (down to the river)
  carve(46, 43, 49, 46, "dirt"); // Ashfen ↔ Redrun

  return { name: "Varath", width: WIDTH, height: HEIGHT, tiles };
}

export const map: WorldMap = decode();

/** Convenience: read the tile type at a coordinate (grass if out of bounds). */
export function tileAt(m: WorldMap, x: number, y: number): TileType {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return "grass";
  return m.tiles[y * m.width + x]!;
}
