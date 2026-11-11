"use client";

import { useRef } from "react";
import { type PlayerInfo, type TankState, TEAMS, type Wall } from "../../shared/types";
import { Smoother, useCanvas } from "../draw";
import { drawFlag, drawStar, drawTank } from "../render/characters";
import { Particles, Shake } from "../render/particles";
import {
  alpha, bigText, type Ctx, darken, drawBarrel, drawCactus, drawRock, drawTag, fillStroke, type Fit, fitWorld, Layer, lighten, paintSand, rng, TAU,
} from "../render/paint";
import { sound, vibrate } from "../sound";

const BULLET_SPEED = 13;

function paintCrates(ctx: Ctx, wl: Wall, f: Fit) {
  const { s, ox, oy } = f;
  const nx = Math.max(1, Math.round(wl.w / 1.5));
  const ny = Math.max(1, Math.round(wl.h / 1.5));
  const cw = (wl.w / nx) * s;
  const ch = (wl.h / ny) * s;
  const d = s * 0.25;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = ox + wl.x * s + i * cw;
      const y = oy + wl.y * s + j * ch;
      // side
      ctx.fillStyle = "#8a5a2c";
      ctx.fillRect(x, y + ch - d, cw, d);
      // top
      ctx.beginPath();
      ctx.rect(x, y - d, cw, ch);
      fillStroke(ctx, "#cf9455", "#5a3815", Math.max(1.2, s * 0.06));
      ctx.strokeStyle = "#9c6630";
      ctx.lineWidth = Math.max(1, s * 0.07);
      const inset = cw * 0.12;
      ctx.strokeRect(x + inset, y - d + inset, cw - inset * 2, ch - inset * 2);
      ctx.beginPath();
      ctx.moveTo(x + inset, y - d + inset);
      ctx.lineTo(x + cw - inset, y - d + ch - inset);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x + 2, y - d + 2, cw - 4, Math.max(1, s * 0.06));
    }
  }
}

function paintBarrier(ctx: Ctx, wl: Wall, f: Fit) {
  const { s, ox, oy } = f;
  const x = ox + wl.x * s;
  const y = oy + wl.y * s;
  const w = wl.w * s;
  const h = wl.h * s;
  const d = s * 0.22;
  ctx.fillStyle = "#77736b";
  ctx.beginPath();
  ctx.roundRect(x, y + h - d, w, d, s * 0.08);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x, y - d, w, h, s * 0.12);
  fillStroke(ctx, "#c7c2b8", "#4a4741", Math.max(1.2, s * 0.06));
  // hazard stripes on the ends
  ctx.save();
  ctx.clip();
  const horiz = w > h;
  const stripeLen = s * 0.7;
  const ends = horiz
    ? [[x, y - d, stripeLen, h], [x + w - stripeLen, y - d, stripeLen, h]]
    : [[x, y - d, w, stripeLen], [x, y - d + h - stripeLen, w, stripeLen]];
  for (const [ex, ey, ew, eh] of ends) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ex, ey, ew, eh);
    ctx.clip();
    ctx.fillStyle = "#ffcc2e";
    ctx.fillRect(ex, ey, ew, eh);
    ctx.strokeStyle = "#222";
    ctx.lineWidth = s * 0.14;
    for (let k = -2; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(ex + k * s * 0.3, ey - s);
      ctx.lineTo(ex + k * s * 0.3 + s * 1.5, ey + s * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x + s * 0.1, y - d + s * 0.08, w - s * 0.2, Math.max(1, s * 0.07));
}

function paintBackground(ctx: Ctx, w: number, h: number, f: Fit, g: TankState) {
  const { s, ox, oy } = f;
  const AW = g.w * s;
  const AH = g.h * s;
  paintSand(ctx, 0, 0, w, h, 11, "#c9a56c", s);
  // scenery outside the arena
  const r = rng(77);
  for (let i = 0; i < 60; i++) {
    const x = r() * w;
    const y = r() * h;
    if (x > ox - s * 1.6 && x < ox + AW + s * 1.6 && y > oy - s * 1.6 && y < oy + AH + s * 1.6) continue;
    const k = r();
    if (k < 0.4) drawRock(ctx, x, y, s * (0.4 + r() * 0.6), i);
    else if (k < 0.7) drawCactus(ctx, x, y, s * (0.6 + r() * 0.4));
    else drawBarrel(ctx, x, y, s * 0.55, r() < 0.5 ? "#c0392b" : "#2d6cb5");
  }
  // arena floor
  paintSand(ctx, ox, oy, AW, AH, 5, "#ead09c", s);
  // painted grid
  ctx.strokeStyle = "rgba(120,90,40,0.08)";
  ctx.lineWidth = 1;
  for (let i = 2; i < g.w; i += 2) {
    ctx.beginPath();
    ctx.moveTo(ox + i * s, oy);
    ctx.lineTo(ox + i * s, oy + AH);
    ctx.stroke();
  }
  for (let j = 2; j < g.h; j += 2) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + j * s);
    ctx.lineTo(ox + AW, oy + j * s);
    ctx.stroke();
  }
  // bases
  for (const b of g.bases) {
    const t = TEAMS[b.team];
    const x = ox + b.x * s;
    const y = oy + b.y * s;
    ctx.beginPath();
    ctx.arc(x, y, s * 1.95, 0, TAU);
    fillStroke(ctx, "#a19c92", "#5d5950", Math.max(1.5, s * 0.08));
    ctx.beginPath();
    ctx.arc(x, y, s * 1.7, 0, TAU);
    ctx.strokeStyle = t.color;
    ctx.lineWidth = s * 0.3;
    ctx.stroke();
    ctx.setLineDash([s * 0.35, s * 0.25]);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.arc(x, y, s * 1.25, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    drawStar(ctx, x, y, s * 0.75, alpha(t.color, 0.5));
  }
  // wall shadows, then walls
  ctx.fillStyle = "rgba(60,35,10,0.28)";
  for (const wl of g.walls) {
    ctx.beginPath();
    ctx.roundRect(ox + wl.x * s + s * 0.25, oy + wl.y * s + s * 0.15, wl.w * s, wl.h * s, s * 0.15);
    ctx.fill();
  }
  for (const wl of g.walls) {
    if (wl.w >= 1.5 && wl.h >= 1.5) paintCrates(ctx, wl, f);
    else paintBarrier(ctx, wl, f);
  }
  // sandbag border
  const bag = (x: number, y: number, bw: number, bh: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, Math.min(bw, bh) * 0.45);
    fillStroke(ctx, "#cbb07a", "#6e5a33", Math.max(1, s * 0.05));
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.roundRect(x + bw * 0.15, y + bh * 0.15, bw * 0.7, bh * 0.25, bh * 0.1);
    ctx.fill();
  };
  const bt = s * 0.55;
  for (let x = 0, k = 0; x < AW + bt * 2; x += s * 0.95, k++) {
    bag(ox - bt + x - (k % 2) * s * 0.2, oy - bt, s * 1, bt);
    bag(ox - bt + x - (k % 2) * s * 0.2, oy + AH, s * 1, bt);
  }
  for (let y = 0, k = 0; y < AH; y += s * 0.95, k++) {
    bag(ox - bt, oy + y - (k % 2) * s * 0.2, bt, s * 1);
    bag(ox + AW, oy + y - (k % 2) * s * 0.2, bt, s * 1);
  }
}

export function TanksView({ game, players, myId }: { game: TankState; players: PlayerInfo[]; myId: string | null }) {
  const st = useRef({
    game,
    prev: null as TankState | null,
    stateAt: 0,
    smooth: new Smoother(),
    bg: new Layer(),
    decal: new Layer(),
    fx: new Particles(),
    shake: new Shake(),
    tread: new Map<string, { d: number; x: number; y: number }>(),
    recoil: new Map<string, number>(),
    seen: new Set<number>(),
    names: new Map<string, string>(),
  }).current;
  if (st.game !== game) {
    st.game = game;
    st.stateAt = performance.now();
  }
  st.names = new Map(players.map((p) => [p.id, p.name]));

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    const f = fitWorld(w, h, g.w, g.h, 50, 12, 12);
    const { s, ox, oy } = f;
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy + y * s;
    const key = `${w}x${h}x${dpr}x${g.w}x${g.h}`;
    const bg = st.bg.get(key, w, h, dpr, (c) => paintBackground(c, w, h, f, g));
    const decal = st.decal.get(key, w, h, dpr, () => {});

    // ---- react to new server state ----
    const prev = st.prev;
    if (prev !== g) {
      for (const b of g.bullets) {
        if (st.seen.has(b.id)) continue;
        st.seen.add(b.id);
        let shooter = g.tanks[0];
        let best = Infinity;
        for (const t of g.tanks) {
          if (t.team !== b.team || !t.alive) continue;
          const d = Math.hypot(t.x - b.x, t.y - b.y);
          if (d < best) {
            best = d;
            shooter = t;
          }
        }
        if (shooter) st.recoil.set(shooter.id, 1);
        st.fx.burst("spark", X(b.x), Y(b.y), 6, { speed: s * 4, size: s * 0.2, life: 0.18, color: ["#fff6c2", "#ffb347"], angle: b.a, spread: 1 });
        st.fx.burst("smoke", X(b.x), Y(b.y), 2, { speed: s, size: s * 0.2, life: 0.5, color: "#d8d2c6" });
        const mine = shooter?.id === myId;
        sound.play("shoot", { vol: mine ? 1 : 0.45, minGap: 30 });
        if (mine) vibrate(12);
      }
      if (st.seen.size > 500) st.seen = new Set(g.bullets.map((b) => b.id));
      if (prev) {
        for (const t of g.tanks) {
          const p = prev.tanks.find((q) => q.id === t.id);
          if (!p) continue;
          if (p.alive && !t.alive) {
            const mine = t.id === myId;
            st.fx.explosion(X(p.x), Y(p.y), s);
            st.decal.paint(dpr, (c) => {
              const gr = c.createRadialGradient(X(p.x), Y(p.y), 0, X(p.x), Y(p.y), s * 1.3);
              gr.addColorStop(0, "rgba(30,20,10,0.5)");
              gr.addColorStop(1, "rgba(30,20,10,0)");
              c.fillStyle = gr;
              c.beginPath();
              c.arc(X(p.x), Y(p.y), s * 1.3, 0, TAU);
              c.fill();
            });
            st.shake.kick(mine ? 14 : 5);
            sound.play("boom", { vol: mine ? 1 : 0.6, minGap: 60 });
            if (mine) vibrate([80, 40, 80]);
          }
          if (!p.alive && t.alive) {
            st.fx.add({ kind: "ring", x: X(t.x), y: Y(t.y), size: s * 0.4, grow: s * 4, life: 0.4, color: TEAMS[t.team].color });
            if (t.id === myId) sound.play("pop");
          }
        }
        for (const fl of g.flags) {
          const pf = prev.flags.find((q) => q.team === fl.team);
          if (!pf) continue;
          if (!pf.carrier && fl.carrier) {
            sound.play("pickup");
            const c = g.tanks.find((t) => t.id === fl.carrier);
            if (c) st.fx.floatText(X(c.x), Y(c.y) - s * 1.6, "FLAG!", TEAMS[fl.team].color, Math.max(14, s * 0.9));
          }
          if (!pf.home && fl.home && pf.carrier === null) sound.play("pop");
        }
        for (const b of g.bases) {
          if ((g.caps[b.team] ?? 0) > (prev.caps[b.team] ?? 0)) {
            st.fx.confetti(X(b.x), Y(b.y), 50, [TEAMS[b.team].color, "#ffffff", "#ffd34d"], s * 9);
            st.fx.floatText(X(b.x), Y(b.y) - s * 2.2, "+1 CAPTURE!", TEAMS[b.team].color, Math.max(16, s * 1.1));
            sound.play("flag");
            st.shake.kick(4);
          }
        }
      }
      st.prev = g;
    }

    st.shake.apply(ctx, dt);
    ctx.drawImage(bg, 0, 0, w, h);
    ctx.drawImage(decal, 0, 0, w, h);

    // flags on the ground / at base
    for (const fl of g.flags) {
      if (fl.carrier) continue;
      drawFlag(ctx, X(fl.x), Y(fl.y) + s * 0.3, s * 1.7, TEAMS[fl.team].color, now);
      if (!fl.home) {
        ctx.strokeStyle = alpha(TEAMS[fl.team].color, 0.5 + Math.sin(now / 150) * 0.3);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X(fl.x), Y(fl.y), s * (0.9 + Math.sin(now / 200) * 0.1), 0, TAU);
        ctx.stroke();
      }
    }

    // tanks
    const sorted = [...g.tanks].sort((a, b) => a.y - b.y);
    for (const t of sorted) {
      if (!t.alive) continue;
      const x = st.smooth.get(t.id + "x", t.x, dt, 20, 3);
      const y = st.smooth.get(t.id + "y", t.y, dt, 20, 3);
      const a = st.smooth.get(t.id + "a", t.a, dt, 22, 1.5);
      let tr = st.tread.get(t.id);
      if (!tr) {
        tr = { d: 0, x, y };
        st.tread.set(t.id, tr);
      }
      const moved = Math.hypot(x - tr.x, y - tr.y);
      if (moved > 0.0005) {
        tr.d += moved;
        if (moved > 0.02) {
          st.decal.paint(dpr, (c) => {
            c.fillStyle = "rgba(90,60,25,0.07)";
            for (const side of [-1, 1]) {
              const px = X(x) + Math.cos(a + Math.PI / 2) * side * s * 0.55;
              const py = Y(y) + Math.sin(a + Math.PI / 2) * side * s * 0.55;
              c.fillRect(px - s * 0.15, py - s * 0.15, s * 0.3, s * 0.3);
            }
          });
          if (Math.random() < 0.25) {
            st.fx.add({ kind: "dust", x: X(x) - Math.cos(a) * s * 0.8, y: Y(y) - Math.sin(a) * s * 0.8, size: s * 0.15, grow: s * 0.6, life: 0.6, color: "#d9bf8c", drag: 2 });
          }
        }
      }
      tr.x = x;
      tr.y = y;
      const rc = st.recoil.get(t.id) ?? 0;
      st.recoil.set(t.id, Math.max(0, rc - dt * 6));
      const color = TEAMS[t.team].color;
      const me = t.id === myId;
      drawTank(ctx, X(x), Y(y), s, color, { angle: a, tread: tr.d, recoil: rc, me, alpha: t.shield && Math.floor(now / 90) % 2 ? 0.5 : 1, now });
      if (t.shield) {
        ctx.strokeStyle = `rgba(140,220,255,${0.5 + Math.sin(now / 80) * 0.25})`;
        ctx.lineWidth = Math.max(2, s * 0.1);
        ctx.beginPath();
        ctx.arc(X(x), Y(y), s * 1.15, 0, TAU);
        ctx.stroke();
      }
      if (t.flag !== null) drawFlag(ctx, X(x) - Math.cos(a) * s * 0.4, Y(y) - Math.sin(a) * s * 0.4, s * 1.4, TEAMS[t.flag].color, now);
      const label = me ? "YOU" : (st.names.get(t.id) ?? "");
      drawTag(ctx, X(x), Y(y) - s * (t.flag !== null ? 1.75 : 1.15), label, color, me, Math.max(9, Math.min(12, s * 0.5)));
    }

    // bullets (extrapolated between server updates)
    const ahead = Math.min(0.05, (now - st.stateAt) / 1000);
    for (const b of g.bullets) {
      const bx = b.x + Math.cos(b.a) * BULLET_SPEED * ahead;
      const by = b.y + Math.sin(b.a) * BULLET_SPEED * ahead;
      const tx = bx - Math.cos(b.a) * 0.8;
      const ty = by - Math.sin(b.a) * 0.8;
      const grad = ctx.createLinearGradient(X(tx), Y(ty), X(bx), Y(by));
      grad.addColorStop(0, alpha(TEAMS[b.team].color, 0));
      grad.addColorStop(1, alpha(TEAMS[b.team].color, 0.8));
      ctx.strokeStyle = grad;
      ctx.lineWidth = s * 0.22;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(X(tx), Y(ty));
      ctx.lineTo(X(bx), Y(by));
      ctx.stroke();
      ctx.fillStyle = alpha(lighten(TEAMS[b.team].color, 0.3), 0.6);
      ctx.beginPath();
      ctx.arc(X(bx), Y(by), s * 0.26, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fffbe6";
      ctx.beginPath();
      ctx.arc(X(bx), Y(by), s * 0.13, 0, TAU);
      ctx.fill();
    }

    st.fx.update(dt);
    st.fx.draw(ctx);

    const mine = g.tanks.find((t) => t.id === myId);
    if (mine && !mine.alive) {
      ctx.fillStyle = "rgba(20,10,30,0.45)";
      ctx.fillRect(0, h / 2 - 40, w, 80);
      bigText(ctx, `RESPAWN IN ${Math.ceil(mine.respawnIn)}`, w / 2, h / 2, Math.min(40, w / 14), "#ffd34d");
    }
    void darken;
  });

  return <canvas ref={canvasRef} className="view-canvas" />;
}
