"use client";

import { useRef } from "react";
import { type PlayerInfo, TEAMS, type TugState } from "../../shared/types";
import { Smoother, useCanvas } from "../draw";
import { drawFlag, drawRope, drawTopPerson } from "../render/characters";
import { Particles, Shake } from "../render/particles";
import { alpha, bigText, type Ctx, drawBush, drawTag, drawTree, fillStroke, Layer, paintDirt, paintGrass, rng, TAU } from "../render/paint";
import { sound, vibrate } from "../sound";

function paintField(ctx: Ctx, w: number, h: number, cx: number, cy: number, s: number, g: TugState) {
  paintGrass(ctx, 0, 0, w, h, 21, "#79c653", s);
  // mowed stripes
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.6);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = -30; i < 30; i += 2) ctx.fillRect(i * s * 1.6, -h * 2, s * 1.6, h * 4);
  ctx.restore();
  const R = g.radius * s;
  const n = g.teams.length;
  const half = n === 2 ? Math.PI / 2 : Math.PI / Math.max(1, n);
  // team zones
  for (const t of g.teams) {
    const col = TEAMS[t.team].color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, Math.max(w, h), t.angle - half, t.angle + half);
    ctx.closePath();
    ctx.fillStyle = alpha(col, 0.22);
    ctx.fill();
    // chevrons pointing outward
    for (let k = 0; k < 3; k++) {
      const d = R + s * (1.4 + k * 1.3);
      const x = cx + Math.cos(t.angle) * d;
      const y = cy + Math.sin(t.angle) * d;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t.angle);
      ctx.strokeStyle = alpha("#ffffff", 0.35);
      ctx.lineWidth = s * 0.3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.7);
      ctx.lineTo(s * 0.3, 0);
      ctx.lineTo(-s * 0.4, s * 0.7);
      ctx.stroke();
      ctx.restore();
    }
  }
  // trees in the corners
  const r = rng(13);
  for (let i = 0; i < 18; i++) {
    const a = r() * TAU;
    const d = R * 1.75 + r() * Math.max(w, h);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 0.7;
    if (x < -s * 3 || x > w + s * 3 || y < -s * 3 || y > h + s * 3) continue;
    if (r() < 0.5) drawTree(ctx, x, y, s * (1.6 + r()), i);
    else drawBush(ctx, x, y, s * (0.9 + r() * 0.5), i);
  }
  // mud pit
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.2, R + s * 0.35, 0, TAU);
  ctx.fillStyle = "rgba(60,35,15,0.35)";
  ctx.fill();
  paintDirt(ctx, cx, cy, R, 4, "#8d5f37", s);
  const rr = rng(8);
  for (let i = 0; i < 9; i++) {
    const a = rr() * TAU;
    const d = Math.sqrt(rr()) * R * 0.8;
    ctx.fillStyle = "rgba(70,40,20,0.45)";
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s * (0.6 + rr()), s * (0.35 + rr() * 0.4), rr() * 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * d - s * 0.15, cy + Math.sin(a) * d - s * 0.1, s * 0.3, s * 0.1, -0.3, 0, TAU);
    ctx.fill();
  }
  ctx.setLineDash([s * 0.6, s * 0.4]);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(2, s * 0.18);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function TugView({ game, players, myId }: { game: TugState; players: PlayerInfo[]; myId: string | null }) {
  const st = useRef({
    game,
    prev: null as TugState | null,
    smooth: new Smoother(),
    bg: new Layer(),
    fx: new Particles(),
    shake: new Shake(),
    names: new Map<string, string>(),
    lastKnot: { x: 0, y: 0 },
  }).current;
  st.game = game;
  st.names = new Map(players.map((p) => [p.id, p.name]));
  const myTeam = players.find((p) => p.id === myId)?.team;

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    const top = 50;
    const R = g.radius;
    const s = Math.max(4, Math.min(w - 20, h - top - 10) / 2 / (R * 1.3));
    const cx = w / 2;
    const cy = top + (h - top) / 2;
    const P = (x: number, y: number) => ({ x: cx + x * s, y: cy + y * s });
    const bg = st.bg.get(`${w}x${h}x${dpr}`, w, h, dpr, (c) => paintField(c, w, h, cx, cy, s, g));

    const prev = st.prev;
    if (prev && prev !== g && prev.winner === null && g.winner !== null) {
      const k = P(g.knot.x, g.knot.y);
      st.fx.confetti(k.x, k.y, 70, [TEAMS[g.winner].color, "#ffffff", "#ffd34d"], s * 14);
      st.shake.kick(6);
      sound.play(g.winner === myTeam ? "win" : "lose");
      if (g.winner === myTeam) vibrate([50, 40, 50, 40, 120]);
    }
    st.prev = g;

    st.shake.apply(ctx, dt);
    ctx.drawImage(bg, 0, 0, w, h);

    const kx = st.smooth.get("kx", g.knot.x, dt, 14);
    const ky = st.smooth.get("ky", g.knot.y, dt, 14);
    const knot = P(kx, ky);
    const kv = Math.hypot(kx - st.lastKnot.x, ky - st.lastKnot.y) / Math.max(dt, 0.001);
    st.lastKnot = { x: kx, y: ky };
    if (kv > 1.2 && Math.random() < 0.5) {
      st.fx.burst("splash", knot.x, knot.y + s * 0.4, 2, { speed: s * 3, size: s * 0.2, life: 0.5, color: ["#6b4426", "#8d5f37"], angle: -Math.PI / 2, spread: 2.5, g: s * 10 });
    }

    // leading team (for the knot ribbon)
    let lead = g.teams[0];
    let best = -Infinity;
    for (const t of g.teams) {
      const p = kx * Math.cos(t.angle) + ky * Math.sin(t.angle);
      if (p > best) {
        best = p;
        lead = t;
      }
    }

    // ropes + pullers (draw far ropes first)
    const teams = [...g.teams].sort((a, b) => Math.sin(a.angle) - Math.sin(b.angle));
    for (const t of teams) {
      const color = TEAMS[t.team].color;
      const anchor = P(Math.cos(t.angle) * R * 1.24, Math.sin(t.angle) * R * 1.24);
      drawFlag(ctx, anchor.x, anchor.y + s * 0.3, s * 1.9, color, now);
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, s * 0.35, 0, TAU);
      fillStroke(ctx, "#7a4f28", "#3b250f", 2);
      drawRope(ctx, knot.x, knot.y, anchor.x, anchor.y, Math.max(4, s * 0.38));
      const ang = Math.atan2(knot.y - anchor.y, knot.x - anchor.x);
      const won = g.winner === t.team;
      t.members.forEach((id, i) => {
        const f = 0.3 + (i / Math.max(1, t.members.length)) * 0.6;
        const pull = g.pulls[id] ?? 0;
        const back = pull * s * 0.35;
        const px = knot.x + (anchor.x - knot.x) * f - Math.cos(ang) * back;
        const py = knot.y + (anchor.y - knot.y) * f - Math.sin(ang) * back;
        const side = (i % 2 ? 1 : -1) * s * 0.7;
        const ox = Math.cos(ang + Math.PI / 2) * side;
        const oy = Math.sin(ang + Math.PI / 2) * side;
        const me = id === myId;
        drawTopPerson(ctx, px + ox, py + oy, s * 0.66, color, { angle: ang, pose: won ? "cheer" : "pull", me, now });
        if (pull > 0.7 && Math.random() < 0.05) {
          st.fx.add({ kind: "splash", x: px + ox, y: py + oy - s * 0.5, vx: (Math.random() - 0.5) * s * 2, vy: -s * 2, g: s * 8, size: s * 0.12, life: 0.5, color: "#bfe6ff" });
        }
        if (me) drawTag(ctx, px + ox, py + oy - s * 1.2, "YOU", color, true, Math.max(9, Math.min(12, s * 0.55)));
      });
    }

    // knot
    const kr = Math.max(10, s * 0.95);
    ctx.beginPath();
    ctx.arc(knot.x + 2, knot.y + 3, kr, 0, TAU);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(knot.x, knot.y, kr, 0, TAU);
    fillStroke(ctx, "#d9b27a", "#4a2f12", Math.max(2, s * 0.15));
    ctx.strokeStyle = "#a87b45";
    ctx.lineWidth = Math.max(1.5, s * 0.14);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(knot.x, knot.y, kr * 0.65, k * 2.1 + now / 2000, k * 2.1 + 1.4 + now / 2000);
      ctx.stroke();
    }
    // ribbon in the leading team's colour
    const lc = TEAMS[lead.team].color;
    ctx.fillStyle = lc;
    ctx.strokeStyle = "#1d1530";
    ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(knot.x, knot.y - kr * 0.9);
      ctx.lineTo(knot.x + side * kr * 0.9, knot.y - kr * 1.6 + Math.sin(now / 120 + side) * 2);
      ctx.lineTo(knot.x + side * kr * 0.75, knot.y - kr * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    st.fx.update(dt);
    st.fx.draw(ctx);

    if (g.winner !== null) {
      const t = TEAMS[g.winner];
      bigText(ctx, `${t.name.toUpperCase()} WINS!`, w / 2, top + (h - top) * 0.22, Math.min(54, w / 9), t.color, 1 + Math.sin(now / 120) * 0.04);
    }
  });

  return <canvas ref={canvasRef} className="view-canvas" />;
}
