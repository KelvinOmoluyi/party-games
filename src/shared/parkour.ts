// Rooftop Run course: built from a seed, identically on the server and on every phone.
// Coordinates: x grows to the right, y grows DOWN; a roof's top surface is at `y`.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Roof extends Box {
  style: number; // facade style for drawing
}

export interface Course {
  roofs: Roof[];
  crates: Box[]; // solid boxes standing on roofs
  walls: Box[]; // tall solid concrete walls
  spikes: Box[]; // touch = restart at checkpoint
  checkpoints: { x: number; y: number }[];
  finishX: number;
  length: number;
}

export const PARKOUR = {
  RUN: 8.5,
  GRAVITY: 42,
  JUMP: 15.5,
  JUMP2: 13,
  W: 0.7,
  H: 1.4,
  FALL_Y: 16,
  LENGTH: 230,
};

export function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROOF_DEPTH = 40;

export function makeCourse(seed: number, length = PARKOUR.LENGTH): Course {
  const r = seededRng(seed);
  const roofs: Roof[] = [];
  const crates: Box[] = [];
  const walls: Box[] = [];
  const spikes: Box[] = [];
  const checkpoints: { x: number; y: number }[] = [{ x: 3, y: 0 }];

  const roof = (x: number, y: number, w: number) => roofs.push({ x, y, w, h: ROOF_DEPTH, style: Math.floor(r() * 5) });

  roof(-12, 0, 32); // long start roof
  let x = 20;
  let y = 0;
  let lastCp = 0;
  let difficulty = 0;
  while (x < length) {
    difficulty = Math.min(1, x / length);
    const gap = 2.2 + r() * (1.6 + difficulty * 1.2); // 2.2 .. 5.0
    let ny = y + Math.round((r() * 4 - 1.5) * 2) / 2; // -1.5 (climb) .. +2.5 (drop), steps of 0.5
    ny = Math.max(-4, Math.min(3, ny));
    if (ny < y - 1.5) ny = y - 1.5; // climbs stay easy
    if (ny < y && gap > 4) ny = y; // long gaps are never uphill
    const nx = x + gap;
    const w = 11 + r() * 12;
    roof(nx, ny, w);
    // obstacles on the roof, spaced so you always have room to land and take off
    let pos = nx + 3.5;
    while (pos < nx + w - 4) {
      const k = r();
      if (k < 0.32) {
        const stack = r() < 0.3 + difficulty * 0.3 ? 2 : 1;
        crates.push({ x: pos, y: ny - 1 * stack, w: 1.1, h: 1 * stack });
        pos += 1.1;
      } else if (k < 0.55) {
        const len = 1 + r() * (0.8 + difficulty * 0.8);
        spikes.push({ x: pos, y: ny - 0.4, w: len, h: 0.4 });
        pos += len;
      } else if (k < 0.66) {
        walls.push({ x: pos, y: ny - 2, w: 0.8, h: 2 });
        pos += 0.8;
      }
      pos += 4.5 + r() * 4;
    }
    if (nx - lastCp > 30) {
      checkpoints.push({ x: nx + 1.2, y: ny });
      lastCp = nx;
    }
    x = nx + w;
    y = ny;
  }
  const fx = x + 3.5;
  roof(fx, y, 30);
  return { roofs, crates, walls, spikes, checkpoints, finishX: fx + 10, length: fx + 10 };
}

export function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
