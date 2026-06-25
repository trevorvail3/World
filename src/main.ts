/**
 * src/main.ts
 * -----------
 * The wiring. This is the ONLY place that connects a concrete core to the
 * client. Right now the core is local (it runs in the same browser tab), but
 * because the client only talks to it through the `CoreBridge` seam below,
 * a future multiplayer build can swap this out for a network connection that
 * sends the same intents to a server and receives the same state back — with
 * NO changes to the core or the client (that's the whole point of RULE 2).
 *
 * Note where the impurity lives: the core forbids Date/Math.random, so the
 * client supplies them here, fresh on every call, via the `ctx` object.
 */

import "./style.css";
import { content, playerStart } from "./content/index.ts";
import type { Ctx, Intent } from "./core/types.ts";
import {
  applyIntent,
  buildWalkability,
  createWorld,
  tick,
} from "./core/worldCore.ts";
import { hydratePlayer, serializePlayer } from "./core/save.ts";
import { Dialogue } from "./client/dialogue.ts";
import { Game, type CoreBridge } from "./client/loop.ts";
import { Hud } from "./client/hud.ts";
import { clearSave, readSave, writeSave } from "./client/storage.ts";
import { TitleScreen } from "./client/titleScreen.ts";

// --- The client supplies time + randomness (the core never does). ---
function ctxAt(nowMs: number): Ctx {
  return { now: nowMs, rng: Math.random };
}

// --- Build a fresh, local world. ---
const startNow = performance.now();
const state = createWorld(content, playerStart, ctxAt(startNow));
const walkable = buildWalkability(content);

// Lay any saved progress back onto the fresh world (ignored if missing/invalid).
const restored = hydratePlayer(state, content, readSave());

// --- The local bridge: turn client calls into core calls. ---
const bridge: CoreBridge = {
  state,
  content,
  walkable,
  send(intent: Intent) {
    return applyIntent(state, content, intent, ctxAt(performance.now()));
  },
  tick(nowMs: number) {
    return tick(state, content, ctxAt(nowMs));
  },
};

// --- Grab the page elements and start. ---
const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const hudRoot = document.getElementById("hud") as HTMLElement | null;
const app = document.getElementById("app") as HTMLElement | null;
if (!canvas || !hudRoot || !app) {
  throw new Error("Missing #game / #hud / #app elements in index.html");
}

const hud = new Hud(hudRoot, content);
const dialogue = new Dialogue(app);
const game = new Game(canvas, bridge, hud, dialogue, app);

// --- Autosave: persist progress periodically and whenever the tab is hidden. ---
function persist(): void {
  writeSave(serializePlayer(state.player));
}
window.setInterval(persist, 4000);
window.addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});

// --- Reset button: wipe the save and reload to a clean world. ---
const resetBtn = document.createElement("button");
resetBtn.className = "reset-btn";
resetBtn.type = "button";
resetBtn.textContent = "⟲ Reset";
resetBtn.title = "Erase all saved progress and start over";
resetBtn.addEventListener("click", () => {
  const ok = window.confirm(
    "Reset Varath World? This erases your skills, levels and pack for good.",
  );
  if (!ok) return;
  clearSave();
  window.location.reload();
});
app.appendChild(resetBtn);

// The world starts running immediately (it animates softly), but the title
// screen sits on top and captures taps until the player chooses to enter.
game.start();
new TitleScreen(app, () => {
  hud.log(
    restored
      ? "You return to The Knuckle Hills. Your progress is as you left it."
      : "You step into The Knuckle Hills.",
  );
});
