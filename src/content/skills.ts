/**
 * src/content/skills.ts
 * ---------------------
 * Player-facing metadata for each skill (just a display name for now).
 * The list of skill IDs themselves lives in the SkillId type in core/types.ts.
 */

import type { SkillId } from "../core/types.ts";

export const skills: Record<SkillId, { name: string }> = {
  forestry: { name: "Forestry" },
  mining: { name: "Mining" },
  fishing: { name: "Fishing" },
  combat: { name: "Combat" },
};
