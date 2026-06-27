/**
 * src/client/avatar.ts
 * --------------------
 * One place that knows how to draw a character — body, top, legs, shoes, hair
 * and facial hair — from an Appearance. The in-world player (render.ts) and the
 * character creator both call drawAvatar, so styles live here once.
 *
 * Geometry is in "base units" (1 = one screen pixel at scale 1, which is how the
 * in-world figure is drawn); pass a larger `s` for the creator's big preview.
 * (cx, cy) is the figure's centre — the same reference the tile renderer uses.
 */

import type { Appearance } from "../core/types.ts";

// --- Shared colour palettes (the only colours the creator offers) ---
export const SKINS = ["#f0d2a8", "#e3bd92", "#caa176", "#a9794f", "#855b38", "#5f3f26"];
export const HAIRS = ["#2a2320", "#4a3320", "#7a5226", "#b8893c", "#caa24a", "#9a3320", "#3a5a7a", "#d8d8d8"];
/** The cloth palette — shared by tops, legs and shoes ("same colour options"). */
export const CLOTH = ["#6b6157", "#3a5a7a", "#4f7a3a", "#7a3a3a", "#6a4a7a", "#caa05a", "#2f6b66", "#9a5a2a"];

// --- Selectable styles (id + label). The renderer defaults unknown ids. ---
export const HAIR_STYLES = [
  { id: "short", label: "Short" },
  { id: "long", label: "Long" },
  { id: "topknot", label: "Top-knot" },
  { id: "mohawk", label: "Mohawk" },
  { id: "spiky", label: "Spiky" },
  { id: "sidepart", label: "Side part" },
  { id: "ponytail", label: "Ponytail" },
  { id: "curly", label: "Curly" },
  { id: "fringe", label: "Fringe" },
  { id: "bald", label: "Bald" },
];
export const FACIAL_STYLES = [
  { id: "none", label: "Clean-shaven" },
  { id: "stubble", label: "Stubble" },
  { id: "moustache", label: "Moustache" },
  { id: "goatee", label: "Goatee" },
  { id: "beard", label: "Full beard" },
];
export const TOP_STYLES = [
  { id: "plain", label: "Plain" },
  { id: "vneck", label: "V-neck" },
  { id: "sash", label: "Sash" },
];
export const LEG_STYLES = [
  { id: "trousers", label: "Trousers" },
  { id: "kilt", label: "Kilt" },
  { id: "shorts", label: "Shorts" },
];
export const SHOE_STYLES = [
  { id: "boots", label: "Boots" },
  { id: "sandals", label: "Sandals" },
  { id: "clogs", label: "Clogs" },
];

/** The look every fresh character starts from. */
export const DEFAULT_APPEARANCE: Appearance = {
  name: "Wanderer",
  skin: SKINS[1]!,
  hair: HAIRS[1]!,
  tunic: CLOTH[0]!,
  legColor: CLOTH[7]!,
  shoeColor: "#3a2c20",
  hairStyle: "short",
  facial: "none",
  top: "plain",
  legs: "trousers",
  shoes: "boots",
};

/** Fill the missing fields of a partial look with the defaults (old saves). */
export function withDefaults(a?: Partial<Appearance>): Appearance {
  return { ...DEFAULT_APPEARANCE, ...(a ?? {}) };
}

type Ctx = CanvasRenderingContext2D;

/** Darken a hex colour by `amt` (0..1) for shading. */
function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return `rgb(${r},${g},${b})`;
}

/**
 * Draw a full character at (cx, cy) — the figure's centre — scaled by `s`.
 * `bob` lifts the upper body (head/torso/hair) for the idle bounce; the legs
 * and feet stay planted.
 */
export function drawAvatar(
  g: Ctx,
  cx: number,
  cy: number,
  s: number,
  look: Appearance,
  bob = 0,
): void {
  // Helpers: rects/circles in base units. Upper-body helpers add the bob.
  const R = (dx: number, dy: number, w: number, h: number) =>
    g.fillRect(cx + dx * s, cy + dy * s, w * s, h * s);
  const Rb = (dx: number, dy: number, w: number, h: number) =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  const arc = (dx: number, dy: number, r: number, a0: number, a1: number, b = false) => {
    g.beginPath();
    g.arc(cx + dx * s, cy + dy * s + bob, r * s, a0, a1, b);
  };

  // --- Shadow (planted) ---
  g.fillStyle = "rgba(0,0,0,0.32)";
  g.beginPath();
  g.ellipse(cx, cy + 12.5 * s, 10 * s, 3.6 * s, 0, 0, Math.PI * 2);
  g.fill();

  // --- Legs (planted) ---
  g.fillStyle = look.legColor;
  if (look.legs === "kilt") {
    g.beginPath();
    g.moveTo(cx - 6 * s, cy + 5 * s);
    g.lineTo(cx + 6 * s, cy + 5 * s);
    g.lineTo(cx + 7 * s, cy + 10.5 * s);
    g.lineTo(cx - 7 * s, cy + 10.5 * s);
    g.closePath();
    g.fill();
    g.fillStyle = shade(look.legColor, 0.25);
    R(-0.6, 5, 1.2, 5.5); // centre pleat
  } else if (look.legs === "shorts") {
    R(-6, 5, 5, 3); R(1, 5, 5, 3); // short legs
    g.fillStyle = look.skin; // bare shins
    R(-5.5, 8, 4, 2.5); R(1.5, 8, 4, 2.5);
  } else {
    // trousers
    R(-6, 5, 5, 6); R(1, 5, 5, 6);
    g.fillStyle = shade(look.legColor, 0.22);
    R(-0.4, 5, 0.8, 6); // inseam
  }

  // --- Shoes (planted) ---
  g.fillStyle = look.shoeColor;
  if (look.shoes === "sandals") {
    R(-6, 11.4, 5, 1.1); R(1, 11.4, 5, 1.1);
    g.fillStyle = shade(look.shoeColor, 0.3);
    R(-4.5, 10.4, 0.8, 1.2); R(2.7, 10.4, 0.8, 1.2); // ankle straps
  } else if (look.shoes === "clogs") {
    R(-6.5, 10.4, 5.8, 2.2); R(0.7, 10.4, 5.8, 2.2);
    g.fillStyle = shade(look.shoeColor, 0.28);
    R(-1.3, 10.4, 0.8, 2.2); // upturned toe hint via shading split
    R(5.7, 10.4, 0.8, 2.2);
  } else {
    // boots
    R(-6.2, 10, 5.4, 2.6); R(0.8, 10, 5.4, 2.6);
    g.fillStyle = shade(look.shoeColor, 0.3);
    R(-6.2, 12, 5.4, 0.6); R(0.8, 12, 5.4, 0.6); // soles
  }

  // --- Torso / top (bobs) ---
  g.fillStyle = look.tunic;
  Rb(-7, -7, 14, 12);
  g.fillStyle = "rgba(0,0,0,0.16)";
  Rb(-7, 3, 14, 2); // belt line
  g.fillStyle = shade(look.tunic, 0.18);
  Rb(2.5, -7, 1.2, 10); // side shade for form
  if (look.top === "vneck") {
    g.fillStyle = look.skin;
    g.beginPath();
    g.moveTo(cx - 3 * s, cy - 7 * s + bob);
    g.lineTo(cx + 3 * s, cy - 7 * s + bob);
    g.lineTo(cx, cy - 2.5 * s + bob);
    g.closePath();
    g.fill();
  } else if (look.top === "sash") {
    g.strokeStyle = shade(look.tunic, 0.4);
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.moveTo(cx - 7 * s, cy - 6 * s + bob);
    g.lineTo(cx + 7 * s, cy + 2 * s + bob);
    g.stroke();
  } else {
    g.fillStyle = "rgba(0,0,0,0.16)";
    Rb(-0.6, -7, 1.2, 10); // plain front seam
  }

  // --- Head (bobs) ---
  g.fillStyle = look.skin;
  arc(0, -12, 6, 0, Math.PI * 2);
  g.fill();

  // --- Facial hair (bobs), tinted with hair colour ---
  drawFacial(g, cx, cy, s, bob, look);

  // --- Hair (bobs) ---
  drawHair(g, cx, cy, s, bob, look);
}

function drawFacial(g: Ctx, cx: number, cy: number, s: number, bob: number, look: Appearance): void {
  if (look.facial === "none") return;
  const hc = look.hair;
  const Rb = (dx: number, dy: number, w: number, h: number) =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  if (look.facial === "stubble") {
    g.fillStyle = hc;
    g.globalAlpha = 0.35;
    g.beginPath();
    g.arc(cx, cy - 10 * s + bob, 6 * s, Math.PI * 0.15, Math.PI * 0.85);
    g.fill();
    g.globalAlpha = 1;
    return;
  }
  if (look.facial === "moustache") {
    g.fillStyle = hc;
    Rb(-2.6, -10.4, 5.2, 1.3);
    return;
  }
  if (look.facial === "goatee") {
    g.fillStyle = hc;
    Rb(-1.6, -8.6, 3.2, 2.6);
    g.fillStyle = hc;
    Rb(-2.4, -10.4, 4.8, 1.1); // a small moustache with it
    return;
  }
  // full beard: fill the lower face
  g.fillStyle = hc;
  g.beginPath();
  g.arc(cx, cy - 11 * s + bob, 6 * s, Math.PI * 0.08, Math.PI * 0.92);
  g.closePath();
  g.fill();
  Rb(-2.4, -11, 4.8, 1.1); // moustache cap
}

function drawHair(g: Ctx, cx: number, cy: number, s: number, bob: number, look: Appearance): void {
  if (look.hairStyle === "bald") return;
  const hc = look.hair;
  g.fillStyle = hc;
  const R = (dx: number, dy: number, w: number, h: number) =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  const cap = (r = 6) => {
    g.beginPath();
    g.arc(cx, cy - 12 * s + bob, r * s, Math.PI * 1.02, Math.PI * 1.98);
    g.lineTo(cx + (r - 1) * s, cy - 13 * s + bob);
    g.arc(cx, cy - 13 * s + bob, (r - 0.5) * s, Math.PI * 1.92, Math.PI * 1.08, true);
    g.closePath();
    g.fill();
  };
  switch (look.hairStyle) {
    case "long":
      cap();
      R(-6.2, -13, 1.8, 9); R(4.4, -13, 1.8, 9); // panels down both sides
      break;
    case "topknot":
      cap();
      g.beginPath(); g.arc(cx, cy - 19 * s + bob, 2.2 * s, 0, Math.PI * 2); g.fill();
      break;
    case "mohawk":
      R(-1.6, -19.5, 3.2, 8.5);
      break;
    case "spiky":
      cap(5.4);
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(cx + i * 2.2 * s, cy - 17 * s + bob);
        g.lineTo(cx + (i * 2.2 + 1.1) * s, cy - 20.5 * s + bob);
        g.lineTo(cx + (i * 2.2 + 2.2) * s, cy - 17 * s + bob);
        g.closePath(); g.fill();
      }
      break;
    case "sidepart":
      cap();
      R(-6.4, -15.5, 5.5, 3); // a swept fringe to one side
      break;
    case "ponytail":
      cap();
      g.beginPath(); // tail behind, to the right
      g.ellipse(cx + 6 * s, cy - 9 * s + bob, 1.8 * s, 4.5 * s, -0.3, 0, Math.PI * 2);
      g.fill();
      break;
    case "curly":
      g.beginPath(); g.arc(cx, cy - 13.5 * s + bob, 6.6 * s, Math.PI, Math.PI * 2); g.fill();
      for (let i = -2; i <= 2; i++) { // bumps along the top
        g.beginPath(); g.arc(cx + i * 2.6 * s, cy - 15 * s + bob, 2.1 * s, 0, Math.PI * 2); g.fill();
      }
      break;
    case "fringe":
      cap();
      R(-6, -13, 12, 2.6); // a fringe low over the brow
      break;
    case "short":
    default:
      cap();
      break;
  }
}
