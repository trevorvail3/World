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
  stationActions,
  tick,
} from "./core/worldCore.ts";
import { hydratePlayer, serializePlayer } from "./core/save.ts";
import { ContextMenu } from "./client/contextMenu.ts";
import { Dialogue } from "./client/dialogue.ts";
import { Guide } from "./client/guide.ts";
import { Intro } from "./client/intro.ts";
import { Game, type CoreBridge } from "./client/loop.ts";
import { Hud } from "./client/hud.ts";
import { clearSave, readSave, writeSave } from "./client/storage.ts";
import { TitleScreen } from "./client/titleScreen.ts";

// The opening atmosphere lines — mood first, mechanics never. Framed as legend
// (never stated as fact) to honour the world's load-bearing ambiguity.
const INTRO_LINES = [
  "They say there were Two, before the world began. One perished — and the stone, the river, the mountain are his body still, and remember being a god.",
  "The other remained: the pale moon, who watches — and will not say what she did, or why.",
  "You come to the Knuckle Hills with empty hands, and a road that asks only that you walk it.",
];

// --- The client supplies time + randomness (the core never does). ---
function ctxAt(nowMs: number): Ctx {
  return { now: nowMs, rng: Math.random };
}

// --- Build a fresh, local world. ---
const startNow = performance.now();
const state = createWorld(content, playerStart, ctxAt(startNow));
const walkable = buildWalkability(content, state);

// Lay any saved progress back onto the fresh world (ignored if missing/invalid).
const restored = hydratePlayer(state, content, readSave());

// --- The local bridge: turn client calls into core calls. ---
const bridge: CoreBridge = {
  state,
  content,
  walkable,
  stationRecipes(station) {
    return stationActions(content, station);
  },
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

// --- Reset: wipe the save and reload (lives in the Settings tab). ---
function resetProgress(): void {
  const ok = window.confirm(
    "Reset Varath World? This erases your skills, levels and pack for good.",
  );
  if (!ok) return;
  clearSave();
  window.location.reload();
}

// One shared action/inspect menu for both the world and the inventory.
const menu = new ContextMenu(app);
const guide = new Guide(app);

// Late-bound so UI actions (e.g. eating from the pack) route through the game.
let game: Game;
const dispatch = (intent: Intent): void => game.dispatch(intent);

const hud = new Hud(hudRoot, content, resetProgress, menu, dispatch);
const dialogue = new Dialogue(app);
game = new Game(canvas, bridge, hud, dialogue, app, menu, guide);

// --- Autosave: persist progress periodically and whenever the tab is hidden. ---
function persist(): void {
  writeSave(serializePlayer(state.player));
}
window.setInterval(persist, 4000);
window.addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});

// The world starts running immediately (it animates softly), but the title
// screen sits on top and captures taps until the player chooses to enter.
game.start();
new TitleScreen(app, () => {
  // Tapping "Enter" plays the atmosphere intro, then drops into the world.
  // New players get the gentle onboarding guide; returning players don't.
  new Intro(app, INTRO_LINES, () => {
    hud.log(
      restored
        ? "You return to The Knuckle Hills. Your progress is as you left it."
        : "You step into The Knuckle Hills.",
    );
    if (!restored) guide.start();
  });
});
