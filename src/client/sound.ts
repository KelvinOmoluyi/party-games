"use client";
// Synthesised sound effects + a tiny chiptune music sequencer (Web Audio, no files).

export type SfxName =
  | "tap" | "click" | "beep" | "go" | "shoot" | "boom" | "hit" | "whoosh" | "cluck" | "pickup"
  | "score" | "fall" | "buzz" | "win" | "lose" | "join" | "flag" | "pop"
  | "jump" | "tick" | "rumble" | "squash" | "heart" | "launch";

type Theme = "lobby" | "game" | null;

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function storeGet(k: string, d: boolean) {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : v === "1";
  } catch {
    return d;
  }
}
function storeSet(k: string, v: boolean) {
  try {
    localStorage.setItem(k, v ? "1" : "0");
  } catch {}
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private last: Record<string, number> = {};
  private listeners = new Set<() => void>();
  sfxOn = true;
  musicOn = true;
  private theme: Theme = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.sfxOn = storeGet("party:sfx", true);
      this.musicOn = storeGet("party:music", true);
    }
  }

  /** Must run inside a user gesture (tap/click) before audio can play on phones. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const master = this.ctx.createGain();
      master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      master.connect(comp).connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
      this.sfxBus.connect(master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.55 : 0;
      this.musicBus.connect(master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.theme && !this.timer) this.startSequencer();
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    storeSet("party:sfx", on);
    if (this.sfxBus) this.sfxBus.gain.value = on ? 1 : 0;
    this.emit();
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    storeSet("party:music", on);
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
    this.emit();
  }

  // ---------- primitives ----------
  private tone(f: number, dur: number, o: { type?: OscillatorType; vol?: number; f2?: number; at?: number; bus?: GainNode | null; attack?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + (o.at ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? "square";
    osc.frequency.setValueAtTime(f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
    const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(o.bus ?? this.sfxBus!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, o: { vol?: number; type?: BiquadFilterType; f?: number; f2?: number; q?: number; at?: number; bus?: GainNode | null } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const t = ctx.currentTime + (o.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = o.type ?? "lowpass";
    filt.frequency.setValueAtTime(o.f ?? 1000, t);
    if (o.f2) filt.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    filt.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(o.bus ?? this.sfxBus!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** Play a named effect. Rate-limited per effect so 16 players don't deafen anyone. */
  play(name: SfxName, o: { vol?: number; minGap?: number } = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const now = performance.now();
    const gap = o.minGap ?? 40;
    if (now - (this.last[name] ?? 0) < gap) return;
    this.last[name] = now;
    const v = o.vol ?? 1;
    const r = 1 + (Math.random() - 0.5) * 0.12; // slight pitch variety
    switch (name) {
      case "tap":
        this.tone(520 * r, 0.06, { f2: 760 * r, vol: 0.12 * v });
        break;
      case "click":
        this.tone(1200, 0.03, { type: "triangle", vol: 0.12 * v });
        break;
      case "pop":
        this.tone(400 * r, 0.08, { type: "sine", f2: 900, vol: 0.25 * v });
        break;
      case "beep":
        this.tone(660, 0.14, { type: "square", vol: 0.16 * v });
        break;
      case "go":
        this.tone(880, 0.35, { type: "square", vol: 0.16 * v });
        this.tone(1320, 0.35, { type: "triangle", vol: 0.14 * v });
        break;
      case "shoot":
        this.noise(0.14, { type: "bandpass", f: 1800, f2: 300, q: 0.8, vol: 0.35 * v });
        this.tone(240 * r, 0.1, { f2: 90, vol: 0.14 * v });
        break;
      case "boom":
        this.noise(0.7, { type: "lowpass", f: 1200, f2: 80, vol: 0.6 * v });
        this.tone(110, 0.5, { type: "sine", f2: 35, vol: 0.45 * v });
        break;
      case "hit":
        this.tone(320 * r, 0.12, { type: "square", f2: 110, vol: 0.18 * v });
        this.noise(0.08, { type: "highpass", f: 1500, vol: 0.2 * v });
        break;
      case "whoosh":
        this.noise(0.25, { type: "bandpass", f: 400, f2: 2400, q: 1.5, vol: 0.25 * v });
        break;
      case "cluck":
        this.tone(950 * r, 0.05, { type: "square", f2: 700, vol: 0.09 * v });
        this.tone(1250 * r, 0.07, { type: "square", f2: 820, vol: 0.09 * v, at: 0.06 });
        break;
      case "pickup":
        [660, 880, 1175].forEach((f, i) => this.tone(f, 0.08, { type: "triangle", vol: 0.15 * v, at: i * 0.05 }));
        break;
      case "score":
        this.tone(1047, 0.3, { type: "triangle", vol: 0.18 * v });
        this.tone(1319, 0.35, { type: "triangle", vol: 0.15 * v, at: 0.08 });
        break;
      case "flag":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, { type: "square", vol: 0.1 * v, at: i * 0.08 }));
        break;
      case "fall":
        this.tone(700, 0.55, { type: "sine", f2: 110, vol: 0.22 * v });
        this.noise(0.4, { type: "lowpass", f: 900, f2: 200, vol: 0.25 * v, at: 0.35 });
        break;
      case "buzz":
        this.tone(110, 0.45, { type: "sawtooth", vol: 0.2 * v });
        this.tone(116, 0.45, { type: "sawtooth", vol: 0.15 * v });
        break;
      case "win":
        [60, 64, 67, 72, 67, 72].forEach((n, i) =>
          this.tone(midi(n + 12), i === 5 ? 0.6 : 0.14, { type: "square", vol: 0.12 * v, at: [0, 0.12, 0.24, 0.36, 0.5, 0.62][i] }),
        );
        [48, 55, 60].forEach((n) => this.tone(midi(n), 0.9, { type: "triangle", vol: 0.12 * v, at: 0.62 }));
        break;
      case "lose":
        [67, 64, 60].forEach((n, i) => this.tone(midi(n), 0.3, { type: "triangle", vol: 0.14 * v, at: i * 0.22 }));
        break;
      case "join":
        this.tone(midi(72), 0.1, { type: "triangle", vol: 0.15 * v });
        this.tone(midi(79), 0.18, { type: "triangle", vol: 0.15 * v, at: 0.09 });
        break;
      case "jump":
        this.tone(330 * r, 0.14, { type: "square", f2: 720 * r, vol: 0.11 * v });
        break;
      case "tick":
        this.tone(1800, 0.025, { type: "square", vol: 0.1 * v });
        this.noise(0.02, { type: "highpass", f: 4000, vol: 0.12 * v });
        break;
      case "rumble":
        this.noise(0.9, { type: "lowpass", f: 260, f2: 90, vol: 0.4 * v });
        this.tone(55, 0.8, { type: "sine", f2: 40, vol: 0.2 * v });
        break;
      case "squash":
        this.noise(0.25, { type: "lowpass", f: 900, f2: 120, vol: 0.45 * v });
        this.tone(180, 0.25, { type: "square", f2: 50, vol: 0.15 * v });
        break;
      case "heart":
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, { type: "triangle", vol: 0.14 * v, at: i * 0.06 }));
        break;
      case "launch":
        this.noise(0.35, { type: "bandpass", f: 3000, f2: 500, q: 1.2, vol: 0.3 * v });
        this.tone(160 * r, 0.2, { type: "sawtooth", f2: 420, vol: 0.06 * v });
        break;
    }
  }

  // ---------- music ----------
  music(theme: Theme) {
    if (theme === this.theme) return;
    this.theme = theme;
    this.step = 0;
    if (!theme) {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      return;
    }
    if (this.ctx && !this.timer) this.startSequencer();
  }

  private startSequencer() {
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 60);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.theme) return;
    const lobby = this.theme === "lobby";
    const bpm = lobby ? 104 : 140;
    const stepDur = 60 / bpm / 2; // eighth notes
    // chord roots (midi) per bar
    const prog = lobby ? [60, 55, 57, 53] : [57, 53, 60, 55];
    const quality = lobby ? [0, 0, 1, 0] : [1, 0, 0, 0]; // 1 = minor
    while (this.nextTime < ctx.currentTime + 0.25) {
      const s = this.step % 32;
      const bar = Math.floor(s / 8);
      const root = prog[bar];
      const third = quality[bar] ? 3 : 4;
      const chord = [root, root + third, root + 7, root + 12];
      const at = this.nextTime - ctx.currentTime;
      const b = this.musicBus;
      const beat = s % 8;
      // bass
      if (beat % 2 === 0) this.tone(midi(root - 24 + (beat === 6 && !lobby ? 7 : 0)), stepDur * 1.6, { type: "triangle", vol: 0.22, at, bus: b });
      // arpeggio
      const arp = lobby ? [0, 2, 1, 2, 3, 2, 1, 2] : [0, 1, 2, 3, 2, 1, 2, 3];
      if (lobby ? beat !== 7 : true) {
        this.tone(midi(chord[arp[beat]] + (lobby ? 0 : 12)), stepDur * 0.9, { type: lobby ? "triangle" : "square", vol: lobby ? 0.07 : 0.035, at, bus: b });
      }
      // drums
      if (beat === 0 || beat === 4 || (!lobby && beat === 5)) this.tone(150, 0.12, { type: "sine", f2: 45, vol: 0.35, at, bus: b });
      if (beat === 2 || beat === 6) this.noise(0.12, { type: "bandpass", f: 1800, q: 0.7, vol: lobby ? 0.08 : 0.14, at, bus: b });
      if (!lobby || beat % 2 === 1) this.noise(0.03, { type: "highpass", f: 7000, vol: 0.06, at, bus: b });
      this.nextTime += stepDur;
      this.step++;
    }
  }
}

export const sound = new SoundEngine();

export function vibrate(ms: number | number[]) {
  try {
    // Browsers refuse (and log an error) until the user has touched the page.
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    navigator.vibrate?.(ms);
  } catch {}
}
