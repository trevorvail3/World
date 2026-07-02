/**
 * src/content/dungeons.ts
 * -----------------------
 * The Act II exploration sites: long, hand-authored dungeon layouts carved into
 * the hidden DUNGEON band below the home interiors (see map.ts). Each site is
 * ASCII art — one string per row — so a dungeon reads on the page exactly the
 * way it walks in the game: twists, dead ends, side passages and gated halls.
 *
 * Legend (anything else, including spaces, stays solid rock):
 *   #  cave wall (explicit, for readability at room edges)
 *   .  worked stone / cave floor
 *   ,  bare earth (barrow dirt)
 *   ~  still black water (impassable; dressing for flooded corners)
 *
 * The layouts here are geometry only. Everything that LIVES in a site — the
 * levers and their plaques, sealed gates, chests, relics, monsters — is spawned
 * in src/content/spawns.ts at coordinates relative to the site origin, and the
 * puzzle/gate/chest mechanics live in the core (src/core/worldCore.ts).
 */

export interface DungeonLayout {
  id: string;
  name: string;
  /** Column of the site's top-left corner within the map. */
  x0: number;
  /** Row offset of the site's top-left corner WITHIN the dungeon band. */
  row0: number;
  /** The carved geometry, top to bottom. */
  rows: string[];
  /** Where the entrance portal drops you (site-relative). */
  entry: { x: number; y: number };
  /** Where the exit portal stands inside (site-relative). */
  exit: { x: number; y: number };
}

// ============================================================================
// SITE 1 — THE HOLLOW BARROWS (rebuilt as a true barrow-crawl)
// A burial warren of the old north-folk. Three carved levers — wolf, moon and
// crown — must be thrown in the order the funeral plaques recite, or the
// mechanism resets. Beyond the sealed slab: switchback galleries, a shrine
// alcove holding the first tablet of the Pale script, and the Barrow-King's
// resting hall.
//     0         1         2         3         4         5         6         7
//     0123456789012345678901234567890123456789012345678901234567890123456789012
const BARROW_ROWS = [
  "                                                                        ", // 0
  "                                                                        ", // 1
  "  ..........                                                            ", // 2
  "  ..........                                                            ", // 3
  "  ................                  .............                       ", // 4
  "  ................                ..............                        ", // 5
  "  ..........     ..               ...            ..        ..           ", // 6
  "  ..........     ..               ...            ..        ..           ", // 7
  "                 ..               ...            .......... ..          ", // 8
  "                 ..         .............        .............          ", // 9
  "                 ..         .............        ..        ..           ", // 10
  "                 .......................         ..        ..           ", // 11
  "                 .................................         ..           ", // 12
  "                            .............                  ..           ", // 13
  "                            .............               ...............", // 14
  "                            .............               ...............", // 15
  "                            .............               ...............", // 16
  "                              ,,,,                      ...............", // 17
  "                              ,,,,                      ...............", // 18
  "                              ~,,~                      ...............", // 19
  "                                                        ...............", // 20
  "                                                                        ", // 21
];

export const DUNGEON_LAYOUTS: DungeonLayout[] = [
  {
    id: "hollow_barrows",
    name: "The Hollow Barrows",
    x0: 2,
    row0: 1,
    rows: BARROW_ROWS,
    entry: { x: 5, y: 4 },
    exit: { x: 3, y: 3 },
  },
];
