/**
 * src/client/render.ts
 * --------------------
 * Pure presentation: given the core's WorldState, paint it onto the canvas.
 * The renderer NEVER changes game state (RULE 2) — it only reads it.
 *
 * Palette: dark aged stone, ember and iron.
 */

import type { Content, TileType, Vec2, WorldState } from "../core/types.ts";

export const TILE = 40; // pixels per tile

const TILE_COLORS: Record<TileType, [string, string]> = {
  // [base, accent] — accent is used for subtle per-tile speckle.
  grass: ["#3a4a35", "#45563f"],
  dirt: ["#52412e", "#5e4b36"],
  path: ["#6a5b45", "#77654c"],
  stone: ["#41424b", "#4b4d57"],
  water: ["#1f3346", "#26415a"],
};

const EMBER = "#d2742c";
const IRON = "#8a8f99";

/** A cheap, stable pseudo-noise so tiles get a fixed bit of texture. */
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export interface Camera {
  x: number; // top-left of the view, in pixels
  y: number;
}

export function drawWorld(
  g: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: WorldState,
  content: Content,
  cam: Camera,
  now: number,
): void {
  const w = canvas.width;
  const h = canvas.height;

  g.fillStyle = "#13100d";
  g.fillRect(0, 0, w, h);

  const { map } = state;
  const minX = Math.max(0, Math.floor(cam.x / TILE));
  const minY = Math.max(0, Math.floor(cam.y / TILE));
  const maxX = Math.min(map.width - 1, Math.ceil((cam.x + w) / TILE));
  const maxY = Math.min(map.height - 1, Math.ceil((cam.y + h) / TILE));

  // --- Tiles ---
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const tile = map.tiles[y * map.width + x]!;
      const [base, accent] = TILE_COLORS[tile];
      const px = x * TILE - cam.x;
      const py = y * TILE - cam.y;
      g.fillStyle = base;
      g.fillRect(px, py, TILE, TILE);

      // Speckle for texture.
      const hv = hash(x, y);
      g.fillStyle = accent;
      if (tile === "water") {
        // gentle animated shimmer
        const shimmer = 0.5 + 0.5 * Math.sin(now / 600 + x + y);
        g.globalAlpha = 0.25 + 0.2 * shimmer;
        g.fillRect(px, py + TILE * (0.2 + 0.5 * hv), TILE, 3);
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = 0.5;
        g.fillRect(px + TILE * hv * 0.7, py + TILE * (hv * 0.5), 4, 4);
        g.globalAlpha = 1;
      }

      // faint grid line
      g.strokeStyle = "rgba(0,0,0,0.12)";
      g.lineWidth = 1;
      g.strokeRect(px + 0.5, py + 0.5, TILE, TILE);
    }
  }

  // --- Objects ---
  for (const def of content.objects) {
    const obj = state.objects[def.id];
    if (!obj) continue;
    const px = def.x * TILE - cam.x;
    const py = def.y * TILE - cam.y;
    if (px < -TILE || py < -TILE || px > w || py > h) continue;
    drawObject(g, def.kind, obj.available, px, py, now);
    // Name label
    if (def.kind === "npc" || def.kind === "monster") {
      label(g, def.name, px + TILE / 2, py - 6, def.kind === "monster" ? "#c98" : "#cdbf9a");
    }
  }

  // --- Player ---
  if (state.player.alive) {
    drawPlayer(g, state.player.pos, cam, now);
  }
}

function drawObject(
  g: CanvasRenderingContext2D,
  kind: string,
  available: boolean,
  px: number,
  py: number,
  now: number,
): void {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  switch (kind) {
    case "tree": {
      if (available) {
        g.fillStyle = "#3d2c1c"; // trunk
        g.fillRect(cx - 3, cy, 6, TILE / 2 - 2);
        g.fillStyle = "#54632f"; // canopy
        circle(g, cx, cy - 4, 13);
        g.fillStyle = "#43521f";
        circle(g, cx - 6, cy, 8);
        circle(g, cx + 6, cy, 8);
      } else {
        g.fillStyle = "#3d2c1c";
        g.fillRect(cx - 4, cy + 6, 8, 6); // stump
      }
      break;
    }
    case "rock": {
      if (available) {
        g.fillStyle = "#5b5c64";
        circle(g, cx, cy, 12);
        g.fillStyle = "#74757d";
        circle(g, cx - 3, cy - 3, 4);
        g.fillStyle = EMBER;
        g.globalAlpha = 0.5;
        circle(g, cx + 4, cy + 2, 2);
        g.globalAlpha = 1;
      } else {
        g.fillStyle = "#46474e";
        circle(g, cx - 4, cy + 4, 4);
        circle(g, cx + 4, cy + 4, 3);
      }
      break;
    }
    case "fishing_spot": {
      const r = 8 + 3 * Math.sin(now / 300);
      g.strokeStyle = "rgba(180,210,230,0.7)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, r / 2, 0, Math.PI * 2);
      g.stroke();
      break;
    }
    case "npc": {
      g.fillStyle = "#4b5563"; // robe
      g.fillRect(cx - 7, cy - 6, 14, 18);
      g.fillStyle = "#caa472"; // head
      circle(g, cx, cy - 12, 6);
      break;
    }
    case "monster": {
      if (available) {
        g.fillStyle = "#5a3f2a"; // boar body
        g.beginPath();
        g.ellipse(cx, cy, 14, 9, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#3d2a1b";
        circle(g, cx - 12, cy - 2, 5); // snout
        g.fillStyle = "#d9d2c2";
        circle(g, cx - 15, cy + 1, 1.5); // tusk glint
      } else {
        g.fillStyle = "rgba(120,90,60,0.25)";
        g.beginPath();
        g.ellipse(cx, cy, 10, 6, 0, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
  }
}

function drawPlayer(
  g: CanvasRenderingContext2D,
  pos: Vec2,
  cam: Camera,
  now: number,
): void {
  const cx = pos.x * TILE + TILE / 2 - cam.x;
  const cy = pos.y * TILE + TILE / 2 - cam.y;

  // shadow
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath();
  g.ellipse(cx, cy + 12, 10, 4, 0, 0, Math.PI * 2);
  g.fill();

  // body (iron) with a slight bob while alive
  const bob = Math.sin(now / 180) * 1.2;
  g.fillStyle = IRON;
  g.fillRect(cx - 7, cy - 8 + bob, 14, 18);
  // ember cloak trim
  g.fillStyle = EMBER;
  g.fillRect(cx - 7, cy + 6 + bob, 14, 4);
  // head
  g.fillStyle = "#d8c39a";
  circle(g, cx, cy - 12 + bob, 6);
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function label(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  g.font = "11px 'EB Garamond', serif";
  g.textAlign = "center";
  g.textBaseline = "bottom";
  g.fillStyle = "rgba(0,0,0,0.6)";
  g.fillText(text, x + 1, y + 1);
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.textAlign = "left";
}
