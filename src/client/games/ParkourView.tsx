"use client";

import { useMemo, useRef } from "react";
import { makeCourse, PARKOUR } from "../../shared/parkour";
import { type ParkourState, type PlayerInfo, TEAMS } from "../../shared/types";
import { Smoother, useCanvas } from "../draw";
import { drawFlag, drawRunner } from "../render/characters";
import { Particles, Shake } from "../render/particles";
import { bigText, type Ctx, darken, drawTag, fillStroke, Layer, lighten, rng, TAU } from "../render/paint";
import { sound, vibrate } from "../sound";

const FACADES = ["#6b4f7a", "#4f6488", "#8a5560", "#4f6f62", "#7a6a4f"];

/** A wide strip of city skyline, tiled horizontally for parallax. */
function paintSkyline(ctx: Ctx, w: number, h: number, base: number, color: string, windows: string, seed: number) {
  const r = rng(seed);
  let x = 0;
  while (x < w) {
    const bw = 40 + r() * 90;
    const bh = h * (0.18 + r() * 0.35);
    ctx.fillStyle = color;
    ctx.fillRect(x, base - bh, bw, bh + 4);
    if (r() < 0.3) ctx.fillRect(x + bw * 0.4, base - bh - 18, 3, 18); // antenna
    ctx.fillStyle = windows;
    for (let wy = base - bh + 8; wy < base - 6; wy += 12) {
      for (let wx = x + 6; wx < x + bw - 8; wx += 11) {
        if (r() < 0.35) ctx.fillRect(wx, wy, 5, 6);
      }
    }
    x += bw + 4 + r() * 10;
  }
}

export function ParkourView({ game, players, myId }: { game: ParkourState; players: PlayerInfo[]; myId: string | null }) {
  const course = useMemo(() => makeCourse(game.seed), [game.seed]);
  const st = useRef({
    game,
    prev: null as ParkourState | null,
    smooth: new Smoother(),
    sky: new Layer(),
    far: new Layer(),
    mid: new Layer(),
    fx: new Particles(),
    shake: new Shake(),
    camX: 0,
    camY: 0,
    names: new Map<string, string>(),
  }).current;
  st.game = game;
  st.names = new Map(players.map((p) => [p.id, p.name]));

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    const s = Math.max(14, h / 12.5);
    const me = g.runners.find((r) => r.id === myId);
    const leader = [...g.runners].sort((a, b) => b.x - a.x)[0];
    const focus = me ?? leader;
    if (focus) {
      st.camX += (focus.x - st.camX) * Math.min(1, dt * 6);
      st.camY += (focus.y - st.camY) * Math.min(1, dt * 2.5);
    }
    const anchorX = w * 0.3;
    const anchorY = h * 0.64;
    const X = (x: number) => (x - st.camX) * s + anchorX;
    const Y = (y: number) => (y - st.camY) * s + anchorY;

    // ---- events ----
    const prev = st.prev;
    if (prev && prev !== g) {
      for (const r of g.runners) {
        const p = prev.runners.find((q) => q.id === r.id);
        if (!p) continue;
        const mine = r.id === myId;
        if (mine && p.vy > -5 && r.vy < -10) sound.play("jump");
        if (!p.dead && r.dead) {
          st.fx.burst("smoke", X(p.x), Y(p.y) - s * 0.7, 10, { speed: s * 3, size: s * 0.3, life: 0.7, color: ["#ffffff", "#d8d0e8"] });
          if (mine) {
            sound.play("fall");
            st.shake.kick(10);
            vibrate([80, 40, 80]);
          }
        }
        if (mine && r.cp > p.cp) {
          sound.play("pickup");
          st.fx.floatText(X(r.x), Y(r.y) - s * 2.4, "CHECKPOINT!", "#7dff8f", Math.max(16, s * 0.8));
        }
        if (p.finishedAt === null && r.finishedAt !== null) {
          st.fx.confetti(X(course.finishX), Y(r.y) - s * 2, mine ? 70 : 20, [TEAMS[r.team].color, "#ffffff", "#ffd34d"], s * 12);
          sound.play(mine ? "win" : "score", { vol: mine ? 1 : 0.4 });
          if (mine) vibrate([40, 30, 40, 30, 120]);
        }
      }
    }
    st.prev = g;

    // ---- sky + parallax skyline ----
    ctx.drawImage(
      st.sky.get(`${w}x${h}x${dpr}`, w, h, dpr, (c) => {
        const gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, "#2b1a5c");
        gr.addColorStop(0.55, "#c4507a");
        gr.addColorStop(1, "#ffb067");
        c.fillStyle = gr;
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(255,230,160,0.9)";
        c.beginPath();
        c.arc(w * 0.75, h * 0.42, h * 0.12, 0, TAU);
        c.fill();
        const r = rng(3);
        c.fillStyle = "rgba(255,255,255,0.7)";
        for (let i = 0; i < 40; i++) c.fillRect(r() * w, r() * h * 0.35, 1.5, 1.5);
      }),
      0,
      0,
      w,
      h,
    );
    const stripW = 1400;
    const layers: [Layer, number, string, string, number, number][] = [
      [st.far, 0.12, "#3a2a66", "rgba(255,210,120,0.35)", 0.78, 11],
      [st.mid, 0.3, "#24183f", "rgba(255,220,130,0.55)", 0.9, 12],
    ];
    for (const [layer, factor, col, win, base, seed] of layers) {
      const img = layer.get(`${h}x${dpr}`, stripW, h, dpr, (c) => paintSkyline(c, stripW, h, h * base, col, win, seed));
      let off = -((st.camX * s * factor) % stripW);
      if (off > 0) off -= stripW;
      for (let x = off; x < w; x += stripW) ctx.drawImage(img, x, 0, stripW, h);
    }

    st.shake.apply(ctx, dt);
    const viewL = st.camX - anchorX / s - 2;
    const viewR = st.camX + (w - anchorX) / s + 2;
    const inView = (b: { x: number; w: number }) => b.x + b.w > viewL && b.x < viewR;

    // ---- buildings ----
    for (const roof of course.roofs) {
      if (!inView(roof)) continue;
      const x = X(roof.x);
      const y = Y(roof.y);
      const bw = roof.w * s;
      const col = FACADES[roof.style % FACADES.length];
      ctx.fillStyle = col;
      ctx.fillRect(x, y, bw, h - y + 4);
      ctx.fillStyle = darken(col, 0.25);
      ctx.fillRect(x + bw - s * 0.4, y, s * 0.4, h - y + 4);
      // windows
      const r = rng(Math.floor(roof.x * 13));
      for (let wy = y + s * 0.9; wy < h; wy += s * 1.1) {
        for (let wx = x + s * 0.6; wx < x + bw - s * 0.9; wx += s * 1.2) {
          const lit = r() < 0.45;
          ctx.fillStyle = lit ? "#ffd98a" : darken(col, 0.4);
          ctx.fillRect(wx, wy, s * 0.55, s * 0.65);
          if (lit) {
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.fillRect(wx, wy, s * 0.55, s * 0.12);
          }
        }
      }
      // roof ledge
      ctx.beginPath();
      ctx.rect(x - s * 0.15, y - s * 0.12, bw + s * 0.3, s * 0.4);
      fillStroke(ctx, lighten(col, 0.3), darken(col, 0.55), Math.max(1.5, s * 0.06));
    }
    // crates
    for (const c of course.crates) {
      if (!inView(c)) continue;
      const x = X(c.x);
      const y = Y(c.y);
      const n = Math.round(c.h);
      for (let k = 0; k < n; k++) {
        const cy = y + (k * c.h * s) / n;
        const ch = (c.h * s) / n;
        ctx.beginPath();
        ctx.rect(x, cy, c.w * s, ch);
        fillStroke(ctx, "#cf9455", "#5a3815", Math.max(1.5, s * 0.06));
        ctx.strokeStyle = "#9c6630";
        ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.strokeRect(x + s * 0.12, cy + s * 0.12, c.w * s - s * 0.24, ch - s * 0.24);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.12, cy + s * 0.12);
        ctx.lineTo(x + c.w * s - s * 0.12, cy + ch - s * 0.12);
        ctx.stroke();
      }
    }
    // concrete walls
    for (const wl of course.walls) {
      if (!inView(wl)) continue;
      const x = X(wl.x);
      const y = Y(wl.y);
      ctx.beginPath();
      ctx.rect(x, y, wl.w * s, wl.h * s);
      fillStroke(ctx, "#b9b5ac", "#3e3b36", Math.max(1.5, s * 0.06));
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, wl.w * s, s * 0.45);
      ctx.clip();
      ctx.fillStyle = "#ffcc2e";
      ctx.fillRect(x, y, wl.w * s, s * 0.45);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = s * 0.12;
      for (let k = -2; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * s * 0.3, y);
        ctx.lineTo(x + k * s * 0.3 + s * 0.5, y + s * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
    // spikes
    for (const sp of course.spikes) {
      if (!inView(sp)) continue;
      const x = X(sp.x);
      const base = Y(sp.y + sp.h);
      const n = Math.max(2, Math.round(sp.w / 0.4));
      const tw = (sp.w * s) / n;
      for (let k = 0; k < n; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * tw, base);
        ctx.lineTo(x + k * tw + tw / 2, base - sp.h * s * 1.3);
        ctx.lineTo(x + (k + 1) * tw, base);
        ctx.closePath();
        fillStroke(ctx, "#c9ced8", "#2a2d35", Math.max(1, s * 0.05));
        ctx.fillStyle = "#e8323c";
        ctx.beginPath();
        ctx.moveTo(x + k * tw + tw * 0.32, base - sp.h * s * 0.9);
        ctx.lineTo(x + k * tw + tw / 2, base - sp.h * s * 1.3);
        ctx.lineTo(x + k * tw + tw * 0.68, base - sp.h * s * 0.9);
        ctx.fill();
      }
    }
    // checkpoints
    course.checkpoints.forEach((cp, i) => {
      if (i === 0 || cp.x < viewL || cp.x > viewR) return;
      const reached = (me?.cp ?? -1) >= i;
      drawFlag(ctx, X(cp.x - 0.8), Y(cp.y), s * 1.9, reached ? "#2ecc71" : "#ffd34d", now);
    });
    // finish line
    if (course.finishX > viewL && course.finishX < viewR) {
      const fx = X(course.finishX);
      const roof = course.roofs[course.roofs.length - 1];
      const fy = Y(roof.y);
      const sq = s * 0.35;
      for (let k = 0; k < 12; k++) {
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = (k + c) % 2 ? "#111" : "#fff";
          ctx.fillRect(fx + c * sq, fy - s * 4 + k * sq, sq, sq);
        }
      }
      ctx.beginPath();
      ctx.roundRect(fx - s * 1.6, fy - s * 5.4, s * 3.9, s * 1.1, s * 0.3);
      fillStroke(ctx, "#ff4d5e", "#3a1020", 2);
      bigText(ctx, "FINISH", fx + s * 0.35, fy - s * 4.85, s * 0.8, "#ffffff");
    }

    // ---- runners: others as ghosts, me on top ----
    const order = [...g.runners].sort((a) => (a.id === myId ? 1 : -1));
    for (const r of order) {
      if (r.dead) continue;
      const mine = r.id === myId;
      const x = st.smooth.get(r.id + "x", r.x, dt, 22, 4);
      const y = st.smooth.get(r.id + "y", r.y, dt, 22, 4);
      if (x < viewL - 2 || x > viewR + 2) continue;
      const color = TEAMS[r.team].color;
      const pose = r.finishedAt !== null ? "cheer" : !r.grounded ? "jump" : "run";
      drawRunner(ctx, X(x), Y(y), s * 1.55, color, { pose, phase: pose === "cheer" ? now / 110 : x * 1.25, lean: pose === "run" ? 0.22 : 0, me: mine, alpha: mine ? 1 : 0.6 });
      if (r.grounded && pose === "run" && Math.random() < (mine ? 0.35 : 0.1)) {
        st.fx.add({ kind: "dust", x: X(x) - s * 0.3, y: Y(y), vx: -s * 2, vy: -s * 0.6, size: s * 0.08, grow: s * 0.5, life: 0.4, color: "#e8d8c8", drag: 3 });
      }
      drawTag(ctx, X(x), Y(y) - s * 1.75, mine ? "YOU" : (st.names.get(r.id) ?? ""), color, mine, Math.max(9, Math.min(12, s * 0.42)));
    }
    st.fx.update(dt);
    st.fx.draw(ctx);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ---- progress bar ----
    const barL = w * 0.25;
    const barR = w * 0.75;
    const barY = 58;
    ctx.fillStyle = "rgba(20,10,40,0.55)";
    ctx.beginPath();
    ctx.roundRect(barL - 10, barY - 10, barR - barL + 20, 20, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(barL, barY);
    ctx.lineTo(barR, barY);
    ctx.stroke();
    ctx.font = "14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🏁", barR + 4, barY - 1);
    for (const r of order) {
      const p = Math.max(0, Math.min(1, r.x / course.finishX));
      const mine = r.id === myId;
      ctx.beginPath();
      ctx.arc(barL + (barR - barL) * p, barY, mine ? 7 : 5, 0, TAU);
      fillStroke(ctx, TEAMS[r.team].color, mine ? "#ffffff" : "#1d1530", mine ? 2.5 : 1.5);
    }
    if (me?.dead) bigText(ctx, "OOPS! BACK TO THE FLAG", w / 2, h * 0.4, Math.min(34, w / 18), "#ffd34d");
    else if (me?.finishedAt != null) bigText(ctx, "FINISHED!", w / 2, h * 0.32, Math.min(46, w / 12), "#7dff8f", 1 + Math.sin(now / 130) * 0.04);
    void PARKOUR;
  });

  return <canvas ref={canvasRef} className="view-canvas" />;
}
