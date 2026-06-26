/**
 * src/content/factions.ts
 * -----------------------
 * The four powers of Varath — display metadata for the Factions panel. Pure
 * DATA (RULE 3). Reputation lives on the player; this is just who they are.
 * Ids, names and badge glyphs follow the idle game's GUILD_BADGES.
 */

import type { Content } from "../core/types.ts";

export const factions: Content["factions"] = [
  {
    id: "ashforge",
    name: "Ashforge Brotherhood",
    icon: "⚒️",
    blurb: "The smiths' house. Earns its trust at the anvil.",
  },
  {
    id: "lodge",
    name: "The Warden's Lodge",
    icon: "🌲",
    blurb: "Keepers of Greyoak. They watch the wood, and you.",
  },
  {
    id: "pale_record",
    name: "The Pale Record",
    icon: "📜",
    blurb: "The Order that remembers what the world forgets.",
  },
  {
    id: "heartmoor_cult",
    name: "The Heartmoor",
    icon: "🕯️",
    blurb: "The faithful of the warm stone. They feed the road.",
  },
];
