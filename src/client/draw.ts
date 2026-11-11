"use client";

import { useEffect, useRef } from "react";

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, now: number, dt: number, dpr: number) => void;

/** Canvas that redraws every animation frame using the latest draw function. */
export function useCanvas(draw: DrawFn) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = () => {
      const c = ref.current;
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (c) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = c.clientWidth;
        const h = c.clientHeight;
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
        const ctx = c.getContext("2d");
        if (ctx && w > 0 && h > 0) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);
          ctx.save();
          drawRef.current(ctx, w, h, now, dt, dpr);
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return ref;
}

/** Smooths 30Hz server values into 60fps motion. */
export class Smoother {
  private vals = new Map<string, number>();
  get(key: string, target: number, dt: number, speed = 18, snap = Infinity): number {
    const cur = this.vals.get(key);
    if (cur === undefined || Math.abs(cur - target) > snap) {
      this.vals.set(key, target);
      return target;
    }
    const v = cur + (target - cur) * (1 - Math.exp(-speed * dt));
    this.vals.set(key, v);
    return v;
  }
}

/** Tracks which way each moving thing faces, plus a walk-cycle phase. */
export class Motion {
  private m = new Map<string, { x: number; y: number; a: number; walk: number; speed: number }>();
  update(id: string, x: number, y: number, dt: number, fallbackAngle = 0) {
    let e = this.m.get(id);
    if (!e) {
      e = { x, y, a: fallbackAngle, walk: Math.random() * 6, speed: 0 };
      this.m.set(id, e);
    }
    const dx = x - e.x;
    const dy = y - e.y;
    const d = Math.hypot(dx, dy);
    const sp = dt > 0 ? d / dt : 0;
    e.speed += (sp - e.speed) * Math.min(1, dt * 10);
    if (d > 0.001 && sp > 0.4) {
      const target = Math.atan2(dy, dx);
      let diff = target - e.a;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      e.a += diff * Math.min(1, dt * 14);
    }
    e.walk += Math.min(e.speed, 12) * dt * 2.2;
    e.x = x;
    e.y = y;
    return e;
  }
}
