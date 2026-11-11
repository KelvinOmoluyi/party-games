"use client";

import { useRef } from "react";
import { type PlayerInfo, type SumoState, TEAMS } from "../../shared/types";
import { Motion, Smoother, useCanvas } from "../draw";
import { drawTopPerson } from "../render/characters";
import { Particles, Shake } from "../render/particles";
import { alpha, bigText, type Ctx, drawTag, FONTS, Layer, rng, TAU } from "../render/paint";
import { sound, vibrate } from "../sound";

const START_R = 9;

function paintLava(ctx: Ctx, w: number, h: number, s: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#5a0d07");
  g.addColorStop(1, "#2a0503");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(9);
  for (let i = 0; i < Math.ceil((w * h) / (s * s * 2)); i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = s * (0.5 + r() * 2.5);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() < 0.5 ? "255,120,30" : "255,60,20";
    gr.addColorStop(0, `rgba(${c},0.35)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // a few large, soft crust plates with glowing cracks around them
  for (let i = 0; i < Math.ceil((w * h) / (s * s * 22)); i++) {
    const x = r() * w;
    const y = r() * h;
    const size = s * (1 + r() * 1.4);
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      const d = size * (0.7 + r() * 0.3);
      k ? ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7) : ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(40,10,5,0.5)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,150,40,0.35)";
    ctx.lineWidth = Math.max(1.5, s * 0.12);
    ctx.stroke();
  }
}

function paintRingTop(ctx: Ctx, size: number, s: number) {
  const c = size / 2;
  const R = START_R * s;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, TAU);
  ctx.fillStyle = "#e4c48c";
  ctx.fill();
  const r = rng(3);
  for (let i = 0; i < 260; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * R;
    ctx.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.12)" : "rgba(120,80,30,0.12)";
    ctx.beginPath();
    ctx.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, s * (0.2 + r() * 0.6), s * (0.1 + r() * 0.3), r() * 3, 0, TAU);
    ctx.fill();
  }
  // concentric rake marks
  ctx.strokeStyle = "rgba(150,110,60,0.18)";
  ctx.lineWidth = Math.max(1, s * 0.06);
  for (let k = 1; k < 9; k++) {
    ctx.beginPath();
    ctx.arc(c, c, k * s, 0, TAU);
    ctx.stroke();
  }
  // starting lines
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(c - s * 1.4, c - s * 0.9, s * 0.18, s * 1.8);
  ctx.fillRect(c + s * 1.22, c - s * 0.9, s * 0.18, s * 1.8);
}

export function SumoView({ game, players, myId }: { game: SumoState; players: PlayerInfo[]; myId: string | null }) {
  const st = useRef({
    game,
    prev: null as SumoState | null,
    smooth: new Smoother(),
    motion: new Motion(),
    lava: new Layer(),
    ring: new Layer(),
    fx: new Particles(),
    shake: new Shake(),
    fellAt: new Map<string, { t: number; x: number; y: number }>(),
    names: new Map<string, string>(),
    bubbleT: 0,
  }).current;
  st.game = game;
  st.names = new Map(players.map((p) => [p.id, p.name]));

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    const top = 50;
    const s = Math.max(4, Math.min(w - 20, h - top - 10) / 2 / (START_R + 0.9));
    const cx = w / 2;
    const cy = top + (h - top) / 2 - s * 0.3;
    const X = (x: number) => cx + x * s;
    const Y = (y: number) => cy + y * s;
    const lava = st.lava.get(`${w}x${h}x${dpr}`, w, h, dpr, (c) => paintLava(c, w, h, s));
    const ringSize = Math.ceil(START_R * s * 2 + 4);
    const ring = st.ring.get(`${ringSize}x${dpr}`, ringSize, ringSize, dpr, (c) => paintRingTop(c, ringSize, s));

    // ---- events ----
    const prev = st.prev;
    if (prev && prev !== g) {
      for (const f of g.fighters) {
        const p = prev.fighters.find((q) => q.id === f.id);
        if (!p) continue;
        const me = f.id === myId;
        if (f.dashing && !p.dashing) {
          sound.play("whoosh", { vol: me ? 1 : 0.35 });
          st.fx.burst("dust", X(f.x), Y(f.y) + s * 0.3, 6, { speed: s * 2, size: s * 0.25, life: 0.5, color: "#f2dcb0" });
        }
        const dv = Math.hypot(f.vx - p.vx, f.vy - p.vy);
        if (f.alive && dv > 5 && !(f.dashing && !p.dashing)) {
          st.fx.burst("spark", X(f.x), Y(f.y), 8, { speed: s * 4, size: s * 0.15, life: 0.3, color: ["#ffffff", "#ffe27a"] });
          sound.play("hit", { vol: me ? 0.9 : 0.35, minGap: 70 });
          if (me) {
            st.shake.kick(6);
            vibrate(25);
          }
        }
        if (p.alive && !f.alive) {
          st.fellAt.set(f.id, { t: now, x: f.x, y: f.y });
          sound.play("fall", { vol: me ? 1 : 0.5 });
          if (me) {
            st.shake.kick(14);
            vibrate([100, 50, 100]);
          }
        }
      }
    }
    st.prev = g;

    st.shake.apply(ctx, dt);
    ctx.drawImage(lava, 0, 0, w, h);
    // living lava glow
    for (let i = 0; i < 6; i++) {
      const gx = w * (0.15 + 0.7 * ((i * 0.37 + now / 40000) % 1));
      const gy = h * (0.2 + 0.6 * ((i * 0.61) % 1)) + Math.sin(now / 1500 + i) * s * 2;
      const rad = s * (3 + Math.sin(now / 900 + i * 2) * 1);
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad);
      gr.addColorStop(0, "rgba(255,170,40,0.22)");
      gr.addColorStop(1, "rgba(255,120,20,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
    }
    st.bubbleT -= dt;
    if (st.bubbleT <= 0) {
      st.bubbleT = 0.15 + Math.random() * 0.3;
      const a = Math.random() * TAU;
      const d = (g.arenaR + 0.8 + Math.random() * 4) * s;
      st.fx.burst("splash", cx + Math.cos(a) * d, cy + Math.sin(a) * d, 4, { speed: s * 1.5, size: s * 0.2, life: 0.6, color: ["#ffb02e", "#ff6a1f"], angle: -Math.PI / 2, spread: 1.5, g: s * 8 });
    }

    // platform: cliff side, glow, top
    const R = g.arenaR * s;
    ctx.fillStyle = "rgba(255,120,30,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.9, R + s * 0.5, R + s * 0.35, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#5b3a24";
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.7, R, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#7a5233";
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.35, R, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.drawImage(ring, cx - ringSize / 2, cy - ringSize / 2, ringSize, ringSize);
    ctx.restore();
    // straw rope edge
    ctx.lineWidth = s * 0.42;
    ctx.strokeStyle = "#a7843f";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, R - s * 0.25), 0, TAU);
    ctx.stroke();
    ctx.setLineDash([s * 0.35, s * 0.18]);
    ctx.lineWidth = s * 0.3;
    ctx.strokeStyle = "#e3c47c";
    ctx.stroke();
    ctx.setLineDash([]);
    const shrinking = g.arenaR < START_R - 0.05;
    if (shrinking) {
      ctx.strokeStyle = `rgba(255,90,30,${0.5 + Math.sin(now / 120) * 0.3})`;
      ctx.lineWidth = Math.max(2, s * 0.15);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.stroke();
      if (Math.random() < 0.3) {
        const a = Math.random() * TAU;
        st.fx.add({ kind: "debris", x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, vx: Math.cos(a) * s, vy: s * 2, g: s * 10, size: s * 0.15, life: 0.6, color: "#7a5233" });
      }
    }

    // fighters
    const list = g.fighters
      .map((f) => {
        const x = st.smooth.get(f.id + "x", f.x, dt, 20, 3);
        const y = st.smooth.get(f.id + "y", f.y, dt, 20, 3);
        const m = st.motion.update(f.id, x, y, dt, Math.atan2(-y, -x));
        return { f, x, y, m };
      })
      .sort((a, b) => a.y - b.y);

    for (const { f, x, y, m } of list) {
      const color = TEAMS[f.team].color;
      const me = f.id === myId;
      if (!f.alive) {
        const fell = st.fellAt.get(f.id);
        if (!fell) continue;
        const t = (now - fell.t) / 1000;
        if (t > 1) continue;
        const sx = X(x);
        const sy = Y(y) + t * t * s * 3;
        if (t < 0.05) {
          st.fx.burst("fire", sx, sy, 16, { speed: s * 5, size: s * 0.35, life: 0.6, color: ["#ffd25a", "#ff8a1f", "#ff4a12"], angle: -Math.PI / 2, spread: 2, g: s * 12 });
          st.fx.burst("smoke", sx, sy, 6, { speed: s * 1.5, size: s * 0.4, life: 1.2, color: "#4a3a3a" });
        }
        drawTopPerson(ctx, sx, sy, s * 0.48 * (1 - t * 0.8), color, { angle: now / 80, pose: "cheer", alpha: 1 - t, now });
        continue;
      }
      const sx = X(x);
      const sy = Y(y);
      if (f.dashing) {
        for (let k = 1; k <= 3; k++) {
          drawTopPerson(ctx, sx - f.vx * s * 0.025 * k, sy - f.vy * s * 0.025 * k, s * 0.48, color, { angle: m.a, pose: "push", alpha: 0.3 / k });
        }
      }
      drawTopPerson(ctx, sx, sy, s * 0.48, color, { angle: m.a, pose: f.dashing ? "push" : m.speed > 0.8 ? "walk" : "idle", walk: m.walk * 2, me, now });
      // dash readiness pip for me
      if (me && f.dashReady < 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, s * 1.1, -Math.PI / 2, -Math.PI / 2 + TAU * f.dashReady);
        ctx.stroke();
      }
      drawTag(ctx, sx, sy - s * 0.9, me ? "YOU" : (st.names.get(f.id) ?? ""), color, me, Math.max(9, Math.min(12, s * 0.5)));
    }

    st.fx.update(dt);
    st.fx.draw(ctx);

    const mine = g.fighters.find((f) => f.id === myId);
    if (mine && !mine.alive) bigText(ctx, "SPLASH! YOU'RE OUT", w / 2, top + 30, Math.min(30, w / 16), "#ffb02e");
    else if (shrinking && g.timeLeft > 0) {
      ctx.save();
      ctx.font = `800 ${Math.min(14, w / 28)}px ${FONTS.body}`;
      ctx.textAlign = "center";
      ctx.fillStyle = alpha("#ffb08a", 0.7 + Math.sin(now / 150) * 0.3);
      ctx.fillText("⚠ THE RING IS SHRINKING", w / 2, top + 16);
      ctx.restore();
    }
  });

  return <canvas ref={canvasRef} className="view-canvas" />;
}
