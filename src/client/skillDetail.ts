/**
 * src/client/skillDetail.ts
 * -------------------------
 * A popup for one skill: its level + XP, and its "ladder" — every unlock at the
 * level it needs, derived from the skill's actions (levelReq → what it makes),
 * so a player can see the whole path. Pure presentation; it only reads state.
 */

import type { Content, SkillId, WorldState } from "../core/types.ts";

/** How the action-less skills are trained (no recipe ladder of their own). */
const TRAIN_NOTE: Partial<Record<SkillId, string>> = {
  vitality: "Trained by taking blows in combat — your health and max HP.",
  edge: "Trained on the Edge style: melee accuracy.",
  vigour: "Trained on the Vigour style: melee damage.",
  ward: "Trained on the Ward style: melee defence.",
  draw: "Trained by ranged attacks.",
  farming: "Sowing and harvesting crops — arriving in a later update.",
  bounty: "Completing bounties — arriving in a later update.",
};

export class SkillDetailModal {
  private backdrop: HTMLElement;
  private body: HTMLElement;
  private open = false;

  constructor(root: HTMLElement, private content: Content) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "skilldetail-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="skilldetail-modal">
        <div class="skilldetail-head">
          <span class="skilldetail-title">Skill</span>
          <button class="skilldetail-close" type="button">✕</button>
        </div>
        <div class="skilldetail-body"></div>
      </div>`;
    this.body = this.backdrop.querySelector(".skilldetail-body") as HTMLElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".skilldetail-close") as HTMLElement).addEventListener(
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

  close(): void {
    this.open = false;
    this.backdrop.classList.add("hidden");
  }

  show(state: WorldState, skill: SkillId): void {
    const meta = this.content.skills[skill];
    const s = state.player.skills[skill];
    const table = this.content.xpForLevel;
    (this.backdrop.querySelector(".skilldetail-title") as HTMLElement).innerHTML =
      `${meta.icon} ${meta.name}`;

    const cur = table[s.level] ?? 0;
    const next = table[s.level + 1];
    const pct = next && next > cur ? (s.xp - cur) / (next - cur) : 1;
    const xpLine = next
      ? `${Math.floor(s.xp).toLocaleString()} / ${next.toLocaleString()} xp`
      : "max level";

    let html = `
      <div class="sd-level">Level <b>${s.level}</b> · ${xpLine}</div>
      <div class="sd-xpbar"><div class="sd-xpfill" style="width:${Math.max(0, Math.min(1, pct)) * 100}%"></div></div>`;

    // The ladder: group this skill's actions by the level they unlock at.
    const byLevel = new Map<number, string[]>();
    for (const a of this.content.actions) {
      if (a.skill !== skill) continue;
      const list = byLevel.get(a.levelReq) ?? [];
      if (!list.includes(a.name)) list.push(a.name);
      byLevel.set(a.levelReq, list);
    }
    const rungs = [...byLevel.entries()].sort((a, b) => a[0] - b[0]);

    if (rungs.length === 0) {
      html += `<div class="sd-note">${TRAIN_NOTE[skill] ?? "Trained through play."}</div>`;
    } else {
      html += `<div class="sd-laddertitle">Unlocks</div><div class="sd-ladder">`;
      let nextMarked = false;
      for (const [lvl, names] of rungs) {
        const unlocked = s.level >= lvl;
        let cls = unlocked ? "done" : "locked";
        if (!unlocked && !nextMarked) { cls = "next"; nextMarked = true; }
        const mark = unlocked ? "✓" : cls === "next" ? "▶" : "🔒";
        html += `
          <div class="sd-rung ${cls}">
            <span class="sd-rung-lvl">Lv ${lvl}</span>
            <span class="sd-rung-mark">${mark}</span>
            <span class="sd-rung-names">${names.join(", ")}</span>
          </div>`;
      }
      html += `</div>`;
    }

    this.body.innerHTML = html;
    this.open = true;
    this.backdrop.classList.remove("hidden");
  }
}
