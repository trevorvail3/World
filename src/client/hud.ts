/**
 * src/client/hud.ts
 * -----------------
 * The on-screen overlays, arranged OSRS-style:
 *   - an always-on Hitpoints bar (top-left),
 *   - the game log (bottom-left),
 *   - a tabbed "dock" (bottom-right) whose tab column runs up its left side:
 *     Inventory · Skills · Equipment · Character · Settings (more to come).
 *
 * Presentation only — it reads the core's state and shows it, never changing
 * state itself (RULE 2). (The Reset button lives in main.ts, top-right.)
 */

import type { Content, Intent, InventorySlot, SkillId, WorldState } from "../core/types.ts";
import type { ContextMenu, MenuItem } from "./contextMenu.ts";
import { ITEM_COLORS } from "./itemColors.ts";

const MAX_LOG_LINES = 8;

type TabId = "inventory" | "skills" | "equipment" | "character" | "settings";

const TABS: { id: TabId; icon: string; title: string }[] = [
  { id: "inventory", icon: "🎒", title: "Pack" },
  { id: "skills", icon: "📜", title: "Skills" },
  { id: "equipment", icon: "🛡️", title: "Equipment" },
  { id: "character", icon: "👤", title: "Character" },
  { id: "settings", icon: "⚙️", title: "Settings" },
];

/** Equipment slots shown as placeholders until gear exists. */
const EQUIP_SLOTS = [
  "Head", "Cape", "Amulet", "Weapon", "Body", "Shield",
  "Legs", "Hands", "Feet", "Ring",
];

export class Hud {
  private content: Content;
  private skillRows = new Map<SkillId, HTMLElement>();
  private invSlots: HTMLElement[] = [];
  private hpFill!: HTMLElement;
  private hpText!: HTMLElement;
  private logEl!: HTMLElement;
  private logLines: string[] = [];

  private tabPanels = new Map<TabId, HTMLElement>();
  private tabButtons = new Map<TabId, HTMLElement>();
  private activeTab: TabId = "inventory";
  private collapsed = false;
  private dock!: HTMLElement;

  private charCombat!: HTMLElement;
  private charTotal!: HTMLElement;
  private charHp!: HTMLElement;

  private onReset: () => void;
  private menu: ContextMenu | null;
  private dispatch: (intent: Intent) => void;
  private invData: (InventorySlot | null)[] = [];

  constructor(
    root: HTMLElement,
    content: Content,
    onReset: () => void = () => {},
    menu: ContextMenu | null = null,
    dispatch: (intent: Intent) => void = () => {},
  ) {
    this.content = content;
    this.onReset = onReset;
    this.menu = menu;
    this.dispatch = dispatch;
    this.build(root);
  }

  private build(root: HTMLElement): void {
    // --- Always-on Hitpoints (top-left) ---
    const vitals = panel("hud-panel hud-vitals");
    vitals.innerHTML = `
      <div class="vitals-label">Hitpoints <span class="hp-text">10 / 10</span></div>
      <div class="hp-bar"><div class="hp-fill"></div></div>`;
    this.hpFill = vitals.querySelector(".hp-fill") as HTMLElement;
    this.hpText = vitals.querySelector(".hp-text") as HTMLElement;
    root.appendChild(vitals);

    // --- Game log (bottom-left) ---
    const logPanel = panel("hud-panel hud-log");
    this.logEl = document.createElement("div");
    this.logEl.className = "log-lines";
    logPanel.appendChild(this.logEl);
    root.appendChild(logPanel);

    // --- Tabbed dock (bottom-right); tab column up the left side ---
    const dock = panel("hud-panel hud-dock");
    this.dock = dock;
    const tabsCol = document.createElement("div");
    tabsCol.className = "dock-tabs";
    const body = document.createElement("div");
    body.className = "dock-body";

    for (const t of TABS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dock-tab";
      btn.title = t.title;
      btn.textContent = t.icon;
      btn.addEventListener("click", () => this.setTab(t.id));
      tabsCol.appendChild(btn);
      this.tabButtons.set(t.id, btn);

      const p = document.createElement("div");
      p.className = "tab-panel";
      this.buildTab(t.id, t.title, p);
      body.appendChild(p);
      this.tabPanels.set(t.id, p);
    }

    dock.appendChild(tabsCol); // tabs LEFT of the panel body
    dock.appendChild(body);
    root.appendChild(dock);

    this.applyTabState(); // start expanded on the default tab
  }

  private buildTab(id: TabId, title: string, p: HTMLElement): void {
    p.appendChild(heading(title));
    switch (id) {
      case "inventory": {
        const grid = document.createElement("div");
        grid.className = "inv-grid";
        for (let i = 0; i < 28; i++) {
          const slot = document.createElement("div");
          slot.className = "inv-slot";
          this.attachLongPress(
            slot,
            (x, y) => this.inspectItem(i, x, y),
            (x, y) => this.tapItem(i, x, y),
          );
          grid.appendChild(slot);
          this.invSlots.push(slot);
        }
        p.appendChild(grid);
        break;
      }
      case "skills": {
        (Object.keys(this.content.skills) as SkillId[]).forEach((sid) => {
          const row = document.createElement("div");
          row.className = "skill-row";
          row.innerHTML = `<span class="skill-name">${this.content.skills[sid].name}</span><span class="skill-val">1</span>`;
          this.skillRows.set(sid, row.querySelector(".skill-val") as HTMLElement);
          p.appendChild(row);
        });
        break;
      }
      case "equipment": {
        const grid = document.createElement("div");
        grid.className = "equip-grid";
        for (const name of EQUIP_SLOTS) {
          const cell = document.createElement("div");
          cell.className = "equip-cell";
          cell.innerHTML = `<div class="equip-slot"></div><span class="equip-name">${name}</span>`;
          grid.appendChild(cell);
        }
        p.appendChild(grid);
        p.appendChild(note("No gear yet — weapons and armour are coming."));
        break;
      }
      case "character": {
        const sheet = document.createElement("div");
        sheet.className = "char-sheet";
        sheet.innerHTML = `
          <div class="char-name">Wanderer of Ironvale</div>
          <div class="char-row"><span>Combat</span><span class="char-combat">1</span></div>
          <div class="char-row"><span>Total level</span><span class="char-total">6</span></div>
          <div class="char-row"><span>Hitpoints</span><span class="char-hp">10 / 10</span></div>`;
        this.charCombat = sheet.querySelector(".char-combat") as HTMLElement;
        this.charTotal = sheet.querySelector(".char-total") as HTMLElement;
        this.charHp = sheet.querySelector(".char-hp") as HTMLElement;
        p.appendChild(sheet);
        p.appendChild(note("Name and background arrive with sign-in."));
        break;
      }
      case "settings": {
        p.appendChild(note("More settings coming soon — audio, display and more."));
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "settings-reset";
        reset.textContent = "⟲ Reset progress";
        reset.title = "Erase all saved progress and start over";
        reset.addEventListener("click", () => this.onReset());
        p.appendChild(reset);
        break;
      }
    }
  }

  private setTab(id: TabId): void {
    // Tapping the already-open tab collapses the dock to just its tab column.
    if (id === this.activeTab && !this.collapsed) {
      this.collapsed = true;
    } else {
      this.activeTab = id;
      this.collapsed = false;
    }
    this.applyTabState();
  }

  /** Reflect the current active-tab / collapsed state in the DOM. */
  private applyTabState(): void {
    this.dock.classList.toggle("collapsed", this.collapsed);
    this.tabPanels.forEach((p, key) =>
      p.classList.toggle("active", key === this.activeTab && !this.collapsed),
    );
    this.tabButtons.forEach((b, key) =>
      b.classList.toggle("active", key === this.activeTab),
    );
  }

  log(message: string): void {
    this.logLines.push(message);
    if (this.logLines.length > MAX_LOG_LINES) this.logLines.shift();
    this.logEl.innerHTML = this.logLines
      .map((l) => `<div class="log-line">${escapeHtml(l)}</div>`)
      .join("");
  }

  /** A short tap on a slot: eat food, otherwise just inspect it. */
  private tapItem(index: number, screenX: number, screenY: number): void {
    const data = this.invData[index];
    if (!data) return;
    if (this.content.items[data.item].heals) {
      this.dispatch({ type: "EAT", slot: index });
    } else {
      this.inspectItem(index, screenX, screenY);
    }
  }

  /** Long-press / right-click an inventory slot to inspect the item. */
  private inspectItem(index: number, screenX: number, screenY: number): void {
    const data = this.invData[index];
    if (!data || !this.menu) return;
    const def = this.content.items[data.item];
    const items: MenuItem[] = [];
    if (def.heals) {
      items.push({
        label: "Eat",
        target: def.name,
        tone: "action",
        onSelect: () => this.dispatch({ type: "EAT", slot: index }),
      });
    }
    this.menu.show(screenX, screenY, def.name, items, def.description);
  }

  /** Short tap fires `onTap`; a held press fires `onLong`. */
  private attachLongPress(
    el: HTMLElement,
    onLong: (x: number, y: number) => void,
    onTap?: (x: number, y: number) => void,
  ): void {
    let timer: number | null = null;
    let sx = 0;
    let sy = 0;
    let moved = false;
    let fired = false;
    const clear = (): void => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      sx = e.clientX;
      sy = e.clientY;
      moved = false;
      fired = false;
      clear();
      timer = window.setTimeout(() => {
        if (!moved) {
          fired = true;
          onLong(e.clientX, e.clientY);
        }
      }, 330);
    });
    el.addEventListener("pointermove", (e) => {
      if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) {
        moved = true;
        clear();
      }
    });
    el.addEventListener("pointerup", (e) => {
      clear();
      if (!fired && !moved && onTap) onTap(e.clientX, e.clientY);
    });
    el.addEventListener("pointercancel", clear);
    // Right-click inspects immediately (desktop).
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      clear();
      onLong(e.clientX, e.clientY);
    });
  }

  update(state: WorldState): void {
    const { player } = state;
    this.invData = player.inventory;

    // Skills
    (Object.keys(this.content.skills) as SkillId[]).forEach((id) => {
      const el = this.skillRows.get(id);
      if (el) el.textContent = String(player.skills[id].level);
    });

    // Hitpoints (always-on bar)
    const pct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    this.hpFill.style.width = `${pct * 100}%`;
    this.hpText.textContent = `${Math.max(0, player.hp)} / ${player.maxHp}`;

    // Character sheet
    const ids = Object.keys(this.content.skills) as SkillId[];
    const total = ids.reduce((sum, id) => sum + player.skills[id].level, 0);
    const combat = Math.round(
      (player.skills.vitality.level +
        player.skills.edge.level +
        player.skills.vigour.level) /
        3,
    );
    this.charCombat.textContent = String(combat);
    this.charTotal.textContent = String(total);
    this.charHp.textContent = `${Math.max(0, player.hp)} / ${player.maxHp}`;

    // Inventory
    for (let i = 0; i < this.invSlots.length; i++) {
      const slot = this.invSlots[i]!;
      const data = player.inventory[i];
      if (!data) {
        slot.className = "inv-slot";
        slot.innerHTML = "";
        slot.title = "";
        continue;
      }
      const def = this.content.items[data.item];
      slot.className = "inv-slot filled";
      slot.style.setProperty("--item-color", ITEM_COLORS[data.item]);
      slot.title = `${def.name} — ${def.description}`;
      slot.innerHTML = `<span class="inv-icon"></span>${
        data.qty > 1 ? `<span class="inv-qty">${data.qty}</span>` : ""
      }`;
    }
  }
}

function panel(className: string): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

function heading(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "hud-heading";
  el.textContent = text;
  return el;
}

function note(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "tab-note";
  el.textContent = text;
  return el;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
