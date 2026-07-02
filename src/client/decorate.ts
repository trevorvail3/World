/**
 * src/client/decorate.ts
 * ----------------------
 * The Homestead's decorate mode — the ESO / Animal-Crossing furnishing UI.
 * Presentation only: it reads state and sends the free-placement intents
 * (CRAFT / PLACE / MOVE / STORE / UPGRADE_FURNITURE); the core owns every rule.
 *
 * Flow:
 *   - A "Decorate" button appears while you stand in your home.
 *   - The shelf has two drawers: BUILD (craft a piece from Construction
 *     materials into your storage) and STORAGE (place a piece you own).
 *   - Pick a stored piece → the world goes into placing mode: tap a floor tile
 *     to set it down, Rotate to turn it, Done to stop.
 *   - Tap a piece already placed → move / rotate / store / upgrade it.
 */

import type { Content, Intent, WorldState, ItemId, Vec2, FurnitureDef } from "../core/types.ts";
import type { ContextMenu, MenuItem } from "./contextMenu.ts";

interface Deps {
  state: () => WorldState;
  content: Content;
  dispatch: (i: Intent) => void;
  menu: ContextMenu;
  log: (m: string) => void;
  /** True while the player stands on their home's floor. */
  inHome: () => boolean;
}

export class DecorateUI {
  private d: Deps;
  private active = false;
  private placing: { id: string; rot: number } | null = null;
  private moving: { index: number; rot: number } | null = null;

  private btn: HTMLButtonElement;   // the "Decorate" entry, shown in-home
  private shelf: HTMLElement;       // the bottom drawer
  private hint: HTMLElement;        // the placing hint bar

  constructor(root: HTMLElement, deps: Deps) {
    this.d = deps;

    this.btn = document.createElement("button");
    this.btn.className = "decorate-enter hidden";
    this.btn.type = "button";
    this.btn.textContent = "Decorate";
    this.btn.addEventListener("click", () => this.open());
    root.appendChild(this.btn);

    this.shelf = document.createElement("div");
    this.shelf.className = "decorate-shelf hidden";
    root.appendChild(this.shelf);

    this.hint = document.createElement("div");
    this.hint.className = "decorate-hint hidden";
    root.appendChild(this.hint);
  }

  isActive(): boolean { return this.active; }

  /** Called each frame: reveal the entry button only when at home + not editing. */
  update(): void {
    const show = !this.active && this.d.inHome();
    this.btn.classList.toggle("hidden", !show);
  }

  open(): void {
    if (!this.d.inHome()) { this.d.log("You can only decorate inside your home."); return; }
    this.active = true;
    this.placing = null;
    this.moving = null;
    this.btn.classList.add("hidden");
    this.renderShelf();
  }

  close(): void {
    this.active = false;
    this.placing = null;
    this.moving = null;
    this.shelf.classList.add("hidden");
    this.hint.classList.add("hidden");
    this.d.menu.close();
  }

  // --- world taps ---------------------------------------------------------
  /** Handle a world tap while decorating. Returns true if it was consumed. */
  handleWorldTap(tile: Vec2, screenX: number, screenY: number): boolean {
    if (!this.active) return false;
    // Placing a fresh piece from storage, or relocating one already down.
    if (this.placing) {
      this.d.dispatch({ type: "PLACE_FURNITURE", furnitureId: this.placing.id, x: tile.x, y: tile.y, rot: this.placing.rot });
      // Keep placing more of the same if any remain, else return to the shelf.
      if ((this.d.state().player.home.storage[this.placing.id] ?? 0) <= 0) { this.placing = null; this.renderShelf(); }
      else this.showHint();
      return true;
    }
    if (this.moving) {
      this.d.dispatch({ type: "MOVE_FURNITURE", index: this.moving.index, x: tile.x, y: tile.y, rot: this.moving.rot });
      this.moving = null;
      this.hint.classList.add("hidden");
      this.renderShelf();
      return true;
    }
    // Otherwise: tapping a placed piece opens its options.
    const idx = this.placedAt(tile);
    if (idx >= 0) { this.pieceMenu(idx, screenX, screenY); return true; }
    return true; // swallow stray taps so we don't walk around mid-decorate
  }

  /** The index of a placed piece whose footprint covers this tile, or -1. */
  private placedAt(tile: Vec2): number {
    const placed = this.d.state().player.home.placed;
    for (let i = placed.length - 1; i >= 0; i--) {
      const p = placed[i]!;
      const f = this.d.content.furniture[p.item];
      if (!f) continue;
      const [w, h] = this.footprint(f, p.rot);
      if (tile.x >= p.x && tile.x < p.x + w && tile.y >= p.y && tile.y < p.y + h) return i;
    }
    return -1;
  }

  private footprint(f: FurnitureDef, rot: number): [number, number] {
    const [w, h] = f.footprint ?? [1, 1];
    return (rot & 1) === 1 ? [h, w] : [w, h];
  }

  // --- the placed-piece menu ---------------------------------------------
  private pieceMenu(index: number, sx: number, sy: number): void {
    const p = this.d.state().player.home.placed[index];
    if (!p) return;
    const f = this.d.content.furniture[p.item];
    if (!f) return;
    const items: MenuItem[] = [
      { label: "Move", target: f.name, tone: "action", onSelect: () => { this.moving = { index, rot: p.rot }; this.showHint(); } },
      { label: "Rotate", target: f.name, onSelect: () => this.d.dispatch({ type: "MOVE_FURNITURE", index, x: p.x, y: p.y, rot: (p.rot + 1) & 3 }) },
      { label: "Pack up", target: f.name, onSelect: () => { this.d.dispatch({ type: "STORE_FURNITURE", index }); this.renderShelf(); } },
    ];
    const next = this.nextTier(f);
    if (next) {
      items.push({
        label: "Upgrade", target: `→ ${next.name} · Con ${next.levelReq}`,
        tone: this.canAfford(next) ? "action" : "locked",
        onSelect: () => this.d.dispatch({ type: "UPGRADE_FURNITURE", index }),
      });
    }
    this.d.menu.show(sx, sy, f.name, items, f.blurb);
  }

  // --- the shelf ----------------------------------------------------------
  private renderShelf(): void {
    this.hint.classList.add("hidden");
    this.shelf.classList.remove("hidden");
    const st = this.d.state().player;
    const stored = Object.entries(st.home.storage).filter(([, n]) => (n ?? 0) > 0);

    const storeRow = stored.length === 0
      ? `<div class="deco-empty">Nothing built yet — craft a piece below.</div>`
      : stored.map(([id, n]) => {
          const f = this.d.content.furniture[id];
          if (!f) return "";
          return `<button class="deco-chip" data-place="${id}">${escapeHtml(f.name)}${(n ?? 0) > 1 ? ` ×${n}` : ""}</button>`;
        }).join("");

    // Craftable: every furniture piece, grouped by category, cheapest first.
    const craftable = Object.values(this.d.content.furniture).sort((a, b) => a.levelReq - b.levelReq || a.category.localeCompare(b.category));
    const conLvl = st.skills.construction.level;
    const craftRow = craftable.map((f) => {
      const leveled = conLvl >= f.levelReq;
      const ready = leveled && this.canAfford(f);
      const cls = ready ? "ready" : leveled ? "" : "locked";
      const cost = leveled ? this.costLabel(f) : `Con ${f.levelReq}`;
      return `<button class="deco-craft ${cls}" data-craft="${f.id}" title="${escapeHtml(cost)}">${escapeHtml(f.name)}<span>${escapeHtml(cost)}</span></button>`;
    }).join("");

    this.shelf.innerHTML = `
      <div class="deco-head">
        <span class="deco-title">Decorate your home</span>
        <button class="deco-done" type="button">Done</button>
      </div>
      <div class="deco-section">
        <div class="deco-label">Your furniture — tap to place</div>
        <div class="deco-row deco-storage">${storeRow}</div>
      </div>
      <div class="deco-section">
        <div class="deco-label">Build from Construction materials</div>
        <div class="deco-row deco-catalogue">${craftRow}</div>
      </div>`;

    (this.shelf.querySelector(".deco-done") as HTMLElement).addEventListener("click", () => this.close());
    for (const b of Array.from(this.shelf.querySelectorAll<HTMLElement>("[data-place]"))) {
      b.addEventListener("click", () => { this.placing = { id: b.dataset["place"]!, rot: 0 }; this.moving = null; this.showHint(); });
    }
    for (const b of Array.from(this.shelf.querySelectorAll<HTMLElement>("[data-craft]"))) {
      b.addEventListener("click", () => { this.d.dispatch({ type: "CRAFT_FURNITURE", furnitureId: b.dataset["craft"]! }); this.renderShelf(); });
    }
  }

  private showHint(): void {
    this.shelf.classList.add("hidden");
    this.hint.classList.remove("hidden");
    const what = this.placing ? this.d.content.furniture[this.placing.id]?.name
      : this.moving ? this.d.content.furniture[this.d.state().player.home.placed[this.moving.index]?.item ?? ""]?.name
      : "";
    this.hint.innerHTML = `
      <span class="deco-hint-text">Tap a floor tile to place the <b>${escapeHtml(what ?? "piece")}</b></span>
      <button class="deco-rotate" type="button">Rotate</button>
      <button class="deco-cancel" type="button">Done</button>`;
    (this.hint.querySelector(".deco-rotate") as HTMLElement).addEventListener("click", () => {
      if (this.placing) this.placing.rot = (this.placing.rot + 1) & 3;
      else if (this.moving) this.moving.rot = (this.moving.rot + 1) & 3;
    });
    (this.hint.querySelector(".deco-cancel") as HTMLElement).addEventListener("click", () => { this.placing = null; this.moving = null; this.renderShelf(); });
  }

  // --- helpers ------------------------------------------------------------
  private nextTier(f: FurnitureDef): FurnitureDef | undefined {
    const ladder = Object.values(this.d.content.furniture).filter((g) => g.category === f.category).sort((a, b) => a.levelReq - b.levelReq);
    const at = ladder.findIndex((g) => g.id === f.id);
    return at >= 0 ? ladder[at + 1] : undefined;
  }
  private canAfford(f: FurnitureDef): boolean {
    const inv = this.d.state().player.inventory;
    const have = (id: string): number => inv.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    return Object.entries(f.materials).every(([item, qty]) => have(item) >= (qty ?? 0));
  }
  private costLabel(f: FurnitureDef): string {
    return Object.entries(f.materials).map(([item, qty]) => `${qty}× ${this.d.content.items[item as ItemId]?.name ?? item}`).join(", ");
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
