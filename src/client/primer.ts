/**
 * src/client/primer.ts
 * --------------------
 * The "How to Play" card — shown once, right after the atmosphere intro, to a
 * brand-new player. The atmosphere sells the mood; this sells the *controls*,
 * because a top-down tap world has three load-bearing interactions a newcomer
 * can't guess: tap to walk, tap to act, hold to inspect. Teach those three and
 * point at the pinned objective, then get out of the way — the contextual guide
 * (guide.ts) takes over from there and teaches systems as they come up.
 *
 * It's also re-openable from Settings, so the controls are never more than a tap
 * away. Pure presentation: it shows text and calls back when dismissed.
 */

import { glyph } from "./glyph.ts";

interface PrimerRow {
  icon: string;
  title: string;
  body: string;
}

const ROWS: PrimerRow[] = [
  { icon: "boot", title: "Move", body: "Tap the ground to walk there. Tap the boot by the map to run." },
  { icon: "target", title: "Act", body: "Tap a person, rock, tree or beast to act on it — talk, mine, chop, fish or fight." },
  { icon: "question", title: "Study", body: "Hold a moment (or right-click) on anything to inspect it and see all its options." },
  { icon: "banner", title: "Your task", body: "Your current goal stays pinned at the top-left, and a gold arrow points the way." },
];

export class Primer {
  private el: HTMLElement;
  private done = false;
  private onDone: () => void;

  /**
   * @param reopen  when true this is a Settings re-open (no atmosphere fade-in,
   *                a plain "Got it" button) rather than the first-run teach.
   */
  constructor(root: HTMLElement, onDone: () => void, reopen = false) {
    this.onDone = onDone;

    const rows = ROWS.map(
      (r) => `
      <div class="primer-row">
        <span class="primer-ic">${glyph(r.icon)}</span>
        <div class="primer-rowtext">
          <div class="primer-rowtitle">${r.title}</div>
          <div class="primer-rowbody">${r.body}</div>
        </div>
      </div>`,
    ).join("");

    this.el = document.createElement("div");
    this.el.className = "primer-screen" + (reopen ? " reopen" : "");
    this.el.innerHTML = `
      <div class="primer-card">
        <div class="primer-eyebrow">The Wayfarer's Primer</div>
        <div class="primer-title">How to Play</div>
        <div class="primer-rows">${rows}</div>
        <div class="primer-foot">Everything else you'll learn as you go.</div>
        <button class="primer-go" type="button">${reopen ? "Got it" : "Step into the hills ›"}</button>
      </div>`;
    root.appendChild(this.el);

    const go = this.el.querySelector(".primer-go") as HTMLElement;
    go.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.finish(); });
    // Tapping the dim backdrop (outside the card) also dismisses.
    this.el.addEventListener("pointerdown", (e) => {
      if (e.target === this.el) this.finish();
    });

    // Bring the card up on the next frame so the fade-in transition runs.
    requestAnimationFrame(() => this.el.classList.add("show"));
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.el.classList.add("leaving");
    window.setTimeout(() => {
      this.el.remove();
      this.onDone();
    }, 360);
  }
}
