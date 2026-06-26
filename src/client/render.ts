/**
 * src/client/render.ts
 * --------------------
 * Pure presentation: given the core's WorldState, paint it onto the canvas.
 * The renderer NEVER changes game state (RULE 2) — it only reads it.
 *
 * Palette: dark aged stone, ember and iron.
 */

import type {
  Content,
  TileType,
  Vec2,
  WorldObjectDef,
  WorldState,
} from "../core/types.ts";

export const TILE = 40; // pixels per tile

const TILE_COLORS: Record<TileType, [string, string]> = {
  // [base, accent] — accent is used for subtle per-tile speckle.
  grass: ["#3a4a35", "#45563f"],
  dirt: ["#52412e", "#5e4b36"],
  path: ["#6a5b45", "#77654c"],
  stone: ["#41424b", "#4b4d57"],
  water: ["#1f3346", "#26415a"],
  // Greyoak Wood's floor — deeper, cooler green than hill grass.
  moss: ["#2c3a2a", "#354733"],
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
    drawObject(g, def, obj.available, px, py, now);
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
  def: WorldObjectDef,
  available: boolean,
  px: number,
  py: number,
  now: number,
): void {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  switch (def.kind) {
    case "tree":
      drawTree(g, cx, cy, available, def.species);
      break;
    case "rock":
      drawRock(g, cx, cy, available);
      break;
    case "fishing_spot":
      drawFishingSpot(g, cx, cy, now);
      break;
    case "npc":
      drawNpc(g, cx, cy, now);
      break;
    case "monster":
      if (!available) {
        drawRespawning(g, cx, cy);
      } else if (def.monster === "hill_wolf") {
        drawWolf(g, cx, cy, now);
      } else if (def.monster === "wild_boar") {
        drawBoar(g, cx, cy, now, false);
      } else if (def.monster === "greymane_boar") {
        drawBoar(g, cx, cy, now, true);
      } else if (def.monster === "forest_bear") {
        drawBear(g, cx, cy, now);
      } else {
        drawRat(g, cx, cy, now);
      }
      break;
    case "bank":
      drawBank(g, cx, cy);
      break;
    case "fire":
      drawFire(g, cx, cy, now);
      break;
    case "furnace":
      drawFurnace(g, cx, cy, now);
      break;
    case "anvil":
      drawAnvil(g, cx, cy);
      break;
  }
}

// --- Anvil: an iron horn on a dark stump ---
function drawAnvil(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 12, 4);
  g.fillStyle = "#2f2a26"; // wooden stump base
  g.fillRect(cx - 8, cy + 4, 16, 8);
  g.fillStyle = "#3a342f";
  g.fillRect(cx - 8, cy + 4, 16, 2);
  g.fillStyle = "#54565e"; // iron body
  g.fillRect(cx - 6, cy - 1, 12, 5); // waist
  g.beginPath(); // the top face with its horn
  g.moveTo(cx - 11, cy - 6);
  g.lineTo(cx + 8, cy - 6);
  g.lineTo(cx + 13, cy - 3); // horn tip
  g.lineTo(cx + 8, cy - 1);
  g.lineTo(cx - 8, cy - 1);
  g.closePath();
  g.fill();
  g.fillStyle = "#6c6e77"; // lit top edge
  g.fillRect(cx - 11, cy - 6, 19, 1.5);
}

// --- Bank chest: iron-bound wooden chest ---
function drawBank(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 12, 4);
  g.fillStyle = "#5a4327"; // body
  g.fillRect(cx - 12, cy - 4, 24, 16);
  g.fillStyle = "#6e5331"; // lid
  g.fillRect(cx - 12, cy - 10, 24, 7);
  g.fillStyle = "#3a3a40"; // iron bands
  g.fillRect(cx - 12, cy - 4, 24, 2);
  g.fillRect(cx - 2, cy - 10, 4, 22);
  g.fillStyle = "#c9a24a"; // lock
  g.fillRect(cx - 2, cy + 1, 4, 4);
}

// --- Cooking fire: logs with animated flame ---
function drawFire(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  shadow(g, cx, cy + 11, 12, 4);
  g.strokeStyle = "#4a3320"; // logs
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx - 11, cy + 9);
  g.lineTo(cx + 9, cy + 5);
  g.moveTo(cx - 9, cy + 5);
  g.lineTo(cx + 11, cy + 9);
  g.stroke();
  const flick = 0.7 + 0.3 * Math.sin(now / 120);
  g.fillStyle = "#7d1f15"; // outer flame
  flame(g, cx, cy + 2, 9 * flick, 16 * flick);
  g.fillStyle = "#d2742c"; // mid
  flame(g, cx, cy + 3, 6 * flick, 12 * flick);
  g.fillStyle = "#f2cf6b"; // core
  flame(g, cx, cy + 4, 3 * flick, 7 * flick);
}

function flame(g: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number): void {
  g.beginPath();
  g.moveTo(cx - w, baseY);
  g.quadraticCurveTo(cx - w * 0.6, baseY - h, cx, baseY - h);
  g.quadraticCurveTo(cx + w * 0.6, baseY - h, cx + w, baseY);
  g.quadraticCurveTo(cx, baseY + 3, cx - w, baseY);
  g.fill();
}

// --- Furnace: a small stone furnace with a glowing mouth ---
function drawFurnace(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  shadow(g, cx, cy + 11, 12, 4);
  g.fillStyle = "#4a4b53"; // stone body
  g.beginPath();
  g.moveTo(cx - 12, cy + 12);
  g.lineTo(cx - 9, cy - 11);
  g.lineTo(cx + 9, cy - 11);
  g.lineTo(cx + 12, cy + 12);
  g.closePath();
  g.fill();
  g.fillStyle = "#5b5c64";
  g.fillRect(cx - 11, cy - 13, 22, 4); // chimney rim
  const glow = 0.6 + 0.4 * Math.sin(now / 180);
  g.fillStyle = `rgba(226, 120, 44, ${glow})`; // glowing mouth
  g.beginPath();
  g.arc(cx, cy + 4, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = `rgba(242, 207, 107, ${glow})`;
  g.beginPath();
  g.arc(cx, cy + 4, 2.5, 0, Math.PI * 2);
  g.fill();
}

/** A soft contact shadow under a sprite. */
function shadow(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

// --- Trees: a shared stump when felled; species-specific canopy when standing ---
function drawTree(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  available: boolean,
  species?: string,
): void {
  if (!available) {
    shadow(g, cx, cy + 10, 7, 3);
    g.fillStyle = "#7c6e54";
    g.fillRect(cx - 5, cy + 4, 10, 7); // stump
    g.fillStyle = "#9a8a6e";
    g.fillRect(cx - 5, cy + 4, 10, 2);
    g.fillStyle = "#5a4b34";
    circle(g, cx - 9, cy + 9, 1.6);
    circle(g, cx + 8, cy + 10, 1.4);
    return;
  }
  if (species === "coldpine") return drawColdpine(g, cx, cy);
  if (species === "greyoak") return drawGreyoak(g, cx, cy);
  drawAshwood(g, cx, cy);
}

// Ashwood: pale trunk, layered grey-green canopy.
function drawAshwood(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 12, 12, 4);
  g.fillStyle = "#8d7e60";
  g.fillRect(cx - 3, cy, 6, TILE / 2 - 2);
  g.fillStyle = "#a99a78";
  g.fillRect(cx - 3, cy, 2, TILE / 2 - 2);
  g.fillStyle = "#3f4d2a";
  circle(g, cx - 7, cy - 2, 9);
  circle(g, cx + 7, cy - 2, 9);
  g.fillStyle = "#4e5f34";
  circle(g, cx, cy - 8, 12);
  g.fillStyle = "#5d6e3e";
  circle(g, cx - 3, cy - 11, 7);
  g.fillStyle = "rgba(184,192,150,0.5)";
  circle(g, cx - 4, cy - 12, 3);
}

// Coldpine: a tall, cold blue-green conifer in stacked tiers.
function drawColdpine(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 12, 8, 3);
  g.fillStyle = "#5a4a36"; // narrow trunk
  g.fillRect(cx - 2, cy + 2, 4, TILE / 2 - 4);
  const tier = (baseY: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(cx, baseY - h);
    g.lineTo(cx - w, baseY);
    g.lineTo(cx + w, baseY);
    g.closePath();
    g.fill();
  };
  tier(cy + 6, 11, 12, "#27412f");
  tier(cy + 1, 9, 11, "#2f4d38");
  tier(cy - 4, 7, 10, "#386044");
  g.fillStyle = "rgba(180,205,190,0.35)"; // frost highlight
  circle(g, cx - 2, cy - 9, 2);
}

// Greyoak: a thick grey trunk under a broad, heavy grey-green crown.
function drawGreyoak(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 13, 14, 4);
  g.fillStyle = "#6e6a62"; // thick grey bark
  g.fillRect(cx - 4, cy - 1, 8, TILE / 2);
  g.fillStyle = "#827d73";
  g.fillRect(cx - 4, cy - 1, 3, TILE / 2);
  g.fillStyle = "#33402a"; // wide canopy, layered
  circle(g, cx - 10, cy - 3, 10);
  circle(g, cx + 10, cy - 3, 10);
  circle(g, cx - 4, cy - 6, 11);
  circle(g, cx + 5, cy - 7, 11);
  g.fillStyle = "#46552f";
  circle(g, cx, cy - 11, 12);
  g.fillStyle = "#54663a";
  circle(g, cx - 4, cy - 13, 6);
  g.fillStyle = "rgba(150,165,120,0.4)";
  circle(g, cx - 5, cy - 14, 3);
}

// --- Knucklestone: faceted grey-brown boulder with a warm fleck ---
function drawRock(g: CanvasRenderingContext2D, cx: number, cy: number, available: boolean): void {
  if (!available) {
    shadow(g, cx, cy + 8, 9, 3);
    g.fillStyle = "#4f4a44";
    circle(g, cx - 4, cy + 4, 4);
    circle(g, cx + 5, cy + 5, 3);
    circle(g, cx, cy + 6, 3);
    return;
  }
  shadow(g, cx, cy + 9, 13, 4);
  g.fillStyle = "#5c5650";
  g.beginPath();
  g.moveTo(cx - 13, cy + 6);
  g.lineTo(cx - 9, cy - 7);
  g.lineTo(cx + 2, cy - 11);
  g.lineTo(cx + 12, cy - 4);
  g.lineTo(cx + 13, cy + 7);
  g.closePath();
  g.fill();
  g.fillStyle = "#766e62"; // lit facet
  g.beginPath();
  g.moveTo(cx - 9, cy - 7);
  g.lineTo(cx + 2, cy - 11);
  g.lineTo(cx + 1, cy + 1);
  g.lineTo(cx - 7, cy + 2);
  g.closePath();
  g.fill();
  g.strokeStyle = "#3c3833"; // crevice
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx + 2, cy - 11);
  g.lineTo(cx + 1, cy + 1);
  g.lineTo(cx + 9, cy + 5);
  g.stroke();
  g.fillStyle = EMBER; // geothermal warmth
  g.globalAlpha = 0.5;
  circle(g, cx + 6, cy + 2, 1.6);
  g.globalAlpha = 1;
}

// --- Fishing spot: animated ripples with a fish glint ---
function drawFishingSpot(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const r = 8 + 3 * Math.sin(now / 300);
  g.strokeStyle = "rgba(170,205,225,0.7)";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(205,222,235,0.6)";
  circle(g, cx + Math.cos(now / 500) * 4, cy + Math.sin(now / 380) * 2, 1.6);
}

// --- Aldric: a man in an earthy tunic ---
function drawNpc(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 600) * 0.8;
  shadow(g, cx, cy + 12, 8, 3);
  g.fillStyle = "#3a2f23"; // legs
  g.fillRect(cx - 5, cy + 6 + bob, 4, 7);
  g.fillRect(cx + 1, cy + 6 + bob, 4, 7);
  g.fillStyle = "#5a5238"; // tunic
  g.fillRect(cx - 6, cy - 6 + bob, 12, 14);
  g.fillStyle = "#6b6344";
  g.fillRect(cx - 6, cy - 6 + bob, 12, 3);
  g.fillStyle = "#3a2f23"; // belt
  g.fillRect(cx - 6, cy + 4 + bob, 12, 2);
  g.fillStyle = "#caa472"; // head
  circle(g, cx, cy - 11 + bob, 5);
  g.fillStyle = "#5b4a33"; // hair
  g.beginPath();
  g.arc(cx, cy - 12 + bob, 5, Math.PI, 0);
  g.fill();
}

// --- Moor Rat: small, long-tailed ---
function drawRat(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 200) * 0.6;
  shadow(g, cx, cy + 7, 8, 3);
  g.strokeStyle = "#7a6a55"; // tail
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx + 8, cy + bob);
  g.quadraticCurveTo(cx + 16, cy - 2 + bob, cx + 14, cy - 8 + bob);
  g.stroke();
  g.fillStyle = "#6b5d4a"; // body
  g.beginPath();
  g.ellipse(cx, cy + bob, 9, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#766857"; // head
  circle(g, cx - 8, cy - 1 + bob, 4.5);
  g.fillStyle = "#8a7a64"; // ear
  circle(g, cx - 9, cy - 5 + bob, 2.2);
  g.fillStyle = "#c89a9a"; // nose
  circle(g, cx - 12, cy + 1 + bob, 1.3);
  g.fillStyle = "#1a140f"; // eye
  circle(g, cx - 8, cy - 2 + bob, 1);
}

// --- Hill Wolf: larger, lean and grey ---
function drawWolf(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 240) * 0.7;
  shadow(g, cx, cy + 9, 12, 4);
  g.strokeStyle = "#5f6168"; // tail
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx + 11, cy + 1 + bob);
  g.quadraticCurveTo(cx + 18, cy - 3 + bob, cx + 15, cy - 8 + bob);
  g.stroke();
  g.fillStyle = "#4c4e54"; // legs
  g.fillRect(cx - 6, cy + 4 + bob, 2.5, 6);
  g.fillRect(cx + 4, cy + 4 + bob, 2.5, 6);
  g.fillStyle = "#6f7178"; // body
  g.beginPath();
  g.ellipse(cx, cy + bob, 12, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#80828a"; // back highlight
  g.beginPath();
  g.ellipse(cx, cy - 2 + bob, 10, 3.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#6a6c73"; // head
  circle(g, cx - 11, cy - 2 + bob, 5.5);
  g.fillStyle = "#5c5e64"; // snout
  g.beginPath();
  g.ellipse(cx - 16, cy + bob, 3.5, 2.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5c5e64"; // ears
  g.beginPath();
  g.moveTo(cx - 13, cy - 7 + bob);
  g.lineTo(cx - 11, cy - 12 + bob);
  g.lineTo(cx - 9, cy - 7 + bob);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(cx - 9, cy - 7 + bob);
  g.lineTo(cx - 7, cy - 11 + bob);
  g.lineTo(cx - 6, cy - 6 + bob);
  g.closePath();
  g.fill();
  g.fillStyle = "#d8b24a"; // eye
  circle(g, cx - 12, cy - 2 + bob, 1.1);
}

// --- Wild Boar: stocky, bristled, tusked. Greymane variant is larger + grey. ---
function drawBoar(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  greymane: boolean,
): void {
  const bob = Math.sin(now / 220) * 0.6;
  const s = greymane ? 1.18 : 1; // the Greymane is the bigger, rarer beast
  const body = greymane ? "#6d6a63" : "#4a3f33";
  const back = greymane ? "#838079" : "#5b4f40";
  shadow(g, cx, cy + 9 * s, 13 * s, 4);
  g.fillStyle = "#3a3128"; // legs
  g.fillRect(cx - 7 * s, cy + 4 + bob, 2.5, 7 * s);
  g.fillRect(cx + 4 * s, cy + 4 + bob, 2.5, 7 * s);
  g.fillStyle = body; // barrel body
  g.beginPath();
  g.ellipse(cx, cy + bob, 12 * s, 7.5 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = back; // raised bristled back
  g.beginPath();
  g.ellipse(cx - 1, cy - 3 + bob, 9 * s, 3 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#2a231b"; // bristle ridge
  g.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.moveTo(cx + i * 3, cy - 5 * s + bob);
    g.lineTo(cx + i * 3, cy - 8 * s + bob);
    g.stroke();
  }
  g.fillStyle = body; // head
  g.beginPath();
  g.ellipse(cx - 13 * s, cy + 1 + bob, 6 * s, 5 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2c251d"; // snout
  g.beginPath();
  g.ellipse(cx - 18 * s, cy + 2 + bob, 3 * s, 2.4 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#e8e2d0"; // tusks
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - 17 * s, cy + 3 + bob);
  g.lineTo(cx - 19 * s, cy - 1 + bob);
  g.stroke();
  g.fillStyle = "#1a140f"; // eye
  circle(g, cx - 13 * s, cy - 1 + bob, 1);
}

// --- Forest Bear: large, heavy, dark-furred ---
function drawBear(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 260) * 0.6;
  shadow(g, cx, cy + 11, 15, 5);
  g.fillStyle = "#33271d"; // legs
  g.fillRect(cx - 9, cy + 5 + bob, 4, 8);
  g.fillRect(cx + 5, cy + 5 + bob, 4, 8);
  g.fillStyle = "#4a3a2b"; // bulky body
  g.beginPath();
  g.ellipse(cx, cy + bob, 14, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5a4734"; // shoulder hump
  g.beginPath();
  g.ellipse(cx + 3, cy - 4 + bob, 8, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#4a3a2b"; // head
  circle(g, cx - 12, cy - 3 + bob, 6.5);
  g.fillStyle = "#5a4734"; // muzzle
  g.beginPath();
  g.ellipse(cx - 17, cy - 1 + bob, 4, 3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#33271d"; // ears
  circle(g, cx - 15, cy - 8 + bob, 2.4);
  circle(g, cx - 9, cy - 8 + bob, 2.4);
  g.fillStyle = "#15100b"; // nose + eye
  circle(g, cx - 20, cy - 1 + bob, 1.4);
  circle(g, cx - 12, cy - 4 + bob, 1.1);
}

// --- A faint mark where a monster will respawn ---
function drawRespawning(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = "rgba(120,110,100,0.22)";
  g.beginPath();
  g.ellipse(cx, cy, 9, 5, 0, 0, Math.PI * 2);
  g.fill();
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
