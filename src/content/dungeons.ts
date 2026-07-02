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


// ============================================================================
// SITE 2 — THE SPINE VAULT (rebuilt as a worked-stone vault crawl)
// The mountain vault the old north-folk sealed from the inside, high in the
// northern pass. A pillared gallery with four counting-cells (throw the
// weigh-locks in the order the tally-stones recite), then the warded stair,
// a sentinel landing whose keeper carries the Wardens' Key, and the treasury
// where the Vaultwright still tends the seals.
const VAULT_ROWS = [
  "                                                                  ", // 0
  "                                                                  ", // 1
  "                ...         ...                                   ", // 2
  "                ...         ...                                   ", // 3
  "                ...         ...        ..............             ", // 4
  "                 .           .         ..............             ", // 5
  "               ....................    ..          ..             ", // 6
  "               ....................    ..          ..     ...     ", // 7
  "  ........     ....................    ..          ..     ...     ", // 8
  "  ........     ....#.....#.....#...    ..          ..     ...     ", // 9
  "  .................................    ..          ..      .      ", // 10
  "  .......................................          ..     ....... ", // 11
  "  ........     ....#.....#.....#...                ..     ....... ", // 12
  "  ........     ....................          ..........   ....... ", // 13
  "               ....................          ..........   ....... ", // 14
  "               ....................          .................... ", // 15
  "                 .           .               ..........   ....... ", // 16
  "                ...         ...              ..........   ....... ", // 17
  "                ...         ...                           ....... ", // 18
  "                ...         ...                           ....... ", // 19
  "                                                                  ", // 20
  "                                                                  ", // 21
];


// ============================================================================
// SITE 3 — THE SUNKEN COURT (a drowned ruin in the Heartmoor bog)
// The seat the old north-folk abandoned to the rising moor. Twice the crawl of
// the first two sites: the tide-sluices (stage one) open the Tide Gate into
// the drowned nave, whose four bells (stage two, rung in the order the
// psalm-plaques recite) open the Bell Door onto the long processional. The
// Reliquarist keeps the reliquary key; past it, the lower approach runs east
// to the sunken throne room where the Drowned Magistrate holds court still.
const COURT_ROWS = [
  "                                                                                                                                  ", // 0
  "                                                              ...                   ...                                           ", // 1
  "                                                              ...                   ...                                           ", // 2
  "                                                        .........................................                                 ", // 3
  "              ...............................           ..................................~~~~~..                                 ", // 4
  "              ...............................           ..................................~~~~~..                                 ", // 5
  "              ...............................           ..................................~~~~~..                                 ", // 6
  "              ...............................           ........#.......#.......#.......#........                                 ", // 7
  "              ..................................................#.......#.......#.......#........                                 ", // 8
  "              ..........,,,,,,,,,,,..........           ........#.......#.......#.......#........                                 ", // 9
  "              ..........,,,,,,,,,,,..........           ........#.......#.......#.......#........                                 ", // 10
  "              ...............................           ........#.......#.......#.......#........                                 ", // 11
  "              ...............................           ..........~~~~~..........................                                 ", // 12
  "                     ..                                 ..........~~~~~..........................                                 ", // 13
  "                ...............                         ..........~~~~~..........................                                 ", // 14
  "                ...............                         .........................................                                 ", // 15
  "                ...............                               ...                   ...     .                                     ", // 16
  "                ...............                               ...                   ...     .                                     ", // 17
  "  ........      ...............                               ...                   ...     .                                     ", // 18
  "  .............................                                                             .                                     ", // 19
  "  .............................  .............................................................                                    ", // 20
  "  ........      ...............  .............................................................                                    ", // 21
  "  ........      ...............    .            ~~~~~~~~~~~~~                                                                     ", // 22
  "  ........      ...~~~~~~~~....    .                                                                                              ", // 23
  "                ...~~~~~~~~....    .                                                                                              ", // 24
  "                ...~~~~~~~~.... ...........                                                         ...........................   ", // 25
  "                ...~~~~~~~~.... ...........                                                         ....................~~~~~..   ", // 26
  "                ............... ...........                                                         ....................~~~~~..   ", // 27
  "                                ...............................................................................................   ", // 28
  "                                ...............................................................................................   ", // 29
  "                                ...........                                                         ...........................   ", // 30
  "                                ...........                                                         ...........................   ", // 31
  "                                                                                                    ...........................   ", // 32
  "                                                                                                    ...........................   ", // 33
  "                                                                                                    ...........................   ", // 34
  "                                                                                                    ...........................   ", // 35
  "                                                                                                    ..~~~~~~~..................   ", // 36
  "                                                                                                    ..~~~~~~~..................   ", // 37
  "                                                                                                    ..~~~~~~~..................   ", // 38
  "                                                                                                    ...........................   ", // 39
  "                                                                                                                                  ", // 40
  "                                                                                                                                  ", // 41
];

// ============================================================================
// SITE 4 — SKYREACH RUIN (an aerie of the north-folk, high on the east Spine)
// A watch-fortress built into the mountainside. Four switchback terraces
// climb to the star-chart gallery (light the beacons in the charts' order to
// open the Wind Door), then the pillared wind hall with its counterweight
// cells (stage two) before the Gale Stair. The long descent and traverse lead
// to the keyed Eyrie Door, the final ascent, and the Storm-Herald's eyrie.
const SKYREACH_ROWS = [
  "                                                                                                                                  ", // 0
  "                                                                                                                                  ", // 1
  "                                                                                                                                  ", // 2
  "                                                                                                                                  ", // 3
  "                                                                                                                                  ", // 4
  "                                                                                                                                  ", // 5
  "                                                                                                                                  ", // 6
  "                                                ...                     ...                                                       ", // 7
  "                                                ...                     ...                                                       ", // 8
  "                                                 .                       .                                                        ", // 9
  "                                          .........................................                                               ", // 10
  "                                          ..,,,....................................                                               ", // 11
  "                                          ..,,,....................................                                               ", // 12
  "    ...........................           ........#.......#.......#.......#........                                               ", // 13
  "    ...........................           ........#.......#.......#.......#........                                               ", // 14
  "    ...........................           ........#.......#.......#.......#................                                       ", // 15
  "    ..............................................#.......#.......#.......#........      ..                                       ", // 16
  "    ..........,,,,,,,,,........           ........#.......#.......#.......#........      ..                                       ", // 17
  "    ..........,,,,,,,,,........           .........................................      ..             .......................   ", // 18
  "    ...........................           .........................................      ..             ..,,,,,................   ", // 19
  "         ..                               .........................................      ..             ..,,,,,................   ", // 20
  "        .............................           ...                     ...              ..             .......................   ", // 21
  "        .............................           ...                     ...              ..             .......................   ", // 22
  "                                   ..           ...                     ...              ..             .......................   ", // 23
  "                                   ..                                                    ..             .......................   ", // 24
  "                                   ..                                                    ..             .......................   ", // 25
  "        .............................               .......................................             .......................   ", // 26
  "        .............................               .......................................                          ..           ", // 27
  "        ..                                          .                                                                ..           ", // 28
  "        ..                                          .                                                                ..           ", // 29
  "        ..                                          .                                                                ..           ", // 30
  "        .............................               ...................................................................           ", // 31
  "        .............................               ...................................................................           ", // 32
  "                                   ..                                                                                             ", // 33
  "  ........                         ..                                                                                             ", // 34
  "  ........                         ..                                                                                             ", // 35
  "  ...................................                                                                                             ", // 36
  "  ...................................                                                                                             ", // 37
  "  ...................................                                                                                             ", // 38
  "  ........                                                                                                                        ", // 39
  "                                                                                                                                  ", // 40
  "                                                                                                                                  ", // 41
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
  {
    id: "spine_vault",
    name: "The Spine Vault",
    x0: 84,
    row0: 1,
    rows: VAULT_ROWS,
    entry: { x: 4, y: 10 },
    exit: { x: 3, y: 9 },
  },
  {
    id: "sunken_court",
    name: "The Sunken Court",
    x0: 2,
    row0: 27,
    rows: COURT_ROWS,
    entry: { x: 5, y: 20 },
    exit: { x: 3, y: 19 },
  },
  {
    id: "skyreach",
    name: "Skyreach Ruin",
    x0: 2,
    row0: 71,
    rows: SKYREACH_ROWS,
    entry: { x: 5, y: 37 },
    exit: { x: 3, y: 35 },
  },
];
