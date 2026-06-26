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
  ObjKind,
  TileType,
  Vec2,
  WorldEvent,
  WorldObjectDef,
  WorldState,
} from "../core/types.ts";
import { BankUI } from "./bankUI.ts";
import type { ContextMenu, MenuItem } from "./contextMenu.ts";
import { Dialogue } from "./dialogue.ts";
import type { Guide } from "./guide.ts";
import { Hud } from "./hud.ts";
import { Minimap } from "./minimap.ts";
import { Camera, drawWorld, TILE } from "./render.ts";
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
};

const EXAMINE_OBJECT: Record<ObjKind, string> = {
  tree: "A pale ashwood — common as dirt, and the forester's first tree.",
  rock: "Soft grey-brown knucklestone, worked easily by any hand.",
  fishing_spot: "Dark ripples at the head of the Redrun; ashfin move below.",
  npc: "Aldric, a Man of the Knuckle Hills, mending a wall.",
  monster: "A wild thing of the hills.",
  bank: "A sturdy iron-bound chest. Your goods are safe in it.",
  fire: "A steady cooking fire. Raw catch goes in; a meal comes out.",
  furnace: "A small stone furnace, hot enough to render ore to bar.",
  anvil: "A pitted iron anvil. Bring bars and a hammer to beat out gear.",
};

const EXAMINE_TILE: Record<TileType, string> = {
  grass: "Tufts of pale hill grass.",
  dirt: "Bare, trodden earth.",
  path: "A worn stone path.",
  stone: "Cold grey stone underfoot.",
  water: "The cold head of the Redrun, where the hill-streams braid.",
};

export class Game {
  private g: CanvasRenderingContext2D;
  private cam: Camera = { x: 0, y: 0 };
  private floats: FloatText[] = [];
  private camInitialised = false;

  private menu: ContextMenu;
  private minimap: Minimap;
  private bank: BankUI;
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
    this.minimap = new Minimap(uiRoot);
    this.bank = new BankUI(uiRoot, bridge.content, (intent) => this.dispatch(intent));

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
        case "OPEN_FORGE":
          this.openForge();
          break;
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
        text: `+${xpSum} XP`,
        color: "#e0b54a",
        born: now,
      });
    }
  }

  /** The anvil's forge menu: pick a piece of gear to beat out of your bars. */
  private openForge(): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);

    const items: MenuItem[] = content.forging.map((r) => {
      const def = content.items[r.output];
      const enough = have(r.input) >= r.count;
      return {
        label: "Forge",
        target: `${def.name} · ${r.count} bar${r.count > 1 ? "s" : ""}`,
        tone: enough ? "action" : "normal",
        onSelect: () => this.dispatch({ type: "FORGE", output: r.output }),
      };
    });

    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    this.menu.show(
      x,
      y,
      "Anvil",
      items,
      "Beat Knucklestone bars into gear. You need a bar for the smallest piece.",
    );
  }

  private positionOf(targetId: string): Vec2 | null {
    if (targetId === "player") return this.bridge.state.player.pos;
    const def = this.bridge.content.objects.find((o) => o.id === targetId);
    return def ? { x: def.x, y: def.y } : null;
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
    const { x: cx, y: cy } = this.toScreen(def.x, def.y);

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
      if (aldric) target = { x: aldric.x, y: aldric.y };
    } else if (step === "hunt") {
      // Point at the nearest living monster.
      const p = this.bridge.state.player.pos;
      let best = Infinity;
      for (const o of this.bridge.content.objects) {
        if (o.kind !== "monster") continue;
        if (!this.bridge.state.objects[o.id]?.available) continue;
        const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
        if (d < best) {
          best = d;
          target = { x: o.x, y: o.y };
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
    if (this.menu.isOpen() || this.bank.isOpen()) return;

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
      this.interactObject(obj.id, { x: obj.x, y: obj.y });
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
      items.push({
        label: VERB[obj.kind],
        target: obj.name,
        tone: "action",
        onSelect: () => this.interactObject(obj.id, { x: obj.x, y: obj.y }),
      });
      items.push({
        label: "Walk here",
        onSelect: () => this.walkBeside({ x: obj.x, y: obj.y }),
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
    return this.bridge.content.objects.find(
      (o) => o.x === tile.x && o.y === tile.y,
    );
  }

  /** Examine text: a monster shows its canon description; others use the map. */
  private examineObject(obj: WorldObjectDef): string {
    if (obj.kind === "monster" && obj.monster) {
      const stats = this.bridge.content.monsters[obj.monster];
      if (stats) return stats.desc;
    }
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
