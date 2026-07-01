/**
 * src/client/bankUI.ts
 * --------------------
 * The bank chest window: your stored items on top, your pack below. Tap a pack
 * item to deposit the whole stack; tap a bank item to withdraw one. It only
 * sends DEPOSIT / WITHDRAW intents — the core does the moving (RULE 2).
 */

import type { Content, Intent, ItemId, WorldState } from "../core/types.ts";
import { itemIconSVG } from "./itemIcon.ts";
import type { ContextMenu, MenuItem } from "./contextMenu.ts";
import { equipRequirement } from "../core/worldCore.ts";

export class BankUI {
  private backdrop: HTMLElement;
  private bankGrid: HTMLElement;
  private invGrid: HTMLElement;
  private countEl: HTMLElement;
  private valueEl: HTMLElement;
  private searchEl: HTMLInputElement;
  private filter = "";
  private open = false;
  private state: WorldState | null = null;
  private infoEl!: HTMLElement;
  private pressTimer = 0;

  constructor(
    root: HTMLElement,
    private content: Content,
    private dispatch: (intent: Intent) => void,
    private menu: ContextMenu | null = null,
  ) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "bank-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="bank-modal">
        <div class="bank-head">
          <span class="bank-title">Bank Chest</span>
          <span class="bank-value"></span>
          <button class="bank-close" type="button">✕</button>
        </div>
        <div class="bank-label">Stored <span class="bank-count"></span>
          <input class="bank-search" type="text" placeholder="Search…" />
        </div>
        <div class="bank-grid"></div>
        <div class="bank-label">Your Pack <button class="bank-depositall" type="button">Deposit all</button></div>
        <div class="bank-inv inv-grid"></div>
      </div>
      <div class="shop-info hidden"></div>`;
    this.infoEl = this.backdrop.querySelector(".shop-info") as HTMLElement;
    this.infoEl.addEventListener("pointerdown", (e) => {
      if (e.target === this.infoEl) this.hideInfo();
    });
    this.bankGrid = this.backdrop.querySelector(".bank-grid") as HTMLElement;
    this.invGrid = this.backdrop.querySelector(".bank-inv") as HTMLElement;
    this.countEl = this.backdrop.querySelector(".bank-count") as HTMLElement;
    this.valueEl = this.backdrop.querySelector(".bank-value") as HTMLElement;
    this.searchEl = this.backdrop.querySelector(".bank-search") as HTMLInputElement;
    root.appendChild(this.backdrop);

    // Live search: filter the stored grid by item name as you type.
    this.searchEl.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.searchEl.addEventListener("input", () => {
      this.filter = this.searchEl.value.trim().toLowerCase();
      this.render();
    });

    // Close on the X, or by tapping the dim area outside the window.
    (this.backdrop.querySelector(".bank-close") as HTMLElement).addEventListener(
      "pointerdown",
      (e) => {
        e.stopPropagation();
        this.close();
      },
    );
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop) this.close();
    });
    (this.backdrop.querySelector(".bank-depositall") as HTMLElement).addEventListener(
      "pointerdown",
      (e) => {
        e.stopPropagation();
        this.depositAll();
      },
    );
  }

  private depositAll(): void {
    if (!this.state) return;
    const ids = new Set<ItemId>();
    for (const slot of this.state.player.inventory) {
      if (slot) ids.add(slot.item);
    }
    for (const id of ids) this.dispatch({ type: "DEPOSIT", item: id });
    this.render();
  }

  isOpen(): boolean {
    return this.open;
  }

  show(state: WorldState): void {
    this.state = state;
    this.open = true;
    this.filter = "";
    this.searchEl.value = "";
    this.backdrop.classList.remove("hidden");
    this.render();
  }

  close(): void {
    this.open = false;
    this.backdrop.classList.add("hidden");
  }

  private render(): void {
    if (!this.state) return;
    const { player } = this.state;

    // Stored items (stacked), filtered by the search box.
    this.bankGrid.innerHTML = "";
    const stored = (Object.keys(player.bank) as ItemId[]).filter(
      (id) => (player.bank[id] ?? 0) > 0,
    );
    this.countEl.textContent = stored.length ? `(${stored.length})` : "";
    // Total sell value of everything stored, shown in the header.
    const value = stored.reduce(
      (sum, id) => sum + (this.content.items[id]?.sell ?? 0) * (player.bank[id] ?? 0),
      0,
    );
    this.valueEl.textContent = value > 0 ? `${value.toLocaleString()}g` : "";
    const entries = this.filter
      ? stored.filter((id) => this.content.items[id]?.name.toLowerCase().includes(this.filter))
      : stored;
    if (stored.length === 0) {
      const empty = document.createElement("div");
      empty.className = "bank-empty";
      empty.textContent = "The chest is empty.";
      this.bankGrid.appendChild(empty);
    } else if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "bank-empty";
      empty.textContent = `No stored item matches “${this.filter}”.`;
      this.bankGrid.appendChild(empty);
    } else {
      for (const id of entries) {
        const qty = player.bank[id] ?? 0;
        this.bankGrid.appendChild(
          this.slot(id, qty, (x, y) => this.withdrawMenu(id, qty, x, y)),
        );
      }
    }

    // Your pack (28 fixed slots).
    this.invGrid.innerHTML = "";
    for (let i = 0; i < player.inventory.length; i++) {
      const data = player.inventory[i];
      if (!data) {
        const blank = document.createElement("div");
        blank.className = "inv-slot";
        this.invGrid.appendChild(blank);
        continue;
      }
      const held = data;
      this.invGrid.appendChild(
        this.slot(held.item, held.qty, (x, y) => this.depositMenu(held.item, x, y)),
      );
    }
  }

  private slot(item: ItemId, qty: number, onTap: (x: number, y: number) => void): HTMLElement {
    const def = this.content.items[item];
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "inv-slot filled";
    slot.title = `${def.name} — hold to inspect, tap to move`;
    slot.innerHTML = `<span class="inv-icon">${itemIconSVG(def)}</span>${
      qty > 1 ? `<span class="inv-qty">${qty}</span>` : ""
    }`;
    // Tap moves the item (withdraw/deposit); long-hold (or right-click) inspects
    // it instead — so you can examine a stored item without pulling it out.
    this.attachPress(slot, () => this.showItemInfo(item, qty), (x, y) => onTap(x, y));
    return slot;
  }

  private hideInfo(): void { this.infoEl.classList.add("hidden"); }

  /** Long-press → inspect; a clean tap → move. Right-click inspects at once. */
  private attachPress(el: HTMLElement, onLong: () => void, onTap: (x: number, y: number) => void): void {
    let sx = 0, sy = 0, moved = false, fired = false;
    const clear = (): void => { if (this.pressTimer) { clearTimeout(this.pressTimer); this.pressTimer = 0; } };
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      sx = e.clientX; sy = e.clientY; moved = false; fired = false;
      clear();
      if (e.button === 2) { fired = true; onLong(); return; }
      this.pressTimer = window.setTimeout(() => {
        this.pressTimer = 0;
        if (!moved) { fired = true; onLong(); }
      }, 380);
    });
    el.addEventListener("pointermove", (e) => {
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 12) { moved = true; clear(); }
    });
    el.addEventListener("pointerup", (e) => {
      clear();
      if (!fired && !moved) onTap(e.clientX, e.clientY);
    });
    el.addEventListener("pointercancel", clear);
    el.addEventListener("pointerleave", clear);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** A one-line combat/utility stat summary for the inspect box. */
  private itemStats(def: Content["items"][ItemId]): string {
    const bits: string[] = [];
    if (def.acc) bits.push(`+${def.acc} accuracy`);
    if (def.dmg) bits.push(`+${def.dmg} damage`);
    if (def.rngAcc) bits.push(`+${def.rngAcc} ranged acc`);
    if (def.rngDmg) bits.push(`+${def.rngDmg} ranged dmg`);
    if (def.magAcc) bits.push(`+${def.magAcc} magic acc`);
    if (def.magDmg) bits.push(`+${def.magDmg} magic dmg`);
    if (def.def) bits.push(`+${def.def} defence`);
    if (def.heals) bits.push(`heals ${def.heals}`);
    if (def.graceRestore) bits.push(`+${def.graceRestore} Grace`);
    return bits.join(" · ");
  }

  /** Inspect a stored/pack item: name, description, stats, requirement, value. */
  private showItemInfo(item: ItemId, qty: number): void {
    const def = this.content.items[item];
    if (!def) return;
    const stats = this.itemStats(def);
    const req = equipRequirement(this.content, item);
    const reqLine = req ? `<div class="shop-info-req">Requires ${this.content.skills[req.skill]?.name ?? req.skill} ${req.level}</div>` : "";
    const value = def.sell ?? 0;
    const valLine = value > 0
      ? `Worth ${value.toLocaleString()}g each${qty > 1 ? ` · ${(value * qty).toLocaleString()}g for all ${qty}` : ""}`
      : "No market value";
    this.infoEl.innerHTML = `
      <div class="shop-info-box">
        <button class="shop-info-x" type="button">✕</button>
        <div class="shop-info-icon">${itemIconSVG(def)}</div>
        <div class="shop-info-name">${def.name}</div>
        <div class="shop-info-desc">${def.description}</div>
        ${stats ? `<div class="shop-info-gear">${stats}</div>` : ""}
        ${reqLine}
        <div class="shop-info-stats">${valLine}</div>
      </div>`;
    (this.infoEl.querySelector(".shop-info-x") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.hideInfo(); },
    );
    this.infoEl.classList.remove("hidden");
  }

  /** Pack item: choose how much to bank — 1, a typed amount, or the whole stack. */
  private depositMenu(item: ItemId, x: number, y: number): void {
    const name = this.content.items[item]?.name ?? item;
    const held = this.state
      ? this.state.player.inventory.reduce((n, s) => (s?.item === item ? n + s.qty : n), 0)
      : 0;
    const dep = (qty?: number): void => this.dispatchAndRender(
      qty === undefined ? { type: "DEPOSIT", item } : { type: "DEPOSIT", item, qty },
    );
    if (!this.menu || held <= 1) { dep(); return; } // nothing to choose
    const items: MenuItem[] = [
      { label: "Deposit", target: "1", tone: "action", onSelect: () => dep(1) },
      { label: "Deposit", target: "amount…", onSelect: () => {
        const n = this.askAmount(name, held);
        if (n > 0) dep(n);
      } },
      { label: "Deposit", target: `all (${held})`, onSelect: () => dep() },
    ];
    this.menu.show(x, y, name, items, "Move into the bank chest.");
  }

  /** Bank item: choose how much to take out — 1, a typed amount, or all — and
   *  whether to take it as a note (a bank slip: the whole amount in one slot). */
  private withdrawMenu(item: ItemId, have: number, x: number, y: number): void {
    const name = this.content.items[item]?.name ?? item;
    const wd = (qty: number, noted = false): void =>
      this.dispatchAndRender({ type: "WITHDRAW", item, qty, ...(noted ? { noted: true } : {}) });
    if (!this.menu || have <= 1) { wd(1); return; }
    const items: MenuItem[] = [
      { label: "Withdraw", target: "1", tone: "action", onSelect: () => wd(1) },
      { label: "Withdraw", target: "amount…", onSelect: () => {
        const n = this.askAmount(name, have);
        if (n > 0) wd(n);
      } },
      { label: "Withdraw", target: `all (${have})`, onSelect: () => wd(have) },
      { label: "Withdraw", target: "as note — all", onSelect: () => wd(have, true) },
      { label: "Withdraw", target: "as note — amount…", onSelect: () => {
        const n = this.askAmount(name, have);
        if (n > 0) wd(n, true);
      } },
    ];
    this.menu.show(x, y, name, items, "Take out of the bank chest. A note carries any amount in one slot.");
  }

  private askAmount(name: string, max: number): number {
    const ans = window.prompt(`How many ${name}? (1–${max})`, String(max));
    if (ans === null) return 0;
    return Math.max(0, Math.min(max, Math.floor(Number(ans)) || 0));
  }

  private dispatchAndRender(intent: Intent): void {
    this.dispatch(intent);
    this.render();
  }
}
