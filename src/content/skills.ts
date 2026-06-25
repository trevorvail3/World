/**
 * src/content/skills.ts
 * ---------------------
 * Player-facing skill metadata, named per Varath canon. The combat trio —
 * Vitality (health), Edge (accuracy), Vigour (damage) — trains on every kill.
 */

import type { SkillId } from "../core/types.ts";

export const skills: Record<SkillId, { name: string }> = {
  mining: { name: "Mining" },
  forestry: { name: "Forestry" },
  fishing: { name: "Fishing" },
  vitality: { name: "Vitality" },
  edge: { name: "Edge" },
  vigour: { name: "Vigour" },
};
