/**
 * src/client/questTrack.ts
 * ------------------------
 * Which quest the player has chosen to "track" — a client display preference
 * (kept in localStorage, not in the save). The Quests tab sets it; the HUD
 * banner and the on-map guidance chevron read it.
 */

const KEY = "varath-tracked-quest";

export function getTrackedQuest(): string | null {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
}

export function setTrackedQuest(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
