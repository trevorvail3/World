/**
 * src/client/guide.ts
 * -------------------
 * A whisper-thin onboarding guide. It does NOT tour the UI or explain systems
 * — it teaches the one interaction loop (look → think → act → the world
 * responds) on a single can't-fail task, and leans on Aldric's coin to pull
 * the player forward with a question rather than a checklist.
 *
 * It only watches the events the core already emits and shows a one-line
 * banner. Presentation only.
 */

import type { WorldEvent } from "../core/types.ts";

export type GuideStep = "off" | "greet" | "hunt" | "done";

const TEXT: Record<Exclude<GuideStep, "off">, string> = {
  greet: "An old man waves you over from the path. Tap Aldric to talk.",
  hunt: "Hold a Moor Rat to study it — then tap to strike. See what it carries.",
  done: "You looked, you thought, you acted — and the hills answered. The coin's riddle is yours now.",
};

export class Guide {
  private banner: HTMLElement;
  private step: GuideStep = "off";
  private hideTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.banner = document.createElement("div");
    this.banner.className = "guide-banner hidden";
    root.appendChild(this.banner);
  }

  get currentStep(): GuideStep {
    return this.step;
  }

  /** Begin the onboarding (call once, for a new player). */
  start(): void {
    this.setStep("greet");
  }

  /** React to a tick's events to advance the guide. */
  onEvents(events: WorldEvent[]): void {
    if (this.step === "off") return;
    for (const e of events) {
      if (this.step === "greet" && e.type === "DIALOGUE" && e.npc === "Aldric") {
        this.setStep("hunt");
      } else if (this.step === "hunt" && e.type === "MONSTER_KILLED") {
        this.setStep("done");
      }
    }
  }

  private setStep(s: GuideStep): void {
    this.step = s;
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (s === "off") {
      this.banner.classList.add("hidden");
      return;
    }
    this.banner.textContent = TEXT[s];
    this.banner.classList.remove("hidden");
    if (s === "done") {
      this.hideTimer = window.setTimeout(() => this.setStep("off"), 7000);
    }
  }
}
