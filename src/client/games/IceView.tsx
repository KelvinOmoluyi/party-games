"use client";

import { useRef } from "react";
import { type IceState, type IceTrack, type PlayerInfo, TEAMS } from "../../shared/types";
import { Smoother, useCanvas } from "../draw";
import { Particles, Shake } from "../render/particles";
import { bigText, type Ctx, drawTag, type Fit, fitWorld, Layer, rng, TAU } from "../render/paint";
import { drawIceBoat, drawPine, drawSnowman } from "../render/props";
import { sound, vibrate } from "../sound";

/** Stadium-shaped path at a given offset from the track's centre line. */
function stadium(ctx: Ctx, T: IceTrack, off: number, X: (x: number) => number, Y: (y: number) => number, s: number) {
  const r = (T.R + off) * s;
  ctx.moveTo(X(T.cx - T.a), Y(T.cy) - r);
  ctx.lineTo(X(T.cx + T.a), Y(T.cy) - r);
  ctx.arc(X(T.cx + T.a), Y(T.cy), r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(X(T.cx - T.a), Y(T.cy) + r);
  ctx.arc(X(T.cx - T.a), Y(T.cy), r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
}

function paintSnow(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, unit: number) {
  const r = rng(seed);
  ctx.fillStyle = "#eef5ff";
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < (w * h) / (unit * unit * 1.2); i++) {
    ctx.fillStyle = r() < 0.6 ? "rgba(170,200,235,0.18)" : "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(x + r() * w, y + r() * h, unit * (0.6 + r() * 2), unit * (0.3 + r()), r() * 3, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  for (let i = 0; i < (w * h) / (unit * unit * 0.8); i++) ctx.fillRect(x + r() * w, y + r() * h, 1.2, 1.2);
}

function paintLake(ctx: Ctx, w: number, h: number, f: Fit, g: IceState) {
  const { s, ox, oy } = f;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;
  const T = g.track;
  paintSnow(ctx, 0, 0, w, h, 4, s);
  // ice ring
  ctx.save();
  ctx.beginPath();
  stadium(ctx, T, T.hw, X, Y, s);
  stadium(ctx, T, -T.hw, X, Y, s);
  ctx.clip("evenodd");
  const ice = ctx.createLinearGradient(0, Y(T.cy - T.R - T.hw), 0, Y(T.cy + T.R + T.hw));
  ice.addColorStop(0, "#a9dcf5");
  ice.addColorStop(0.5, "#cdeefc");
  ice.addColorStop(1, "#9fd2ee");
  ctx.fillStyle = ice;
  ctx.fillRect(0, 0, w, h);
  const r = rng(8);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, s * 0.06);
  for (let i = 0; i < 60; i++) {
    const x = r() * w;
    const y = r() * h;
    const len = s * (0.8 + r() * 2.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y - len * 0.25);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(80,140,190,0.25)";
  for (let i = 0; i < 25; i++) {
    let x = r() * w;
    let y = r() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (r() - 0.5) * s * 2;
      y += (r() - 0.5) * s * 2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // direction chevrons painted on the ice
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = s * 0.22;
  ctx.lineCap = "round";
  for (const [cx, cy, a] of [
    [T.cx - T.a * 0.5, T.cy - T.R, 0],
    [T.cx + T.a * 0.5, T.cy + T.R, Math.PI],
  ] as const) {
    for (let k = -1; k <= 1; k++) {
      ctx.save();
      ctx.translate(X(cx) + Math.cos(a) * k * s * 1.2, Y(cy));
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.8);
      ctx.lineTo(s * 0.3, 0);
      ctx.lineTo(-s * 0.4, s * 0.8);
      ctx.stroke();
      ctx.restore();
    }
  }
  // start / finish line
  const sq = (T.hw * 2 * s) / 8;
  for (let k = 0; k < 8; k++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (k + c) % 2 ? "#1d1530" : "#ffffff";
      ctx.fillRect(X(T.cx) + c * sq * 0.6, Y(T.cy - T.R - T.hw) + k * sq, sq * 0.6, sq);
    }
  }
  ctx.restore();
  // snowbanks along both edges
  for (const off of [T.hw, -T.hw]) {
    ctx.beginPath();
    stadium(ctx, T, off, X, Y, s);
    ctx.strokeStyle = "rgba(120,160,210,0.45)";
    ctx.lineWidth = s * 0.7;
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.45;
    ctx.stroke();
  }
  // pines inside the loop and around the outside
  const rp = rng(21);
  const pines: [number, number, number][] = [];
  for (let i = 0; i < 70; i++) {
    const x = rp() * g.w;
    const y = rp() * g.h;
    const off = Math.abs(x - T.cx) <= T.a ? Math.abs(y - T.cy) - T.R : Math.hypot(x - (x > T.cx ? T.cx + T.a : T.cx - T.a), y - T.cy) - T.R;
    if (Math.abs(off) < T.hw + 1.2) continue;
    pines.push([x, y, 0.7 + rp() * 0.6]);
  }
  for (let i = 0; i < 30; i++) {
    const x = rp() * w;
    const y = rp() * h;
    if (x > ox && x < ox + g.w * s && y > oy && y < oy + g.h * s) continue;
    pines.push([(x - ox) / s, (y - oy) / s, 0.8 + rp() * 0.7]);
  }
  pines.sort((a, b) => a[1] - b[1]);
  for (const [x, y, k] of pines) drawPine(ctx, X(x), Y(y), s * k);
  for (const ob of g.obstacles) drawSnowman(ctx, X(ob.x), Y(ob.y) + ob.r * s * 0.4, ob.r * s * 1.1);
}

export function IceView({ game, players, myId }: { game: IceState; players: PlayerInfo[]; myId: string | null }) {
  const st = useRef({
    game,
    prev: null as IceState | null,
    smooth: new Smoother(),
    bg: new Layer(),
    skid: new Layer(),
    fx: new Particles(),
    shake: new Shake(),
    names: new Map<string, string>(),
  }).current;
  st.game = game;
  st.names = new Map(players.map((p) => [p.id, p.name]));

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    const f = fitWorld(w, h, g.w, g.h, 48, 8, 6);
    const { s, ox, oy } = f;
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy + y * s;
    const key = `${w}x${h}x${dpr}`;
    const bg = st.bg.get(key, w, h, dpr, (c) => paintLake(c, w, h, f, g));
    const skid = st.skid.get(key, w, h, dpr, () => {});

    const prev = st.prev;
    if (prev && prev !== g) {
      for (const b of g.boats) {
        const p = prev.boats.find((q) => q.id === b.id);
        if (!p) continue;
        const mine = b.id === myId;
        if (mine && Math.floor(b.progress) > Math.floor(p.progress) && b.progress >= 1 && b.finishedAt === null) {
          const lap = Math.floor(b.progress) + 1;
          st.fx.floatText(X(b.x), Y(b.y) - s * 1.5, lap === g.laps ? "FINAL LAP!" : `LAP ${lap}!`, "#ffd34d", Math.max(18, s));
          sound.play("pickup");
        }
        if (b.boosting && !p.boosting) {
          sound.play("whoosh", { vol: mine ? 1 : 0.3 });
          st.fx.burst("dust", X(b.x), Y(b.y), 10, { speed: s * 3, size: s * 0.25, life: 0.6, color: "#ffffff", angle: b.a + Math.PI, spread: 1.2 });
        }
        const dv = Math.hypot(b.vx - p.vx, b.vy - p.vy);
        if (dv > 4 && !(b.boosting && !p.boosting)) {
          st.fx.burst("dust", X(b.x), Y(b.y), 8, { speed: s * 2.5, size: s * 0.2, life: 0.5, color: "#ffffff" });
          sound.play("hit", { vol: mine ? 0.8 : 0.25, minGap: 90 });
          if (mine) {
            st.shake.kick(5);
            vibrate(20);
          }
        }
        if (p.finishedAt === null && b.finishedAt !== null) {
          st.fx.confetti(X(b.x), Y(b.y), mine ? 60 : 18, [TEAMS[b.team].color, "#ffffff", "#7fd6ff"], s * 10);
          sound.play(mine ? "win" : "score", { vol: mine ? 1 : 0.4 });
        }
      }
    }
    st.prev = g;

    st.shake.apply(ctx, dt);
    ctx.drawImage(bg, 0, 0, w, h);
    ctx.drawImage(skid, 0, 0, w, h);

    const order = [...g.boats].sort((a, b) => b.progress - a.progress);
    const myPlace = order.findIndex((b) => b.id === myId) + 1;
    for (const b of [...g.boats].sort((a, c) => a.y - c.y)) {
      const x = st.smooth.get(b.id + "x", b.x, dt, 20, 3);
      const y = st.smooth.get(b.id + "y", b.y, dt, 20, 3);
      const a = st.smooth.get(b.id + "a", b.a, dt, 20, 1.5);
      const mine = b.id === myId;
      const sp = Math.hypot(b.vx, b.vy);
      // drifting = moving sideways relative to the hull
      const side = Math.abs(-b.vx * Math.sin(b.a) + b.vy * Math.cos(b.a));
      if (sp > 2) {
        st.skid.paint(dpr, (c) => {
          c.fillStyle = side > 2 ? "rgba(90,130,170,0.12)" : "rgba(255,255,255,0.18)";
          for (const k of [-1, 1]) {
            c.fillRect(X(x) + Math.cos(a + Math.PI / 2) * k * s * 0.7 - 1, Y(y) + Math.sin(a + Math.PI / 2) * k * s * 0.7 - 1, 2.2, 2.2);
          }
        });
      }
      if (side > 3 && Math.random() < 0.5) {
        st.fx.add({ kind: "dust", x: X(x), y: Y(y), vx: -b.vx * s * 0.2, vy: -b.vy * s * 0.2, size: s * 0.12, grow: s * 0.6, life: 0.5, color: "#ffffff", drag: 3 });
      }
      if (b.boosting) {
        st.fx.add({ kind: "spark", x: X(x) - Math.cos(a) * s * 0.8, y: Y(y) - Math.sin(a) * s * 0.8, vx: -Math.cos(a) * s * 3, vy: -Math.sin(a) * s * 3, size: s * 0.18, life: 0.25, color: "#7fd6ff" });
      }
      drawIceBoat(ctx, X(x), Y(y), s, TEAMS[b.team].color, { angle: a, me: mine, now });
      const place = order.indexOf(b) + 1;
      drawTag(ctx, X(x), Y(y) - s * 1.1, mine ? `YOU #${place}` : (st.names.get(b.id) ?? ""), TEAMS[b.team].color, mine, Math.max(9, Math.min(12, s * 0.5)));
    }
    st.fx.update(dt);
    st.fx.draw(ctx);

    const me = g.boats.find((b) => b.id === myId);
    if (me && me.finishedAt !== null) bigText(ctx, `FINISHED #${myPlace}!`, w / 2, h / 2, Math.min(44, w / 14), "#7dff8f", 1 + Math.sin(now / 130) * 0.04);
  });

  return <canvas ref={canvasRef} className="view-canvas" />;
}
