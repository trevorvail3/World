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
import { Dialogue } from "./client/dialogue.ts";
import { Game, type CoreBridge } from "./client/loop.ts";
import { Hud } from "./client/hud.ts";
import { TitleScreen } from "./client/titleScreen.ts";

// --- The client supplies time + randomness (the core never does). ---
function ctxAt(nowMs: number): Ctx {
  return { now: nowMs, rng: Math.random };
}

// --- Build a fresh, local world. ---
const startNow = performance.now();
const state = createWorld(content, playerStart, ctxAt(startNow));
const walkable = buildWalkability(content);

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

// The world starts running immediately (it animates softly), but the title
// screen sits on top and captures taps until the player chooses to enter.
game.start();
new TitleScreen(app, () => {
  hud.log("You step into The Knuckle Hills.");
});
