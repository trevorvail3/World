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
  ItemDef,
  ItemId,
  SkillAction,
  TileType,
  Vec2,
  WorldMap,
  WorldObjectDef,
  WorldObjectState,
  WorldState,
} from "../core/types.ts";
import { objectPos, objectHidden } from "../core/worldCore.ts";
import { type RoofStyle, INTERIOR_TOP, cityDoor, cityRoof, instanceRectAt, tileAt, REGIONS, CITY } from "../content/map.ts";
import { type AvatarAnim, actionArmAngle, drawAvatar, drawTool, withDefaults } from "./avatar.ts";
import type { Ghost } from "./presence.ts";
import { type GearLook, resolveGear } from "./gearLook.ts";
import { itemIconSVG } from "./itemIcon.ts";

// Ground loot renders as the actual item's icon: rasterise each item's SVG badge
// to an <img> once (async), cache by id, and draw it on the tile. Until an image
// has decoded, the caller falls back to a small sack so nothing pops in blank.
const groundImgCache = new Map<string, HTMLImageElement>();
function groundItemImage(def: ItemDef): HTMLImageElement | null {
  const cached = groundImgCache.get(def.id);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(itemIconSVG(def));
  groundImgCache.set(def.id, img);
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// Which way the player last faced (kept across idle / vertical-only movement, so
// the figure doesn't snap back to the default when you walk straight up or down).
let playerFaceLeft = false;
// A summoned companion trails the player with a little lag — its smoothed world
// position (in pixels) is eased toward a point just behind the player each frame.
let petWx: number | null = null;
let petWy = 0;

export const TILE = 40; // pixels per tile

/** Draw distance in TILES from the player — anything past this isn't painted, so
 *  wide screens don't drag (OSRS-style circular view). Infinity = unlimited. Set
 *  by the loop each frame from the player's Settings slider. */
let drawDist = Infinity;
export function setDrawDistance(tiles: number): void {
  drawDist = tiles > 0 ? tiles : Infinity;
}

/** OSRS-style floor-loot labels: show each pile's item name above it. Toggleable. */
let lootLabels = true;
export function setLootLabels(on: boolean): void { lootLabels = on; }

/** How long the actual strike motion plays (ms). The rest of a weapon's interval
 *  is spent resting in a ready pose, so a swing reads as a quick chop + a pause
 *  rather than one slow continuous wind-up across the whole interval. */
const STRIKE_MS = 460;
/** Map "time until the blow lands" to the swing fraction (1 = rest → 0 = strike),
 *  holding at the ready pose until the final STRIKE_MS window. */
function snapStrike(untilSwing: number, interval: number): number {
  const win = Math.min(STRIKE_MS, interval);
  if (untilSwing > win) return 1; // resting between swings
  return Math.max(0, Math.min(1, untilSwing / win)); // quick strike
}

/** One entity's recent hit, driving a brief pop-and-recoil when it's struck. */
export interface HitFx { born: number; dx: number; dy: number; crit: boolean }
/** Per-entity hit effects (keyed by object id, or "player"), set by the loop
 *  each frame before drawWorld. A small "thwack" of squash + knockback. */
let combatHits: Map<string, HitFx> | null = null;
export function setCombatHits(m: Map<string, HitFx>): void { combatHits = m; }
const HIT_FX_DUR = 220; // ms a hit pop lasts

/** The scale + pixel offset to apply to an entity sprite for a recent hit. */
function hitPop(id: string, now: number): { s: number; ox: number; oy: number } | null {
  const fx = combatHits?.get(id);
  if (!fx) return null;
  const phase = (now - fx.born) / HIT_FX_DUR;
  if (phase < 0 || phase >= 1) return null;
  const pulse = Math.sin(phase * Math.PI);          // 0 → 1 → 0
  const s = 1 + (fx.crit ? 0.30 : 0.20) * pulse;     // squash bigger on a weakness hit
  const kick = (fx.crit ? 6 : 4) * pulse;            // a little knockback in the hit's direction
  return { s, ox: fx.dx * kick, oy: fx.dy * kick };
}

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

/** A cheap, stable pseudo-noise so tiles get a fixed bit of texture. */
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Small wild-flower colours — a little life against all the green. */
const FLOWERS = ["#d9637a", "#e8d24a", "#cf6fc0", "#eae6ee", "#6f9ad6", "#e08a3a"];

/**
 * Decorative, walk-through groundcover scattered deterministically across wild
 * ground, varied by terrain so each region reads like itself: flowers and tufts
 * on grass, mushrooms/ferns/fallen logs on the forest floor, reeds in the moor,
 * snowdrifts and bare twigs on snow, charred stumps and embers on the ash flats,
 * and scattered pebbles/boulders on dirt and stone. Purely cosmetic — none of
 * this is an object, can't be collided with or harvested (the real choppable
 * trees and rocks are world objects drawn elsewhere).
 */
function scatterVegetation(
  g: CanvasRenderingContext2D,
  tile: TileType,
  px: number,
  py: number,
  x: number,
  y: number,
  now: number,
): void {
  const green = tile === "grass" || tile === "moss" || tile === "bog";
  if (!green && tile !== "snow" && tile !== "ash" && tile !== "stone" && tile !== "dirt") return;

  const h = hash(x, y);
  // Per-terrain density: the forest floor is lush, the flats and screes sparse.
  const density = tile === "moss" ? 0.42 : tile === "grass" ? 0.34
    : tile === "bog" ? 0.40 : tile === "ash" ? 0.26
    : tile === "snow" ? 0.24 : 0.20; // dirt / stone
  if (h > density) return; // most tiles stay bare

  // Jittered position within the tile, from independent hashes.
  const jx = px + 6 + hash(x + 7, y) * (TILE - 12);
  const jy = py + 8 + hash(x, y + 13) * (TILE - 16);
  const h2 = hash(x * 2.7 + 19, y * 1.3 + 5); // picks the variant
  // A gentle breeze: tops sway, rooted bases stay put (phase varies per tile).
  const sway = Math.sin(now / 900 + x * 0.7 + y * 0.5) * 1.7;

  // --- Stone / scree: pebbles and the rare boulder. ---
  if (tile === "stone" || tile === "dirt") {
    if (h2 < 0.08) { // a boulder
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.beginPath(); g.ellipse(jx, jy + 5, 9, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#6a6b73";
      g.beginPath(); g.ellipse(jx, jy + 1, 8, 6.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#838690";
      g.beginPath(); g.ellipse(jx - 2, jy - 1, 4, 3, 0, 0, Math.PI * 2); g.fill();
    } else { // a few pebbles
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i % 2 ? "rgba(150,152,162,0.5)" : "rgba(0,0,0,0.18)";
        g.beginPath();
        g.ellipse(jx - 5 + i * 5 + hash(x + i, y) * 3, jy + (i % 2 ? 2 : 5), 2.4, 1.6, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    return;
  }

  // --- Snow: drifts and bare dead twigs. ---
  if (tile === "snow") {
    if (h2 < 0.4) { // a soft drift mound
      g.fillStyle = "rgba(120,140,165,0.30)";
      g.beginPath(); g.ellipse(jx, jy + 4, 9, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.beginPath(); g.ellipse(jx, jy + 2, 7.5, 3.5, 0, 0, Math.PI * 2); g.fill();
    } else { // a bare frosted twig
      g.strokeStyle = "#7c7468"; g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(jx, jy + 5); g.lineTo(jx + sway * 0.4, jy - 4);
      g.moveTo(jx + sway * 0.3, jy); g.lineTo(jx + 4, jy - 5);
      g.moveTo(jx + sway * 0.3, jy); g.lineTo(jx - 4, jy - 4);
      g.stroke();
    }
    return;
  }

  // --- Ash flats: charred stumps, ash mounds and the odd live ember. ---
  if (tile === "ash") {
    if (h2 < 0.18) { // a charred stump
      g.fillStyle = "#241c19";
      g.beginPath(); g.ellipse(jx, jy + 4, 5, 2.2, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(jx - 3.5, jy - 4, 7, 9);
      g.fillStyle = "rgba(224,138,58,0.5)"; // a faint ember still glowing in the heart
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now / 280 + x + y));
      g.globalAlpha = pulse;
      g.fillRect(jx - 1.5, jy - 1, 3, 3);
      g.globalAlpha = 1;
    } else { // a pale ash mound
      g.fillStyle = "rgba(120,108,100,0.45)";
      g.beginPath(); g.ellipse(jx, jy + 3, 7, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(60,50,46,0.4)";
      g.beginPath(); g.ellipse(jx + 2, jy + 4, 3, 1.4, 0, 0, Math.PI * 2); g.fill();
    }
    return;
  }

  // --- Bog / moor: reeds and cattails. ---
  if (tile === "bog") {
    g.strokeStyle = "#5a6a3c"; g.lineWidth = 1.4;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const bx = jx - 4 + i * 2.4;
      g.moveTo(bx, jy + 6);
      g.lineTo(bx + (i % 2 ? 2 : -2) + sway, jy - 7);
    }
    g.stroke();
    if (h2 < 0.4) { // a brown cattail head on one stalk
      g.fillStyle = "#6e4a2c";
      g.fillRect(jx - 0.5 + sway, jy - 9, 2, 5);
    }
    return;
  }

  // --- Forest floor (moss) & grassland: greenery, flowers, mushrooms, logs. ---
  const tint = tile === "moss" ? "#46622f" : "#4f6e33";
  const dark = tile === "moss" ? "#2f4422" : "#374e25";

  if (tile === "moss" && h2 < 0.07) {
    // A mossy fallen log lying across the forest floor.
    g.fillStyle = "rgba(0,0,0,0.20)";
    g.beginPath(); g.ellipse(jx, jy + 4, 12, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#5a3f24";
    g.beginPath(); g.ellipse(jx, jy, 12, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#6b4a2c"; // lit top
    g.beginPath(); g.ellipse(jx, jy - 1, 11, 2.4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#3f5a2a"; // moss on the bark
    g.beginPath(); g.ellipse(jx - 4, jy - 1, 3, 1.5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(jx + 5, jy, 2.5, 1.3, 0, 0, Math.PI * 2); g.fill();
    return;
  }
  if (tile === "moss" && h2 < 0.22) {
    // A little cluster of mushrooms.
    const red = h2 < 0.14;
    for (let i = 0; i < 2; i++) {
      const mx = jx - 3 + i * 6, my = jy + i * 2;
      g.fillStyle = "#d9cdb6"; g.fillRect(mx - 1, my - 1, 2.2, 5); // stem
      g.fillStyle = red ? "#b5462f" : "#8a6a45"; // cap
      g.beginPath(); g.ellipse(mx, my - 1, 3.2, 2.2, 0, Math.PI, 0); g.fill();
      if (red) { g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(mx - 1, my - 2, 1.2, 1.2); g.fillRect(mx + 1, my - 1.5, 1, 1); }
    }
    return;
  }

  if (h < 0.045) {
    // A small decorative tree, casting a soft dapple of shade on the ground.
    g.fillStyle = "rgba(0,0,0,0.16)";
    g.beginPath(); g.ellipse(jx + 3, jy + 4, 11, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#5a3f24";
    g.fillRect(jx - 1.5, jy, 3, 9);
    g.fillStyle = dark;
    g.beginPath(); g.arc(jx + sway, jy - 2, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = tint;
    g.beginPath(); g.arc(jx - 2 + sway, jy - 4, 6, 0, Math.PI * 2); g.fill();
  } else if (h < 0.13) {
    // A leafy bush: two overlapping blobs.
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(jx, jy, 7, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = tint;
    g.beginPath(); g.ellipse(jx - 2 + sway * 0.5, jy - 1.5, 4.5, 3.5, 0, 0, Math.PI * 2); g.fill();
  } else if (tile === "grass" && h2 < 0.34) {
    // A wild flower: a short stem and a little burst of petals.
    const col = FLOWERS[Math.floor(hash(x + 3, y + 8) * FLOWERS.length)] ?? FLOWERS[0]!;
    g.strokeStyle = "#3c5226"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(jx, jy + 4); g.lineTo(jx + sway * 0.5, jy - 2); g.stroke();
    g.fillStyle = col;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.ellipse(jx + sway * 0.5 + Math.cos(a) * 2.2, jy - 2 + Math.sin(a) * 2.2, 1.5, 1.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#e8d24a";
    g.beginPath(); g.ellipse(jx + sway * 0.5, jy - 2, 1.4, 1.4, 0, 0, Math.PI * 2); g.fill();
  } else {
    // Grass / fern tufts: a few upright blades that bend in the breeze.
    g.strokeStyle = tint; g.lineWidth = 1.4;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const bx = jx - 4 + i * 2.6;
      g.moveTo(bx, jy + 4);
      g.lineTo(bx + (i % 2 ? 1.5 : -1.5) + sway, jy - 3);
    }
    g.stroke();
  }
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
      // Foam where the water laps against land — a soft, breathing highlight on
      // any edge facing a walkable tile (completes the shoreline from both sides).
      const wd = map.width;
      const land = (tx: number, ty: number): boolean => {
        if (tx < 0 || ty < 0 || tx >= wd || ty >= map.height) return false;
        const t = map.tiles[ty * wd + tx];
        return t !== "water" && t !== "deep";
      };
      if (land(x - 1, y) || land(x + 1, y) || land(x, y - 1) || land(x, y + 1)) {
        g.globalAlpha = 0.22 + 0.14 * Math.sin(now / 700 + x * 0.9 + y);
        g.fillStyle = "rgba(225,238,245,0.9)";
        if (land(x - 1, y)) g.fillRect(px, py + 2, 2, TILE - 4);
        if (land(x + 1, y)) g.fillRect(px + TILE - 2, py + 2, 2, TILE - 4);
        if (land(x, y - 1)) g.fillRect(px + 2, py, TILE - 4, 2);
        if (land(x, y + 1)) g.fillRect(px + 2, py + TILE - 2, TILE - 4, 2);
        g.globalAlpha = 1;
      }
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
      // A couple of loose pebbles for grit.
      if (hv > 0.4) {
        g.fillStyle = "rgba(0,0,0,0.18)";
        g.beginPath(); g.ellipse(px + TILE * (0.6 + 0.25 * hv), py + TILE * 0.7, 2.5, 1.8, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(150,150,160,0.22)";
        g.beginPath(); g.ellipse(px + TILE * 0.3, py + TILE * (0.6 + 0.2 * hv), 2, 1.5, 0, 0, Math.PI * 2); g.fill();
      }
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
      if (tile === "cave_wall") {
        g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(px, py, TILE, 2);
        // A rare vein of glittering ore in the rock face — slowly pulsing, with a
        // soft glow halo so the lode catches the eye in the dark.
        if (hv > 0.84) {
          const cyan = hv > 0.93;
          const oy = py + TILE * (0.3 + 0.4 * hash(x, y + 9));
          const ox = px + TILE * 0.3;
          const pulse = 0.55 + 0.45 * Math.sin(now / 520 + x * 1.3 + y);
          g.save();
          g.globalCompositeOperation = "lighter";
          const glow = cyan ? "120,205,215" : "210,170,90";
          const grd = g.createRadialGradient(ox + 2, oy, 0, ox + 2, oy, 9);
          grd.addColorStop(0, `rgba(${glow},${(0.40 * pulse).toFixed(2)})`);
          grd.addColorStop(1, `rgba(${glow},0)`);
          g.fillStyle = grd; g.beginPath(); g.arc(ox + 2, oy, 9, 0, Math.PI * 2); g.fill();
          g.globalCompositeOperation = "source-over";
          g.fillStyle = cyan ? `rgba(150,220,230,${(0.55 + 0.4 * pulse).toFixed(2)})` : `rgba(180,150,100,${(0.5 + 0.4 * pulse).toFixed(2)})`;
          g.fillRect(ox, oy, 3, 2);
          g.fillRect(ox + 3, oy - 2, 2, 2);
          g.restore();
        }
      } else if (hv > 0.9) {
        // A faint mineral glint on the cave floor — a little life in the dark.
        g.fillStyle = "rgba(110,170,180,0.4)";
        g.fillRect(px + TILE * (0.4 + 0.2 * hv), py + TILE * 0.55, 2, 2);
      }
      break;
    }
    case "plank": {
      // A swept timber floor: warm boards with seams and a soft top highlight.
      g.strokeStyle = "rgba(40,24,10,0.30)"; g.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const yy = py + Math.round(i * TILE / 3);
        g.beginPath(); g.moveTo(px, yy + 0.5); g.lineTo(px + TILE, yy + 0.5); g.stroke();
      }
      // a staggered cross-joint, so boards don't line up tile to tile
      const jx = px + Math.round(TILE * (0.3 + 0.4 * hv));
      const band = hv > 0.5 ? 0 : 1;
      g.beginPath(); g.moveTo(jx + 0.5, py + band * TILE / 3); g.lineTo(jx + 0.5, py + (band + 1) * TILE / 3); g.stroke();
      g.fillStyle = "rgba(255,224,170,0.07)";
      for (let i = 0; i < 3; i++) g.fillRect(px, py + Math.round(i * TILE / 3) + 1, TILE, 1.5);
      g.fillStyle = "rgba(60,38,18,0.18)"; // a few grain flecks
      for (let i = 0; i < 3; i++) g.fillRect(px + hash(x * 3 + i, y) * (TILE - 6), py + hash(x, y * 3 + i) * (TILE - 4), 3, 1);
      return; // boards are texture enough; skip the ground grid
    }
  }

  // Shoreline: a pale, damp band wherever walkable ground meets open water, so
  // coasts and riverbanks read as edges instead of a hard colour cut. Bog keeps
  // a darker, muddier rim (no bright sand in a mire).
  const wid = map.width;
  const wet = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= wid || ty >= map.height) return false;
    const t = map.tiles[ty * wid + tx];
    return t === "water" || t === "deep";
  };
  if (wet(x - 1, y) || wet(x + 1, y) || wet(x, y - 1) || wet(x, y + 1)) {
    g.fillStyle = tile === "bog" ? "rgba(28,40,34,0.55)" : "rgba(204,190,150,0.45)";
    if (wet(x - 1, y)) g.fillRect(px, py, 3, TILE);
    if (wet(x + 1, y)) g.fillRect(px + TILE - 3, py, 3, TILE);
    if (wet(x, y - 1)) g.fillRect(px, py, TILE, 3);
    if (wet(x, y + 1)) g.fillRect(px, py + TILE - 3, TILE, 3);
  }

  // Edge blending: where two different walkable ground types meet, dither a few
  // specks of the neighbour's colour across the seam so biomes feather into one
  // another instead of hard-cutting on the grid. (Skips water/walls — those have
  // their own edges above.)
  const groundFamily = (t: TileType | undefined): boolean =>
    t === "grass" || t === "dirt" || t === "moss" || t === "ash" || t === "snow" ||
    t === "bog" || t === "stone" || t === "cave" || t === "path";
  if (groundFamily(tile)) {
    const edges: [number, number, number, number][] = [
      [-1, 0, px + 1, py], [1, 0, px + TILE - 4, py],
      [0, -1, px, py + 1], [0, 1, px, py + TILE - 4],
    ];
    for (const [dx, dy, ex, ey] of edges) {
      const nt = map.tiles[(y + dy) * wid + (x + dx)] as TileType | undefined;
      if (!nt || nt === tile || !groundFamily(nt)) continue;
      g.fillStyle = TILE_COLORS[nt][0];
      for (let i = 0; i < 4; i++) {
        const a = hash(x * 7 + i + dx * 3, y * 5 + i + dy * 3);
        const along = a * (TILE - 4);
        const into = hash(x + i, y + i * 2) * 3;
        g.globalAlpha = 0.35 + 0.35 * a;
        if (dx === 0) g.fillRect(ex + along, ey + into, 3, 3);
        else g.fillRect(ex + into, ey + along, 3, 3);
      }
    }
    g.globalAlpha = 1;
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

/** Obstacles of each agility course, grouped and ordered (cheap; few objects). */
function agilityCourses(content: Content): Map<string, WorldObjectDef[]> {
  const byCourse = new Map<string, WorldObjectDef[]>();
  for (const o of content.objects) {
    if (o.kind !== "agility_obstacle" || !o.course) continue;
    const arr = byCourse.get(o.course) ?? [];
    arr.push(o);
    byCourse.set(o.course, arr);
  }
  for (const arr of byCourse.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return byCourse;
}

/**
 * The worn track + fence that turn scattered obstacles into a readable course:
 * a looping dirt path through the obstacles in order, ringed by fence posts.
 * Purely cosmetic (drawn under the obstacles); no collision.
 */
function drawAgilityTracks(
  g: CanvasRenderingContext2D,
  content: Content,
  cam: Camera,
  w: number,
  h: number,
  inRegion: (x: number, y: number) => boolean,
): void {
  const sx = (tx: number): number => tx * TILE + TILE / 2 - cam.x;
  const sy = (ty: number): number => ty * TILE + TILE / 2 - cam.y;
  for (const [course, pts] of agilityCourses(content).entries()) {
    if (pts.length < 2) continue;
    // The Varathian Trail rings the entire map — a single bounding box round it
    // would fence in the whole world. It has no worn track/fence; its checkpoints
    // stand alone and the next-leg marker guides you between them.
    if (course === "course_varath_trail") continue;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of pts) {
      minx = Math.min(minx, p.x!); miny = Math.min(miny, p.y!);
      maxx = Math.max(maxx, p.x!); maxy = Math.max(maxy, p.y!);
    }
    if (!inRegion(Math.round((minx + maxx) / 2), Math.round((miny + maxy) / 2))) continue;
    if (sx(maxx) < -TILE || sx(minx) > w + TILE || sy(maxy) < -TILE || sy(miny) > h + TILE) continue;

    g.save();
    // Worn dirt track looping through the obstacles in order.
    g.strokeStyle = "rgba(116, 92, 56, 0.4)";
    g.lineWidth = 11;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(sx(pts[0]!.x!), sy(pts[0]!.y!));
    for (let i = 1; i < pts.length; i++) g.lineTo(sx(pts[i]!.x!), sy(pts[i]!.y!));
    g.lineTo(sx(pts[0]!.x!), sy(pts[0]!.y!)); // close the circuit
    g.stroke();
    // A light fence ringing the course.
    const fx0 = (minx - 1) * TILE - cam.x, fy0 = (miny - 1) * TILE - cam.y;
    const fx1 = (maxx + 2) * TILE - cam.x, fy1 = (maxy + 2) * TILE - cam.y;
    g.strokeStyle = "rgba(110, 84, 50, 0.55)";
    g.lineWidth = 2;
    g.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    g.fillStyle = "#6e542f";
    for (let px = fx0; px <= fx1 + 1; px += TILE) {
      g.fillRect(px - 1.5, fy0 - 3, 3, 7);
      g.fillRect(px - 1.5, fy1 - 3, 3, 7);
    }
    for (let py = fy0; py <= fy1 + 1; py += TILE) {
      g.fillRect(fx0 - 1.5, py - 3, 3, 7);
      g.fillRect(fx1 - 1.5, py - 3, 3, 7);
    }
    g.restore();
  }
}

/**
 * The Varathian Trail's ground path: a soft worn track threading its far-flung
 * checkpoints in order, so a runner can follow the ground to the next one rather
 * than guessing across open country. Deliberately faint — a trodden line, not a
 * road — and drawn per-segment with view culling (the whole loop spans the map).
 */
function drawTrailPath(
  g: CanvasRenderingContext2D,
  content: Content,
  cam: Camera,
  w: number,
  h: number,
  inRegion: (x: number, y: number) => boolean,
  outside: (x: number, y: number) => boolean,
): void {
  const pts = content.objects
    .filter((o) => o.course === "course_varath_trail")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (pts.length < 2) return;
  const sx = (tx: number): number => (tx + 0.5) * TILE - cam.x;
  const sy = (ty: number): number => (ty + 0.5) * TILE - cam.y;
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!; // close the loop
    // Cull segments wholly off-screen or outside the current region/draw-distance.
    const midx = Math.round((a.x! + b.x!) / 2), midy = Math.round((a.y! + b.y!) / 2);
    if (!inRegion(midx, midy) || outside(midx, midy)) continue;
    const ax = sx(a.x!), ay = sy(a.y!), bx = sx(b.x!), by = sy(b.y!);
    if (Math.max(ax, bx) < -TILE || Math.min(ax, bx) > w + TILE ||
        Math.max(ay, by) < -TILE || Math.min(ay, by) > h + TILE) continue;
    // Just a thin dotted trail — a faint dashed line marking the way to the next
    // checkpoint, not a worn road.
    g.strokeStyle = "rgba(150, 200, 150, 0.5)";
    g.lineWidth = 1.5;
    g.setLineDash([3, 7]);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  }
  g.setLineDash([]);
  g.restore();
}

/**
 * OSRS-style next-obstacle marker: a pulsing green ring + chevron over the
 * obstacle to take next — the course's first leg until you start a lap, then
 * advancing leg by leg as you clear them.
 */
function drawAgilityMarkers(
  g: CanvasRenderingContext2D,
  state: WorldState,
  content: Content,
  cam: Camera,
  w: number,
  h: number,
  now: number,
  inRegion: (x: number, y: number) => boolean,
): void {
  const lap = state.player.agilityLap;
  for (const [course, obs] of agilityCourses(content)) {
    const nextIdx = lap && lap.course === course ? lap.next : 0;
    const target = obs.find((o) => (o.order ?? 0) === nextIdx);
    if (!target || !inRegion(target.x!, target.y!)) continue;
    const px = target.x! * TILE + TILE / 2 - cam.x;
    const py = target.y! * TILE + TILE / 2 - cam.y;
    if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
    const pulse = 0.5 + 0.5 * Math.sin(now / 300);
    g.save();
    g.strokeStyle = `rgba(150, 210, 74, ${0.45 + 0.4 * pulse})`;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(px, py, TILE * 0.42 + pulse * 3, 0, Math.PI * 2);
    g.stroke();
    const by = py - TILE * 0.72 - pulse * 3;
    g.fillStyle = "#b6d24a";
    g.beginPath();
    g.moveTo(px, by + 7);
    g.lineTo(px - 6, by - 3);
    g.lineTo(px + 6, by - 3);
    g.closePath();
    g.fill();
    g.restore();
  }
}

/** A dropped item on the floor — drawn as its own icon (a rod looks like a rod),
 *  over a soft glow so it reads as loot. Falls back to a sack until the icon
 *  image has decoded. */
function drawGroundItem(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  qty: number,
  def?: ItemDef,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(now / 380);
  g.save();
  // Soft warm glow so loot reads against the ground.
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 13);
  grad.addColorStop(0, `rgba(242,207,107,${0.22 + 0.16 * pulse})`);
  grad.addColorStop(1, "rgba(242,207,107,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, 13, 0, Math.PI * 2);
  g.fill();
  // A faint ground shadow the item sits on.
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.ellipse(cx, cy + 7, 8, 3, 0, 0, Math.PI * 2);
  g.fill();
  const img = def ? groundItemImage(def) : null;
  if (img) {
    const S = 22; // draw the 32×32 badge at 22px on the tile
    g.drawImage(img, cx - S / 2, cy - S / 2 - 1, S, S);
  } else {
    // Fallback: a little drawstring sack until the icon decodes (or if unknown).
    g.fillStyle = "#6e4f2c";
    g.beginPath();
    g.ellipse(cx, cy + 2, 6, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#8a6a3a";
    g.fillRect(cx - 3.5, cy - 4, 7, 3);
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, cy + 2, 6, 5, 0, 0, Math.PI * 2);
    g.stroke();
  }
  if (qty > 1) {
    g.fillStyle = "#f2cf6b";
    g.font = "bold 10px 'Cinzel', serif";
    g.textAlign = "center";
    g.fillText(String(qty), cx, cy + 16);
    g.textAlign = "left";
  }
  g.restore();
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
  ghosts: Ghost[] = [],
): void {
  // Visible span in world pixels. Under a zoom transform this is the device size
  // over the zoom, so tile culling and the night veil cover exactly the view.
  const w = viewW;
  const h = viewH;

  // When the player is inside a sealed instance (a home or a boss arena), the
  // view is masked to that one region — everything outside it is void, so you
  // never see the neighbouring rooms or the arena band around it.
  const ppos = state.player.pos;
  const region = instanceRectAt(Math.round(ppos.x), Math.round(ppos.y));
  const inRegion = (x: number, y: number) =>
    !region || (x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1);

  g.fillStyle = region ? "#07070a" : "#13100d";
  g.fillRect(0, 0, w, h);

  const { map } = state;
  const sv = sunCast(); // sun position → directional shadows + night factor
  const minX = Math.max(0, Math.floor(cam.x / TILE));
  const minY = Math.max(0, Math.floor(cam.y / TILE));
  const maxX = Math.min(map.width - 1, Math.ceil((cam.x + w) / TILE));
  const maxY = Math.min(map.height - 1, Math.ceil((cam.y + h) / TILE));

  // Draw distance: a circular cull around the player so a wide screen doesn't
  // paint (and texture) hundreds of off-radius tiles. `dd2` is the squared
  // radius; `outside()` is the per-tile/per-object test (always false when the
  // distance is unlimited).
  const pdx = ppos.x, pdy = ppos.y;
  const dd2 = drawDist === Infinity ? Infinity : (drawDist + 0.5) * (drawDist + 0.5);
  const outside = (x: number, y: number): boolean =>
    dd2 !== Infinity && ((x - pdx) * (x - pdx) + (y - pdy) * (y - pdy)) > dd2;

  // --- Tiles ---
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!inRegion(x, y)) continue; // mask everything outside the current instance
      if (outside(x, y)) continue;   // past the draw distance — leave it void
      const tile = map.tiles[y * map.width + x]!;
      const px = x * TILE - cam.x;
      const py = y * TILE - cam.y;
      paintTile(g, tile, px, py, x, y, now, map);
      scatterVegetation(g, tile, px, py, x, y, now);
    }
  }

  // Ambient water wildlife on the surface: fins in the deep, leaping fish in the
  // rivers and lakes, the odd whale sounding out at sea. Drawn over the water but
  // under everything else, so the day/night veil tints it with the water.
  drawWaterLife(g, map, cam, minX, maxX, minY, maxY, now, inRegion, outside);

  // Agility courses: worn track + fence, drawn under the obstacles themselves.
  drawAgilityTracks(g, content, cam, w, h, inRegion);
  drawTrailPath(g, content, cam, w, h, inRegion, outside);

  // --- Loot on the floor (kill drops awaiting pickup) ---
  // Drawn before objects so creatures and the player render ON TOP of loot —
  // it's lying on the ground, not floating over heads.
  for (const gi of state.ground) {
    if (!inRegion(gi.x, gi.y)) continue;
    if (outside(gi.x, gi.y)) continue; // past the draw distance
    const px = gi.x * TILE - cam.x;
    const py = gi.y * TILE - cam.y;
    if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
    // Fan separate piles on the same tile out a little (by stable id) so each
    // kill's loot reads as its own pile rather than one merged heap.
    const ox = ((gi.id % 3) - 1) * 7;
    const oy = ((Math.floor(gi.id / 3) % 3) - 1) * 6;
    drawGroundItem(g, px + TILE / 2 + ox, py + TILE / 2 + oy, now, gi.qty, content.items[gi.item]);
  }

  // OSRS-style floor-loot name labels, drawn in a second pass so they sit ON TOP
  // of every pile. High-value drops glow gold so they catch the eye. Toggleable.
  if (lootLabels) {
    for (const gi of state.ground) {
      if (!inRegion(gi.x, gi.y) || outside(gi.x, gi.y)) continue;
      const px = gi.x * TILE - cam.x;
      const py = gi.y * TILE - cam.y;
      if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
      const ox = ((gi.id % 3) - 1) * 7;
      const oy = ((Math.floor(gi.id / 3) % 3) - 1) * 6;
      const def = content.items[gi.item];
      if (!def) continue;
      const name = gi.qty > 1 ? `${def.name} (${gi.qty})` : def.name;
      const valuable = (def.sell ?? 0) * gi.qty >= 1000;
      label(g, name, px + TILE / 2 + ox, py + oy - 2, valuable ? "#f4d98b" : "#e8e2d0");
    }
  }

  // --- Objects ---
  const lights: Array<[number, number]> = []; // warm light sources, for night
  const trophy = trophyGlyph(state, content); // the player's rarest item, for display cases
  // Label de-clutter: collect the boxes of labels already drawn (NPC/monster
  // names) so fishing-spot labels — which pile up where shoals cluster — can be
  // drawn last with collision avoidance instead of bleeding into each other.
  const labelBoxes: Array<[number, number, number, number]> = [];
  const fishLabels: Array<{ cx: number; yb: number; text: string; color: string; locked: boolean; dist: number }> = [];
  const labelBox = (text: string, cx: number, yb: number): [number, number, number, number] => {
    const half = (text.length * 5.2 + 4) / 2;
    return [cx - half, yb - 11, cx + half, yb + 1];
  };
  const labelHits = (b: [number, number, number, number]): boolean =>
    labelBoxes.some((p) => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1]);
  for (const def of content.objects) {
    const obj = state.objects[def.id];
    if (!obj) continue;
    if (objectHidden(def, state.player)) continue; // story-gated: not revealed yet
    // Creatures render at their live (wandering) position; fixed objects at def.
    const p = objectPos(def, obj);
    if (!inRegion(Math.round(p.x), Math.round(p.y))) continue; // mask other instances
    if (outside(p.x, p.y)) continue; // past the draw distance
    const px = p.x * TILE - cam.x;
    const py = p.y * TILE - cam.y;
    if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
    if (def.kind === "plant_patch" || def.kind === "tree_patch") {
      drawPatch(g, obj.crop, obj.plantedAt, content, px, py);
    } else if (def.kind === "housing_plot") {
      drawHousingPlot(g, px + TILE / 2, py + TILE / 2, !!obj.owned);
    } else if (def.kind === "build_hotspot") {
      const f = obj.furniture ? content.furniture[obj.furniture] : undefined;
      const { idx, last } = furnitureRank(content, f);
      drawHotspot(g, px + TILE / 2, py + TILE / 2, f, idx, last, now, trophy);
    } else if (def.kind === "room_seal") {
      if (!obj.owned) drawRoomSeal(g, px + TILE / 2, py + TILE / 2); // unbuilt: boarded-up doorway
    } else {
      // A soft contact shadow under living things (and not under a slain, mid-
      // respawn monster) so they sit on the ground and read against the terrain.
      if ((def.kind === "npc" || def.kind === "critter" || (def.kind === "monster" && obj.available))) {
        castShadow(g, px + TILE / 2, py + TILE - 4, sv); // sun-cast shadow under the contact one
        shadow(g, px + TILE / 2, py + TILE - 4, 9, 3.5);
      }
      // A struck creature briefly squashes and recoils — the "thwack" of a hit.
      const hp = obj.available ? hitPop(def.id, now) : null;
      if (hp) {
        const cx = px + TILE / 2, cy = py + TILE * 0.6;
        g.save();
        g.translate(hp.ox, hp.oy);
        g.translate(cx, cy); g.scale(hp.s, hp.s); g.translate(-cx, -cy);
      }
      drawObject(g, def, obj.available, px, py, now, !!obj.wanderTarget, monsterAttack(def, obj, state, content, now));
      if (hp) g.restore();
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
    // Name label — monsters show their combat level (OSRS-style). A slain
    // monster (respawning) drops its label until it's back.
    if (def.kind === "npc" || (def.kind === "monster" && obj.available)) {
      const lvl = def.kind === "monster" && def.monster ? content.monsters[def.monster]?.level : undefined;
      const text = lvl !== undefined ? `${def.name} (lvl ${lvl})` : def.name;
      const cx = px + TILE / 2, yb = py - 6;
      label(g, text, cx, yb, def.kind === "monster" ? "#c98" : "#cdbf9a");
      labelBoxes.push(labelBox(text, cx, yb)); // fishing labels steer clear of names
    }
    // Fishing spots name their catch above the water (OSRS-style). Collected and
    // drawn last (with collision avoidance) so a dense estuary reads cleanly
    // instead of a bleeding wall of text. Shares the loot-labels toggle.
    if (lootLabels && def.kind === "fishing_spot") {
      const fl = state.player.skills.fishing?.level ?? 1;
      const hl = fishingHeadline(content, def, fl);
      if (hl) {
        const dx = p.x - state.player.pos.x, dy = p.y - state.player.pos.y;
        fishLabels.push({ cx: px + TILE / 2, yb: py - 6, text: hl.text, color: hl.locked ? "#b9968f" : "#9fd0d8", locked: hl.locked, dist: dx * dx + dy * dy });
      }
    }
  }

  // Fishing-spot labels, de-cluttered: the ones you can fish come first, then the
  // nearest, and each is skipped if it would overlap a label already placed — so a
  // packed estuary shows a handful of clean labels rather than a bleeding stack.
  fishLabels.sort((a, b) => (a.locked ? 1 : 0) - (b.locked ? 1 : 0) || a.dist - b.dist);
  for (const fl of fishLabels) {
    const box = labelBox(fl.text, fl.cx, fl.yb);
    if (labelHits(box)) continue;
    label(g, fl.text, fl.cx, fl.yb, fl.color);
    labelBoxes.push(box);
  }

  // Agility: pulsing marker over the next obstacle to take.
  drawAgilityMarkers(g, state, content, cam, w, h, now, inRegion);

  // Baked-in home décor: windows on the outer wall + lit wall sconces, drawn for
  // whichever home the player is standing in (so a bare house still feels lived-in).
  if (region && region.y0 === INTERIOR_TOP) drawHomeDressing(g, region.x0, cam, now, lights);

  // --- Other players (ghosts): translucent snapshots from the shared world,
  //     drawn under the player and culled to the current view + instance. ---
  for (const gh of ghosts) {
    if (!inRegion(Math.round(gh.x), Math.round(gh.y))) continue;
    const px = gh.x * TILE - cam.x;
    const py = gh.y * TILE - cam.y;
    if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
    drawGhost(g, gh, cam, now);
  }

  // --- Player ---
  let playerGlow: [number, number] | null = null; // a carried light, added after bloom
  if (state.player.alive) {
    const pl = state.player;
    // Face the next step's horizontal direction; keep the last facing otherwise.
    if (pl.path.length > 0) {
      const dx = pl.path[0]!.x - pl.pos.x;
      if (dx < -0.05) playerFaceLeft = true;
      else if (dx > 0.05) playerFaceLeft = false;
    }
    // A summoned companion trails a half-step behind the player (boss pets show
    // as a mini version of their boss). Drawn before the player so it sits behind.
    if (pl.equipment.companion) {
      const pwx = pl.pos.x * TILE + TILE / 2;
      const pwy = pl.pos.y * TILE + TILE / 2;
      const tx = pwx + (playerFaceLeft ? 13 : -13); // hang back, opposite the facing
      const ty = pwy + 8;
      if (petWx === null) { petWx = tx; petWy = ty; }
      petWx += (tx - petWx) * 0.16;
      petWy += (ty - petWy) * 0.16;
      drawCompanion(g, content, pl.equipment.companion, petWx - cam.x, petWy - cam.y, now, pl.path.length > 0);
    }
    const plCx = pl.pos.x * TILE + TILE / 2 - cam.x;
    const plCy = pl.pos.y * TILE + TILE / 2 - cam.y;
    castShadow(g, plCx, pl.pos.y * TILE + TILE - 4 - cam.y, sv); // sun-cast shadow
    const php = hitPop("player", now);
    if (php) {
      const cx = plCx, cy = pl.pos.y * TILE + TILE * 0.6 - cam.y;
      g.save();
      g.translate(php.ox, php.oy);
      g.translate(cx, cy); g.scale(php.s, php.s); g.translate(-cx, -cy);
    }
    drawPlayer(
      g, pl.pos, cam, now, pl.appearance,
      pl.path.length > 0, playerAction(pl, content, now),
      resolveGear(pl.equipment, content), playerFaceLeft,
    );
    if (php) g.restore();
    // A warm light the player carries — added after the bloom pass so it only
    // punches a night pool (no daytime halo), via drawDaylight's light list.
    if (!region) playerGlow = [plCx, plCy - 4];
  }

  // --- Atmosphere. Outdoors each region gets a colour wash + its own weather;
  //     a vignette frames every view. Skipped inside sealed instances (homes /
  //     arenas), which keep their own controlled look.
  const outdoor = !region;
  const biome = outdoor ? biomeAt(Math.round(ppos.x), Math.round(ppos.y)) : "city";
  // A soft bloom over fires and lamps (before the player's carried light, so it
  // never gets a daytime halo) — flames glow gently even by day.
  drawLightBloom(g, lights, now);
  if (playerGlow) lights.push(playerGlow); // the player's torch joins the night pools
  if (outdoor) drawBiomeGrade(g, w, h, biome);

  // --- Time of day: a slow tint cycle (skipped indoors — a home has its own
  //     warm, even light, lit by its sconces and lamps rather than the sky).
  drawDaylight(g, w, h, lights, !!region);

  // Weather sits on top of the day/night veil so snow and embers read at night;
  // the vignette is the very last layer. Fireflies and embers glow brighter
  // after dark (driven by the sun's night factor).
  if (outdoor) drawWeather(g, w, h, now, biome, sv.night);
  if (outdoor) drawAmbientLife(g, w, h, now, biome, sv.night, cam);
  // Draw-distance falloff: fade the last ring of the circle to the void colour so
  // the culled edge reads as a soft horizon, not a hard pixel circle. Centred on
  // the player (who isn't always screen-centre once the camera clamps at edges).
  if (drawDist !== Infinity) {
    const cxp = ppos.x * TILE - cam.x;
    const cyp = ppos.y * TILE - cam.y;
    const outer = (drawDist + 0.5) * TILE;
    const inner = Math.max(0, outer - 2.2 * TILE);
    const void0 = region ? "7,7,10" : "19,16,13";
    const grd = g.createRadialGradient(cxp, cyp, inner, cxp, cyp, outer);
    grd.addColorStop(0, `rgba(${void0},0)`);
    grd.addColorStop(1, `rgba(${void0},1)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  drawVignette(g, w, h);
}

/** The player's "trophy" — their rarest/most-valuable item — for display cases. */
function trophyGlyph(state: WorldState, content: Content): string | undefined {
  const p = state.player;
  const owned = new Set<string>();
  for (const s of p.inventory) if (s) owned.add(s.item);
  for (const k of Object.keys(p.bank)) owned.add(k);
  for (const id of Object.values(p.equipment)) if (id) owned.add(id);
  let best: ItemDef | undefined; let score = -1;
  for (const id of owned) {
    const d = content.items[id as ItemId];
    if (!d) continue;
    // Companions and high-tier gear rank as the proudest trophies; else by value.
    const s = (d.slot === "companion" ? 1e9 : 0) + (d.tier ?? 0) * 200 + (d.sell ?? 0);
    if (s > score) { score = s; best = d; }
  }
  return best?.icon;
}

/** Windows + glowing wall sconces baked into a home's rooms (decorative). */
function drawHomeDressing(
  g: CanvasRenderingContext2D,
  ox: number,
  cam: Camera,
  now: number,
  lights: Array<[number, number]>,
): void {
  const sx = (tx: number) => tx * TILE - cam.x;
  const sy = (ty: number) => ty * TILE - cam.y;
  const fl = 0.6 + 0.4 * Math.sin(now / 240);
  // Windows on the top outer wall of the bedroom and workshop.
  for (const wx of [ox + 3, ox + 11]) {
    const x = sx(wx), y = sy(INTERIOR_TOP);
    g.fillStyle = "#3a2c1c"; g.fillRect(x + 4, y + 4, TILE - 8, TILE - 9); // frame
    g.fillStyle = "rgba(150,180,210,0.5)"; g.fillRect(x + 6, y + 6, TILE - 12, TILE - 13); // pane
    g.strokeStyle = "#3a2c1c"; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x + TILE / 2, y + 6); g.lineTo(x + TILE / 2, y + TILE - 7); g.moveTo(x + 6, y + TILE / 2 - 1); g.lineTo(x + TILE - 6, y + TILE / 2 - 1); g.stroke();
  }
  // Wall sconces: one on an inner wall of each room, casting a warm pool.
  const sconces = [
    { x: ox + 7, y: INTERIOR_TOP + 3 },  // bedroom/kitchen party wall
    { x: ox + 7, y: INTERIOR_TOP + 8 },  // kitchen/living party wall
    { x: ox + 14, y: INTERIOR_TOP + 8 }, // living outer wall
    { x: ox, y: INTERIOR_TOP + 3 },      // bedroom outer wall
  ];
  for (const s of sconces) {
    const x = sx(s.x) + TILE / 2, y = sy(s.y) + TILE / 2;
    g.fillStyle = "#3b3e45"; g.fillRect(x - 1.5, y - 1, 3, 6); // iron bracket
    g.fillStyle = `rgba(255,200,110,${0.55 + 0.4 * fl})`; g.beginPath(); g.arc(x, y - 3, 3, 0, Math.PI * 2); g.fill();
    lights.push([x, y - 2]);
  }
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
  indoor = false,
): void {
  // Indoors a home has its own steady, gentle gloom lit by sconces and lamps —
  // it doesn't follow the sky, so the room is cosy at any hour.
  if (indoor) {
    g.fillStyle = "rgba(20,16,28,0.34)";
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    for (const [lx, ly] of lights) {
      const r = 64;
      const grd = g.createRadialGradient(lx, ly, 4, lx, ly, r);
      grd.addColorStop(0, "rgba(235,165,85,0.34)");
      grd.addColorStop(1, "rgba(235,165,85,0)");
      g.fillStyle = grd; g.beginPath(); g.arc(lx, ly, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = "source-over";
    return;
  }
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

// ---------------------------------------------------------------------------
// Atmosphere: biome colour-grading, ambient weather/particles, and a vignette.
// All screen-space and asset-free — layered over the painted world to give each
// region its own mood.
// ---------------------------------------------------------------------------

type Biome = "spine" | "marrow" | "redrun" | "ashfen" | "heartmoor" | "greyoak" | "city" | "hills";

/** Which region the player is standing in (drives grading + which weather runs). */
function biomeAt(x: number, y: number): Biome {
  for (const r of REGIONS) {
    if (x >= r.nx && x < r.nx + r.w && y >= r.ny && y < r.ny + r.h) return r.key as Biome;
  }
  if (x >= CITY.x0 && x <= CITY.x1 && y >= CITY.y0 && y <= CITY.y1) return "city";
  return "hills";
}

/** Cheap stable hash → [0,1), for stateless particle fields. */
function frac(n: number): number { const v = Math.sin(n) * 43758.5453; return v - Math.floor(v); }

/** A translucent wash that tints a whole region toward its character. */
function drawBiomeGrade(g: CanvasRenderingContext2D, w: number, h: number, b: Biome): void {
  const tint: Partial<Record<Biome, string>> = {
    spine: "rgba(150,180,225,0.10)",     // cold blue light off the snow
    marrow: "rgba(24,18,40,0.26)",        // deep cave gloom
    redrun: "rgba(60,110,135,0.07)",      // cool river air
    ashfen: "rgba(214,120,50,0.09)",      // warm geothermal haze
    heartmoor: "rgba(44,72,56,0.12)",     // murky moor green
    greyoak: "rgba(30,58,36,0.12)",       // deep forest shade
  };
  const t = tint[b];
  if (!t) return;
  g.fillStyle = t;
  g.fillRect(0, 0, w, h);
}

/** Per-biome ambient weather/particles, animated by wall-clock `now`. `night`
 *  (0 by day … 1 at midnight) makes glowing motes read brighter after dark. */
function drawWeather(g: CanvasRenderingContext2D, w: number, h: number, now: number, b: Biome, night = 0): void {
  switch (b) {
    case "spine": { // drifting snow
      g.fillStyle = "rgba(240,247,255,0.85)";
      for (let i = 0; i < 80; i++) {
        const sp = 16 + frac(i * 1.7) * 26;
        const drift = Math.sin(now / 1400 + i) * 14;
        const x = (frac(i * 12.9) * (w + 40) + drift) % (w + 40) - 20;
        const y = ((frac(i * 7.1) * h + now * sp / 1000) % (h + 20)) - 10;
        const s = 1 + frac(i * 3.3) * 1.8;
        g.globalAlpha = 0.35 + 0.5 * frac(i * 5.5);
        g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      break;
    }
    case "ashfen": { // embers rising on the heat
      for (let i = 0; i < 46; i++) {
        const sp = 20 + frac(i * 2.3) * 30;
        const sway = Math.sin(now / 700 + i * 2) * 10;
        const x = (frac(i * 9.7) * w + sway + w) % w;
        const y = h - ((now * sp / 1000 + frac(i * 4.2) * h) % (h + 16)) + 8;
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now / 200 + i));
        g.fillStyle = frac(i * 6.1) > 0.5 ? `rgba(255,150,60,${(0.5 * tw).toFixed(2)})` : `rgba(255,90,40,${(0.45 * tw).toFixed(2)})`;
        g.beginPath(); g.arc(x, y, 1 + frac(i * 8.8) * 1.6, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "heartmoor": { // low mist banks drifting across
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i++) {
        const r = 60 + frac(i * 2.9) * 80;
        const x = ((frac(i * 5.3) * (w + 300) + now * (6 + frac(i) * 6) / 1000)) % (w + 300) - 150;
        const y = frac(i * 8.1) * h;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, "rgba(170,190,180,0.05)");
        grd.addColorStop(1, "rgba(170,190,180,0)");
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = "source-over";
      break;
    }
    case "greyoak": { // floating motes by day, glowing fireflies after dark
      const glow = 0.4 + 0.6 * night; // brighter, warmer once the sun is down
      g.globalCompositeOperation = night > 0.3 ? "lighter" : "source-over";
      for (let i = 0; i < 34; i++) {
        const x = (frac(i * 11.3) * w + Math.sin(now / 1800 + i) * 18 + w) % w;
        const y = (frac(i * 6.7) * h + Math.cos(now / 2100 + i * 1.5) * 14 + h) % h;
        const tw = 0.5 + 0.5 * Math.sin(now / 500 + i * 3);
        const a = (0.10 + 0.32 * tw) * glow;
        // A warm firefly core with a soft halo at night.
        if (night > 0.3) {
          const grd = g.createRadialGradient(x, y, 0, x, y, 5);
          grd.addColorStop(0, `rgba(240,236,140,${(a * 0.9).toFixed(2)})`);
          grd.addColorStop(1, "rgba(240,236,140,0)");
          g.fillStyle = grd; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = `rgba(235,238,${night > 0.3 ? 170 : 150},${a.toFixed(2)})`;
        g.beginPath(); g.arc(x, y, 1.4, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = "source-over";
      break;
    }
    case "marrow": { // faint cyan glow motes drifting up in the dark
      for (let i = 0; i < 22; i++) {
        const sp = 6 + frac(i * 3.1) * 10;
        const x = (frac(i * 10.1) * w + Math.sin(now / 1600 + i) * 8 + w) % w;
        const y = h - ((now * sp / 1000 + frac(i * 5.9) * h) % (h + 12));
        const tw = 0.5 + 0.5 * Math.sin(now / 600 + i * 2);
        g.fillStyle = `rgba(120,200,210,${(0.12 + 0.30 * tw).toFixed(2)})`;
        g.beginPath(); g.arc(x, y, 1.3, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "redrun": { // sparse spray sparkle off the river
      g.fillStyle = "rgba(210,235,245,0.5)";
      for (let i = 0; i < 16; i++) {
        const x = (frac(i * 13.7) * w + Math.sin(now / 1300 + i) * 10 + w) % w;
        const y = (frac(i * 9.3) * h + Math.cos(now / 1500 + i) * 8 + h) % h;
        g.globalAlpha = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(now / 350 + i * 4));
        g.beginPath(); g.arc(x, y, 1, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      break;
    }
    default: break; // city / hills: clear air
  }
}

/** Butterfly wing colours — a flutter of life over the meadows by day. */
const BUTTERFLY = ["#e8d24a", "#e07a3a", "#d9637a", "#cf6fc0", "#6f9ad6"];

/**
 * Ambient living motion layered over the world: flocks of birds gliding across
 * the open sky, and butterflies fluttering low over the meadows by day. Pure
 * screen-space dressing — deterministic from the clock, no objects involved.
 */
function drawAmbientLife(g: CanvasRenderingContext2D, w: number, h: number, now: number, b: Biome, night: number, cam: Camera): void {
  // --- Birds: a small flock that glides across every so often (not underground). ---
  if (b !== "marrow") {
    const period = 15000; // a flock crosses roughly every 15s
    const fp = (now % period) / period;
    if (fp < 0.62) {
      const cross = fp / 0.62;            // 0 → 1 across the view
      const dir = (Math.floor(now / period) % 2) ? 1 : -1; // alternate L→R / R→L
      const baseX = dir > 0 ? -50 + cross * (w + 100) : w + 50 - cross * (w + 100);
      const baseY = 40 + (frac(Math.floor(now / period) * 3.7)) * h * 0.28;
      const flap = Math.sin(now / 130);
      g.strokeStyle = `rgba(40,44,54,${(0.5 * (1 - night * 0.5)).toFixed(2)})`;
      g.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        const bx = baseX - dir * (i * 16 + (i % 2) * 8);
        const by = baseY + (i % 2 ? 10 : 0) + (i === 2 ? -6 : 0);
        const wing = 4 + 1.5 * flap;
        g.beginPath();
        g.moveTo(bx - 6, by + (i % 2 ? 1 : 0));
        g.lineTo(bx, by - wing);
        g.lineTo(bx + 6, by + (i % 2 ? 1 : 0));
        g.stroke();
      }
    }
  }

  // --- Butterflies: fluttering over grassy country by day. Anchored to the WORLD
  //     (per coarse cell), not the screen, so they stay put as you walk past
  //     instead of sliding with the camera. Each wanders within its own cell. ---
  const day = 1 - night;
  if (day > 0.2 && (b === "hills" || b === "greyoak" || b === "heartmoor" || b === "city")) {
    const t = now / 1000;
    const c0x = Math.floor(cam.x / TILE), c1x = Math.ceil((cam.x + w) / TILE);
    const c0y = Math.floor(cam.y / TILE), c1y = Math.ceil((cam.y + h) / TILE);
    g.save();
    g.globalAlpha = 0.7 * day;
    for (let cy = c0y; cy <= c1y; cy += 3) {
      for (let cx = c0x; cx <= c1x; cx += 3) {
        const seed = frac(cx * 1.73 + cy * 3.11);
        if (seed > 0.16) continue; // sparse — only a few cells host one
        // World position: cell origin + a fixed in-cell offset + a slow wander.
        const wx = cx * TILE + frac(cx * 5 + cy) * TILE * 2.5 + Math.sin(t * 0.7 + seed * 40) * 16;
        const wy = cy * TILE + frac(cy * 5 + cx) * TILE * 2.5 + Math.cos(t * 0.9 + seed * 30) * 13;
        const x = wx - cam.x, y = wy - cam.y;
        const open = 0.4 + 0.6 * Math.abs(Math.sin(t * 7 + seed * 25)); // wings beating
        g.fillStyle = BUTTERFLY[Math.floor(seed * 100) % BUTTERFLY.length]!;
        g.beginPath(); g.ellipse(x - 2, y, 2.4 * open, 2.0, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(x + 2, y, 2.4 * open, 2.0, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(30,24,20,0.8)";
        g.fillRect(x - 0.5, y - 2, 1, 4); // body
      }
    }
    g.restore();
  }
}

/**
 * Ambient water wildlife on the surface: shark fins cruising the ocean, whales
 * surfacing to blow far out at sea, and fish leaping in the lakes and rivers.
 * World-anchored per coarse cell (seeded like the butterflies) and deterministic
 * from the clock, so a fin stays put in the water as the camera slides past. Pure
 * dressing — no objects, no interaction. Fins/whales ride the "deep" (open
 * ocean); leaping fish ride the shallow "water" (rivers, lakes, coast).
 */
function drawWaterLife(
  g: CanvasRenderingContext2D,
  map: WorldMap,
  cam: Camera,
  minX: number, maxX: number, minY: number, maxY: number,
  now: number,
  inRegion: (x: number, y: number) => boolean,
  outside: (x: number, y: number) => boolean,
): void {
  const t = now / 1000;
  const tileAt = (x: number, y: number): TileType | null =>
    (x < 0 || y < 0 || x >= map.width || y >= map.height) ? null : map.tiles[y * map.width + x]!;
  const STEP = 4; // coarse cells — water features are big and sparse
  for (let cy = minY - (minY % STEP); cy <= maxY; cy += STEP) {
    for (let cx = minX - (minX % STEP); cx <= maxX; cx += STEP) {
      if (!inRegion(cx, cy) || outside(cx, cy)) continue;
      const tile = tileAt(cx, cy);
      if (tile !== "water" && tile !== "deep") continue;
      const seed = frac(cx * 1.93 + cy * 4.27);
      const ax = cx * TILE - cam.x, ay = cy * TILE - cam.y;

      if (tile === "deep") {
        // Whale: a big dark back rises out in the deep, DRIFTS as it swims (so it
        // never resurfaces in the exact same spot), throws a tall bright spout,
        // then sounds again. The set of active whale-cells slowly rotates over
        // time (`epoch`), so sightings move around the sea rather than repeating
        // in one place. Non-active deep cells fall through to the shark fins.
        const cellHash = frac(cx * 2.71 + cy * 6.13);
        const epoch = Math.floor(now / 42000);
        const active = frac(cx * 2.71 + cy * 6.13 + epoch * 3.71) < 0.16;
        if (active) {
          const period = 11000 + cellHash * 60000;
          const ph = ((now + cellHash * 300000) % period) / period;
          if (ph < 0.3) {
            const s = ph / 0.3;
            const rise = Math.sin(s * Math.PI); // surface → sound
            const dir = cellHash > 0.08 ? 1 : -1;
            // Swim across ~4 tiles over the surfacing, with a gentle bob.
            const wx = ax + TILE * 1.5 + dir * (s - 0.5) * TILE * 4;
            const wy = ay + TILE * 2 - rise * 6 + Math.sin(t * 0.3 + cellHash * 12) * 2;
            g.fillStyle = "#33414e";
            g.beginPath(); g.ellipse(wx, wy, 27, 8 + rise * 6, 0, Math.PI, 0); g.fill();
            g.fillStyle = "#465969"; // paler ridge along the back
            g.beginPath(); g.ellipse(wx, wy - 1, 18, 4 + rise * 4, 0, Math.PI, 0); g.fill();
            if (rise > 0.4) { // the blow — a tall bright spout
              const sx = wx - dir * 12, sy = wy - 6;
              g.strokeStyle = `rgba(224,238,248,${(0.75 * rise).toFixed(2)})`;
              g.lineWidth = 2; g.lineCap = "round";
              for (const dx of [-4.5, 0, 4.5]) {
                g.beginPath(); g.moveTo(sx, sy);
                g.quadraticCurveTo(sx + dx, sy - 15, sx + dx * 1.9, sy - 24); g.stroke();
              }
              g.lineCap = "butt";
            }
          }
          continue;
        }
        // Shark fin: a dorsal fin cutting a bright V-wake across the deep, fading
        // in and out at the ends of its run.
        if (seed < 0.3) {
          const period = 10000 + seed * 26000;
          const ph = ((now + seed * 50000) % period) / period;
          if (ph < 0.84) {
            const glide = ph / 0.84;
            const dir = seed > 0.1 ? 1 : -1;
            const fx = ax + TILE * 1.5 + dir * (glide - 0.5) * TILE * 3.2;
            const fy = ay + TILE * 2 + Math.sin(t * 0.6 + seed * 20) * 4;
            const fade = Math.min(1, Math.min(glide, 1 - glide) * 6);
            g.save();
            g.globalAlpha = fade;
            g.strokeStyle = "rgba(206,226,238,0.5)"; g.lineWidth = 1.4; // bright wake
            g.beginPath(); g.moveTo(fx - dir * 4, fy + 3); g.lineTo(fx - dir * 24, fy - 5); g.stroke();
            g.beginPath(); g.moveTo(fx - dir * 4, fy + 3); g.lineTo(fx - dir * 24, fy + 11); g.stroke();
            g.fillStyle = "#4a5a69"; // slate fin, light enough to read at night
            g.beginPath();
            g.moveTo(fx - dir * 8, fy + 4);
            g.quadraticCurveTo(fx + dir * 2, fy - 13, fx + dir * 7, fy + 4);
            g.closePath(); g.fill();
            g.strokeStyle = "rgba(214,228,238,0.6)"; g.lineWidth = 1; // lit leading edge
            g.beginPath(); g.moveTo(fx + dir * 7, fy + 4); g.quadraticCurveTo(fx + dir * 4.5, fy - 8, fx + dir * 1, fy - 8); g.stroke();
            g.restore();
          }
          continue;
        }
      } else if (seed < 0.34) {
        // Leaping fish (rivers + lakes): a bright silver arc clear of the water,
        // with a splash ring at take-off and splash-down.
        const period = 3400 + seed * 4200;
        const ph = ((now + seed * 12000) % period) / period;
        if (ph < 0.2) {
          const jp = ph / 0.2;
          const arc = Math.sin(jp * Math.PI);
          const dir = seed > 0.17 ? 1 : -1;
          const jx = ax + TILE * 1.5 + (frac(cx * 7 + cy) - 0.5) * TILE * 2;
          const jy = ay + TILE * 1.5 + (frac(cy * 7 + cx) - 0.5) * TILE * 2;
          const fx = jx + (jp - 0.5) * 14 * dir;
          const fy = jy - arc * 26;
          if (jp < 0.28 || jp > 0.72) {
            const k = jp < 0.28 ? 1 - jp / 0.28 : (jp - 0.72) / 0.28;
            g.strokeStyle = `rgba(214,232,244,${(0.72 * k).toFixed(2)})`;
            g.lineWidth = 1.3;
            const rr = 3 + (1 - k) * 7;
            const rx = jp < 0.28 ? jx - 6 * dir : jx + 6 * dir;
            g.beginPath(); g.ellipse(rx, jy, rr, rr * 0.4, 0, 0, Math.PI * 2); g.stroke();
          }
          g.save();
          g.translate(fx, fy); g.rotate((jp - 0.5) * 1.3 * dir);
          g.fillStyle = "#c6d2dc"; // bright silver body
          g.beginPath(); g.ellipse(0, 0, 6, 2.4, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#eff5fa"; // a white glint along the flank
          g.beginPath(); g.ellipse(-1, -0.7, 2.6, 1, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#95a4b2"; // tail
          g.beginPath(); g.moveTo(-6 * dir, 0); g.lineTo(-11 * dir, -3); g.lineTo(-11 * dir, 3); g.closePath(); g.fill();
          g.restore();
        }
      }
    }
  }
}

/** A soft darkened frame so the eye settles to the centre of the action. */
function drawVignette(g: CanvasRenderingContext2D, w: number, h: number): void {
  const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(8,6,12,0.34)");
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
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
      drawRock(g, cx, cy, available, def.resource);
      break;
    case "fishing_spot":
      drawFishingSpot(g, cx, cy, now);
      break;
    case "npc":
      drawNpc(g, cx, cy, now, moving, def.x, def.y);
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
    case "grand_exchange":
      drawGrandExchange(g, cx, cy);
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
      drawPortal(g, cx, cy);
      break;
    case "trap":
      drawTrap(g, cx, cy, available);
      break;
    case "bounty_board":
      drawBountyBoard(g, cx, cy);
      break;
    case "forage_spot":
      drawForageSpot(g, cx, cy, available, def.resource);
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
    case "bone_cairn":
      drawBoneCairn(g, cx, cy, def.id);
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
    case "pier_spot":
      drawPierSpot(g, cx, cy, now);
      break;
    case "record_board":
      drawRecordBoard(g, cx, cy);
      break;
    case "trail_board":
      drawTrailBoard(g, cx, cy);
      break;
    case "pier_gate":
      drawPierGate(g, cx, cy);
      break;
  }
}

/** The Varathian Trail's billboard: a tall standings board topped with a green
 *  runner's pennant, distinct from the pier's brass records board. */
function drawTrailBoard(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 12, 4);
  g.fillStyle = "#3a2c1e"; // two stout posts
  g.fillRect(cx - 11, cy - 6, 2.4, 18);
  g.fillRect(cx + 8.6, cy - 6, 2.4, 18);
  g.fillStyle = "#7a5a36"; // the board face
  g.fillRect(cx - 12, cy - 15, 24, 16);
  g.strokeStyle = "#3a2c1e"; g.lineWidth = 1.2; g.strokeRect(cx - 12, cy - 15, 24, 16);
  // Chalked tally rows.
  g.strokeStyle = "rgba(230,226,208,0.7)"; g.lineWidth = 1;
  for (const yy of [-11, -8, -5, -2]) { g.beginPath(); g.moveTo(cx - 9, cy + yy); g.lineTo(cx + 9, cy + yy); g.stroke(); }
  // A green runner's pennant on the crown.
  g.fillStyle = "#2f7d5a";
  g.beginPath(); g.moveTo(cx - 2, cy - 15); g.lineTo(cx - 2, cy - 23); g.lineTo(cx + 8, cy - 19.5); g.closePath(); g.fill();
  g.fillStyle = "#6fce9c"; g.beginPath(); g.arc(cx - 2, cy - 23, 1.4, 0, Math.PI * 2); g.fill();
}

/** The deep-water cast point at the pier's end: a moored buoy bobbing over wide,
 *  dark ripples — visibly different from a shallow fishing spot. */
function drawPierSpot(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const t = now / 1000;
  g.strokeStyle = "rgba(120,170,200,0.5)";
  g.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const r = 5 + ((t * 7 + i * 5) % 13);
    g.globalAlpha = Math.max(0, 1 - r / 14) * 0.7;
    g.beginPath();
    g.ellipse(cx, cy + 2, r, r * 0.5, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  const bob = Math.sin(t * 2) * 1.5;
  // A red-and-white marker buoy.
  g.fillStyle = "#c64a3a";
  g.beginPath(); g.arc(cx, cy + bob, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e8e2d0";
  g.fillRect(cx - 4, cy - 0.5 + bob, 8, 1.6);
  g.strokeStyle = "#2a2622"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx, cy + bob - 4); g.lineTo(cx, cy + bob - 8); g.stroke();
}

/** The pier's records board: a planked board on posts with a chalked top line. */
function drawRecordBoard(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = "#4a3a2a";
  g.fillRect(cx - 9, cy - 4, 2, 14); // posts
  g.fillRect(cx + 7, cy - 4, 2, 14);
  g.fillStyle = "#7a5a36"; // the board
  g.fillRect(cx - 10, cy - 11, 20, 13);
  g.strokeStyle = "#3a2c1e"; g.lineWidth = 1; g.strokeRect(cx - 10, cy - 11, 20, 13);
  g.fillStyle = "#caa05a"; // a brass trophy mark + chalk lines
  g.beginPath(); g.arc(cx, cy - 8, 1.8, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(230,226,208,0.7)"; g.lineWidth = 1;
  for (const yy of [-4, -1.5, 1]) { g.beginPath(); g.moveTo(cx - 7, cy + yy); g.lineTo(cx + 7, cy + yy); g.stroke(); }
}

/** The roped barrier at the pier's neck (gone once the warden's quest is done). */
function drawPierGate(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = "#5a4632"; // two posts
  g.fillRect(cx - 10, cy - 8, 3, 18);
  g.fillRect(cx + 7, cy - 8, 3, 18);
  g.fillStyle = "#caa05a"; g.beginPath(); g.arc(cx - 8.5, cy - 8, 2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + 8.5, cy - 8, 2, 0, Math.PI * 2); g.fill();
  // A sagging rope between them.
  g.strokeStyle = "#b89a6a"; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 8, cy - 5);
  g.quadraticCurveTo(cx, cy + 4, cx + 8, cy - 5);
  g.stroke();
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

// --- Furniture drawing helpers ---------------------------------------------
const GOLD = "#d8b24a", GOLDLT = "#f2db84", GEM = "#7fd0e0";
/** A piece's rank within its category ladder (0 = first tier; `last` = top). */
function furnitureRank(content: Content, f: FurnitureDef | undefined): { idx: number; last: number } {
  if (!f) return { idx: 0, last: 0 };
  const ladder = Object.values(content.furniture).filter((x) => x.category === f.category).sort((a, b) => a.levelReq - b.levelReq);
  return { idx: Math.max(0, ladder.findIndex((x) => x.id === f.id)), last: ladder.length - 1 };
}
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function vgrad(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: string, bot: string): void {
  const lg = g.createLinearGradient(x, y, x, y + h); lg.addColorStop(0, top); lg.addColorStop(1, bot);
  g.fillStyle = lg; g.fillRect(x, y, w, h);
}
function sparkle(g: CanvasRenderingContext2D, x: number, y: number, now: number): void {
  const t = 0.3 + 0.7 * Math.abs(Math.sin(now / 260 + x * 0.4));
  g.globalAlpha = t; g.fillStyle = "#fff7d8";
  g.fillRect(x - 0.6, y - 2.5, 1.2, 5); g.fillRect(x - 2.5, y - 0.6, 5, 1.2);
  g.globalAlpha = 1;
}
/** Draw a real item's icon glyph (a trophy on a display) centred at cx,cy. */
function drawTrophy(g: CanvasRenderingContext2D, cx: number, cy: number, glyph: string): void {
  g.save();
  g.font = "9px serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(glyph, cx, cy);
  g.restore();
}

/** A floor carpet (drawn flat at floor level — you walk over it, so no shadow). */
function drawRug(g: CanvasRenderingContext2D, cx: number, cy: number, idx: number): void {
  const pal = [
    { base: "#8a6a44", edge: "#5f4730", motif: "#a07b48" }, // hide
    { base: "#883b39", edge: GOLD, motif: "#3f6a8a" },       // woven (red, gold border, blue motif)
    { base: "#9a8466", edge: "#5f4730", motif: "#b6a182" }, // fur (mottled tan)
    { base: "#5a2f6a", edge: GOLD, motif: "#a85fc0" },       // plush (royal purple + gold)
  ][idx] ?? { base: "#8a6a44", edge: "#5f4730", motif: "#a07b48" };
  g.fillStyle = pal.base; rrect(g, cx - 10, cy - 7, 20, 14, 2.5); g.fill();
  g.strokeStyle = pal.edge; g.lineWidth = 1.6; g.stroke();
  if (idx === 1) { g.strokeStyle = pal.motif; g.lineWidth = 1; g.strokeRect(cx - 6, cy - 4, 12, 8); g.beginPath(); g.moveTo(cx, cy - 4); g.lineTo(cx, cy + 4); g.stroke(); }
  else if (idx === 2) { g.fillStyle = pal.motif; for (const [dx, dy] of [[-6, -3], [0, 2], [6, -2], [-3, 4], [4, 4]] as const) g.fillRect(cx + dx, cy + dy, 2, 2); }
  else if (idx === 3) { g.strokeStyle = pal.motif; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx + 7, cy); g.lineTo(cx, cy + 5); g.lineTo(cx - 7, cy); g.closePath(); g.stroke(); g.fillStyle = GOLD; g.fillRect(cx - 1.5, cy - 1.5, 3, 3); }
  else { g.fillStyle = pal.motif; g.fillRect(cx - 7, cy - 1, 14, 1); }
  if (idx >= 1) { g.strokeStyle = pal.edge; g.lineWidth = 1; for (let i = -9; i <= 9; i += 3) { g.beginPath(); g.moveTo(cx + i, cy - 7); g.lineTo(cx + i, cy - 8.5); g.moveTo(cx + i, cy + 7); g.lineTo(cx + i, cy + 8.5); g.stroke(); } }
}

/** A build footing: an empty marked square, or the polished furniture built on it. */
function drawHotspot(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  f: FurnitureDef | undefined,
  idx: number,
  last: number,
  now: number,
  trophy?: string,
): void {
  if (!f) {
    g.strokeStyle = "rgba(150,128,92,0.7)"; g.lineWidth = 1.4;
    g.setLineDash([3, 3]); g.strokeRect(cx - 8, cy - 6, 16, 12); g.setLineDash([]);
    g.fillStyle = "#6e5436";
    for (const [dx, dy] of [[-8, -6], [8, -6], [-8, 6], [8, 6]] as const) g.fillRect(cx + dx - 1, cy + dy - 1, 2, 2);
    return;
  }
  if (f.category === "rug") { drawRug(g, cx, cy, idx); return; } // floor-level
  const top = idx === last; // the showpiece tier gets gold + a sparkle
  shadow(g, cx, cy + 8, 9, 3);
  switch (f.category) {
    case "kitchen": {
      vgrad(g, cx - 9, cy - 3, 18, 11, idx >= 2 ? "#5a5f68" : idx ? "#666b74" : "#857e72", "#3e424a"); // body
      g.fillStyle = "#4b4f56"; g.fillRect(cx - 9, cy - 4, 18, 2.5); // mantel/flue
      if (idx) { g.fillStyle = "#2b2e34"; g.fillRect(cx + 3, cy - 4, 5, 2.5); }
      if (idx >= 2) { g.fillStyle = "#2b2e34"; g.fillRect(cx - 8, cy - 4, 5, 2.5); g.fillStyle = GOLD; g.fillRect(cx - 9, cy - 4.6, 18, 1); }
      g.fillStyle = "#241d18"; g.fillRect(cx - 5, cy + 1, 10, 7); // firebox
      const fl = 0.5 + 0.5 * Math.sin(now / 110);
      g.fillStyle = `rgba(240,150,40,${0.65 + 0.3 * fl})`; g.beginPath(); g.moveTo(cx, cy - 2 - 2 * fl); g.lineTo(cx - 3.5, cy + 7); g.lineTo(cx + 3.5, cy + 7); g.closePath(); g.fill();
      g.fillStyle = "#ffd86a"; g.beginPath(); g.moveTo(cx, cy + 1 - 2 * fl); g.lineTo(cx - 1.6, cy + 7); g.lineTo(cx + 1.6, cy + 7); g.closePath(); g.fill();
      break;
    }
    case "forge": {
      g.fillStyle = idx >= 2 ? "#4a3026" : "#6e5436"; g.fillRect(cx - 7, cy + 1, 14, 7); // base/stump
      vgrad(g, cx - 8, cy - 4, 16, 5, idx ? "#6a6f79" : "#5b5f68", idx ? "#3a3e45" : "#33363c"); // anvil top
      g.fillStyle = idx ? "#4a4e57" : "#44474d"; g.fillRect(cx - 2, cy, 4, 2); // waist
      g.fillStyle = idx ? "#7c828c" : "#6a6f79"; g.fillRect(cx - 9, cy - 4, 3, 2); // horn
      const gl = 0.5 + 0.5 * Math.sin(now / 90);
      g.fillStyle = `rgba(255,140,40,${0.6 + 0.35 * gl})`; g.fillRect(cx + 1, cy - 4, 3, 2); // hot billet
      if (idx >= 1) { g.fillStyle = "#caa05a"; g.fillRect(cx + 4, cy - 7, 1.6, 3.5); }
      if (idx >= 2) { g.fillStyle = `rgba(255,90,30,${0.4 + 0.3 * gl})`; g.fillRect(cx - 6, cy + 8, 12, 1.5); sparkle(g, cx + 3, cy - 3, now); }
      break;
    }
    case "alchemy": {
      g.fillStyle = idx ? "#7a4a52" : "#4a3f3a"; g.fillRect(cx - 6, cy + 2, 12, 4); // trivet/coals
      g.fillStyle = idx >= 2 ? GOLD : idx ? "#6b7a82" : "#3a3a40"; g.beginPath(); g.arc(cx, cy + 1, 6, 0, Math.PI * 2); g.fill(); // belly
      g.fillStyle = "#7fb89a"; g.beginPath(); g.ellipse(cx, cy - 3, 5, 1.8, 0, 0, Math.PI * 2); g.fill(); // brew
      if (Math.sin(now / 160) > 0.6) { g.fillStyle = "#bfe6cf"; g.fillRect(cx - 1, cy - 6, 1.5, 1.5); }
      if (idx >= 1) { g.strokeStyle = GEM; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + 6, cy - 6); g.lineTo(cx + 8, cy + 2); g.stroke(); g.fillStyle = "rgba(150,220,235,0.5)"; g.fillRect(cx + 6, cy - 6, 2, 3); }
      if (idx >= 2) { g.fillStyle = GEM; g.fillRect(cx - 2, cy - 7, 1.6, 2); sparkle(g, cx - 6, cy - 5, now); }
      break;
    }
    case "storage": {
      const wood = idx >= 2 ? ["#3f3c38", "#2c2a27"] : idx ? ["#4f3826", "#3a281a"] : ["#8a5532", "#5e3f1d"];
      vgrad(g, cx - 9, cy - 2, 18, 10, wood[0]!, wood[1]!); // body
      g.fillStyle = wood[1]!; rrect(g, cx - 9, cy - 6, 18, 5, 2); g.fill(); // domed lid
      g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(cx - 9, cy - 6, 18, 1.4);
      g.fillStyle = idx >= 2 ? GOLD : idx ? "#8a3f33" : "#9a9088"; g.fillRect(cx - 7, cy - 6, 2, 14); g.fillRect(cx + 5, cy - 6, 2, 14); // straps
      g.fillStyle = idx >= 2 ? GEM : "#d9b36a"; g.fillRect(cx - 1.4, cy - 1, 2.8, 3); // lock
      if (top) sparkle(g, cx + 6, cy - 6, now);
      break;
    }
    case "workshop": {
      const wood = idx ? ["#5a4632", "#3c2e1f"] : ["#8a5532", "#5a4026"];
      g.fillStyle = "#4a3a28"; g.fillRect(cx - 8, cy + 2, 2.5, 7); g.fillRect(cx + 5.5, cy + 2, 2.5, 7); // legs
      vgrad(g, cx - 10, cy - 2, 20, 5, wood[0]!, wood[1]!); // bench top
      if (idx) { g.fillStyle = "#7c828c"; g.fillRect(cx - 10, cy - 2.5, 20, 1.6); } // stone-topped
      g.fillStyle = "#8a8f99"; g.fillRect(cx - 6, cy - 6, 3, 5); // a vice
      if (idx >= 2) { g.fillStyle = "#8a8f99"; g.fillRect(cx + 3, cy - 6, 3, 5); g.fillStyle = GOLD; g.fillRect(cx - 10, cy - 2.9, 20, 1); }
      g.strokeStyle = "#c9b070"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + 1, cy + 2); g.lineTo(cx + 7, cy + 6); g.stroke(); // saw
      break;
    }
    case "bed": {
      const wood = [["#9c7a48", "#6e5436"], ["#7e5a34", "#553d24"], ["#5c4730", "#3c2e1f"], ["#6a3340", "#43232c"]][idx]!;
      const blanket = ["#b3a06e", "#8f7048", "#6f6256", "#8a3f5a"][idx]!;
      if (idx === 3) { g.fillStyle = wood[1]!; g.fillRect(cx - 11, cy - 10, 3, 18); g.fillRect(cx + 8, cy - 10, 3, 6); g.fillRect(cx - 11, cy - 10, 22, 2.5); g.fillStyle = "rgba(150,40,70,0.45)"; g.fillRect(cx + 5, cy - 8, 6, 14); }
      vgrad(g, cx - 9, cy - 6, 19, 13, wood[0]!, wood[1]!); // base
      g.fillStyle = wood[1]!; g.fillRect(cx - 11, cy - 7, 3, 15); // headboard
      g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(cx - 11, cy - 7, 3, 2);
      g.fillStyle = "#ece2c8"; g.fillRect(cx - 8, cy - 5, 8, 12); // sheet
      g.fillStyle = blanket; g.fillRect(cx - 1, cy - 5, 10, 12); // blanket
      g.fillStyle = "#f6efdc"; rrect(g, cx - 8, cy - 5, 7, 4, 1.5); g.fill(); // pillow
      if (idx === 2) { g.fillStyle = "#9a8466"; g.fillRect(cx - 1, cy + 3, 10, 4); } // foot pelt
      if (idx === 3) { g.fillStyle = GOLD; g.fillRect(cx - 1, cy - 5, 10, 1.4); sparkle(g, cx + 9, cy - 9, now); }
      break;
    }
    case "table": {
      const wood = [["#a07b48", "#6e5436"], ["#85602f", "#5a4026"], ["#5f4a30", "#3c2e1f"], [GOLD, "#9a7a2f"]][idx]!;
      g.fillStyle = wood[1]!; g.fillRect(cx - 8, cy + 2, 2.5, 7); g.fillRect(cx + 5.5, cy + 2, 2.5, 7); // legs
      vgrad(g, cx - 10, cy - 3, 20, 6, wood[0]!, wood[1]!); // top
      g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(cx - 10, cy - 3, 20, 1.4); // highlight
      if (idx === 1) { g.strokeStyle = wood[1]!; g.lineWidth = 1; for (let i = -6; i <= 6; i += 4) { g.beginPath(); g.moveTo(cx + i, cy + 1); g.lineTo(cx + i, cy + 3); g.stroke(); } }
      if (idx === 2) { g.fillStyle = "#8a8f99"; g.fillRect(cx - 9, cy + 2.4, 18, 1.4); g.fillRect(cx - 7, cy - 3, 1.6, 6); g.fillRect(cx + 5.4, cy - 3, 1.6, 6); }
      if (idx === 3) { g.fillStyle = GOLDLT; g.fillRect(cx - 9, cy - 2.2, 18, 1); g.fillStyle = GEM; g.fillRect(cx - 1, cy - 1.4, 2, 2); sparkle(g, cx + 7, cy - 2, now); }
      break;
    }
    case "seating": {
      const wood = [["#a07b48", "#6e5436"], ["#85602f", "#5a4026"], ["#5f4a30", "#3c2e1f"], [GOLD, "#9a7a2f"]][idx]!;
      if (idx === 0) {
        for (const sx of [-5, 5]) { g.fillStyle = wood[0]!; g.fillRect(cx + sx - 3, cy - 1, 6, 3); g.fillStyle = wood[1]!; g.fillRect(cx + sx - 2.5, cy + 2, 1.4, 5); g.fillRect(cx + sx + 1, cy + 2, 1.4, 5); }
        break;
      }
      g.fillStyle = wood[1]!; g.fillRect(cx - 7, cy - 8, 14, 4); // back rail
      vgrad(g, cx - 7, cy - 4, 14, 11, wood[0]!, wood[1]!); // body
      g.fillStyle = idx === 3 ? "#7a2f3a" : idx === 2 ? "#7a5038" : "#8f7048"; g.fillRect(cx - 5, cy - 1, 10, 6); // cushion
      if (idx >= 2) { g.fillStyle = "#9a8466"; g.fillRect(cx - 6, cy + 4, 12, 3); } // draped pelt
      g.fillStyle = wood[1]!; g.fillRect(cx - 8, cy - 2, 2, 9); g.fillRect(cx + 6, cy - 2, 2, 9); // arms
      if (idx === 3) { g.fillStyle = GOLDLT; g.fillRect(cx - 7, cy - 8, 14, 1.2); g.fillRect(cx - 8, cy - 2, 2, 1.2); g.fillRect(cx + 6, cy - 2, 2, 1.2); sparkle(g, cx, cy - 9, now); }
      break;
    }
    case "hall": {
      if (idx === 0) { vgrad(g, cx - 10, cy - 9, 20, 16, "#cdbfa0", "#b3a585"); g.strokeStyle = "rgba(120,100,70,0.4)"; g.lineWidth = 1; g.strokeRect(cx - 10, cy - 9, 20, 16); g.beginPath(); g.moveTo(cx - 10, cy - 1); g.lineTo(cx + 10, cy - 1); g.stroke(); }
      else if (idx === 1) { g.fillStyle = "#9a7b4e"; g.fillRect(cx - 10, cy - 9, 20, 16); g.strokeStyle = "#5a4026"; g.lineWidth = 2; g.strokeRect(cx - 10, cy - 9, 20, 16); g.beginPath(); g.moveTo(cx - 10, cy - 9); g.lineTo(cx + 10, cy + 7); g.moveTo(cx + 10, cy - 9); g.lineTo(cx - 10, cy + 7); g.moveTo(cx, cy - 9); g.lineTo(cx, cy + 7); g.stroke(); }
      else if (idx === 2) { g.fillStyle = "#83796b"; g.fillRect(cx - 10, cy - 9, 20, 16); g.fillStyle = "#6e4a2c"; g.fillRect(cx - 10, cy - 4, 20, 4); g.fillStyle = "#6b6f78"; g.fillRect(cx - 7, cy, 14, 8); g.strokeStyle = "rgba(0,0,0,0.2)"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 8); g.stroke(); }
      else { g.fillStyle = "#8b8478"; g.fillRect(cx - 10, cy - 9, 20, 16); g.strokeStyle = GOLD; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy + 1, 7, Math.PI, 0); g.stroke(); g.fillStyle = "#6f6a60"; g.fillRect(cx - 8, cy + 1, 16, 7); g.fillStyle = GOLDLT; g.fillRect(cx - 10, cy - 9, 20, 1.4); sparkle(g, cx + 7, cy - 7, now); }
      break;
    }
    case "lighting": {
      const fl = 0.55 + 0.45 * Math.sin(now / 130);
      if (idx === 0) { // candle stand
        g.fillStyle = "#6e5436"; g.fillRect(cx - 1.5, cy - 2, 3, 9); g.fillRect(cx - 4, cy + 6, 8, 2);
        g.fillStyle = "#efe7d2"; g.fillRect(cx - 3, cy - 5, 1.5, 3); g.fillRect(cx + 1.5, cy - 5, 1.5, 3);
        g.fillStyle = `rgba(255,210,90,${fl})`; g.beginPath(); g.arc(cx - 2.2, cy - 6, 1.5, 0, Math.PI * 2); g.arc(cx + 2.2, cy - 6, 1.5, 0, Math.PI * 2); g.fill();
      } else if (idx === 1) { // knucklestone lamp
        g.fillStyle = "#5a4632"; g.fillRect(cx - 1.5, cy + 1, 3, 7); g.fillStyle = "#7c8088"; g.fillRect(cx - 3, cy - 5, 6, 6);
        g.fillStyle = `rgba(255,210,120,${0.45 + 0.4 * fl})`; g.fillRect(cx - 2, cy - 4, 4, 4); g.strokeStyle = "#7c8088"; g.lineWidth = 1; g.strokeRect(cx - 3, cy - 5, 6, 6);
      } else if (idx === 2) { // iron chandelier
        g.strokeStyle = "#3b3e45"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, cy - 11); g.lineTo(cx, cy - 6); g.stroke();
        g.strokeStyle = "#4a4e57"; g.beginPath(); g.ellipse(cx, cy - 3, 9, 3, 0, 0, Math.PI * 2); g.stroke();
        for (const dx of [-8, -3, 3, 8]) { g.fillStyle = `rgba(255,205,90,${fl})`; g.beginPath(); g.arc(cx + dx, cy - 4, 1.8, 0, Math.PI * 2); g.fill(); }
      } else { // gold lamp / crystal standard
        g.strokeStyle = GOLD; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx, cy - 6); g.stroke();
        g.fillStyle = GOLD; g.beginPath(); g.ellipse(cx, cy - 3, 10, 3.2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = GOLDLT; g.beginPath(); g.ellipse(cx, cy - 3.6, 10, 1.4, 0, 0, Math.PI * 2); g.fill();
        for (const dx of [-9, -4.5, 0, 4.5, 9]) { g.fillStyle = `rgba(255,225,140,${fl})`; g.beginPath(); g.arc(cx + dx, cy - 2, 1.8, 0, Math.PI * 2); g.fill(); g.fillStyle = GEM; g.fillRect(cx + dx - 0.6, cy + 1, 1.2, 2); }
        sparkle(g, cx, cy - 10, now);
      }
      break;
    }
    case "display": {
      if (idx === 0) { // curio shelf
        g.fillStyle = "#7a5532"; rrect(g, cx - 9, cy - 7, 18, 14, 1.5); g.fill();
        g.fillStyle = "#4a3a28"; g.fillRect(cx - 8, cy - 3, 16, 1.5); g.fillRect(cx - 8, cy + 2, 16, 1.5);
        g.fillStyle = GEM; for (const dx of [-6, 0, 6]) g.fillRect(cx + dx - 1, cy - 6, 2, 2); g.fillStyle = "#caa24a"; for (const dx of [-3, 4]) g.fillRect(cx + dx, cy - 1, 2, 2);
      } else if (idx === 1) { // trophy mount
        g.fillStyle = "#5a4632"; rrect(g, cx - 9, cy - 8, 18, 16, 2); g.fill();
        g.fillStyle = "#9a8466"; g.fillRect(cx - 6, cy - 1, 12, 7); g.fillStyle = "#ece2c8"; g.beginPath(); g.arc(cx, cy - 4, 3.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#cfc4ad"; g.fillRect(cx - 6, cy - 7, 2, 4); g.fillRect(cx + 4, cy - 7, 2, 4);
      } else if (idx === 2) { // glass cabinet — shows your real trophy item
        g.fillStyle = "#5a4026"; g.fillRect(cx - 9, cy - 9, 18, 18); g.fillStyle = "rgba(150,210,225,0.30)"; g.fillRect(cx - 7, cy - 7, 14, 15);
        g.strokeStyle = "#3a2e1f"; g.lineWidth = 1; g.strokeRect(cx - 7, cy - 7, 14, 15); g.beginPath(); g.moveTo(cx, cy - 7); g.lineTo(cx, cy + 8); g.moveTo(cx - 7, cy); g.lineTo(cx + 7, cy); g.stroke();
        if (trophy) drawTrophy(g, cx, cy, trophy); else { g.fillStyle = GEM; g.fillRect(cx - 4, cy - 4, 2, 2); g.fillRect(cx + 2, cy + 2, 2, 3); }
      } else { // gold display case — your rarest possession, lit and on a pedestal
        g.fillStyle = GOLD; g.fillRect(cx - 8, cy - 9, 16, 18); g.fillStyle = GOLDLT; g.fillRect(cx - 8, cy - 9, 16, 1.5);
        g.fillStyle = "rgba(150,220,235,0.35)"; g.fillRect(cx - 6, cy - 7, 12, 14);
        g.fillStyle = `rgba(190,230,240,${0.5 + 0.3 * Math.sin(now / 200)})`; g.fillRect(cx - 5, cy - 6, 10, 2);
        if (trophy) drawTrophy(g, cx, cy - 0.5, trophy); else { g.fillStyle = GEM; g.fillRect(cx - 1.5, cy - 2, 3, 5); }
        sparkle(g, cx + 6, cy - 8, now);
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

/** A Courier waystone: a tall carved standing stone crowned with a bright,
 *  pulsing ember beacon and a ground glow, so a fast-travel node reads from
 *  across the map. */
function drawWaystone(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const pulse = 0.55 + 0.45 * Math.sin(now / 500);
  // Ground glow — a warm pool that draws the eye.
  const glow = g.createRadialGradient(cx, cy + 14, 2, cx, cy + 14, 26);
  glow.addColorStop(0, `rgba(240,150,60,${(0.34 + 0.14 * pulse).toFixed(2)})`);
  glow.addColorStop(1, "rgba(240,150,60,0)");
  g.fillStyle = glow;
  g.beginPath(); g.ellipse(cx, cy + 14, 26, 11, 0, 0, Math.PI * 2); g.fill();

  shadow(g, cx, cy + 17, 13, 4);
  // The standing stone — ~1.7× the old size.
  g.fillStyle = "#5b5762";
  g.beginPath();
  g.moveTo(cx - 11, cy + 17); g.lineTo(cx - 10, cy - 15); g.lineTo(cx, cy - 21);
  g.lineTo(cx + 10, cy - 15); g.lineTo(cx + 11, cy + 17); g.closePath(); g.fill();
  g.fillStyle = "#6c6775"; // lit face
  g.beginPath(); g.moveTo(cx - 10, cy - 15); g.lineTo(cx, cy - 21); g.lineTo(cx + 1, cy + 17); g.lineTo(cx - 11, cy + 17); g.closePath(); g.fill();
  g.strokeStyle = "#403c46"; g.lineWidth = 1; // a couple of carved grooves
  g.beginPath(); g.moveTo(cx - 8, cy + 6); g.lineTo(cx + 9, cy + 6); g.moveTo(cx - 8, cy + 11); g.lineTo(cx + 9, cy + 11); g.stroke();

  // The ember rider-mark set in the stone, glowing.
  g.fillStyle = `rgba(210,116,44,${(0.6 + 0.4 * pulse).toFixed(2)})`;
  g.beginPath(); g.arc(cx - 1, cy - 4, 6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(247,198,106,0.9)"; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(cx - 6, cy - 4); g.lineTo(cx + 3, cy - 4); g.moveTo(cx - 1, cy - 9); g.lineTo(cx - 1, cy + 1); g.stroke();

  // A bright beacon flame on the crown + a soft light column rising off it.
  const beam = g.createLinearGradient(cx, cy - 21, cx, cy - 46);
  beam.addColorStop(0, `rgba(247,198,106,${(0.5 * pulse).toFixed(2)})`);
  beam.addColorStop(1, "rgba(247,198,106,0)");
  g.fillStyle = beam;
  g.beginPath(); g.moveTo(cx - 4, cy - 21); g.lineTo(cx + 4, cy - 21); g.lineTo(cx + 2, cy - 46); g.lineTo(cx - 2, cy - 46); g.closePath(); g.fill();
  g.fillStyle = "#f7c66a";
  g.beginPath(); g.ellipse(cx, cy - 22, 3.4 + pulse, 4.6 + pulse, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff0c0";
  g.beginPath(); g.ellipse(cx, cy - 22, 1.6, 2.4, 0, 0, Math.PI * 2); g.fill();
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

/** A summoned companion at screen (sx,sy): a boss pet shows as a mini version
 *  of its boss (the scaled-down boss sprite); any other pet shows as a small
 *  critter. Half-scale keeps it clearly a hanger-on, not a second fighter. */
function drawCompanion(
  g: CanvasRenderingContext2D, content: Content, id: ItemId,
  sx: number, sy: number, now: number, moving: boolean,
): void {
  const boss = content.items[id]?.meta?.["petBoss"];
  g.save();
  g.translate(sx, sy);
  g.scale(0.5, 0.5);
  if (typeof boss === "string") drawMonsterBody(g, boss, 0, 0, now, moving);
  else drawCritter(g, undefined, 0, 0, now);
  g.restore();
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
// A plain rock cave mouth — a dark opening in a stony mound. No magic; you
// just walk down into the barrow/vault it fronts.
function drawPortal(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 13, 17, 5);
  // The rocky mound around the mouth.
  g.fillStyle = "#544f48";
  g.beginPath();
  g.moveTo(cx - 16, cy + 13);
  g.quadraticCurveTo(cx - 18, cy - 11, cx, cy - 15);
  g.quadraticCurveTo(cx + 18, cy - 11, cx + 16, cy + 13);
  g.closePath();
  g.fill();
  // Lit upper rock + a couple of boulders for texture.
  g.fillStyle = "#6b655c";
  g.beginPath(); g.ellipse(cx - 9, cy - 6, 5, 4, -0.3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 9, cy - 5, 5, 4, 0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#473f38";
  g.beginPath(); g.ellipse(cx - 11, cy + 8, 4, 3, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 11, cy + 8, 4, 3, 0, 0, Math.PI * 2); g.fill();
  // The dark arched opening you descend into.
  g.fillStyle = "#0c0a09";
  g.beginPath();
  g.moveTo(cx - 7, cy + 12);
  g.lineTo(cx - 7, cy - 1);
  g.quadraticCurveTo(cx, cy - 11, cx + 7, cy - 1);
  g.lineTo(cx + 7, cy + 12);
  g.closePath();
  g.fill();
  // A hint of depth at the throat of the cave.
  g.fillStyle = "rgba(60,50,44,0.6)";
  g.beginPath();
  g.moveTo(cx - 4, cy + 12);
  g.lineTo(cx - 4, cy + 2);
  g.quadraticCurveTo(cx, cy - 5, cx + 4, cy + 2);
  g.lineTo(cx + 4, cy + 12);
  g.closePath();
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

/** The Grand Exchange booth: a clerk's counter under a striped awning, a set
 *  of brass scales on top and a bid/ask chalkboard behind. */
function drawGrandExchange(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  // A grand classical trading hall — deliberately far larger and grander than
  // anything around it (~2 tiles across): marble colonnade, gilt pediment, a big
  // hanging ledger board and trade banners, so the Exchange reads as THE hub.
  const W = 44; // half-width of the hall
  shadow(g, cx, cy + 20, W + 4, 7);
  // Broad stone steps up to the platform.
  g.fillStyle = "#8b8172"; g.fillRect(cx - W - 4, cy + 14, (W + 4) * 2, 6);
  g.fillStyle = "#a49a89"; g.fillRect(cx - W - 1, cy + 11, (W + 1) * 2, 4);
  // Hall body (pale marble) sitting on the platform.
  g.fillStyle = "#cdc6b6"; g.fillRect(cx - W, cy - 12, W * 2, 24);
  g.fillStyle = "#bcb4a2"; g.fillRect(cx - W, cy + 6, W * 2, 6); // base shadow band
  // Colonnade: fluted columns with capitals across the front.
  const cols = 7;
  for (let i = 0; i < cols; i++) {
    const colx = cx - W + 6 + i * ((W * 2 - 12) / (cols - 1));
    g.fillStyle = "#e7e1d2"; g.fillRect(colx - 2.5, cy - 10, 5, 22); // shaft
    g.fillStyle = "#b7ad99"; g.fillRect(colx - 2.5, cy - 10, 1.4, 22); // shade side
    g.fillStyle = "#efe9db"; g.fillRect(colx - 3.5, cy - 11, 7, 2); // capital
    g.fillStyle = "#efe9db"; g.fillRect(colx - 3.5, cy + 10, 7, 2); // base
  }
  // Entablature + gilt pediment (triangular roof).
  g.fillStyle = "#7a6f5a"; g.fillRect(cx - W - 2, cy - 15, (W + 2) * 2, 4);
  g.fillStyle = "#d9cfb0"; g.fillRect(cx - W - 2, cy - 15, (W + 2) * 2, 1.5);
  g.fillStyle = "#c9b98a"; // pediment
  g.beginPath();
  g.moveTo(cx - W - 4, cy - 15); g.lineTo(cx, cy - 30); g.lineTo(cx + W + 4, cy - 15); g.closePath(); g.fill();
  g.strokeStyle = "#e2c061"; g.lineWidth = 1.6; g.stroke(); // gilt trim
  // A gilt scales-of-trade emblem in the tympanum.
  g.strokeStyle = "#e2c061"; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(cx, cy - 24); g.lineTo(cx, cy - 18); g.moveTo(cx - 4, cy - 22); g.lineTo(cx + 4, cy - 22); g.stroke();
  g.fillStyle = "#f0d477";
  g.beginPath(); g.arc(cx - 4, cy - 21, 1.6, 0, Math.PI); g.fill();
  g.beginPath(); g.arc(cx + 4, cy - 21, 1.6, 0, Math.PI); g.fill();
  // A big hanging ledger board (the live bid/ask listings) under the colonnade.
  g.fillStyle = "#241f18"; g.fillRect(cx - 15, cy - 8, 30, 16);
  g.strokeStyle = "#c9a24a"; g.lineWidth = 1.5; g.strokeRect(cx - 15, cy - 8, 30, 16);
  g.strokeStyle = "rgba(180,205,180,0.75)"; g.lineWidth = 1; // chalked rows
  for (let i = 0; i < 5; i++) { const yy = cy - 5.5 + i * 3; g.beginPath(); g.moveTo(cx - 12, yy); g.lineTo(cx + (i % 2 ? 5 : 11), yy); g.stroke(); }
  // Trade banners flanking the entrance.
  for (const bx of [cx - W + 4, cx + W - 4]) {
    g.fillStyle = "#9a2f2a"; g.beginPath();
    g.moveTo(bx - 3, cy - 10); g.lineTo(bx + 3, cy - 10); g.lineTo(bx + 3, cy + 6); g.lineTo(bx, cy + 3); g.lineTo(bx - 3, cy + 6); g.closePath(); g.fill();
    g.fillStyle = "#e2c061"; g.beginPath(); g.arc(bx, cy - 5, 1.6, 0, Math.PI * 2); g.fill();
  }
}

/**
 * A wild forage clump. Each survivalist find has its own silhouette and palette
 * so a glance tells a Mushroom Cluster from a Thornberry Bramble from a glowing
 * Dawnspore Ring — no more identical green blobs. Keyed off the spot's resource
 * action id (`surv_forage_<type>`). While picked clean it fades and drops its
 * ripe accents (respawning), matching the old dim behaviour.
 */
function drawForageSpot(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  available: boolean,
  resource?: string,
): void {
  shadow(g, cx, cy + 9, 11, 4);
  const kind = (resource ?? "").replace(/^surv_forage_/, "");
  if (!available) g.globalAlpha = 0.5; // picked clean — thin and greyed
  const disc = (dx: number, dy: number, r: number, fill: string): void => {
    g.fillStyle = fill;
    g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); g.fill();
  };
  switch (kind) {
    case "mushroom": {
      // A cluster of capped mushrooms: pale stems under warm brown-red caps.
      const caps = [[-5, 3, 5, 2.6], [4, 4, 4.2, 2.2], [0, -1, 6, 3]] as const;
      for (const [dx, dy, , ch] of caps) {
        g.fillStyle = "#d8cbb0"; // stem
        g.fillRect(cx + dx - 1.3, cy + dy, 2.6, ch + 3);
      }
      for (const [dx, dy, cw] of caps) {
        g.fillStyle = "#9c4a34"; // cap
        g.beginPath(); g.ellipse(cx + dx, cy + dy, cw, cw * 0.7, 0, Math.PI, 0); g.fill();
        g.fillStyle = "#e7d7c2"; // speckles
        disc(dx - cw * 0.35, dy - cw * 0.25, 0.9, "#e7d7c2");
        disc(dx + cw * 0.3, dy - cw * 0.15, 0.8, "#e7d7c2");
      }
      break;
    }
    case "thornberry": {
      // A dark thorny bramble hung with red berries.
      g.strokeStyle = "#3f5230"; g.lineWidth = 1.6; g.lineCap = "round";
      for (const [x0, y0, x1, y1] of [[-7, 6, 2, -6], [7, 6, -2, -5], [-5, 5, 6, 2]] as const) {
        g.beginPath(); g.moveTo(cx + x0, cy + y0);
        g.quadraticCurveTo(cx, cy - 2, cx + x1, cy + y1); g.stroke();
      }
      disc(-4, 3, 4.5, "#4a6338"); disc(4, 2, 4, "#4a6338"); disc(0, -2, 4.2, "#587544");
      if (available) for (const [dx, dy] of [[-5, 0], [3, -1], [5, 3], [-1, 4]] as const) disc(dx, dy, 1.7, "#c02f2a");
      break;
    }
    case "nightshade": {
      // Dark waxy leaves with glossy purple-black berries.
      disc(-5, 3, 5.5, "#2f4436"); disc(5, 3, 5, "#2f4436"); disc(0, 0, 6, "#3a5442");
      disc(-2, -3, 3.5, "#46654e");
      if (available) for (const [dx, dy] of [[-3, 1], [4, 0], [0, 4], [2, -2]] as const) {
        disc(dx, dy, 2, "#3a1f52"); disc(dx - 0.6, dy - 0.6, 0.7, "#b48fe0");
      }
      break;
    }
    case "hearthroot":
    case "ashroot": {
      // A snarl of interlocking roots — hearthroot glows ember-warm, ashroot is
      // cold grey.
      const warm = kind === "hearthroot";
      g.strokeStyle = warm ? "#7a4326" : "#6a6560"; g.lineWidth = 2.4; g.lineCap = "round";
      for (const [x0, y0, x1, y1] of [[-7, 7, 5, 0], [7, 7, -5, 1], [-4, 8, 3, -4], [4, 8, -3, -3]] as const) {
        g.beginPath(); g.moveTo(cx + x0, cy + y0);
        g.quadraticCurveTo(cx, cy + 2, cx + x1, cy + y1); g.stroke();
      }
      g.strokeStyle = warm ? "#c86a2e" : "#938d86"; g.lineWidth = 1.1;
      for (const [x0, y0, x1, y1] of [[-6, 6, 4, 0], [6, 6, -4, 1]] as const) {
        g.beginPath(); g.moveTo(cx + x0, cy + y0);
        g.quadraticCurveTo(cx, cy + 2, cx + x1, cy + y1); g.stroke();
      }
      if (available && warm) { disc(0, 1, 3, "rgba(240,150,60,0.35)"); disc(0, 1, 1.4, "#f0b85a"); }
      break;
    }
    case "fiber": {
      // Fibreweed: a tuft of tall grassy blades.
      g.strokeStyle = available ? "#6f9a44" : "#647052"; g.lineWidth = 1.5; g.lineCap = "round";
      for (const [dx, sway] of [[-6, -3], [-3, -1], [0, 0], [3, 1], [6, 3]] as const) {
        g.beginPath(); g.moveTo(cx + dx, cy + 8);
        g.quadraticCurveTo(cx + dx + sway, cy - 2, cx + dx + sway * 1.6, cy - 9); g.stroke();
      }
      g.strokeStyle = available ? "#89b85c" : "#74805e"; g.lineWidth = 1;
      for (const [dx, sway] of [[-4, -2], [1, 0], [5, 2]] as const) {
        g.beginPath(); g.moveTo(cx + dx, cy + 8);
        g.quadraticCurveTo(cx + dx + sway, cy - 3, cx + dx + sway * 1.7, cy - 10); g.stroke();
      }
      break;
    }
    case "deepmoss": {
      // A low, flat bed of blue-green moss — overlapping soft mounds.
      disc(-6, 5, 5, "#3a5f52"); disc(6, 5, 5, "#3a5f52"); disc(-2, 4, 5.5, "#456e5f");
      disc(3, 3, 5, "#456e5f"); disc(0, 2, 4, "#568373");
      if (available) for (const [dx, dy] of [[-3, 3], [3, 2], [0, 5]] as const) disc(dx, dy, 0.9, "#8fc0ad");
      break;
    }
    case "ashbloom":
    case "dawnspore": {
      // Pale flowering stalks — ashbloom is ashen white, dawnspore glows softly.
      const glow = kind === "dawnspore";
      g.strokeStyle = "#7d8a72"; g.lineWidth = 1.3; g.lineCap = "round";
      const stalks = [[-5, 8], [-2, 8], [2, 8], [5, 8]] as const;
      for (const [dx] of stalks) { g.beginPath(); g.moveTo(cx + dx, cy + 8); g.lineTo(cx + dx * 0.6, cy - 6); g.stroke(); }
      for (const [dx] of stalks) {
        const hx = cx + dx * 0.6, hy = cy - 6;
        if (glow) disc(dx * 0.6, -6, 3, "rgba(230,220,160,0.3)");
        g.fillStyle = glow ? "#f0e4a6" : "#e6e2d6";
        g.beginPath(); g.arc(hx, hy, 1.8, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    default: {
      // Generic leafy clump (the old look) for any unlabelled forage spot.
      for (const [dx, dy, r] of [[-6, 4, 6], [6, 4, 6], [0, 1, 7], [-3, -3, 5], [3, -3, 5]] as const) disc(dx, dy, r, "#5d7e3e");
      for (const [dx, dy, r] of [[-3, -4, 3], [3, -4, 3], [0, -1, 3]] as const) disc(dx, dy, r, "#79a04e");
      if (available) for (const [dx, dy] of [[-4, 0], [5, -1], [1, 4]] as const) disc(dx, dy, 1.6, "#d2604a");
    }
  }
  g.globalAlpha = 1;
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
/** The sun's cast-shadow parameters for the current hour: which way and how far
 *  shadows stretch, and how strong they read. Long and faint near dawn/dusk,
 *  short and crisp at noon, gone at night. Shares the day cycle with the veil. */
interface SunCast { night: number; ox: number; oy: number; len: number; alpha: number }
function sunCast(): SunCast {
  const phase = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  const sun = Math.sin(phase * Math.PI * 2 - Math.PI / 2); // -1 midnight … +1 noon
  const day = Math.max(0, sun);   // 0 by night, 1 at noon
  const low = 1 - day;            // long shadows when the sun sits low
  const side = phase < 0.5 ? -1 : 1; // mornings cast west, afternoons east
  return { night: Math.max(0, -sun), ox: side * low * 11, oy: 3 + low * 4, len: 1 + low * 1.4, alpha: 0.10 + 0.26 * day };
}

/** A soft directional shadow cast from a thing's feet by the sun's position. */
function castShadow(g: CanvasRenderingContext2D, cx: number, feetY: number, sv: SunCast): void {
  if (sv.alpha < 0.02) return;
  g.save();
  g.translate(cx + sv.ox, feetY + sv.oy);
  g.scale(sv.len, 0.42);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 9);
  grd.addColorStop(0, `rgba(0,0,0,${sv.alpha.toFixed(3)})`);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** A gentle always-on bloom halo over fires and lamps, so flames glow softly by
 *  day too (the big warm pools in drawDaylight take over after dark). */
function drawLightBloom(g: CanvasRenderingContext2D, lights: Array<[number, number]>, now: number): void {
  if (lights.length === 0) return;
  g.save();
  g.globalCompositeOperation = "lighter";
  const fl = 0.7 + 0.3 * Math.sin(now / 180);
  for (const [lx, ly] of lights) {
    const grd = g.createRadialGradient(lx, ly, 0, lx, ly, 26);
    grd.addColorStop(0, `rgba(255,196,110,${(0.20 * fl).toFixed(3)})`);
    grd.addColorStop(1, "rgba(255,196,110,0)");
    g.fillStyle = grd;
    g.beginPath(); g.arc(lx, ly, 26, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = "source-over";
  g.restore();
}

function shadow(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  // A soft, feathered contact shadow (radial falloff) so things sit in the
  // world instead of floating on a hard grey disc.
  g.save();
  g.translate(cx, cy);
  g.scale(1, ry / rx);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grd.addColorStop(0, "rgba(0,0,0,0.34)");
  grd.addColorStop(0.7, "rgba(0,0,0,0.22)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, rx, 0, Math.PI * 2);
  g.fill();
  g.restore();
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
  drawBroadleaf(g, cx, cy, TREE_PAL[species ?? "ashwood"] ?? TREE_PAL["ashwood"]!);
}

// A canopy palette per wood, so each tier reads at a glance (low → high tier:
// pale grey-green → rust → silver → dark iron → deep teal → gold).
interface TreePal { trunk: string; lit: string; dark: string; mid: string; light: string; hi: string }
const TREE_PAL: Record<string, TreePal> = {
  ashwood:   { trunk: "#8d7e60", lit: "#a99a78", dark: "#3f4d2a", mid: "#4e5f34", light: "#5d6e3e", hi: "rgba(184,192,150,0.5)" },
  ruewood:   { trunk: "#6e4b3a", lit: "#8a6450", dark: "#5a2f2a", mid: "#7a3f30", light: "#9a5238", hi: "rgba(214,150,110,0.5)" },
  stonewood: { trunk: "#8a8a82", lit: "#a8a89e", dark: "#46584a", mid: "#5f7060", light: "#7d8e78", hi: "rgba(206,214,200,0.5)" },
  ironbark:  { trunk: "#4a4f57", lit: "#656c76", dark: "#26323a", mid: "#33434c", light: "#46585f", hi: "rgba(150,176,186,0.45)" },
  deeproot:  { trunk: "#3f3a44", lit: "#574f5e", dark: "#123a32", mid: "#1d5046", light: "#2f6b5c", hi: "rgba(120,200,178,0.4)" },
  heartoak:  { trunk: "#7a5a2e", lit: "#a07b3e", dark: "#5a4a14", mid: "#7d6a1e", light: "#a89030", hi: "rgba(242,216,120,0.55)" },
};

// A layered broadleaf canopy in the given palette.
function drawBroadleaf(g: CanvasRenderingContext2D, cx: number, cy: number, p: TreePal): void {
  shadow(g, cx, cy + 12, 12, 4);
  g.fillStyle = p.trunk;
  g.fillRect(cx - 3, cy, 6, TILE / 2 - 2);
  g.fillStyle = p.lit;
  g.fillRect(cx - 3, cy, 2, TILE / 2 - 2);
  g.fillStyle = p.dark;
  circle(g, cx - 7, cy - 2, 9);
  circle(g, cx + 7, cy - 2, 9);
  g.fillStyle = p.mid;
  circle(g, cx, cy - 8, 12);
  g.fillStyle = p.light;
  circle(g, cx - 3, cy - 11, 7);
  g.fillStyle = p.hi;
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

// Rock + ore-vein colours per mineable type, so a knucklestone rock reads
// differently from a voidstone one at a glance.
interface RockPal { base: string; lit: string; vein: string }
const ROCK_PAL: Record<string, RockPal> = {
  mine_knucklestone: { base: "#5c5650", lit: "#766e62", vein: "#8a8276" },
  mine_embercite:    { base: "#3a3632", lit: "#56504a", vein: "#d2742c" },
  mine_ashiron:      { base: "#585e66", lit: "#7c828c", vein: "#aeb4be" },
  mine_ribstone:     { base: "#6a4a40", lit: "#8a6356", vein: "#b05a44" },
  mine_silica:       { base: "#8a8470", lit: "#aaa488", vein: "#eef0e0" },
  mine_gold:         { base: "#5e584c", lit: "#7c7460", vein: "#e6b53e" },
  mine_bloodore:     { base: "#5a3a36", lit: "#7a4a44", vein: "#c63a2c" },
  mine_voidstone:    { base: "#3e3550", lit: "#564a6e", vein: "#8a64e0" },
};

// --- Mineable rock: faceted boulder, coloured + veined by its ore ---
function drawRock(
  g: CanvasRenderingContext2D, cx: number, cy: number, available: boolean, resource?: string,
): void {
  const p = ROCK_PAL[resource ?? "mine_knucklestone"] ?? ROCK_PAL["mine_knucklestone"]!;
  if (!available) {
    shadow(g, cx, cy + 8, 9, 3);
    g.fillStyle = "#4f4a44";
    circle(g, cx - 4, cy + 4, 4);
    circle(g, cx + 5, cy + 5, 3);
    circle(g, cx, cy + 6, 3);
    return;
  }
  shadow(g, cx, cy + 9, 13, 4);
  g.fillStyle = p.base;
  g.beginPath();
  g.moveTo(cx - 13, cy + 6);
  g.lineTo(cx - 9, cy - 7);
  g.lineTo(cx + 2, cy - 11);
  g.lineTo(cx + 12, cy - 4);
  g.lineTo(cx + 13, cy + 7);
  g.closePath();
  g.fill();
  g.fillStyle = p.lit; // lit facet
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
  // Ore vein — flecks/streaks in the ore's own colour.
  g.fillStyle = p.vein;
  circle(g, cx + 6, cy + 1, 1.7);
  circle(g, cx - 4, cy - 4, 1.3);
  g.strokeStyle = p.vein;
  g.lineWidth = 1;
  g.globalAlpha = 0.8;
  g.beginPath();
  g.moveTo(cx - 6, cy + 3);
  g.lineTo(cx - 2, cy - 3);
  g.lineTo(cx + 4, cy - 6);
  g.stroke();
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
/** Each region dresses its folk differently, so a Frostgate northerner reads
 *  apart from a Redrun fisher or a Heartmoor moor-dweller — the land has a look.
 *  Themes are picked by the NPC's tile (final map coords); a per-NPC hash nudges
 *  skin/hair so folk in one place aren't clones. */
interface NpcTheme { tunic: string; collar: string; belt: string; legs: string; hats?: string }
const NPC_THEMES: Record<string, NpcTheme> = {
  spine:     { tunic: "#4a5a6e", collar: "#7d93a8", belt: "#2c3540", legs: "#33404d", hats: "#d7dde4" }, // northern furs/blue
  marrow:    { tunic: "#7a5a30", collar: "#a07a42", belt: "#4a3620", legs: "#43331f" }, // miner ochre/brown
  redrun:    { tunic: "#2f6a72", collar: "#59a0a6", belt: "#274042", legs: "#2b4a4d" }, // coastal teal
  ashfen:    { tunic: "#7a4038", collar: "#a86050", belt: "#3e2620", legs: "#4a2f28" }, // ashen red-brown
  heartmoor: { tunic: "#4f6a3a", collar: "#7a9a52", belt: "#2f3d24", legs: "#38472a" }, // moss green
  greyoak:   { tunic: "#3f6a4a", collar: "#5f9a6a", belt: "#294031", legs: "#2c4a37" }, // forest green
  city:      { tunic: "#6a4a6e", collar: "#9a6aa0", belt: "#3a2c3e", legs: "#3f3040" }, // Ironvale plum/civic
};
/** Which theme a tile falls under (named region boxes, else the city default). */
function npcTheme(x: number, y: number): NpcTheme {
  const inBox = (x0: number, y0: number, x1: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (inBox(40, 3, 72, 42)) return NPC_THEMES.spine!;
  if (inBox(115, 5, 145, 45)) return NPC_THEMES.marrow!;
  if (inBox(120, 55, 155, 135)) return NPC_THEMES.redrun!;
  if (inBox(60, 130, 100, 162)) return NPC_THEMES.ashfen!;
  if (inBox(0, 120, 40, 160)) return NPC_THEMES.heartmoor!;
  if (inBox(0, 60, 40, 100)) return NPC_THEMES.greyoak!;
  return NPC_THEMES.city!;
}
const NPC_SKINS = ["#caa472", "#b3895a", "#9a6b41", "#e0be93", "#8a5a36"];
const NPC_HAIRS = ["#5b4a33", "#2e2620", "#7a6a4a", "#8a8f98", "#3a2c1e", "#a06a3a"];

function drawNpc(g: CanvasRenderingContext2D, cx: number, cy: number, now: number, moving = false, wx = 0, wy = 0): void {
  const a = walkAnim(now, moving);
  const th = npcTheme(wx, wy);
  const h = frac(wx * 12.9898 + wy * 78.233);
  const tunic = th.tunic;
  const skin = NPC_SKINS[Math.floor(h * NPC_SKINS.length) % NPC_SKINS.length]!;
  const hair = NPC_HAIRS[Math.floor(h * 997) % NPC_HAIRS.length]!;
  shadow(g, cx, cy + 12, 8, 3);
  // legs (feet lift while walking)
  g.fillStyle = th.legs;
  g.fillRect(cx - 5, cy + 6 - a.liftL, 4, 7);
  g.fillRect(cx + 1, cy + 6 - a.liftR, 4, 7);
  // far arm (behind the body)
  limbArm(g, cx + 5.5, cy - 4 + a.bob, 0.12 - a.swing, tunic, skin);
  // tunic + collar + belt (bob)
  g.fillStyle = tunic;
  g.fillRect(cx - 6, cy - 6 + a.bob, 12, 14);
  g.fillStyle = th.collar;
  g.fillRect(cx - 6, cy - 6 + a.bob, 12, 3);
  g.fillStyle = th.belt;
  g.fillRect(cx - 6, cy + 4 + a.bob, 12, 2);
  // near arm (in front)
  limbArm(g, cx - 5.5, cy - 4 + a.bob, -0.12 + a.swing, tunic, skin);
  // head + hair
  g.fillStyle = skin;
  circle(g, cx, cy - 11 + a.bob, 5);
  g.fillStyle = hair;
  g.beginPath();
  g.arc(cx, cy - 12 + a.bob, 5, Math.PI, 0);
  g.fill();
  // Northern folk wear a pale fur hood against the cold — a clear regional tell.
  if (th.hats && h > 0.35) {
    g.fillStyle = th.hats;
    g.beginPath(); g.arc(cx, cy - 12.5 + a.bob, 5.4, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    g.fillRect(cx - 5.4, cy - 13 + a.bob, 10.8, 1.6);
  }
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
    case "red_deer":
      return drawStag(g, cx, cy, now);
    case "mountain_lion":
      return drawBigCat(g, cx, cy, now);
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
    case "ashen_wyrm":
      return drawDragon(g, cx, cy, now);
    case "boneman":
      return drawBoneman(g, cx, cy, now);
    case "hollow_warden":
      return H("#6c7077", "#8b9099"); // pale grey revenant
    case "spine_warlord":
      return H("#46434e", "#615c6e"); // dark spine-plate
    case "bog_warden":
      return H("#3f5346", "#526c58"); // bog green-grey
    case "marrow_keeper":
      return H("#cfc7b2", "#e7dfca"); // pale bone-robed keeper
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
    // --- Settlement guards (watchmen) + farmers ---
    case "town_guard":
      return H("#3f4a58", "#586a7e"); // steel-blue watch tabard
    case "ironvale_guard":
      return H("#41474f", "#616b78"); // mail-grey Ironvale soldier
    case "field_farmer":
      return H("#6b5636", "#8a7148"); // earthy tans
    case "master_farmer":
      return H("#4c5233", "#67703f"); // green farm apron
    default:
      return drawRat(g, cx, cy, now);
  }
}

/** Cindrath, the Ashen Wyrm: a large winged dragon with glowing ember scales,
 *  flapping wings and a smouldering maw. Drawn oversized to read as a boss. */
function drawDragon(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const flap = Math.sin(now / 240);          // wing beat
  const glow = 0.6 + 0.4 * Math.sin(now / 320); // ember pulse
  shadow(g, cx, cy + 16, 22, 7);

  // --- Wings (behind the body) ---
  const wing = (dir: number): void => {
    g.fillStyle = "#241016";
    g.beginPath();
    g.moveTo(cx, cy - 4);
    g.quadraticCurveTo(cx + dir * (24 + flap * 4), cy - 22 - flap * 6, cx + dir * 30, cy - 2 + flap * 3);
    g.quadraticCurveTo(cx + dir * 20, cy + 2, cx + dir * 8, cy + 2);
    g.closePath();
    g.fill();
    // membrane struts, ember-lit
    g.strokeStyle = `rgba(226,96,42,${0.45 * glow + 0.3})`;
    g.lineWidth = 1.4;
    for (const f of [0.45, 0.7, 0.95]) {
      g.beginPath();
      g.moveTo(cx + dir * 6, cy - 3);
      g.lineTo(cx + dir * (30 * f + 4), cy - 12 * (1 - f) + 1);
      g.stroke();
    }
  };
  wing(-1); wing(1);

  // --- Tail ---
  g.strokeStyle = "#2a1218"; g.lineWidth = 7; g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx, cy + 6);
  g.quadraticCurveTo(cx - 4, cy + 16, cx + 10, cy + 18);
  g.stroke();

  // --- Body (dark scale with ember sheen) ---
  g.fillStyle = "#3a1414";
  g.beginPath(); g.ellipse(cx, cy + 2, 12, 14, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(150,40,28,${0.5 + 0.3 * glow})`;
  g.beginPath(); g.ellipse(cx - 2, cy, 7, 10, 0, 0, Math.PI * 2); g.fill();
  // scale flecks
  g.fillStyle = `rgba(242,150,70,${0.6 * glow})`;
  for (const [dx, dy] of [[-4, -3], [3, -1], [-1, 4], [5, 5], [-5, 6]] as const) {
    circle(g, cx + dx, cy + dy, 1.2);
  }

  // --- Neck + horned head ---
  g.strokeStyle = "#3a1414"; g.lineWidth = 8; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx, cy - 2); g.lineTo(cx + 2, cy - 14); g.stroke();
  g.fillStyle = "#431818";
  g.beginPath(); g.ellipse(cx + 3, cy - 17, 6, 5, 0, 0, Math.PI * 2); g.fill();
  // horns
  g.strokeStyle = "#1f0e12"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx + 1, cy - 20); g.lineTo(cx - 3, cy - 25); g.stroke();
  g.beginPath(); g.moveTo(cx + 6, cy - 20); g.lineTo(cx + 10, cy - 25); g.stroke();
  // molten maw + eye
  g.fillStyle = `rgba(255,140,40,${0.7 + 0.3 * glow})`;
  g.beginPath(); g.ellipse(cx + 7, cy - 15, 2.4, 1.4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffd23a";
  circle(g, cx + 4, cy - 18, 1.1);
}

/** The Boneman: a tall, gaunt killer draped in his victims' bones — a stitched
 *  skull-mask, an exposed ribcage and a long, toothed saw he never sets down.
 *  Drawn a touch oversized and hunched so he reads as a boss, not a bandit. */
function drawBoneman(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const sway = Math.sin(now / 700) * 1.5;        // slow, predatory idle
  const saw = Math.sin(now / 520) * 1.2;         // the saw twitches in his grip
  shadow(g, cx, cy + 15, 13, 4.5);

  // --- Legs: pale, bound bone ---
  g.strokeStyle = "#cdc6b4"; g.lineWidth = 4.5; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx - 4, cy + 3); g.lineTo(cx - 5, cy + 14); g.stroke();
  g.beginPath(); g.moveTo(cx + 4, cy + 3); g.lineTo(cx + 5, cy + 14); g.stroke();

  // --- Torso: a dark sinew-and-rag robe ---
  g.fillStyle = "#36312b";
  g.beginPath();
  g.moveTo(cx - 7 + sway, cy - 7);
  g.quadraticCurveTo(cx - 9 + sway, cy + 4, cx - 6, cy + 5);
  g.lineTo(cx + 6, cy + 5);
  g.quadraticCurveTo(cx + 9 + sway, cy + 4, cx + 7 + sway, cy - 7);
  g.closePath(); g.fill();

  // --- Ribcage strapped over the chest (pale bone) ---
  g.strokeStyle = "#e7e1d0"; g.lineWidth = 1.4; g.lineCap = "round";
  for (const ry of [-4, -1, 2] as const) {
    g.beginPath();
    g.moveTo(cx - 5 + sway, cy + ry);
    g.quadraticCurveTo(cx + sway, cy + ry + 2.4, cx + 5 + sway, cy + ry);
    g.stroke();
  }
  g.lineWidth = 1.6; // spine
  g.beginPath(); g.moveTo(cx + sway, cy - 6); g.lineTo(cx + sway, cy + 4); g.stroke();

  // --- Left arm holding the saw across the body ---
  g.strokeStyle = "#cdc6b4"; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(cx + 6 + sway, cy - 5); g.lineTo(cx + 11, cy + 2 + saw); g.stroke();

  // --- The Bonesaw: a long pale blade with teeth, wrapped handle ---
  g.save();
  g.translate(cx + 11, cy + 2 + saw);
  g.rotate(-0.5);
  g.strokeStyle = "#4a3527"; g.lineWidth = 2.6; // hide-wrapped handle
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 5); g.stroke();
  g.fillStyle = "#ded7c4"; // blade
  g.fillRect(-1.6, -20, 3.2, 20);
  g.fillStyle = "#bdb6a2"; // teeth (a saw edge)
  for (let t = -19; t < 0; t += 2.4) { g.beginPath(); g.moveTo(1.6, t); g.lineTo(3.4, t + 1.1); g.lineTo(1.6, t + 2.2); g.closePath(); g.fill(); }
  g.restore();

  // --- Right arm, hanging ---
  g.strokeStyle = "#cdc6b4"; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(cx - 6 + sway, cy - 5); g.lineTo(cx - 9, cy + 4); g.stroke();

  // --- Head: a stitched skull-mask, hooded ---
  const hx = cx + sway * 1.3, hy = cy - 12;
  g.fillStyle = "#26221d"; // hood/shoulders behind the skull
  g.beginPath(); g.ellipse(hx, hy + 1, 7, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ece6d6"; // pale skull face
  g.beginPath(); g.ellipse(hx, hy, 5, 5.5, 0, 0, Math.PI * 2); g.fill();
  // hollow eye sockets
  g.fillStyle = "#15110d";
  circle(g, hx - 2, hy - 0.5, 1.5);
  circle(g, hx + 2, hy - 0.5, 1.5);
  // a faint red gleam, deep in the sockets
  g.fillStyle = "rgba(190,40,30,0.9)";
  circle(g, hx - 2, hy - 0.5, 0.6);
  circle(g, hx + 2, hy - 0.5, 0.6);
  // stitched mouth-line
  g.strokeStyle = "#15110d"; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(hx - 2.6, hy + 3); g.lineTo(hx + 2.6, hy + 3); g.stroke();
  for (let sx = -2; sx <= 2; sx += 1.3) { g.beginPath(); g.moveTo(hx + sx, hy + 2.2); g.lineTo(hx + sx, hy + 3.8); g.stroke(); }
}

/** A small pale skull (front-facing): dome, two sockets, a nasal hollow. */
function drawSkull(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = "#ece6d6";
  g.beginPath(); g.ellipse(x, y, r, r * 1.06, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#d8d0bd"; // jaw shading
  g.beginPath(); g.ellipse(x, y + r * 0.7, r * 0.62, r * 0.4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#15110d"; // sockets
  circle(g, x - r * 0.42, y - r * 0.1, r * 0.27);
  circle(g, x + r * 0.42, y - r * 0.1, r * 0.27);
  g.beginPath(); // nasal hollow
  g.moveTo(x, y + r * 0.15); g.lineTo(x - r * 0.16, y + r * 0.5); g.lineTo(x + r * 0.16, y + r * 0.5);
  g.closePath(); g.fill();
}

/** A cairn of bones and skulls — grim dressing for the Boneman's Bonefield.
 *  Three variants (a bone-pile with a skull, a stack of skulls, a skull on a
 *  stake), chosen deterministically from the object id so a row of them varies. */
function drawBoneCairn(g: CanvasRenderingContext2D, cx: number, cy: number, id: string): void {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const variant = h % 3;
  shadow(g, cx, cy + 10, 12, 4);
  const bone = "#e2dcca", boneX = "#b9b09a";

  if (variant === 0) {
    // A heap of long bones, crossed, with a skull resting on top.
    g.strokeStyle = bone; g.lineWidth = 2.6; g.lineCap = "round";
    const limbs: [number, number, number, number][] = [
      [-9, 9, 7, 4], [-6, 10, 9, 6], [-8, 6, 6, 9], [3, 10, 10, 5],
    ];
    for (const [x1, y1, x2, y2] of limbs) {
      g.beginPath(); g.moveTo(cx + x1, cy + y1); g.lineTo(cx + x2, cy + y2); g.stroke();
      g.fillStyle = bone; // knobbed ends
      circle(g, cx + x1, cy + y1, 1.5); circle(g, cx + x2, cy + y2, 1.5);
    }
    g.strokeStyle = boneX; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(cx - 8, cy + 8); g.lineTo(cx + 6, cy + 5); g.stroke();
    drawSkull(g, cx - 1, cy + 1, 4.5);
  } else if (variant === 1) {
    // A stacked cairn of skulls.
    drawSkull(g, cx - 4, cy + 7, 3.4);
    drawSkull(g, cx + 4, cy + 7, 3.4);
    drawSkull(g, cx, cy + 8, 3.4);
    drawSkull(g, cx - 0.5, cy + 1, 4.2);
  } else {
    // A skull mounted on a short stake, ringed by a few scattered bones.
    g.strokeStyle = "#6a4a2e"; g.lineWidth = 2.2; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx, cy + 11); g.lineTo(cx, cy - 1); g.stroke();
    g.strokeStyle = bone; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(cx - 9, cy + 10); g.lineTo(cx - 3, cy + 11); g.stroke();
    g.beginPath(); g.moveTo(cx + 3, cy + 11); g.lineTo(cx + 9, cy + 9); g.stroke();
    g.fillStyle = bone;
    circle(g, cx - 9, cy + 10, 1.4); circle(g, cx + 9, cy + 9, 1.4);
    drawSkull(g, cx, cy - 4, 4.6);
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

// --- Red Deer: a slender russet stag with branching antlers ---
function drawStag(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 240) * 0.6;
  shadow(g, cx, cy + 9, 12, 4);
  g.strokeStyle = "#6a4a2e"; g.lineWidth = 2.2; g.lineCap = "round"; // legs
  g.beginPath(); g.moveTo(cx - 6, cy + 3 + bob); g.lineTo(cx - 6, cy + 9); g.stroke();
  g.beginPath(); g.moveTo(cx + 5, cy + 3 + bob); g.lineTo(cx + 5, cy + 9); g.stroke();
  g.fillStyle = "#9a6b3e"; // body
  g.beginPath(); g.ellipse(cx, cy + bob, 11, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7a5230"; // neck
  g.fillRect(cx + 6, cy - 6 + bob, 3.5, 8);
  g.fillStyle = "#8a5e36"; // head
  g.beginPath(); g.ellipse(cx + 9, cy - 8 + bob, 3.5, 3, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#caa570"; g.lineWidth = 1.2; // antlers
  g.beginPath(); g.moveTo(cx + 8, cy - 10 + bob); g.lineTo(cx + 6, cy - 15 + bob); g.lineTo(cx + 4, cy - 14 + bob); g.stroke();
  g.beginPath(); g.moveTo(cx + 10, cy - 10 + bob); g.lineTo(cx + 12, cy - 15 + bob); g.lineTo(cx + 14, cy - 14 + bob); g.stroke();
  g.fillStyle = "#efe9dd"; g.beginPath(); g.arc(cx - 9, cy - 1 + bob, 1.6, 0, Math.PI * 2); g.fill(); // tail flash
  g.fillStyle = "#1a140f"; circle(g, cx + 10, cy - 8 + bob, 0.9); // eye
}

// --- Mountain Lion: a low, tawny cat, long-tailed and rangy ---
function drawBigCat(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 260) * 0.5;
  shadow(g, cx, cy + 9, 14, 4);
  g.strokeStyle = "#a8814a"; g.lineWidth = 2.6; g.lineCap = "round"; // tail, curling
  g.beginPath(); g.moveTo(cx + 11, cy + 1 + bob); g.quadraticCurveTo(cx + 18, cy - 2 + bob, cx + 16, cy - 7 + bob); g.stroke();
  g.fillStyle = "#7a5a32"; // legs
  g.fillRect(cx - 7, cy + 4 + bob, 2.6, 6); g.fillRect(cx + 4, cy + 4 + bob, 2.6, 6);
  g.fillStyle = "#c08f4e"; // long body
  g.beginPath(); g.ellipse(cx, cy + bob, 13, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#b07f3e"; // haunch
  g.beginPath(); g.ellipse(cx + 7, cy + bob, 6, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#cd9a56"; // head
  g.beginPath(); g.ellipse(cx - 12, cy - 1 + bob, 5, 4.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#b07f3e"; // ears
  g.beginPath(); g.moveTo(cx - 15, cy - 5 + bob); g.lineTo(cx - 13, cy - 7 + bob); g.lineTo(cx - 12, cy - 4 + bob); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx - 10, cy - 5 + bob); g.lineTo(cx - 9, cy - 7 + bob); g.lineTo(cx - 8, cy - 4 + bob); g.closePath(); g.fill();
  g.fillStyle = "#e8d8b0"; g.beginPath(); g.ellipse(cx - 15, cy + 1 + bob, 2, 1.6, 0, 0, Math.PI * 2); g.fill(); // muzzle
  g.fillStyle = "#1a140f"; circle(g, cx - 13, cy - 1 + bob, 1); // eye
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
  gear: GearLook = {},
  flip = false,
): void {
  const cx = pos.x * TILE + TILE / 2 - cam.x;
  const cy = pos.y * TILE + TILE / 2 - cam.y;
  shadow(g, cx, cy + TILE / 2 - 4, 9, 3.5); // grounds the player on the terrain
  drawAvatar(g, cx, cy, 1, withDefaults(look), { now, moving, flip, ...(action ? { action } : {}) }, gear);
}

// --- Another player, rendered as a faint, idle apparition with a name label. ---
function drawGhost(g: CanvasRenderingContext2D, gh: Ghost, cam: Camera, now: number): void {
  const cx = gh.x * TILE + TILE / 2 - cam.x;
  const cy = gh.y * TILE + TILE / 2 - cam.y;
  shadow(g, cx, cy + TILE / 2 - 4, 8, 3);
  g.save();
  g.globalAlpha = 0.4; // translucent so it clearly reads as "not really here"
  drawAvatar(g, cx, cy, 1, withDefaults(gh.look), { now, moving: gh.moving, flip: gh.faceLeft }, gh.gear);
  g.restore();
  label(g, gh.name, cx, cy - TILE / 2 - 2, "#a9d8e8"); // cool, spectral blue
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
  // A swing should look like a strike, not slow-motion: hold a ready pose for most
  // of the weapon's interval, then snap the full wind-up→strike→follow-through
  // through STRIKE_MS right before the blow lands. The cadence (rests between
  // swings) still tracks weapon speed — a fast dagger barely pauses, a slow hammer
  // pauses long. Continuous motions (a bow's aim, a fishing sway) stay linear.
  const linearFrac = (interval: number) => Math.max(0, Math.min(1, (act.nextActionAt - now) / interval));
  const strikeFrac = (interval: number) => snapStrike(act.nextActionAt - now, interval);
  if (act.kind === "combat") {
    const main = player.equipment.mainhand;
    const interval = (main && content.items[main]?.speed) || 2400; // COMBAT.playerMeleeSpeed
    // A bow now lives in the mainhand — draw it at range instead of swinging.
    if (main && content.items[main]?.ranged) return { kind: "ranged", tool: "bow", frac: linearFrac(interval) };
    // The Bonesaw swings as a sword but renders its own toothed-saw blade.
    const type = main === "bonesaw" ? "saw" : ((main && content.items[main]?.wepType) || "sword");
    return { kind: "combat", tool: type, frac: strikeFrac(interval) };
  }
  // Gathering / crafting: the action interval the engine is repeating on.
  const TOOL: Record<string, string> = {
    mining: "pickaxe", woodcutting: "axe", fishing: "rod", crafting: "", trapping: "",
  };
  if (!(act.kind in TOOL)) return undefined;
  // Pick/axe chops snap like a strike; fishing/crafting/trapping keep their sway.
  const overhead = act.kind === "mining" || act.kind === "woodcutting";
  const f = overhead ? strikeFrac : linearFrac;
  // The pier champion wields a golden rod — draw it gold when fishing with it.
  let tool = TOOL[act.kind]!;
  if (act.kind === "fishing" && player.equipment.mainhand === "rod_gold") tool = "rod_gold";
  return { kind: act.kind, tool, frac: f(act.actionInterval || 600) };
}

/** The human-type monsters that swing a weapon; the rest are animals that lunge. */
const HUMANOID_MONSTERS = new Set([
  "bog_knight", "redrun_brigand", "ancient_orc", "dread_ferryman",
  "footpad", "cutpurse", "bandit", "poacher", "highwayman",
  "outlaw_archer", "cutthroat", "marauder", "outlaw_captain",
  "town_guard", "ironvale_guard", "field_farmer", "master_farmer",
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
  // Snap the swing/lunge into a quick strike with a rest between (matches the
  // player), so enemies don't fight in slow motion either.
  const frac = snapStrike(obj.nextAttackAt - now, interval);
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

/** What a fishing spot advertises above the water: the best fish here you can
 *  currently land (highest level you meet), or — if none yet — the easiest one
 *  and the Fishing level it needs (shown greyed). Null if the spot has no fish. */
function fishingHeadline(
  content: Content,
  def: WorldObjectDef,
  level: number,
): { text: string; locked: boolean } | null {
  const ids = def.catches?.length
    ? def.catches.map((c) => c.action)
    : [def.resource ?? "fish_ashfin"];
  const fish = ids
    .map((id) => content.actions.find((a) => a.id === id))
    .filter((a): a is SkillAction => !!a)
    .sort((a, b) => (a.levelReq ?? 1) - (b.levelReq ?? 1));
  if (fish.length === 0) return null;
  const catchable = fish.filter((a) => level >= (a.levelReq ?? 1));
  if (catchable.length) return { text: catchable[catchable.length - 1]!.name, locked: false };
  const next = fish[0]!;
  return { text: `${next.name} · Fishing ${next.levelReq ?? 1}`, locked: true };
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
