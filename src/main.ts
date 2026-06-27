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
 * Startup flow: a local "log in" screen picks (or creates) a character account;
 * a new character goes through the colour creator first. Only then is the world
 * built and the chosen save laid onto it.
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
import {
  clearSave,
  listAccounts,
  readSave,
  setCurrentAccount,
  writeSave,
} from "./client/storage.ts";
import { LoginScreen } from "./client/login.ts";
import { CharacterCreator, type CreatedCharacter } from "./client/characterCreator.ts";

// The opening atmosphere lines — mood first, mechanics never. Framed as legend
// (never stated as fact) to honour the world's load-bearing ambiguity.
const INTRO_LINES = [
  "They say there were Two, before the world began. One perished — and the stone, the river, the mountain are his body still, and remember being a god.",
  "The other remained: the pale moon, who watches — and will not say what she did, or why.",
  "You come to the Knuckle Hills with empty hands, and a road that asks only that you walk it.",
];

// --- The client supplies time + randomness (the core never does). ---
// `now` is monotonic (resets per reload); `epoch` is wall-clock, for farming.
function ctxAt(nowMs: number): Ctx {
  return { now: nowMs, rng: Math.random, epoch: Date.now() };
}

// --- Grab the page elements up front. ---
const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const hudRoot = document.getElementById("hud") as HTMLElement | null;
const app = document.getElementById("app") as HTMLElement | null;
if (!canvas || !hudRoot || !app) {
  throw new Error("Missing #game / #hud / #app elements in index.html");
}

// --- Log in: pick an existing character or make a new one, then boot. ---
function showLogin(): void {
  new LoginScreen(app!, listAccounts(), {
    onLogin: (name) => { setCurrentAccount(name); boot(null); },
    onNew: () => {
      new CharacterCreator(app!, {
        takenNames: listAccounts(),
        onBack: () => showLogin(),
        onCreate: (c) => { setCurrentAccount(c.name); boot(c); },
      });
    },
  });
}

// --- Build the world for the chosen account and start playing. ---
function boot(newChar: CreatedCharacter | null): void {
  const startNow = performance.now();
  const state = createWorld(content, playerStart, ctxAt(startNow));
  const walkable = buildWalkability(content, state);

  // Lay any saved progress back onto the fresh world (ignored if missing).
  const restored = hydratePlayer(state, content, readSave());
  // A brand-new character stamps its full look (name, colours, styles).
  if (newChar) {
    state.player.appearance = { ...newChar };
  }

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

  // Once wiped, no autosave may run again this session — otherwise the reload's
  // own `pagehide` would re-serialise the player and resurrect the cleared save.
  let wiped = false;

  // Reset wipes this account's save and returns to the login screen.
  const resetProgress = (): void => {
    const ok = window.confirm(
      "Reset this character? This erases their skills, levels and pack for good.",
    );
    if (!ok) return;
    wiped = true;
    clearSave();
    window.location.reload();
  };

  const menu = new ContextMenu(app!);
  const guide = new Guide(app!);
  let game: Game;
  const dispatch = (intent: Intent): void => game.dispatch(intent);
  // `game` is assigned just below; the slider may read zoom during Hud build,
  // so guard until the loop exists (the HUD re-syncs the slider each frame).
  const hud = new Hud(hudRoot!, content, resetProgress, menu, dispatch, {
    get: () => game?.getZoom() ?? 1,
    set: (z) => game?.setZoom(z),
  });
  const dialogue = new Dialogue(app!);
  game = new Game(canvas!, bridge, hud, dialogue, app!, menu, guide);

  // A discreet "Saved" flash so the player knows progress persists on its own.
  const saveTag = document.createElement("div");
  saveTag.className = "save-tag";
  saveTag.textContent = "Saved";
  hudRoot!.appendChild(saveTag);

  // Autosave: periodically and whenever the tab is hidden.
  const persist = (showTag = false): void => {
    if (wiped) return;
    writeSave(serializePlayer(state));
    if (showTag) {
      saveTag.classList.remove("show");
      void saveTag.offsetWidth; // restart the fade
      saveTag.classList.add("show");
    }
  };
  window.setInterval(() => persist(true), 4000);
  window.addEventListener("pagehide", () => persist(false));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist(false);
  });

  // Write an immediate save so a brand-new character's name and colours survive
  // a quit inside the first autosave window (4s).
  persist();

  game.start();

  const enter = (): void => {
    hud.log(
      restored
        ? `Welcome back, ${state.player.appearance.name}. The hills are as you left them.`
        : `You set foot on the Knuckle Hills, ${state.player.appearance.name}. An old man waves from the clearing.`,
    );
    if (!restored) guide.start();
  };
  // New characters get the atmosphere intro; returning players drop straight in.
  if (restored) enter();
  else new Intro(app!, INTRO_LINES, enter);
}

showLogin();
