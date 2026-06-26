/**
 * src/client/bountyUI.ts
 * ----------------------
 * The Bounty board window. Three parts:
 *   1. Guides — pick which task-giver you're dealing with (locked until you
 *      reach their Bounty level).
 *   2. The contract — your current task with live progress, or a "Take a task"
 *      button when the board is free; plus Claim / Abandon.
 *   3. The Hunt-Marks shop — spend the marks tasks pay out.
 *
 * It only sends BOUNTY_* intents; the core moves marks, XP and goods (RULE 2),
 * and the modal re-reads live state after each one.
 */

import type { Content, Intent, ItemId, WorldState } from "../core/types.ts";
import { itemIconSVG } from "./itemIcon.ts";
import { iconize } from "./glyph.ts";

export class BountyUI {
  private backdrop: HTMLElement;
  private body: HTMLElement;
  private open = false;
  private state: WorldState | null = null;

  constructor(
    root: HTMLElement,
    private content: Content,
    private dispatch: (intent: Intent) => void,
  ) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "shop-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="shop-modal bounty-modal">
        <div class="shop-head">
          <span class="shop-title"><span class="title-ic">${iconize("🎯")}</span> Bounty Board</span>
          <span class="bounty-marks">0 <span class="mark-ic">${iconize("🎯")}</span></span>
          <button class="shop-close" type="button">✕</button>
        </div>
        <div class="bounty-body"></div>
      </div>`;
    this.body = this.backdrop.querySelector(".bounty-body") as HTMLElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".shop-close") as HTMLElement).addEventListener(
      "pointerdown",
      (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  show(state: WorldState): void {
    this.state = state;
    this.open = true;
    this.backdrop.classList.remove("hidden");
    this.render();
  }

  close(): void {
    this.open = false;
    this.backdrop.classList.add("hidden");
  }

  private monsterName(id: string): string {
    return this.content.monsters[id]?.name ?? id;
  }

  private render(): void {
    if (!this.state) return;
    const { player } = this.state;
    const b = player.bounty;
    const level = player.skills.bounty?.level ?? 1;
    (this.backdrop.querySelector(".bounty-marks") as HTMLElement).innerHTML =
      `${b.marks.toLocaleString()} <span class="mark-ic">${iconize("🎯")}</span>`;

    const guide = this.content.bountyGuides.find((g) => g.id === b.guideId)
      ?? this.content.bountyGuides[0];

    // --- 1) Guide picker ---
    let html = `<div class="bounty-section-label">Guides</div><div class="bounty-guides">`;
    for (const g of this.content.bountyGuides) {
      const locked = level < g.levelReq;
      const active = guide && g.id === guide.id;
      html += `
        <button class="bounty-guide${active ? " active" : ""}${locked ? " locked" : ""}"
                data-guide="${g.id}" type="button"
                title="${g.title} — ${g.desc}${locked ? ` (needs Bounty ${g.levelReq})` : ""}">
          <span class="bounty-guide-icon">${iconize(g.icon)}</span>
          <span class="bounty-guide-name">${g.name}</span>
          <span class="bounty-guide-sub">${locked ? `<span class="bounty-lock">${iconize("🔒")}</span> Lv ${g.levelReq}` : g.title}</span>
        </button>`;
    }
    html += `</div>`;

    // --- 2) The contract ---
    html += `<div class="bounty-section-label">Contract</div>`;
    if (b.task) {
      const t = b.task;
      const done = t.progress >= t.required;
      const pct = Math.min(100, Math.round((t.progress / t.required) * 100));
      html += `
        <div class="bounty-contract">
          <div class="bounty-task-name">Slay ${t.required} ${this.monsterName(t.monster)}</div>
          <div class="bounty-progress"><div class="bounty-progress-fill" style="width:${pct}%"></div></div>
          <div class="bounty-task-count">${t.progress} / ${t.required}${done ? " — ready to claim" : ""}</div>
          <div class="bounty-task-rewards">Reward: +${t.marks} Hunt Marks · +${t.xp.toLocaleString()} Bounty XP</div>
          <div class="bounty-actions">
            <button class="bounty-btn bounty-claim${done ? "" : " disabled"}" type="button">Claim</button>
            <button class="bounty-btn bounty-abandon" type="button">Abandon</button>
          </div>
        </div>`;
    } else {
      const canTake = guide && level >= guide.levelReq;
      html += `
        <div class="bounty-contract">
          <div class="bounty-empty">No active task. ${
            canTake
              ? `${guide!.name} has work for you.`
              : `Reach Bounty ${guide?.levelReq ?? 1} to take work from ${guide?.name ?? "this guide"}.`
          }</div>
          <div class="bounty-actions">
            <button class="bounty-btn bounty-take${canTake ? "" : " disabled"}" type="button">Take a task</button>
          </div>
        </div>`;
    }

    // --- 3) Hunt-Marks shop ---
    html += `<div class="bounty-section-label">Hunt-Marks Shop</div><div class="bounty-shop">`;
    for (const line of this.content.bountyShop) {
      const def = this.content.items[line.item];
      if (!def) continue;
      const afford = b.marks >= line.cost;
      const bundle = line.qty > 1 ? ` ×${line.qty}` : "";
      html += `
        <div class="bounty-shop-row">
          <span class="bounty-shop-swatch">${itemIconSVG(def)}</span>
          <span class="bounty-shop-info">
            <span class="bounty-shop-name">${line.label}${bundle}</span>
            <span class="bounty-shop-desc">${line.desc}</span>
          </span>
          <button class="bounty-buy${afford ? "" : " disabled"}" data-item="${line.item}" type="button">${line.cost} <span class="mark-ic">${iconize("🎯")}</span></button>
        </div>`;
    }
    html += `</div>`;

    this.body.innerHTML = html;
    this.wire();
  }

  /** Attach handlers after each (re)render. */
  private wire(): void {
    for (const el of Array.from(this.body.querySelectorAll<HTMLElement>(".bounty-guide:not(.locked)"))) {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const id = el.dataset["guide"];
        // Selecting a guide with no task takes a task from them; otherwise it
        // just switches the highlighted guide (the core guards the rest).
        if (id) this.act({ type: "BOUNTY_TASK", guideId: id });
      });
    }
    const take = this.body.querySelector(".bounty-take:not(.disabled)") as HTMLElement | null;
    if (take) take.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const gid = this.state?.player.bounty.guideId ?? this.content.bountyGuides[0]?.id ?? "rook";
      this.act({ type: "BOUNTY_TASK", guideId: gid });
    });
    const claim = this.body.querySelector(".bounty-claim:not(.disabled)") as HTMLElement | null;
    if (claim) claim.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.act({ type: "BOUNTY_CLAIM" });
    });
    const abandon = this.body.querySelector(".bounty-abandon") as HTMLElement | null;
    if (abandon) abandon.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.act({ type: "BOUNTY_ABANDON" });
    });
    for (const el of Array.from(this.body.querySelectorAll<HTMLElement>(".bounty-buy:not(.disabled)"))) {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const item = el.dataset["item"];
        if (item) this.act({ type: "BOUNTY_BUY", item: item as ItemId });
      });
    }
  }

  private act(intent: Intent): void {
    this.dispatch(intent);
    this.render();
  }
}
