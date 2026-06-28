/**
 * src/client/social.ts
 * --------------------
 * The social layer: hiscores. Written against a small SocialBackend interface so
 * the data source is swappable.
 *
 *  - SupabaseSocialBackend (default): a real shared, identity-backed board. It
 *    reads the global rankings (public) and, when you're signed in, upserts your
 *    own row keyed by your Supabase user — the SAME account as the idle game.
 *  - LocalSocialBackend (fallback): ranks every character saved on this device,
 *    used when Supabase can't be reached so the board is never empty/broken.
 */

import type { Content, SkillId } from "../core/types.ts";
import { levelForXp } from "../content/xpCurve.ts";
import { listAccounts, readSave, readSaveFor } from "./storage.ts";
import { currentUser, rest } from "./supabase.ts";

/** One ranked character on the hiscores board. */
export interface HiscoreEntry {
  name: string;
  totalLevel: number;
  combat: number;
  playMs: number;
  diaries: number;
  monstersSlain: number;
  goldEarned: number;
  /** Supabase user id (shared board only), used to flag your own row. */
  userId?: string;
  /** True for the entry that is the player's own. */
  you?: boolean;
}

export interface SocialBackend {
  /** Push the current character's stats (no-op when signed out / local). */
  submit(entry: HiscoreEntry): Promise<void>;
  /** Fetch the ranked board. */
  hiscores(): Promise<HiscoreEntry[]>;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Build a hiscore entry from a raw save blob (the shape save.ts writes). */
export function entryFromSave(raw: unknown, _content: Content): HiscoreEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const skills = (r["skills"] ?? {}) as Partial<Record<SkillId, number>>;
  const lvl = (id: SkillId): number => levelForXp(skills[id] ?? 0);
  const ids = Object.keys(skills) as SkillId[];
  if (ids.length === 0) return null;
  const totalLevel = ids.reduce((n, id) => n + lvl(id), 0);
  const combat = Math.floor(
    (lvl("ward") + lvl("vitality")) / 4 +
      Math.max((lvl("edge") + lvl("vigour")) / 4, lvl("draw") / 2),
  );
  const app = (r["appearance"] ?? {}) as Record<string, unknown>;
  const stats = (r["stats"] ?? {}) as Record<string, unknown>;
  return {
    name: typeof app["name"] === "string" && app["name"] ? (app["name"] as string) : "Wanderer",
    totalLevel,
    combat,
    playMs: num(r["playMs"]),
    diaries: Array.isArray(r["diariesClaimed"]) ? (r["diariesClaimed"] as unknown[]).length : 0,
    monstersSlain: num(stats["monstersSlain"]),
    goldEarned: num(stats["goldEarned"]),
  };
}

/** Ranks every character saved on this device. Server-free fallback. */
class LocalSocialBackend implements SocialBackend {
  constructor(private content: Content) {}
  async submit(): Promise<void> { /* local reads live saves directly */ }
  async hiscores(): Promise<HiscoreEntry[]> {
    const out: HiscoreEntry[] = [];
    for (const name of listAccounts()) {
      const e = entryFromSave(readSaveFor(name), this.content);
      if (e) out.push(e);
    }
    return out;
  }
}

/** Maps a Supabase row (snake_case) to a HiscoreEntry. */
function rowToEntry(row: Record<string, unknown>): HiscoreEntry {
  const e: HiscoreEntry = {
    name: typeof row["name"] === "string" ? (row["name"] as string) : "Wanderer",
    totalLevel: num(row["total_level"]),
    combat: num(row["combat"]),
    playMs: num(row["play_ms"]),
    diaries: num(row["diaries"]),
    monstersSlain: num(row["monsters_slain"]),
    goldEarned: num(row["gold_earned"]),
  };
  if (typeof row["user_id"] === "string") e.userId = row["user_id"] as string;
  return e;
}

/** The real shared board, backed by Supabase + your account. */
class SupabaseSocialBackend implements SocialBackend {
  async submit(entry: HiscoreEntry): Promise<void> {
    const user = currentUser();
    if (!user) return; // reading is public; writing needs you signed in
    try {
      await rest("world_hiscores?on_conflict=user_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          user_id: user.id,
          name: entry.name,
          total_level: entry.totalLevel,
          combat: entry.combat,
          play_ms: entry.playMs,
          diaries: entry.diaries,
          monsters_slain: entry.monstersSlain,
          gold_earned: entry.goldEarned,
        },
      });
    } catch { /* offline — try again next time the board opens */ }
  }
  async hiscores(): Promise<HiscoreEntry[]> {
    const res = await rest("world_hiscores?select=*");
    if (!res.ok) throw new Error(`hiscores ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data.map(rowToEntry) : [];
  }
}

const supabase = new SupabaseSocialBackend();

/** The shared board (Supabase). Reads are public; submit needs a signed-in user. */
export function getSocial(_content: Content): SocialBackend {
  return supabase;
}

/** Device-local ranking, used as a fallback when the shared board is offline. */
export function getLocal(content: Content): SocialBackend {
  return new LocalSocialBackend(content);
}

/** Push the active character's current stats to the shared board (needs sign-in).
 *  Called when the board opens so friends always see your latest. */
export async function submitCurrent(content: Content): Promise<void> {
  if (!currentUser()) return;
  const entry = entryFromSave(readSave(), content);
  if (entry) await supabase.submit(entry);
}
