/**
 * src/content/map.ts
 * ------------------
 * "The Knuckle Hills" — the first hand-made zone, drawn as text and decoded
 * into a tile grid. This is pure DATA (RULE 3).
 *
 * Legend:
 *   .  grass      (walkable)
 *   ,  dirt       (walkable)
 *   =  path       (walkable)
 *   #  stone      (walkable)
 *   ~  water      (NOT walkable)
 *
 * The art only decides how tiles *look* and where water blocks movement.
 * Where trees, rocks, the NPC and the monster sit is decided separately in
 * src/content/spawns.ts. Any character the decoder doesn't recognise (or a
 * short row) is treated as grass, so the art is forgiving to edit.
 */

import type { TileType, WorldMap } from "../core/types.ts";

const ROWS: string[] = [
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
  "......~~~~~~~==.............", // 12  the cold pond (water)
  "......~~~~~~~==.............", // 13
  "......~~~~~~~==.............", // 14
  "......~~~~~~~==.............", // 15
  "......~~~~~~~==.............", // 16
  "............................", // 17
];

const CHAR_TO_TILE: Record<string, TileType> = {
  ".": "grass",
  ",": "dirt",
  "=": "path",
  "#": "stone",
  "~": "water",
};

function decodeMap(name: string, rows: string[]): WorldMap {
  const height = rows.length;
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const tiles: TileType[] = [];
  for (let y = 0; y < height; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < width; x++) {
      const ch = row[x] ?? ".";
      tiles[y * width + x] = CHAR_TO_TILE[ch] ?? "grass";
    }
  }
  return { name, width, height, tiles };
}

export const map: WorldMap = decodeMap("The Knuckle Hills", ROWS);

/** Convenience: read the tile type at a coordinate (grass if out of bounds). */
export function tileAt(m: WorldMap, x: number, y: number): TileType {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return "grass";
  return m.tiles[y * m.width + x]!;
}
