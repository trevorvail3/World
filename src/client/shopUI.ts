/**
 * src/client/shopUI.ts
 * --------------------
 * A shopkeeper's trade window. Top: the keeper's wares (tap Buy to purchase a
 * bundle). Bottom: your pack (tap an item to sell the whole stack at its gold
 * value). It only sends BUY / SELL intents — the core moves the gold and goods
 * (RULE 2) — and re-reads live state after each one.
 */

import type {
  Content,
  Intent,
  ItemId,
  ShopDef,
  WorldState,
} from "../core/types.ts";
import { itemIconSVG } from "./itemIcon.ts";
import { shopStockLeft } from "../core/worldCore.ts";

export class ShopUI {
  private backdrop: HTMLElement;
  private head: HTMLElement;
  private goldEl: HTMLElement;
  private waresEl: HTMLElement;
  private invGrid: HTMLElement;
  private open = false;
  private state: WorldState | null = null;
  private shop: ShopDef | null = null;

  constructor(
    root: HTMLElement,
    private content: Content,
    private dispatch: (intent: Intent) => void,
  ) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "shop-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="shop-modal">
        <div class="shop-head">
          <span class="shop-title">Shop</span>
          <span class="shop-gold">0g</span>
          <button class="shop-close" type="button">✕</button>
        </div>
        <div class="shop-greeting"></div>
        <div class="shop-label">Wares</div>
        <div class="shop-wares"></div>
        <div class="shop-label">Your Pack — tap to sell</div>
        <div class="shop-inv inv-grid"></div>
      </div>
      <div class="shop-info hidden"></div>`;
    this.head = this.backdrop.querySelector(".shop-title") as HTMLElement;
    this.goldEl = this.backdrop.querySelector(".shop-gold") as HTMLElement;
    this.waresEl = this.backdrop.querySelector(".shop-wares") as HTMLElement;
    this.invGrid = this.backdrop.querySelector(".shop-inv") as HTMLElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".shop-close") as HTMLElement).addEventListener(
      "pointerdown",
      (e) => {
        e.stopPropagation();
        this.close();
      },
    );
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop) this.close();
    });
    this.infoEl = this.backdrop.querySelector(".shop-info") as HTMLElement;
    // Tapping the info overlay (but not the box inside it) dismisses it.
    this.infoEl.addEventListener("pointerdown", (e) => {
      if (e.target === this.infoEl) this.hideInfo();
    });
  }

  private infoEl!: HTMLElement;
  private pressTimer = 0;

  /** A long-press info box for a ware — what it is, what it heals, and its value. */
  private showInfo(item: ItemId, buyPrice: number, qty: number): void {
    const def = this.content.items[item];
    if (!def) return;
    const bundle = qty > 1 ? ` (×${qty})` : "";
    const heal = def.heals ? ` · heals ${def.heals}` : "";
    const sell = def.sell ? `Sells back for ${def.sell.toLocaleString()}g` : "Can't be sold back";
    this.infoEl.innerHTML = `
      <div class="shop-info-box">
        <button class="shop-info-x" type="button">✕</button>
        <div class="shop-info-icon">${itemIconSVG(def)}</div>
        <div class="shop-info-name">${def.name}</div>
        <div class="shop-info-desc">${def.description}${heal}</div>
        <div class="shop-info-stats">Buy: ${buyPrice.toLocaleString()}g${bundle} · ${sell}</div>
      </div>`;
    (this.infoEl.querySelector(".shop-info-x") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.hideInfo(); },
    );
    this.infoEl.classList.remove("hidden");
  }

  private hideInfo(): void { this.infoEl.classList.add("hidden"); }

  /** Fire `onHold` after a long press on `el` (cancelled by release or a drag). */
  private onLongPress(el: HTMLElement, onHold: () => void): void {
    let sx = 0, sy = 0;
    const cancel = (): void => { if (this.pressTimer) { clearTimeout(this.pressTimer); this.pressTimer = 0; } };
    el.addEventListener("pointerdown", (e) => {
      sx = e.clientX; sy = e.clientY;
      cancel();
      this.pressTimer = window.setTimeout(() => { this.pressTimer = 0; onHold(); }, 380);
    });
    el.addEventListener("pointermove", (e) => {
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 12) cancel();
    });
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  isOpen(): boolean {
    return this.open;
  }

  show(state: WorldState, shop: ShopDef): void {
    this.state = state;
    this.shop = shop;
    this.open = true;
    this.head.textContent = shop.name;
    (this.backdrop.querySelector(".shop-greeting") as HTMLElement).textContent = shop.greeting;
    this.backdrop.classList.remove("hidden");
    this.render();
  }

  close(): void {
    this.open = false;
    this.backdrop.classList.add("hidden");
  }

  private render(): void {
    if (!this.state || !this.shop) return;
    const { player } = this.state;
    this.goldEl.textContent = `${player.gold.toLocaleString()}g`;

    // --- Wares (buy) ---
    this.waresEl.innerHTML = "";
    for (const line of this.shop.stock) {
      const def = this.content.items[line.item];
      if (!def) continue;
      // Capes are earned one-offs — never stock-limited; everything else shows
      // how many are on the shelf and greys out when the keeper's sold out.
      const stocked = def.cat !== "Capes";
      const left = stocked ? shopStockLeft(this.state, this.shop.id, line.item) : Infinity;
      const inStock = left > 0;
      // A listing priced in an alternate currency (e.g. Agility Marks) is bought
      // with that item from the pack, not gold.
      const payItem = line.costItem;
      const payQty = line.costQty ?? 0;
      const have = payItem
        ? player.inventory.reduce((n, s) => (s?.item === payItem ? n + s.qty : n), 0)
        : 0;
      const costLabel = payItem
        ? `${payQty} ${this.content.items[payItem]?.name ?? "Mark"}${payQty === 1 ? "" : "s"}`
        : `${line.price.toLocaleString()}g`;
      const afford = (payItem ? have >= payQty : player.gold >= line.price) && inStock;
      const row = document.createElement("div");
      row.className = "shop-row";
      const bundle = line.qty > 1 ? ` ×${line.qty}` : "";
      const stockTag = stocked
        ? `<span class="shop-stock${inStock ? "" : " out"}">${inStock ? `${left} left` : "Sold out"}</span>`
        : "";
      row.innerHTML = `
        <span class="shop-swatch">${itemIconSVG(def)}</span>
        <span class="shop-row-name">${def.name}${bundle}${stockTag}</span>
        <button class="shop-buy ${afford ? "" : "disabled"}" type="button">${costLabel}</button>`;
      const btn = row.querySelector(".shop-buy") as HTMLElement;
      btn.title = inStock ? def.description : "Out of stock — the keeper will restock soon.";
      // Long-press the item (not the Buy button) to inspect what you're buying.
      this.onLongPress(row.querySelector(".shop-swatch") as HTMLElement, () => this.showInfo(line.item, line.price, line.qty));
      this.onLongPress(row.querySelector(".shop-row-name") as HTMLElement, () => this.showInfo(line.item, line.price, line.qty));
      if (afford) {
        btn.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          this.dispatchAndRender({ type: "BUY", shop: this.shop!.id, item: line.item });
        });
      }
      this.waresEl.appendChild(row);
    }

    // --- Your pack (sell whole stacks) ---
    this.invGrid.innerHTML = "";
    for (let i = 0; i < player.inventory.length; i++) {
      const data = player.inventory[i];
      if (!data) {
        const blank = document.createElement("div");
        blank.className = "inv-slot";
        this.invGrid.appendChild(blank);
        continue;
      }
      const def = this.content.items[data.item];
      const value = def?.sell ?? 0;
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "inv-slot filled" + (value > 0 ? "" : " unsellable");
      slot.title = value > 0
        ? `Sell ${data.qty}× ${def.name} for ${value * data.qty}g`
        : `${def.name} — can't be sold`;
      slot.innerHTML = `<span class="inv-icon">${itemIconSVG(def)}</span>${
        data.qty > 1 ? `<span class="inv-qty">${data.qty}</span>` : ""
      }`;
      if (value > 0) {
        slot.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          this.dispatchAndRender({ type: "SELL", item: data.item, qty: data.qty });
        });
      }
      this.invGrid.appendChild(slot);
    }
  }

  private dispatchAndRender(intent: Intent): void {
    this.dispatch(intent);
    this.render();
  }
}
