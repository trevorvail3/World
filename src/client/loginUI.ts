/**
 * src/client/loginUI.ts
 * ---------------------
 * The front door. Shown before anything else: you sign in (or create an account)
 * with the SAME credentials as the idle game — Varath shares one Supabase
 * project, so one identity spans both. Only once you're signed in does the game
 * continue to character creation (new) or load your character (returning).
 *
 * Signing in syncs your character to the cloud (same account as the idle game).
 * You can also "Play offline" for a purely local character saved in this
 * browser — handy for the downloadable single-file build or playing without an
 * account; that character never touches the cloud.
 */

import { signIn, signUp } from "./supabase.ts";
import { audio } from "./audio.ts";

export class LoginUI {
  private backdrop: HTMLElement;

  constructor(root: HTMLElement, private onDone: () => void, private onOffline?: () => void) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "login-backdrop";
    this.backdrop.innerHTML = `
      <div class="login-box">
        <div class="login-title">VARATH</div>
        <div class="login-sub">Sign in to enter the world.</div>
        <form class="login-form">
          <input class="login-email" type="email" placeholder="email"
                 autocomplete="email" required />
          <input class="login-pass" type="password" placeholder="password"
                 autocomplete="current-password" required />
          <button class="login-go" type="submit">Sign in</button>
          <button class="login-create" type="button">Create account</button>
          <div class="login-msg"></div>
        </form>
        <button class="login-offline" type="button">Play offline</button>
        <div class="login-foot">Same account as the idle game. Offline play saves only in this browser.</div>
        <div class="login-sound">♪ click anywhere to enable sound</div>
      </div>`;
    root.appendChild(this.backdrop);

    // Browsers keep audio locked until a real gesture; the hint tells the
    // player their first click brings the theme up, then quietly leaves.
    const soundHint = this.backdrop.querySelector(".login-sound") as HTMLElement;
    if (audio.isUnlocked()) soundHint.remove();
    else {
      const watch = window.setInterval(() => {
        if (audio.isUnlocked()) {
          soundHint.classList.add("gone");
          window.clearInterval(watch);
          window.setTimeout(() => soundHint.remove(), 900);
        }
      }, 300);
    }

    const form = this.backdrop.querySelector(".login-form") as HTMLFormElement;
    const email = this.backdrop.querySelector(".login-email") as HTMLInputElement;
    const pass = this.backdrop.querySelector(".login-pass") as HTMLInputElement;
    const go = this.backdrop.querySelector(".login-go") as HTMLButtonElement;
    const create = this.backdrop.querySelector(".login-create") as HTMLButtonElement;
    const msg = this.backdrop.querySelector(".login-msg") as HTMLElement;

    const busy = (on: boolean): void => { go.disabled = on; create.disabled = on; };
    const say = (m: string, ok = false): void => {
      msg.textContent = m;
      msg.classList.toggle("ok", ok);
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      say("");
      busy(true);
      signIn(email.value.trim(), pass.value)
        .then(() => this.finish())
        .catch((ex) => { say(ex?.message ?? "Sign-in failed"); busy(false); });
    });

    create.addEventListener("click", () => {
      say("");
      if (!email.value.trim() || !pass.value) { say("Enter an email and password first."); return; }
      busy(true);
      signUp(email.value.trim(), pass.value)
        .then((started) => {
          if (started) this.finish();
          else { say("Account made — check your email to confirm, then sign in.", true); busy(false); }
        })
        .catch((ex) => { say(ex?.message ?? "Sign-up failed"); busy(false); });
    });

    const offline = this.backdrop.querySelector(".login-offline") as HTMLButtonElement;
    if (this.onOffline) {
      offline.addEventListener("click", () => { this.backdrop.remove(); this.onOffline!(); });
    } else {
      offline.remove();
    }
  }

  private finish(): void {
    this.backdrop.remove();
    this.onDone();
  }
}
