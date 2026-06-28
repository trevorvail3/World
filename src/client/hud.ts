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

import type {
  CombatStyle,
  Content,
  EquipSlot,
  Intent,
  InventorySlot,
  ItemId,
  Player,
  SkillId,
  WorldState,
} from "../core/types.ts";
import type { ContextMenu, MenuItem } from "./contextMenu.ts";
import { itemIconSVG } from "./itemIcon.ts";
import { glyph, iconize } from "./glyph.ts";
import { equipRequirement, evalAchievement } from "../core/worldCore.ts";
import { SkillDetailModal } from "./skillDetail.ts";

// How many lines of history the log keeps (you can scroll back through them).
// The panel itself shows ~7 at a time; older lines stay available above.
const MAX_LOG_LINES = 100;

type TabId =
  | "inventory" | "skills" | "character"
  | "quests" | "factions" | "records" | "settings";

const TABS: { id: TabId; icon: string; title: string }[] = [
  { id: "inventory", icon: "🎒", title: "Pack" },
  { id: "skills", icon: "📜", title: "Skills" },
  { id: "character", icon: "👤", title: "Character" },
  { id: "quests", icon: "📋", title: "Quests" },
  { id: "factions", icon: "🤝", title: "Factions" },
  { id: "records", icon: "🏆", title: "Records" },
  { id: "settings", icon: "⚙️", title: "Settings" },
];

/** A reputation number → a standing word + tone class. */
function standing(rep: number): { word: string; tone: string } {
  // Allied at 50 so each faction's full quest line can actually reach the top
  // tier (their rep rewards cap around there), not just Ashforge.
  if (rep >= 50) return { word: "Allied", tone: "pos" };
  if (rep >= 25) return { word: "Friendly", tone: "pos" };
  if (rep >= 1) return { word: "Warming", tone: "pos" };
  if (rep === 0) return { word: "Neutral", tone: "neutral" };
  if (rep <= -25) return { word: "Hostile", tone: "neg" };
  return { word: "Wary", tone: "neg" };
}

/** The equipment slots the player can fill, in display order. */
const EQUIP_SLOTS: { slot: EquipSlot; name: string }[] = [
  { slot: "mainhand", name: "Weapon" },
  { slot: "offhand", name: "Shield" },
  { slot: "ranged", name: "Bow" },
  { slot: "ammo", name: "Arrows" },
  { slot: "helmet", name: "Helm" },
  { slot: "armor", name: "Body" },
  { slot: "legs", name: "Legs" },
  { slot: "boots", name: "Boots" },
  { slot: "ring", name: "Ring" },
  { slot: "necklace", name: "Amulet" },
  { slot: "cape", name: "Cape" },
  { slot: "mount", name: "Mount" },
  { slot: "companion", name: "Companion" },
];

/** Canon slot strings this UI can wear (matches EquipSlot). */
const WEARABLE = new Set<string>(EQUIP_SLOTS.map((s) => s.slot));

/** Icon + label for each temporary-buff kind, shown in the buff strip. */
const BUFF_DISPLAY: Record<string, { icon: string; label: string }> = {
  melee_acc: { icon: "🎯", label: "Accuracy" },
  ranged_acc: { icon: "🎯", label: "Accuracy" },
  melee_dmg: { icon: "⚔️", label: "Damage" },
  ranged_dmg: { icon: "🏹", label: "Damage" },
  defence: { icon: "🛡️", label: "Defence" },
  gather_speed: { icon: "⛏️", label: "Gathering speed" },
  xp_boost: { icon: "✨", label: "XP boost" },
};

export class Hud {
  private content: Content;
  private skillRows = new Map<SkillId, HTMLElement>();
  private invSlots: HTMLElement[] = [];
  private hpFill!: HTMLElement;
  private hpText!: HTMLElement;
  private goldText!: HTMLElement;
  private vitals!: HTMLElement;
  private runControl!: HTMLElement;
  private runToggle!: HTMLElement;
  private buffStrip!: HTMLElement;
  private skillFills = new Map<SkillId, HTMLElement>();
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
  private styleButtons = new Map<CombatStyle, HTMLElement>();
  private questList?: HTMLElement;
  private factionRows = new Map<string, { rep: HTMLElement; stand: HTMLElement; fill: HTMLElement }>();
  // Records tab: one container, accordion open-state, and a render signature so
  // it only rebuilds when something actually changes (never every frame).
  private recordsEl?: HTMLElement;
  // Accordion open-state; everything starts collapsed so the tab opens as a
  // tidy list of section headers the player expands as they like.
  private openSecs = new Set<string>();
  private recordsSig = "";
  private skillDetail!: SkillDetailModal;
  private lastState: WorldState | null = null;
  private equipCells = new Map<EquipSlot, HTMLElement>();
  private equipStats!: HTMLElement;
  private lastEquipment: Partial<Record<EquipSlot, ItemId>> = {};

  private onReset: () => void;
  private menu: ContextMenu | null;
  private dispatch: (intent: Intent) => void;
  private invData: (InventorySlot | null)[] = [];
  private zoomSlider: HTMLInputElement | null = null;
  private zoomReadout: HTMLElement | null = null;

  constructor(
    root: HTMLElement,
    content: Content,
    onReset: () => void = () => {},
    menu: ContextMenu | null = null,
    dispatch: (intent: Intent) => void = () => {},
    private zoom: { get(): number; set(z: number): void } = { get: () => 1, set: () => {} },
    private onHelp: () => void = () => {},
  ) {
    this.content = content;
    this.onReset = onReset;
    this.menu = menu;
    this.dispatch = dispatch;
    this.skillDetail = new SkillDetailModal(root, content);
    this.build(root);
  }

  private build(root: HTMLElement): void {
    // --- Always-on Hitpoints (top-right, under the minimap) ---
    const vitals = panel("hud-panel hud-vitals");
    vitals.innerHTML = `
      <div class="vitals-label"><span class="vitals-heart">${glyph("heart")}</span><span class="vitals-name">Hitpoints</span> <span class="hp-text">10 / 10</span></div>
      <div class="hp-bar"><div class="hp-fill"></div></div>
      <div class="gold-line"><span class="gold-coin">${iconize("🪙")}</span><span class="gold-text">0</span>g</div>`;
    this.hpFill = vitals.querySelector(".hp-fill") as HTMLElement;
    this.hpText = vitals.querySelector(".hp-text") as HTMLElement;
    this.goldText = vitals.querySelector(".gold-text") as HTMLElement;
    this.vitals = vitals;
    root.appendChild(vitals);

    // --- Run/walk orb (top-right): a boot whose ring drains as energy spends,
    //     the orb itself tinting by state. No separate bar. ---
    const runCtl = document.createElement("div");
    runCtl.className = "hud-control run-control";
    runCtl.innerHTML =
      `<button class="run-toggle" type="button" title="Toggle run / walk"><span class="run-face">${glyph("boot")}</span></button>`;
    this.runToggle = runCtl.querySelector(".run-toggle") as HTMLElement;
    this.runToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dispatch({ type: "TOGGLE_RUN" });
    });
    this.runControl = runCtl;
    root.appendChild(runCtl);

    // --- Active buff chips (top-left) ---
    const topLeft = document.createElement("div");
    topLeft.className = "hud-topleft";
    this.buffStrip = document.createElement("div");
    this.buffStrip.className = "hud-buffs";
    topLeft.appendChild(this.buffStrip);
    root.appendChild(topLeft);

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
      btn.innerHTML = iconize(t.icon);
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
        // OSRS-style: a small button per skill — icon, level, and a thin XP bar
        // along the bottom. The grid matches the Pack tab's footprint.
        const grid = document.createElement("div");
        grid.className = "skill-grid";
        (Object.keys(this.content.skills) as SkillId[]).forEach((sid) => {
          const meta = this.content.skills[sid];
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "skill-cell";
          cell.title = meta.name;
          cell.innerHTML = `
            <span class="sc-icon">${iconize(meta.icon)}</span>
            <span class="sc-lvl">1</span>
            <span class="sc-bar"><span class="sc-fill"></span></span>`;
          cell.addEventListener("click", () => {
            if (this.lastState) this.skillDetail.show(this.lastState, sid);
          });
          this.skillRows.set(sid, cell.querySelector(".sc-lvl") as HTMLElement);
          this.skillFills.set(sid, cell.querySelector(".sc-fill") as HTMLElement);
          grid.appendChild(cell);
        });
        p.appendChild(grid);
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

        // Combat style — picks which combat skill your next kill trains.
        this.styleButtons.clear();
        const styleWrap = document.createElement("div");
        styleWrap.className = "style-select";
        styleWrap.innerHTML = `<div class="style-label">Combat style</div>`;
        const row = document.createElement("div");
        row.className = "style-row";
        const styles: { id: CombatStyle; name: string; icon: string; hint: string }[] = [
          { id: "edge", name: "Edge", icon: "⚔️", hint: "accuracy" },
          { id: "vigour", name: "Vigour", icon: "💪", hint: "damage" },
          { id: "ward", name: "Ward", icon: "🛡️", hint: "defence" },
        ];
        for (const st of styles) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "style-btn";
          b.innerHTML = `<span class="style-ic">${iconize(st.icon)}</span>${st.name}`;
          b.title = `Train ${st.name} — bonus to ${st.hint}`;
          b.addEventListener("click", () => this.dispatch({ type: "SET_STYLE", style: st.id }));
          this.styleButtons.set(st.id, b);
          row.appendChild(b);
        }
        styleWrap.appendChild(row);
        p.appendChild(styleWrap);

        // --- Worn equipment (folded into the Character sheet) ---
        p.appendChild(subhead("Worn"));
        const grid = document.createElement("div");
        grid.className = "equip-grid";
        for (const { slot, name } of EQUIP_SLOTS) {
          const cell = document.createElement("div");
          cell.className = "equip-cell";
          cell.innerHTML = `<div class="equip-slot"></div><span class="equip-name">${name}</span>`;
          const icon = cell.querySelector(".equip-slot") as HTMLElement;
          this.attachLongPress(
            icon,
            (x, y) => this.inspectEquip(slot, x, y),
            () => this.dispatch({ type: "UNEQUIP", equipSlot: slot }),
          );
          this.equipCells.set(slot, icon);
          grid.appendChild(cell);
        }
        p.appendChild(grid);
        this.equipStats = document.createElement("div");
        this.equipStats.className = "equip-stats";
        p.appendChild(this.equipStats);
        p.appendChild(note("Tap a worn piece to take it off. Forge gear at the anvil."));
        break;
      }
      case "quests": {
        const list = document.createElement("div");
        list.className = "quest-list";
        this.questList = list;
        p.appendChild(list);
        break;
      }
      case "factions": {
        for (const f of this.content.factions) {
          const row = document.createElement("div");
          row.className = "faction-block";
          row.title = f.blurb;
          row.innerHTML = `
            <div class="faction-row">
              <span class="faction-ic">${iconize(f.icon)}</span>
              <span class="faction-name">${f.name}</span>
              <span class="faction-stand">Neutral</span>
              <span class="faction-rep">0</span>
            </div>
            <div class="faction-bar"><div class="faction-fill"></div></div>`;
          this.factionRows.set(f.id, {
            rep: row.querySelector(".faction-rep") as HTMLElement,
            stand: row.querySelector(".faction-stand") as HTMLElement,
            fill: row.querySelector(".faction-fill") as HTMLElement,
          });
          p.appendChild(row);
        }
        p.appendChild(note("Standing rises and falls with your deeds and your choices."));
        break;
      }
      case "records": {
        // Companions, achievements and the lore Archive — collections, each in
        // its own collapsible accordion (and every sub-category collapsible too).
        const wrap = document.createElement("div");
        wrap.className = "records";
        this.recordsEl = wrap;
        // One delegated handler for the whole tab: header toggles + companion
        // summon. (Rebuilding the inner HTML never re-binds anything.)
        wrap.addEventListener("click", (e) => {
          const t = (e.target as HTMLElement).closest("[data-toggle],[data-comp]") as HTMLElement | null;
          if (!t) return;
          if (t.dataset.comp) { this.summonCompanion(t.dataset.comp as ItemId); return; }
          const key = t.dataset.toggle!;
          if (this.openSecs.has(key)) this.openSecs.delete(key);
          else this.openSecs.add(key);
          if (this.lastState) this.renderRecords(this.lastState.player, true);
        });
        p.appendChild(wrap);
        break;
      }
      case "settings": {
        // --- Zoom: drag the slider, scroll the wheel, or pinch on a touchscreen. ---
        const zoomRow = document.createElement("div");
        zoomRow.className = "settings-zoom";
        const zoomLabel = document.createElement("div");
        zoomLabel.className = "settings-label";
        const zoomReadout = document.createElement("span");
        zoomReadout.className = "settings-zoom-value";
        zoomLabel.append("Zoom ", zoomReadout);
        const zoomSlider = document.createElement("input");
        zoomSlider.type = "range";
        zoomSlider.className = "settings-slider";
        zoomSlider.min = "0.6";
        zoomSlider.max = "2.4";
        zoomSlider.step = "0.05";
        zoomSlider.value = String(this.zoom.get());
        const syncReadout = (): void => {
          zoomReadout.textContent = `${Math.round(Number(zoomSlider.value) * 100)}%`;
        };
        syncReadout();
        zoomSlider.addEventListener("input", () => {
          this.zoom.set(Number(zoomSlider.value));
          syncReadout();
        });
        zoomRow.append(zoomLabel, zoomSlider);
        p.appendChild(zoomRow);
        this.zoomSlider = zoomSlider;
        this.zoomReadout = zoomReadout;
        p.appendChild(note("Or scroll the mouse wheel — or pinch on a touchscreen — to zoom the world."));
        const help = document.createElement("button");
        help.type = "button";
        help.className = "settings-help";
        help.textContent = "How to play";
        help.title = "Show the controls primer again";
        help.addEventListener("click", () => this.onHelp());
        p.appendChild(help);
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
    // Records renders on demand (not per-frame); refresh it the moment it opens.
    if (this.activeTab === "records" && !this.collapsed && this.lastState) {
      this.renderRecords(this.lastState.player, true);
    }
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
    // Stay pinned to the newest line *unless* the player has scrolled up to
    // read history — then leave their scroll position alone.
    const el = this.logEl;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    el.innerHTML = this.logLines
      .map((l) => `<div class="log-line">${escapeHtml(l)}</div>`)
      .join("");
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }

  /** Active food/potion buffs as chips with a live countdown. */
  private renderBuffs(player: WorldState["player"]): void {
    const now = performance.now();
    const entries = Object.entries(player.buffs).filter(([, b]) => b.until > now);
    if (entries.length === 0) {
      if (this.buffStrip.childElementCount) this.buffStrip.innerHTML = "";
      return;
    }
    this.buffStrip.innerHTML = entries
      .map(([kind, b]) => {
        const secs = Math.max(0, Math.round((b.until - now) / 1000));
        const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
        const meta = BUFF_DISPLAY[kind] ?? { icon: "✨", label: kind };
        const amt = kind === "xp_boost" || kind === "gather_speed"
          ? `+${Math.round(b.amount * 100)}%`
          : `+${b.amount}`;
        return `<div class="buff-chip" title="${meta.label} ${amt}"><span class="buff-ic">${iconize(meta.icon)}</span><span class="buff-amt">${amt}</span><span class="buff-time">${time}</span></div>`;
      })
      .join("");
  }

  /** A short tap on a slot: eat food, wear gear, otherwise just inspect it. */
  private tapItem(index: number, screenX: number, screenY: number): void {
    const data = this.invData[index];
    if (!data) return;
    const def = this.content.items[data.item];
    if (def.heals || def.buff) {
      this.dispatch({ type: "EAT", slot: index });
    } else if (def.slot && WEARABLE.has(def.slot)) {
      this.dispatch({ type: "EQUIP", slot: index });
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
    if (def.heals || def.buff) {
      items.push({
        label: def.buff && !def.heals ? "Drink" : "Eat",
        target: def.name,
        tone: "action",
        onSelect: () => this.dispatch({ type: "EAT", slot: index }),
      });
    }
    if (def.slot && WEARABLE.has(def.slot)) {
      items.push({
        label: "Equip",
        target: def.name,
        tone: "action",
        onSelect: () => this.dispatch({ type: "EQUIP", slot: index }),
      });
    }
    this.menu.show(screenX, screenY, def.name, items, this.gearDesc(data.item));
  }

  /** Gear tooltip: stat line plus any level requirement to wield it. */
  private gearDesc(id: ItemId): string {
    const def = this.content.items[id];
    const base = gearLine(def) || def.description;
    const req = equipRequirement(this.content, id);
    if (!req) return base;
    const what = req.skill === "combat" ? "Combat" : this.content.skills[req.skill].name;
    return `${base} · Requires ${what} ${req.level}`;
  }

  /** Long-press a worn slot to inspect it, with the option to take it off. */
  private inspectEquip(slot: EquipSlot, screenX: number, screenY: number): void {
    if (!this.menu) return;
    const id = this.lastEquipment[slot];
    if (!id) return;
    const def = this.content.items[id];
    this.menu.show(
      screenX,
      screenY,
      def.name,
      [
        {
          label: "Unequip",
          target: def.name,
          tone: "action",
          onSelect: () => this.dispatch({ type: "UNEQUIP", equipSlot: slot }),
        },
      ],
      this.gearDesc(id),
    );
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
    this.lastState = state;

    this.renderBuffs(player);

    // Keep the zoom slider in step with wheel/pinch changes (unless the player
    // is actively dragging it, in which case it's already the source of truth).
    if (this.zoomSlider && document.activeElement !== this.zoomSlider) {
      const z = this.zoom.get();
      if (Number(this.zoomSlider.value) !== z) {
        this.zoomSlider.value = String(z);
        if (this.zoomReadout) this.zoomReadout.textContent = `${Math.round(z * 100)}%`;
      }
    }

    // Skills: level + progress-to-next-level bar.
    const table = this.content.xpForLevel;
    (Object.keys(this.content.skills) as SkillId[]).forEach((id) => {
      const s = player.skills[id];
      const el = this.skillRows.get(id);
      if (el) el.textContent = String(s.level);
      const fill = this.skillFills.get(id);
      if (fill) {
        const cur = table[s.level] ?? 0;
        const next = table[s.level + 1];
        const pct = next && next > cur ? (s.xp - cur) / (next - cur) : 1;
        fill.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
      }
      // Rich hover on the cell: "Mining · Lv 7 · 1,240 / 1,833 xp".
      const cell = el?.parentElement;
      if (cell) {
        const meta = this.content.skills[id];
        const next = table[s.level + 1];
        const xpLine = next ? `${Math.floor(s.xp).toLocaleString()} / ${next.toLocaleString()} xp` : "max level";
        cell.title = `${meta.name} · Lv ${s.level} · ${xpLine}`;
      }
    });

    if (this.activeTab === "records") this.renderRecords(player);

    // Faction standings.
    for (const f of this.content.factions) {
      const els = this.factionRows.get(f.id);
      if (!els) continue;
      const rep = player.reputation[f.id] ?? 0;
      const s = standing(rep);
      els.rep.textContent = rep > 0 ? `+${rep}` : String(rep);
      els.stand.textContent = s.word;
      els.stand.className = `faction-stand ${s.tone}`;
      // Bar fills right for positive standing, capped at +100; empty when ≤ 0.
      els.fill.style.width = `${Math.max(0, Math.min(1, rep / 100)) * 100}%`;
      els.fill.className = `faction-fill ${s.tone}`;
    }

    // Hitpoints (always-on bar) + low-HP warning.
    const pct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    this.hpFill.style.width = `${pct * 100}%`;
    this.hpText.textContent = `${Math.max(0, player.hp)} / ${player.maxHp}`;
    this.goldText.textContent = player.gold.toLocaleString();
    this.vitals.classList.toggle("low", player.alive && pct <= 0.35);

    // Run/walk: bar width, percentage, on/off and low-energy styling.
    // Run orb: the ring depletes with energy (a CSS var drives the conic fill),
    // and the orb tints by state (running / low / spent).
    const energy = Math.round(player.energy);
    this.runToggle.style.setProperty("--e", String(energy));
    this.runToggle.title = `${player.running ? "Running" : "Walking"} · ${energy}% energy`;
    this.runControl.classList.toggle("on", player.running && player.energy > 0);
    this.runControl.classList.toggle("spent", player.energy <= 0);
    this.runControl.classList.toggle("low", energy <= 25 && player.energy > 0);

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
    this.styleButtons.forEach((btn, id) => {
      btn.classList.toggle("active", id === player.combatStyle);
    });

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
      slot.title = `${def.name} — ${def.description}`;
      slot.innerHTML = `<span class="inv-icon">${itemIconSVG(def)}</span>${
        data.qty > 1 ? `<span class="inv-qty">${data.qty}</span>` : ""
      }`;
    }

    // Equipment: fill worn slots, and total the bonuses underneath.
    this.lastEquipment = player.equipment;
    let acc = 0;
    let dmg = 0;
    let def = 0;
    this.equipCells.forEach((icon, slot) => {
      const id = player.equipment[slot];
      if (id) {
        const item = this.content.items[id];
        acc += item.acc ?? 0;
        dmg += item.dmg ?? 0;
        def += item.def ?? 0;
        icon.className = "equip-slot filled";
        icon.innerHTML = itemIconSVG(item);
        icon.title = `${item.name} — ${item.description}`;
        // The quiver shows how many arrows are nocked.
        if (slot === "ammo" && player.quiver > 0) {
          icon.innerHTML += `<span class="equip-qty">${player.quiver}</span>`;
          icon.title = `${item.name} — ${player.quiver} nocked`;
        }
      } else {
        icon.className = "equip-slot";
        icon.innerHTML = "";
        icon.title = "";
      }
    });
    if (this.equipStats) {
      this.equipStats.textContent = `Acc +${acc}  ·  Dmg +${dmg}  ·  Def +${def}`;
    }

    // Quests
    if (this.questList) this.renderQuests(player);
  }

  /** Rebuild the quest log from the player's active + completed quests. */
  private renderQuests(player: WorldState["player"]): void {
    if (!this.questList) return;
    const quests = this.content.quests;
    const active = Object.keys(player.quests);
    const parts: string[] = [];

    if (active.length) {
      parts.push(`<div class="quest-h">Active</div>`);
      for (const id of active) {
        const def = quests.find((q) => q.id === id);
        if (!def) continue;
        const st = player.quests[id]!;
        const obj = def.steps[st.step];
        let line = obj ? escapeHtml(obj.text) : "";
        if (obj && obj.type === "kill") line += ` <span class="quest-prog">(${st.killCount}/${obj.count})</span>`;
        parts.push(
          `<div class="quest-item"><div class="quest-name">${escapeHtml(def.name)}</div><div class="quest-obj">▸ ${line}</div></div>`,
        );
      }
    }

    if (player.questsDone.length) {
      parts.push(`<div class="quest-h">Completed</div>`);
      for (const id of player.questsDone) {
        const def = quests.find((q) => q.id === id);
        if (def) parts.push(`<div class="quest-done">✓ ${escapeHtml(def.name)}</div>`);
      }
    }

    if (!parts.length) {
      parts.push(note("No quests yet. Talk to the folk you meet — a marker means they've something to ask.").outerHTML);
    }
    this.questList.innerHTML = parts.join("");
  }

  private summonCompanion(id: ItemId): void {
    const player = this.lastState?.player;
    if (!player) return;
    if (player.equipment.companion === id) {
      this.dispatch({ type: "UNEQUIP", equipSlot: "companion" });
      return;
    }
    const idx = player.inventory.findIndex((s) => s?.item === id);
    if (idx >= 0) {
      this.dispatch({ type: "EQUIP", slot: idx });
    } else if ((player.bank[id] ?? 0) > 0) {
      this.dispatch({ type: "WITHDRAW", item: id });
      this.log("Brought it to your pack — tap again to summon it.");
    }
  }

  /**
   * The Records tab: Companions, Achievements and the lore Archive, each a
   * collapsible accordion (and every sub-category collapsible too). Rendered on
   * demand — only when the data or the open/closed set actually changes — so it
   * never churns every frame, keeps its scroll position, and stays responsive.
   */
  private renderRecords(player: Player, force = false): void {
    if (!this.recordsEl) return;
    const items = this.content.items;
    const comps = (Object.keys(items) as ItemId[]).filter((id) => items[id].slot === "companion");
    const ownedOf = (id: ItemId): boolean =>
      player.equipment.companion === id ||
      player.inventory.some((s) => s?.item === id) ||
      (player.bank[id] ?? 0) > 0;
    const compOwned = comps.filter(ownedOf).length;
    const achTotal = this.content.achievements.length;
    const loreTotal = this.content.lore.length;

    // Rebuild only on a real change (counts, summoned pet, or which sections are
    // open). This is what stops the per-frame churn that froze the tab.
    const sig = [
      compOwned, player.equipment.companion ?? "",
      player.achievements.length, achTotal, player.lore.length, loreTotal,
      [...this.openSecs].sort().join(","),
    ].join("|");
    if (!force && sig === this.recordsSig) return;
    this.recordsSig = sig;

    const chev = (open: boolean): string => `<span class="rec-chev">${open ? "▾" : "▸"}</span>`;

    // Companions: a grid of owned (tappable) / locked cells.
    const compBody =
      `<div class="companion-grid">${comps.map((id) => {
        const def = items[id];
        const owned = ownedOf(id);
        const isActive = player.equipment.companion === id;
        const title = owned
          ? `${def.name}${isActive ? " (summoned)" : ""} — ${def.description}`
          : "An undiscovered companion. Keep training.";
        return `<button type="button" class="comp-cell ${owned ? "owned" : "locked"}${isActive ? " active" : ""}" title="${escapeHtml(title)}"${owned ? ` data-comp="${id}"` : ""}><span class="comp-ic">${owned ? itemIconSVG(def) : iconize("❓")}</span>${isActive ? `<span class="comp-star">★</span>` : ""}</button>`;
      }).join("")}</div>` +
      `<div class="tab-note">Companions turn up while you train their skill. Tap one to summon it.</div>`;

    // A category sub-accordion shared by Achievements and Archive.
    const subSection = (key: string, label: string, count: string, rows: () => string): string => {
      const open = this.openSecs.has(key);
      return `<div class="rec-sub ${open ? "open" : ""}"><button type="button" class="rec-subhead" data-toggle="${key}">${chev(open)}<span class="rec-subname">${escapeHtml(label)}</span><span class="rec-count">${count}</span></button>${open ? `<div class="rec-subbody">${rows()}</div>` : ""}</div>`;
    };

    // Achievements, grouped by category, each category collapsible.
    const achCats: string[] = [];
    for (const a of this.content.achievements) if (!achCats.includes(a.category)) achCats.push(a.category);
    const achBody = achCats.map((cat) => {
      const rows = this.content.achievements.filter((x) => x.category === cat);
      const done = rows.filter((a) => player.achievements.includes(a.id)).length;
      return subSection(`ach:${cat}`, cat, `${done}/${rows.length}`, () =>
        rows.map((a) => {
          const isDone = player.achievements.includes(a.id);
          const ev = evalAchievement(player, this.content, a.cond);
          const right = isDone
            ? `<span class="achieve-check">✓</span>`
            : ev.target > 1
              ? `<span class="achieve-prog">${Math.min(ev.cur, ev.target).toLocaleString()} / ${ev.target.toLocaleString()}</span>`
              : `<span class="achieve-lock">${iconize("🔒")}</span>`;
          return `<div class="achieve-row ${isDone ? "done" : ""}"><span class="achieve-ic">${iconize(isDone ? a.icon : "🔒")}</span><span class="achieve-info"><span class="achieve-name">${escapeHtml(a.name)}</span><span class="achieve-desc">${escapeHtml(a.desc)}</span></span>${right}</div>`;
        }).join(""));
    }).join("");

    // Archive (found lore), grouped by thread, each thread collapsible.
    const found = new Set(player.lore);
    const loreCats: string[] = [];
    for (const l of this.content.lore) if (!loreCats.includes(l.category)) loreCats.push(l.category);
    const loreBody = loreCats.map((cat) => {
      const rows = this.content.lore.filter((x) => x.category === cat);
      const have = rows.filter((l) => found.has(l.id)).length;
      return subSection(`lore:${cat}`, cat, `${have}/${rows.length}`, () =>
        rows.map((l) =>
          found.has(l.id)
            ? `<div class="lore-row done"><span class="lore-ic">${iconize("📖")}</span><span class="lore-info"><span class="lore-name">${escapeHtml(l.title)}</span><span class="lore-snip">${escapeHtml(l.text[0] ?? "")}</span></span></div>`
            : `<div class="lore-row"><span class="lore-ic">${iconize("🔒")}</span><span class="lore-info"><span class="lore-name">Undiscovered</span><span class="lore-snip">Somewhere in Varath, still waiting to be read.</span></span></div>`,
        ).join(""));
    }).join("");

    // The three top-level sections.
    const section = (key: string, title: string, count: string, body: string): string => {
      const open = this.openSecs.has(key);
      return `<div class="rec-sec ${open ? "open" : ""}"><button type="button" class="rec-head" data-toggle="${key}">${chev(open)}<span class="rec-secname">${title}</span><span class="rec-count">${count}</span></button>${open ? `<div class="rec-body">${body}</div>` : ""}</div>`;
    };

    this.recordsEl.innerHTML =
      section("companions", "Companions", `${compOwned}/${comps.length}`, compBody) +
      section("achievements", "Achievements", `${player.achievements.length}/${achTotal}`, achBody) +
      section("archive", "Archive", `${player.lore.length}/${loreTotal}`, loreBody);
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

/** A small section divider within a tab (e.g. "Worn", "Companions"). */
function subhead(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "tab-subhead";
  el.textContent = text;
  return el;
}

/** Friendly slot names for inspect lines. */
const SLOT_LABEL: Record<string, string> = {
  mainhand: "Weapon",
  offhand: "Shield",
  helmet: "Helm",
  armor: "Body",
  legs: "Legs",
  boots: "Boots",
  ring: "Ring",
  necklace: "Amulet",
  cape: "Cape",
};

/** A one-line "Weapon · +2 damage" summary for a piece of gear (or ""). */
function gearLine(def: {
  slot?: string;
  acc?: number;
  dmg?: number;
  def?: number;
  tool?: "hatchet" | "pickaxe" | "rod";
}): string {
  // Tools live in the mainhand but read as tools, not weapons.
  if (def.tool) {
    const kind = def.tool === "rod" ? "Fishing rod" : def.tool[0]!.toUpperCase() + def.tool.slice(1);
    return `${kind} · wielded in hand`;
  }
  if (!def.slot || !(def.slot in SLOT_LABEL)) return "";
  const bits: string[] = [];
  if (def.acc) bits.push(`+${def.acc} accuracy`);
  if (def.dmg) bits.push(`+${def.dmg} damage`);
  if (def.def) bits.push(`+${def.def} defence`);
  const where = SLOT_LABEL[def.slot]!;
  return bits.length ? `${where} · ${bits.join(", ")}` : where;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
