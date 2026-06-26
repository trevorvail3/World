/**
 * src/client/minimap.ts
 * ---------------------
 * A small top-right minimap. Pure presentation: it reads the core's state and
 * paints a scaled-down view of the whole zone — tiles, objects, the player,
 * and a rectangle showing what the main camera currently sees.
 */

import type { Content, ObjKind, TileType, WorldState } from "../core/types.ts";
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

export class Minimap {
  private g: CanvasRenderingContext2D;
  private size: number;

  constructor(root: HTMLElement, size = 132) {
    this.size = size;
    const panel = document.createElement("div");
    panel.className = "hud-panel hud-minimap";
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.className = "minimap-canvas";
    panel.appendChild(canvas);
    root.appendChild(panel);
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Could not get a 2D context for the minimap.");
    this.g = g;
  }

  /** Paint the minimap. viewW/viewH are the main canvas's pixel dimensions. */
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
    const cell = size / Math.max(m.width, m.height);
    const offX = (size - m.width * cell) / 2;
    const offY = (size - m.height * cell) / 2;

    g.fillStyle = "#0c0907";
    g.fillRect(0, 0, size, size);

    // Tiles
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        g.fillStyle = MM_TILE[m.tiles[y * m.width + x]!];
        g.fillRect(offX + x * cell, offY + y * cell, cell + 0.6, cell + 0.6);
      }
    }

    // Objects (dimmed while depleted / respawning)
    for (const def of content.objects) {
      const color = MM_OBJ[def.kind];
      if (!color) continue;
      const obj = state.objects[def.id];
      g.fillStyle = obj && !obj.available ? "rgba(120,110,100,0.5)" : color;
      g.beginPath();
      g.arc(
        offX + (def.x + 0.5) * cell,
        offY + (def.y + 0.5) * cell,
        Math.max(1.2, cell * 0.35),
        0,
        Math.PI * 2,
      );
      g.fill();
    }

    // Camera viewport rectangle
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.lineWidth = 1;
    g.strokeRect(
      offX + (cam.x / TILE) * cell,
      offY + (cam.y / TILE) * cell,
      (viewW / TILE) * cell,
      (viewH / TILE) * cell,
    );

    // Player marker
    const p = state.player.pos;
    const px = offX + (p.x + 0.5) * cell;
    const py = offY + (p.y + 0.5) * cell;
    g.fillStyle = "#13100d";
    g.beginPath();
    g.arc(px, py, 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2cf6b";
    g.beginPath();
    g.arc(px, py, 2, 0, Math.PI * 2);
    g.fill();
  }
}
