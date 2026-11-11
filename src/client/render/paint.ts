// Low-level drawing helpers: colours, seeded randomness, cached layers, ground textures.

export const TAU = Math.PI * 2;
export type Ctx = CanvasRenderingContext2D;

/**
 * Canvas font stacks. next/font gives the web fonts hashed family names, so we
 * read the real names from the CSS variables set in layout.tsx.
 */
export const FONTS = {
  display: '"Lilita One", "Arial Black", system-ui, sans-serif',
  body: '"Nunito", system-ui, sans-serif',
};
let epoch = 0;
/** Changes once the web fonts finish loading, so cached text layers can redraw. */
export const fontEpoch = () => epoch;
if (typeof window !== "undefined") {
  const css = getComputedStyle(document.documentElement);
  const d = css.getPropertyValue("--font-display").trim();
  const b = css.getPropertyValue("--font-body").trim();
  if (d) FONTS.display = `${d}, "Arial Black", sans-serif`;
  if (b) FONTS.body = `${b}, system-ui, sans-serif`;
  document.fonts?.ready.then(() => epoch++);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix two hex colours, t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
export const darken = (c: string, t: number) => mix(c, "#000000", t);
export const lighten = (c: string, t: number) => mix(c, "#ffffff", t);
export function alpha(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Deterministic random generator so cached scenery looks the same every redraw. */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An offscreen canvas that's only redrawn when its key changes (e.g. on resize). */
export class Layer {
  private key = "";
  canvas: HTMLCanvasElement | null = null;
  get(key: string, w: number, h: number, dpr: number, draw: (ctx: Ctx) => void): HTMLCanvasElement {
    if (key !== this.key || !this.canvas) {
      const c = this.canvas ?? document.createElement("canvas");
      c.width = Math.max(1, Math.ceil(w * dpr));
      c.height = Math.max(1, Math.ceil(h * dpr));
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      draw(ctx);
      this.canvas = c;
      this.key = key;
    }
    return this.canvas;
  }
  /** Draw onto the cached layer later (e.g. tyre tracks, scorch marks). */
  paint(dpr: number, draw: (ctx: Ctx) => void) {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx);
  }
  reset() {
    this.key = "";
  }
}

export interface Fit {
  s: number; // pixels per world unit
  ox: number;
  oy: number;
}

/** Fit a W×H world into the canvas, leaving room for the HUD at the top. */
export function fitWorld(w: number, h: number, W: number, H: number, top = 44, side = 8, bottom = 8): Fit {
  const aw = w - side * 2;
  const ah = h - top - bottom;
  const s = Math.max(1, Math.min(aw / W, ah / H));
  return { s, ox: (w - W * s) / 2, oy: top + (ah - H * s) / 2 };
}

export function shadowEllipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.25) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

/** Fill a path then outline it (cartoon look). */
export function fillStroke(ctx: Ctx, fill: string, stroke: string, lw: number) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

// ---------- Ground textures ----------

export function paintGrass(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, base = "#7cc84f", unit = 20) {
  const r = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  // soft colour variation
  const blobs = Math.ceil((w * h) / (unit * unit * 1.5));
  for (let i = 0; i < blobs; i++) {
    ctx.fillStyle = r() < 0.5 ? alpha(lighten(base, 0.25), 0.18) : alpha(darken(base, 0.2), 0.14);
    ctx.beginPath();
    ctx.ellipse(x + r() * w, y + r() * h, unit * (0.8 + r() * 2.2), unit * (0.5 + r() * 1.4), r() * 3, 0, TAU);
    ctx.fill();
  }
  // grass tufts
  const tufts = Math.ceil((w * h) / (unit * unit * 0.6));
  ctx.lineCap = "round";
  for (let i = 0; i < tufts; i++) {
    const tx = x + r() * w;
    const ty = y + r() * h;
    const s = unit * (0.12 + r() * 0.14);
    ctx.strokeStyle = alpha(darken(base, 0.3), 0.55);
    ctx.lineWidth = Math.max(1, unit * 0.05);
    ctx.beginPath();
    ctx.moveTo(tx - s, ty - s);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx + s * 0.2, ty - s * 1.3);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + s, ty - s * 0.9);
    ctx.stroke();
  }
  // tiny flowers
  const flowers = Math.ceil((w * h) / (unit * unit * 8));
  for (let i = 0; i < flowers; i++) {
    const fx = x + r() * w;
    const fy = y + r() * h;
    const c = ["#ffffff", "#ffe066", "#ff9ecb", "#c3a6ff"][Math.floor(r() * 4)];
    ctx.fillStyle = c;
    for (let p = 0; p < 4; p++) {
      ctx.beginPath();
      ctx.arc(fx + Math.cos((p * TAU) / 4) * unit * 0.07, fy + Math.sin((p * TAU) / 4) * unit * 0.07, unit * 0.06, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#f5a623";
    ctx.beginPath();
    ctx.arc(fx, fy, unit * 0.04, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function paintSand(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, base = "#e3c58f", unit = 20) {
  const r = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  const blobs = Math.ceil((w * h) / (unit * unit * 1.2));
  for (let i = 0; i < blobs; i++) {
    ctx.fillStyle = r() < 0.5 ? alpha(lighten(base, 0.3), 0.2) : alpha(darken(base, 0.15), 0.16);
    ctx.beginPath();
    ctx.ellipse(x + r() * w, y + r() * h, unit * (1 + r() * 2.5), unit * (0.4 + r() * 0.9), r() * 0.4, 0, TAU);
    ctx.fill();
  }
  // wind ripples
  ctx.strokeStyle = alpha(darken(base, 0.18), 0.35);
  ctx.lineWidth = Math.max(1, unit * 0.05);
  ctx.lineCap = "round";
  const ripples = Math.ceil((w * h) / (unit * unit * 3));
  for (let i = 0; i < ripples; i++) {
    const rx = x + r() * w;
    const ry = y + r() * h;
    const len = unit * (0.6 + r() * 1.2);
    ctx.beginPath();
    ctx.moveTo(rx - len, ry);
    ctx.quadraticCurveTo(rx, ry - unit * 0.2, rx + len, ry);
    ctx.stroke();
  }
  // pebbles
  const pebbles = Math.ceil((w * h) / (unit * unit * 1.5));
  for (let i = 0; i < pebbles; i++) {
    ctx.fillStyle = alpha(darken(base, 0.35 + r() * 0.2), 0.6);
    ctx.beginPath();
    ctx.ellipse(x + r() * w, y + r() * h, unit * (0.05 + r() * 0.08), unit * (0.04 + r() * 0.06), r() * 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function paintDirt(ctx: Ctx, cx: number, cy: number, rad: number, seed: number, base = "#9b6b43", unit = 20) {
  const r = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, TAU);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  const n = Math.ceil((rad * rad) / (unit * unit * 0.4));
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * rad;
    ctx.fillStyle = r() < 0.5 ? alpha(lighten(base, 0.2), 0.25) : alpha(darken(base, 0.25), 0.25);
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, unit * (0.2 + r() * 0.9), unit * (0.15 + r() * 0.5), r() * 3, 0, TAU);
    ctx.fill();
  }
  // inner shadow at the rim
  const g = ctx.createRadialGradient(cx, cy, rad * 0.75, cx, cy, rad);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  ctx.restore();
}

// ---------- Scenery props (top-down, cartoon) ----------

export function drawTree(ctx: Ctx, x: number, y: number, size: number, seed: number) {
  const r = rng(seed);
  shadowEllipse(ctx, x + size * 0.25, y + size * 0.3, size * 1.05, size * 0.9, 0.28);
  const base = ["#3f9e3a", "#4aa843", "#378f3c"][Math.floor(r() * 3)];
  // trunk peeking
  ctx.fillStyle = "#6b4426";
  ctx.beginPath();
  ctx.arc(x + size * 0.1, y + size * 0.15, size * 0.22, 0, TAU);
  ctx.fill();
  // canopy: clustered circles with outline
  const blobs = [
    [0, 0, 1],
    [-0.55, 0.15, 0.62],
    [0.5, 0.2, 0.6],
    [0.1, -0.55, 0.6],
    [-0.25, 0.55, 0.55],
    [0.35, 0.55, 0.5],
  ];
  ctx.fillStyle = darken(base, 0.45);
  for (const [bx, by, br] of blobs) {
    ctx.beginPath();
    ctx.arc(x + bx * size * 0.6, y + by * size * 0.6, br * size * 0.55 + size * 0.06, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = base;
  for (const [bx, by, br] of blobs) {
    ctx.beginPath();
    ctx.arc(x + bx * size * 0.6, y + by * size * 0.6, br * size * 0.55, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = lighten(base, 0.22);
  for (const [bx, by, br] of blobs) {
    ctx.beginPath();
    ctx.arc(x + bx * size * 0.6 - size * 0.12, y + by * size * 0.6 - size * 0.14, br * size * 0.3, 0, TAU);
    ctx.fill();
  }
}

export function drawBush(ctx: Ctx, x: number, y: number, size: number, seed: number) {
  const r = rng(seed);
  shadowEllipse(ctx, x + size * 0.15, y + size * 0.2, size * 0.8, size * 0.55, 0.22);
  const base = r() < 0.5 ? "#4fae47" : "#5bb84c";
  const pts = [[-0.4, 0.05, 0.45], [0.35, 0.1, 0.45], [0, -0.2, 0.5]];
  ctx.fillStyle = darken(base, 0.45);
  for (const [bx, by, br] of pts) {
    ctx.beginPath();
    ctx.arc(x + bx * size, y + by * size, br * size + size * 0.07, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = base;
  for (const [bx, by, br] of pts) {
    ctx.beginPath();
    ctx.arc(x + bx * size, y + by * size, br * size, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = lighten(base, 0.25);
  for (const [bx, by, br] of pts) {
    ctx.beginPath();
    ctx.arc(x + bx * size - size * 0.1, y + by * size - size * 0.12, br * size * 0.4, 0, TAU);
    ctx.fill();
  }
  if (r() < 0.5) {
    ctx.fillStyle = "#ff5b6e";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + (r() - 0.5) * size, y + (r() - 0.6) * size * 0.7, size * 0.08, 0, TAU);
      ctx.fill();
    }
  }
}

export function drawRock(ctx: Ctx, x: number, y: number, size: number, seed: number, base = "#a39a8c") {
  const r = rng(seed);
  shadowEllipse(ctx, x + size * 0.15, y + size * 0.25, size * 0.95, size * 0.6, 0.25);
  const n = 7;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const d = size * (0.7 + r() * 0.3);
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.75]);
  }
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  fillStroke(ctx, base, darken(base, 0.5), Math.max(1.2, size * 0.1));
  ctx.fillStyle = lighten(base, 0.3);
  ctx.beginPath();
  ctx.ellipse(x - size * 0.2, y - size * 0.2, size * 0.35, size * 0.2, -0.4, 0, TAU);
  ctx.fill();
}

export function drawCactus(ctx: Ctx, x: number, y: number, size: number) {
  shadowEllipse(ctx, x + size * 0.3, y + size * 0.1, size * 0.6, size * 0.2, 0.25);
  const g = "#4c9a50";
  const o = darken(g, 0.5);
  const lw = Math.max(1.2, size * 0.09);
  const arm = (ax: number, ay: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.roundRect(ax - w / 2, ay - h, w, h, w / 2);
    fillStroke(ctx, g, o, lw);
  };
  arm(x - size * 0.42, y - size * 0.55, size * 0.24, size * 0.5);
  arm(x + size * 0.42, y - size * 0.75, size * 0.24, size * 0.55);
  ctx.beginPath();
  ctx.roundRect(x - size * 0.44, y - size * 0.62, size * 0.4, size * 0.2, size * 0.1);
  ctx.roundRect(x + size * 0.04, y - size * 0.78, size * 0.4, size * 0.2, size * 0.1);
  fillStroke(ctx, g, o, lw);
  arm(x, y, size * 0.36, size * 1.3);
  ctx.strokeStyle = lighten(g, 0.25);
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.06, y - size * 0.1);
  ctx.lineTo(x - size * 0.06, y - size * 1.15);
  ctx.stroke();
}

export function drawBarrel(ctx: Ctx, x: number, y: number, size: number, color = "#c0392b") {
  shadowEllipse(ctx, x + size * 0.2, y + size * 0.25, size * 0.75, size * 0.6, 0.28);
  ctx.beginPath();
  ctx.arc(x, y, size * 0.6, 0, TAU);
  fillStroke(ctx, color, darken(color, 0.55), Math.max(1.2, size * 0.1));
  ctx.strokeStyle = darken(color, 0.3);
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.beginPath();
  ctx.arc(x, y, size * 0.4, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = lighten(color, 0.35);
  ctx.beginPath();
  ctx.arc(x - size * 0.2, y - size * 0.2, size * 0.13, 0, TAU);
  ctx.fill();
}

/** Rounded pill label above a character. */
export function drawTag(ctx: Ctx, x: number, y: number, text: string, color: string, me = false, fs = 11) {
  ctx.save();
  ctx.font = `800 ${fs}px ${FONTS.body}`;
  const tw = ctx.measureText(text).width;
  const pw = tw + fs * 0.9;
  const ph = fs * 1.45;
  ctx.beginPath();
  ctx.roundRect(x - pw / 2, y - ph, pw, ph, ph / 2);
  ctx.fillStyle = me ? "#ffffff" : alpha("#000000", 0.55);
  ctx.fill();
  if (!me) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x, y + 4);
  ctx.closePath();
  ctx.fillStyle = me ? "#ffffff" : alpha("#000000", 0.55);
  ctx.fill();
  ctx.fillStyle = me ? darken(color, 0.35) : "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - ph / 2 + 0.5);
  ctx.restore();
}

/** Big outlined game text, e.g. "RED WINS!". */
export function bigText(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.font = `${size}px ${FONTS.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.22;
  ctx.strokeStyle = "#1a1030";
  ctx.strokeText(text, 0, size * 0.06);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
