// Props for the newer games: ice boats, boulders, dynamite, missiles, pickups, snowy scenery.
import { type Ctx, darken, fillStroke, lighten, shadowEllipse, TAU } from "./paint";

/** Top-down ice sail-boat: pointed hull, ski outriggers, mast and sail, driver's head. */
export function drawIceBoat(ctx: Ctx, x: number, y: number, s: number, color: string, o: { angle: number; me?: boolean; now?: number }) {
  const out = darken(color, 0.6);
  const lw = Math.max(1.2, s * 0.07);
  const now = o.now ?? 0;
  ctx.save();
  if (o.me) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(2, s * 0.1);
    ctx.setLineDash([s * 0.3, s * 0.2]);
    ctx.lineDashOffset = -now / 40;
    ctx.beginPath();
    ctx.arc(x, y, s * 1.2, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.save();
  ctx.translate(x + s * 0.12, y + s * 0.18);
  ctx.rotate(o.angle);
  ctx.fillStyle = "rgba(40,70,110,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.95, s * 0.75, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.translate(x, y);
  ctx.rotate(o.angle);
  // cross beam + skis
  ctx.lineCap = "round";
  ctx.strokeStyle = "#5b3a1c";
  ctx.lineWidth = s * 0.14;
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, -s * 0.72);
  ctx.lineTo(-s * 0.15, s * 0.72);
  ctx.stroke();
  ctx.strokeStyle = "#cfd8e6";
  ctx.lineWidth = s * 0.1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, side * s * 0.72);
    ctx.lineTo(s * 0.25, side * s * 0.72);
    ctx.stroke();
  }
  // hull
  ctx.beginPath();
  ctx.moveTo(s * 0.95, 0);
  ctx.quadraticCurveTo(s * 0.3, -s * 0.32, -s * 0.75, -s * 0.24);
  ctx.lineTo(-s * 0.75, s * 0.24);
  ctx.quadraticCurveTo(s * 0.3, s * 0.32, s * 0.95, 0);
  ctx.closePath();
  fillStroke(ctx, color, out, lw);
  ctx.fillStyle = lighten(color, 0.25);
  ctx.beginPath();
  ctx.ellipse(s * 0.2, -s * 0.06, s * 0.45, s * 0.08, 0, 0, TAU);
  ctx.fill();
  // sail
  const billow = Math.sin(now / 300) * s * 0.05;
  ctx.beginPath();
  ctx.moveTo(s * 0.3, 0);
  ctx.quadraticCurveTo(-s * 0.1, s * 0.55 + billow, -s * 0.8, s * 0.32);
  ctx.lineTo(-s * 0.7, s * 0.02);
  ctx.closePath();
  fillStroke(ctx, "#fbfbff", "#5d6b80", lw * 0.8);
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(-s * 0.05, s * 0.2);
  ctx.lineTo(-s * 0.55, s * 0.22);
  ctx.stroke();
  // mast
  ctx.beginPath();
  ctx.arc(s * 0.3, 0, s * 0.09, 0, TAU);
  fillStroke(ctx, "#6b4426", "#2b1a0c", lw * 0.6);
  // driver
  ctx.beginPath();
  ctx.arc(-s * 0.4, -s * 0.02, s * 0.2, 0, TAU);
  fillStroke(ctx, lighten(color, 0.3), out, lw * 0.8);
  ctx.fillStyle = "#fff";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(-s * 0.28, side * s * 0.07 - s * 0.02, s * 0.05, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Rolling boulder seen from above. rot = how far it has rolled. */
export function drawBoulder(ctx: Ctx, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.fillStyle = "rgba(40,20,5,0.3)";
  ctx.beginPath();
  ctx.ellipse(x + r * 0.25, y + r * 0.35, r * 1.05, r * 0.85, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, "#c2b4a2");
  g.addColorStop(1, "#6f6457");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#3a322a";
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.stroke();
  ctx.clip();
  ctx.strokeStyle = "rgba(50,40,30,0.55)";
  ctx.lineWidth = Math.max(1, r * 0.07);
  for (let k = 0; k < 4; k++) {
    const a = rot + k * 1.7;
    const px = x + Math.cos(a) * r * 0.55;
    const py = y + Math.sin(a * 0.7 + k) * r * 0.4;
    ctx.beginPath();
    ctx.moveTo(px - r * 0.25, py - r * 0.1);
    ctx.lineTo(px, py + r * 0.05);
    ctx.lineTo(px + r * 0.2, py - r * 0.15);
    ctx.stroke();
    ctx.fillStyle = "rgba(60,50,40,0.35)";
    ctx.beginPath();
    ctx.arc(x + Math.cos(a + 0.8) * r * 0.6, y + Math.sin(a + 0.8) * r * 0.5, r * 0.12, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.35, r * 0.2, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Bundle of dynamite with a burning fuse. fuse = 0..1 remaining. */
export function drawDynamite(ctx: Ctx, x: number, y: number, s: number, fuse: number, now: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.25);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.roundRect(i * s * 0.28 - s * 0.14, -s * 0.5, s * 0.28, s, s * 0.08);
    fillStroke(ctx, i === 0 ? "#e8323c" : "#c8202a", "#4a0a0e", Math.max(1, s * 0.06));
  }
  ctx.fillStyle = "#3b2a1a";
  ctx.fillRect(-s * 0.46, -s * 0.12, s * 0.92, s * 0.18);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(-s * 0.38, -s * 0.45, s * 0.06, s * 0.3);
  const len = s * (0.2 + fuse * 0.8);
  ctx.strokeStyle = "#2a1f14";
  ctx.lineWidth = Math.max(1.2, s * 0.07);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.5);
  ctx.quadraticCurveTo(s * 0.3, -s * 0.5 - len * 0.6, s * 0.15, -s * 0.5 - len);
  ctx.stroke();
  const fx = s * 0.15;
  const fy = -s * 0.5 - len;
  const flick = 0.7 + Math.sin(now / 30) * 0.3;
  const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, s * 0.45 * flick);
  g.addColorStop(0, "rgba(255,255,220,1)");
  g.addColorStop(0.3, "rgba(255,200,60,0.9)");
  g.addColorStop(1, "rgba(255,90,20,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(fx, fy, s * 0.45 * flick, 0, TAU);
  ctx.fill();
  ctx.restore();
  return { x: x + Math.cos(-0.25) * fx - Math.sin(-0.25) * fy, y: y + Math.sin(-0.25) * fx + Math.cos(-0.25) * fy };
}

/** Missile flying along angle a. */
export function drawMissile(ctx: Ctx, x: number, y: number, s: number, a: number, color: string, now: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  const fl = 0.8 + Math.sin(now / 25) * 0.25;
  ctx.fillStyle = "rgba(255,170,40,0.9)";
  ctx.beginPath();
  ctx.moveTo(-s * 0.45, -s * 0.12);
  ctx.lineTo(-s * (0.45 + 0.55 * fl), 0);
  ctx.lineTo(-s * 0.45, s * 0.12);
  ctx.fill();
  ctx.fillStyle = "rgba(255,250,200,0.95)";
  ctx.beginPath();
  ctx.moveTo(-s * 0.45, -s * 0.06);
  ctx.lineTo(-s * (0.45 + 0.3 * fl), 0);
  ctx.lineTo(-s * 0.45, s * 0.06);
  ctx.fill();
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, side * s * 0.1);
    ctx.lineTo(-s * 0.48, side * s * 0.3);
    ctx.lineTo(-s * 0.45, side * s * 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(s * 0.5, 0);
  ctx.quadraticCurveTo(s * 0.35, -s * 0.13, s * 0.15, -s * 0.13);
  ctx.lineTo(-s * 0.45, -s * 0.11);
  ctx.lineTo(-s * 0.45, s * 0.11);
  ctx.lineTo(s * 0.15, s * 0.13);
  ctx.quadraticCurveTo(s * 0.35, s * 0.13, s * 0.5, 0);
  fillStroke(ctx, "#eef0f4", "#2a2d35", Math.max(1, s * 0.05));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, 0);
  ctx.quadraticCurveTo(s * 0.4, -s * 0.12, s * 0.25, -s * 0.13);
  ctx.lineTo(s * 0.25, s * 0.13);
  ctx.quadraticCurveTo(s * 0.4, s * 0.12, s * 0.5, 0);
  ctx.fill();
  ctx.restore();
}

export function drawHeart(ctx: Ctx, x: number, y: number, s: number, color = "#ff3b5c", outline = "#5a0a1a") {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.45);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.1, x - s * 0.45, y - s * 0.75, x, y - s * 0.28);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 0.75, x + s * 0.9, y - s * 0.1, x, y + s * 0.45);
  ctx.closePath();
  fillStroke(ctx, color, outline, Math.max(1, s * 0.1));
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(x - s * 0.25, y - s * 0.2, s * 0.13, s * 0.08, -0.6, 0, TAU);
  ctx.fill();
}

export function drawAmmoCrate(ctx: Ctx, x: number, y: number, s: number, now: number) {
  ctx.save();
  ctx.translate(x, y);
  const glow = 0.5 + Math.sin(now / 250) * 0.2;
  const g = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s);
  g.addColorStop(0, `rgba(255,220,90,${glow * 0.5})`);
  g.addColorStop(1, "rgba(255,220,90,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(-s * 0.4, -s * 0.25, s * 0.9, s * 0.75);
  ctx.beginPath();
  ctx.roundRect(-s * 0.45, -s * 0.4, s * 0.9, s * 0.75, s * 0.08);
  fillStroke(ctx, "#5f7a3a", "#22300f", Math.max(1, s * 0.06));
  ctx.fillStyle = "#4b6230";
  ctx.fillRect(-s * 0.45, -s * 0.1, s * 0.9, s * 0.12);
  ctx.fillStyle = "#ffd34d";
  ctx.beginPath();
  ctx.moveTo(s * 0.28, -s * 0.03);
  ctx.lineTo(s * 0.1, -s * 0.13);
  ctx.lineTo(-s * 0.22, -s * 0.13);
  ctx.lineTo(-s * 0.3, -s * 0.22);
  ctx.lineTo(-s * 0.3, s * 0.16);
  ctx.lineTo(-s * 0.22, s * 0.07);
  ctx.lineTo(s * 0.1, s * 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawSnowman(ctx: Ctx, x: number, y: number, s: number) {
  shadowEllipse(ctx, x + s * 0.2, y + s * 0.25, s * 0.9, s * 0.6, 0.2);
  ctx.beginPath();
  ctx.arc(x, y, s * 0.75, 0, TAU);
  fillStroke(ctx, "#ffffff", "#8aa3c2", Math.max(1, s * 0.08));
  ctx.beginPath();
  ctx.arc(x, y - s * 0.75, s * 0.5, 0, TAU);
  fillStroke(ctx, "#ffffff", "#8aa3c2", Math.max(1, s * 0.08));
  ctx.strokeStyle = "#e8323c";
  ctx.lineWidth = s * 0.16;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.75, s * 0.42, 0.3, Math.PI - 0.3);
  ctx.stroke();
  ctx.fillStyle = "#1d1530";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * s * 0.17, y - s * 0.88, s * 0.07, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#f08c1a";
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.78);
  ctx.lineTo(x + s * 0.4, y - s * 0.72);
  ctx.lineTo(x, y - s * 0.68);
  ctx.fill();
}

/** Top-down snowy pine tree. */
export function drawPine(ctx: Ctx, x: number, y: number, s: number) {
  shadowEllipse(ctx, x + s * 0.3, y + s * 0.35, s * 0.95, s * 0.75, 0.22);
  const layers: [number, string][] = [
    [1, "#1f5c3a"],
    [0.72, "#2a7448"],
    [0.45, "#348a56"],
  ];
  for (const [k, c] of layers) {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const d = s * k * (i % 2 ? 0.7 : 1);
      if (i) ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      else ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
    fillStroke(ctx, c, "#123822", Math.max(1, s * 0.05));
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * s * 0.5 - s * 0.1, y + Math.sin(a) * s * 0.45 - s * 0.1, s * 0.16, s * 0.09, a, 0, TAU);
    ctx.fill();
  }
}

/** Stone ruin block (top face + side), used as walls in Missile Mayhem. */
export function drawRuinBlock(ctx: Ctx, x: number, y: number, w: number, h: number, s: number) {
  const d = s * 0.28;
  ctx.fillStyle = "#4f5446";
  ctx.fillRect(x, y + h - d, w, d);
  ctx.beginPath();
  ctx.rect(x, y - d, w, h);
  fillStroke(ctx, "#9a9c88", "#3a3d31", Math.max(1.2, s * 0.06));
  // stone courses
  ctx.strokeStyle = "rgba(60,62,50,0.55)";
  ctx.lineWidth = Math.max(1, s * 0.05);
  const rows = Math.max(1, Math.round(h / s / 0.7));
  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(x, y - d + (h * r) / rows);
    ctx.lineTo(x + w, y - d + (h * r) / rows);
    ctx.stroke();
  }
  const cols = Math.max(1, Math.round(w / s / 0.9));
  for (let r = 0; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      const cx = x + ((c + (r % 2) * 0.5) * w) / cols;
      if (cx >= x + w) continue;
      ctx.beginPath();
      ctx.moveTo(cx, y - d + (h * r) / rows);
      ctx.lineTo(cx, y - d + (h * (r + 1)) / rows);
      ctx.stroke();
    }
  }
  // moss on top
  ctx.fillStyle = "rgba(90,150,60,0.55)";
  for (let i = 0; i < Math.max(2, (w / s) * 1.5); i++) {
    const mx = x + ((i * 0.37) % 1) * w;
    ctx.beginPath();
    ctx.ellipse(mx, y - d + s * 0.08, s * 0.25, s * 0.12, 0, 0, TAU);
    ctx.fill();
  }
}

/** Launcher tube carried on the right shoulder, pointing along the facing angle. */
export function drawLauncher(ctx: Ctx, x: number, y: number, r: number, a: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.roundRect(-r * 0.6, r * 0.55, r * 2.1, r * 0.5, r * 0.15);
  fillStroke(ctx, "#3f5a2a", "#16200d", Math.max(1, r * 0.12));
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(r * 1.5, r * 0.8, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}
