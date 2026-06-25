/**
 * src/client/titleScreen.ts
 * -------------------------
 * The opening title screen for Varath World. It is styled to match the
 * companion idle game "Varath" — a warm near-black backdrop, an amber Cinzel
 * wordmark, an italic tagline, and a bronze-gradient entry button.
 *
 * This is pure presentation: it overlays the canvas, and when the player taps
 * "Enter," it fades away and hands control back to the running game. (Account
 * sign-in can be slotted in here later without disturbing the game itself.)
 */

export class TitleScreen {
  private el: HTMLElement;
  private entered = false;

  constructor(root: HTMLElement, onEnter: () => void) {
    this.el = document.createElement("div");
    this.el.className = "title-screen";
    this.el.innerHTML = `
      <div class="title-glow"></div>
      <div class="title-inner">
        <h1 class="title-word">VARATH</h1>
        <div class="title-sub">· &nbsp;THE&nbsp;WORLD&nbsp; ·</div>
        <p class="title-tagline">Walk the world the god's death left behind.</p>
        <button class="title-enter" type="button">Enter the World</button>
        <div class="title-footer">Preview &middot; The Knuckle Hills</div>
      </div>`;
    root.appendChild(this.el);

    const enter = () => this.enter(onEnter);
    const button = this.el.querySelector(".title-enter") as HTMLButtonElement;
    button.addEventListener("click", enter);
    // Also allow pressing Enter/Space on a keyboard.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        enter();
        window.removeEventListener("keydown", onKey);
      }
    };
    window.addEventListener("keydown", onKey);
  }

  private enter(onEnter: () => void): void {
    if (this.entered) return;
    this.entered = true;
    this.el.classList.add("leaving");
    // Remove from the page after the fade-out so taps reach the canvas.
    window.setTimeout(() => {
      this.el.remove();
      onEnter();
    }, 650);
  }
}
