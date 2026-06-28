/**
 * Procedural audio for Varath World.
 *
 * Every sound is synthesised on the fly with the Web Audio API — there are no
 * audio files to ship, so the whole soundscape weighs nothing and works
 * offline. SFX are short blips/chimes; the ambience is a slow, quiet drone pad.
 *
 * Browsers won't let audio start until the player interacts, so the context is
 * created lazily and `resume()` is called from the first pointer/key event.
 *
 * Two independent toggles (persisted to localStorage): sound effects and the
 * ambient pad. Both default on.
 */

const SFX_KEY = "varath.sfx";
const AMBIENT_KEY = "varath.ambient";

/** The named one-shot effects the game can ask for. */
export type Sfx =
  | "hit" | "hurt" | "miss" | "death"
  | "eat" | "drink" | "pickup" | "equip" | "drop"
  | "click" | "level" | "quest" | "achievement"
  | "craft" | "gather" | "error";

function readBool(key: string, dflt: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? dflt : v === "1";
  } catch {
    return dflt;
  }
}

function writeBool(key: string, val: boolean): void {
  try { localStorage.setItem(key, val ? "1" : "0"); } catch { /* ignore */ }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxOn = readBool(SFX_KEY, true);
  private ambientOn = readBool(AMBIENT_KEY, true);
  private ambientNodes: AudioNode[] = [];
  private ambientGain: GainNode | null = null;

  /** Wake the audio context after a user gesture; safe to call repeatedly. */
  resume(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      // A gentle limiter on the master bus so layered SFX (a hit + its noise, an
      // overlapping fanfare, the ambient pad) never stack into harsh clipping.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 22;
      comp.ratio.value = 12;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.ambientOn) this.startAmbient();
  }

  sfxEnabled(): boolean { return this.sfxOn; }
  ambientEnabled(): boolean { return this.ambientOn; }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    writeBool(SFX_KEY, on);
    if (on) this.play("click");
  }

  setAmbient(on: boolean): void {
    this.ambientOn = on;
    writeBool(AMBIENT_KEY, on);
    if (on) this.startAmbient();
    else this.stopAmbient();
  }

  // --- One-shot effects --------------------------------------------------

  play(name: Sfx, intensity = 1): void {
    if (!this.sfxOn) return;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== "running") return;
    const t = ctx.currentTime;
    switch (name) {
      case "hit":
        this.thud(t, 150 + 60 * intensity, 0.09, 0.22 * intensity, "triangle");
        this.noise(t, 0.05, 0.12 * intensity, 1400);
        break;
      case "hurt":
        this.tone(t, 220, 130, 0.18, 0.28, "sawtooth");
        this.noise(t, 0.08, 0.14, 700);
        break;
      case "miss":
        this.noise(t, 0.12, 0.07, 2600);
        break;
      case "death":
        this.tone(t, 300, 70, 0.7, 0.3, "sawtooth");
        this.tone(t + 0.05, 200, 50, 0.8, 0.22, "triangle");
        break;
      case "eat":
        this.tone(t, 340, 480, 0.12, 0.16, "sine");
        break;
      case "drink":
        this.tone(t, 500, 780, 0.16, 0.14, "sine");
        break;
      case "pickup":
        this.blip(t, 760, 0.06, 0.16);
        this.blip(t + 0.06, 1040, 0.06, 0.13);
        break;
      case "equip":
        this.thud(t, 320, 0.07, 0.18, "square");
        this.blip(t + 0.04, 660, 0.05, 0.1);
        break;
      case "drop":
        this.thud(t, 200, 0.1, 0.16, "triangle");
        break;
      case "click":
        this.blip(t, 540, 0.03, 0.1);
        break;
      case "craft":
        this.thud(t, 240, 0.08, 0.18, "square");
        this.blip(t + 0.07, 880, 0.06, 0.1);
        break;
      case "gather":
        this.thud(t, 180, 0.06, 0.13, "triangle");
        break;
      case "error":
        this.tone(t, 200, 150, 0.16, 0.18, "square");
        break;
      case "level":
        // A little ascending fanfare — the OSRS "ding".
        this.arp(t, [523, 659, 784, 1047], 0.11, 0.2);
        break;
      case "quest":
        this.arp(t, [659, 880, 1047], 0.14, 0.2);
        break;
      case "achievement":
        this.arp(t, [784, 988, 1319], 0.13, 0.22);
        break;
    }
  }

  // --- Ambient drone pad -------------------------------------------------

  private startAmbient(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.ambientNodes.length) return;

    const pad = ctx.createGain();
    pad.gain.value = 0.0001;
    pad.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 4);
    pad.connect(master);
    this.ambientGain = pad;

    // A low, slowly-beating fifth through a gently sweeping low-pass.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;
    filter.Q.value = 0.7;
    filter.connect(pad);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const voices: OscillatorNode[] = [];
    for (const [freq, type, detune] of [
      [110, "sine", -4],
      [110, "triangle", 5],
      [164.81, "sine", 3],
    ] as [number, OscillatorType, number][]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start();
      voices.push(osc);
    }
    this.ambientNodes = [pad, filter, lfo, lfoGain, ...voices];
  }

  private stopAmbient(): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambientNodes.length) return;
    if (this.ambientGain) {
      this.ambientGain.gain.cancelScheduledValues(ctx.currentTime);
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, ctx.currentTime);
      this.ambientGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
    }
    const nodes = this.ambientNodes;
    this.ambientNodes = [];
    this.ambientGain = null;
    setTimeout(() => {
      for (const n of nodes) {
        try { (n as OscillatorNode).stop?.(); } catch { /* not an oscillator */ }
        try { n.disconnect(); } catch { /* already gone */ }
      }
    }, 1700);
  }

  // --- Tiny synth primitives --------------------------------------------

  /** A single enveloped oscillator note (optionally pitch-sliding). */
  private tone(
    at: number, fromHz: number, toHz: number, dur: number, gain: number, type: OscillatorType,
  ): void {
    const ctx = this.ctx!, master = this.master!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g); g.connect(master);
    osc.start(at); osc.stop(at + dur + 0.02);
  }

  private blip(at: number, hz: number, dur: number, gain: number): void {
    this.tone(at, hz, hz, dur, gain, "square");
  }

  /** A low, fast-decaying body hit. */
  private thud(at: number, hz: number, dur: number, gain: number, type: OscillatorType): void {
    this.tone(at, hz, hz * 0.5, dur, gain, type);
  }

  /** A burst of filtered noise (impacts, whiffs). */
  private noise(at: number, dur: number, gain: number, cutoff: number): void {
    const ctx = this.ctx!, master = this.master!;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Deterministic-ish noise; exact values don't matter for an impact.
    let seed = frames;
    for (let i = 0; i < frames; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(at); src.stop(at + dur + 0.02);
  }

  /** A quick ascending run of notes (fanfares). */
  private arp(at: number, notes: number[], step: number, gain: number): void {
    notes.forEach((hz, i) => this.tone(at + i * step, hz, hz, step * 1.6, gain, "triangle"));
  }
}

/** The shared engine instance. */
export const audio = new AudioEngine();
