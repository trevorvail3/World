/**
 * src/content/xpCurve.ts
 * ----------------------
 * The classic Old-School RuneScape experience curve.
 *
 * This is DATA, not logic: we pre-compute, once, the total XP required to
 * reach each level from 1 to 99. The core then just looks numbers up in this
 * table. Keeping it here (in src/content) honours RULE 3 — content is data.
 *
 * The OSRS formula for the XP needed to reach level L is:
 *
 *     xp(L) = floor( (1/4) * sum_{n=1..L-1} floor( n + 300 * 2^(n/8) ) )
 *
 * which gives the familiar 0, 83, 174, 276, ... curve.
 */

export const MAX_LEVEL = 99;

function buildXpTable(): number[] {
  // table[level] = total XP needed to *be* that level.
  // Index 0 is unused; level 1 needs 0 XP.
  const table: number[] = [0, 0];
  let points = 0;
  for (let level = 1; level < MAX_LEVEL; level++) {
    points += Math.floor(level + 300 * Math.pow(2, level / 8));
    table[level + 1] = Math.floor(points / 4);
  }
  return table;
}

/** xpForLevel[L] = total XP required to reach level L (1..99). */
export const xpForLevel: number[] = buildXpTable();

/** Given a total XP amount, return the level it corresponds to. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xpForLevel[level + 1]! <= xp) {
    level++;
  }
  return level;
}
