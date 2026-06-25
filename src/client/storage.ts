/**
 * src/client/storage.ts
 * ---------------------
 * The only place that touches the browser's localStorage. It reads and writes
 * an opaque blob; the *meaning* of that blob (its shape + validation) lives in
 * the pure core (src/core/save.ts). Everything is wrapped in try/catch so that
 * private-browsing mode or a full disk can never crash the game.
 */

const KEY = "varath-world-save-v1";

/** Read the raw saved object, or null if there's nothing valid stored. */
export function readSave(): unknown | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist a (already-serialised) progress object. Silently no-ops on failure. */
export function writeSave(data: unknown): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable or full — progress just won't persist this time */
  }
}

/** Wipe the saved progress entirely. */
export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing we can do; ignore */
  }
}
