/**
 * src/client/nameRegistry.ts
 * --------------------------
 * Global character-name uniqueness, backed by the Supabase `world_names` table
 * (name = lowercased key, PRIMARY KEY, one row per account). Two operations:
 *
 *   - isNameAvailable(name): a fast, best-effort read used for live feedback as
 *     the player types. A name is "available" if no other account holds it.
 *   - reserveName(name): the AUTHORITY — an atomic INSERT. If the name is taken
 *     the unique/PK constraint rejects it (HTTP 409) and we report "taken"; on
 *     success the account owns the name.
 *
 * Everything degrades gracefully: offline, or before the `world_names` table
 * exists (see server/SUPABASE.md), reads return "available" and reserve returns
 * "error" — both of which let creation proceed, so the game never blocks on the
 * network. Uniqueness simply isn't enforced until the table is in place.
 */

import { rest, currentUser } from "./supabase.ts";

/** The stored key for a display name: trimmed + lowercased. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * True if the name is free (or already held by THIS account, so a player is
 * never told their own name is taken). Best-effort: any read failure — offline,
 * or the table not yet created — resolves to `true` so typing isn't blocked.
 */
export async function isNameAvailable(name: string): Promise<boolean> {
  const key = nameKey(name);
  if (!key) return false;
  try {
    const res = await rest(`world_names?name=eq.${encodeURIComponent(key)}&select=user_id`);
    if (!res.ok) return true; // table missing / offline → don't block
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows) || rows.length === 0) return true;
    const me = currentUser();
    return !!me && rows.every((r) => (r as { user_id?: string }).user_id === me.id);
  } catch {
    return true;
  }
}

/**
 * Atomically claim a name for the signed-in account. The PRIMARY KEY on
 * `world_names.name` makes this the real uniqueness gate: a duplicate insert
 * comes back 409 → "taken". Anything else (offline, no table, RLS) → "error",
 * which the caller treats as best-effort allow.
 */
export async function reserveName(name: string): Promise<"ok" | "taken" | "error"> {
  const me = currentUser();
  const key = nameKey(name);
  if (!me || !key) return "error";
  try {
    const res = await rest("world_names", {
      method: "POST",
      prefer: "return=minimal",
      body: { name: key, display: name.trim(), user_id: me.id },
    });
    if (res.ok) return "ok";
    if (res.status === 409) return "taken"; // unique/PK conflict — someone has it
    return "error"; // 404 (no table) / 401 (RLS) / network — allow, best-effort
  } catch {
    return "error";
  }
}
