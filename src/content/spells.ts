/**
 * src/content/spells.ts
 * ---------------------
 * The Faith spellbook — one page, mixing attack and utility casts. Every spell
 * spends Grace (refilled only at shrines/altars or via a Faith Potion) and is
 * gated by a Faith level. The basic staff bolt is free and handled in combat;
 * these are the Grace-fuelled specials you layer on top.
 *
 * Pure DATA. The core (src/core/worldCore.ts `castSpell`) reads `kind` and the
 * matching effect fields; the client renders the list in the Spells tab.
 */

import type { SpellDef } from "../core/types.ts";

export const spells: SpellDef[] = [
  {
    id: "spark", name: "Orun's Spark", icon: "✨",
    faithReq: 1, cost: 3, kind: "attack", dmgMult: 1.1, xp: 8,
    blurb: "A quick lance of light at your target. Cheap, and always at hand.",
  },
  {
    id: "mend", name: "Mend", icon: "❤️",
    faithReq: 5, cost: 5, kind: "heal", heal: 12, xp: 12,
    blurb: "Knit your wounds with a whispered rite. Heals a chunk of health.",
  },
  {
    id: "emberbolt", name: "Emberbolt", icon: "🔥",
    faithReq: 20, cost: 6, kind: "attack", dmgMult: 1.6, xp: 20,
    blurb: "A searing bolt of ember-light — a solid burst on your target.",
  },
  {
    id: "wayfare", name: "Wayfare", icon: "🗺️",
    faithReq: 25, cost: 10, kind: "teleport", xp: 30,
    blurb: "Step through Orun's light back to the city hub. Escape, or just save the walk.",
  },
  {
    id: "aegis", name: "Aegis", icon: "🛡️",
    faithReq: 35, cost: 10, kind: "ward", wardAmt: 12, wardMs: 30000, xp: 26,
    blurb: "A shimmering ward that turns aside blows for a short while.",
  },
  {
    id: "oruns_wrath", name: "Orun's Wrath", icon: "🌟",
    faithReq: 70, cost: 20, kind: "attack", dmgMult: 3, xp: 60,
    blurb: "The finisher: call down Orun's full fury on a single foe.",
  },
];
