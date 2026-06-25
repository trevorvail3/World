/**
 * src/client/hud.ts
 * -----------------
 * The on-screen overlays: skills, HP, the 28-slot inventory and an OSRS-style
 * game log. This is presentation only — it reads the core's state and shows
 * it. It never changes state (RULE 2).
 */

import type { Content, ItemId, SkillId, WorldState } from "../core/types.ts";

const MAX_LOG_LINES = 8;

const ITEM_COLORS: Record<ItemId, string> = {
  ashwood_log: "#8a6a44",
  knucklestone_ore: "#6f7079",
  ashfin_raw: "#5d7488",
  raw_rat_meat: "#9c6b5a",
  raw_hide: "#7a5638",
  rat_tail: "#866a54",
  raw_wolf_meat: "#8a4f44",
  wolf_pelt: "#8f8a7e",
  wolf_fang: "#d8d2c2",
  worn_coin: "#c9a24a",
  shard_of_orun: "#2a2320",
};

export class Hud {
  private content: Content;
  private skillRows = new Map<SkillId, HTMLElement>();
  private invSlots: HTMLElement[] = [];
  private hpFill!: HTMLElement;
  private hpText!: HTMLElement;
  private logEl!: HTMLElement;
  private logLines: string[] = [];

  constructor(root: HTMLElement, content: Content) {
    this.content = content;
    this.build(root);
  }

  private build(root: HTMLElement): void {
    // --- Skills + HP (top-left) ---
    const skillsPanel = panel("hud-panel hud-skills");
    skillsPanel.appendChild(heading("Skills"));
    (Object.keys(this.content.skills) as SkillId[]).forEach((id) => {
      const row = document.createElement("div");
      row.className = "skill-row";
      row.innerHTML = `<span class="skill-name">${this.content.skills[id].name}</span><span class="skill-val">1</span>`;
      this.skillRows.set(id, row.querySelector(".skill-val") as HTMLElement);
      skillsPanel.appendChild(row);
    });

    const hpWrap = document.createElement("div");
    hpWrap.className = "hp-wrap";
    hpWrap.innerHTML = `
      <div class="hp-label">Hitpoints <span class="hp-text">10 / 10</span></div>
      <div class="hp-bar"><div class="hp-fill"></div></div>`;
    this.hpFill = hpWrap.querySelector(".hp-fill") as HTMLElement;
    this.hpText = hpWrap.querySelector(".hp-text") as HTMLElement;
    skillsPanel.appendChild(hpWrap);
    root.appendChild(skillsPanel);

    // --- Inventory (right) ---
    const invPanel = panel("hud-panel hud-inventory");
    invPanel.appendChild(heading("Pack"));
    const grid = document.createElement("div");
    grid.className = "inv-grid";
    for (let i = 0; i < 28; i++) {
      const slot = document.createElement("div");
      slot.className = "inv-slot";
      grid.appendChild(slot);
      this.invSlots.push(slot);
    }
    invPanel.appendChild(grid);
    root.appendChild(invPanel);

    // --- Game log (bottom-left) ---
    const logPanel = panel("hud-panel hud-log");
    this.logEl = document.createElement("div");
    this.logEl.className = "log-lines";
    logPanel.appendChild(this.logEl);
    root.appendChild(logPanel);
  }

  log(message: string): void {
    this.logLines.push(message);
    if (this.logLines.length > MAX_LOG_LINES) this.logLines.shift();
    this.logEl.innerHTML = this.logLines
      .map((l) => `<div class="log-line">${escapeHtml(l)}</div>`)
      .join("");
  }

  update(state: WorldState): void {
    const { player } = state;

    // Skills
    (Object.keys(this.content.skills) as SkillId[]).forEach((id) => {
      const el = this.skillRows.get(id);
      if (el) el.textContent = String(player.skills[id].level);
    });

    // HP
    const pct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    this.hpFill.style.width = `${pct * 100}%`;
    this.hpText.textContent = `${Math.max(0, player.hp)} / ${player.maxHp}`;

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
