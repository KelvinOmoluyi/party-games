"use client";
// Small canvas illustrations used in the menus: avatars, game thumbnails, title hero, podium.

import { useEffect, useRef } from "react";
import { type GameId, TEAMS, type TeamId, type TeamRank } from "../shared/types";
import { useCanvas } from "./draw";
import { paintDesert } from "./games/QuickDrawView";
import { drawChicken, drawRope, drawRunner, drawTank, drawTopPerson } from "./render/characters";
import { Particles } from "./render/particles";
import { bigText, type Ctx, drawBush, drawCactus, drawTree, fillStroke, paintDirt, paintGrass, paintSand, TAU } from "./render/paint";
import { drawAmmoCrate, drawBoulder, drawDynamite, drawHeart, drawIceBoat, drawLauncher, drawMissile, drawPine, drawRuinBlock, drawSnowman } from "./render/props";

/** Canvas drawn once (and again on resize), not every frame. */
function useStaticCanvas(draw: (ctx: Ctx, w: number, h: number) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (!w || !h) return;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, w, h);
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    void document.fonts?.ready.then(paint);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function Avatar({ team, size = 34, cheer = false }: { team: TeamId; size?: number; cheer?: boolean }) {
  const ref = useStaticCanvas(
    (ctx, w, h) => drawRunner(ctx, w / 2, h - 3, h * 0.92, TEAMS[team].color, { pose: cheer ? "cheer" : "stand" }),
    [team, cheer],
  );
  return <canvas ref={ref} className="avatar" style={{ width: size * 0.8, height: size }} />;
}

function thumb(ctx: Ctx, w: number, h: number, id: GameId) {
  const red = TEAMS[0].color;
  const blue = TEAMS[1].color;
  const green = TEAMS[2].color;
  const u = h / 8;
  switch (id) {
    case "race": {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.4);
      sky.addColorStop(0, "#5fb8ff");
      sky.addColorStop(1, "#c8ecff");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.4);
      ctx.fillStyle = "#6bb85a";
      ctx.beginPath();
      ctx.ellipse(w * 0.3, h * 0.42, w * 0.4, h * 0.15, 0, Math.PI, 0);
      ctx.ellipse(w * 0.85, h * 0.42, w * 0.3, h * 0.12, 0, Math.PI, 0);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 ? "#d46a43" : "#cc6240";
        ctx.fillRect(0, h * 0.4 + i * h * 0.2, w, h * 0.2);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      for (let i = 0; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, h * 0.4 + i * h * 0.2);
        ctx.lineTo(w, h * 0.4 + i * h * 0.2);
        ctx.stroke();
      }
      drawRunner(ctx, w * 0.42, h * 0.56, h * 0.45, blue, { pose: "run", phase: 2, lean: 0.25 });
      drawRunner(ctx, w * 0.62, h * 0.76, h * 0.5, red, { pose: "run", phase: 0.4, lean: 0.25 });
      drawRunner(ctx, w * 0.3, h * 0.96, h * 0.5, green, { pose: "run", phase: 4, lean: 0.25 });
      break;
    }
    case "tug": {
      paintGrass(ctx, 0, 0, w, h, 1, "#79c653", u);
      paintDirt(ctx, w / 2, h / 2, h * 0.32, 2, "#8d5f37", u);
      drawRope(ctx, w * 0.08, h / 2, w * 0.92, h / 2, u * 0.6);
      drawTopPerson(ctx, w * 0.2, h / 2 - u * 0.8, u * 0.7, red, { angle: 0, pose: "pull" });
      drawTopPerson(ctx, w * 0.3, h / 2 + u * 0.8, u * 0.7, red, { angle: 0, pose: "pull" });
      drawTopPerson(ctx, w * 0.8, h / 2 + u * 0.8, u * 0.7, blue, { angle: Math.PI, pose: "pull" });
      drawTopPerson(ctx, w * 0.7, h / 2 - u * 0.8, u * 0.7, blue, { angle: Math.PI, pose: "pull" });
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, u * 0.9, 0, TAU);
      fillStroke(ctx, "#d9b27a", "#4a2f12", 2);
      break;
    }
    case "sumo": {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#7a1a0c");
      g.addColorStop(1, "#2a0503");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) {
        const gr = ctx.createRadialGradient((i * 0.37 % 1) * w, (i * 0.61 % 1) * h, 0, (i * 0.37 % 1) * w, (i * 0.61 % 1) * h, u * 3);
        gr.addColorStop(0, "rgba(255,140,30,0.4)");
        gr.addColorStop(1, "rgba(255,140,30,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.fillStyle = "#5b3a24";
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 + u * 0.5, h * 0.4, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, h * 0.4, 0, TAU);
      fillStroke(ctx, "#e4c48c", "#a7843f", u * 0.4);
      drawTopPerson(ctx, w / 2 - u * 1.2, h / 2, u * 0.75, red, { angle: 0, pose: "push" });
      drawTopPerson(ctx, w / 2 + u * 1.1, h / 2 + u * 0.2, u * 0.75, blue, { angle: Math.PI, pose: "push" });
      break;
    }
    case "quickdraw": {
      paintDesert(ctx, w, h);
      drawRunner(ctx, w * 0.3, h * 0.85, h * 0.5, red, { pose: "draw" });
      drawRunner(ctx, w * 0.7, h * 0.85, h * 0.5, blue, { pose: "draw", flip: true });
      bigText(ctx, "TAP!", w / 2, h * 0.3, h * 0.26, "#ffe08a");
      break;
    }
    case "tanks": {
      paintSand(ctx, 0, 0, w, h, 3, "#ead09c", u);
      ctx.fillStyle = "#8a5a2c";
      ctx.fillRect(w * 0.45, h * 0.32 + u * 0.3, u * 1.5, u * 1.5);
      ctx.beginPath();
      ctx.rect(w * 0.45, h * 0.32, u * 1.5, u * 1.5);
      fillStroke(ctx, "#cf9455", "#5a3815", 1.5);
      drawCactus(ctx, w * 0.1, h * 0.95, u * 1.2);
      drawTank(ctx, w * 0.22, h * 0.55, u * 1.1, red, { angle: 0, tread: 0 });
      drawTank(ctx, w * 0.8, h * 0.62, u * 1.1, blue, { angle: Math.PI + 0.2, tread: 0 });
      ctx.fillStyle = "#fffbe6";
      ctx.beginPath();
      ctx.arc(w * 0.38, h * 0.55, u * 0.22, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,77,94,0.6)";
      ctx.lineWidth = u * 0.25;
      ctx.beginPath();
      ctx.moveTo(w * 0.32, h * 0.55);
      ctx.lineTo(w * 0.37, h * 0.55);
      ctx.stroke();
      break;
    }
    case "chicken": {
      paintGrass(ctx, 0, 0, w, h, 4, "#8fd35f", u);
      drawTree(ctx, w * 0.92, h * 0.15, u * 1.6, 1);
      drawBush(ctx, w * 0.05, h * 0.9, u, 2);
      drawChicken(ctx, w * 0.22, h * 0.35, u * 1.1, { dir: 1, flap: true });
      drawChicken(ctx, w * 0.75, h * 0.7, u * 1.1, { dir: -1 });
      drawChicken(ctx, w * 0.62, h * 0.3, u * 1.1, { dir: -1, peck: 1 });
      drawTopPerson(ctx, w * 0.42, h * 0.62, u * 0.75, red, { angle: -0.4, pose: "carry" });
      drawChicken(ctx, w * 0.42, h * 0.62 - u * 0.8, u * 0.75, { dir: 1, flap: true });
      break;
    }
    case "parkour": {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#2b1a5c");
      sky.addColorStop(0.6, "#c4507a");
      sky.addColorStop(1, "#ffb067");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#24183f";
      for (let i = 0; i < 8; i++) ctx.fillRect(i * w * 0.14, h * (0.35 + ((i * 37) % 20) / 100), w * 0.12, h);
      const building = (x: number, y: number, bw: number, col: string) => {
        ctx.fillStyle = col;
        ctx.fillRect(x, y, bw, h - y);
        for (let wy = y + u * 0.8; wy < h; wy += u * 1.1) {
          for (let wx = x + u * 0.5; wx < x + bw - u * 0.7; wx += u * 1.1) {
            ctx.fillStyle = (wx * 7 + wy) % 3 < 1.4 ? "#ffd98a" : "rgba(0,0,0,0.25)";
            ctx.fillRect(wx, wy, u * 0.5, u * 0.6);
          }
        }
        ctx.fillStyle = "#c9b8e0";
        ctx.fillRect(x - 2, y - 3, bw + 4, 5);
      };
      building(-u, h * 0.62, w * 0.42, "#6b4f7a");
      building(w * 0.58, h * 0.55, w * 0.5, "#4f6488");
      ctx.beginPath();
      ctx.rect(w * 0.8, h * 0.55 - u * 1.1, u * 1.1, u * 1.1);
      fillStroke(ctx, "#cf9455", "#5a3815", 1.5);
      drawRunner(ctx, w * 0.5, h * 0.45, h * 0.38, red, { pose: "jump" });
      drawRunner(ctx, w * 0.2, h * 0.62, h * 0.32, blue, { pose: "run", phase: 1.2, lean: 0.2, alpha: 0.75 });
      break;
    }
    case "ice": {
      ctx.fillStyle = "#eef5ff";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#bfe6fa";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.55, w * 0.6, h * 0.32, -0.1, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = u * 0.5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(w * (0.1 + i * 0.15), h * 0.5);
        ctx.lineTo(w * (0.2 + i * 0.15), h * 0.45);
        ctx.stroke();
      }
      drawPine(ctx, w * 0.08, h * 0.18, u * 1.1);
      drawPine(ctx, w * 0.92, h * 0.2, u * 1.3);
      drawSnowman(ctx, w * 0.85, h * 0.85, u * 0.7);
      drawIceBoat(ctx, w * 0.62, h * 0.5, u * 1.2, red, { angle: -0.2 });
      drawIceBoat(ctx, w * 0.32, h * 0.62, u * 1.2, blue, { angle: -0.1 });
      break;
    }
    case "boulder": {
      paintSand(ctx, 0, 0, w, h, 5, "#d9a066", u);
      ctx.fillStyle = "rgba(255,40,40,0.18)";
      ctx.fillRect(0, h * 0.4, w, h * 0.32);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = "rgba(217,160,102,0.6)";
        ctx.beginPath();
        ctx.arc(w * (0.7 + i * 0.07), h * 0.56 + Math.sin(i) * u * 0.4, u * (0.4 + i * 0.15), 0, TAU);
        ctx.fill();
      }
      drawBoulder(ctx, w * 0.55, h * 0.56, u * 1.5, 1);
      drawTopPerson(ctx, w * 0.25, h * 0.3, u * 0.7, blue, { angle: -1.2, pose: "walk", walk: 1 });
      drawTopPerson(ctx, w * 0.2, h * 0.82, u * 0.7, green, { angle: 1.4, pose: "push" });
      ctx.fillStyle = "#ff3030";
      ctx.beginPath();
      ctx.moveTo(u * 0.4, h * 0.46);
      ctx.lineTo(u * 1.3, h * 0.56);
      ctx.lineTo(u * 0.4, h * 0.66);
      ctx.fill();
      break;
    }
    case "dynamite": {
      paintSand(ctx, 0, 0, w, h, 6, "#c49a68", u);
      ctx.fillStyle = "rgba(255,40,40,0.25)";
      ctx.beginPath();
      ctx.arc(w * 0.4, h * 0.58, u * 1.6, 0, TAU);
      ctx.fill();
      drawTopPerson(ctx, w * 0.4, h * 0.58, u * 0.75, red, { angle: 0.3, pose: "carry" });
      drawDynamite(ctx, w * 0.4, h * 0.58 - u * 1.3, u * 1.1, 0.5, 0);
      drawTopPerson(ctx, w * 0.75, h * 0.45, u * 0.75, blue, { angle: -0.3, pose: "walk", walk: 2 });
      bigText(ctx, "!", w * 0.85, h * 0.22, u * 1.4, "#ffd34d");
      break;
    }
    case "missile": {
      paintGrass(ctx, 0, 0, w, h, 8, "#6aa84f", u);
      drawRuinBlock(ctx, w * 0.45, h * 0.12, u * 1.6, u * 2.2, u);
      drawAmmoCrate(ctx, w * 0.85, h * 0.25, u * 1.1, 0);
      drawHeart(ctx, w * 0.12, h * 0.25, u * 0.8);
      drawTopPerson(ctx, w * 0.22, h * 0.68, u * 0.7, red, { angle: 0 });
      drawLauncher(ctx, w * 0.22, h * 0.68, u * 0.7, 0);
      ctx.fillStyle = "rgba(220,215,205,0.7)";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(w * (0.35 + i * 0.05), h * 0.68, u * (0.2 + i * 0.08), 0, TAU);
        ctx.fill();
      }
      drawMissile(ctx, w * 0.6, h * 0.68, u * 1.1, 0, red, 0);
      drawTopPerson(ctx, w * 0.85, h * 0.7, u * 0.7, blue, { angle: Math.PI });
      break;
    }
  }
}

export function GameThumb({ id }: { id: GameId }) {
  const ref = useStaticCanvas((ctx, w, h) => thumb(ctx, w, h, id), [id]);
  return <canvas ref={ref} className="thumb" />;
}

/** Title-screen animation: four stickmen racing on a loop. */
export function Hero() {
  const fx = useRef(new Particles()).current;
  const ref = useCanvas((ctx, w, h, now, dt) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "rgba(255,255,255,0)");
    sky.addColorStop(1, "rgba(255,255,255,0.06)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const ground = h * 0.86;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, ground, w, h - ground);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.setLineDash([16, 14]);
    ctx.lineDashOffset = now / 6;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, ground + (h - ground) / 2);
    ctx.lineTo(w, ground + (h - ground) / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const mh = Math.min(h * 0.7, 110);
    TEAMS.forEach((t, i) => {
      const speed = 0.06 + i * 0.012;
      const p = ((now / 1000) * speed + i * 0.27) % 1.25;
      const x = -mh + p * (w + mh * 2) / 1.25;
      const y = ground - 2 + Math.sin(i) * 3;
      drawRunner(ctx, x, y, mh * (0.85 + (i % 2) * 0.1), t.color, { pose: "run", phase: now / 75 + i, lean: 0.25 });
      if (Math.random() < 0.3) fx.add({ kind: "dust", x: x - mh * 0.1, y, vx: -40, vy: -10, size: 3, grow: 18, life: 0.5, color: "#ffffff", drag: 3 });
    });
    fx.update(dt);
    fx.draw(ctx);
  });
  return <canvas ref={ref} className="hero" />;
}

/** Results podium: one cheering stickman per team on stepped blocks, confetti for the winner. */
export function Podium({ ranking }: { ranking: TeamRank[] }) {
  const fx = useRef(new Particles()).current;
  const tRef = useRef(0);
  const ref = useCanvas((ctx, w, h, now, dt) => {
    tRef.current += dt;
    const order = [...ranking].sort((a, b) => a.place - b.place);
    const n = order.length;
    // podium layout: 2nd, 1st, 3rd, 4th
    const slots = n === 1 ? [0] : n === 2 ? [1, 0] : n === 3 ? [1, 0, 2] : [1, 0, 2, 3];
    const colW = Math.min(110, w / Math.max(n, 3));
    const left = w / 2 - (colW * slots.length) / 2;
    const heights = [0.42, 0.3, 0.2, 0.12];
    const base = h - 4;
    slots.forEach((rankIdx, col) => {
      const r = order[rankIdx];
      if (!r) return;
      const t = TEAMS[r.team];
      const bh = h * heights[r.place - 1];
      const x = left + col * colW;
      ctx.beginPath();
      ctx.roundRect(x + 4, base - bh, colW - 8, bh, [10, 10, 0, 0]);
      fillStroke(ctx, t.color, "#1d1530", 3);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x + 10, base - bh + 6, colW - 20, 6);
      bigText(ctx, String(r.place), x + colW / 2, base - bh / 2, Math.min(40, bh * 0.55), "#ffffff");
      const mh = Math.min(h * 0.4, colW * 0.95);
      const rise = Math.min(1, tRef.current * 2 - col * 0.2);
      if (rise > 0) {
        drawRunner(ctx, x + colW / 2, base - bh, mh * rise, t.color, {
          pose: r.place === 1 ? "cheer" : "stand",
          phase: now / 110 + col,
        });
      }
    });
    if (order[0] && Math.random() < (tRef.current < 1.5 ? 0.9 : 0.25)) {
      const c = TEAMS[order[0].team].color;
      fx.add({ kind: "confetti", x: Math.random() * w, y: -10, vx: (Math.random() - 0.5) * 40, vy: 40 + Math.random() * 60, g: 30, size: 6, life: 4, color: [c, "#fff", "#ffd34d"][Math.floor(Math.random() * 3)], vr: (Math.random() - 0.5) * 8, drag: 0.5 });
    }
    fx.update(dt);
    fx.draw(ctx);
  });
  return <canvas ref={ref} className="podium" />;
}
