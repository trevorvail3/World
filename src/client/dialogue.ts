/**
 * src/client/dialogue.ts
 * ----------------------
 * A small OSRS-style dialogue box. When the core reports a DIALOGUE event,
 * the client opens this and steps through the lines. Pure presentation.
 */

export class Dialogue {
  private box: HTMLElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private hintEl: HTMLElement;
  private lines: string[] = [];
  private index = 0;
  private open = false;

  constructor(root: HTMLElement) {
    this.box = document.createElement("div");
    this.box.className = "dialogue hidden";
    this.box.innerHTML = `
      <div class="dialogue-name"></div>
      <div class="dialogue-text"></div>
      <div class="dialogue-hint">Tap to continue ▾</div>`;
    this.nameEl = this.box.querySelector(".dialogue-name") as HTMLElement;
    this.textEl = this.box.querySelector(".dialogue-text") as HTMLElement;
    this.hintEl = this.box.querySelector(".dialogue-hint") as HTMLElement;
    // Tapping the box itself advances it — otherwise the tap lands on this HTML
    // overlay (not the canvas) and the "Tap to continue" prompt does nothing.
    this.box.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.advance();
    });
    root.appendChild(this.box);
  }

  isOpen(): boolean {
    return this.open;
  }

  show(npc: string, lines: string[]): void {
    this.lines = lines.length ? lines : ["..."];
    this.index = 0;
    this.open = true;
    this.nameEl.textContent = npc;
    this.box.classList.remove("hidden");
    this.render();
  }

  /** Advance to the next line, or close on the last one. */
  advance(): void {
    if (!this.open) return;
    this.index++;
    if (this.index >= this.lines.length) {
      this.close();
    } else {
      this.render();
    }
  }

  close(): void {
    this.open = false;
    this.box.classList.add("hidden");
  }

  private render(): void {
    this.textEl.textContent = this.lines[this.index] ?? "";
    const last = this.index >= this.lines.length - 1;
    this.hintEl.textContent = last ? "Tap to close ▾" : "Tap to continue ▾";
  }
}
