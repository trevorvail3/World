/**
 * src/client/activeSkill.ts
 * -------------------------
 * The contextual skill bar at the top of the screen. Whatever you're *doing*
 * right now, this pill names it and shows your progress toward the next level:
 * chop a tree and it reads Forestry, mine and it reads Mining, fight and it
 * shows your combat-style skill (Vigour / Edge / Ward, or Draw with a bow).
 * It slides in when an activity starts and fades out a beat after you stop, so
 * it stays out of the way while idle. Pure presentation — it reads live state
 * each frame and never touches the core.
 */

import type { Content, SkillId, WorldState } from "../core/types.ts";
import { iconize } from "./glyph.ts";

export class ActiveSkill {
  private el: HTMLElement;
  private iconEl: HTMLElement;
  private nameEl: HTMLElement;
  private levelEl: HTMLElement;
  private fill: HTMLElement;
  private xpEl: HTMLElement;
  private shown = false;
  private curSkill: SkillId | null = null;
  private hideAt = 0; // ms timestamp to hide at once idle (0 = keep showing)

  constructor(root: HTMLElement, private content: Content) {
    this.el = document.createElement("div");
    this.el.className = "activeskill hidden";
    this.el.innerHTML = `
      <span class="activeskill-icon"></span>
      <div class="activeskill-body">
        <div class="activeskill-top">
          <span class="activeskill-name"></span>
          <span class="activeskill-level"></span>
        </div>
        <div class="activeskill-bar"><div class="activeskill-fill"></div></div>
      </div>
      <span class="activeskill-xp"></span>`;
    root.appendChild(this.el);
    this.iconEl = this.el.querySelector(".activeskill-icon") as HTMLElement;
    this.nameEl = this.el.querySelector(".activeskill-name") as HTMLElement;
    this.levelEl = this.el.querySelector(".activeskill-level") as HTMLElement;
    this.fill = this.el.querySelector(".activeskill-fill") as HTMLElement;
    this.xpEl = this.el.querySelector(".activeskill-xp") as HTMLElement;
  }

  /** Refresh from live state each frame. */
  update(state: WorldState, now: number): void {
    const skill = this.activeSkillOf(state);
    if (skill) {
      this.hideAt = 0;
      this.render(state, skill);
      if (!this.shown) this.reveal();
    } else if (this.shown) {
      // Linger briefly after the activity ends, then fade out — this keeps the
      // bar steady across the tiny idle gaps between swings.
      if (this.hideAt === 0) this.hideAt = now + 1400;
      else if (now >= this.hideAt) this.hide();
    }
  }

  /** Which skill the current activity trains (null if idle / unmapped). */
  private activeSkillOf(state: WorldState): SkillId | null {
    const p = state.player;
    switch (p.activity.kind) {
      case "woodcutting": return "forestry";
      case "mining": return "mining";
      case "fishing": return "fishing";
      case "foraging": return "survivalist";
      case "trapping": return "hunter";
      case "crafting": {
        const id = p.activity.actionId;
        const a = id ? this.content.actions.find((x) => x.id === id) : undefined;
        return a ? a.skill : null;
      }
      case "combat": {
        const main = p.equipment.mainhand;
        if (main && this.content.items[main]?.ranged) return "draw";
        return p.combatStyle === "edge" ? "edge"
          : p.combatStyle === "ward" ? "ward" : "vigour";
      }
      default: return null;
    }
  }

  private render(state: WorldState, skill: SkillId): void {
    const meta = this.content.skills[skill];
    const s = state.player.skills[skill];
    if (skill !== this.curSkill) {
      this.curSkill = skill;
      this.iconEl.innerHTML = iconize(meta.icon);
      this.nameEl.textContent = meta.name;
    }
    this.levelEl.textContent = `Lv ${s.level}`;
    const table = this.content.xpForLevel;
    const cur = table[s.level] ?? 0;
    const next = table[s.level + 1];
    if (next && next > cur) {
      const into = Math.floor(s.xp) - cur;
      const span = next - cur;
      this.fill.style.width = `${Math.max(0, Math.min(1, into / span)) * 100}%`;
      this.xpEl.textContent = `${into.toLocaleString()} / ${span.toLocaleString()}`;
    } else {
      this.fill.style.width = "100%";
      this.xpEl.textContent = "max";
    }
  }

  private reveal(): void {
    this.shown = true;
    this.el.classList.remove("hidden");
    // restart the entry animation
    this.el.classList.remove("show");
    void this.el.offsetWidth;
    this.el.classList.add("show");
  }

  private hide(): void {
    this.shown = false;
    this.hideAt = 0;
    this.el.classList.remove("show");
    this.el.classList.add("hidden");
  }
}
