/**
 * src/client/social.ts
 * --------------------
 * The async social layer: hiscores. It's written against a small SocialBackend
 * interface so the data source is swappable. By default it uses a LOCAL backend
 * that ranks every character saved on this device (your alts) — fully working
 * with no server. A RemoteSocialBackend (a tiny fetch adapter) can be switched
 * on by setting a `varath.social.endpoint` URL in localStorage, so a real shared
 * leaderboard drops in once you deploy an endpoint — no other code changes.
 */

import type { Content, SkillId } from "../core/types.ts";
import { levelForXp } from "../content/xpCurve.ts";
import { listAccounts, readSaveFor } from "./storage.ts";

/** One ranked character on the hiscores board. */
export interface HiscoreEntry {
  name: string;
  totalLevel: number;
  combat: number;
  playMs: number;
  diaries: number;
  monstersSlain: number;
  goldEarned: number;
  /** True for the entry that is the player's current character. */
  you?: boolean;
}

export interface SocialBackend {
  /** Push the current character's stats (no-op for the local backend). */
  submit(entry: HiscoreEntry): Promise<void>;
  /** Fetch the ranked board. */
  hiscores(): Promise<HiscoreEntry[]>;
}

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
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
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

/** Ranks every character saved on this device. Real, server-free hiscores. */
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

/** Posts to / reads from a shared endpoint (enabled when one is configured). */
class RemoteSocialBackend implements SocialBackend {
  constructor(private base: string) {}
  async submit(entry: HiscoreEntry): Promise<void> {
    try {
      await fetch(`${this.base}/hiscores`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry),
      });
    } catch { /* offline — try again next time */ }
  }
  async hiscores(): Promise<HiscoreEntry[]> {
    try {
      const res = await fetch(`${this.base}/hiscores`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }
}

/** The active backend: remote if an endpoint is configured, else device-local. */
export function getSocial(content: Content): SocialBackend {
  let endpoint: string | null = null;
  try { endpoint = localStorage.getItem("varath.social.endpoint"); } catch { /* ignore */ }
  return endpoint ? new RemoteSocialBackend(endpoint) : new LocalSocialBackend(content);
}
