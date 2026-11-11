"use client";

import { useRef } from "react";
import { type MissileState, type PlayerInfo, TEAMS } from "../../shared/types";
import { Motion, Smoother, useCanvas } from "../draw";
import { drawTopPerson } from "../render/characters";
import { Particles, Shake } from "../render/particles";
import { bigText, type Ctx, drawBush, drawTag, drawTree, type Fit, fitWorld, Layer, paintGrass, rng, TAU } from "../render/paint";
import { drawAmmoCrate, drawHeart, drawLauncher, drawMissile, drawRuinBlock } from "../render/props";
import { sound, vibrate } from "../sound";

const MISSILE_SPEED = 15;

function paintRuins(ctx: Ctx, w: number, h: number, f: Fit, g: MissileState) {
  const { s, ox, oy } = f;
  const AW = g.w * s;
  const AH = g.h * s;
  paintGrass(ctx, 0, 0, w, h, 7, "#3f7d36", s);
  // jungle all around
  const r = rng(19);
  const props: [number, number, number, number][] = [];
  for (let i = 0; i < 80; i++) {
    const x = r() * w;
    const y = r() * h;
    if (x > ox - s && x < ox + AW + s && y > oy - s && y < oy + AH + s) continue;
    props.push([x, y, r(), i]);
  }
  props.sort((a, b) => a[1] - b[1]);
  for (const [x, y, k, i] of props) {
    if (k < 0.55) drawTree(ctx, x, y, s * (1.2 + k), i);
    else drawBush(ctx, x, y, s * 0.8, i);
  }
  // arena floor: grass with old stone paving
  paintGrass(ctx, ox, oy, AW, AH, 11, "#6aa84f", s);
  ctx.fillStyle = "rgba(170,165,140,0.55)";
  ctx.strokeStyle = "rgba(90,90,70,0.5)";
  ctx.lineWidth = 1;
  const tile = s * 1.2;
  for (const [cx, cy, horiz] of [[g.w / 2, g.h / 2, true], [g.w / 2, g.h / 2, false]] as const) {
    const len = horiz ? g.w : g.h;
    for (let t = 0; t < len; t += 1.2) {
      if (r() < 0.25) continue; // broken, overgrown tiles
      const x = horiz ? ox + t * s : ox + cx * s - tile;
      const y = horiz ? oy + cy * s - tile : oy + t * s;
      for (let k = 0; k < 2; k++) {
        const tx = horiz ? x : x + k * tile;
        const ty = horiz ? y + k * tile : y;
        ctx.beginPath();
        ctx.rect(tx + 1, ty + 1, tile - 2, tile - 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  // wall shadows then ruins
  ctx.fillStyle = "rgba(20,40,10,0.35)";
  for (const wl of g.walls) ctx.fillRect(ox + wl.x * s + s * 0.25, oy + wl.y * s + s * 0.15, wl.w * s, wl.h * s);
  for (const wl of g.walls) drawRuinBlock(ctx, ox + wl.x * s, oy + wl.y * s, wl.w * s, wl.h * s, s);
  // vines over the arena edge
  ctx.strokeStyle = "#2f6b2a";
  ctx.lineWidth = s * 0.3;
  ctx.strokeRect(ox, oy, AW, AH);
  ctx.fillStyle = "#3f8a37";
  for (let i = 0; i < (AW + AH) / s; i++) {
    const t = r();
    const side = Math.floor(r() * 4);
    const x = side < 2 ? ox + t * AW : side === 2 ? ox : ox + AW;
    const y = side >= 2 ? oy + t * AH : side === 0 ? oy : oy + AH;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.3, s * 0.18, r() * 3, 0, TAU);
    ctx.fill();
  }
}

export function MissileView({ game, players, myId }: { game: MissileState; players: PlayerInfo[]; myId: string | null }) {
  const st = useRef({
    game,
    prev: null as MissileState | null,
    stateAt: 0,
    smooth: new Smoother(),
    motion: new Motion(),
    bg: new Layer(),
    decal: new Layer(),
    fx: new Particles(),
    shake: new Shake(),
    names: new Map<string, string>(),
    seenBooms: new Set<number>(),
    seenMissiles: new Set<number>(),
    hurt: 0,
  }).current;
  if (st.game !== game) {
    st.game = game;
    st.stateAt = performance.now();
  }
  st.names = new Map(players.map((p) => [p.id, p.name]));

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    const f = fitWorld(w, h, g.w, g.h, 50, 12, 10);
    const { s, ox, oy } = f;
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy + y * s;
    const key = `${w}x${h}x${dpr}x${g.w}`;
    const bg = st.bg.get(key, w, h, dpr, (c) => paintRuins(c, w, h, f, g));
    const decal = st.decal.get(key, w, h, dpr, () => {});
    const me = g.runners.find((r) => r.id === myId);

    const prev = st.prev;
    if (prev !== g) {
      for (const m of g.missiles) {
        if (st.seenMissiles.has(m.id)) continue;
        st.seenMissiles.add(m.id);
        const shooter = g.runners.find((r) => r.alive && r.team === m.team && Math.hypot(r.x - m.x, r.y - m.y) < 1.5);
        const mine = shooter?.id === myId;
        sound.play("launch", { vol: mine ? 1 : 0.4, minGap: 30 });
        st.fx.burst("smoke", X(m.x), Y(m.y), 4, { speed: s * 1.5, size: s * 0.25, life: 0.6, color: "#e6e2d8" });
        if (mine) vibrate(20);
      }
      for (const b of g.booms) {
        if (st.seenBooms.has(b.id)) continue;
        st.seenBooms.add(b.id);
        st.fx.explosion(X(b.x), Y(b.y), s);
        st.decal.paint(dpr, (c) => {
          const gr = c.createRadialGradient(X(b.x), Y(b.y), 0, X(b.x), Y(b.y), s * 1.3);
          gr.addColorStop(0, "rgba(25,20,10,0.45)");
          gr.addColorStop(1, "rgba(25,20,10,0)");
          c.fillStyle = gr;
          c.beginPath();
          c.arc(X(b.x), Y(b.y), s * 1.3, 0, TAU);
          c.fill();
        });
        const near = me && me.alive ? Math.hypot(me.x - b.x, me.y - b.y) : 99;
        sound.play("boom", { vol: near < 6 ? 0.9 : 0.45, minGap: 50 });
        if (near < 4) st.shake.kick(near < 2 ? 10 : 4);
      }
      if (st.seenBooms.size > 300) st.seenBooms = new Set(g.booms.map((b) => b.id));
      if (st.seenMissiles.size > 300) st.seenMissiles = new Set(g.missiles.map((m) => m.id));
      if (prev) {
        for (const r of g.runners) {
          const p = prev.runners.find((q) => q.id === r.id);
          if (!p) continue;
          const mine = r.id === myId;
          if (r.lives < p.lives) {
            st.fx.floatText(X(r.x), Y(r.y) - s * 1.6, r.alive ? "-1 ❤" : "K.O.!", "#ff5a5a", Math.max(14, s * 0.8));
            if (mine) {
              sound.play("hit");
              st.hurt = 1;
              st.shake.kick(12);
              vibrate([80, 40, 80]);
            }
          }
          if (r.lives > p.lives) {
            st.fx.floatText(X(r.x), Y(r.y) - s * 1.6, "+1 ❤", "#ff8aa8", Math.max(14, s * 0.8));
            st.fx.burst("spark", X(r.x), Y(r.y), 12, { speed: s * 3, size: s * 0.15, life: 0.6, color: ["#ff6b8a", "#ffd0dc"] });
            sound.play("heart", { vol: mine ? 1 : 0.4 });
          }
          if (r.ammo > p.ammo) {
            if (mine) st.fx.floatText(X(r.x), Y(r.y) - s * 1.6, `+${r.ammo - p.ammo} 🚀`, "#ffd34d", Math.max(14, s * 0.8));
            sound.play("pickup", { vol: mine ? 1 : 0.3 });
          }
          if (p.alive && !r.alive) {
            st.fx.burst("smoke", X(p.x), Y(p.y), 12, { speed: s * 2, size: s * 0.35, life: 1, color: ["#ffffff", "#ccc"] });
            if (mine) sound.play("lose");
          }
        }
      }
      st.prev = g;
    }

    st.shake.apply(ctx, dt);
    ctx.drawImage(bg, 0, 0, w, h);
    ctx.drawImage(decal, 0, 0, w, h);

    for (const p of g.pickups) {
      const bob = Math.sin(now / 300 + p.id) * s * 0.1;
      if (p.type === "ammo") drawAmmoCrate(ctx, X(p.x), Y(p.y) + bob, s * 0.9, now);
      else {
        const pulse = 1 + Math.sin(now / 150) * 0.12;
        const gr = ctx.createRadialGradient(X(p.x), Y(p.y), 0, X(p.x), Y(p.y), s * 1.3);
        gr.addColorStop(0, "rgba(255,80,120,0.5)");
        gr.addColorStop(1, "rgba(255,80,120,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), s * 1.3, 0, TAU);
        ctx.fill();
        drawHeart(ctx, X(p.x), Y(p.y) + bob, s * 0.75 * pulse);
        if (Math.random() < 0.15) st.fx.add({ kind: "spark", x: X(p.x) + (Math.random() - 0.5) * s, y: Y(p.y) + (Math.random() - 0.5) * s, vy: -s, size: s * 0.1, life: 0.6, color: "#ffd0dc" });
      }
    }

    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const r of g.runners) {
      if (!r.alive) continue;
      const x = st.smooth.get(r.id + "x", r.x, dt, 20, 3);
      const y = st.smooth.get(r.id + "y", r.y, dt, 20, 3);
      const m = st.motion.update(r.id, x, y, dt, r.a);
      const mine = r.id === myId;
      const color = TEAMS[r.team].color;
      items.push({
        y,
        draw: () => {
          const blink = r.invuln && Math.floor(now / 90) % 2 ? 0.4 : 1;
          drawTopPerson(ctx, X(x), Y(y), s * 0.5, color, { angle: r.a, pose: m.speed > 0.6 ? "walk" : "idle", walk: m.walk * 2, me: mine, alpha: blink, now });
          ctx.save();
          ctx.globalAlpha = blink;
          drawLauncher(ctx, X(x), Y(y), s * 0.5, r.a);
          ctx.restore();
          // lives as little hearts
          const hs = Math.max(6, s * 0.32);
          for (let k = 0; k < 3; k++) {
            drawHeart(ctx, X(x) + (k - 1) * hs * 1.15, Y(y) - s * 1.0, hs, k < r.lives ? "#ff3b5c" : "rgba(40,30,40,0.6)", k < r.lives ? "#5a0a1a" : "rgba(0,0,0,0.4)");
          }
          drawTag(ctx, X(x), Y(y) - s * 1.35, mine ? `YOU 🚀${r.ammo}` : (st.names.get(r.id) ?? ""), color, mine, Math.max(9, Math.min(12, s * 0.5)));
        },
      });
    }
    items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());

    const ahead = Math.min(0.05, (now - st.stateAt) / 1000);
    for (const m of g.missiles) {
      const mx = m.x + Math.cos(m.a) * MISSILE_SPEED * ahead;
      const my = m.y + Math.sin(m.a) * MISSILE_SPEED * ahead;
      if (Math.random() < 0.8) {
        st.fx.add({ kind: "smoke", x: X(mx) - Math.cos(m.a) * s * 0.5, y: Y(my) - Math.sin(m.a) * s * 0.5, size: s * 0.12, grow: s * 0.7, life: 0.55, color: "#d8d4ca", drag: 2 });
      }
      drawMissile(ctx, X(mx), Y(my), s * 0.9, m.a, TEAMS[m.team].color, now);
    }
    st.fx.update(dt);
    st.fx.draw(ctx);

    if (st.hurt > 0) {
      ctx.fillStyle = `rgba(255,0,0,${st.hurt * 0.3})`;
      ctx.fillRect(0, 0, w, h);
      st.hurt = Math.max(0, st.hurt - dt * 2.5);
    }
    if (me && !me.alive) bigText(ctx, "K.O.! YOU'RE OUT", w / 2, h * 0.42, Math.min(34, w / 16), "#ffb02e");
    else if (me && me.ammo === 0 && g.timeLeft > 0) bigText(ctx, "GRAB AN AMMO CRATE!", w / 2, 78, Math.min(22, w / 24), "#ffd34d");
  });

  return <canvas ref={canvasRef} className="view-canvas" />;
}
