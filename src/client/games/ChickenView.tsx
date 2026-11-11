"use client";

import { useRef } from "react";
import { type ChickenState, type PlayerInfo, TEAMS } from "../../shared/types";
import { Motion, Smoother, useCanvas } from "../draw";
import { drawChicken, drawFlag, drawStar, drawTopPerson, type TopPose } from "../render/characters";
import { Particles, Shake } from "../render/particles";
import { alpha, type Ctx, darken, drawBush, drawRock, drawTag, drawTree, FONTS, fillStroke, type Fit, fitWorld, Layer, paintDirt, paintGrass, rng, TAU } from "../render/paint";
import { sound, vibrate } from "../sound";

function paintFarm(ctx: Ctx, w: number, h: number, f: Fit, g: ChickenState) {
  const { s, ox, oy } = f;
  const AW = g.w * s;
  const AH = g.h * s;
  paintGrass(ctx, 0, 0, w, h, 3, "#5aa645", s);
  // trees and bushes around the field
  const r = rng(42);
  const props: { x: number; y: number; k: number; size: number; seed: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    const y = r() * h;
    if (x > ox - s * 1.2 && x < ox + AW + s * 1.2 && y > oy - s * 1.2 && y < oy + AH + s * 1.2) continue;
    props.push({ x, y, k: r(), size: s * (0.8 + r() * 1.1), seed: i });
  }
  props.sort((a, b) => a.y - b.y);
  for (const p of props) {
    if (p.k < 0.5) drawTree(ctx, p.x, p.y, p.size * 1.3, p.seed);
    else if (p.k < 0.85) drawBush(ctx, p.x, p.y, p.size * 0.7, p.seed);
    else drawRock(ctx, p.x, p.y, p.size * 0.45, p.seed);
  }
  // field
  paintGrass(ctx, ox, oy, AW, AH, 9, "#8fd35f", s);
  // mowed stripes
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < g.w; i += 4) ctx.fillRect(ox + i * s, oy, 2 * s, AH);
  // a few soft worn patches of earth
  const r2 = rng(5);
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 5; i++) {
    const px = ox + (6 + r2() * (g.w - 12)) * s;
    const py = oy + (3 + r2() * (g.h - 6)) * s;
    paintDirt(ctx, px, py, s * (0.6 + r2() * 0.8), i, "#b8895a", s);
  }
  ctx.restore();
  // pens
  for (const p of g.pens) {
    const t = TEAMS[p.team];
    const cx = ox + p.x * s;
    const cy = oy + p.y * s;
    const R = p.r * s;
    paintDirt(ctx, cx, cy, R, p.team + 10, "#dcbc72", s);
    // straw
    const rr = rng(p.team + 3);
    ctx.strokeStyle = "rgba(160,120,40,0.55)";
    ctx.lineWidth = Math.max(1, s * 0.05);
    for (let i = 0; i < 60; i++) {
      const a = rr() * TAU;
      const d = Math.sqrt(rr()) * R * 0.9;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const b = rr() * TAU;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(b) * s * 0.25, y + Math.sin(b) * s * 0.25);
      ctx.stroke();
    }
    // team paint on the floor
    ctx.fillStyle = alpha(t.color, 0.18);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    // fence with a gap facing the field centre
    const gapA = Math.atan2(g.h / 2 - p.y, g.w / 2 - p.x);
    const posts = Math.ceil((TAU * p.r) / 0.75);
    ctx.lineCap = "round";
    for (const [lw, col] of [[s * 0.26, "#5a3a1c"], [s * 0.14, "#a8743f"]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(cx, cy, R + s * 0.1, gapA + 0.55, gapA + TAU - 0.55);
      ctx.stroke();
    }
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * TAU;
      const da = Math.atan2(Math.sin(a - gapA), Math.cos(a - gapA));
      if (Math.abs(da) < 0.5) continue;
      const px = cx + Math.cos(a) * (R + s * 0.1);
      const py = cy + Math.sin(a) * (R + s * 0.1);
      ctx.beginPath();
      ctx.roundRect(px - s * 0.17, py - s * 0.17, s * 0.34, s * 0.34, s * 0.06);
      fillStroke(ctx, t.color, darken(t.color, 0.6), Math.max(1, s * 0.05));
    }
    drawFlag(ctx, cx - Math.cos(gapA) * R * 0.65, cy - Math.sin(gapA) * R * 0.65, s * 1.6, t.color, 0);
  }
  // field fence
  const rail = (x1: number, y1: number, x2: number, y2: number) => {
    for (const [lw, col] of [[s * 0.24, "#5a3a1c"], [s * 0.12, "#b07a43"]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  };
  rail(ox, oy, ox + AW, oy);
  rail(ox, oy + AH, ox + AW, oy + AH);
  rail(ox, oy, ox, oy + AH);
  rail(ox + AW, oy, ox + AW, oy + AH);
  const post = (x: number, y: number) => {
    ctx.beginPath();
    ctx.roundRect(x - s * 0.18, y - s * 0.18, s * 0.36, s * 0.36, s * 0.06);
    fillStroke(ctx, "#8a5a2b", "#3e2810", Math.max(1, s * 0.05));
  };
  for (let x = 0; x <= g.w; x += 1.6) {
    post(ox + x * s, oy);
    post(ox + x * s, oy + AH);
  }
  for (let y = 1.6; y < g.h; y += 1.6) {
    post(ox, oy + y * s);
    post(ox + AW, oy + y * s);
  }
}

export function ChickenView({ game, players, myId }: { game: ChickenState; players: PlayerInfo[]; myId: string | null }) {
  const st = useRef({
    game,
    prev: null as ChickenState | null,
    smooth: new Smoother(),
    motion: new Motion(),
    bg: new Layer(),
    fx: new Particles(),
    shake: new Shake(),
    names: new Map<string, string>(),
    nextCluck: 0,
  }).current;
  st.game = game;
  st.names = new Map(players.map((p) => [p.id, p.name]));

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    const f = fitWorld(w, h, g.w, g.h, 50, 12, 12);
    const { s, ox, oy } = f;
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy + y * s;
    const bg = st.bg.get(`${w}x${h}x${dpr}x${g.w}x${g.h}`, w, h, dpr, (c) => paintFarm(c, w, h, f, g));

    // ---- events ----
    const prev = st.prev;
    if (prev && prev !== g) {
      for (const r of g.runners) {
        const p = prev.runners.find((q) => q.id === r.id);
        if (!p) continue;
        const me = r.id === myId;
        if (r.carrying > p.carrying) {
          st.fx.burst("feather", X(r.x), Y(r.y) - s * 0.5, 6, { speed: s * 2.5, size: s * 0.18, life: 0.9, color: ["#ffffff", "#f3eadb"] });
          sound.play("cluck", { vol: me ? 1 : 0.4 });
          if (me) {
            st.fx.floatText(X(r.x), Y(r.y) - s * 1.8, `${r.carrying}/4`, "#ffffff", Math.max(14, s * 0.8));
            vibrate(15);
          }
        }
        if (r.stunned && !p.stunned) {
          st.fx.burst("feather", X(r.x), Y(r.y), 12, { speed: s * 4, size: s * 0.2, life: 1.1, color: ["#ffffff", "#f3eadb"] });
          st.fx.add({ kind: "ring", x: X(r.x), y: Y(r.y), size: s * 0.3, grow: s * 4, life: 0.3, color: "#ffffff" });
          sound.play("hit", { vol: me ? 1 : 0.5 });
          if (me) {
            st.shake.kick(10);
            vibrate([60, 30, 60]);
          }
        }
        if (r.dashing && !p.dashing) {
          sound.play("whoosh", { vol: me ? 0.9 : 0.3 });
          st.fx.burst("dust", X(r.x), Y(r.y) + s * 0.3, 5, { speed: s * 1.5, size: s * 0.25, life: 0.5, color: "#e8dcb8" });
        }
      }
      for (const p of g.pens) {
        const before = prev.penned[p.team] ?? 0;
        const after = g.penned[p.team] ?? 0;
        if (after > before) {
          st.fx.floatText(X(p.x), Y(p.y) - p.r * s, `+${after - before}`, TEAMS[p.team].color, Math.max(18, s * 1.2));
          st.fx.confetti(X(p.x), Y(p.y), 16, [TEAMS[p.team].color, "#ffffff"], s * 6);
          sound.play("score");
        }
      }
    }
    st.prev = g;
    if (now > st.nextCluck) {
      st.nextCluck = now + 1800 + Math.random() * 3000;
      sound.play("cluck", { vol: 0.25 });
    }

    st.shake.apply(ctx, dt);
    ctx.drawImage(bg, 0, 0, w, h);

    // pen counters painted on the floor
    for (const p of g.pens) {
      ctx.save();
      ctx.font = `${Math.max(16, s * 1.6)}px ${FONTS.display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = alpha(darken(TEAMS[p.team].color, 0.3), 0.45);
      ctx.fillText(String(g.penned[p.team] ?? 0), X(p.x), Y(p.y));
      ctx.restore();
    }

    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const c of g.chickens) {
      const id = "c" + c.id;
      const cx = c.penned ? c.x : st.smooth.get(id + "x", c.x, dt, 16, 2);
      const cy = c.penned ? c.y : st.smooth.get(id + "y", c.y, dt, 16, 2);
      const m = st.motion.update(id, cx, cy, dt);
      const dir = Math.cos(m.a) >= 0 ? 1 : -1;
      const peck = c.penned || m.speed < 0.3 ? Math.max(0, Math.sin(now / 260 + c.id * 1.7)) ** 6 : 0;
      items.push({
        y: cy,
        draw: () => drawChicken(ctx, X(cx), Y(cy), s * 0.85, { dir, walk: m.walk * 2.5, flap: c.flap, peck }),
      });
    }
    for (const r of g.runners) {
      const rx = st.smooth.get(r.id + "x", r.x, dt, 20, 3);
      const ry = st.smooth.get(r.id + "y", r.y, dt, 20, 3);
      const m = st.motion.update(r.id, rx, ry, dt);
      const me = r.id === myId;
      const color = TEAMS[r.team].color;
      items.push({
        y: ry,
        draw: () => {
          const x = X(rx);
          const y = Y(ry);
          const pose: TopPose = r.stunned ? "stun" : r.dashing ? "push" : r.carrying ? "carry" : m.speed > 0.6 ? "walk" : "idle";
          if (r.dashing) {
            for (let k = 1; k <= 2; k++) {
              drawTopPerson(ctx, x - r.vx * s * 0.03 * k, y - r.vy * s * 0.03 * k, s * 0.5, color, { angle: m.a, pose, alpha: 0.25 / k });
            }
          }
          drawTopPerson(ctx, x, y, s * 0.5, color, { angle: m.a, pose, walk: m.walk * 2, me, now });
          for (let i = 0; i < r.carrying; i++) {
            drawChicken(ctx, x + Math.sin(now / 200 + i) * s * 0.05, y - s * 0.5 - i * s * 0.38, s * 0.6, { dir: Math.cos(m.a) >= 0 ? 1 : -1, flap: true, walk: now / 60 + i });
          }
          if (r.stunned) {
            for (let k = 0; k < 3; k++) {
              const a = now / 180 + (k * TAU) / 3;
              drawStar(ctx, x + Math.cos(a) * s * 0.6, y - s * 0.4 + Math.sin(a) * s * 0.25, s * 0.18);
            }
          }
          const tagY = y - s * 1.05 - r.carrying * s * 0.38;
          drawTag(ctx, x, tagY, me ? "YOU" : (st.names.get(r.id) ?? ""), color, me, Math.max(9, Math.min(12, s * 0.5)));
        },
      });
    }
    items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());

    st.fx.update(dt);
    st.fx.draw(ctx);
  });

  return <canvas ref={canvasRef} className="view-canvas" />;
}
