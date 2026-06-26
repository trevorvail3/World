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
  ShopDef,
  WorldState,
} from "../core/types.ts";
import { ITEM_COLORS } from "./itemColors.ts";

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
      </div>`;
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
      const afford = player.gold >= line.price;
      const row = document.createElement("div");
      row.className = "shop-row";
      const bundle = line.qty > 1 ? ` ×${line.qty}` : "";
      row.innerHTML = `
        <span class="shop-swatch" style="--item-color:${ITEM_COLORS[line.item]}"></span>
        <span class="shop-row-name">${def.icon ?? ""} ${def.name}${bundle}</span>
        <button class="shop-buy ${afford ? "" : "disabled"}" type="button">${line.price.toLocaleString()}g</button>`;
      const btn = row.querySelector(".shop-buy") as HTMLElement;
      btn.title = def.description;
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
      slot.style.setProperty("--item-color", ITEM_COLORS[data.item]);
      slot.title = value > 0
        ? `Sell ${data.qty}× ${def.name} for ${value * data.qty}g`
        : `${def.name} — can't be sold`;
      slot.innerHTML = `<span class="inv-icon"></span>${
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
