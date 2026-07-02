/**
 * src/client/ops.ts
 * -----------------
 * Launch operations: the small amount of plumbing a public game needs so its
 * one developer can actually see what's happening out there.
 *
 *   1. ERROR CAPTURE — a ring buffer of the last uncaught errors and promise
 *      rejections. Costs nothing, never surfaces to the player, and rides
 *      along with any bug report so "it broke" arrives with the stack trace.
 *   2. TELEMETRY PINGS — one row per session start (version, user-agent,
 *      signed-in or offline). Enough to chart daily players and day-2 return
 *      without any invasive tracking: no behaviour events, no page history.
 *   3. BUG REPORTS — the player writes what happened; the game bundles its own
 *      state (position, levels, quest, recent errors) and inserts the lot into
 *      Supabase. If the table isn't reachable the report is copied to the
 *      clipboard instead, so a Discord paste still carries everything.
 *
 * Everything here is fail-silent: ops must never break the game it watches.
 * The tables + row-level-security this writes to live in server/ops.sql — run
 * that once in the Supabase SQL editor to switch collection on.
 */

import { currentUser, rest } from "./supabase.ts";

/** Bumped by hand on notable public builds; rides on pings and reports. */
export const GAME_VERSION = "0.9.0-beta";

// --- 1) Error capture ---------------------------------------------------------

interface CapturedError { at: string; msg: string }
const recent: CapturedError[] = [];
const MAX_ERRORS = 20;

function capture(msg: string): void {
  try {
    recent.push({ at: new Date().toISOString(), msg: msg.slice(0, 500) });
    if (recent.length > MAX_ERRORS) recent.shift();
  } catch { /* never throw from the watcher */ }
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    capture(`${e.message} @ ${e.filename ?? "?"}:${e.lineno ?? 0}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = (e as PromiseRejectionEvent).reason;
    capture(`unhandled rejection: ${r instanceof Error ? r.message : String(r).slice(0, 300)}`);
  });
}

/** The recent uncaught errors (newest last) — bundled into bug reports. */
export function recentErrors(): CapturedError[] { return [...recent]; }

// --- 2) Telemetry -------------------------------------------------------------

/** One fail-silent ping. `kind` is e.g. "session_start". Fires at most once
 *  per page load per kind, so a reconnect can't double-count a session. */
const pinged = new Set<string>();
export function ping(kind: string): void {
  if (pinged.has(kind)) return;
  pinged.add(kind);
  try {
    void rest("telemetry", {
      method: "POST",
      body: {
        kind,
        version: GAME_VERSION,
        ua: navigator.userAgent.slice(0, 200),
        user_id: currentUser()?.id ?? null,
      },
    }).catch(() => { /* table absent / offline — fine */ });
  } catch { /* never break the game */ }
}

// --- 3) Bug reports ------------------------------------------------------------

/** Set by main.ts once the world exists: a one-line snapshot of where the
 *  player is and what they're doing, attached to every report. */
let stateProvider: (() => Record<string, unknown>) | null = null;
export function setStateProvider(fn: () => Record<string, unknown>): void {
  stateProvider = fn;
}

export interface BugReportResult {
  /** "sent" (landed in Supabase) or "copied" (clipboard fallback). */
  how: "sent" | "copied";
}

/** File a bug report. Tries Supabase first; falls back to the clipboard so the
 *  player can paste it into Discord/email. Throws only if BOTH paths fail. */
export async function reportBug(description: string): Promise<BugReportResult> {
  let state: Record<string, unknown> = {};
  try { state = stateProvider ? stateProvider() : {}; } catch { /* partial is fine */ }
  const report = {
    description: description.slice(0, 2000),
    state,
    errors: recentErrors(),
    ua: navigator.userAgent.slice(0, 200),
    version: GAME_VERSION,
    user_id: currentUser()?.id ?? null,
  };
  try {
    const res = await rest("bug_reports", {
      method: "POST",
      body: {
        description: report.description,
        state: { ...report.state, errors: report.errors },
        ua: report.ua,
        version: report.version,
        user_id: report.user_id,
      },
    });
    if (res.ok || res.status === 201) return { how: "sent" };
  } catch { /* fall through to clipboard */ }
  await navigator.clipboard.writeText(
    `VARATH BUG REPORT (${report.version})\n${report.description}\n\n` +
    `state: ${JSON.stringify(report.state)}\nerrors: ${JSON.stringify(report.errors)}\nua: ${report.ua}`,
  );
  return { how: "copied" };
}
