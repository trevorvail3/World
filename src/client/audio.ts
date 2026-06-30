/**
 * src/client/audio.ts
 * -------------------
 * Procedural DARK-AMBIENT audio for Varath, synthesized with the Web Audio API.
 * Nothing is loaded or licensed — every sound is generated from oscillators and
 * noise, matching the game's procedural art. Two layers:
 *   1. A slow, evolving low drone (the "cavern" the whole game sits in), built
 *      from detuned sub-oscillators through a breathing low-pass, with an
 *      occasional distant toll for unease.
 *   2. Short SFX fired from game events (a dull blade thud, a bow's loosing, a
 *      kill's descending groan, a level-up swell, pickups…), all run through a
 *      long reverb so they sit in the same dark space.
 *
 * Resilience (the autoplay policy is what usually breaks browser audio):
 *   - The AudioContext is created + resumed ONLY on the first real user gesture
 *     (browsers suspend audio until then). Until unlocked, every call no-ops.
 *   - Every Web Audio call is wrapped so a failure can never throw into the
 *     game loop or the render frame.
 *   - Volume / mute persist in localStorage and apply to one master gain.
 */

const VOL_KEY = "varath-audio-vol";
const MUTE_KEY = "varath-audio-mute";
const readVol = (): number => {
  const v = Number(localStorage.getItem(VOL_KEY));
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.45;
};
const readMute = (): boolean => localStorage.getItem(MUTE_KEY) === "1";
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export type Sfx =
  | "hit" | "miss" | "bow" | "kill" | "hurt" | "death"
  | "levelup" | "pickup" | "gather" | "heal" | "ui";

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverbIn: ConvolverNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private ambient: { stop(): void } | null = null;
  private tollTimer: number | null = null;
  private volume = 0.45;
  private muted = false;
  private unlocked = false;
  private gestures: (() => void) | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    try { this.volume = readVol(); this.muted = readMute(); } catch { /* ignore */ }
    // Arm the autoplay unlock: the first gesture anywhere creates the context.
    const onGesture = (): void => this.unlock();
    this.gestures = onGesture;
    for (const e of ["pointerdown", "keydown", "touchstart"] as const) {
      window.addEventListener(e, onGesture);
    }
  }

  // --- lifecycle ------------------------------------------------------------
  /** Create + resume the context on a user gesture, then bring the drone up. */
  unlock(): void {
    try {
      if (!this.ctx) this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.unlocked = true;
      if (!this.muted) this.startAmbient();
      if (this.gestures) {
        for (const e of ["pointerdown", "keydown", "touchstart"] as const) {
          window.removeEventListener(e, this.gestures);
        }
        this.gestures = null;
      }
    } catch { /* audio unavailable — stay silent */ }
  }

  private init(): void {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(ctx.destination);
    // Long, dark reverb send: a decaying noise impulse so everything echoes as
    // if underground.
    this.reverbIn = ctx.createConvolver();
    this.reverbIn.buffer = this.makeImpulse(2.6, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.85;
    this.reverbIn.connect(wet).connect(this.master);
    this.noiseBuf = this.makeNoise(1);
  }

  private makeNoise(sec: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 1234567;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
    return buf;
  }
  private makeImpulse(sec: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    let s = 99;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        d[i] = ((s / 0x3fffffff) - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // --- the drone ------------------------------------------------------------
  startAmbient(): void {
    if (!this.ctx || !this.master || this.ambient) return;
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.master);
    if (this.reverbIn) bus.connect(this.reverbIn);
    bus.gain.linearRampToValueAtTime(0.085, ctx.currentTime + 5); // slow fade-in

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 380; lp.Q.value = 1.2;
    lp.connect(bus);

    const nodes: { stop(t: number): void }[] = [];
    // Drone voices: a low A, its slightly detuned twin (slow beating), a fifth,
    // and a faint upper voice a minor second up for the unease.
    const voices: [number, OscillatorType, number][] = [
      [55, "sine", 1], [55.3, "sine", 1], [82.41, "sine", 0.5], [116.5, "triangle", 0.18],
    ];
    for (const [f, type, g] of voices) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g * 0.5;
      o.connect(og).connect(lp); o.start(); nodes.push(o);
    }
    // Breathing filter sweep + a slow amplitude swell.
    const flfo = ctx.createOscillator(); flfo.frequency.value = 0.05;
    const flfoG = ctx.createGain(); flfoG.gain.value = 200;
    flfo.connect(flfoG).connect(lp.frequency); flfo.start(); nodes.push(flfo);
    const alfo = ctx.createOscillator(); alfo.frequency.value = 0.06;
    const alfoG = ctx.createGain(); alfoG.gain.value = 0.03;
    alfo.connect(alfoG).connect(bus.gain); alfo.start(); nodes.push(alfo);

    this.ambient = {
      stop: () => {
        try {
          bus.gain.cancelScheduledValues(ctx.currentTime);
          bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
          bus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
          for (const n of nodes) { try { n.stop(ctx.currentTime + 1.7); } catch { /* */ } }
        } catch { /* */ }
      },
    };
    // A distant toll every so often, for atmosphere.
    this.scheduleToll();
  }
  private scheduleToll(): void {
    if (typeof window === "undefined") return;
    const next = 14000 + Math.random() * 26000;
    this.tollTimer = window.setTimeout(() => {
      if (this.ambient && !this.muted) {
        this.tone({ f0: 49, f1: 41, type: "sine", dur: 3.2, peak: 0.16, lp: 320, wet: true });
        this.tone({ f0: 73.5, type: "sine", dur: 2.6, peak: 0.06, lp: 400, wet: true });
      }
      this.scheduleToll();
    }, next);
  }
  stopAmbient(): void {
    if (this.tollTimer !== null) { try { window.clearTimeout(this.tollTimer); } catch { /* */ } this.tollTimer = null; }
    if (this.ambient) { this.ambient.stop(); this.ambient = null; }
  }

  // --- synthesis primitives -------------------------------------------------
  private tone(o: { f0: number; f1?: number; type?: OscillatorType; dur: number; peak: number; lp?: number; wet?: boolean; delay?: number }): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    let node: AudioNode = osc;
    if (o.lp != null) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; osc.connect(f); node = f; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    node.connect(g); g.connect(this.master);
    if (o.wet && this.reverbIn) g.connect(this.reverbIn);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }
  private noise(o: { dur: number; peak: number; lp?: number; hp?: number; wet?: boolean }): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    let node: AudioNode = src;
    if (o.hp != null) { const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = o.hp; src.connect(f); node = f; }
    if (o.lp != null) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; node.connect(f); node = f; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    node.connect(g); g.connect(this.master);
    if (o.wet && this.reverbIn) g.connect(this.reverbIn);
    src.start(t); src.stop(t + o.dur + 0.02);
  }

  // --- the SFX --------------------------------------------------------------
  play(id: Sfx): void {
    if (!this.unlocked || this.muted || !this.ctx) return;
    try {
      switch (id) {
        case "hit": // a dull, heavy blade/club thud
          this.noise({ dur: 0.14, peak: 0.45, hp: 220, lp: 1100, wet: true });
          this.tone({ f0: 120, f1: 58, type: "sine", dur: 0.18, peak: 0.5, wet: true });
          break;
        case "miss": // an airy swish past
          this.noise({ dur: 0.2, peak: 0.1, hp: 900, lp: 3000, wet: true });
          break;
        case "bow": // a low loosing twang
          this.tone({ f0: 640, f1: 170, type: "triangle", dur: 0.18, peak: 0.28, wet: true });
          this.noise({ dur: 0.05, peak: 0.08, hp: 1600 });
          break;
        case "kill": // a descending groan + thud
          this.tone({ f0: 150, f1: 46, type: "sawtooth", dur: 0.5, peak: 0.4, lp: 800, wet: true });
          this.noise({ dur: 0.22, peak: 0.32, lp: 650, wet: true });
          break;
        case "hurt": // a low dissonant jolt
          this.tone({ f0: 138, f1: 92, type: "sawtooth", dur: 0.22, peak: 0.38, lp: 700, wet: true });
          break;
        case "death": // a long, sinking drone sting
          this.tone({ f0: 180, f1: 38, type: "sawtooth", dur: 1.8, peak: 0.4, lp: 600, wet: true });
          this.tone({ f0: 184, f1: 41, type: "sine", dur: 1.8, peak: 0.2, wet: true });
          break;
        case "levelup": { // a dark but rewarding swell (low fifth → octave)
          this.tone({ f0: 110, type: "triangle", dur: 0.6, peak: 0.22, wet: true });
          this.tone({ f0: 164.81, type: "triangle", dur: 0.6, peak: 0.2, wet: true, delay: 0.1 });
          this.tone({ f0: 220, type: "triangle", dur: 0.8, peak: 0.22, wet: true, delay: 0.22 });
          break;
        }
        case "pickup": // a soft two-note blip
          this.tone({ f0: 430, type: "sine", dur: 0.07, peak: 0.16 });
          this.tone({ f0: 660, type: "sine", dur: 0.09, peak: 0.16, delay: 0.06 });
          break;
        case "gather": // a soft muted tap
          this.noise({ dur: 0.05, peak: 0.16, hp: 300, lp: 1000 });
          this.tone({ f0: 170, f1: 110, type: "sine", dur: 0.08, peak: 0.16, lp: 500 });
          break;
        case "heal": // a soft rising glow
          this.tone({ f0: 320, f1: 520, type: "sine", dur: 0.3, peak: 0.14, wet: true });
          break;
        case "ui": // a tiny soft click
          this.tone({ f0: 420, type: "sine", dur: 0.04, peak: 0.07 });
          break;
      }
    } catch { /* never let audio break the frame */ }
  }

  // --- settings -------------------------------------------------------------
  getVolume(): number { return this.volume; }
  setVolume(v: number): void {
    this.volume = clamp01(v);
    try { localStorage.setItem(VOL_KEY, String(this.volume)); } catch { /* */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }
  getMuted(): boolean { return this.muted; }
  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* */ }
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
    if (m) this.stopAmbient();
    else if (this.unlocked) this.startAmbient();
  }
}

/** The single shared audio engine for the whole client. */
export const audio = new AudioManager();
