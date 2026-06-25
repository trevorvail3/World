/**
 * src/client/loop.ts
 * ------------------
 * The client game loop and all input handling.
 *
 * The loop's job each frame: read the clock, ask the core to advance time
 * (tick), react to the events the core returns (log lines, dialogue, hit
 * numbers), move the camera, and paint. Taps are turned into INTENTS and
 * handed to the core — the loop NEVER edits world state itself (RULE 2).
 */

import type {
  Content,
  Intent,
  Vec2,
  WorldEvent,
  WorldState,
} from "../core/types.ts";
import { Dialogue } from "./dialogue.ts";
import { Hud } from "./hud.ts";
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

export class Game {
  private g: CanvasRenderingContext2D;
  private cam: Camera = { x: 0, y: 0 };
  private floats: FloatText[] = [];
  private camInitialised = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private bridge: CoreBridge,
    private hud: Hud,
    private dialogue: Dialogue,
  ) {
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Could not get a 2D canvas context.");
    this.g = g;

    this.resize();
    window.addEventListener("resize", () => this.resize());
    canvas.addEventListener("pointerdown", (e) => this.onTap(e));
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

    // 3) Paint.
    drawWorld(this.g, this.canvas, this.bridge.state, this.bridge.content, this.cam, now);
    this.drawFloats(now);

    // 4) Refresh the HUD readouts.
    this.hud.update(this.bridge.state);
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

  private onTap(e: PointerEvent): void {
    e.preventDefault();

    // A tap closes / advances dialogue first.
    if (this.dialogue.isOpen()) {
      this.dialogue.advance();
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const tx = Math.floor((sx + this.cam.x) / TILE);
    const ty = Math.floor((sy + this.cam.y) / TILE);

    // Did we tap an interactive object?
    const obj = this.bridge.content.objects.find((o) => o.x === tx && o.y === ty);
    if (obj) {
      this.handleObjectTap(obj.id, { x: obj.x, y: obj.y });
      return;
    }

    // Otherwise, try to walk there.
    const player = this.bridge.state.player;
    if (!this.bridge.walkable(tx, ty)) {
      this.hud.log("You can't walk there.");
      return;
    }
    const path = findPath(this.bridge.walkable, player.pos, { x: tx, y: ty });
    if (path.length === 0) {
      return; // already there, or unreachable
    }
    this.bridge.send({ type: "MOVE", path });
  }

  private handleObjectTap(objId: string, tile: Vec2): void {
    const player = this.bridge.state.player;
    const { path, reachable, alreadyAdjacent } = pathToAdjacent(
      this.bridge.walkable,
      player.pos,
      tile,
    );
    if (!reachable) {
      this.hud.log("You can't reach that.");
      return;
    }
    // Empty path + alreadyAdjacent → interact immediately; otherwise walk then act.
    void alreadyAdjacent;
    this.bridge.send({ type: "INTERACT", objId, path });
  }
}
