/**
 * src/client/levelUp.ts
 * ---------------------
 * The level-up moment — the small OSRS thrill of a skill ticking over. A
 * celebratory card slides in with the skill, the new level, and (if this level
 * opens something) what you can now do. Queued, so a burst of levels plays one
 * after another instead of stomping each other.
 */

import type { Content, SkillId } from "../core/types.ts";
import { iconize } from "./glyph.ts";

export class LevelUp {
  private el: HTMLElement;
  private queue: Array<{ skill: SkillId; level: number }> = [];
  private showing = false;
  private timer: number | null = null;

  constructor(root: HTMLElement, private content: Content) {
    this.el = document.createElement("div");
    this.el.className = "levelup hidden";
    root.appendChild(this.el);
    this.el.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.dismiss(); });
  }

  /** Queue a level-up to celebrate. */
  show(skill: SkillId, level: number): void {
    this.queue.push({ skill, level });
    if (!this.showing) this.next();
  }

  private next(): void {
    const item = this.queue.shift();
    if (!item) { this.showing = false; return; }
    this.showing = true;
    const meta = this.content.skills[item.skill];
    const unlock = this.unlockedAt(item.skill, item.level);
    this.el.innerHTML = `
      <div class="levelup-eyebrow">✦ Level Up ✦</div>
      <div class="levelup-row">
        <span class="levelup-icon">${iconize(meta.icon)}</span>
        <div>
          <div class="levelup-skill">${meta.name}</div>
          <div class="levelup-level">Level ${item.level}</div>
        </div>
      </div>
      ${unlock ? `<div class="levelup-unlock">${unlock}</div>` : ""}`;
    this.el.classList.remove("hidden");
    // restart the entry animation
    this.el.classList.remove("show");
    void this.el.offsetWidth;
    this.el.classList.add("show");
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.dismiss(), 3000);
  }

  private dismiss(): void {
    if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; }
    this.el.classList.remove("show");
    this.el.classList.add("hidden");
    // brief gap before the next queued level, so they read as separate
    window.setTimeout(() => this.next(), 220);
  }

  /** What this exact level opens, phrased for the card (or null). */
  private unlockedAt(skill: SkillId, level: number): string | null {
    const a = this.content.actions.find(
      (x) => x.skill === skill && x.levelReq === level && !!x.produces,
    );
    if (a?.produces) {
      const out = this.content.items[a.produces];
      if (out) return `Unlocked: <b>${out.name}</b>`;
    }
    return null;
  }
}
