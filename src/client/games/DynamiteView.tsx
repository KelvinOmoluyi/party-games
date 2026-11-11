"use client";

import { useRef } from "react";
import { type DynamiteState, type PlayerInfo, TEAMS } from "../../shared/types";
import { Motion, Smoother, useCanvas } from "../draw";
import { drawTopPerson } from "../render/characters";
import { Particles, Shake } from "../render/particles";
import { bigText, type Ctx, darken, drawBarrel, drawTag, fillStroke, type Fit, fitWorld, Layer, paintSand, rng, TAU } from "../render/paint";
import { drawDynamite } from "../render/props";
import { sound, vibrate } from "../sound";

function paintCamp(ctx: Ctx, w: number, h: number, f: Fit, g: DynamiteState) {
  const { s, ox, oy } = f;
  const AW = g.w * s;
  const AH = g.h * s;
  paintSand(ctx, 0, 0, w, h, 2, "#8f6a45", s);
  paintSand(ctx, ox, oy, AW, AH, 9, "#c49a68", s);
  // mine-cart rails crossing the yard
  const rail = (y: number) => {
    ctx.fillStyle = "#6b4426";
    for (let x = ox - s; x < ox + AW + s; x += s * 0.8) ctx.fillRect(x, y - s * 0.6, s * 0.3, s * 1.2);
    ctx.strokeStyle = "#7d8088";
    ctx.lineWidth = s * 0.14;
    for (const d of [-0.4, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(ox - s, y + d * s);
      ctx.lineTo(ox + AW + s, y + d * s);
      ctx.stroke();
    }
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, AW, AH);
  ctx.clip();
  ctx.globalAlpha = 0.7;
  rail(oy + AH * 0.3);
  rail(oy + AH * 0.72);
  ctx.restore();
  // fence
  for (const [x1, y1, x2, y2] of [[ox, oy, ox + AW, oy], [ox, oy + AH, ox + AW, oy + AH], [ox, oy, ox, oy + AH], [ox + AW, oy, ox + AW, oy + AH]]) {
    for (const [lw, col] of [[s * 0.26, "#3e2810"], [s * 0.13, "#8a5a2b"]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  // crates, barrels and TNT boxes outside the fence
  const r = rng(31);
  for (let i = 0; i < 46; i++) {
    const x = r() * w;
    const y = r() * h;
    if (x > ox - s * 1.2 && x < ox + AW + s * 1.2 && y > oy - s * 1.2 && y < oy + AH + s * 1.2) continue;
    const k = r();
    if (k < 0.45) {
      const cs = s * (0.8 + r() * 0.5);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(x - cs / 2 + s * 0.15, y - cs / 2 + s * 0.2, cs, cs);
      ctx.beginPath();
      ctx.rect(x - cs / 2, y - cs / 2, cs, cs);
      fillStroke(ctx, k < 0.15 ? "#c8202a" : "#b07a43", "#3e2810", Math.max(1, s * 0.06));
      if (k < 0.15) {
        ctx.fillStyle = "#fff";
        ctx.font = `${cs * 0.35}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("TNT", x, y);
      } else {
        ctx.strokeStyle = "#7a4f28";
        ctx.beginPath();
        ctx.moveTo(x - cs / 2, y - cs / 2);
        ctx.lineTo(x + cs / 2, y + cs / 2);
        ctx.stroke();
      }
    } else drawBarrel(ctx, x, y, s * 0.6, k < 0.7 ? "#7a4f28" : "#5a6470");
  }
}

export function DynamiteView({ game, players, myId }: { game: DynamiteState; players: PlayerInfo[]; myId: string | null }) {
  const st = useRef({
    game,
    prev: null as DynamiteState | null,
    smooth: new Smoother(),
    motion: new Motion(),
    bg: new Layer(),
    fx: new Particles(),
    shake: new Shake(),
    names: new Map<string, string>(),
    nextTick: 0,
    flash: 0,
  }).current;
  st.game = game;
  st.names = new Map(players.map((p) => [p.id, p.name]));

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    const f = fitWorld(w, h, g.w, g.h, 50, 12, 10);
    const { s, ox, oy } = f;
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy + y * s;
    const bg = st.bg.get(`${w}x${h}x${dpr}x${g.w}`, w, h, dpr, (c) => paintCamp(c, w, h, f, g));
    const holderR = g.runners.find((r) => r.id === g.holder);

    const prev = st.prev;
    if (prev && prev !== g) {
      if (g.holder && prev.holder !== g.holder) {
        const nh = g.runners.find((r) => r.id === g.holder);
        if (nh) {
          if (prev.holder) {
            sound.play("pop");
            st.fx.floatText(X(nh.x), Y(nh.y) - s * 2, "PASSED!", "#ffd34d", Math.max(14, s * 0.8));
          } else sound.play("beep");
          if (g.holder === myId) {
            vibrate([60, 40, 60]);
            st.flash = 1;
          }
        }
      }
      if (g.boom && g.boom.id !== prev.boom?.id) {
        const mine = g.boom.victim === myId;
        st.fx.explosion(X(g.boom.x), Y(g.boom.y), s * 1.6);
        st.fx.add({ kind: "ring", x: X(g.boom.x), y: Y(g.boom.y), size: s, grow: s * 10, life: 0.45, color: "#ffffff" });
        st.shake.kick(mine ? 18 : 9);
        sound.play("boom");
        if (mine) vibrate([150, 60, 150]);
      }
    }
    st.prev = g;

    // ticking speeds up as the fuse burns down
    if (holderR && g.fuse > 0 && now > st.nextTick) {
      sound.play("tick", { vol: g.holder === myId ? 1 : 0.6, minGap: 0 });
      st.nextTick = now + Math.max(90, Math.min(700, g.fuse * 110));
    }

    st.shake.apply(ctx, dt);
    ctx.drawImage(bg, 0, 0, w, h);

    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const r of g.runners) {
      if (!r.alive) continue;
      const x = st.smooth.get(r.id + "x", r.x, dt, 20, 3);
      const y = st.smooth.get(r.id + "y", r.y, dt, 20, 3);
      const m = st.motion.update(r.id, x, y, dt);
      const mine = r.id === myId;
      const holds = r.id === g.holder;
      const color = TEAMS[r.team].color;
      items.push({
        y,
        draw: () => {
          if (holds) {
            const p = 1 + Math.sin(now / Math.max(40, g.fuse * 30)) * 0.12;
            ctx.fillStyle = "rgba(255,40,40,0.25)";
            ctx.beginPath();
            ctx.arc(X(x), Y(y), s * 1.3 * p, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = "#ff3030";
            ctx.lineWidth = Math.max(2, s * 0.12);
            ctx.stroke();
          }
          if (r.dashing) {
            for (let k = 1; k <= 2; k++) drawTopPerson(ctx, X(x - r.vx * 0.03 * k), Y(y - r.vy * 0.03 * k), s * 0.5, color, { angle: m.a, pose: "push", alpha: 0.28 / k });
          }
          drawTopPerson(ctx, X(x), Y(y), s * 0.5, color, { angle: m.a, pose: holds ? "carry" : r.dashing ? "push" : m.speed > 0.6 ? "walk" : "idle", walk: m.walk * 2, me: mine, now });
          if (holds) {
            const tip = drawDynamite(ctx, X(x), Y(y) - s * 0.9 + Math.sin(now / 120) * s * 0.06, s * 0.75, g.fuse / g.fuseMax, now);
            if (Math.random() < 0.7) {
              st.fx.add({ kind: "spark", x: tip.x, y: tip.y, vx: (Math.random() - 0.5) * s * 4, vy: -Math.random() * s * 4, g: s * 10, size: s * 0.1, life: 0.35, color: Math.random() < 0.5 ? "#ffe27a" : "#ff9a3d" });
            }
          }
          drawTag(ctx, X(x), Y(y) - s * (holds ? 2.1 : 1.05), mine ? "YOU" : (st.names.get(r.id) ?? ""), color, mine, Math.max(9, Math.min(12, s * 0.5)));
        },
      });
    }
    items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
    st.fx.update(dt);
    st.fx.draw(ctx);

    // you're holding it: red pulse around the screen edges
    if (g.holder === myId) {
      const a = 0.25 + Math.sin(now / Math.max(50, g.fuse * 40)) * 0.15 + st.flash * 0.3;
      const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
      gr.addColorStop(0, "rgba(255,0,0,0)");
      gr.addColorStop(1, `rgba(255,20,20,${a})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
      bigText(ctx, "PASS IT ON!", w / 2, 78, Math.min(34, w / 16), "#ff5a5a", 1 + Math.sin(now / 100) * 0.05);
    }
    st.flash = Math.max(0, st.flash - dt * 2);
    const me = g.runners.find((r) => r.id === myId);
    if (me && !me.alive) bigText(ctx, "KABOOM! YOU'RE OUT", w / 2, h * 0.42, Math.min(34, w / 16), "#ffb02e");
    else if (!g.holder && g.timeLeft > 0 && g.runners.filter((r) => r.alive).length > 1) bigText(ctx, "NEXT DYNAMITE…", w / 2, 78, Math.min(26, w / 20), "#ffd34d");
    void darken;
  });

  return <canvas ref={canvasRef} className="view-canvas" />;
}
