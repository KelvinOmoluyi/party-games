"use client";

import { useRef } from "react";
import { type PlayerInfo, type RaceState, TEAMS } from "../../shared/types";
import { Smoother, useCanvas } from "../draw";
import { drawRunner } from "../render/characters";
import { Particles } from "../render/particles";
import { type Ctx, darken, drawTag, FONTS, fillStroke, fontEpoch, Layer, lighten, paintGrass, rng, TAU } from "../render/paint";
import { sound, vibrate } from "../sound";

interface Geo {
  skyH: number;
  trackTop: number;
  trackH: number;
  laneH: number;
  n: number;
  startX: number;
  endX: number;
}

function geometry(w: number, h: number, count: number): Geo {
  const skyH = Math.max(70, Math.min(h * 0.34, 210));
  const trackTop = skyH + Math.max(6, h * 0.03);
  const trackH = h - trackTop - Math.max(6, h * 0.03);
  const n = Math.max(count, 4);
  // In landscape the RUN buttons float in the bottom corners, so keep the race between them.
  const landscape = w > h * 1.3;
  return { skyH, trackTop, trackH, laneH: trackH / n, n, startX: w * (landscape ? 0.22 : 0.2), endX: w * (landscape ? 0.8 : 0.88) };
}

function paintStadium(ctx: Ctx, w: number, h: number, G: Geo) {
  const { skyH, trackTop, trackH, laneH, n, startX, endX } = G;
  const sky = ctx.createLinearGradient(0, 0, 0, skyH);
  sky.addColorStop(0, "#5fb8ff");
  sky.addColorStop(1, "#c8ecff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, skyH);
  // sun
  ctx.fillStyle = "rgba(255,240,170,0.5)";
  ctx.beginPath();
  ctx.arc(w * 0.82, skyH * 0.28, skyH * 0.22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#fff4b8";
  ctx.beginPath();
  ctx.arc(w * 0.82, skyH * 0.28, skyH * 0.14, 0, TAU);
  ctx.fill();
  // hills
  const hill = (base: number, amp: number, color: string, seed: number) => {
    const r = rng(seed);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, skyH);
    let x = 0;
    ctx.lineTo(0, base);
    while (x < w) {
      const nx = x + w * (0.12 + r() * 0.15);
      ctx.quadraticCurveTo((x + nx) / 2, base - amp * (0.5 + r()), nx, base);
      x = nx;
    }
    ctx.lineTo(w, skyH);
    ctx.closePath();
    ctx.fill();
  };
  hill(skyH * 0.55, skyH * 0.25, "#8fcf7a", 2);
  hill(skyH * 0.65, skyH * 0.2, "#6bb85a", 4);
  // grandstand
  const standTop = skyH * 0.42;
  const standH = skyH - standTop;
  ctx.fillStyle = "#3d4a6b";
  ctx.fillRect(0, standTop, w, standH);
  // roof awning
  const stripe = Math.max(10, w / 40);
  for (let x = 0, k = 0; x < w; x += stripe, k++) {
    ctx.fillStyle = k % 2 ? "#ffffff" : "#ff4d5e";
    ctx.beginPath();
    ctx.moveTo(x, standTop - standH * 0.18);
    ctx.lineTo(x + stripe, standTop - standH * 0.18);
    ctx.lineTo(x + stripe, standTop + standH * 0.05);
    ctx.arc(x + stripe / 2, standTop + standH * 0.05, stripe / 2, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  }
  // crowd
  const r = rng(7);
  const rows = 4;
  const headR = Math.max(2.5, standH / rows / 2.6);
  const colors = ["#ff4d5e", "#3d8bff", "#2ecc71", "#ffc531", "#ff8af0", "#ffffff", "#9b7bff", "#ff9a3d"];
  for (let row = 0; row < rows; row++) {
    const y = standTop + standH * 0.22 + row * (standH * 0.72) / rows;
    ctx.fillStyle = darken("#3d4a6b", 0.2 + row * 0.05);
    ctx.fillRect(0, y + headR * 0.8, w, headR * 0.5);
    for (let x = headR + (row % 2) * headR; x < w; x += headR * 2.3) {
      if (r() < 0.12) continue;
      const c = colors[Math.floor(r() * colors.length)];
      ctx.fillStyle = darken(c, 0.15);
      ctx.beginPath();
      ctx.ellipse(x, y + headR * 1.1, headR * 1.05, headR * 0.8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, headR * 0.8, 0, TAU);
      ctx.fill();
      if (r() < 0.15) {
        ctx.strokeStyle = c;
        ctx.lineWidth = Math.max(1.5, headR * 0.35);
        ctx.beginPath();
        ctx.moveTo(x - headR * 0.6, y);
        ctx.lineTo(x - headR * 1.2, y - headR * 1.6);
        ctx.moveTo(x + headR * 0.6, y);
        ctx.lineTo(x + headR * 1.2, y - headR * 1.6);
        ctx.stroke();
      }
    }
  }
  // ad boards
  const boardH = Math.max(8, standH * 0.2);
  const boardY = skyH - boardH;
  const boardColors = ["#ffc531", "#3d8bff", "#ff4d5e", "#2ecc71"];
  const bw = w / 6;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = boardColors[i % 4];
    ctx.fillRect(i * bw, boardY, bw - 2, boardH);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `${Math.max(7, boardH * 0.7)}px ${FONTS.display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(i % 2 ? "STICK PARTY" : "GO GO GO!", i * bw + bw / 2, boardY + boardH / 2 + 1);
  }
  // grass strips
  paintGrass(ctx, 0, skyH, w, trackTop - skyH, 31, "#5fae48", 14);
  paintGrass(ctx, 0, trackTop + trackH, w, h - trackTop - trackH, 32, "#5fae48", 14);
  // track
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? "#d46a43" : "#cc6240";
    ctx.fillRect(0, trackTop + i * laneH, w, laneH);
  }
  const rt = rng(12);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < (w * trackH) / 60; i++) ctx.fillRect(rt() * w, trackTop + rt() * trackH, 2, 1);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1, laneH * 0.06);
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(0, trackTop + i * laneH);
    ctx.lineTo(w, trackTop + i * laneH);
    ctx.stroke();
  }
  // distance markers
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  for (let k = 1; k < 4; k++) {
    const x = startX + ((endX - startX) * k) / 4;
    ctx.beginPath();
    ctx.moveTo(x, trackTop);
    ctx.lineTo(x, trackTop + trackH);
    ctx.stroke();
  }
  // start line
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(startX - 2, trackTop, 4, trackH);
  // finish checker
  const sq = Math.max(4, Math.min(10, laneH / 2.5));
  for (let y = trackTop, row = 0; y < trackTop + trackH; y += sq, row++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = (row + c) % 2 ? "#111" : "#fff";
      ctx.fillRect(endX + c * sq, y, sq, Math.min(sq, trackTop + trackH - y));
    }
  }
}

function paintFinishArch(ctx: Ctx, G: Geo) {
  const { skyH, trackTop, trackH, endX } = G;
  const x = endX + 8;
  const topY = Math.max(skyH * 0.25, 54);
  const pw = Math.max(4, trackH * 0.025);
  for (const y of [trackTop - 2, trackTop + trackH + 2]) {
    ctx.beginPath();
    ctx.roundRect(x - pw / 2, topY, pw, y - topY, pw / 2);
    fillStroke(ctx, "#e6e6ee", "#3a3550", 1.5);
  }
  const bh = Math.max(16, skyH * 0.16);
  ctx.beginPath();
  ctx.roundRect(x - bh * 2.6, topY - bh * 0.2, bh * 5.2, bh, bh * 0.25);
  fillStroke(ctx, "#ff4d5e", "#3a1020", 2);
  ctx.fillStyle = "#fff";
  ctx.font = `${bh * 0.72}px ${FONTS.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FINISH", x, topY + bh * 0.32);
}

export function RaceView({ game, players, myId }: { game: RaceState; players: PlayerInfo[]; myId: string | null }) {
  const st = useRef({
    game,
    prev: null as RaceState | null,
    smooth: new Smoother(),
    bg: new Layer(),
    fx: new Particles(),
    names: new Map<string, string>(),
    clouds: Array.from({ length: 5 }, (_, i) => ({ x: Math.random(), y: 0.08 + (i % 3) * 0.1, s: 0.6 + Math.random() * 0.6, v: 0.004 + Math.random() * 0.006 })),
  }).current;
  st.game = game;
  st.names = new Map(players.map((p) => [p.id, p.name]));

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    const runners = [...g.runners].sort((a, b) => a.team - b.team || a.id.localeCompare(b.id));
    const G = geometry(w, h, runners.length);
    const bg = st.bg.get(`${w}x${h}x${dpr}x${G.n}x${fontEpoch()}`, w, h, dpr, (c) => paintStadium(c, w, h, G));
    const posX = (d: number) => G.startX + (d / g.finish) * (G.endX - G.startX);
    const feetY = (i: number) => G.trackTop + (i + 0.8) * G.laneH;
    const finishOrder = g.runners.filter((r) => r.finishedAt !== null).sort((a, b) => a.finishedAt! - b.finishedAt!).map((r) => r.id);

    const prev = st.prev;
    if (prev && prev !== g) {
      runners.forEach((r, i) => {
        const p = prev.runners.find((q) => q.id === r.id);
        if (p && p.finishedAt === null && r.finishedAt !== null) {
          const me = r.id === myId;
          const place = finishOrder.indexOf(r.id) + 1;
          st.fx.confetti(G.endX, feetY(i) - G.laneH, me ? 50 : 18, [TEAMS[r.team].color, "#ffffff", "#ffd34d"], 260);
          st.fx.floatText(G.endX - 20, feetY(i) - G.laneH * 2, `#${place}`, place === 1 ? "#ffd34d" : "#ffffff", Math.max(16, G.laneH * 1.2));
          sound.play(me ? "win" : "score", { vol: me ? 1 : 0.5 });
          if (me) vibrate([40, 30, 40, 30, 120]);
        }
      });
    }
    st.prev = g;

    ctx.drawImage(bg, 0, 0, w, h);
    // clouds
    for (const c of st.clouds) {
      c.x += c.v * dt;
      if (c.x > 1.2) c.x = -0.2;
      const cx = c.x * w;
      const cy = c.y * G.skyH;
      const cs = G.skyH * 0.12 * c.s;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(cx, cy, cs, 0, TAU);
      ctx.arc(cx + cs, cy + cs * 0.2, cs * 0.8, 0, TAU);
      ctx.arc(cx - cs, cy + cs * 0.25, cs * 0.7, 0, TAU);
      ctx.fill();
    }
    paintFinishArch(ctx, G);

    const manH = Math.max(24, Math.min(G.laneH * 2.3, G.trackH * 0.42, 96));
    runners.forEach((r, i) => {
      const d = st.smooth.get(r.id, r.dist, dt, 14);
      const x = posX(d);
      const y = feetY(i);
      const me = r.id === myId;
      const color = TEAMS[r.team].color;
      if (me) {
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fillRect(0, G.trackTop + i * G.laneH, w, G.laneH);
      }
      // lane label
      const fs = Math.max(8, Math.min(13, G.laneH * 0.55));
      ctx.font = `800 ${fs}px ${FONTS.body}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const label = st.names.get(r.id) ?? "?";
      const ly = G.trackTop + (i + 0.5) * G.laneH;
      ctx.fillStyle = darken(color, 0.1);
      ctx.beginPath();
      // name pill sits just behind the start line
      const lw = ctx.measureText(label).width + fs * 0.8;
      const lx = Math.max(2, G.startX - lw - 6);
      ctx.roundRect(lx, ly - fs * 0.7, lw, fs * 1.4, fs * 0.7);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, lx + fs * 0.4, ly + 0.5);
      const place = finishOrder.indexOf(r.id);
      if (place >= 0) {
        ctx.textAlign = "right";
        ctx.font = `${fs * 1.3}px ${FONTS.display}`;
        ctx.fillStyle = place === 0 ? "#ffd34d" : "#fff";
        ctx.fillText(`#${place + 1}`, w - 6, ly);
      }
      const finished = r.finishedAt !== null;
      if (!finished && r.speed > 7 && Math.random() < 0.4) {
        st.fx.add({ kind: "dust", x: x - manH * 0.15, y, vx: -40 - Math.random() * 40, vy: -10 - Math.random() * 15, size: manH * 0.05, grow: manH * 0.25, life: 0.5, color: "#e9b48f", drag: 3 });
      }
      drawRunner(ctx, x, y, manH, color, {
        pose: finished ? "cheer" : r.speed > 0.4 ? "run" : "stand",
        phase: finished ? now / 120 : d * 0.95,
        lean: finished ? 0 : Math.min(0.32, r.speed / 70),
        me,
      });
      if (me) drawTag(ctx, x, y - manH * 1.08, "YOU", color, true, Math.max(9, Math.min(12, manH * 0.18)));
    });

    st.fx.update(dt);
    st.fx.draw(ctx);
    void lighten;
  });

  return <canvas ref={canvasRef} className="view-canvas" />;
}
