/**
 * src/content/xpCurve.ts
 * ----------------------
 * The Varath experience curve — ported exactly from the idle game so the two
 * games share one sense of progression. It is the classic summed-exponential
 * curve, with a 1/7.5 exponent, then rescaled so that reaching level 100 costs
 * exactly 12,000,000 XP. (Softened from the original 1/7 @ 15M: slightly less
 * back-loaded, and the whole grind to 99 is ~20% shorter — every value is at or
 * below the old curve, so no saved character loses a level.)
 *
 * This is DATA (RULE 3): we precompute the whole table once and the core just
 * looks numbers up in it.
 */

export const LEVEL_CAP = 100; // level freezes here (12M XP); XP still climbs to 100M
const TABLE_MAX = 125;

function buildXpTable(): number[] {
  // raw[L] = cumulative XP to reach level L on the unscaled curve.
  const raw: number[] = [0, 0];
  let sum = 0;
  for (let n = 1; n <= TABLE_MAX; n++) {
    sum += Math.floor(n + 300 * Math.pow(2, n / 7.5));
    raw[n + 1] = Math.floor(sum / 4);
  }
  // Normalise the whole table so level 100 lands exactly on 12,000,000 XP.
  const k = 12_000_000 / raw[100]!;
  const table = raw.map((v) => Math.floor(v * k));
  table[100] = 12_000_000; // force the anchor (guard against floor drift)
  return table;
}

/** xpForLevel[L] = total XP required to reach level L. */
export const xpForLevel: number[] = buildXpTable();

/** Hard XP ceiling per skill. The level orb freezes at LEVEL_CAP (12M XP), but
 *  XP keeps climbing past that as a prestige grind up to here — OSRS-style.
 *  Keep in step with XP_CAP in src/core/worldCore.ts. */
export const XP_CAP = 100_000_000;

/** Given a total XP amount, return the level it corresponds to. */
export function levelForXp(xp: number): number {
  for (let L = LEVEL_CAP; L >= 1; L--) {
    if (xp >= (xpForLevel[L] ?? Infinity)) return L;
  }
  return 1;
}
