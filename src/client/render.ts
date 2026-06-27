/**
 * src/client/render.ts
 * --------------------
 * Pure presentation: given the core's WorldState, paint it onto the canvas.
 * The renderer NEVER changes game state (RULE 2) — it only reads it.
 *
 * Palette: dark aged stone, ember and iron.
 */

import type {
  Appearance,
  Content,
  FurnitureDef,
  TileType,
  Vec2,
  WorldMap,
  WorldObjectDef,
  WorldObjectState,
  WorldState,
} from "../core/types.ts";
import { objectPos } from "../core/worldCore.ts";
import { type RoofStyle, cityDoor, cityRoof, tileAt } from "../content/map.ts";
import { type AvatarAnim, actionArmAngle, drawAvatar, drawTool, withDefaults } from "./avatar.ts";

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
  // Player-home interiors — a warm timber plank floor.
  plank: ["#6a4e30", "#79593a"],
};

const EMBER = "#d2742c";

/** A cheap, stable pseudo-noise so tiles get a fixed bit of texture. */
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Paint one terrain tile, base fill plus type-specific detail. */
function paintTile(
  g: CanvasRenderingContext2D,
  tile: TileType,
  px: number,
  py: number,
  x: number,
  y: number,
  now: number,
  map: WorldMap,
): void {
  const [base, accent] = TILE_COLORS[tile];
  g.fillStyle = base;
  g.fillRect(px, py, TILE, TILE);
  const hv = hash(x, y);

  switch (tile) {
    case "wall": {
      const roof = cityRoof(x, y);
      if (roof) drawRoof(g, px, py, x, y, roof);
      else drawWall(g, px, py, x, y, map);
      return; // walls/roofs draw their own edges
    }
    case "water":
    case "deep": {
      // Layered ripples that drift, plus a hashed glint.
      g.fillStyle = accent;
      for (let i = 0; i < 2; i++) {
        const sh = 0.5 + 0.5 * Math.sin(now / 620 + x * 1.3 + y * 0.7 + i * 2);
        g.globalAlpha = 0.18 + 0.16 * sh;
        g.fillRect(px, py + TILE * (0.18 + 0.3 * i + 0.12 * hv), TILE, 2.5);
      }
      g.globalAlpha = 0.5 + 0.3 * Math.sin(now / 500 + x + y);
      g.fillStyle = tile === "deep" ? "#2b4a6e" : "#3f6488";
      g.fillRect(px + TILE * (0.3 + 0.4 * hv), py + TILE * 0.4, 3, 3);
      g.globalAlpha = 1;
      return;
    }
    case "mountain": {
      // A raised peak: dark rock pyramid with a pale, snow-lit crown.
      const cxp = px + TILE / 2;
      g.fillStyle = "#2a2a31";
      g.beginPath();
      g.moveTo(cxp, py + 4); g.lineTo(px + TILE - 3, py + TILE - 3); g.lineTo(px + 3, py + TILE - 3);
      g.closePath(); g.fill();
      g.fillStyle = "#5a5b66";
      g.beginPath();
      g.moveTo(cxp, py + 4); g.lineTo(cxp, py + TILE - 3); g.lineTo(px + 3, py + TILE - 3);
      g.closePath(); g.fill();
      g.fillStyle = "#d8dde6";
      g.beginPath();
      g.moveTo(cxp, py + 4); g.lineTo(cxp + 5, py + 12); g.lineTo(cxp - 5, py + 12);
      g.closePath(); g.fill();
      return; // no grid on busy peaks
    }
    case "grass":
    case "moss": {
      // Scattered blade-tufts; moss also gets a darker damp patch.
      if (tile === "moss" && hv > 0.5) {
        g.fillStyle = "#243020";
        g.beginPath();
        g.ellipse(px + TILE * (0.3 + 0.4 * hv), py + TILE * 0.5, 7, 5, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = accent;
      g.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const hx = hash(x * 3 + i, y * 5 - i);
        const hy = hash(x * 7 - i, y * 2 + i);
        const bx = px + 5 + hx * (TILE - 10);
        const by = py + 8 + hy * (TILE - 14);
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx + (hx - 0.5) * 4, by - 5);
        g.stroke();
      }
      break;
    }
    case "dirt":
    case "ash": {
      // Clods / cracked warm ground: a few light and dark flecks.
      for (let i = 0; i < 5; i++) {
        const hx = hash(x * 5 + i, y * 3 + i);
        const hy = hash(x * 2 - i, y * 9 + i);
        g.fillStyle = i % 2 ? accent : "rgba(0,0,0,0.18)";
        g.fillRect(px + hx * (TILE - 5), py + hy * (TILE - 5), 4, 3);
      }
      if (tile === "ash" && hv > 0.6) { // a warm ember crack
        g.strokeStyle = "rgba(210,116,44,0.25)"; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px + 6, py + TILE * hv); g.lineTo(px + TILE - 6, py + TILE * hv - 6); g.stroke();
      }
      break;
    }
    case "path": {
      // Worn cobbles: rounded stones with a lighter trodden centre.
      g.fillStyle = "rgba(255,240,210,0.06)";
      g.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
      g.fillStyle = accent;
      for (let i = 0; i < 5; i++) {
        const hx = hash(x * 4 + i, y * 6 + i);
        const hy = hash(x * 8 - i, y * 3 + i);
        const s = 4 + hx * 3;
        g.globalAlpha = 0.5;
        g.fillRect(px + 3 + hx * (TILE - 9), py + 3 + hy * (TILE - 9), s, s - 1);
      }
      g.globalAlpha = 1;
      break;
    }
    case "stone": {
      // Dressed flagstones: a couple of mortar cracks + a lit block.
      g.strokeStyle = "rgba(0,0,0,0.22)"; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px, py + TILE * (0.35 + 0.3 * hv)); g.lineTo(px + TILE, py + TILE * (0.35 + 0.3 * hv));
      g.moveTo(px + TILE * (0.4 + 0.2 * hv), py); g.lineTo(px + TILE * (0.4 + 0.2 * hv), py + TILE * 0.4);
      g.stroke();
      g.fillStyle = accent; g.globalAlpha = 0.4;
      g.fillRect(px + 4, py + 4, TILE * 0.4, TILE * 0.25);
      g.globalAlpha = 1;
      break;
    }
    case "bog": {
      // Murky ground with a dark standing-water blotch.
      if (hv > 0.45) {
        g.fillStyle = "rgba(20,30,28,0.55)";
        g.beginPath();
        g.ellipse(px + TILE * (0.4 + 0.3 * hv), py + TILE * 0.55, 8, 5, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(90,120,110,0.18)";
        g.fillRect(px + TILE * 0.35, py + TILE * 0.5, 8, 1.5);
      }
      break;
    }
    case "snow": {
      // Bright with a couple of sparkle flecks.
      g.fillStyle = "rgba(255,255,255,0.7)";
      for (let i = 0; i < 3; i++) {
        const hx = hash(x * 6 + i, y * 4 + i);
        if (hx > 0.5) g.fillRect(px + hx * (TILE - 4), py + hash(x, y + i) * (TILE - 4), 2, 2);
      }
      break;
    }
    case "cave":
    case "cave_wall": {
      g.fillStyle = accent; g.globalAlpha = 0.6;
      for (let i = 0; i < 3; i++) {
        const hx = hash(x * 5 + i, y * 7 + i);
        g.fillRect(px + hx * (TILE - 4), py + hash(x + i, y) * (TILE - 4), 3, 3);
      }
      g.globalAlpha = 1;
      if (tile === "cave_wall") { g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(px, py, TILE, 2); }
      break;
    }
  }

  // Faint grid for ground tiles (walls/mountain/water handle their own look).
  g.strokeStyle = "rgba(0,0,0,0.1)";
  g.lineWidth = 1;
  g.strokeRect(px + 0.5, py + 0.5, TILE, TILE);
}

/**
 * Dressed-stone city wall: warm masonry in a brick bond, with battlement teeth
 * (merlons) along any edge that faces open ground, and a cast shadow where it
 * drops to the ground below. Reads as a real rampart, not a grey block.
 */
function drawWall(
  g: CanvasRenderingContext2D,
  px: number,
  py: number,
  x: number,
  y: number,
  map: WorldMap,
): void {
  const isWall = (dx: number, dy: number): boolean => tileAt(map, x + dx, y + dy) === "wall";
  const openN = !isWall(0, -1), openS = !isWall(0, 1);
  const openW = !isWall(-1, 0), openE = !isWall(1, 0);

  // Masonry body: brick bond with mortar lines.
  g.fillStyle = "#5d544b";
  g.fillRect(px, py, TILE, TILE);
  const rows = 3;
  const rh = TILE / rows;
  for (let r = 0; r < rows; r++) {
    const ry = py + r * rh;
    const off = (r % 2) * (TILE / 4);
    for (let b = -1; b < 3; b++) {
      const bx = px + off + b * (TILE / 2);
      // lit top-left, shaded bottom-right per brick
      g.fillStyle = "#776c5e";
      g.fillRect(bx + 1.5, ry + 1.5, TILE / 2 - 3, rh - 3);
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(bx + 1.5, ry + rh - 3, TILE / 2 - 3, 1.5);
      g.fillStyle = "rgba(255,240,210,0.10)";
      g.fillRect(bx + 1.5, ry + 1.5, TILE / 2 - 3, 1.2);
    }
  }

  // Battlement merlons along edges that face open ground (the rampart top).
  g.fillStyle = "#857a6c";
  const tooth = TILE / 4;
  if (openN) {
    for (let i = 0; i < 4; i += 2) g.fillRect(px + i * tooth, py, tooth, 5);
    g.fillStyle = "rgba(255,245,220,0.18)"; g.fillRect(px, py, TILE, 2); g.fillStyle = "#857a6c";
  }
  if (openS) {
    for (let i = 1; i < 4; i += 2) g.fillRect(px + i * tooth, py + TILE - 5, tooth, 5);
  }
  if (openW) for (let i = 0; i < 4; i += 2) g.fillRect(px, py + i * tooth, 5, tooth);
  if (openE) for (let i = 1; i < 4; i += 2) g.fillRect(px + TILE - 5, py + i * tooth, 5, tooth);

  // Cast shadow where the wall drops to open ground on its south side.
  if (openS) {
    const grad = g.createLinearGradient(0, py + TILE - 6, 0, py + TILE + 4);
    grad.addColorStop(0, "rgba(0,0,0,0.0)");
    grad.addColorStop(1, "rgba(0,0,0,0.32)");
    g.fillStyle = grad;
    g.fillRect(px, py + TILE - 6, TILE, 10);
  }
}

/** Roof palettes: [base, light ridge, shingle line]. */
const ROOF_COLORS: Record<RoofStyle, [string, string, string]> = {
  slate: ["#454a57", "#5b6170", "#363a44"],
  tile: ["#8a4632", "#a85c44", "#6e3526"],
  thatch: ["#8a7642", "#a08a52", "#6e5d33"],
  tower: ["#3e3d47", "#54535f", "#2c2b33"],
};

/**
 * A building roof, drawn per-tile but neighbour-aware so a multi-tile building
 * reads as one pitched, shingled roof: a lit ridge along its top edge, eaves
 * shadow and a doorway at the bottom, and a stone-wall sliver on the sides.
 */
function drawRoof(
  g: CanvasRenderingContext2D,
  px: number,
  py: number,
  x: number,
  y: number,
  style: RoofStyle,
): void {
  const [base, ridge, line] = ROOF_COLORS[style];
  const sameRoof = (dx: number, dy: number) => cityRoof(x + dx, y + dy) === style;
  const topEdge = !sameRoof(0, -1);
  const botEdge = !sameRoof(0, 1);
  const leftEdge = !sameRoof(-1, 0);
  const rightEdge = !sameRoof(1, 0);

  // A thin masonry course shows under the eaves at the very bottom of a building.
  if (botEdge) {
    g.fillStyle = "#5d544b";
    g.fillRect(px, py, TILE, TILE);
  }
  const roofBottom = botEdge ? py + TILE - 7 : py + TILE;

  // Roof field with a top-lit gradient.
  const grad = g.createLinearGradient(0, py, 0, roofBottom);
  grad.addColorStop(0, ridge);
  grad.addColorStop(0.25, base);
  grad.addColorStop(1, line);
  g.fillStyle = grad;
  g.fillRect(px, py, TILE, roofBottom - py);

  // Shingle / thatch texture: rows of short strokes.
  g.strokeStyle = "rgba(0,0,0,0.22)";
  g.lineWidth = 1;
  const rows = style === "thatch" ? 5 : 3;
  for (let r = 1; r < rows; r++) {
    const ry = py + (r / rows) * (roofBottom - py);
    g.beginPath(); g.moveTo(px, ry); g.lineTo(px + TILE, ry); g.stroke();
  }
  if (style === "thatch") { // vertical straw hints
    g.strokeStyle = "rgba(255,240,200,0.10)";
    for (let i = 0; i < 5; i++) {
      const sx = px + 4 + i * 8 + (hash(x, y + i) * 3);
      g.beginPath(); g.moveTo(sx, py + 3); g.lineTo(sx, roofBottom - 2); g.stroke();
    }
  } else { // tile/slate shingle offset dashes
    g.fillStyle = line;
    for (let r = 0; r < rows; r++) {
      const ry = py + (r / rows) * (roofBottom - py) + 2;
      const off = (r % 2) * 6;
      for (let c = 0; c < 4; c++) g.fillRect(px + off + c * 11, ry, 5, 1.5);
    }
  }

  // Lit ridge cap along the top edge of the building.
  if (topEdge) {
    g.fillStyle = ridge;
    g.fillRect(px, py, TILE, 3);
    g.fillStyle = "rgba(255,245,225,0.25)";
    g.fillRect(px, py, TILE, 1.2);
  }
  // Eaves shadow + doorway along the bottom.
  if (botEdge) {
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(px, roofBottom, TILE, 2);
    if (cityDoor(x, y)) {
      g.fillStyle = "#1c150f";
      g.fillRect(px + TILE / 2 - 4, roofBottom + 1, 8, 6);
      g.fillStyle = "rgba(210,160,90,0.4)"; // a warm sliver of lamplight
      g.fillRect(px + TILE / 2 - 4, roofBottom + 1, 2, 6);
    }
  }
  // Side wall slivers for depth.
  g.fillStyle = "rgba(0,0,0,0.18)";
  if (leftEdge) g.fillRect(px, py, 2, roofBottom - py);
  if (rightEdge) { g.fillStyle = "rgba(255,240,210,0.08)"; g.fillRect(px + TILE - 2, py, 2, roofBottom - py); }
  // Tower: a crenellated cap instead of a ridge.
  if (style === "tower" && topEdge) {
    g.fillStyle = "#2c2b33";
    for (let i = 0; i < 4; i += 2) g.fillRect(px + i * (TILE / 4), py, TILE / 4, 4);
  }
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
  viewW = canvas.width,
  viewH = canvas.height,
): void {
  // Visible span in world pixels. Under a zoom transform this is the device size
  // over the zoom, so tile culling and the night veil cover exactly the view.
  const w = viewW;
  const h = viewH;

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
      const px = x * TILE - cam.x;
      const py = y * TILE - cam.y;
      paintTile(g, tile, px, py, x, y, now, map);
    }
  }

  // --- Objects ---
  const lights: Array<[number, number]> = []; // warm light sources, for night
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
    } else if (def.kind === "housing_plot") {
      drawHousingPlot(g, px + TILE / 2, py + TILE / 2, !!obj.owned);
    } else if (def.kind === "build_hotspot") {
      const f = obj.furniture ? content.furniture[obj.furniture] : undefined;
      drawHotspot(g, px + TILE / 2, py + TILE / 2, f, now);
    } else if (def.kind === "room_seal") {
      if (!obj.owned) drawRoomSeal(g, px + TILE / 2, py + TILE / 2); // unbuilt: boarded-up doorway
    } else {
      drawObject(g, def, obj.available, px, py, now, !!obj.wanderTarget, monsterAttack(def, obj, state, content, now));
    }
    if (def.kind === "fire" || def.kind === "furnace" || def.kind === "cauldron") {
      lights.push([px + TILE / 2, py + TILE / 2]);
    } else if (def.kind === "lamppost") {
      lights.push([px + TILE / 2, py + TILE / 2 - 10]); // glow at the lantern
    } else if (def.kind === "build_hotspot" && obj.furniture) {
      const lf = content.furniture[obj.furniture];
      // A built cooking hearth or any lighting piece warms/lights the home.
      if (lf && (lf.category === "kitchen" || lf.light)) lights.push([px + TILE / 2, py + TILE / 2]);
    }
    // Name label — monsters show their combat level (OSRS-style).
    if (def.kind === "npc" || def.kind === "monster") {
      const lvl = def.kind === "monster" && def.monster ? content.monsters[def.monster]?.level : undefined;
      const text = lvl !== undefined ? `${def.name} (lvl ${lvl})` : def.name;
      label(g, text, px + TILE / 2, py - 6, def.kind === "monster" ? "#c98" : "#cdbf9a");
    }
  }

  // --- Player ---
  if (state.player.alive) {
    drawPlayer(
      g, state.player.pos, cam, now, state.player.appearance,
      state.player.path.length > 0, playerAction(state.player, content, now),
    );
  }

  // --- Time of day: a slow tint cycle, with firelight glowing through at night.
  drawDaylight(g, w, h, lights);
}

/** One full day in real milliseconds (dawn → noon → dusk → night → dawn). */
const DAY_CYCLE_MS = 420000; // 7 minutes

/**
 * Tint the whole scene by the hour. `phase` 0 = midnight, 0.5 = noon. Night lays
 * a cool dark veil (with warm pools punched out around fires); dawn and dusk add
 * a golden wash; midday is clear. Uses wall-clock time so it advances for real.
 */
function drawDaylight(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  lights: Array<[number, number]>,
): void {
  const phase = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  const sun = Math.sin(phase * Math.PI * 2 - Math.PI / 2); // -1 midnight … +1 noon
  const night = Math.max(0, -sun) * 0.46;
  const twilight = Math.max(0, 1 - Math.abs(sun) * 3) * 0.17;

  if (night > 0.01) {
    g.fillStyle = `rgba(12,16,38,${night.toFixed(3)})`;
    g.fillRect(0, 0, w, h);
    // Firelight: warm radial pools that lift the dark around hearths.
    g.globalCompositeOperation = "lighter";
    for (const [lx, ly] of lights) {
      const r = 70;
      const grd = g.createRadialGradient(lx, ly, 4, lx, ly, r);
      grd.addColorStop(0, `rgba(230,150,70,${(night * 0.7).toFixed(3)})`);
      grd.addColorStop(1, "rgba(230,150,70,0)");
      g.fillStyle = grd;
      g.beginPath(); g.arc(lx, ly, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = "source-over";
  }
  if (twilight > 0.01) {
    g.fillStyle = `rgba(214,120,50,${twilight.toFixed(3)})`;
    g.fillRect(0, 0, w, h);
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
  // A drawn plant that grows with maturity — a sprout that bushes out, or a
  // sapling that fills into a tree. Greens (no emoji), with ripe fruit/bloom
  // dots tinted per crop so patches read apart at a glance.
  const isTree = def.type === "tree";
  let hsh = 0;
  for (let i = 0; i < (crop ?? "").length; i++) hsh = (hsh * 31 + (crop as string).charCodeAt(i)) >>> 0;
  const grow = 0.4 + frac * 0.6;
  const baseY = cy + TILE * 0.2;
  const stalk = (isTree ? TILE * 0.52 : TILE * 0.34) * grow;
  const topY = baseY - stalk;
  const leafR = (isTree ? TILE * 0.27 : TILE * 0.17) * grow;
  g.globalAlpha = ripe ? 1 : 0.7 + frac * 0.3;
  // stem / trunk
  g.strokeStyle = isTree ? "#6b4a2c" : "#4f7a3a";
  g.lineWidth = isTree ? 3.2 * grow : 2;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx, baseY);
  g.lineTo(cx, topY + leafR * 0.4);
  g.stroke();
  // foliage — a few overlapping leaf blobs, hue nudged per crop
  const hue = (isTree ? 105 : 95) + (hsh % 40) - 20;
  g.fillStyle = `hsl(${hue} 38% ${isTree ? 30 : 38}%)`;
  for (const [dx, dy, rr] of [[0, -leafR * 0.35, leafR], [-leafR * 0.62, leafR * 0.2, leafR * 0.72], [leafR * 0.62, leafR * 0.2, leafR * 0.72]] as const) {
    g.beginPath();
    g.arc(cx + dx, topY + dy, rr, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = `hsl(${hue} 40% ${isTree ? 42 : 52}%)`;
  g.beginPath();
  g.arc(cx - leafR * 0.3, topY - leafR * 0.35, leafR * 0.5, 0, Math.PI * 2);
  g.fill();
  // ripe fruit / blossoms
  if (ripe) {
    g.fillStyle = `hsl(${(hsh % 360)} 62% 58%)`;
    const dots = isTree ? 4 : 3;
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * Math.PI * 2 + (hsh % 7);
      g.beginPath();
      g.arc(cx + Math.cos(a) * leafR * 0.6, topY + Math.sin(a) * leafR * 0.55, 2.1, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
}

function drawObject(
  g: CanvasRenderingContext2D,
  def: WorldObjectDef,
  available: boolean,
  px: number,
  py: number,
  now: number,
  moving = false,
  attack?: MonsterAttack,
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
      drawNpc(g, cx, cy, now, moving);
      break;
    case "monster":
      drawMonster(g, def.monster, available, cx, cy, now, moving, attack);
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
    case "crafting_table":
      drawCraftingTable(g, cx, cy);
      break;
    case "cart":
      drawCart(g, cx, cy);
      break;
    case "fountain":
      drawFountain(g, cx, cy, now);
      break;
    case "sawmill":
      drawSawmill(g, cx, cy);
      break;
    case "critter":
      drawCritter(g, def.species, cx, cy, now);
      break;
    case "lamppost":
      drawLamppost(g, cx, cy);
      break;
    case "signpost":
      drawSignpost(g, cx, cy);
      break;
    case "waystone":
      drawWaystone(g, cx, cy, now);
      break;
    case "agility_obstacle":
      drawObstacle(g, def.obstacle, cx, cy);
      break;
    case "relic":
      drawRelic(g, cx, cy, now);
      break;
    case "house_door":
      drawHouseDoor(g, cx, cy);
      break;
  }
}

/** An unbuilt add-on doorway: a boarded-up wall opening, awaiting its extension. */
function drawRoomSeal(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = "#6b6157"; g.fillRect(cx - 12, cy - 12, 24, 24); // the wall masonry
  g.strokeStyle = "#4a4138"; g.lineWidth = 1;
  for (let i = -8; i <= 8; i += 8) { g.beginPath(); g.moveTo(cx - 12, cy + i); g.lineTo(cx + 12, cy + i); g.stroke(); }
  // crossed boards over the opening — "under construction"
  g.fillStyle = "#7a5532"; g.fillRect(cx - 11, cy - 3, 22, 4); g.fillRect(cx - 3, cy - 11, 4, 22);
  g.strokeStyle = "#caa05a"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 10, cy - 9); g.lineTo(cx + 10, cy + 9); g.stroke();
}

/** A timber house door — a planked doorway in a frame, with a ring handle. */
function drawHouseDoor(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 8, 3);
  g.fillStyle = "#3f3526"; g.fillRect(cx - 8, cy - 12, 16, 24); // the frame
  g.fillStyle = "#6e4a2c"; g.fillRect(cx - 6, cy - 10, 12, 22); // the door leaf
  g.strokeStyle = "#4f351f"; g.lineWidth = 1; // plank seams
  for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(cx - 6 + i * 4, cy - 10); g.lineTo(cx - 6 + i * 4, cy + 12); g.stroke(); }
  g.fillStyle = "#caa05a"; g.beginPath(); g.arc(cx + 3.5, cy + 1, 1.6, 0, Math.PI * 2); g.fill(); // ring handle
}

/** A homestead plot marker: a corner stake with a board (gold once claimed). */
function drawHousingPlot(g: CanvasRenderingContext2D, cx: number, cy: number, owned: boolean): void {
  shadow(g, cx, cy + 9, 7, 2.5);
  g.fillStyle = "#6e5436"; g.fillRect(cx - 1.5, cy - 9, 3, 18); // the post
  g.fillStyle = owned ? "#caa05a" : "#9a8f7d"; // claimed board reads warm gold
  g.fillRect(cx - 8, cy - 9, 16, 8);
  g.strokeStyle = "#3f3526"; g.lineWidth = 1; g.strokeRect(cx - 8, cy - 9, 16, 8);
  if (owned) {
    // a little dark home glyph: a roof over a doorway
    g.fillStyle = "#3f3526";
    g.beginPath(); g.moveTo(cx, cy - 8); g.lineTo(cx - 5, cy - 4.5); g.lineTo(cx + 5, cy - 4.5); g.closePath(); g.fill();
    g.fillRect(cx - 3.5, cy - 4.5, 7, 3.5);
    g.fillStyle = "#caa05a"; g.fillRect(cx - 1, cy - 3, 2, 2); // the doorway
  } else {
    g.fillStyle = "#6b6256"; g.fillRect(cx - 5, cy - 6.5, 10, 1.5); // a plain "vacant" rule
    g.fillRect(cx - 5, cy - 4, 7, 1.5);
  }
}

/** A build footing: an empty peg-marked square, or the furniture built on it. */
function drawHotspot(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  f: FurnitureDef | undefined,
  now: number,
): void {
  if (!f) {
    // an empty footing — a faint dashed square with corner pegs
    g.strokeStyle = "rgba(150,128,92,0.7)"; g.lineWidth = 1.4;
    g.setLineDash([3, 3]); g.strokeRect(cx - 8, cy - 6, 16, 12); g.setLineDash([]);
    g.fillStyle = "#6e5436";
    for (const [dx, dy] of [[-8, -6], [8, -6], [-8, 6], [8, 6]] as const) g.fillRect(cx + dx - 1, cy + dy - 1, 2, 2);
    return;
  }
  // Tier (0..3) shades and adorns each piece: higher tiers look richer.
  const tier = f.levelReq >= 70 ? 3 : f.levelReq >= 45 ? 2 : f.levelReq >= 20 ? 1 : 0;
  const gold = "#d8b24a", gem = "#7fd0e0";
  shadow(g, cx, cy + 8, 9, 3);
  switch (f.category) {
    case "kitchen": {
      g.fillStyle = tier >= 2 ? "#4f535b" : tier ? "#5b5f68" : "#7c766c"; g.fillRect(cx - 9, cy - 3, 18, 11); // body
      g.fillStyle = "#4b4f56"; g.fillRect(cx - 9, cy - 4, 18, 2.5); // mantel/flue
      if (tier) { g.fillStyle = "#2b2e34"; g.fillRect(cx + 3, cy - 4, 5, 2.5); } // a range chimney stub
      if (tier >= 2) { g.fillStyle = "#2b2e34"; g.fillRect(cx - 8, cy - 4, 5, 2.5); } // second hearth on the grand range
      g.fillStyle = "#241d18"; g.fillRect(cx - 5, cy + 1, 10, 7); // firebox
      const fl = 0.5 + 0.5 * Math.sin(now / 110);
      g.fillStyle = `rgba(240,150,40,${0.65 + 0.3 * fl})`;
      g.beginPath(); g.moveTo(cx, cy + 2 - 4 - 2 * fl); g.lineTo(cx - 3.5, cy + 7); g.lineTo(cx + 3.5, cy + 7); g.closePath(); g.fill();
      g.fillStyle = "#ffd86a"; g.beginPath(); g.moveTo(cx, cy + 3 - 2 * fl); g.lineTo(cx - 1.6, cy + 7); g.lineTo(cx + 1.6, cy + 7); g.closePath(); g.fill();
      break;
    }
    case "forge": {
      // a small anvil on a stone/timber base, with a glowing piece on the face
      g.fillStyle = tier ? "#5a4632" : "#6e5436"; g.fillRect(cx - 7, cy + 1, 14, 7); // base
      g.fillStyle = tier ? "#3b3e45" : "#55585f"; // the anvil
      g.fillRect(cx - 7, cy - 3, 14, 3); g.fillRect(cx - 2, cy, 4, 2); g.fillRect(cx - 8, cy - 4, 6, 2); // horn + waist
      const gl = 0.5 + 0.5 * Math.sin(now / 90);
      g.fillStyle = `rgba(255,140,40,${0.6 + 0.35 * gl})`; g.fillRect(cx + 1, cy - 4, 3, 2); // hot billet
      if (tier) { g.fillStyle = "#caa05a"; g.fillRect(cx + 4, cy - 6, 1.5, 3); } // a hung hammer
      break;
    }
    case "alchemy": {
      g.fillStyle = tier ? "#7a4a52" : "#4a3f3a"; g.fillRect(cx - 6, cy + 2, 12, 4); // trivet/coals base
      g.fillStyle = tier ? "#5b6a72" : "#3a3a40"; // cauldron belly
      g.beginPath(); g.arc(cx, cy + 1, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = tier >= 1 ? "#7fb89a" : "#6a8a6a"; // bubbling brew
      g.beginPath(); g.ellipse(cx, cy - 3, 5, 1.8, 0, 0, Math.PI * 2); g.fill();
      const b = Math.sin(now / 160) > 0.6 ? 1 : 0;
      if (b) { g.fillStyle = "#bfe6cf"; g.fillRect(cx - 1, cy - 6, 1.5, 1.5); }
      if (tier) { g.strokeStyle = gem; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + 6, cy - 6); g.lineTo(cx + 8, cy + 2); g.stroke(); } // a glass coil
      break;
    }
    case "storage": {
      const wood = tier >= 2 ? "#43403c" : tier ? "#4f3826" : "#7a5532";
      g.fillStyle = wood; g.fillRect(cx - 9, cy - 2, 18, 10); // chest body
      g.fillStyle = tier >= 2 ? "#34312e" : tier ? "#3c2a1c" : "#63421f"; g.fillRect(cx - 9, cy - 5, 18, 4); // lid
      g.fillStyle = tier >= 2 ? "#6b6f78" : tier ? "#8a3f33" : "#8a8278"; // straps (bloodore / voidsteel)
      g.fillRect(cx - 7, cy - 5, 2, 13); g.fillRect(cx + 5, cy - 5, 2, 13);
      g.fillStyle = tier >= 2 ? gem : gold; g.fillRect(cx - 1, cy - 1, 2, 3); // lock plate / gem-lock
      break;
    }
    case "workshop": {
      const wood = tier ? "#5a4632" : "#7a5532";
      g.fillStyle = "#4a3a28"; g.fillRect(cx - 8, cy + 2, 2.5, 6); g.fillRect(cx + 5.5, cy + 2, 2.5, 6); // legs
      g.fillStyle = wood; g.fillRect(cx - 10, cy - 1, 20, 4); // bench top
      if (tier) { g.fillStyle = "#6b6f78"; g.fillRect(cx - 10, cy - 2, 20, 1.6); } // stone-topped upgrade
      g.fillStyle = "#8a8278"; g.fillRect(cx - 6, cy - 5, 3, 4); // a vice
      if (tier >= 2) { g.fillStyle = "#8a8278"; g.fillRect(cx + 3, cy - 5, 3, 4); } // a second vice on the master bench
      g.strokeStyle = "#c9b070"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + 1, cy + 2); g.lineTo(cx + 7, cy + 6); g.stroke(); // saw
      break;
    }
    case "bed": {
      const frame = tier >= 3 ? "#5a2f33" : tier === 2 ? "#5e3a2a" : tier === 1 ? "#6e4a2c" : "#8a6a40";
      if (tier >= 3) { g.fillStyle = frame; g.fillRect(cx - 11, cy - 9, 3, 17); g.fillRect(cx + 8, cy - 9, 3, 4); g.fillRect(cx - 11, cy - 9, 22, 2); } // canopy posts
      g.fillStyle = frame; g.fillRect(cx - 11, cy - 6, 3, 14); // headboard
      g.fillStyle = frame; g.fillRect(cx - 9, cy - 5, 19, 12); // bed base
      g.fillStyle = "#e7ddc4"; g.fillRect(cx - 8, cy - 4, 8, 10); // sheet
      g.fillStyle = tier >= 3 ? "#7a3f6a" : tier === 2 ? "#6f6256" : tier === 1 ? "#8f7048" : "#b3a06e"; g.fillRect(cx - 1, cy - 4, 10, 10); // blanket
      g.fillStyle = "#f3ecd9"; g.fillRect(cx - 8, cy - 4, 7, 4); // pillow
      if (tier >= 3) { g.fillStyle = gold; g.fillRect(cx - 1, cy - 4, 10, 1.2); } // gold trim
      break;
    }
    case "table": {
      const wood = tier >= 2 ? "#5a3f28" : tier === 1 ? "#6e4a2c" : "#8a6a40";
      g.fillStyle = "#5a4026"; g.fillRect(cx - 8, cy + 2, 2.5, 6); g.fillRect(cx + 5.5, cy + 2, 2.5, 6); // legs
      g.fillStyle = wood; g.fillRect(cx - 10, cy - 2, 20, 5); // top
      g.fillStyle = tier >= 2 ? gold : "rgba(255,255,255,0.08)"; g.fillRect(cx - 10, cy - 2, 20, 1.5); // sheen / gold inlay
      g.fillStyle = "#6e5436"; g.fillRect(cx - 12, cy + 3, 3, 3); g.fillRect(cx + 9, cy + 3, 3, 3); // two stools
      break;
    }
    case "seating": {
      const wood = tier >= 2 ? "#5a3f28" : tier === 1 ? "#6e4a2c" : "#8a6a40";
      if (tier === 0) { // a pair of stools
        g.fillStyle = wood; g.fillRect(cx - 8, cy - 1, 6, 3); g.fillRect(cx + 2, cy - 1, 6, 3);
        g.fillStyle = "#5a4026"; g.fillRect(cx - 7, cy + 2, 1.5, 5); g.fillRect(cx - 3, cy + 2, 1.5, 5); g.fillRect(cx + 3, cy + 2, 1.5, 5); g.fillRect(cx + 7, cy + 2, 1.5, 5);
      } else { // a settle / armchair with a cushion (and a pelt on tier 2)
        g.fillStyle = wood; g.fillRect(cx - 8, cy - 6, 16, 14); // back + seat block
        g.fillStyle = tier >= 2 ? "#7a5038" : "#8f7048"; g.fillRect(cx - 6, cy - 1, 12, 6); // cushion
        if (tier >= 2) { g.fillStyle = "#9a8466"; g.fillRect(cx - 7, cy + 4, 14, 3); } // a draped pelt
        g.fillStyle = wood; g.fillRect(cx - 9, cy - 2, 2, 9); g.fillRect(cx + 7, cy - 2, 2, 9); // arms
      }
      break;
    }
    case "hall": {
      const wall = tier >= 3 ? "#8b8478" : tier === 1 ? "#7d756a" : tier === 2 ? "#83796b" : "#9a7b4e";
      g.fillStyle = wall; g.fillRect(cx - 10, cy - 9, 20, 16);
      g.strokeStyle = "#46402f"; g.lineWidth = 1; g.strokeRect(cx - 10, cy - 9, 20, 16);
      if (tier === 0) { // a timber-framed wall: cross-braces
        g.strokeStyle = "#6e5436"; g.lineWidth = 2; g.strokeRect(cx - 10, cy - 9, 20, 16);
        g.beginPath(); g.moveTo(cx - 10, cy - 9); g.lineTo(cx + 10, cy + 7); g.moveTo(cx + 10, cy - 9); g.lineTo(cx - 10, cy + 7); g.stroke();
      } else if (tier === 2) { // a stone mantel under a beam
        g.fillStyle = "#6e4a2c"; g.fillRect(cx - 10, cy - 4, 20, 4);
        g.fillStyle = "#6b6f78"; g.fillRect(cx - 7, cy, 14, 7);
      } else { // a vaulted gallery: a dressed-stone arch
        g.strokeStyle = "#5a554c"; g.lineWidth = 2;
        g.beginPath(); g.arc(cx, cy + 1, 7, Math.PI, 0); g.stroke();
        g.fillStyle = "#6f6a60"; g.fillRect(cx - 8, cy + 1, 16, 6);
      }
      break;
    }
    case "lighting": {
      const fl = 0.55 + 0.45 * Math.sin(now / 130);
      if (tier >= 2) { // a chandelier: a gold ring of flames
        g.strokeStyle = gold; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, cy - 11); g.lineTo(cx, cy - 6); g.stroke();
        g.strokeStyle = gold; g.beginPath(); g.ellipse(cx, cy - 3, 9, 3, 0, 0, Math.PI * 2); g.stroke();
        for (const dx of [-8, -3, 3, 8]) { g.fillStyle = `rgba(255,210,90,${fl})`; g.beginPath(); g.arc(cx + dx, cy - 4, 1.8, 0, Math.PI * 2); g.fill(); }
      } else if (tier === 1) { // a wall sconce
        g.fillStyle = "#3b3e45"; g.fillRect(cx - 2, cy - 2, 4, 9); // iron bracket
        g.fillStyle = `rgba(255,200,90,${0.5 + 0.4 * fl})`; g.beginPath(); g.arc(cx, cy - 4, 4, 0, Math.PI * 2); g.fill(); // glass glow
      } else { // a candle stand
        g.fillStyle = "#6e5436"; g.fillRect(cx - 1.5, cy - 2, 3, 9); g.fillRect(cx - 4, cy + 6, 8, 2); // stand
        g.fillStyle = "#efe7d2"; g.fillRect(cx - 3, cy - 5, 1.5, 3); g.fillRect(cx + 1.5, cy - 5, 1.5, 3); // candles
        g.fillStyle = `rgba(255,210,90,${fl})`; g.beginPath(); g.arc(cx - 2.2, cy - 6, 1.4, 0, Math.PI * 2); g.arc(cx + 2.2, cy - 6, 1.4, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "display": {
      if (tier === 0) { // a curio shelf
        g.fillStyle = "#6e5436"; g.fillRect(cx - 9, cy - 7, 18, 14);
        g.fillStyle = "#4a3a28"; g.fillRect(cx - 8, cy - 3, 16, 1.5); g.fillRect(cx - 8, cy + 2, 16, 1.5); // shelves
        g.fillStyle = gem; for (const dx of [-6, 0, 6]) g.fillRect(cx + dx - 1, cy - 6, 2, 2); // curios
      } else if (tier === 1) { // a trophy mount: a board with a skull + pelt
        g.fillStyle = "#5a4632"; g.fillRect(cx - 9, cy - 8, 18, 16);
        g.fillStyle = "#9a8466"; g.fillRect(cx - 6, cy - 1, 12, 7); // draped pelt
        g.fillStyle = "#e7ddc4"; g.beginPath(); g.arc(cx, cy - 4, 3.5, 0, Math.PI * 2); g.fill(); // skull
        g.fillStyle = "#cfc4ad"; g.fillRect(cx - 6, cy - 7, 2, 4); g.fillRect(cx + 4, cy - 7, 2, 4); // horns
      } else { // a lit display case
        g.fillStyle = gold; g.fillRect(cx - 8, cy - 9, 16, 17); // gold frame
        g.fillStyle = "rgba(150,220,235,0.35)"; g.fillRect(cx - 6, cy - 7, 12, 13); // glass
        g.fillStyle = `rgba(190,230,240,${0.5 + 0.3 * Math.sin(now / 200)})`; g.fillRect(cx - 5, cy - 6, 10, 2); // inner light
        g.fillStyle = gem; g.fillRect(cx - 1.5, cy - 2, 3, 4); // the treasure within
      }
      break;
    }
  }
}

/** An Agility obstacle, drawn by its variant (log, net, rope, wall, stones, beam). */
function drawObstacle(
  g: CanvasRenderingContext2D,
  variant: string | undefined,
  cx: number,
  cy: number,
): void {
  shadow(g, cx, cy + 11, 9, 3);
  const wood = "#7a5a36", woodDk = "#5a4026", rope = "#b59a5e";
  switch (variant) {
    case "net": { // a climbing net on a frame
      g.strokeStyle = woodDk; g.lineWidth = 2.5;
      g.strokeRect(cx - 11, cy - 12, 22, 24);
      g.strokeStyle = rope; g.lineWidth = 1;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(cx - 11 + i * 4.4, cy - 12); g.lineTo(cx - 11 + i * 4.4, cy + 12); g.stroke(); }
      for (let j = 1; j < 5; j++) { g.beginPath(); g.moveTo(cx - 11, cy - 12 + j * 4.8); g.lineTo(cx + 11, cy - 12 + j * 4.8); g.stroke(); }
      break;
    }
    case "rope": { // a rope swing from a beam
      g.strokeStyle = woodDk; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 12, cy - 12); g.lineTo(cx + 12, cy - 12); g.stroke();
      g.strokeStyle = rope; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx - 4, cy + 9); g.stroke();
      g.fillStyle = wood; g.fillRect(cx - 7, cy + 9, 8, 2.5); // the swing seat
      break;
    }
    case "wall": { // a wall to scramble over
      g.fillStyle = "#8a8278"; g.fillRect(cx - 11, cy - 9, 22, 20);
      g.strokeStyle = "#5b554c"; g.lineWidth = 1;
      g.strokeRect(cx - 11, cy - 9, 22, 20);
      g.beginPath(); g.moveTo(cx - 11, cy - 2); g.lineTo(cx + 11, cy - 2); g.moveTo(cx - 11, cy + 5); g.lineTo(cx + 11, cy + 5);
      g.moveTo(cx, cy - 9); g.lineTo(cx, cy - 2); g.moveTo(cx - 5, cy - 2); g.lineTo(cx - 5, cy + 5); g.moveTo(cx + 5, cy + 5); g.lineTo(cx + 5, cy + 11); g.stroke();
      break;
    }
    case "stones": { // stepping stones across a gap
      g.fillStyle = "#6fa0c0"; g.globalAlpha = 0.35; g.fillRect(cx - 12, cy - 6, 24, 14); g.globalAlpha = 1;
      g.fillStyle = "#9a9080";
      for (const [dx, dy] of [[-8, 4], [-2, -2], [4, 3], [9, -1]] as const) {
        g.beginPath(); g.ellipse(cx + dx, cy + dy, 3.4, 2.6, 0, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "beam": { // a high tightrope/beam
      g.strokeStyle = woodDk; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 11, cy + 9); g.lineTo(cx - 8, cy - 6); g.moveTo(cx + 11, cy + 9); g.lineTo(cx + 8, cy - 6); g.stroke();
      g.strokeStyle = rope; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 9, cy - 6); g.lineTo(cx + 9, cy - 6); g.stroke();
      break;
    }
    default: { // "log" — a balance log over a dip
      g.fillStyle = wood; g.strokeStyle = woodDk; g.lineWidth = 1;
      g.fillRect(cx - 12, cy - 2, 24, 5); g.strokeRect(cx - 12, cy - 2, 24, 5);
      g.fillStyle = woodDk; g.beginPath(); g.ellipse(cx + 12, cy + 0.5, 1.6, 2.6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = rope; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - 12, cy + 0.5); g.lineTo(cx + 12, cy + 0.5); g.stroke();
    }
  }
  // A small footworn marker so the circuit reads as a course.
  g.fillStyle = "rgba(182,210,74,0.5)"; g.beginPath(); g.arc(cx, cy + 10, 1.6, 0, Math.PI * 2); g.fill();
}

/** A street lamp: tall post with an iron lantern (its glow is in the night pass). */
function drawLamppost(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 12, 5, 2);
  g.strokeStyle = "#2c2a30"; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(cx, cy + 12); g.lineTo(cx, cy - 8); g.stroke();
  g.fillStyle = "#3a3740"; // base
  g.fillRect(cx - 3, cy + 9, 6, 4);
  // The lantern housing.
  g.fillStyle = "#26242b";
  g.fillRect(cx - 4, cy - 14, 8, 7);
  g.fillStyle = "#3a3740";
  g.beginPath(); g.moveTo(cx - 5, cy - 14); g.lineTo(cx, cy - 18); g.lineTo(cx + 5, cy - 14); g.closePath(); g.fill();
  // The flame (always lit; the night overlay makes it read as a glow).
  g.fillStyle = "#f7c66a";
  g.fillRect(cx - 2, cy - 13, 4, 5);
  g.fillStyle = "rgba(247,198,106,0.5)";
  g.beginPath(); g.arc(cx, cy - 10, 5, 0, Math.PI * 2); g.fill();
}

/** A directional fingerpost at a junction. */
function drawSignpost(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 5, 2);
  g.fillStyle = "#5a4128"; // post
  g.fillRect(cx - 1.5, cy - 8, 3, 19);
  // Two fingerboards pointing opposite ways.
  g.fillStyle = "#7a5a34";
  g.beginPath();
  g.moveTo(cx - 11, cy - 5); g.lineTo(cx + 2, cy - 5); g.lineTo(cx + 2, cy - 1); g.lineTo(cx - 11, cy - 1); g.lineTo(cx - 13, cy - 3); g.closePath(); g.fill();
  g.fillStyle = "#6b4f30";
  g.beginPath();
  g.moveTo(cx + 11, cy + 1); g.lineTo(cx - 2, cy + 1); g.lineTo(cx - 2, cy + 5); g.lineTo(cx + 11, cy + 5); g.lineTo(cx + 13, cy + 3); g.closePath(); g.fill();
  g.fillStyle = "rgba(0,0,0,0.3)"; // faint "lettering"
  g.fillRect(cx - 9, cy - 3.5, 7, 1); g.fillRect(cx + 1, cy + 2.5, 7, 1);
}

/** A Courier waystone: a carved standing stone with a painted rider-mark. */
function drawWaystone(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  shadow(g, cx, cy + 11, 9, 3);
  g.fillStyle = "#5b5762";
  g.beginPath();
  g.moveTo(cx - 7, cy + 11); g.lineTo(cx - 6, cy - 9); g.lineTo(cx, cy - 13);
  g.lineTo(cx + 6, cy - 9); g.lineTo(cx + 7, cy + 11); g.closePath(); g.fill();
  g.fillStyle = "#6c6775";
  g.beginPath(); g.moveTo(cx - 6, cy - 9); g.lineTo(cx, cy - 13); g.lineTo(cx + 1, cy + 11); g.lineTo(cx - 7, cy + 11); g.closePath(); g.fill();
  // The ember rider-mark, faintly pulsing.
  const pulse = 0.55 + 0.45 * Math.sin(now / 500);
  g.fillStyle = `rgba(210,116,44,${(0.5 + 0.4 * pulse).toFixed(2)})`;
  g.beginPath(); g.arc(cx - 1, cy - 2, 4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(247,198,106,0.8)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx - 4, cy - 2); g.lineTo(cx + 2, cy - 2); g.moveTo(cx - 1, cy - 5); g.lineTo(cx - 1, cy + 1); g.stroke();
}

/** Ambient wildlife — small, simple silhouettes by species. */
function drawCritter(
  g: CanvasRenderingContext2D,
  species: string | undefined,
  cx: number,
  cy: number,
  now: number,
): void {
  shadow(g, cx, cy + 7, 6, 2);
  const bob = Math.sin(now / 220 + cx) * 1.2; // a little life
  const y = cy + bob;
  switch (species) {
    case "deer": {
      g.fillStyle = "#9a6b3e";
      g.fillRect(cx - 6, y - 4, 11, 6); // body
      g.fillRect(cx + 4, y - 8, 3, 5);  // neck
      g.fillStyle = "#7a5230";
      g.fillRect(cx + 4, y - 11, 3, 4); // head
      g.strokeStyle = "#caa570"; g.lineWidth = 1; // antlers
      g.beginPath(); g.moveTo(cx + 5, y - 11); g.lineTo(cx + 4, y - 14);
      g.moveTo(cx + 6, y - 11); g.lineTo(cx + 8, y - 14); g.stroke();
      g.strokeStyle = "#6a4628"; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(cx - 4, y + 2); g.lineTo(cx - 4, y + 6); g.moveTo(cx + 3, y + 2); g.lineTo(cx + 3, y + 6); g.stroke();
      break;
    }
    case "sheep": {
      g.fillStyle = "#e6e2d6";
      g.beginPath(); g.ellipse(cx, y - 2, 7, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#33312c"; g.fillRect(cx + 5, y - 4, 3, 3); // head
      g.strokeStyle = "#33312c"; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx - 3, y + 3); g.lineTo(cx - 3, y + 6); g.moveTo(cx + 3, y + 3); g.lineTo(cx + 3, y + 6); g.stroke();
      break;
    }
    case "crow": {
      g.fillStyle = "#1c1b22";
      g.beginPath(); g.ellipse(cx, y, 5, 3.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#26252e"; g.beginPath(); g.arc(cx + 4, y - 2, 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c8902c"; g.fillRect(cx + 6, y - 2.5, 2.5, 1.4); // beak
      g.fillStyle = "#0f0e13"; g.beginPath(); g.moveTo(cx - 5, y); g.lineTo(cx - 9, y - 2); g.lineTo(cx - 5, y + 1); g.fill(); // tail
      break;
    }
    case "duck": {
      g.fillStyle = "#6e5a3a";
      g.beginPath(); g.ellipse(cx, y, 6, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3a4a2e"; g.beginPath(); g.arc(cx + 5, y - 3, 2.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c8902c"; g.fillRect(cx + 7, y - 3.5, 3, 1.6);
      break;
    }
    case "frog": {
      g.fillStyle = "#4a6a32";
      g.beginPath(); g.ellipse(cx, y + 1, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#5e8240";
      g.beginPath(); g.arc(cx - 2, y - 2, 1.6, 0, Math.PI * 2); g.arc(cx + 2, y - 2, 1.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1c2414"; g.fillRect(cx - 3, y - 3, 1, 1); g.fillRect(cx + 2, y - 3, 1, 1);
      break;
    }
    case "butterfly": {
      const flap = 0.4 + 0.5 * Math.abs(Math.sin(now / 90 + cx));
      g.fillStyle = "#d2742c";
      g.save(); g.translate(cx, y - 2); g.scale(flap, 1);
      g.beginPath(); g.ellipse(-3, 0, 3, 4, 0, 0, Math.PI * 2); g.ellipse(3, 0, 3, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f0c187"; g.beginPath(); g.arc(-3, -1, 1, 0, Math.PI * 2); g.arc(3, -1, 1, 0, Math.PI * 2); g.fill();
      g.restore();
      g.fillStyle = "#2a2630"; g.fillRect(cx - 0.5, y - 5, 1, 6);
      break;
    }
    case "cat": {
      g.fillStyle = "#6a5b48";
      g.beginPath(); g.ellipse(cx - 1, y, 6, 3.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#6a5b48"; g.beginPath(); g.arc(cx + 5, y - 3, 2.4, 0, Math.PI * 2); g.fill();
      g.fillRect(cx + 3.5, y - 6, 1.5, 2); g.fillRect(cx + 6, y - 6, 1.5, 2); // ears
      g.strokeStyle = "#6a5b48"; g.lineWidth = 1.6; // tail
      g.beginPath(); g.moveTo(cx - 6, y); g.quadraticCurveTo(cx - 10, y - 1, cx - 9, y - 5); g.stroke();
      break;
    }
    default: { // rabbit / hare
      g.fillStyle = "#8a7a64";
      g.beginPath(); g.ellipse(cx, y, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#9a8a72"; g.beginPath(); g.arc(cx + 4, y - 2, 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#8a7a64"; g.fillRect(cx + 3, y - 7, 1.6, 5); g.fillRect(cx + 5, y - 7, 1.6, 5); // ears
      g.fillStyle = "#efe9dd"; g.beginPath(); g.arc(cx - 5, y + 1, 1.6, 0, Math.PI * 2); g.fill(); // tail
      break;
    }
  }
}

/** A town fountain: a round stone basin with a bright, jetting plume. */
function drawFountain(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  shadow(g, cx, cy + 11, 15, 5);
  // Outer basin (stone ring).
  g.fillStyle = "#6b6157";
  g.beginPath(); g.ellipse(cx, cy + 3, 16, 11, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#564d44";
  g.beginPath(); g.ellipse(cx, cy + 3, 16, 11, 0, 0, Math.PI * 2); g.stroke();
  // Water in the basin (animated shimmer).
  const sh = 0.5 + 0.5 * Math.sin(now / 400);
  g.fillStyle = "#2f5a78";
  g.beginPath(); g.ellipse(cx, cy + 3, 12.5, 8, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(120,180,210,${0.35 + 0.25 * sh})`;
  g.beginPath(); g.ellipse(cx - 2, cy + 1, 7, 4, 0, 0, Math.PI * 2); g.fill();
  // Central pedestal.
  g.fillStyle = "#5a5149";
  g.fillRect(cx - 3, cy - 8, 6, 12);
  g.fillStyle = "#6f655a";
  g.fillRect(cx - 4, cy - 9, 8, 2);
  // The jet + falling droplets.
  const jet = 6 + 3 * sh;
  g.strokeStyle = "rgba(170,210,235,0.7)"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx, cy - 8); g.lineTo(cx, cy - 8 - jet); g.stroke();
  g.fillStyle = "rgba(190,225,245,0.8)";
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + now / 500;
    g.beginPath();
    g.arc(cx + Math.cos(a) * 7, cy - 6 + Math.abs(Math.sin(a)) * 5, 1.4, 0, Math.PI * 2);
    g.fill();
  }
}

/** A Woodcraft sawmill: a frame-saw over a log on trestles, with a shaving-horse. */
function drawSawmill(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 14, 4);
  // Trestles + a log being sawn.
  g.strokeStyle = "#3a2c1d"; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 10, cy + 9); g.lineTo(cx - 6, cy + 1);
  g.moveTo(cx - 2, cy + 9); g.lineTo(cx - 6, cy + 1);
  g.moveTo(cx + 2, cy + 9); g.lineTo(cx + 6, cy + 1);
  g.moveTo(cx + 10, cy + 9); g.lineTo(cx + 6, cy + 1);
  g.stroke();
  // The log.
  g.fillStyle = "#8a6a40";
  g.fillRect(cx - 11, cy - 2, 22, 5);
  g.fillStyle = "#a07a44";
  g.fillRect(cx - 11, cy - 2, 22, 1.5);
  g.fillStyle = "#caa56a"; // cut end
  g.beginPath(); g.arc(cx - 11, cy + 0.5, 2.5, 0, Math.PI * 2); g.fill();
  // The frame-saw standing in the cut.
  g.strokeStyle = "#6f5436"; g.lineWidth = 2;
  g.strokeRect(cx - 1, cy - 13, 8, 11);
  g.strokeStyle = "#b9bcc4"; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(cx + 3, cy - 13); g.lineTo(cx + 3, cy - 1); g.stroke();
  // A few sawdust flecks + an offcut.
  g.fillStyle = "#b89357";
  g.fillRect(cx - 13, cy + 7, 4, 2);
  g.fillStyle = "rgba(200,170,110,0.5)";
  g.fillRect(cx + 8, cy + 6, 3, 1.5);
}

/** A market stall: a cart with a striped awning and a crate or two. */
function drawCart(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 10, 13, 4);
  // Cart bed + wheel.
  g.fillStyle = "#5a4127";
  g.fillRect(cx - 11, cy + 2, 22, 6);
  g.fillStyle = "#3a2c1d";
  g.beginPath(); g.arc(cx - 7, cy + 9, 3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + 7, cy + 9, 3, 0, Math.PI * 2); g.fill();
  // Awning posts.
  g.strokeStyle = "#6f5436"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 10, cy + 2); g.lineTo(cx - 10, cy - 9);
  g.moveTo(cx + 10, cy + 2); g.lineTo(cx + 10, cy - 9); g.stroke();
  // Striped awning.
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 === 0 ? "#b5553f" : "#d8cba6";
    g.fillRect(cx - 11 + i * 5.5, cy - 11, 5.5, 4);
  }
  // A crate of goods on the bed.
  g.fillStyle = "#8a6a40";
  g.fillRect(cx - 4, cy - 3, 8, 6);
  g.strokeStyle = "rgba(60,40,20,0.6)"; g.lineWidth = 0.8;
  g.strokeRect(cx - 4, cy - 3, 8, 6);
}

/** A Crafting table: a tanning frame with a stretched hide and a jeweller's lamp. */
function drawCraftingTable(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 10, 13, 4);
  // Table legs + top.
  g.fillStyle = "#3a2c1d";
  g.fillRect(cx - 11, cy + 1, 3, 10);
  g.fillRect(cx + 8, cy + 1, 3, 10);
  g.fillStyle = "#6f5436";
  g.fillRect(cx - 13, cy - 3, 26, 6);
  g.fillStyle = "#7d6040";
  g.fillRect(cx - 13, cy - 3, 26, 2);
  // A hide stretched on a frame at the back.
  g.fillStyle = "#3a2c1d";
  g.fillRect(cx - 10, cy - 12, 2, 9);
  g.fillRect(cx + 1, cy - 12, 2, 9);
  g.fillStyle = "#b89a6a";
  g.beginPath();
  g.moveTo(cx - 8, cy - 11);
  g.lineTo(cx + 1, cy - 11);
  g.lineTo(cx - 0.5, cy - 4);
  g.lineTo(cx - 6.5, cy - 4);
  g.closePath();
  g.fill();
  // A small jeweller's lamp glint on the right.
  g.fillStyle = "#caa05a";
  g.beginPath();
  g.arc(cx + 7, cy - 6, 2.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(245,210,130,0.8)";
  g.beginPath();
  g.arc(cx + 7, cy - 6, 1.1, 0, Math.PI * 2);
  g.fill();
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
function drawNpc(g: CanvasRenderingContext2D, cx: number, cy: number, now: number, moving = false): void {
  const a = walkAnim(now, moving);
  const tunic = "#5a5238", skin = "#caa472";
  shadow(g, cx, cy + 12, 8, 3);
  // legs (feet lift while walking)
  g.fillStyle = "#3a2f23";
  g.fillRect(cx - 5, cy + 6 - a.liftL, 4, 7);
  g.fillRect(cx + 1, cy + 6 - a.liftR, 4, 7);
  // far arm (behind the body)
  limbArm(g, cx + 5.5, cy - 4 + a.bob, 0.12 - a.swing, tunic, skin);
  // tunic + collar + belt (bob)
  g.fillStyle = tunic;
  g.fillRect(cx - 6, cy - 6 + a.bob, 12, 14);
  g.fillStyle = "#6b6344";
  g.fillRect(cx - 6, cy - 6 + a.bob, 12, 3);
  g.fillStyle = "#3a2f23"; // belt
  g.fillRect(cx - 6, cy + 4 + a.bob, 12, 2);
  // near arm (in front)
  limbArm(g, cx - 5.5, cy - 4 + a.bob, -0.12 + a.swing, tunic, skin);
  // head + hair
  g.fillStyle = skin;
  circle(g, cx, cy - 11 + a.bob, 5);
  g.fillStyle = "#5b4a33";
  g.beginPath();
  g.arc(cx, cy - 12 + a.bob, 5, Math.PI, 0);
  g.fill();
}

/** Walk-cycle values (in base px): body bounce, limb swing, per-foot lift. */
function walkAnim(now: number, moving: boolean): { bob: number; swing: number; liftL: number; liftR: number } {
  const step = now / 110;
  return {
    bob: moving ? -Math.abs(Math.sin(step)) * 1.4 : Math.sin(now / 520) * 0.7,
    swing: moving ? Math.sin(step) * 0.5 : 0,
    liftL: moving ? Math.max(0, Math.sin(step)) * 1.7 : 0,
    liftR: moving ? Math.max(0, -Math.sin(step)) * 1.7 : 0,
  };
}

/** One arm from a shoulder (px,py), rotated by `angle`: optional tool + sleeve + hand. */
function limbArm(
  g: CanvasRenderingContext2D,
  px: number, py: number, angle: number, sleeve: string, skin: string, tool = "",
): void {
  g.save();
  g.translate(px, py);
  g.rotate(angle);
  if (tool) drawTool(g, 1, tool); // behind the hand, swings with the arm
  g.fillStyle = sleeve;
  g.fillRect(-1.2, 0, 2.4, 4);
  g.fillStyle = skin;
  g.fillRect(-1, 3.6, 2, 3.2);
  g.beginPath();
  g.arc(0, 7, 1.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Route a monster to its sprite (reusing shapes across similar creatures). */
/** A monster's live attack, while the player is fighting it. */
interface MonsterAttack {
  /** Time to its next swing, 1 → 0 across its attack interval. */
  frac: number;
  /** Unit direction from the creature toward the player (for an animal's lunge). */
  dx: number;
  dy: number;
  /** Set for human-type foes: the weapon swing to play (animals lunge instead). */
  action?: AvatarAnim["action"];
}

function drawMonster(
  g: CanvasRenderingContext2D,
  monster: string | undefined,
  available: boolean,
  cx: number,
  cy: number,
  now: number,
  moving = false,
  attack?: MonsterAttack,
): void {
  if (!available) return drawRespawning(g, cx, cy);
  // Animals (no weapon action) lunge toward the player on the strike; humanoids
  // swing a weapon instead, so they don't lunge.
  const lunge = attack && !attack.action ? attack : null;
  if (lunge) {
    // A pounce on the strike: lunge toward the player and swell a little, easing
    // back out. Concentrated in the back half of the swing so it reads as a snap.
    const t = 1 - lunge.frac;
    const hit = t > 0.5 ? (t - 0.5) / 0.5 : 0;
    const push = hit * 7;
    const k = 1 + hit * 0.14;
    g.save();
    g.translate(lunge.dx * push, lunge.dy * push);
    g.translate(cx, cy); g.scale(k, k); g.translate(-cx, -cy);
    drawMonsterBody(g, monster, cx, cy, now, moving, undefined);
    g.restore();
    return;
  }
  drawMonsterBody(g, monster, cx, cy, now, moving, attack?.action);
}

function drawMonsterBody(
  g: CanvasRenderingContext2D,
  monster: string | undefined,
  cx: number,
  cy: number,
  now: number,
  moving = false,
  action?: AvatarAnim["action"],
): void {
  // Human-type foes share the animated humanoid figure (arms, walk, attack swing).
  const H = (body: string, trim: string) => drawHumanoid(g, cx, cy, now, body, trim, moving, action);
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
      return H("#5b6470", "#7a8492"); // grey armour
    case "redrun_brigand":
      return H("#5a4636", "#6e5742"); // leathers
    case "ancient_orc":
      return H("#4d5a3e", "#5f6e4c"); // green-grey orc
    case "dread_ferryman":
      return H("#1f2630", "#2c3540"); // black-hooded
    // --- Road outlaws (humanoids), each with its own drab palette ---
    case "footpad":
      return H("#4a4238", "#5d5446"); // grey rags
    case "cutpurse":
      return H("#43432f", "#56563d"); // dun cloth
    case "bandit":
      return H("#52402e", "#67503a"); // brown leather
    case "poacher":
      return H("#3c4a30", "#4d5e3f"); // forest green
    case "highwayman":
      return H("#33323a", "#454552"); // dark masked
    case "outlaw_archer":
      return H("#454e34", "#586444"); // olive
    case "cutthroat":
      return H("#4a2e2a", "#5e3b35"); // blood-rust
    case "marauder":
      return H("#3a3a40", "#4c4c54"); // heavy iron
    case "outlaw_captain":
      return H("#5a2630", "#763440"); // maroon captain
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
  moving = false,
  action?: AvatarAnim["action"],
): void {
  const acting = !!action;
  const a = walkAnim(now, moving && !acting);
  // While attacking the figure is planted with a gentle bob; else it walks/idles.
  const bob = acting ? Math.sin(now / 280) * 0.5 : a.bob;
  const skin = "#caa472";
  const nearAngle = acting ? actionArmAngle(action!.frac, action!.kind) : -0.12 + a.swing;
  const farAngle = acting ? 0.22 : 0.12 - a.swing;
  const nearTool = acting ? action!.tool : "";
  shadow(g, cx, cy + 12, 8, 3);
  // legs (feet lift while walking)
  g.fillStyle = "#2b2620";
  g.fillRect(cx - 5, cy + 6 - a.liftL, 4, 8);
  g.fillRect(cx + 1, cy + 6 - a.liftR, 4, 8);
  // far arm (behind the torso), sleeved in the body colour
  limbArm(g, cx + 6, cy - 4 + bob, farAngle, body, skin);
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
  // near arm (in front of the torso), holding any weapon while attacking
  limbArm(g, cx - 6, cy - 4 + bob, nearAngle, body, skin, nearTool);
  g.fillStyle = skin; // head / hood-shadow
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

/**
 * A discoverable relic: a little cairn with a pale page pinned to it, and a soft
 * gold shimmer above to catch a wandering eye (the "something's here" tell).
 */
function drawRelic(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
): void {
  shadow(g, cx, cy + 12, 9, 3.5);
  // A small stacked-stone cairn.
  g.fillStyle = "#6f6a5e";
  g.beginPath();
  g.ellipse(cx, cy + 8, 8, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#807a6b";
  g.beginPath();
  g.ellipse(cx - 1, cy + 3, 6, 3.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#8d8676";
  g.beginPath();
  g.ellipse(cx, cy - 1, 4, 2.4, 0, 0, Math.PI * 2);
  g.fill();
  // A pale page pinned to the cairn, lightly curled.
  g.fillStyle = "#e8dcb8";
  g.beginPath();
  g.moveTo(cx - 4, cy - 11);
  g.lineTo(cx + 4, cy - 12);
  g.lineTo(cx + 5, cy - 2);
  g.lineTo(cx - 4, cy - 1);
  g.closePath();
  g.fill();
  g.strokeStyle = "#b3a878";
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(cx - 2, cy - 9); g.lineTo(cx + 3, cy - 9.5);
  g.moveTo(cx - 2, cy - 6.5); g.lineTo(cx + 3, cy - 7);
  g.moveTo(cx - 2, cy - 4); g.lineTo(cx + 1, cy - 4.2);
  g.stroke();
  // A breathing gold shimmer above, so it reads as "worth a look".
  const tw = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(now / 380));
  g.fillStyle = `rgba(242, 207, 107, ${tw.toFixed(3)})`;
  g.beginPath();
  g.arc(cx + 5, cy - 14, 1.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = `rgba(242, 207, 107, ${(tw * 0.6).toFixed(3)})`;
  g.beginPath();
  g.arc(cx + 5, cy - 14, 3.2, 0, Math.PI * 2);
  g.fill();
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
  look?: Appearance,
  moving = false,
  action?: AvatarAnim["action"],
): void {
  const cx = pos.x * TILE + TILE / 2 - cam.x;
  const cy = pos.y * TILE + TILE / 2 - cam.y;
  drawAvatar(g, cx, cy, 1, withDefaults(look), { now, moving, ...(action ? { action } : {}) });
}

/**
 * Map the player's current activity to an avatar action — the tool in hand and
 * how far through the swing we are — so the arm animates in time with the work.
 * `frac` counts down 1 → 0 to the next action beat (when ore breaks, a log
 * falls, a recipe completes). Returns undefined when idle/walking.
 */
function playerAction(
  player: WorldState["player"],
  content: Content,
  now: number,
): AvatarAnim["action"] | undefined {
  const act = player.activity;
  if (act.kind === "idle") return undefined;
  const swingFrac = (interval: number) => Math.max(0, Math.min(1, (act.nextActionAt - now) / interval));
  // Combat: swing the worn weapon (or draw a bow at range). The swing interval is
  // taken from the *current* weapon's speed, so the cadence always matches the
  // weapon actually in hand — a dagger (1600ms) visibly faster than a hammer.
  if (act.kind === "combat") {
    const wepId = player.equipment.ranged ?? player.equipment.mainhand;
    const interval = (wepId && content.items[wepId]?.speed) || 2400; // COMBAT.playerMeleeSpeed
    if (player.equipment.ranged) return { kind: "ranged", tool: "bow", frac: swingFrac(interval) };
    const type = (player.equipment.mainhand && content.items[player.equipment.mainhand]?.wepType) || "sword";
    return { kind: "combat", tool: type, frac: swingFrac(interval) };
  }
  // Gathering / crafting: the action interval the engine is repeating on.
  const TOOL: Record<string, string> = {
    mining: "pickaxe", woodcutting: "axe", fishing: "rod", crafting: "", trapping: "",
  };
  if (!(act.kind in TOOL)) return undefined;
  return { kind: act.kind, tool: TOOL[act.kind]!, frac: swingFrac(act.actionInterval || 600) };
}

/** The human-type monsters that swing a weapon; the rest are animals that lunge. */
const HUMANOID_MONSTERS = new Set([
  "bog_knight", "redrun_brigand", "ancient_orc", "dread_ferryman",
  "footpad", "cutpurse", "bandit", "poacher", "highwayman",
  "outlaw_archer", "cutthroat", "marauder", "outlaw_captain",
]);

/**
 * A monster's attack while the player is fighting it. It swings on its own clock
 * (obj.nextAttackAt every stats.speed) so the animation matches its real attack
 * speed. Human-type foes get a weapon swing (by attack style; archers a bow);
 * animals get a lunge toward the player instead. Undefined when not engaged.
 */
function monsterAttack(
  def: WorldObjectDef,
  obj: WorldObjectState,
  state: WorldState,
  content: Content,
  now: number,
): MonsterAttack | undefined {
  if (def.kind !== "monster" || !def.monster) return undefined;
  const act = state.player.activity;
  if (act.kind !== "combat" || act.targetId !== def.id || !obj.nextAttackAt) return undefined;
  const stats = content.monsters[def.monster];
  if (!stats) return undefined;
  const interval = stats.speed || 3000; // COMBAT.monsterSpeed
  const frac = Math.max(0, Math.min(1, (obj.nextAttackAt - now) / interval));
  // Direction from the creature toward the player, for an animal's lunge.
  const mp = objectPos(def, obj);
  const pp = state.player.pos;
  let dx = pp.x - mp.x, dy = pp.y - mp.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  if (HUMANOID_MONSTERS.has(def.monster)) {
    if (def.monster === "poacher" || def.monster === "outlaw_archer") {
      return { frac, dx, dy, action: { kind: "ranged", tool: "bow", frac } };
    }
    const style = stats.attackStyle;
    const tool = style === "crush" ? "hammer" : style === "stab" ? "spear" : "sword";
    return { frac, dx, dy, action: { kind: "combat", tool, frac } };
  }
  return { frac, dx, dy }; // animal: lunge only
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
