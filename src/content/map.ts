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
const HEIGHT = 56;

// --- The Knuckle Hills, drawn by hand (rows 0–17, cols 0–27) ---
const HILL_ROWS: string[] = [
  "............................", // 0
  "..,,,,,,,,,.......#########..", // 1  dirt grove + stone outcrop
  "..,,,,,,,,,.......#########..", // 2
  "..,,,,,,,,,.......#########..", // 3
  "..,,,,,,,,,.......#########..", // 4
  ".............==.............", // 5
  "....====================....", // 6  the main path
  ".............==.............", // 7
  ".............==.............", // 8  Aldric
  ".............==.............", // 9
  ".............==.............", // 10
  ".............==.............", // 11
  "......~~~~~~~==.............", // 12  head of the Redrun (pond)
  "......~~~~~~~==.............", // 13
  "......~~~~~~~==.............", // 14
  "......~~~~~~~==.............", // 15
  "......~~~~~~~==.............", // 16
  ".............==.............", // 17  the road leaves south
];

const CHAR_TO_TILE: Record<string, TileType> = {
  ".": "grass",
  ",": "dirt",
  "=": "path",
  "#": "stone",
  "~": "water",
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
      if (x < 28 && y < 18) {
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
