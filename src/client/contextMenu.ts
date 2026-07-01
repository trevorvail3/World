/**
 * src/client/contextMenu.ts
 * -------------------------
 * A small OSRS-style right-click / long-press action menu. Pure presentation:
 * each item just runs a callback (which, in practice, sends an intent to the
 * core). The menu builds no game state of its own.
 */

export interface MenuItem {
  /** The bold leading verb, e.g. "Chop" or "Walk here". */
  label: string;
  /** Optional dimmer target text shown after the label, e.g. "Ashwood Tree". */
  target?: string;
  onSelect: () => void;
  tone?: "action" | "normal" | "locked" | "danger";
}

/** A category of menu items, shown behind a tab (for long station recipe lists). */
export interface MenuTab {
  label: string;
  items: MenuItem[];
}

export class ContextMenu {
  private backdrop: HTMLElement;
  private menu: HTMLElement;
  private open = false;
  private openedAt = 0;

  constructor(root: HTMLElement) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "ctx-backdrop hidden";
    // Only an off-click (on the backdrop itself) dismisses the box — clicking
    // inside it (title, description, padding) keeps it open. Action buttons and
    // the X close it explicitly.
    this.backdrop.addEventListener("pointerdown", (e) => {
      // Off-click dismiss — but ignore one that lands in the first moment after
      // opening, so the very press/right-click that summoned the menu (or a
      // touch's trailing tap) can't instantly close it again.
      if (e.target === this.backdrop && performance.now() - this.openedAt > 180) {
        e.preventDefault();
        this.close();
      }
    });

    this.menu = document.createElement("div");
    this.menu.className = "ctx-menu";
    this.backdrop.appendChild(this.menu);
    root.appendChild(this.backdrop);
  }

  isOpen(): boolean {
    return this.open;
  }

  show(
    screenX: number,
    screenY: number,
    title: string,
    items: MenuItem[],
    description?: string,
    /** Optional value chip shown right next to the name (e.g. "120g"). */
    titleValue?: string,
    /** Optional category tabs — when present, `items` is ignored and each tab's
     *  items show behind its tab (for long station recipe lists). */
    tabs?: MenuTab[],
  ): void {
    this.menu.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ctx-title";
    head.innerHTML = `<span class="ctx-title-text"></span><span class="ctx-title-value"></span><button class="ctx-close" type="button">✕</button>`;
    (head.querySelector(".ctx-title-text") as HTMLElement).textContent = title;
    const valEl = head.querySelector(".ctx-title-value") as HTMLElement;
    if (titleValue) valEl.textContent = titleValue;
    else valEl.remove();
    (head.querySelector(".ctx-close") as HTMLElement).addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });
    this.menu.appendChild(head);

    // Inspect text — what the thing IS — shown under the title.
    if (description) {
      const desc = document.createElement("div");
      desc.className = "ctx-desc";
      desc.textContent = description;
      this.menu.appendChild(desc);
    }

    // Actions live in a scroll region, so a long list (e.g. every cooking
    // recipe) can be scrolled through instead of running off the screen.
    const list = document.createElement("div");
    list.className = "ctx-items";

    // Category tabs for long lists: a tab bar swaps which group's items show.
    const useTabs = tabs && tabs.length > 1;
    if (useTabs) {
      const bar = document.createElement("div");
      bar.className = "ctx-tabs";
      const chips: HTMLElement[] = [];
      const paint = (idx: number): void => {
        chips.forEach((c, i) => c.classList.toggle("on", i === idx));
        this.fillItems(list, tabs![idx]!.items);
        list.scrollTop = 0;
      };
      tabs!.forEach((tab, i) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "ctx-tab";
        chip.textContent = tab.label;
        chip.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); paint(i); });
        bar.appendChild(chip);
        chips.push(chip);
      });
      this.menu.appendChild(bar);
      this.menu.appendChild(list);
      paint(0);
    } else {
      this.fillItems(list, items);
      this.menu.appendChild(list);
    }

    // Position, then nudge back on-screen if it would overflow.
    this.backdrop.classList.remove("hidden");
    this.open = true;
    this.openedAt = performance.now();
    this.menu.style.left = `${screenX}px`;
    this.menu.style.top = `${screenY}px`;
    const rect = this.menu.getBoundingClientRect();
    let x = screenX;
    let y = screenY;
    if (rect.right > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (rect.bottom > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    this.menu.style.left = `${Math.max(8, x)}px`;
    this.menu.style.top = `${Math.max(8, y)}px`;
  }

  /** (Re)fill a scroll container with action buttons (used per tab). */
  private fillItems(list: HTMLElement, items: MenuItem[]): void {
    list.innerHTML = "";
    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ctx-item ${item.tone === "action" ? "ctx-action" : ""}${item.tone === "locked" ? " ctx-locked" : ""}${item.tone === "danger" ? " ctx-danger" : ""}`;
      btn.innerHTML = item.target
        ? `<span class="ctx-verb">${esc(item.label)}</span> <span class="ctx-target">${esc(item.target)}</span>`
        : `<span class="ctx-verb">${esc(item.label)}</span>`;
      // Tap-vs-drag: a drag scrolls the list (long recipe menus), a tap selects.
      // Don't preventDefault the pointerdown, or touch scrolling is blocked.
      let sy = 0, sx = 0, moved = false;
      btn.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; moved = false; e.stopPropagation(); });
      btn.addEventListener("pointermove", (e) => {
        if (Math.abs(e.clientY - sy) > 8 || Math.abs(e.clientX - sx) > 8) moved = true;
      });
      btn.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        if (moved) return; // it was a scroll, not a pick
        this.close();
        item.onSelect();
      });
      list.appendChild(btn);
    }
  }

  close(): void {
    this.open = false;
    this.backdrop.classList.add("hidden");
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
