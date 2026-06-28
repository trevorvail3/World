/**
 * src/client/minimap.ts
 * ---------------------
 * Top-right minimap + a full world-map overlay. The minimap shows only the
 * local area currently on screen (centred on the player); a 🗺 button opens the
 * whole continent. Pure presentation — reads the core's state, never changes it.
 */

import type { Content, ObjKind, TileType, Vec2, WorldState } from "../core/types.ts";
import { objectPos } from "../core/worldCore.ts";
import { OVERWORLD_HEIGHT, instanceRectAt } from "../content/map.ts";
import { Camera, TILE } from "./render.ts";
import { iconize } from "./glyph.ts";

/** Tiles across the (square) minimap — a fixed local radius, OSRS-style, so the
 *  area around the character is always the same regardless of the view's zoom. */
const MINIMAP_SPAN = 26;

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
  plank: "#5e4326",
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
  plant_patch: "#6a8a4a",
  tree_patch: "#4e7a3e",
  portal: "#b0593a",
  trap: "#9c7b46",
  bounty_board: "#c8a24a",
  housing_plot: "#d8b066", // a warm hearth-gold marker for a homestead
  build_hotspot: "", // build footings aren't marked on the minimap
  house_door: "#b07a3a", // a home's door
  room_seal: "", // interior wing seals aren't marked on the minimap
  cauldron: "#6f8a6a",
  workbench: "#9a7b4e",
  crafting_table: "#a98a6a",
  cart: "#b89357",
  fountain: "#6fa0c0",
  sawmill: "#9a7b4e",
  critter: "", // ambient wildlife isn't marked on the minimap
  lamppost: "", // street dressing — not marked
  signpost: "#caa05a",
  waystone: "#d2742c",
  agility_obstacle: "#b6d24a",
  relic: "#e8d49a", // pale parchment — a found-lore marker, to draw the curious
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
  private canvas: HTMLCanvasElement;
  /** Backing-store size + DPR last applied, so we only resize on change. */
  private cw = 0;
  private ch = 0;
  private mdpr = 0;
  /** Last-draw transform (CSS px), so a click can be inverted to a world tile. */
  private view = { originX: 0, originY: 0, cell: 1, offX: 0, offY: 0 };

  constructor(
    root: HTMLElement,
    onWorldMap: () => void,
    onWalk: (tile: Vec2) => void,
  ) {
    const panel = document.createElement("div");
    panel.className = "hud-panel hud-minimap";
    const canvas = document.createElement("canvas");
    this.canvas = canvas;
    canvas.className = "minimap-canvas";
    panel.appendChild(canvas);

    // Tap the minimap to walk toward that spot. The view is stored in CSS px
    // with letterbox offsets, so invert through those.
    canvas.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const v = this.view;
      onWalk({
        x: Math.round(v.originX + (sx - v.offX) / v.cell - 0.5),
        y: Math.round(v.originY + (sy - v.offY) / v.cell - 0.5),
      });
    });

    // The world-map button, tucked in the minimap's corner.
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "minimap-worldbtn";
    btn.title = "World map";
    btn.innerHTML = iconize("🗺");
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
   * OSRS-style: a fixed radius around the character, always — independent of the
   * main view's zoom or what fits on screen, and always centred on the player.
   * Square, north-up, no view-frame box.
   */
  draw(
    state: WorldState,
    content: Content,
  ): void {
    const g = this.g;
    const m = state.map;

    // Square element; one fixed tile-span so the local area is always the same.
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    const S = window.innerHeight < 440 ? 76 : 96; // px, square
    if (S !== this.cw || S !== this.ch || dpr !== this.mdpr) {
      this.cw = S; this.ch = S; this.mdpr = dpr;
      this.canvas.width = Math.round(S * dpr);
      this.canvas.height = Math.round(S * dpr);
      this.canvas.style.width = `${S}px`;
      this.canvas.style.height = `${S}px`;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); // work in CSS px below

    // A constant window of tiles, centred on the player (not the camera), so the
    // character sits dead-centre and you always see the same distance around them.
    const cell = S / MINIMAP_SPAN;
    const p = state.player.pos;
    const originX = p.x + 0.5 - MINIMAP_SPAN / 2; // tile at the minimap's left edge
    const originY = p.y + 0.5 - MINIMAP_SPAN / 2;
    this.view = { originX, originY, cell, offX: 0, offY: 0 };

    g.fillStyle = "#0c0907";
    g.fillRect(0, 0, S, S);

    // Inside a sealed instance (a home / arena) the minimap shows only that room.
    const region = instanceRectAt(Math.round(p.x), Math.round(p.y));
    const inRegion = (x: number, y: number): boolean =>
      !region || (x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1);
    const sx = (tx: number): number => (tx - originX) * cell;
    const sy = (ty: number): number => (ty - originY) * cell;

    // Tiles within the fixed window.
    const x0 = Math.floor(originX), x1 = Math.ceil(originX + MINIMAP_SPAN);
    const y0 = Math.floor(originY), y1 = Math.ceil(originY + MINIMAP_SPAN);
    for (let y = y0; y < y1; y++) {
      if (y < 0 || y >= m.height) continue;
      for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= m.width || !inRegion(x, y)) continue;
        g.fillStyle = MM_TILE[m.tiles[y * m.width + x]!];
        g.fillRect(sx(x), sy(y), cell + 0.8, cell + 0.8);
      }
    }

    // Objects in the window (dimmed while depleted / respawning).
    for (const def of content.objects) {
      const color = MM_OBJ[def.kind];
      if (!color) continue;
      const obj = state.objects[def.id];
      const p = objectPos(def, obj);
      if (p.x < x0 - 1 || p.x > x1 + 1 || p.y < y0 - 1 || p.y > y1 + 1) continue;
      if (!inRegion(Math.round(p.x), Math.round(p.y))) continue;
      g.fillStyle = obj && !obj.available ? "rgba(120,110,100,0.5)" : color;
      g.beginPath();
      g.arc(sx(p.x + 0.5), sy(p.y + 0.5), Math.max(1.6, cell * 0.32), 0, Math.PI * 2);
      g.fill();
    }

    drawPlayerDot(g, sx(p.x + 0.5), sy(p.y + 0.5));
  }
}

/** A full-screen overlay showing the whole continent. */
export class WorldMapModal {
  private backdrop: HTMLElement;
  private g: CanvasRenderingContext2D;
  private open = false;

  constructor(root: HTMLElement, content: Content, onWalk: (tile: Vec2) => void) {
    const m = content.map;
    // px per tile, sized so the whole continent fits a sensible modal width.
    const cell = Math.max(4, Math.floor(620 / m.width));
    // Only the overworld is shown; the sealed boss-arena band stays hidden.
    const mapH = OVERWORLD_HEIGHT;
    this.backdrop = document.createElement("div");
    this.backdrop.className = "worldmap-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="worldmap-modal">
        <div class="worldmap-head">
          <span class="worldmap-title">Varath — World Map</span>
          <button class="worldmap-close" type="button">✕</button>
        </div>
        <canvas class="worldmap-canvas" width="${m.width * cell}" height="${mapH * cell}"></canvas>
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
        y: Math.floor(((e.clientY - r.top) / r.height) * OVERWORLD_HEIGHT),
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
    const rows = OVERWORLD_HEIGHT; // only the overworld; arena band stays hidden

    g.fillStyle = "#0c0907";
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);

    for (let y = 0; y < rows; y++) {
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
      if (p.y >= rows) continue; // hide arena-band objects
      g.fillStyle = obj && !obj.available ? "rgba(120,110,100,0.5)" : color;
      g.beginPath();
      g.arc((p.x + 0.5) * cell, (p.y + 0.5) * cell, Math.max(1.6, cell * 0.36), 0, Math.PI * 2);
      g.fill();
    }
    // What the main view currently shows (only while in the overworld).
    if (cam.y / TILE < rows) {
      g.strokeStyle = "rgba(255,255,255,0.3)";
      g.lineWidth = 1.5;
      g.strokeRect((cam.x / TILE) * cell, (cam.y / TILE) * cell, (viewW / TILE) * cell, (viewH / TILE) * cell);
    }

    const p = state.player.pos;
    if (p.y < rows) drawPlayerDot(g, (p.x + 0.5) * cell, (p.y + 0.5) * cell);
  }
}
