"use client";

import { useRef } from "react";
import { type BoulderState, type PlayerInfo, TEAMS } from "../../shared/types";
import { Motion, Smoother, useCanvas } from "../draw";
import { drawStar, drawTopPerson } from "../render/characters";
import { Particles, Shake } from "../render/particles";
import { alpha, bigText, type Ctx, drawCactus, drawRock, drawTag, type Fit, fitWorld, Layer, paintSand, rng, TAU } from "../render/paint";
import { drawBoulder } from "../render/props";
import { sound, vibrate } from "../sound";

function paintCanyon(ctx: Ctx, w: number, h: number, f: Fit, g: BoulderState) {
  const { s, ox, oy } = f;
  const AW = g.w * s;
  const AH = g.h * s;
  // cliffs all around
  ctx.fillStyle = "#5e3424";
  ctx.fillRect(0, 0, w, h);
  const r = rng(6);
  for (let i = 0; i < (w * h) / (s * s * 1.5); i++) {
    ctx.fillStyle = r() < 0.5 ? "rgba(140,80,50,0.5)" : "rgba(40,20,12,0.35)";
    const x = r() * w;
    const y = r() * h;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      const d = s * (0.5 + r() * 1.2);
      if (k) ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6);
      else ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6);
    }
    ctx.closePath();
    ctx.fill();
  }
  // canyon floor
  paintSand(ctx, ox, oy, AW, AH, 14, "#d9a066", s);
  ctx.strokeStyle = "rgba(120,70,30,0.3)";
  ctx.lineWidth = Math.max(1, s * 0.06);
  for (let i = 0; i < 18; i++) {
    let x = ox + r() * AW;
    let y = oy + r() * AH;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (r() - 0.5) * s * 1.6;
      y += (r() - 0.5) * s * 1.6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // cliff edge shading
  const edge = s * 0.8;
  for (const [x, y, ww, hh, gx0, gy0, gx1, gy1] of [
    [ox, oy, AW, edge, 0, oy, 0, oy + edge],
    [ox, oy + AH - edge, AW, edge, 0, oy + AH, 0, oy + AH - edge],
    [ox, oy, edge, AH, ox, 0, ox + edge, 0],
    [ox + AW - edge, oy, edge, AH, ox + AW, 0, ox + AW - edge, 0],
  ] as const) {
    const gr = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    gr.addColorStop(0, "rgba(60,25,10,0.45)");
    gr.addColorStop(1, "rgba(60,25,10,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, ww, hh);
  }
  ctx.strokeStyle = "#3a1d12";
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.strokeRect(ox, oy, AW, AH);
  // scenery on the cliffs
  for (let i = 0; i < 40; i++) {
    const x = r() * w;
    const y = r() * h;
    if (x > ox - s && x < ox + AW + s && y > oy - s && y < oy + AH + s) continue;
    if (r() < 0.6) drawRock(ctx, x, y, s * (0.4 + r() * 0.5), i, "#8a5a3c");
    else drawCactus(ctx, x, y, s * 0.6);
  }
}

export function BoulderView({ game, players, myId }: { game: BoulderState; players: PlayerInfo[]; myId: string | null }) {
  const st = useRef({
    game,
    prev: null as BoulderState | null,
    smooth: new Smoother(),
    motion: new Motion(),
    bg: new Layer(),
    fx: new Particles(),
    shake: new Shake(),
    names: new Map<string, string>(),
    rolled: new Map<number, number>(),
    squashed: new Map<string, { t: number; x: number; y: number; team: number }>(),
  }).current;
  st.game = game;
  st.names = new Map(players.map((p) => [p.id, p.name]));

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    const f = fitWorld(w, h, g.w, g.h, 50, 12, 10);
    const { s, ox, oy } = f;
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy + y * s;
    const bg = st.bg.get(`${w}x${h}x${dpr}x${g.w}`, w, h, dpr, (c) => paintCanyon(c, w, h, f, g));

    const prev = st.prev;
    if (prev && prev !== g) {
      const seenB = new Set(prev.boulders.map((b) => b.id));
      if (g.boulders.some((b) => !seenB.has(b.id))) sound.play("rumble", { vol: 0.5, minGap: 250 });
      for (const r of g.runners) {
        const p = prev.runners.find((q) => q.id === r.id);
        if (!p) continue;
        const mine = r.id === myId;
        if (p.alive && !r.alive) {
          st.squashed.set(r.id, { t: now, x: p.x, y: p.y, team: r.team });
          st.fx.burst("dust", X(p.x), Y(p.y), 14, { speed: s * 4, size: s * 0.3, life: 0.8, color: ["#e3b27c", "#c08a5a"] });
          sound.play("squash", { vol: mine ? 1 : 0.5 });
          if (mine) {
            st.shake.kick(14);
            vibrate([100, 50, 100]);
          }
        }
        if (r.dashing && !p.dashing) sound.play("whoosh", { vol: mine ? 0.9 : 0.25 });
      }
    }
    st.prev = g;

    st.shake.apply(ctx, dt);
    ctx.drawImage(bg, 0, 0, w, h);

    // warnings: red lane + arrow at the edge
    const pulse = 0.5 + Math.sin(now / 90) * 0.5;
    for (const wn of g.warnings) {
      ctx.save();
      ctx.translate(X(wn.x), Y(wn.y));
      ctx.rotate(wn.a);
      ctx.fillStyle = `rgba(255,40,40,${0.1 + pulse * 0.12})`;
      ctx.fillRect(0, -wn.r * s, Math.hypot(g.w, g.h) * s, wn.r * s * 2);
      ctx.restore();
      const ex = Math.max(ox + s * 0.8, Math.min(ox + g.w * s - s * 0.8, X(wn.x)));
      const ey = Math.max(oy + s * 0.8, Math.min(oy + g.h * s - s * 0.8, Y(wn.y)));
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(wn.a);
      ctx.fillStyle = alpha("#ff3030", 0.6 + pulse * 0.4);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s * 0.7, 0);
      ctx.lineTo(-s * 0.4, -s * 0.6);
      ctx.lineTo(-s * 0.4, s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      bigText(ctx, "!", ex, ey - s * 0.9, s * 0.9, "#ffd34d");
    }

    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const b of g.boulders) {
      const x = st.smooth.get("b" + b.id + "x", b.x, dt, 22, 3);
      const y = st.smooth.get("b" + b.id + "y", b.y, dt, 22, 3);
      const rot = (st.rolled.get(b.id) ?? 0) + (Math.hypot(b.vx, b.vy) / b.r) * dt;
      st.rolled.set(b.id, rot);
      if (Math.random() < 0.5) {
        st.fx.add({ kind: "dust", x: X(x) - (b.vx / Math.hypot(b.vx, b.vy)) * b.r * s, y: Y(y) - (b.vy / Math.hypot(b.vx, b.vy)) * b.r * s, vx: 0, vy: 0, size: s * 0.2, grow: s * 1.2, life: 0.6, color: "#d9a066", drag: 2 });
      }
      items.push({ y, draw: () => drawBoulder(ctx, X(x), Y(y), b.r * s, rot) });
    }
    for (const r of g.runners) {
      if (!r.alive) continue;
      const x = st.smooth.get(r.id + "x", r.x, dt, 20, 3);
      const y = st.smooth.get(r.id + "y", r.y, dt, 20, 3);
      const m = st.motion.update(r.id, x, y, dt);
      const mine = r.id === myId;
      const color = TEAMS[r.team].color;
      items.push({
        y,
        draw: () => {
          if (r.dashing) {
            for (let k = 1; k <= 3; k++) drawTopPerson(ctx, X(x - r.vx * 0.03 * k), Y(y - r.vy * 0.03 * k), s * 0.5, color, { angle: m.a, pose: "push", alpha: 0.28 / k });
          }
          drawTopPerson(ctx, X(x), Y(y), s * 0.5, color, { angle: r.dashing ? m.a + now / 60 : m.a, pose: r.dashing ? "push" : m.speed > 0.6 ? "walk" : "idle", walk: m.walk * 2, me: mine, now });
          drawTag(ctx, X(x), Y(y) - s * 1.05, mine ? "YOU" : (st.names.get(r.id) ?? ""), color, mine, Math.max(9, Math.min(12, s * 0.5)));
        },
      });
    }
    // squashed players stay as a flat splat for a moment
    for (const [id, sq] of st.squashed) {
      const t = (now - sq.t) / 1000;
      if (t > 2.5) {
        st.squashed.delete(id);
        continue;
      }
      items.push({
        y: sq.y - 5,
        draw: () => {
          ctx.save();
          ctx.globalAlpha = Math.min(1, 2.5 - t);
          ctx.translate(X(sq.x), Y(sq.y));
          ctx.scale(1.5, 0.35);
          drawTopPerson(ctx, 0, 0, s * 0.5, TEAMS[sq.team as 0].color, { pose: "stun", angle: 0 });
          ctx.restore();
          for (let k = 0; k < 3; k++) {
            const a = now / 180 + (k * TAU) / 3;
            drawStar(ctx, X(sq.x) + Math.cos(a) * s * 0.6, Y(sq.y) - s * 0.3 + Math.sin(a) * s * 0.2, s * 0.15);
          }
        },
      });
    }
    items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
    st.fx.update(dt);
    st.fx.draw(ctx);

    const me = g.runners.find((r) => r.id === myId);
    if (me && !me.alive) bigText(ctx, "SQUASHED!", w / 2, h * 0.42, Math.min(36, w / 16), "#ffd34d");
  });

  return <canvas ref={canvasRef} className="view-canvas" />;
}
