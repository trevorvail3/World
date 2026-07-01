/**
 * src/client/tensionUI.ts
 * -----------------------
 * The Drowned Pier's catching minigame: a real-time tug-of-war with a fish on
 * the line. HOLD (press anywhere, or Space) to reel — that fills your catch
 * progress but builds line tension; RELEASE to ease off and let the tension fall.
 * Now and then the fish RUNS: a telegraphed lunge that spikes the tension whether
 * you reel or not — let go during a run or the line snaps. Land the fish by
 * filling the progress bar; snap it by maxing the tension.
 *
 * Pure presentation + skill: the fish (species, weight, length) was already
 * rolled by the core at the hook. This widget only decides WHETHER it's landed,
 * then reports success/failure back so the core can commit or discard the catch.
 * It runs its own requestAnimationFrame loop while open and uses Math.random for
 * the run timing (client-side flavour — never touches core state).
 */

export interface HookedInfo {
  species: string;
  weight: number;
  length: number;
  /** 0..1 — how hard it fights. */
  strength: number;
}

export class TensionUI {
  private backdrop: HTMLElement;
  private tensionFill: HTMLElement;
  private progressFill: HTMLElement;
  private title: HTMLElement;
  private sub: HTMLElement;
  private status: HTMLElement;
  private open = false;

  // Live minigame state.
  private strength = 0.5;
  private tension = 0;
  private progress = 0;
  private holding = false;
  private resolved = true;
  private last = 0;
  private nextLungeIn = 0; // seconds until the next run begins
  private lungeFor = 0; // seconds of run remaining (0 = not running)
  private telegraph = 0; // seconds of pre-run warning remaining
  private raf = 0;

  constructor(root: HTMLElement, private onResolve: (success: boolean) => void) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "tension-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="tension-box">
        <div class="tension-title"></div>
        <div class="tension-sub"></div>
        <div class="tension-arena">
          <div class="tension-meter">
            <div class="tension-danger"></div>
            <div class="tension-fill"></div>
            <div class="tension-label">LINE</div>
          </div>
          <div class="tension-progress">
            <div class="tension-progress-fill"></div>
            <div class="tension-progress-label">CATCH</div>
          </div>
        </div>
        <div class="tension-status">Hold to reel</div>
        <div class="tension-hint">HOLD to reel &middot; RELEASE to ease &middot; let go when it RUNS</div>
      </div>`;
    root.appendChild(this.backdrop);

    this.tensionFill = this.backdrop.querySelector(".tension-fill") as HTMLElement;
    this.progressFill = this.backdrop.querySelector(".tension-progress-fill") as HTMLElement;
    this.title = this.backdrop.querySelector(".tension-title") as HTMLElement;
    this.sub = this.backdrop.querySelector(".tension-sub") as HTMLElement;
    this.status = this.backdrop.querySelector(".tension-status") as HTMLElement;

    // Press anywhere on the overlay to reel; release to ease. Pointer + Space.
    const down = (e: Event): void => { e.preventDefault(); this.holding = true; };
    const up = (): void => { this.holding = false; };
    this.backdrop.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", (e) => {
      if (this.open && (e.code === "Space" || e.code === "ArrowDown")) { e.preventDefault(); this.holding = true; }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space" || e.code === "ArrowDown") this.holding = false;
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Start a fight with a freshly-hooked fish. */
  start(fish: HookedInfo): void {
    this.strength = Math.max(0.15, Math.min(0.97, fish.strength));
    this.tension = 0.12;
    this.progress = 0;
    this.holding = false;
    this.resolved = false;
    this.lungeFor = 0;
    this.telegraph = 0;
    this.nextLungeIn = 1.4 + Math.random() * 1.6;
    this.title.textContent = `${fish.species} on the line!`;
    // The size stays a mystery until it's landed — you only feel how hard it
    // fights. The catch popup reveals the weight and length.
    this.sub.textContent = fish.strength > 0.72 ? "It fights like a monster!"
      : fish.strength > 0.45 ? "A strong pull — hold on!"
      : "Reel it in — no telling how big…";
    this.open = true;
    this.backdrop.classList.remove("hidden");
    this.draw();
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  /** Close from outside (Escape) — counts as letting the line snap. */
  close(): void {
    if (!this.open) return;
    this.finish(false);
  }

  private finish(success: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    this.open = false;
    this.holding = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.backdrop.classList.add("hidden");
    this.onResolve(success);
  }

  private tick(now: number): void {
    if (this.resolved) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); // clamp big frame gaps
    this.last = now;
    const s = this.strength;

    // --- The run cycle: schedule, telegraph, then a lunge you must give line to. ---
    if (this.lungeFor > 0) {
      this.lungeFor -= dt;
      if (this.lungeFor <= 0) this.nextLungeIn = 2.2 + Math.random() * (2.5 - s * 1.5); // calmer fish rest longer
    } else {
      this.nextLungeIn -= dt;
      this.telegraph = this.nextLungeIn < 0.55 && this.nextLungeIn > 0 ? this.nextLungeIn : 0;
      if (this.nextLungeIn <= 0) this.lungeFor = 0.6 + s * 0.5;
    }
    const running = this.lungeFor > 0;

    // --- Tension: reeling builds it; fighting a run spikes it; easing off (and
    //     giving line during a run) bleeds it. The whole skill is knowing when to
    //     hold and when to let go — so a run is survived by RELEASING, never by
    //     reeling through it. ---
    const reelRise = 0.18 + s * 0.38;     // per second while holding (calm water)
    const runRise = 0.55 + s * 0.75;      // per second while reeling THROUGH a run
    const ease = 0.62;                    // per second while easing off (calm)
    if (running && this.holding) {
      this.tension += runRise * dt;       // fighting the run → toward a snap
    } else if (running) {
      this.tension -= ease * 0.5 * dt;    // give it line → tension gently bleeds
    } else if (this.holding) {
      this.tension += reelRise * dt;
    } else {
      this.tension -= ease * dt;
    }
    this.tension = Math.max(0, Math.min(1, this.tension));

    // --- Progress: reeling hauls it in; slack lets it slip back a touch. You
    //     can't make progress while the fish is running (you're just holding on). ---
    const reelRate = 1 / (6.5 + s * 9);   // fraction per second of holding
    if (this.holding && !running) this.progress += reelRate * dt;
    else if (!this.holding) this.progress -= 0.035 * dt;
    this.progress = Math.max(0, Math.min(1, this.progress));

    // --- Resolve. ---
    if (this.tension >= 1) { this.draw(); this.finish(false); return; }
    if (this.progress >= 1) { this.draw(); this.finish(true); return; }

    this.draw();
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  private draw(): void {
    this.tensionFill.style.height = `${Math.round(this.tension * 100)}%`;
    // Green when slack, amber climbing, red near the snap.
    const t = this.tension;
    const col = t > 0.82 ? "#d8453a" : t > 0.6 ? "#e0a23a" : "#5fae7a";
    this.tensionFill.style.background = col;
    this.progressFill.style.height = `${Math.round(this.progress * 100)}%`;

    const running = this.lungeFor > 0;
    const warn = this.telegraph > 0;
    this.backdrop.classList.toggle("tension-running", running);
    this.backdrop.classList.toggle("tension-warn", warn && !running);
    if (running) this.status.textContent = "IT RUNS — LET GO!";
    else if (warn) this.status.textContent = "It's about to run…";
    else if (t > 0.82) this.status.textContent = "Line straining — ease off!";
    else if (this.holding) this.status.textContent = "Reeling…";
    else this.status.textContent = "Hold to reel";
  }
}
