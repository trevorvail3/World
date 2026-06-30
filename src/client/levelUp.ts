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

type Celebration =
  | { kind: "level"; skill: SkillId; level: number }
  | { kind: "champion"; species: string; weight: number; needsPrize: boolean };

export class LevelUp {
  private el: HTMLElement;
  private queue: Celebration[] = [];
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
    this.queue.push({ kind: "level", skill, level });
    if (!this.showing) this.next();
  }

  /** Queue the big "you topped the pier" announcement (a record-breaking catch).
   *  `needsPrize` adds the call-to-action to collect the Golden Rod from Jacob. */
  champion(species: string, weight: number, needsPrize: boolean): void {
    this.queue.push({ kind: "champion", species, weight, needsPrize });
    if (!this.showing) this.next();
  }

  private next(): void {
    const item = this.queue.shift();
    if (!item) { this.showing = false; return; }
    this.showing = true;
    if (item.kind === "champion") {
      this.el.classList.add("levelup-champion");
      this.el.innerHTML = `
        <div class="levelup-eyebrow">★ Pier Record ★</div>
        <div class="levelup-row">
          <span class="levelup-icon">${iconize("🏆")}</span>
          <div>
            <div class="levelup-skill">${esc(item.species)}</div>
            <div class="levelup-level">${item.weight.toFixed(1)} kg — the pier's heaviest catch!</div>
          </div>
        </div>
        ${item.needsPrize ? `<div class="levelup-unlock">See <b>Jacob</b> at the pier to claim the <b>Golden Rod of Varath</b>.</div>` : ""}`;
    } else {
      this.el.classList.remove("levelup-champion");
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
    }
    this.el.classList.remove("hidden");
    // restart the entry animation
    this.el.classList.remove("show");
    void this.el.offsetWidth;
    this.el.classList.add("show");
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.dismiss(), item.kind === "champion" ? 5200 : 3000);
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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
