/**
 * src/content/map.ts
 * ------------------
 * The world map. Pure DATA (RULE 3). One continuous, walkable world made of
 * three regions:
 *
 *   • The Knuckle Hills (north-west, cols 0–27 / rows 0–17) — the starting
 *     foothills, hand-drawn as text below.
 *   • Greyoak Wood (south-west, cols 0–27 / rows 18–33) — old lowland forest,
 *     built by rule so the Lodge road lines up.
 *   • The Spine (east, cols 28–47 / rows 0–33) — the mountain range said to be
 *     Orun's backbone: impassable rock peaks with walkable stone passes and high
 *     snow, a frozen Cold Stream, reached by the pass off the eastern hills.
 *
 * Legend (hills):  . grass  , dirt  = path  # stone  ~ water
 * Greyoak adds:    m moss  ·  the Spine is built from "stone"/"snow"/"mountain".
 */

import type { TileType, WorldMap } from "../core/types.ts";

const WIDTH = 48;
const HILL_WIDTH = 28; // the hand-drawn region's width
const HILL_HEIGHT = 18; // rows 0–17
const HEIGHT = 34; // rows 0–33

// --- The Knuckle Hills, drawn by hand (rows 0–17, cols 0–27) ---
const HILL_ROWS: string[] = [
  "............................", // 0
  "..,,,,,,,,,.......#########..", // 1  dirt grove (left) + stone outcrop (right)
  "..,,,,,,,,,.......#########..", // 2
  "..,,,,,,,,,.......#########..", // 3
  "..,,,,,,,,,.......#########..", // 4
  ".............==.............", // 5
  "....====================....", // 6  the main path crosses here
  ".............==.............", // 7
  ".............==.............", // 8  Aldric stands on the path here
  ".............==.............", // 9
  ".............==.............", // 10
  ".............==.............", // 11
  "......~~~~~~~==.............", // 12  the cold pond — head of the Redrun
  "......~~~~~~~==.............", // 13
  "......~~~~~~~==.............", // 14
  "......~~~~~~~==.............", // 15
  "......~~~~~~~==.............", // 16
  ".............==.............", // 17  the road leaves the hills, southward
];

const CHAR_TO_TILE: Record<string, TileType> = {
  ".": "grass",
  ",": "dirt",
  "=": "path",
  "#": "stone",
  "~": "water",
};

/** Greyoak Wood, built by rule so the road and clearing always line up. */
function forestTile(x: number, y: number): TileType {
  if (x === 13 || x === 14) return "path"; // the Lodge road
  const fringe = x < 2 || x > 25;
  const inClearing = y >= 24 && y <= 27 && x >= 5 && x <= 22; // the Lodge clearing
  if (inClearing) return "dirt";
  return fringe ? "grass" : "moss";
}

/** A cheap, stable pseudo-noise so the Spine's peaks are fixed (not random). */
function noise(x: number, y: number): number {
  const n = Math.sin(x * 157.31 + y * 113.77) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * The Spine. Stone foothills meet the western pass; snow on the high east; a
 * frozen Cold Stream down the middle; impassable peaks scattered as obstacles —
 * but the pass off the hills is always kept open.
 */
function spineTile(x: number, y: number): TileType {
  const sx = x - 28; // 0–19 within the Spine
  // The Cold Stream — a frozen brook winding down the highlands.
  if ((x === 39 || x === 40) && y >= 9 && y <= 27) return "water";
  // The pass in from the eastern hills is always clear.
  const pass = sx <= 3 && y >= 5 && y <= 9;
  if (pass) return "stone";
  // Scattered peaks (impassable); leave the foothills a touch clearer.
  const peakChance = sx < 6 ? 0.78 : 0.7;
  if (noise(x, y) > peakChance) return "mountain";
  // Stone in the low west + along the south; snow on the high ground.
  return sx < 6 || y < 5 ? "stone" : "snow";
}

function decode(): WorldMap {
  const tiles: TileType[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let t: TileType;
      if (x < HILL_WIDTH) {
        if (y < HILL_HEIGHT) {
          const ch = HILL_ROWS[y]?.[x] ?? ".";
          t = CHAR_TO_TILE[ch] ?? "grass";
        } else {
          t = forestTile(x, y);
        }
      } else {
        t = spineTile(x, y);
      }
      tiles[y * WIDTH + x] = t;
    }
  }
  return { name: "Varath", width: WIDTH, height: HEIGHT, tiles };
}

export const map: WorldMap = decode();

/** Convenience: read the tile type at a coordinate (grass if out of bounds). */
export function tileAt(m: WorldMap, x: number, y: number): TileType {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return "grass";
  return m.tiles[y * m.width + x]!;
}
