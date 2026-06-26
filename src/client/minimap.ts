/**
 * src/client/minimap.ts
 * ---------------------
 * Top-right minimap + a full world-map overlay. The minimap shows only the
 * local area currently on screen (centred on the player); a 🗺 button opens the
 * whole continent. Pure presentation — reads the core's state, never changes it.
 */

import type { Content, ObjKind, TileType, Vec2, WorldState } from "../core/types.ts";
import { objectPos } from "../core/worldCore.ts";
import { Camera, TILE } from "./render.ts";

const MM_TILE: Record<TileType, string> = {
  grass: "#34402d",
  dirt: "#473720",
  path: "#5a4d39",
  stone: "#3a3b43",
  water: "#1e3142",
  moss: "#26331f",
  mountain: "#33343c",
  snow: "#9aa6b6",
  bog: "#2c3729",
  ash: "#40332d",
  cave: "#16151c",
  cave_wall: "#0b0a0f",
  deep: "#101d30",
  wall: "#736857",
};

const MM_OBJ: Record<ObjKind, string> = {
  tree: "#5d6e3e",
  rock: "#9a9080",
  fishing_spot: "#6fa0c0",
  npc: "#c9a24a",
  monster: "#cc4a3a",
  bank: "#caa05a",
  fire: "#e08a3a",
  furnace: "#b06a48",
  anvil: "#7a7d86",
  shrine: "#b9b0c8",
};

/** Draw the player as a dark-ringed gold dot at screen px,py. */
function drawPlayerDot(g: CanvasRenderingContext2D, px: number, py: number): void {
  g.fillStyle = "#13100d";
  g.beginPath();
  g.arc(px, py, 3.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f2cf6b";
  g.beginPath();
  g.arc(px, py, 2.1, 0, Math.PI * 2);
  g.fill();
}

export class Minimap {
  private g: CanvasRenderingContext2D;
  private size: number;
  /** Last-draw transform, so a click can be inverted to a world tile. */
  private view = { originX: 0, originY: 0, cell: 1 };

  constructor(
    root: HTMLElement,
    onWorldMap: () => void,
    onWalk: (tile: Vec2) => void,
    size = 132,
  ) {
    this.size = size;
    const panel = document.createElement("div");
    panel.className = "hud-panel hud-minimap";
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.className = "minimap-canvas";
    panel.appendChild(canvas);

    // Tap the minimap to walk toward that spot.
    canvas.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const r = canvas.getBoundingClientRect();
      const sx = (e.clientX - r.left) * (canvas.width / r.width);
      const sy = (e.clientY - r.top) * (canvas.height / r.height);
      onWalk({
        x: Math.round(this.view.originX + sx / this.view.cell - 0.5),
        y: Math.round(this.view.originY + sy / this.view.cell - 0.5),
      });
    });

    // The world-map button, tucked in the minimap's corner.
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "minimap-worldbtn";
    btn.title = "World map";
    btn.textContent = "🗺";
    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      onWorldMap();
    });
    panel.appendChild(btn);

    root.appendChild(panel);
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Could not get a 2D context for the minimap.");
    this.g = g;
  }

  /**
   * Paint the local area that's currently on screen, centred on the camera.
   * viewW/viewH are the main canvas's pixel dimensions.
   */
  draw(
    state: WorldState,
    content: Content,
    cam: Camera,
    viewW: number,
    viewH: number,
  ): void {
    const g = this.g;
    const size = this.size;
    const m = state.map;

    const visW = viewW / TILE;
    const visH = viewH / TILE;
    const span = Math.max(visW, visH); // tiles across the square minimap
    const cell = size / span;
    const centerX = (cam.x + viewW / 2) / TILE; // tile at screen centre
    const centerY = (cam.y + viewH / 2) / TILE;
    const originX = centerX - span / 2; // tile at the minimap's left edge
    const originY = centerY - span / 2;
    this.view = { originX, originY, cell }; // remember, so clicks can invert

    g.fillStyle = "#0c0907";
    g.fillRect(0, 0, size, size);

    // Tiles in the visible window (anything off the map stays background).
    const x0 = Math.floor(originX), x1 = Math.ceil(originX + span);
    const y0 = Math.floor(originY), y1 = Math.ceil(originY + span);
    for (let y = y0; y < y1; y++) {
      if (y < 0 || y >= m.height) continue;
      for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= m.width) continue;
        g.fillStyle = MM_TILE[m.tiles[y * m.width + x]!];
        g.fillRect((x - originX) * cell, (y - originY) * cell, cell + 0.8, cell + 0.8);
      }
    }

    // Objects in the window (dimmed while depleted / respawning).
    for (const def of content.objects) {
      const color = MM_OBJ[def.kind];
      if (!color) continue;
      const obj = state.objects[def.id];
      const p = objectPos(def, obj);
      if (p.x < x0 - 1 || p.x > x1 + 1 || p.y < y0 - 1 || p.y > y1 + 1) continue;
      g.fillStyle = obj && !obj.available ? "rgba(120,110,100,0.5)" : color;
      g.beginPath();
      g.arc((p.x + 0.5 - originX) * cell, (p.y + 0.5 - originY) * cell, Math.max(1.6, cell * 0.32), 0, Math.PI * 2);
      g.fill();
    }

    // A faint frame marking exactly what the main view shows.
    g.strokeStyle = "rgba(242,207,107,0.4)";
    g.lineWidth = 1;
    g.strokeRect(
      (centerX - visW / 2 - originX) * cell,
      (centerY - visH / 2 - originY) * cell,
      visW * cell,
      visH * cell,
    );

    const p = state.player.pos;
    drawPlayerDot(g, (p.x + 0.5 - originX) * cell, (p.y + 0.5 - originY) * cell);
  }
}

/** A full-screen overlay showing the whole continent. */
export class WorldMapModal {
  private backdrop: HTMLElement;
  private g: CanvasRenderingContext2D;
  private open = false;

  constructor(root: HTMLElement, content: Content, onWalk: (tile: Vec2) => void) {
    const m = content.map;
    const cell = 9; // px per tile on the big map
    this.backdrop = document.createElement("div");
    this.backdrop.className = "worldmap-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="worldmap-modal">
        <div class="worldmap-head">
          <span class="worldmap-title">Varath — World Map</span>
          <button class="worldmap-close" type="button">✕</button>
        </div>
        <canvas class="worldmap-canvas" width="${m.width * cell}" height="${m.height * cell}"></canvas>
        <div class="worldmap-hint">Tap anywhere to walk there.</div>
      </div>`;
    const canvas = this.backdrop.querySelector(".worldmap-canvas") as HTMLCanvasElement;
    root.appendChild(this.backdrop);
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Could not get a 2D context for the world map.");
    this.g = g;

    // Tap the map to walk there (then close so you can watch the journey).
    canvas.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const r = canvas.getBoundingClientRect();
      onWalk({
        x: Math.floor(((e.clientX - r.left) / r.width) * m.width),
        y: Math.floor(((e.clientY - r.top) / r.height) * m.height),
      });
      this.close();
    });

    (this.backdrop.querySelector(".worldmap-close") as HTMLElement).addEventListener(
      "pointerdown",
      (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.backdrop.classList.remove("hidden");
  }

  close(): void {
    this.open = false;
    this.backdrop.classList.add("hidden");
  }

  /** Repaint the whole map; called each frame while open so the player moves. */
  draw(
    state: WorldState,
    content: Content,
    cam: Camera,
    viewW: number,
    viewH: number,
  ): void {
    const g = this.g;
    const m = state.map;
    const cell = g.canvas.width / m.width;

    g.fillStyle = "#0c0907";
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);

    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        g.fillStyle = MM_TILE[m.tiles[y * m.width + x]!];
        g.fillRect(x * cell, y * cell, cell + 0.6, cell + 0.6);
      }
    }
    for (const def of content.objects) {
      const color = MM_OBJ[def.kind];
      if (!color) continue;
      const obj = state.objects[def.id];
      const p = objectPos(def, obj);
      g.fillStyle = obj && !obj.available ? "rgba(120,110,100,0.5)" : color;
      g.beginPath();
      g.arc((p.x + 0.5) * cell, (p.y + 0.5) * cell, Math.max(1.6, cell * 0.36), 0, Math.PI * 2);
      g.fill();
    }
    // What the main view currently shows.
    g.strokeStyle = "rgba(255,255,255,0.3)";
    g.lineWidth = 1.5;
    g.strokeRect((cam.x / TILE) * cell, (cam.y / TILE) * cell, (viewW / TILE) * cell, (viewH / TILE) * cell);

    const p = state.player.pos;
    drawPlayerDot(g, (p.x + 0.5) * cell, (p.y + 0.5) * cell);
  }
}
