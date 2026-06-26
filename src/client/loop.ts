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
import type { ContextMenu, MenuItem } from "./contextMenu.ts";
import { Dialogue } from "./dialogue.ts";
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
};

const EXAMINE_OBJECT: Record<ObjKind, string> = {
  tree: "A pale ashwood — common as dirt, and the forester's first tree.",
  rock: "Soft grey-brown knucklestone, worked easily by any hand.",
  fishing_spot: "Dark ripples at the head of the Redrun; ashfin move below.",
  npc: "Aldric, a Man of the Knuckle Hills, mending a wall.",
  monster: "A wild thing of the hills.",
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
  ) {
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Could not get a 2D canvas context.");
    this.g = g;
    this.menu = menu;
    this.minimap = new Minimap(uiRoot);

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
      this.update(now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private resize(): void {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  }

  private update(now: number): void {
    // 1) Advance the world and react to what happened.
    const events = this.bridge.tick(now);
    this.handleEvents(events, now);

    // 2) Camera follows the player.
    this.followCamera();

    // 3) Paint the world, then the input overlays on top.
    drawWorld(this.g, this.canvas, this.bridge.state, this.bridge.content, this.cam, now);
    this.drawMarker(now);
    this.drawHighlights(now);
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
    for (const ev of events) {
      switch (ev.type) {
        case "LOG":
          this.hud.log(ev.message);
          break;
        case "LEVEL_UP":
          this.hud.log(
            `You reach ${this.bridge.content.skills[ev.skill].name} level ${ev.level}!`,
          );
          break;
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
    const t = age / MARKER_LIFE;
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
          const t = age / FLASH_LIFE;
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

  private drawFloats(now: number): void {
    const LIFE = 900;
    this.floats = this.floats.filter((f) => now - f.born < LIFE);
    for (const f of this.floats) {
      const t = (now - f.born) / LIFE;
      const px = f.x * TILE + TILE / 2 - this.cam.x;
      const py = f.y * TILE + TILE / 2 - this.cam.y - t * 22;
      this.g.globalAlpha = 1 - t;
      this.g.font = "bold 16px 'Cinzel', serif";
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
    if (this.menu.isOpen()) return;

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
    this.bridge.send({ type: "MOVE", path });
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
    this.bridge.send({ type: "MOVE", path });
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
    this.bridge.send({ type: "INTERACT", objId, path });
  }
}
