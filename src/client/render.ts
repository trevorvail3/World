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
import { objectPos } from "../core/worldCore.ts";

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
  // The Spine: dark rock peaks and pale high snow.
  mountain: ["#3a3a42", "#4a4a54"],
  snow: ["#aeb8c6", "#c2ccd8"],
  // Heartmoor: murky moor; Ashfen: warm ash; Marrow: dark cave; Eyeless Sea: deep.
  bog: ["#33402f", "#3d4a37"],
  ash: ["#4a3b34", "#574740"],
  cave: ["#1c1a22", "#26232e"],
  cave_wall: ["#0e0d12", "#15131a"],
  deep: ["#14233a", "#1a2c46"],
  // Ironvale's dressed-stone walls and buildings — warm masonry, lit.
  wall: ["#6b6157", "#7c7165"],
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
      if (tile === "water" || tile === "deep") {
        // gentle animated shimmer
        const shimmer = 0.5 + 0.5 * Math.sin(now / 600 + x + y);
        g.globalAlpha = 0.25 + 0.2 * shimmer;
        g.fillRect(px, py + TILE * (0.2 + 0.5 * hv), TILE, 3);
        g.globalAlpha = 1;
      } else if (tile === "cave_wall") {
        // a solid dark rock block with a faint top edge
        g.globalAlpha = 0.5;
        g.fillRect(px, py, TILE, 3);
        g.globalAlpha = 1;
      } else if (tile === "mountain") {
        // A raised peak: a dark rock pyramid with a pale, snow-lit crown.
        const cxp = px + TILE / 2;
        g.fillStyle = "#2a2a31";
        g.beginPath();
        g.moveTo(cxp, py + 4);
        g.lineTo(px + TILE - 3, py + TILE - 3);
        g.lineTo(px + 3, py + TILE - 3);
        g.closePath();
        g.fill();
        g.fillStyle = "#5a5b66"; // lit face
        g.beginPath();
        g.moveTo(cxp, py + 4);
        g.lineTo(cxp, py + TILE - 3);
        g.lineTo(px + 3, py + TILE - 3);
        g.closePath();
        g.fill();
        g.fillStyle = "#d8dde6"; // snow cap
        g.beginPath();
        g.moveTo(cxp, py + 4);
        g.lineTo(cxp + 5, py + 12);
        g.lineTo(cxp - 5, py + 12);
        g.closePath();
        g.fill();
      } else {
        g.globalAlpha = 0.5;
        g.fillRect(px + TILE * hv * 0.7, py + TILE * (hv * 0.5), 4, 4);
        g.globalAlpha = 1;
      }

      // faint grid line (skip on the busy mountain tiles)
      if (tile !== "mountain") {
        g.strokeStyle = "rgba(0,0,0,0.12)";
        g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, TILE, TILE);
      }
    }
  }

  // --- Objects ---
  for (const def of content.objects) {
    const obj = state.objects[def.id];
    if (!obj) continue;
    // Creatures render at their live (wandering) position; fixed objects at def.
    const p = objectPos(def, obj);
    const px = p.x * TILE - cam.x;
    const py = p.y * TILE - cam.y;
    if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
    if (def.kind === "plant_patch" || def.kind === "tree_patch") {
      drawPatch(g, obj.crop, obj.plantedAt, content, px, py);
    } else {
      drawObject(g, def, obj.available, px, py, now);
    }
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

/** A farming patch: bare tilled soil, a growing sprout, or a ripe crop. */
function drawPatch(
  g: CanvasRenderingContext2D,
  crop: string | undefined,
  plantedAt: number | undefined,
  content: Content,
  px: number,
  py: number,
): void {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  // Tilled soil bed.
  g.fillStyle = "#3f2e20";
  g.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
  g.strokeStyle = "rgba(0,0,0,0.3)";
  g.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(px + 5, py + 5 + i * (TILE - 10) / 4);
    g.lineTo(px + TILE - 5, py + 5 + i * (TILE - 10) / 4);
    g.stroke();
  }
  const def = crop ? content.crops[crop] : undefined;
  if (!def || plantedAt === undefined) return;
  const elapsed = Date.now() - plantedAt;
  const frac = Math.max(0, Math.min(1, elapsed / def.growthMs));
  const ripe = frac >= 1;
  if (ripe) {
    // A soft gold ring marks a patch ready to harvest.
    g.strokeStyle = "rgba(242,207,107,0.8)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, TILE * 0.42, 0, Math.PI * 2);
    g.stroke();
  }
  // The crop icon, scaling up as it matures.
  const size = (ripe ? 20 : 9 + frac * 9) * (def.type === "tree" ? 1.1 : 1);
  g.font = `${size}px serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.globalAlpha = ripe ? 1 : 0.55 + frac * 0.4;
  g.fillText(def.icon, cx, cy);
  g.globalAlpha = 1;
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
      drawMonster(g, def.monster, available, cx, cy, now);
      break;

    case "shrine":
      drawShrine(g, cx, cy);
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
    case "portal":
      drawPortal(g, cx, cy, now);
      break;
    case "trap":
      drawTrap(g, cx, cy, available);
      break;
    case "bounty_board":
      drawBountyBoard(g, cx, cy);
      break;
    case "cauldron":
      drawCauldron(g, cx, cy, now);
      break;
    case "workbench":
      drawWorkbench(g, cx, cy);
      break;
  }
}

/** A Herblore cauldron: a black pot over coals with a faint green simmer. */
function drawCauldron(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  shadow(g, cx, cy + 10, 12, 4);
  // Glowing coals beneath.
  const glow = 0.5 + 0.5 * Math.sin(now / 300);
  g.fillStyle = `rgba(214,110,40,${0.45 + 0.35 * glow})`;
  g.beginPath();
  g.ellipse(cx, cy + 8, 9, 3, 0, 0, Math.PI * 2);
  g.fill();
  // The iron pot.
  g.fillStyle = "#26242a";
  g.beginPath();
  g.moveTo(cx - 9, cy - 1);
  g.quadraticCurveTo(cx - 11, cy + 7, cx, cy + 8);
  g.quadraticCurveTo(cx + 11, cy + 7, cx + 9, cy - 1);
  g.closePath();
  g.fill();
  // The rim.
  g.fillStyle = "#3b3942";
  g.fillRect(cx - 10, cy - 3, 20, 3);
  // A bubbling green brew.
  g.fillStyle = `rgba(120,180,96,${0.7 + 0.3 * glow})`;
  g.beginPath();
  g.ellipse(cx, cy - 2, 8, 2.4, 0, 0, Math.PI * 2);
  g.fill();
  // A rising bubble.
  g.fillStyle = "rgba(150,200,120,0.55)";
  g.beginPath();
  g.arc(cx + 2, cy - 5 - 2 * glow, 1.4, 0, Math.PI * 2);
  g.fill();
}

/** A Construction workbench: a timber bench with a board and tools. */
function drawWorkbench(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 10, 13, 4);
  // Legs.
  g.fillStyle = "#3a2c1d";
  g.fillRect(cx - 11, cy + 1, 3, 10);
  g.fillRect(cx + 8, cy + 1, 3, 10);
  // The benchtop.
  g.fillStyle = "#7a5a34";
  g.fillRect(cx - 13, cy - 4, 26, 6);
  g.fillStyle = "#8a6a40";
  g.fillRect(cx - 13, cy - 4, 26, 2);
  // A plank being worked, with plank lines.
  g.fillStyle = "#a07a44";
  g.fillRect(cx - 9, cy - 7, 16, 4);
  g.strokeStyle = "rgba(60,40,20,0.5)";
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(cx - 9, cy - 5);
  g.lineTo(cx + 7, cy - 5);
  g.stroke();
  // A saw leaning against the bench.
  g.strokeStyle = "#b9bcc4";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx + 9, cy - 6);
  g.lineTo(cx + 13, cy + 2);
  g.stroke();
}

/** A Hunter snare: a bent-sapling spring trap. Greyed/sprung when depleted. */
function drawTrap(g: CanvasRenderingContext2D, cx: number, cy: number, available: boolean): void {
  shadow(g, cx, cy + 10, 10, 3);
  const wood = available ? "#7a5a32" : "#4a4038";
  const cord = available ? "#c9b079" : "#6b6258";
  // Two stakes and a noose loop on the ground.
  g.strokeStyle = wood;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(cx - 7, cy + 6);
  g.lineTo(cx - 7, cy - 4);
  g.moveTo(cx + 7, cy + 6);
  g.lineTo(cx + 7, cy - 4);
  g.stroke();
  // The snare loop (open when set, slack when sprung).
  g.strokeStyle = cord;
  g.lineWidth = 1.6;
  g.beginPath();
  if (available) {
    g.ellipse(cx, cy + 3, 6, 3.4, 0, 0, Math.PI * 2);
  } else {
    g.moveTo(cx - 6, cy + 5);
    g.quadraticCurveTo(cx, cy + 9, cx + 6, cy + 5);
  }
  g.stroke();
  // A trigger line strung between the stakes.
  g.strokeStyle = cord;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - 7, cy - 3);
  g.lineTo(cx + 7, cy - 3);
  g.stroke();
}

/** A Bounty board: a notice board of nailed-up contracts. */
function drawBountyBoard(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 13, 4);
  // Two posts.
  g.fillStyle = "#3a2c1d";
  g.fillRect(cx - 11, cy - 8, 3, 20);
  g.fillRect(cx + 8, cy - 8, 3, 20);
  // The board face.
  g.fillStyle = "#6b4f30";
  g.fillRect(cx - 12, cy - 12, 24, 16);
  g.fillStyle = "#5a4128";
  g.fillRect(cx - 12, cy - 12, 24, 3); // top rail shadow
  // A scatter of pinned notices.
  const notes = [
    [cx - 9, cy - 9, 7, 6],
    [cx + 1, cy - 10, 8, 6],
    [cx - 7, cy - 2, 6, 5],
    [cx + 2, cy - 2, 7, 5],
  ] as const;
  for (const [nx, ny, w, h] of notes) {
    g.fillStyle = "#d8cba6";
    g.fillRect(nx, ny, w, h);
    g.fillStyle = "#8a2c22"; // a wax-seal dot
    g.fillRect(nx + w / 2 - 1, ny + h - 2, 2, 2);
  }
}

/** A boss-dungeon portal: a dark arch with a swirling ember glow. */
function drawPortal(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const pulse = 0.6 + 0.4 * Math.sin(now / 360);
  g.fillStyle = "#1a1016";
  g.beginPath();
  g.ellipse(cx, cy, TILE * 0.32, TILE * 0.42, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = `rgba(210,116,44,${0.5 + 0.4 * pulse})`;
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(cx, cy, TILE * 0.32, TILE * 0.42, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = `rgba(242,160,90,${0.35 * pulse})`;
  g.beginPath();
  g.ellipse(cx, cy, TILE * 0.18, TILE * 0.26, 0, 0, Math.PI * 2);
  g.fill();
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

/** Route a monster to its sprite (reusing shapes across similar creatures). */
function drawMonster(
  g: CanvasRenderingContext2D,
  monster: string | undefined,
  available: boolean,
  cx: number,
  cy: number,
  now: number,
): void {
  if (!available) return drawRespawning(g, cx, cy);
  switch (monster) {
    case "hill_wolf":
    case "ridge_wolf":
    case "heartmoor_hound":
      return drawWolf(g, cx, cy, now);
    case "wild_boar":
      return drawBoar(g, cx, cy, now, false);
    case "greymane_boar":
      return drawBoar(g, cx, cy, now, true);
    case "forest_bear":
      return drawBear(g, cx, cy, now);
    case "stone_crawler":
    case "cave_crawler":
      return drawStoneCrawler(g, cx, cy, now);
    case "mountain_troll":
    case "deep_golem":
      return drawTroll(g, cx, cy, now);
    case "spine_wraith":
    case "marrow_wraith":
      return drawWraith(g, cx, cy, now);
    case "mire_serpent":
    case "river_serpent":
    case "marsh_lurker":
      return drawSerpent(g, cx, cy, now);
    case "deep_bat":
      return drawBat(g, cx, cy, now);
    case "bog_knight":
      return drawHumanoid(g, cx, cy, now, "#5b6470", "#7a8492"); // grey armour
    case "redrun_brigand":
      return drawHumanoid(g, cx, cy, now, "#5a4636", "#6e5742"); // leathers
    case "ancient_orc":
      return drawHumanoid(g, cx, cy, now, "#4d5a3e", "#5f6e4c"); // green-grey orc
    case "dread_ferryman":
      return drawHumanoid(g, cx, cy, now, "#1f2630", "#2c3540"); // black-hooded
    default:
      return drawRat(g, cx, cy, now);
  }
}

// --- Serpent: a coiled, scaled body with a raised head ---
function drawSerpent(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const sway = Math.sin(now / 240) * 3;
  shadow(g, cx, cy + 8, 12, 4);
  g.strokeStyle = "#3f5a44";
  g.lineWidth = 6;
  g.lineCap = "round";
  g.beginPath(); // coiled body
  g.moveTo(cx + 11, cy + 7);
  g.quadraticCurveTo(cx - 12, cy + 9, cx - 6, cy + 1);
  g.quadraticCurveTo(cx + 8, cy - 4, cx - 2 + sway, cy - 9);
  g.stroke();
  g.strokeStyle = "#4f6e54";
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(cx + 11, cy + 7);
  g.quadraticCurveTo(cx - 12, cy + 9, cx - 6, cy + 1);
  g.quadraticCurveTo(cx + 8, cy - 4, cx - 2 + sway, cy - 9);
  g.stroke();
  g.fillStyle = "#4f6e54"; // head
  g.beginPath();
  g.ellipse(cx - 2 + sway, cy - 10, 4, 3.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#d2c24a"; // eye
  circle(g, cx - 3 + sway, cy - 11, 1);
  g.strokeStyle = "#c43a23"; // tongue
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - 5 + sway, cy - 11);
  g.lineTo(cx - 8 + sway, cy - 12);
  g.stroke();
  g.lineCap = "butt";
}

// --- Bat: a small dark flier with beating wings ---
function drawBat(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const flap = Math.sin(now / 90) * 5;
  shadow(g, cx, cy + 9, 6, 2);
  g.fillStyle = "#2b2630";
  g.beginPath(); // left wing
  g.moveTo(cx, cy);
  g.quadraticCurveTo(cx - 11, cy - 6 - flap, cx - 14, cy + 2 - flap);
  g.quadraticCurveTo(cx - 8, cy + 1, cx, cy + 3);
  g.closePath();
  g.fill();
  g.beginPath(); // right wing
  g.moveTo(cx, cy);
  g.quadraticCurveTo(cx + 11, cy - 6 - flap, cx + 14, cy + 2 - flap);
  g.quadraticCurveTo(cx + 8, cy + 1, cx, cy + 3);
  g.closePath();
  g.fill();
  g.fillStyle = "#39333f"; // body
  g.beginPath();
  g.ellipse(cx, cy + 1, 3, 4.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#39333f"; // ears
  circle(g, cx - 2, cy - 4, 1.4);
  circle(g, cx + 2, cy - 4, 1.4);
  g.fillStyle = "#c43a23"; // eyes
  circle(g, cx - 1.4, cy - 1, 0.8);
  circle(g, cx + 1.4, cy - 1, 0.8);
}

// --- Humanoid: a standing figure (knight / brigand / orc / hooded ferryman) ---
function drawHumanoid(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  body: string,
  trim: string,
): void {
  const bob = Math.sin(now / 500) * 0.8;
  shadow(g, cx, cy + 12, 8, 3);
  g.fillStyle = "#2b2620"; // legs
  g.fillRect(cx - 5, cy + 6 + bob, 4, 8);
  g.fillRect(cx + 1, cy + 6 + bob, 4, 8);
  g.fillStyle = body; // torso / cloak
  g.beginPath();
  g.moveTo(cx - 7, cy + 8 + bob);
  g.lineTo(cx - 6, cy - 7 + bob);
  g.quadraticCurveTo(cx, cy - 11 + bob, cx + 6, cy - 7 + bob);
  g.lineTo(cx + 7, cy + 8 + bob);
  g.closePath();
  g.fill();
  g.fillStyle = trim; // shoulder trim
  g.fillRect(cx - 7, cy - 6 + bob, 14, 3);
  g.fillStyle = "#caa472"; // head / hood-shadow
  circle(g, cx, cy - 11 + bob, 4.5);
  g.fillStyle = body; // hood / helm over the head
  g.beginPath();
  g.arc(cx, cy - 12 + bob, 5, Math.PI, 0);
  g.fill();
  g.fillStyle = "#1a140f";
  g.fillRect(cx - 4, cy - 12 + bob, 8, 2); // brow shadow
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

// --- Stone Crawler: a low, armoured stone-shelled creature ---
function drawStoneCrawler(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const sk = Math.sin(now / 160);
  shadow(g, cx, cy + 7, 12, 4);
  g.strokeStyle = "#4c4a46"; // legs
  g.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(cx + i * 5, cy + 3);
    g.lineTo(cx + i * 5 + sk * 2, cy + 9);
    g.stroke();
  }
  g.fillStyle = "#5b5852"; // stone shell
  g.beginPath();
  g.ellipse(cx, cy, 12, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#6e6a62"; // plated ridges
  g.beginPath();
  g.ellipse(cx, cy - 1, 9, 4.5, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#3a3833";
  g.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(cx + i * 5, cy - 5);
    g.lineTo(cx + i * 5, cy + 5);
    g.stroke();
  }
  g.fillStyle = "#d2742c"; // ember eyes
  circle(g, cx - 9, cy - 1, 1.2);
  circle(g, cx - 11, cy + 1, 1);
}

// --- Mountain Troll: a big, hunched grey brute ---
function drawTroll(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 300) * 1;
  shadow(g, cx, cy + 13, 14, 5);
  g.fillStyle = "#5a5d52"; // legs
  g.fillRect(cx - 7, cy + 6 + bob, 5, 9);
  g.fillRect(cx + 2, cy + 6 + bob, 5, 9);
  g.fillStyle = "#6b6e61"; // hunched body
  g.beginPath();
  g.moveTo(cx - 11, cy + 8 + bob);
  g.quadraticCurveTo(cx - 13, cy - 8 + bob, cx, cy - 9 + bob);
  g.quadraticCurveTo(cx + 13, cy - 8 + bob, cx + 11, cy + 8 + bob);
  g.closePath();
  g.fill();
  g.fillStyle = "#7a7d6e"; // shoulder
  g.beginPath();
  g.ellipse(cx, cy - 6 + bob, 11, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#787b6b"; // long arms
  g.fillRect(cx - 13, cy - 3 + bob, 4, 12);
  g.fillRect(cx + 9, cy - 3 + bob, 4, 12);
  g.fillStyle = "#6b6e61"; // head
  circle(g, cx, cy - 11 + bob, 5.5);
  g.fillStyle = "#3a3d34"; // brow
  g.fillRect(cx - 5, cy - 13 + bob, 10, 2);
  g.fillStyle = "#c9b14a"; // eyes
  circle(g, cx - 2.5, cy - 10 + bob, 1.1);
  circle(g, cx + 2.5, cy - 10 + bob, 1.1);
  g.fillStyle = "#e8e2d0"; // tusks
  g.fillRect(cx - 3, cy - 6 + bob, 1.5, 3);
  g.fillRect(cx + 1.5, cy - 6 + bob, 1.5, 3);
}

// --- Spine Wraith: a translucent, drifting figure of cold wind ---
function drawWraith(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const drift = Math.sin(now / 280) * 2;
  const pulse = 0.45 + 0.2 * Math.sin(now / 220);
  g.globalAlpha = pulse;
  g.fillStyle = "#9fc0d8"; // cold body
  g.beginPath();
  g.moveTo(cx, cy - 13);
  g.quadraticCurveTo(cx - 9, cy - 4, cx - 8 + drift, cy + 10);
  g.quadraticCurveTo(cx, cy + 6, cx + 8 + drift, cy + 10);
  g.quadraticCurveTo(cx + 9, cy - 4, cx, cy - 13);
  g.closePath();
  g.fill();
  g.globalAlpha = pulse * 0.6;
  g.fillStyle = "#d6e6f2"; // inner light
  g.beginPath();
  g.ellipse(cx, cy - 6, 4, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = "#16323f"; // hollow eyes
  circle(g, cx - 2.5, cy - 8, 1.3);
  circle(g, cx + 2.5, cy - 8, 1.3);
}

// --- A standing landmark stone (the Wind-Shrine, the sealed Vault) ---
function drawShrine(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 13, 11, 4);
  g.fillStyle = "#6a6b73"; // weathered monolith
  g.beginPath();
  g.moveTo(cx - 7, cy + 13);
  g.lineTo(cx - 8, cy - 10);
  g.lineTo(cx - 3, cy - 15);
  g.lineTo(cx + 4, cy - 14);
  g.lineTo(cx + 8, cy - 6);
  g.lineTo(cx + 7, cy + 13);
  g.closePath();
  g.fill();
  g.fillStyle = "#7e7f88"; // lit face
  g.beginPath();
  g.moveTo(cx - 3, cy - 15);
  g.lineTo(cx + 4, cy - 14);
  g.lineTo(cx + 3, cy + 13);
  g.lineTo(cx - 1, cy + 13);
  g.closePath();
  g.fill();
  g.strokeStyle = "#3f4047"; // worn grooves (the "vertebra")
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - 6, cy - 4);
  g.lineTo(cx + 6, cy - 5);
  g.moveTo(cx - 6, cy + 3);
  g.lineTo(cx + 5, cy + 2);
  g.stroke();
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
