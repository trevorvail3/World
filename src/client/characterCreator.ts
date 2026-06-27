/**
 * src/client/characterCreator.ts
 * ------------------------------
 * Character creator: a name, body-part styles (hair, facial hair, top, legs,
 * shoes) and colours, with a live preview of the figure. Returns the chosen
 * look to main.ts, which stamps it onto the new player and saves it.
 *
 * The figure is drawn by the shared drawAvatar (src/client/avatar.ts), so the
 * preview and the in-world player always match.
 */

import type { Appearance } from "../core/types.ts";
import {
  CLOTH, DEFAULT_APPEARANCE, drawAvatar,
  FACIAL_STYLES, HAIR_STYLES, HAIRS, LEG_STYLES, SHOE_STYLES, SKINS, TOP_STYLES,
} from "./avatar.ts";

export type CreatedCharacter = Appearance;

/** Colour-field keys (string hex) and style-field keys (string id). */
type ColorKey = "skin" | "hair" | "tunic" | "legColor" | "shoeColor";
type StyleKey = "hairStyle" | "facial" | "top" | "legs" | "shoes";

export class CharacterCreator {
  private backdrop: HTMLElement;
  private draft: Appearance = { ...DEFAULT_APPEARANCE, name: "" };
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
          <canvas class="creator-preview" width="130" height="180"></canvas>
          <div class="creator-controls">
            <label class="creator-label">Name</label>
            <input class="creator-name" type="text" maxlength="16" placeholder="Your name" />
            <div class="creator-name-hint"></div>
            <div class="creator-rows"></div>
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

    const rows = this.backdrop.querySelector(".creator-rows") as HTMLElement;
    // Each part: a style cycler (where it has styles) and its colour swatches.
    this.partRow(rows, "Skin", null, null, "skin", SKINS);
    this.partRow(rows, "Hair", "hairStyle", HAIR_STYLES, "hair", HAIRS);
    this.partRow(rows, "Beard", "facial", FACIAL_STYLES, null, null);
    this.partRow(rows, "Top", "top", TOP_STYLES, "tunic", CLOTH);
    this.partRow(rows, "Legs", "legs", LEG_STYLES, "legColor", CLOTH);
    this.partRow(rows, "Shoes", "shoes", SHOE_STYLES, "shoeColor", CLOTH);

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

  /** A labelled row: optional style cycler + optional colour swatches. */
  private partRow(
    parent: HTMLElement,
    label: string,
    styleKey: StyleKey | null,
    styles: { id: string; label: string }[] | null,
    colorKey: ColorKey | null,
    colors: string[] | null,
  ): void {
    const row = document.createElement("div");
    row.className = "creator-part";
    const head = document.createElement("div");
    head.className = "creator-part-head";
    head.innerHTML = `<span class="creator-label">${label}</span>`;
    if (styleKey && styles) head.appendChild(this.cycler(styleKey, styles));
    row.appendChild(head);
    if (colorKey && colors) row.appendChild(this.swatches(colorKey, colors));
    parent.appendChild(row);
  }

  /** A ◀ name ▶ control cycling a style list. */
  private cycler(key: StyleKey, list: { id: string; label: string }[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "creator-cycler";
    const prev = document.createElement("button");
    prev.type = "button"; prev.className = "creator-cyc-btn"; prev.textContent = "◀";
    const name = document.createElement("span");
    name.className = "creator-cyc-name";
    const next = document.createElement("button");
    next.type = "button"; next.className = "creator-cyc-btn"; next.textContent = "▶";
    const sync = () => {
      const i = Math.max(0, list.findIndex((o) => o.id === this.draft[key]));
      name.textContent = list[i]?.label ?? list[0]!.label;
    };
    const step = (d: number) => {
      let i = Math.max(0, list.findIndex((o) => o.id === this.draft[key]));
      i = (i + d + list.length) % list.length;
      this.draft[key] = list[i]!.id;
      sync(); this.renderPreview();
    };
    prev.addEventListener("pointerdown", (e) => { e.stopPropagation(); step(-1); });
    next.addEventListener("pointerdown", (e) => { e.stopPropagation(); step(1); });
    wrap.append(prev, name, next);
    sync();
    return wrap;
  }

  /** A row of colour swatches bound to a colour field. */
  private swatches(key: ColorKey, colors: string[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "creator-swatches";
    for (const c of colors) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "creator-swatch" + (this.draft[key] === c ? " on" : "");
      b.style.background = c;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.draft[key] = c;
        for (const sib of Array.from(wrap.children)) sib.classList.remove("on");
        b.classList.add("on");
        this.renderPreview();
      });
      wrap.appendChild(b);
    }
    return wrap;
  }

  private renderPreview(): void {
    const g = this.preview.getContext("2d");
    if (!g) return;
    const w = this.preview.width, h = this.preview.height;
    g.clearRect(0, 0, w, h);
    // Centre the figure (it spans roughly -20..+13 base units tall) and scale up.
    drawAvatar(g, w / 2, h / 2 + 22, 3.7, this.draft, 0);
  }

  private close(): void {
    this.backdrop.remove();
  }
}
