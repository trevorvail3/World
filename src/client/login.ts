/**
 * src/client/login.ts
 * -------------------
 * The opening "log in" screen: pick an existing local character to continue,
 * or start a new one (which hands off to the character creator). Accounts are
 * just local save profiles — no server — mirroring the idle game's feel.
 */

export class LoginScreen {
  private backdrop: HTMLElement;

  constructor(
    root: HTMLElement,
    accounts: string[],
    opts: { onLogin: (name: string) => void; onNew: () => void },
  ) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "login-backdrop";
    const list = accounts.length
      ? `<div class="login-label">Continue</div><div class="login-accounts">${accounts
          .map((n) => `<button class="login-account" data-name="${escapeAttr(n)}" type="button">
              <span class="login-account-name">${escapeHtml(n)}</span>
              <span class="login-account-go">▶</span>
            </button>`)
          .join("")}</div>`
      : `<div class="login-empty">No characters yet. Begin your story in Varath.</div>`;
    this.backdrop.innerHTML = `
      <div class="login-box">
        <div class="login-title">VARATH</div>
        <div class="login-sub">— THE WORLD —</div>
        ${list}
        <button class="login-new" type="button">✦ New Character</button>
      </div>`;
    root.appendChild(this.backdrop);

    for (const btn of Array.from(this.backdrop.querySelectorAll<HTMLElement>(".login-account"))) {
      btn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const name = btn.dataset["name"];
        if (name) { this.close(); opts.onLogin(name); }
      });
    }
    (this.backdrop.querySelector(".login-new") as HTMLElement).addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.close();
      opts.onNew();
    });
  }

  private close(): void {
    this.backdrop.remove();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
