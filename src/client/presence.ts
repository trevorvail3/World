/**
 * src/client/presence.ts
 * ----------------------
 * The ghost layer: see other signed-in players as translucent snapshots in the
 * shared world. Each player periodically publishes a tiny "presence" row
 * (position + look + which zone they're in); everyone reads back the recent ones
 * for their own zone. It's purely cosmetic — ghosts never interact with the
 * core, exactly like the hiscores board.
 *
 * "Zone" keeps you from seeing players who are inside their own sealed home
 * instances: the overworld is one shared zone; each interior is its own.
 */

import type { Appearance } from "../core/types.ts";
import { instanceRectAt } from "../content/map.ts";
import { currentUser, rest } from "./supabase.ts";

export interface Ghost {
  id: string;
  name: string;
  x: number;
  y: number;
  look: Appearance;
}

/** What the game feeds us each beat: where the player is and how they look. */
export interface PresenceSnapshot { x: number; y: number; name: string; look: Appearance }

const STALE_MS = 60_000; // a presence older than this is treated as gone
const PUSH_MS = 4_000;   // how often we publish our own position
const PULL_MS = 6_000;   // how often we refresh the ghosts around us

let ghosts: Ghost[] = [];
let provider: (() => PresenceSnapshot | null) | null = null;
let started = false;

/** Which shared space a tile belongs to (overworld, or a specific interior). */
function zoneKey(x: number, y: number): string {
  const r = instanceRectAt(Math.round(x), Math.round(y));
  return r ? `i:${r.x0},${r.y0}` : "overworld";
}

/** The ghosts currently near the player (for the renderer to draw). */
export function currentGhosts(): Ghost[] { return ghosts; }

async function push(): Promise<void> {
  const user = currentUser();
  if (!user || !provider) return;
  const s = provider();
  if (!s) return;
  try {
    await rest("world_presence?on_conflict=user_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        user_id: user.id, name: s.name,
        x: s.x, y: s.y, zone: zoneKey(s.x, s.y),
        look: s.look, updated_at: new Date().toISOString(),
      },
    });
  } catch { /* offline — try again next beat */ }
}

async function pull(): Promise<void> {
  const user = currentUser();
  if (!user || !provider) return;
  const s = provider();
  if (!s) return;
  const zone = zoneKey(s.x, s.y);
  const since = new Date(Date.now() - STALE_MS).toISOString();
  try {
    const q = `world_presence?select=user_id,name,x,y,look`
      + `&zone=eq.${encodeURIComponent(zone)}`
      + `&updated_at=gte.${encodeURIComponent(since)}`;
    const res = await rest(q);
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    ghosts = rows
      .filter((r) => r && r.user_id !== user.id && r.look)
      .map((r) => ({
        id: String(r.user_id),
        name: typeof r.name === "string" && r.name ? r.name : "Wanderer",
        x: Number(r.x) || 0,
        y: Number(r.y) || 0,
        look: r.look as Appearance,
      }));
  } catch { /* offline — keep the last set until we can refresh */ }
}

/** Begin publishing + polling presence. `get` returns the live snapshot, or null
 *  (e.g. while the player is dead) to skip a beat. No-op when signed out. */
export function startPresence(get: () => PresenceSnapshot | null): void {
  if (started) return;
  started = true;
  provider = get;
  if (!currentUser()) return; // ghosts are an online-only feature
  void push();
  void pull();
  window.setInterval(() => void push(), PUSH_MS);
  window.setInterval(() => void pull(), PULL_MS);
}
