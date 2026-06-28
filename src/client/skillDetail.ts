/**
 * src/client/skillDetail.ts
 * -------------------------
 * A popup for one skill: its level + XP, and its "ladder" — every unlock at the
 * level it needs, derived from the skill's actions (levelReq → what it makes),
 * so a player can see the whole path. Pure presentation; it only reads state.
 */

import type { Content, SkillId, WorldState } from "../core/types.ts";
import { iconize } from "./glyph.ts";

/** Pretty-print a SkillAction group key ("arrows" -> "Arrows"). */
function groupLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
      `<span class="skilldetail-ic">${iconize(meta.icon)}</span> ${meta.name}`;

    const cur = table[s.level] ?? 0;
    const next = table[s.level + 1];
    const pct = next && next > cur ? (s.xp - cur) / (next - cur) : 1;
    const xpLine = next
      ? `${Math.floor(s.xp).toLocaleString()} / ${next.toLocaleString()} xp`
      : "max level";

    // A plain-language explainer at the top: what the skill is and how it trains.
    let html = `
      <div class="sd-blurb">${meta.blurb}</div>
      <div class="sd-level">Level <b>${s.level}</b> · ${xpLine}</div>
      <div class="sd-xpbar"><div class="sd-xpfill" style="width:${Math.max(0, Math.min(1, pct)) * 100}%"></div></div>`;

    // The ladder: group this skill's actions BY ACTIVITY (the action's `group`),
    // then by the level each unlock needs — a separate level ladder per activity.
    const activities = new Map<string, Map<number, string[]>>();
    for (const a of this.content.actions) {
      if (a.skill !== skill) continue;
      // Activity = the action's own group if it has one, else the category of
      // what it produces (Bars, Weapons, Armour…), so a skill's ladder splits
      // into sensible sections instead of one long list.
      const cat = a.produces ? this.content.items[a.produces]?.cat : undefined;
      const act = a.group ? groupLabel(a.group) : cat || "Recipes";
      const byLevel = activities.get(act) ?? new Map<number, string[]>();
      const list = byLevel.get(a.levelReq) ?? [];
      if (!list.includes(a.name)) list.push(a.name);
      byLevel.set(a.levelReq, list);
      activities.set(act, byLevel);
    }

    if (activities.size === 0) {
      // Action-less skills (combat, agility…) have no recipe ladder — the blurb
      // above already explains how they train, so nothing more is needed here.
    } else {
      // Order activities by the lowest level they start at.
      const minLvl = (m: Map<number, string[]>) => Math.min(...m.keys());
      const groups = [...activities.entries()].sort((a, b) => minLvl(a[1]) - minLvl(b[1]));
      const single = groups.length === 1;
      html += `<div class="sd-laddertitle">Unlocks</div>`;
      for (const [name, byLevel] of groups) {
        if (!single) html += `<div class="sd-actgroup">${name}</div>`;
        html += `<div class="sd-ladder">`;
        let nextMarked = false;
        for (const [lvl, names] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
          const unlocked = s.level >= lvl;
          let cls = unlocked ? "done" : "locked";
          if (!unlocked && !nextMarked) { cls = "next"; nextMarked = true; }
          const mark = unlocked ? "✓" : cls === "next" ? "▶" : iconize("🔒");
          html += `
            <div class="sd-rung ${cls}">
              <span class="sd-rung-lvl">Lv ${lvl}</span>
              <span class="sd-rung-mark">${mark}</span>
              <span class="sd-rung-names">${names.join(", ")}</span>
            </div>`;
        }
        html += `</div>`;
      }
    }

    this.body.innerHTML = html;
    this.open = true;
    this.backdrop.classList.remove("hidden");
  }
}
