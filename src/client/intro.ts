/**
 * src/client/intro.ts
 * -------------------
 * The opening atmosphere sequence, shown once the player taps "Enter the
 * World." Dark-fantasy mood lives or dies in the first fifteen seconds, so
 * this is just light, vignette, and one line of text at a time — no UI, no
 * mechanics. It fades line to line, then dissolves into the world.
 *
 * Skippable (tap to advance, or the Skip button). Pure presentation.
 */

export class Intro {
  private el: HTMLElement;
  private lineEl: HTMLElement;
  private lines: string[];
  private idx = 0;
  private timer: number | null = null;
  private finished = false;
  private onDone: () => void;

  constructor(root: HTMLElement, lines: string[], onDone: () => void) {
    this.lines = lines.length ? lines : ["..."];
    this.onDone = onDone;

    this.el = document.createElement("div");
    this.el.className = "intro-screen";
    this.el.innerHTML = `
      <div class="intro-glow"></div>
      <div class="intro-line"></div>
      <button class="intro-skip" type="button">Skip ›</button>
      <div class="intro-hint">tap to continue</div>`;
    this.lineEl = this.el.querySelector(".intro-line") as HTMLElement;
    root.appendChild(this.el);

    this.el.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).classList.contains("intro-skip")) return;
      this.advance();
    });
    const skip = this.el.querySelector(".intro-skip") as HTMLElement;
    skip.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.finish();
    });

    // Let the backdrop settle, then bring up the first line.
    window.setTimeout(() => this.showLine(), 120);
  }

  private showLine(): void {
    this.lineEl.textContent = this.lines[this.idx] ?? "";
    this.lineEl.classList.add("show");
    this.clearTimer();
    this.timer = window.setTimeout(() => this.advance(), 4200);
  }

  private advance(): void {
    if (this.finished) return;
    this.clearTimer();
    this.lineEl.classList.remove("show"); // fade the current line out
    window.setTimeout(() => {
      this.idx++;
      if (this.idx >= this.lines.length) {
        this.finish();
      } else {
        this.showLine();
      }
    }, 650);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.clearTimer();
    this.el.classList.add("leaving");
    window.setTimeout(() => {
      this.el.remove();
      this.onDone();
    }, 850);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
