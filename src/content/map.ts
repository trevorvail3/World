/**
 * src/content/map.ts
 * ------------------
 * The world map. Pure DATA (RULE 3). Two regions, walkable as one continuous
 * world:
 *
 *   • The Knuckle Hills (north, rows 0–17) — the starting foothills: a dirt
 *     grove, a stone outcrop, the head of the Redrun (the pond), and the camp.
 *     Hand-drawn as text below.
 *   • Greyoak Wood (south, rows 18–33) — old lowland forest of wide-canopied
 *     greyoak; boar in the understory, bears in the deep. Built programmatically
 *     so the road (cols 13–14) lines up exactly as it descends from the hills
 *     into the Lodge clearing and on into the old growth.
 *
 * Legend (hills):  . grass   , dirt   = path   # stone   ~ water
 * Greyoak adds:    m moss (forest floor)
 */

import type { TileType, WorldMap } from "../core/types.ts";

const WIDTH = 28;

// --- The Knuckle Hills, drawn by hand (rows 0–17) ---
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
  m: "moss",
};

const HILL_HEIGHT = HILL_ROWS.length; // 18
const FOREST_HEIGHT = 16; // rows 18–33
const HEIGHT = HILL_HEIGHT + FOREST_HEIGHT; // 34

/** Greyoak Wood, built by rule so the road and clearing always line up. */
function forestTile(x: number, y: number): TileType {
  // The Lodge road runs straight down the middle of the wood.
  if (x === 13 || x === 14) return "path";
  // A grassy fringe rings the wood; everything inside is mossy forest floor.
  const fringe = x < 2 || x > 25;
  // The Lodge clearing — trodden dirt — sits mid-wood (rows 24–27).
  const inClearing = y >= 24 && y <= 27 && x >= 5 && x <= 22;
  if (inClearing) return "dirt";
  return fringe ? "grass" : "moss";
}

function decode(): WorldMap {
  const tiles: TileType[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (y < HILL_HEIGHT) {
        const ch = HILL_ROWS[y]?.[x] ?? ".";
        tiles[y * WIDTH + x] = CHAR_TO_TILE[ch] ?? "grass";
      } else {
        tiles[y * WIDTH + x] = forestTile(x, y);
      }
    }
  }
  return { name: "The Knuckle Hills", width: WIDTH, height: HEIGHT, tiles };
}

export const map: WorldMap = decode();

/** Convenience: read the tile type at a coordinate (grass if out of bounds). */
export function tileAt(m: WorldMap, x: number, y: number): TileType {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return "grass";
  return m.tiles[y * m.width + x]!;
}
