/**
 * src/client/guide.ts
 * -------------------
 * A contextual onboarding coach. It does NOT tour the whole UI up front — it
 * teaches one system at a time, exactly when the opening quest ("Ash and
 * Knuckle") makes that system matter: talk to a quest-giver, gather and train a
 * skill, use a crafting station, deliver, then graduate into the tabs, the run
 * toggle and combat.
 *
 * It is driven by the world STATE (the player's quest progress), not a fragile
 * count of events, so it always shows the line that matches what the gold arrow
 * is pointing at — and it can never get out of step. The very first interactions
 * (move / act / inspect) are taught by the one-time Primer card before this even
 * starts. Presentation only: it reads state and shows a single banner.
 */

import type { WorldState } from "../core/types.ts";

/** Quest-derived phases, in the order a new player meets them. */
type Phase = "off" | "greet" | "mine" | "smelt" | "deliver" | "graduate";

const FIRST_QUEST = "q_ash_and_knuckle";

// One line per phase. Each names the next action and the system it teaches.
const TEXT: Record<Exclude<Phase, "off" | "graduate">, string> = {
  greet: "Aldric is waving you over — tap him to hear what the old man needs.",
  mine: "Follow the gold arrow and tap the Knucklestone rock. Every swing trains your Mining.",
  smelt: "Ore in hand. Now tap the kiln to smelt it into a bar — your first crafting station.",
  deliver: "Carry the bar back to Aldric. The gold arrow always points to your current task.",
};

// Graduation is a short two-beat sequence: first the chrome, then combat.
const GRAD_UI =
  "Well done — XP and a reward earned. The tabs at the lower-right hold your Skills, Pack and Gear; the boot by the map toggles running.";
const GRAD_COMBAT =
  "The moor's beasts carry rarer things. Hold a creature to study it, then tap to strike — and eat food if your Hitpoints run low.";

export class Guide {
  private banner: HTMLElement;
  private active = false;
  private phase: Phase = "off";
  private graduated = false; // graduation sequence has run (once per session)
  private timers: number[] = [];

  constructor(root: HTMLElement) {
    this.banner = document.createElement("div");
    this.banner.className = "guide-banner hidden";
    root.appendChild(this.banner);
  }

  get currentStep(): Phase {
    return this.phase;
  }

  /** Begin the onboarding (call once, for a brand-new player). */
  start(): void {
    this.active = true;
  }

  /**
   * Re-evaluate against the latest world state. Called every tick; cheap, and
   * only touches the DOM when the phase actually changes.
   */
  update(state: WorldState): void {
    if (!this.active) return;
    const phase = this.derivePhase(state);
    if (phase === this.phase) return;

    // Reaching the end of the first quest plays the graduation sequence once,
    // then the guide retires for good.
    if (phase === "graduate") {
      this.phase = "graduate";
      if (!this.graduated) {
        this.graduated = true;
        this.runGraduation();
      }
      return;
    }

    this.phase = phase;
    this.show(TEXT[phase as Exclude<Phase, "off" | "graduate">]);
  }

  /** Map quest progress onto a teaching phase. */
  private derivePhase(state: WorldState): Phase {
    const p = state.player;
    if (p.questsDone.includes(FIRST_QUEST)) return "graduate";
    const st = p.quests[FIRST_QUEST];
    if (!st) return "greet"; // not yet accepted — go talk to Aldric
    // Steps: 0 mine ore · 1 smelt bar · 2 deliver bar.
    return st.step <= 0 ? "mine" : st.step === 1 ? "smelt" : "deliver";
  }

  /** UI line, then combat line, then fade away for the rest of the game. */
  private runGraduation(): void {
    this.show(GRAD_UI);
    this.after(8000, () => this.show(GRAD_COMBAT));
    this.after(18000, () => this.retire());
  }

  private show(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.remove("hidden");
  }

  private retire(): void {
    this.active = false;
    this.phase = "off";
    this.banner.classList.add("hidden");
    this.clearTimers();
  }

  private after(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private clearTimers(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
  }
}
