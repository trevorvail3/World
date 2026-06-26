/**
 * src/client/loop.ts
 * ------------------
 * The client game loop and all input handling.
 *
 * The loop's job each frame: read the clock, ask the core to advance time
 * (tick), react to the events the core returns (log lines, dialogue, hit
 * numbers), move the camera, and paint. Taps are turned into INTENTS and
 * handed to the core — the loop NEVER edits world state itself (RULE 2).
 *
 * Input is OSRS-flavoured:
 *   - a short tap does the obvious thing (walk there / interact with that),
 *   - a long press (or right-click) opens an action menu (Interact / Walk
 *     here / Examine),
 *   - a marker shows where you tapped, and the thing you're busy with glows.
 */

import type {
  Content,
  Intent,
  ItemId,
  ObjKind,
  SkillAction,
  TileType,
  Vec2,
  WorldEvent,
  WorldObjectDef,
  WorldState,
} from "../core/types.ts";
import { BankUI } from "./bankUI.ts";
import { ShopUI } from "./shopUI.ts";
import { BountyUI } from "./bountyUI.ts";
import type { ContextMenu, MenuItem } from "./contextMenu.ts";
import { Dialogue } from "./dialogue.ts";
import type { Guide } from "./guide.ts";
import { Hud } from "./hud.ts";
import { Minimap, WorldMapModal } from "./minimap.ts";
import { Camera, drawWorld, TILE } from "./render.ts";
import { objectPos } from "../core/worldCore.ts";
import { findPath, pathToAdjacent } from "./pathfinding.ts";

/**
 * The bridge to the core. main.ts builds this so the loop never imports the
 * core directly with its own clock/RNG — keeping the seam where a network
 * connection could slot in later (RULE 2 / multiplayer-ready).
 */
export interface CoreBridge {
  readonly state: WorldState;
  readonly content: Content;
  walkable(x: number, y: number): boolean;
  /** The recipes a station (fire/furnace/anvil) offers. */
  stationRecipes(station: ObjKind): SkillAction[];
  send(intent: Intent): WorldEvent[];
  tick(nowMs: number): WorldEvent[];
}

interface FloatText {
  x: number; // tile coords
  y: number;
  text: string;
  color: string;
  born: number;
  size?: number;
}

interface Marker {
  x: number;
  y: number;
  born: number;
}

interface TapFlash {
  objId: string;
  born: number;
}

interface Press {
  startX: number;
  startY: number;
  tile: Vec2;
  longFired: boolean;
  moved: boolean;
}

const LONG_PRESS_MS = 330;
const MOVE_CANCEL_PX = 12;
const MARKER_LIFE = 600;
const FLASH_LIFE = 450;

/** The verb shown for interacting with each kind of object. */
const VERB: Record<ObjKind, string> = {
  tree: "Chop",
  rock: "Mine",
  fishing_spot: "Fish",
  npc: "Talk to",
  monster: "Attack",
  bank: "Open",
  fire: "Cook at",
  furnace: "Smelt at",
  anvil: "Forge at",
  shrine: "Examine",
  plant_patch: "Tend",
  tree_patch: "Tend",
  portal: "Enter",
  trap: "Set snare",
  bounty_board: "Read",
  cauldron: "Brew at",
  workbench: "Build at",
  crafting_table: "Craft at",
  cart: "Examine",
  fountain: "Examine",
  sawmill: "Mill at",
  critter: "Watch",
};

const EXAMINE_OBJECT: Record<ObjKind, string> = {
  tree: "A pale ashwood — common as dirt, and the forester's first tree.",
  rock: "A workable seam of stone.",
  fishing_spot: "Dark ripples at the head of the Redrun; ashfin move below.",
  npc: "Someone met on the road.",
  monster: "A wild thing of the hills.",
  bank: "A sturdy iron-bound chest. Your goods are safe in it.",
  fire: "A steady cooking fire. Raw catch goes in; a meal comes out.",
  furnace: "A small stone furnace, hot enough to render ore to bar.",
  anvil: "A pitted iron anvil. Bring bars and a hammer to beat out gear.",
  shrine: "A weathered standing stone, older than any road here.",
  plant_patch: "A bed of tilled soil, waiting for a seed.",
  tree_patch: "A cleared plot where a sapling could take root.",
  portal: "A dark archway. Something waits on the other side.",
  trap: "A snare set among the runs and burrows. Patience catches game.",
  bounty_board: "A board of nailed-up notices — slaying contracts, paid in Hunt Marks.",
  cauldron: "A blackened cauldron over coals. Flask in hand, you can brew here.",
  workbench: "A sturdy builder's bench, racked with saws and chisels.",
  crafting_table: "An artisan's table — tanning frame, glass-pipe and a jeweller's vice.",
  cart: "A market stall, its awning faded by weather and woodsmoke.",
  fountain: "A stone fountain, the water bright over old green-stained basins.",
  sawmill: "A sawmill bench — frame-saws, a shaving-horse and a bowyer's vice.",
  critter: "A wild thing, going about its small business. It startles as you near.",
};

const EXAMINE_TILE: Record<TileType, string> = {
  grass: "Tufts of pale hill grass.",
  dirt: "Bare, trodden earth.",
  path: "A worn stone path.",
  stone: "Cold grey stone underfoot.",
  water: "The cold head of the Redrun, where the hill-streams braid.",
  moss: "Deep moss of the Greyoak floor, soft and damp underfoot.",
  mountain: "Sheer Spine rock — no way up here. The pass lies around it.",
  snow: "Hard-packed snow of the high Spine. The wind never quite stops.",
  bog: "Soft Heartmoor ground. The peat keeps whatever it takes whole.",
  ash: "Warm cracked earth of the Ashfen Flats. The ground is uncomfortable to stand on.",
  cave: "The dark floor of the Marrow Deeps. Your torchlight finds no far wall.",
  cave_wall: "Dressed cave rock — too smooth, in places, to be only the dark's work.",
  deep: "The open grey of the Eyeless Sea. It gives back no landmark.",
  wall: "Ironvale's dressed-stone rampart. Old work, and still sound.",
};

/** Examine flavour for the tree species. */
const EXAMINE_TREE: Record<string, string> = {
  ashwood: "A pale ashwood — common as dirt, and the forester's first tree.",
  coldpine: "A cold blue-green pine of the Greyoak edge. Resinous and straight.",
  greyoak: "A wide-canopied greyoak, old before Ironvale was named. Hard timber.",
};

export class Game {
  private g: CanvasRenderingContext2D;
  private cam: Camera = { x: 0, y: 0 };
  private floats: FloatText[] = [];
  private camInitialised = false;

  private menu: ContextMenu;
  private minimap: Minimap;
  private worldMap: WorldMapModal;
  private bank: BankUI;
  private shop: ShopUI;
  private bounty: BountyUI;
  private press: Press | null = null;
  private longTimer: number | null = null;
  private marker: Marker | null = null;
  private tapFlash: TapFlash | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private bridge: CoreBridge,
    private hud: Hud,
    private dialogue: Dialogue,
    uiRoot: HTMLElement,
    menu: ContextMenu,
    private guide: Guide,
  ) {
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Could not get a 2D canvas context.");
    this.g = g;
    this.menu = menu;
    this.worldMap = new WorldMapModal(uiRoot, bridge.content, (tile) => this.walkToWorldTile(tile));
    this.minimap = new Minimap(
      uiRoot,
      () => this.worldMap.show(),
      (tile) => this.walkToWorldTile(tile),
    );
    this.bank = new BankUI(uiRoot, bridge.content, (intent) => this.dispatch(intent));
    this.shop = new ShopUI(uiRoot, bridge.content, (intent) => this.dispatch(intent));
    this.bounty = new BountyUI(uiRoot, bridge.content, (intent) => this.dispatch(intent));

    this.resize();
    window.addEventListener("resize", () => this.resize());

    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    // Suppress the browser's own right-click menu; we provide our own.
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  start(): void {
    this.hud.log("Welcome to The Knuckle Hills.");
    const frame = (now: number) => {
      requestAnimationFrame(frame); // schedule next first so one bad frame can't stop the loop
      this.update(now);
    };
    requestAnimationFrame(frame);
  }

  /** Send an intent and immediately react to its events (for UI actions). */
  dispatch(intent: Intent): void {
    const events = this.bridge.send(intent);
    this.handleEvents(events, performance.now());
  }

  private resize(): void {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  }

  private update(now: number): void {
    // 1) Advance the world and react to what happened.
    const events = this.bridge.tick(now);
    this.handleEvents(events, now);
    this.guide.onEvents(events);

    // 2) Camera follows the player.
    this.followCamera();

    // 3) Paint the world, then the input overlays on top.
    drawWorld(this.g, this.canvas, this.bridge.state, this.bridge.content, this.cam, now);
    this.drawMarker(now);
    this.drawHighlights(now);
    this.drawActivityFeedback(now);
    this.drawGuideTarget(now);
    this.drawQuestMarkers(now);
    this.drawFloats(now);

    // 4) Refresh the HUD readouts and the minimap.
    this.hud.update(this.bridge.state);
    this.minimap.draw(
      this.bridge.state,
      this.bridge.content,
      this.cam,
      this.canvas.width,
      this.canvas.height,
    );
    if (this.worldMap.isOpen()) {
      this.worldMap.draw(
        this.bridge.state,
        this.bridge.content,
        this.cam,
        this.canvas.width,
        this.canvas.height,
      );
    }
  }

  private followCamera(): void {
    const p = this.bridge.state.player.pos;
    const targetX = p.x * TILE + TILE / 2 - this.canvas.width / 2;
    const targetY = p.y * TILE + TILE / 2 - this.canvas.height / 2;
    if (!this.camInitialised) {
      this.cam.x = targetX;
      this.cam.y = targetY;
      this.camInitialised = true;
    } else {
      this.cam.x += (targetX - this.cam.x) * 0.12;
      this.cam.y += (targetY - this.cam.y) * 0.12;
    }
  }

  private handleEvents(events: WorldEvent[], now: number): void {
    let xpSum = 0;
    for (const ev of events) {
      switch (ev.type) {
        case "LOG":
          this.hud.log(ev.message);
          break;
        case "XP_GAINED":
          xpSum += ev.amount;
          break;
        case "LEVEL_UP": {
          const name = this.bridge.content.skills[ev.skill].name;
          this.hud.log(`You reach ${name} level ${ev.level}!`);
          const p = this.bridge.state.player.pos;
          this.floats.push({
            x: p.x,
            y: p.y - 0.5,
            text: `${name} Lv ${ev.level}!`,
            color: "#f2cf6b",
            born: now,
            size: 18,
          });
          break;
        }
        case "INVENTORY_FULL":
          this.hud.log("Your pack is full.");
          break;
        case "DIALOGUE":
          this.dialogue.show(ev.npc, ev.lines);
          break;
        case "PLAYER_DIED":
          this.hud.log("You have been knocked out...");
          break;
        case "PLAYER_RESPAWNED":
          this.hud.log("You wake up, dazed but alive.");
          break;
        case "OPEN_BANK":
          this.bank.show(this.bridge.state);
          break;
        case "OPEN_SHOP": {
          const shopDef = this.bridge.content.shops.find((s) => s.id === ev.shop);
          if (shopDef) this.shop.show(this.bridge.state, shopDef);
          break;
        }
        case "OPEN_PLANT":
          this.openPlant(ev.patchId, ev.patchType);
          break;
        case "OPEN_BOUNTY":
          this.bounty.show(this.bridge.state);
          break;
        case "OPEN_CRAFT":
          this.openCraft(ev.station, ev.objId);
          break;
        case "QUEST_COMPLETED": {
          const p = this.bridge.state.player.pos;
          this.floats.push({
            x: p.x,
            y: p.y - 0.6,
            text: "Quest complete!",
            color: "#f2cf6b",
            born: now,
            size: 17,
          });
          break;
        }
        case "QUEST_CHOICE":
          this.openChoice(ev.quest, ev.prompt, ev.options);
          break;
        case "COMPANION_FOUND": {
          const p = this.bridge.state.player.pos;
          const name = this.bridge.content.items[ev.item]?.name ?? "A companion";
          this.floats.push({ x: p.x, y: p.y - 0.7, text: `🐾 ${name}!`, color: "#9fd07a", born: now, size: 17 });
          break;
        }
        case "ACHIEVEMENT": {
          const p = this.bridge.state.player.pos;
          this.floats.push({ x: p.x, y: p.y - 0.9, text: `🏆 ${ev.name}`, color: "#f2cf6b", born: now, size: 16 });
          break;
        }
        case "DAMAGE": {
          const pos = this.positionOf(ev.targetId);
          if (pos) {
            this.floats.push({
              x: pos.x,
              y: pos.y,
              text: ev.amount > 0 ? String(ev.amount) : "miss",
              color: ev.amount > 0 ? "#e2483a" : "#9aa0a6",
              born: now,
            });
          }
          break;
        }
        default:
          break;
      }
    }
    // One tidy "+N XP" rising off the player per tick, not one per skill.
    if (xpSum > 0) {
      const p = this.bridge.state.player.pos;
      this.floats.push({
        x: p.x,
        y: p.y,
        text: `+${Math.round(xpSum)} XP`,
        color: "#e0b54a",
        born: now,
      });
    }
  }

  /** A station's recipe menu: pick what to make from what you're carrying. */
  private openCraft(station: ObjKind, objId: string): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    const has = (a: SkillAction): boolean => {
      if (a.requires) {
        for (const [item, qty] of Object.entries(a.requires)) {
          if (have(item) < (qty ?? 0)) return false;
        }
      }
      if (a.requiresAny && a.requiresAny.length) {
        if (!a.requiresAny.some((it) => have(it) > 0)) return false;
      }
      return true;
    };

    // Show recipes the player has the level for, that produce something — the
    // ones they can make right now lead the list and are tappable.
    const recipes = this.bridge
      .stationRecipes(station)
      .filter((a) => a.produces && player.skills[a.skill].level >= a.levelReq)
      .sort((a, b) => Number(has(b)) - Number(has(a)) || a.levelReq - b.levelReq);

    const items: MenuItem[] = recipes.map((a) => {
      const out = content.items[a.produces!];
      const ready = has(a);
      return {
        label: out.name,
        target: this.costText(a),
        tone: ready ? "action" : "normal",
        onSelect: () => {
          if (!ready) {
            this.hud.log(`You don't have the materials for ${out.name}.`);
            return;
          }
          this.dispatch({ type: "CRAFT", actionId: a.id, objId });
        },
      };
    });

    if (items.length === 0) {
      this.hud.log("You've nothing to make here yet.");
      return;
    }
    const title = VERB[station].replace(/ at$/, "");
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      title,
      items,
      "Pick a recipe — you'll keep making it until the materials run out.",
    );
  }

  /**
   * A quest's branching question: show each option as a tappable line. Picking
   * one sends a CHOOSE intent; the core sets the flags and advances the quest.
   */
  private openChoice(quest: string, prompt: string, options: string[]): void {
    const items: MenuItem[] = options.map((label, index) => ({
      label,
      tone: "action",
      onSelect: () => {
        this.dispatch({ type: "CHOOSE", quest, option: index });
      },
    }));
    if (items.length === 0) return;
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      prompt,
      items,
      "Choose carefully — this answer is remembered.",
    );
  }

  /** A farming patch's seed menu: what you can plant here right now. */
  private openPlant(patchId: string, patchType: "plant" | "tree"): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    const farmLvl = player.skills.farming.level;

    const crops = Object.values(content.crops)
      .filter((c) => c.type === patchType)
      .sort((a, b) => a.levelReq - b.levelReq);

    const items: MenuItem[] = crops.map((c) => {
      const seeds = have(c.seed);
      const ok = farmLvl >= c.levelReq && seeds > 0;
      const mins = Math.round(c.growthMs / 60000);
      const time = mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`;
      return {
        label: `${c.icon} ${c.name}`,
        target: ok ? `${time} · ${seeds} seed${seeds === 1 ? "" : "s"}` : `Lv ${c.levelReq}`,
        tone: ok ? "action" : "normal",
        onSelect: () => {
          if (farmLvl < c.levelReq) {
            this.hud.log(`You need Farming level ${c.levelReq} to plant ${c.name}.`);
            return;
          }
          if (seeds <= 0) {
            this.hud.log(`You have no ${content.items[c.seed].name}.`);
            return;
          }
          this.dispatch({ type: "PLANT", patchId, crop: c.id });
        },
      };
    });
    if (items.length === 0) return;
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      patchType === "tree" ? "Plant a tree" : "Plant a seed",
      items,
      "Crops grow in real time — come back when they're ripe.",
    );
  }

  /** A short "2× Knucklestone, 1× Charcoal" cost line for a recipe. */
  private costText(a: SkillAction): string {
    const items = this.bridge.content.items;
    const parts: string[] = [];
    if (a.requires) {
      for (const [item, qty] of Object.entries(a.requires)) {
        parts.push(`${qty}× ${items[item as ItemId].name}`);
      }
    }
    if (a.requiresAny && a.requiresAny.length) parts.push("any log");
    return parts.join(", ");
  }

  private positionOf(targetId: string): Vec2 | null {
    if (targetId === "player") return this.bridge.state.player.pos;
    const def = this.bridge.content.objects.find((o) => o.id === targetId);
    if (!def) return null;
    return objectPos(def, this.bridge.state.objects[def.id]);
  }

  // --- Drawing overlays --------------------------------------------------

  private toScreen(tileX: number, tileY: number): Vec2 {
    return {
      x: tileX * TILE + TILE / 2 - this.cam.x,
      y: tileY * TILE + TILE / 2 - this.cam.y,
    };
  }

  private drawMarker(now: number): void {
    if (!this.marker) return;
    const age = now - this.marker.born;
    if (age >= MARKER_LIFE) {
      this.marker = null;
      return;
    }
    const t = Math.max(0, Math.min(1, age / MARKER_LIFE));
    const { x: cx, y: cy } = this.toScreen(this.marker.x, this.marker.y);
    const alpha = 1 - t;

    // An expanding ember ring...
    this.g.globalAlpha = alpha * 0.7;
    this.g.strokeStyle = "#e0b54a";
    this.g.lineWidth = 2;
    this.g.beginPath();
    this.g.arc(cx, cy, TILE * (0.18 + t * 0.3), 0, Math.PI * 2);
    this.g.stroke();

    // ...with a shrinking gold cross at the centre (the classic walk marker).
    const s = TILE * 0.26 * (1 - 0.45 * t);
    this.g.globalAlpha = alpha;
    this.g.strokeStyle = "#f2cf6b";
    this.g.lineWidth = 3;
    this.g.beginPath();
    this.g.moveTo(cx - s, cy - s);
    this.g.lineTo(cx + s, cy + s);
    this.g.moveTo(cx - s, cy + s);
    this.g.lineTo(cx + s, cy - s);
    this.g.stroke();
    this.g.globalAlpha = 1;
  }

  private drawHighlights(now: number): void {
    const player = this.bridge.state.player;

    // Persistent glow on whatever the player is busy with (or walking to).
    const targetId = player.activity.targetId ?? player.pendingInteractId;
    if (targetId) {
      const pos = this.positionOf(targetId);
      if (pos) {
        const { x: cx, y: cy } = this.toScreen(pos.x, pos.y);
        const pulse = 0.45 + 0.3 * Math.sin(now / 200);
        this.g.globalAlpha = pulse;
        this.g.strokeStyle = "#d2742c";
        this.g.lineWidth = 2.5;
        this.g.strokeRect(cx - TILE * 0.46, cy - TILE * 0.46, TILE * 0.92, TILE * 0.92);
        this.g.globalAlpha = 1;
      }
    }

    // A brief ring when an object is tapped.
    if (this.tapFlash) {
      const age = now - this.tapFlash.born;
      if (age >= FLASH_LIFE) {
        this.tapFlash = null;
      } else {
        const pos = this.positionOf(this.tapFlash.objId);
        if (pos) {
          const t = Math.max(0, Math.min(1, age / FLASH_LIFE));
          const { x: cx, y: cy } = this.toScreen(pos.x, pos.y);
          this.g.globalAlpha = 1 - t;
          this.g.strokeStyle = "#f2cf6b";
          this.g.lineWidth = 2;
          this.g.beginPath();
          this.g.arc(cx, cy, TILE * (0.3 + t * 0.35), 0, Math.PI * 2);
          this.g.stroke();
          this.g.globalAlpha = 1;
        }
      }
    }
  }

  /** Enemy HP bar in combat; a progress ring for timed gathering/processing. */
  private drawActivityFeedback(now: number): void {
    const act = this.bridge.state.player.activity;
    if (act.kind === "idle" || !act.targetId) return;
    const def = this.bridge.content.objects.find((o) => o.id === act.targetId);
    if (!def) return;
    const ap = objectPos(def, this.bridge.state.objects[def.id]);
    const { x: cx, y: cy } = this.toScreen(ap.x, ap.y);

    if (act.kind === "combat") {
      const stats = def.monster ? this.bridge.content.monsters[def.monster] : undefined;
      const obj = this.bridge.state.objects[def.id];
      if (stats && obj && obj.hp !== undefined) {
        const w = TILE * 0.7;
        const h = 4;
        const pct = Math.max(0, Math.min(1, obj.hp / stats.hp));
        const bx = cx - w / 2;
        const by = cy - TILE * 0.6;
        this.g.fillStyle = "rgba(0,0,0,0.6)";
        this.g.fillRect(bx - 1, by - 1, w + 2, h + 2);
        this.g.fillStyle = "#3a1410";
        this.g.fillRect(bx, by, w, h);
        this.g.fillStyle = "#c43a23";
        this.g.fillRect(bx, by, w * pct, h);
      }
      return;
    }

    // Timed gathering / cooking / smelting: a filling progress ring.
    if (act.actionInterval > 0) {
      const remain = Math.max(0, act.nextActionAt - now);
      const progress = 1 - Math.min(1, remain / act.actionInterval);
      const r = TILE * 0.42;
      this.g.lineWidth = 3;
      this.g.strokeStyle = "rgba(0,0,0,0.4)";
      this.g.beginPath();
      this.g.arc(cx, cy, r, 0, Math.PI * 2);
      this.g.stroke();
      this.g.strokeStyle = "#e0b54a";
      this.g.beginPath();
      this.g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      this.g.stroke();
    }
  }

  /** A bobbing gold chevron over whatever the onboarding guide points at. */
  private drawGuideTarget(now: number): void {
    const step = this.guide.currentStep;
    let target: { x: number; y: number } | null = null;

    if (step === "greet") {
      const aldric = this.bridge.content.objects.find((o) => o.id === "aldric");
      if (aldric) target = objectPos(aldric, this.bridge.state.objects[aldric.id]);
    } else if (step === "hunt") {
      // Point at the nearest living monster.
      const p = this.bridge.state.player.pos;
      let best = Infinity;
      for (const o of this.bridge.content.objects) {
        if (o.kind !== "monster") continue;
        if (!this.bridge.state.objects[o.id]?.available) continue;
        const op = objectPos(o, this.bridge.state.objects[o.id]);
        const d = (op.x - p.x) ** 2 + (op.y - p.y) ** 2;
        if (d < best) {
          best = d;
          target = op;
        }
      }
    }
    if (!target) return;

    const { x: cx, y: cy } = this.toScreen(target.x, target.y);
    const bob = Math.sin(now / 250) * 4;
    const topY = cy - TILE * 0.7 + bob;
    this.g.fillStyle = "#f2cf6b";
    this.g.beginPath();
    this.g.moveTo(cx - 7, topY - 8);
    this.g.lineTo(cx + 7, topY - 8);
    this.g.lineTo(cx, topY + 2);
    this.g.closePath();
    this.g.fill();
  }

  /** A "!" over an NPC with a quest to give, or "?" when one's ready to hand in. */
  private drawQuestMarkers(now: number): void {
    const player = this.bridge.state.player;
    const quests = this.bridge.content.quests;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);

    for (const obj of this.bridge.content.objects) {
      if (obj.kind !== "npc") continue;
      let mark: "!" | "?" | null = null;

      // Ready to act here: any active quest whose current step targets THIS NPC
      // (the core advances steps at the targeted NPC, not only the giver).
      for (const id of Object.keys(player.quests)) {
        const def = quests.find((q) => q.id === id);
        if (!def) continue;
        const step = def.steps[player.quests[id]!.step];
        if (!step) continue;
        if (step.type === "talk" && step.npc === obj.id) mark = "?";
        else if (step.type === "choice" && step.npc === obj.id) mark = "?";
        else if (step.type === "deliver" && step.npc === obj.id && have(step.item) >= step.count) {
          mark = "?";
        }
      }
      // Otherwise: a new quest available here (mirrors the core's gating so a
      // flag-locked quest doesn't show a false "!").
      if (!mark) {
        const offer = quests.find(
          (q) =>
            q.giver === obj.id &&
            !player.quests[q.id] &&
            !player.questsDone.includes(q.id) &&
            (!q.requires || player.questsDone.includes(q.requires)) &&
            (!q.requiresFlags || q.requiresFlags.every((f) => player.flags.includes(f))) &&
            (!q.blockedByFlags || !q.blockedByFlags.some((f) => player.flags.includes(f))),
        );
        if (offer) mark = "!";
      }
      if (!mark) continue;

      const mp = objectPos(obj, this.bridge.state.objects[obj.id]);
      const { x: cx, y: cy } = this.toScreen(mp.x, mp.y);
      const bob = Math.sin(now / 280) * 3;
      const my = cy - TILE * 0.85 + bob;
      this.g.font = "bold 20px 'Cinzel', serif";
      this.g.textAlign = "center";
      this.g.fillStyle = "rgba(0,0,0,0.6)";
      this.g.fillText(mark, cx + 1, my + 1);
      this.g.fillStyle = mark === "!" ? "#f2cf6b" : "#cde0a0";
      this.g.fillText(mark, cx, my);
    }
    this.g.textAlign = "left";
  }

  private drawFloats(now: number): void {
    const LIFE = 900;
    this.floats = this.floats.filter((f) => now - f.born < LIFE);
    for (const f of this.floats) {
      const t = (now - f.born) / LIFE;
      const px = f.x * TILE + TILE / 2 - this.cam.x;
      const py = f.y * TILE + TILE / 2 - this.cam.y - t * 22;
      this.g.globalAlpha = 1 - t;
      this.g.font = `bold ${f.size ?? 16}px 'Cinzel', serif`;
      this.g.textAlign = "center";
      this.g.fillStyle = "rgba(0,0,0,0.7)";
      this.g.fillText(f.text, px + 1, py + 1);
      this.g.fillStyle = f.color;
      this.g.fillText(f.text, px, py);
      this.g.globalAlpha = 1;
    }
    this.g.textAlign = "left";
  }

  // --- Input -------------------------------------------------------------

  private tileAtScreen(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: Math.floor((sx + this.cam.x) / TILE),
      y: Math.floor((sy + this.cam.y) / TILE),
    };
  }

  private onPointerDown(e: PointerEvent): void {
    e.preventDefault();

    // A tap closes / advances dialogue first; no menu while talking.
    if (this.dialogue.isOpen()) {
      this.dialogue.advance();
      return;
    }
    if (this.menu.isOpen() || this.bank.isOpen() || this.shop.isOpen() || this.worldMap.isOpen()) return;

    const tile = this.tileAtScreen(e.clientX, e.clientY);
    this.press = {
      startX: e.clientX,
      startY: e.clientY,
      tile,
      longFired: false,
      moved: false,
    };

    // Right-click opens the menu immediately; touch/left-click waits for a hold.
    if (e.button === 2) {
      this.openMenu(e.clientX, e.clientY, tile);
      this.press.longFired = true;
      return;
    }
    this.longTimer = window.setTimeout(() => {
      if (this.press && !this.press.moved) {
        this.press.longFired = true;
        this.openMenu(e.clientX, e.clientY, tile);
      }
    }, LONG_PRESS_MS);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.press) return;
    const dx = e.clientX - this.press.startX;
    const dy = e.clientY - this.press.startY;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
      this.press.moved = true;
      this.clearLongTimer();
    }
  }

  private onPointerUp(_e: PointerEvent): void {
    this.clearLongTimer();
    const press = this.press;
    this.press = null;
    if (!press || press.longFired || press.moved) return;
    this.defaultAction(press.tile);
  }

  private clearLongTimer(): void {
    if (this.longTimer !== null) {
      window.clearTimeout(this.longTimer);
      this.longTimer = null;
    }
  }

  /** A plain tap: do the obvious thing for whatever was under the finger. */
  private defaultAction(tile: Vec2): void {
    const obj = this.objectAt(tile);
    if (obj) {
      this.interactObject(obj.id, this.liveTile(obj));
      return;
    }
    this.walkTo(tile);
  }

  private openMenu(screenX: number, screenY: number, tile: Vec2): void {
    const obj = this.objectAt(tile);
    const items: MenuItem[] = [];
    let title: string;
    let description: string;

    if (obj) {
      title = obj.name;
      description = this.examineObject(obj); // shown as the inspect line
      const isShopkeeper =
        obj.kind === "npc" && this.bridge.content.shops.some((s) => s.npc === obj.id);
      items.push({
        label: isShopkeeper ? "Trade with" : VERB[obj.kind],
        target: obj.name,
        tone: "action",
        onSelect: () => this.interactObject(obj.id, this.liveTile(obj)),
      });
      items.push({
        label: "Walk here",
        onSelect: () => this.walkBeside(this.liveTile(obj)),
      });
    } else {
      title = "Ground";
      description = EXAMINE_TILE[this.tileType(tile)];
      if (this.bridge.walkable(tile.x, tile.y)) {
        items.push({
          label: "Walk here",
          tone: "action",
          onSelect: () => this.walkTo(tile),
        });
      }
    }

    this.menu.show(screenX, screenY, title, items, description);
  }

  private objectAt(tile: Vec2) {
    return this.bridge.content.objects.find((o) => {
      const p = objectPos(o, this.bridge.state.objects[o.id]);
      return Math.round(p.x) === tile.x && Math.round(p.y) === tile.y;
    });
  }

  /** The creature/object's current tile (rounded), for pathing toward it. */
  private liveTile(obj: WorldObjectDef): Vec2 {
    const p = objectPos(obj, this.bridge.state.objects[obj.id]);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  /** Examine text: a monster shows its canon description; others use the map. */
  private examineObject(obj: WorldObjectDef): string {
    if (obj.kind === "monster" && obj.monster) {
      const stats = this.bridge.content.monsters[obj.monster];
      if (stats) return stats.desc;
    }
    if (obj.kind === "tree" && obj.species && EXAMINE_TREE[obj.species]) {
      return EXAMINE_TREE[obj.species]!;
    }
    if (obj.kind === "shrine" && obj.lines?.[0]) return obj.lines[0];
    if (obj.kind === "npc") return `${obj.name}, met on the road.`;
    return EXAMINE_OBJECT[obj.kind];
  }

  private tileType(tile: Vec2): TileType {
    const m = this.bridge.state.map;
    if (tile.x < 0 || tile.y < 0 || tile.x >= m.width || tile.y >= m.height) {
      return "grass";
    }
    return m.tiles[tile.y * m.width + tile.x]!;
  }

  private setMarker(tile: Vec2): void {
    this.marker = { x: tile.x, y: tile.y, born: performance.now() };
  }

  private walkTo(tile: Vec2): void {
    const player = this.bridge.state.player;
    if (!this.bridge.walkable(tile.x, tile.y)) {
      this.hud.log("You can't walk there.");
      return;
    }
    const path = findPath(this.bridge.walkable, player.pos, tile);
    if (path.length === 0) return; // already there, or unreachable
    this.setMarker(tile);
    this.dispatch({ type: "MOVE", path });
  }

  /**
   * Walk toward a tile picked on the minimap or world map. The exact tile might
   * be water/wall/off-map, so snap to the nearest walkable tile and path there.
   */
  walkToWorldTile(tile: Vec2): void {
    const target = this.nearestWalkable(tile);
    if (!target) {
      this.hud.log("You can't walk there.");
      return;
    }
    const path = findPath(this.bridge.walkable, this.bridge.state.player.pos, target);
    if (path.length === 0) {
      this.hud.log("There's no path there from here.");
      return;
    }
    this.setMarker(target);
    this.dispatch({ type: "MOVE", path });
  }

  /** The walkable tile nearest a target (spiral search, capped). */
  private nearestWalkable(tile: Vec2): Vec2 | null {
    const tx = Math.round(tile.x), ty = Math.round(tile.y);
    if (this.bridge.walkable(tx, ty)) return { x: tx, y: ty };
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring only
          const x = tx + dx, y = ty + dy;
          if (this.bridge.walkable(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  private walkBeside(tile: Vec2): void {
    const player = this.bridge.state.player;
    const { path, reachable, alreadyAdjacent } = pathToAdjacent(
      this.bridge.walkable,
      player.pos,
      tile,
    );
    if (!reachable || alreadyAdjacent) return;
    this.setMarker(path[path.length - 1] ?? tile);
    this.dispatch({ type: "MOVE", path });
  }

  private interactObject(objId: string, tile: Vec2): void {
    const player = this.bridge.state.player;
    const { path, reachable } = pathToAdjacent(
      this.bridge.walkable,
      player.pos,
      tile,
    );
    if (!reachable) {
      this.hud.log("You can't reach that.");
      return;
    }
    this.setMarker(tile);
    this.tapFlash = { objId, born: performance.now() };
    this.dispatch({ type: "INTERACT", objId, path });
  }
}
