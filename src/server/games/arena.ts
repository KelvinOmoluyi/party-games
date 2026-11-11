import type { Wall } from "../../shared/types";

export interface Body {
  x: number;
  y: number;
}

/** Push a circle out of a rectangle. Returns true if it was touching. */
export function pushOutOfWall(b: Body, r: number, w: Wall): boolean {
  const cx = Math.max(w.x, Math.min(b.x, w.x + w.w));
  const cy = Math.max(w.y, Math.min(b.y, w.y + w.h));
  const dx = b.x - cx;
  const dy = b.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= r) return false;
  if (d < 1e-6) {
    // centre inside the wall: push out along the shortest axis
    const left = b.x - w.x;
    const right = w.x + w.w - b.x;
    const top = b.y - w.y;
    const bottom = w.y + w.h - b.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) b.x = w.x - r;
    else if (m === right) b.x = w.x + w.w + r;
    else if (m === top) b.y = w.y - r;
    else b.y = w.y + w.h + r;
    return true;
  }
  b.x = cx + (dx / d) * r;
  b.y = cy + (dy / d) * r;
  return true;
}

export function pointInWall(x: number, y: number, w: Wall) {
  return x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h;
}

export function clampToArena(b: Body, r: number, w: number, h: number) {
  b.x = Math.max(r, Math.min(w - r, b.x));
  b.y = Math.max(r, Math.min(h - r, b.y));
}

/** Soft-separate overlapping circles. */
export function separate(a: Body, b: Body, minD: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  if (d >= minD) return;
  const o = (minD - d) / 2;
  a.x -= (dx / d) * o;
  a.y -= (dy / d) * o;
  b.x += (dx / d) * o;
  b.y += (dy / d) * o;
}

export function normInput(x: unknown, y: unknown) {
  let ix = Number(x) || 0;
  let iy = Number(y) || 0;
  const m = Math.hypot(ix, iy);
  if (m > 1) {
    ix /= m;
    iy /= m;
  }
  return { x: ix, y: iy, mag: Math.min(1, m) };
}

export const r2 = (n: number) => Math.round(n * 100) / 100;

/** A top-down character that runs with the joystick and can dash. */
export interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ix: number;
  iy: number;
  fx: number; // facing
  fy: number;
  dashT: number;
  dashCd: number;
}

export function newMover(x: number, y: number, fx = 1, fy = 0): Mover {
  return { x, y, vx: 0, vy: 0, ix: 0, iy: 0, fx, fy, dashT: 0, dashCd: 0 };
}

export function steer(m: Mover, x: unknown, y: unknown) {
  const v = normInput(x, y);
  m.ix = v.x;
  m.iy = v.y;
  if (v.mag > 0.2) {
    m.fx = v.x / v.mag;
    m.fy = v.y / v.mag;
  }
}

export function moveMover(m: Mover, dt: number, speed: number, active = true) {
  m.dashT = Math.max(0, m.dashT - dt);
  m.dashCd = Math.max(0, m.dashCd - dt);
  const tx = active ? m.ix * speed : 0;
  const ty = active ? m.iy * speed : 0;
  const k = 1 - Math.exp(-(m.dashT > 0 ? 1 : 12) * dt);
  m.vx += (tx - m.vx) * k;
  m.vy += (ty - m.vy) * k;
  m.x += m.vx * dt;
  m.y += m.vy * dt;
}

export function tryDash(m: Mover, speed: number, time: number, cooldown: number) {
  if (m.dashCd > 0) return false;
  m.vx = m.fx * speed;
  m.vy = m.fy * speed;
  m.dashT = time;
  m.dashCd = cooldown;
  return true;
}

/** Spawn spots in each team's corner, spread out a little per player. */
export function cornerSpawn(corner: { x: number; y: number }, k: number, W: number, H: number) {
  const toC = Math.atan2(H / 2 - corner.y, W / 2 - corner.x);
  const side = ((k % 4) - 1.5) * 1.2;
  return {
    x: corner.x + Math.cos(toC + Math.PI / 2) * side,
    y: corner.y + Math.sin(toC + Math.PI / 2) * side,
    fx: Math.cos(toC),
    fy: Math.sin(toC),
  };
}

/** Arena size grows with player count, like the tank and chicken maps. */
export const arenaFor = (players: number) => (players > 4 ? { W: 40, H: 20 } : { W: 32, H: 18 });
