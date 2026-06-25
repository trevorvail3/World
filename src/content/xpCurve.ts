/**
 * src/content/xpCurve.ts
 * ----------------------
 * The Varath experience curve — ported exactly from the idle game so the two
 * games share one sense of progression. It is the classic summed-exponential
 * curve, but with a 1/7 exponent (steeper than OSRS's 1/8), then rescaled so
 * that reaching level 100 costs exactly 15,000,000 XP.
 *
 * This is DATA (RULE 3): we precompute the whole table once and the core just
 * looks numbers up in it.
 */

export const LEVEL_CAP = 110; // playable ceiling; the table is built past it
const TABLE_MAX = 125;

function buildXpTable(): number[] {
  // raw[L] = cumulative XP to reach level L on the unscaled curve.
  const raw: number[] = [0, 0];
  let sum = 0;
  for (let n = 1; n <= TABLE_MAX; n++) {
    sum += Math.floor(n + 300 * Math.pow(2, n / 7));
    raw[n + 1] = Math.floor(sum / 4);
  }
  // Normalise the whole table so level 100 lands exactly on 15,000,000 XP.
  const k = 15_000_000 / raw[100]!;
  const table = raw.map((v) => Math.floor(v * k));
  table[100] = 15_000_000; // force the anchor (guard against floor drift)
  return table;
}

/** xpForLevel[L] = total XP required to reach level L. */
export const xpForLevel: number[] = buildXpTable();

/** Given a total XP amount, return the level it corresponds to. */
export function levelForXp(xp: number): number {
  for (let L = LEVEL_CAP; L >= 1; L--) {
    if (xp >= (xpForLevel[L] ?? Infinity)) return L;
  }
  return 1;
}
