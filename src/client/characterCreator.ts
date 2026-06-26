/**
 * src/client/characterCreator.ts
 * ------------------------------
 * A basic character creator: choose a name and three colours (skin, hair,
 * tunic) with a live preview of the figure. Returns the chosen look to main.ts,
 * which stamps it onto the new player and saves it under the account.
 */

export interface CreatedCharacter {
  name: string;
  skin: string;
  hair: string;
  tunic: string;
}

const SKINS = ["#f0d2a8", "#e3bd92", "#caa176", "#a9794f", "#855b38", "#5f3f26"];
const HAIRS = ["#2a2320", "#4a3320", "#7a5226", "#b8893c", "#caa24a", "#9a3320", "#3a5a7a", "#d8d8d8"];
const TUNICS = ["#6b6157", "#3a5a7a", "#4f7a3a", "#7a3a3a", "#6a4a7a", "#caa05a", "#2f6b66", "#9a5a2a"];

export class CharacterCreator {
  private backdrop: HTMLElement;
  private draft: CreatedCharacter = { name: "", skin: SKINS[1]!, hair: HAIRS[1]!, tunic: TUNICS[0]! };
  private preview!: HTMLCanvasElement;
  private taken: Set<string>;

  constructor(
    root: HTMLElement,
    private opts: { onCreate: (c: CreatedCharacter) => void; onBack: () => void; takenNames: string[] },
  ) {
    this.taken = new Set(opts.takenNames.map((n) => n.toLowerCase()));
    this.backdrop = document.createElement("div");
    this.backdrop.className = "creator-backdrop";
    this.backdrop.innerHTML = `
      <div class="creator-box">
        <div class="creator-title">VARATH</div>
        <div class="creator-sub">Who will you become?</div>
        <div class="creator-main">
          <canvas class="creator-preview" width="120" height="150"></canvas>
          <div class="creator-controls">
            <label class="creator-label">Name</label>
            <input class="creator-name" type="text" maxlength="16" placeholder="Your name" />
            <div class="creator-name-hint"></div>
            <label class="creator-label">Skin</label>
            <div class="creator-swatches" data-kind="skin"></div>
            <label class="creator-label">Hair</label>
            <div class="creator-swatches" data-kind="hair"></div>
            <label class="creator-label">Tunic</label>
            <div class="creator-swatches" data-kind="tunic"></div>
          </div>
        </div>
        <div class="creator-nav">
          <button class="creator-back" type="button">◀ Back</button>
          <button class="creator-go" type="button" disabled>Enter Varath</button>
        </div>
      </div>`;
    root.appendChild(this.backdrop);
    this.preview = this.backdrop.querySelector(".creator-preview") as HTMLCanvasElement;

    const nameEl = this.backdrop.querySelector(".creator-name") as HTMLInputElement;
    const hintEl = this.backdrop.querySelector(".creator-name-hint") as HTMLElement;
    nameEl.addEventListener("input", () => {
      this.draft.name = nameEl.value.trim();
      const clash = this.taken.has(this.draft.name.toLowerCase());
      hintEl.textContent = clash ? "That name is already taken." : "1–16 characters.";
      hintEl.classList.toggle("warn", clash);
      (this.backdrop.querySelector(".creator-go") as HTMLButtonElement).disabled =
        this.draft.name.length < 1 || clash;
    });

    this.buildSwatches("skin", SKINS);
    this.buildSwatches("hair", HAIRS);
    this.buildSwatches("tunic", TUNICS);

    (this.backdrop.querySelector(".creator-back") as HTMLElement).addEventListener("pointerdown", (e) => {
      e.stopPropagation(); this.close(); this.opts.onBack();
    });
    (this.backdrop.querySelector(".creator-go") as HTMLButtonElement).addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (this.draft.name.length < 1 || this.taken.has(this.draft.name.toLowerCase())) return;
      this.close();
      this.opts.onCreate({ ...this.draft });
    });

    this.renderPreview();
    setTimeout(() => nameEl.focus(), 50);
  }

  private buildSwatches(kind: "skin" | "hair" | "tunic", colors: string[]): void {
    const wrap = this.backdrop.querySelector(`.creator-swatches[data-kind="${kind}"]`) as HTMLElement;
    for (const c of colors) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "creator-swatch" + (this.draft[kind] === c ? " on" : "");
      b.style.background = c;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.draft[kind] = c;
        for (const sib of Array.from(wrap.children)) sib.classList.remove("on");
        b.classList.add("on");
        this.renderPreview();
      });
      wrap.appendChild(b);
    }
  }

  private renderPreview(): void {
    const g = this.preview.getContext("2d");
    if (!g) return;
    const w = this.preview.width, h = this.preview.height;
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2 + 18, S = 3.4;
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.beginPath(); g.ellipse(cx, cy + 13 * S * 0.5, 11 * S * 0.5, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = this.draft.tunic;
    g.fillRect(cx - 7 * S * 0.5, cy - 8 * S * 0.5, 14 * S * 0.5, 18 * S * 0.5);
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.fillRect(cx - 1, cy - 8 * S * 0.5, 2, 18 * S * 0.5);
    g.fillRect(cx - 7 * S * 0.5, cy + 1 * S * 0.5, 14 * S * 0.5, 3);
    g.fillStyle = "#d2742c";
    g.fillRect(cx - 7 * S * 0.5, cy + 6 * S * 0.5, 14 * S * 0.5, 6);
    g.fillStyle = this.draft.skin;
    g.beginPath(); g.arc(cx, cy - 12 * S * 0.5, 6 * S * 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = this.draft.hair;
    g.beginPath();
    g.arc(cx, cy - 12 * S * 0.5, 6 * S * 0.5, Math.PI * 1.02, Math.PI * 1.98);
    g.closePath(); g.fill();
  }

  private close(): void {
    this.backdrop.remove();
  }
}
