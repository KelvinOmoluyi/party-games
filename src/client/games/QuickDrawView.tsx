"use client";

import { useEffect, useRef } from "react";
import { type GameInput, type PlayerInfo, type QuickDrawState, TEAMS } from "../../shared/types";
import { useCanvas } from "../draw";
import { drawRunner } from "../render/characters";
import { Particles } from "../render/particles";
import { type Ctx, drawCactus, drawTag, Layer, rng, TAU } from "../render/paint";
import { sound, vibrate } from "../sound";

export function paintDesert(ctx: Ctx, w: number, h: number) {
  const horizon = h * 0.62;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#3b1c5a");
  sky.addColorStop(0.45, "#c2456b");
  sky.addColorStop(0.8, "#ff9a4a");
  sky.addColorStop(1, "#ffd27a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  // sun
  const sx = w * 0.5;
  const sy = horizon - h * 0.04;
  const sr = Math.min(w, h) * 0.16;
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 2.4);
  glow.addColorStop(0, "rgba(255,220,120,0.6)");
  glow.addColorStop(1, "rgba(255,150,80,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.arc(sx, sy, sr, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "rgba(194,69,107,0.6)";
  for (let k = 0; k < 4; k++) ctx.fillRect(sx - sr, sy - sr * (0.15 + k * 0.2), sr * 2, sr * 0.05 + k);
  // mesas
  const mesa = (x: number, mw: number, mh: number, c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - mw / 2 - mh * 0.4, horizon);
    ctx.lineTo(x - mw / 2, horizon - mh);
    ctx.lineTo(x + mw / 2, horizon - mh);
    ctx.lineTo(x + mw / 2 + mh * 0.4, horizon);
    ctx.closePath();
    ctx.fill();
  };
  mesa(w * 0.12, w * 0.16, h * 0.16, "#7a2f4a");
  mesa(w * 0.85, w * 0.22, h * 0.12, "#7a2f4a");
  mesa(w * 0.32, w * 0.1, h * 0.08, "#9a3d50");
  // ground
  const gr = ctx.createLinearGradient(0, horizon, 0, h);
  gr.addColorStop(0, "#d98a4a");
  gr.addColorStop(1, "#a85a2e");
  ctx.fillStyle = gr;
  ctx.fillRect(0, horizon, w, h - horizon);
  const r = rng(4);
  ctx.fillStyle = "rgba(90,40,10,0.25)";
  for (let i = 0; i < 80; i++) {
    const y = horizon + r() * (h - horizon);
    ctx.beginPath();
    ctx.ellipse(r() * w, y, 2 + r() * 8 * (y / h), 1 + r() * 2, 0, 0, TAU);
    ctx.fill();
  }
  drawCactus(ctx, w * 0.07, horizon + h * 0.12, h * 0.09);
  drawCactus(ctx, w * 0.94, horizon + h * 0.2, h * 0.11);
  drawCactus(ctx, w * 0.7, horizon + h * 0.03, h * 0.04);
}

export function QuickDrawView({
  game,
  players,
  myId,
  send,
  canPlay,
}: {
  game: QuickDrawState;
  players: PlayerInfo[];
  myId: string | null;
  send: (m: GameInput) => void;
  canPlay: boolean;
}) {
  const goAt = useRef<{ goId: number; t: number } | null>(null);
  const names = new Map(players.map((p) => [p.id, p.name]));
  const mine = myId ? game.current[myId] : null;
  const st = useRef({ game, bg: new Layer(), fx: new Particles(), flash: 0, weed: -0.2, prevStage: "" }).current;
  st.game = game;

  // Start the stopwatch the moment this phone shows TAP!, so Wi-Fi lag doesn't count.
  useEffect(() => {
    if (game.stage === "go" && goAt.current?.goId !== game.goId) {
      requestAnimationFrame(() => {
        goAt.current = { goId: game.goId, t: performance.now() };
      });
      st.flash = 1;
      sound.play("go");
    }
    if (game.stage === "reveal" && st.prevStage !== "reveal") {
      const list = game.participants.map((p) => ({ id: p.id, v: game.current[p.id] })).filter((p) => p.v !== null && p.v !== -1);
      list.sort((a, b) => (a.v as number) - (b.v as number));
      if (list[0]?.id === myId) sound.play("score");
    }
    st.prevStage = game.stage;
  }, [game.stage, game.goId, game.current, game.participants, myId, st]);

  const tap = () => {
    if (!canPlay || mine !== null) return;
    if (game.stage === "wait") {
      send({ type: "early" });
      sound.play("buzz");
      vibrate(200);
    } else if (game.stage === "go" && goAt.current?.goId === game.goId) {
      send({ type: "react", goId: game.goId, ms: performance.now() - goAt.current.t });
      sound.play("shoot");
      vibrate(30);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!e.repeat) tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const canvasRef = useCanvas((ctx, w, h, now, dt, dpr) => {
    const g = st.game;
    ctx.drawImage(st.bg.get(`${w}x${h}x${dpr}`, w, h, dpr, (c) => paintDesert(c, w, h)), 0, 0, w, h);
    // tumbleweed
    st.weed += dt * 0.08;
    if (st.weed > 1.3) st.weed = -0.3 - Math.random();
    const wx = st.weed * w;
    const wy = h * 0.8 - Math.abs(Math.sin(now / 250)) * h * 0.04;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(now / 200);
    ctx.strokeStyle = "#8a5a2b";
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, h * 0.035, h * 0.02, k, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // everyone lined up
    const ps = g.participants;
    const n = ps.length;
    const spacing = Math.min(w * 0.85 / Math.max(1, n), 90);
    const manH = Math.max(28, Math.min(h * 0.3, spacing * 1.7));
    const x0 = w / 2 - (spacing * (n - 1)) / 2;
    ps.forEach((p, i) => {
      const v = g.current[p.id];
      const x = x0 + i * spacing;
      const y = h * 0.66 + (i % 2) * manH * 0.12;
      const me = p.id === myId;
      drawRunner(ctx, x, y, manH, TEAMS[p.team].color, {
        pose: v === -1 ? "fall" : v != null ? "draw" : "stand",
        lean: v === -1 ? 0.5 : 0,
        me,
      });
      if (me) drawTag(ctx, x, y - manH * 1.1, "YOU", TEAMS[p.team].color, true, 11);
    });

    if (st.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${st.flash * 0.6})`;
      ctx.fillRect(0, 0, w, h);
      st.flash = Math.max(0, st.flash - dt * 4);
    }
    st.fx.update(dt);
    st.fx.draw(ctx);
  });

  const fmt = (v: number | null | undefined) => (v === -1 ? "FALSE START" : v == null ? "—" : `${v} ms`);

  let cls = "qd-wait";
  let big = "WAIT FOR IT…";
  let small = `Round ${game.roundNo} of ${game.totalRounds}`;
  if (game.stage === "go") {
    cls = "qd-go";
    big = "TAP!";
  }
  if (mine === -1) {
    cls = "qd-false";
    big = "FALSE START!";
    small = "+1000 ms penalty";
  } else if (mine != null && game.stage !== "reveal") {
    cls = "qd-done";
    big = `${mine} ms`;
    small = "Nice! Waiting for others…";
  }

  return (
    <div className="qd-wrap" onPointerDown={tap}>
      <canvas ref={canvasRef} className="view-canvas" />
      {game.stage === "reveal" ? (
        <div className="qd-reveal">
          <div className="qd-small">
            Round {game.roundNo} of {game.totalRounds}
          </div>
          <div className="qd-list">
            {game.participants
              .map((p) => ({ ...p, v: game.current[p.id] }))
              .sort((a, b) => (a.v === -1 ? 9999 : (a.v ?? 9999)) - (b.v === -1 ? 9999 : (b.v ?? 9999)))
              .map((p, i) => (
                <div key={p.id} className={`qd-row ${p.id === myId ? "me" : ""}`} style={{ borderColor: TEAMS[p.team].color }}>
                  <span>{i === 0 && p.v !== -1 ? "🥇" : `${i + 1}.`}</span>
                  <span className="qd-name" style={{ color: TEAMS[p.team].color }}>
                    {names.get(p.id) ?? "?"}
                  </span>
                  <span>{fmt(p.v)}</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className={`qd-text ${cls}`}>
          <div className="qd-big">{big}</div>
          <div className="qd-small">{canPlay ? small : "Spectating"}</div>
        </div>
      )}
    </div>
  );
}
