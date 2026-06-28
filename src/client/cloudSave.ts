/**
 * src/client/cloudSave.ts
 * -----------------------
 * Cloud saves: a character follows your Supabase account to any device. The save
 * blob (the same JSON serializePlayer writes) lives in a per-user row in the
 * `world_saves` table, guarded by RLS so only you can read/write your own.
 *
 * Safety: load() distinguishes "no save yet" (ok, data null) from "couldn't
 * reach the cloud" (offline). The caller MUST NOT overwrite the cloud after an
 * offline load — otherwise a flaky connection could wipe a real character.
 */

import { currentUser, rest } from "./supabase.ts";

export type CloudLoad =
  | { ok: true; data: unknown | null } // reached the server (data null = no save yet)
  | { ok: false };                     // network error — cloud state unknown

/** Fetch this user's cloud save. */
export async function loadCloud(): Promise<CloudLoad> {
  const user = currentUser();
  if (!user) return { ok: true, data: null };
  try {
    const res = await rest(`world_saves?user_id=eq.${user.id}&select=data`);
    if (!res.ok) return { ok: false };
    const rows = await res.json();
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    return { ok: true, data: row?.data ?? null };
  } catch {
    return { ok: false };
  }
}

/** Delete this user's cloud save (used by a character reset). */
export async function deleteCloud(): Promise<void> {
  const user = currentUser();
  if (!user) return;
  try {
    await rest(`world_saves?user_id=eq.${user.id}`, { method: "DELETE" });
  } catch { /* ignore — local reset already happened */ }
}

/** Upsert this user's cloud save. Returns true on success. */
export async function saveCloud(data: unknown, name: string): Promise<boolean> {
  const user = currentUser();
  if (!user) return false;
  try {
    const res = await rest("world_saves?on_conflict=user_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: { user_id: user.id, name, data },
    });
    return res.ok;
  } catch {
    return false;
  }
}
