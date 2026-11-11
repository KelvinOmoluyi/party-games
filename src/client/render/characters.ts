// Characters and game objects, drawn procedurally in a chunky cartoon style.
import { type Ctx, darken, fillStroke, lighten, shadowEllipse, TAU } from "./paint";

const OUTLINE = "#1d1530";

export type TopPose = "idle" | "walk" | "push" | "cheer" | "carry" | "pull" | "stun";

/**
 * Top-down "stick buddy": big round head, shoulders, two arms with hands, feet.
 * (x, y) is the centre, r is the head radius in px, angle is the facing direction.
 */
export function drawTopPerson(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  o: { angle?: number; pose?: TopPose; walk?: number; me?: boolean; alpha?: number; now?: number } = {},
) {
  const { angle = 0, pose = "idle", walk = 0, me = false, now = 0 } = o;
  const lw = Math.max(1.2, r * 0.16);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  shadowEllipse(ctx, x + r * 0.25, y + r * 0.45, r * 1.35, r * 1.05, 0.25);
  if (me) {
    const p = 1 + Math.sin(now / 200) * 0.06;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.setLineDash([r * 0.5, r * 0.3]);
    ctx.lineDashOffset = -now / 40;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.75 * p, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.translate(x, y);
  ctx.rotate(angle);

  const skin = color;
  const body = darken(color, 0.18);
  const out = darken(color, 0.62);

  // feet
  const swing = pose === "walk" ? Math.sin(walk) : 0;
  ctx.fillStyle = darken(color, 0.5);
  for (const side of [-1, 1]) {
    const fx = (pose === "walk" ? swing * side * r * 0.7 : r * 0.15) + (pose === "pull" ? -r * 0.4 : 0);
    ctx.beginPath();
    ctx.ellipse(fx, side * r * 0.5, r * 0.38, r * 0.26, 0, 0, TAU);
    ctx.fill();
  }

  // arms (behind head)
  const hands: [number, number][] =
    pose === "walk"
      ? [[-swing * r * 0.8 + r * 0.1, -r * 1.25], [swing * r * 0.8 + r * 0.1, r * 1.25]]
      : pose === "push"
        ? [[r * 1.55, -r * 0.65], [r * 1.55, r * 0.65]]
        : pose === "cheer" || pose === "stun"
          ? [[-r * 0.1 + Math.sin(now / 90) * r * 0.2, -r * 1.85], [-r * 0.1 - Math.sin(now / 90) * r * 0.2, r * 1.85]]
          : pose === "carry"
            ? [[r * 0.75, -r * 0.75], [r * 0.75, r * 0.75]]
            : pose === "pull"
              ? [[r * 1.35, -r * 0.2], [r * 0.85, r * 0.25]]
              : [[r * 0.45, -r * 1.3], [r * 0.45, r * 1.3]];
  const shoulders: [number, number][] = [[-r * 0.1, -r * 0.85], [-r * 0.1, r * 0.85]];
  ctx.lineCap = "round";
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = out;
    ctx.lineWidth = r * 0.52;
    ctx.beginPath();
    ctx.moveTo(...shoulders[i]);
    ctx.lineTo(...hands[i]);
    ctx.stroke();
    ctx.strokeStyle = body;
    ctx.lineWidth = r * 0.3;
    ctx.stroke();
  }

  // shoulders / torso
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, 0, r * 0.7, r * 1.1, 0, 0, TAU);
  fillStroke(ctx, body, out, lw);

  // hands
  for (const [hx, hy] of hands) {
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.3, 0, TAU);
    fillStroke(ctx, lighten(skin, 0.15), out, lw * 0.8);
  }

  // head
  ctx.beginPath();
  ctx.arc(r * 0.05, 0, r, 0, TAU);
  fillStroke(ctx, skin, out, lw);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, -r * 0.35, r * 0.45, r * 0.3, -0.6, 0, TAU);
  ctx.fill();

  // eyes look forward
  if (pose === "stun") {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1, r * 0.12);
    for (const side of [-1, 1]) {
      const ex = r * 0.55;
      const ey = side * r * 0.36;
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.15, ey - r * 0.15);
      ctx.lineTo(ex + r * 0.15, ey + r * 0.15);
      ctx.moveTo(ex + r * 0.15, ey - r * 0.15);
      ctx.lineTo(ex - r * 0.15, ey + r * 0.15);
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(r * 0.55, side * r * 0.36, r * 0.24, r * 0.27, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = OUTLINE;
      ctx.beginPath();
      ctx.arc(r * 0.66, side * r * 0.34, r * 0.13, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

export type SidePose = "run" | "stand" | "cheer" | "draw" | "fall" | "jump";

/** Side-view chunky stickman with feet at (x, y), h px tall, facing right. */
export function drawRunner(
  ctx: Ctx,
  x: number,
  y: number,
  h: number,
  color: string,
  o: { pose?: SidePose; phase?: number; lean?: number; me?: boolean; alpha?: number; flip?: boolean } = {},
) {
  const { pose = "stand", phase = 0, lean = 0, me = false } = o;
  const limb = Math.max(2.5, h * 0.105);
  const outW = limb + Math.max(2, h * 0.055);
  const out = darken(color, 0.62);
  const back = darken(color, 0.22);
  const L = h * 0.21;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  shadowEllipse(ctx, x, y + 1, h * 0.28, h * 0.06, 0.25);
  ctx.translate(x, y);
  if (o.flip) ctx.scale(-1, 1);
  ctx.rotate(lean);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const bob = pose === "run" ? Math.abs(Math.sin(phase)) * h * 0.05 : pose === "cheer" ? Math.abs(Math.sin(phase)) * h * 0.12 : 0;
  ctx.translate(0, -bob);

  const hip = { x: 0, y: -h * 0.42 };
  const neck = { x: h * 0.03, y: -h * 0.74 };
  const sh = { x: h * 0.02, y: -h * 0.69 };

  const seg = (pts: { x: number; y: number }[], c: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = out;
    ctx.lineWidth = outW;
    ctx.stroke();
    ctx.strokeStyle = c;
    ctx.lineWidth = limb;
    ctx.stroke();
  };
  const joint = (from: { x: number; y: number }, a1: number, a2: number, l1: number, l2: number) => {
    const j = { x: from.x + Math.sin(a1) * l1, y: from.y + Math.cos(a1) * l1 };
    const e = { x: j.x + Math.sin(a2) * l2, y: j.y + Math.cos(a2) * l2 };
    return [from, j, e];
  };

  let legs: [number, number][];
  let arms: [number, number][];
  if (pose === "run") {
    const s = Math.sin(phase);
    legs = [
      [s * 0.85, s * 0.85 - (s < 0 ? 1.3 : 0.2)],
      [-s * 0.85, -s * 0.85 - (-s < 0 ? 1.3 : 0.2)],
    ];
    arms = [
      [-s * 1.0, -s * 1.0 + 1.5],
      [s * 1.0, s * 1.0 + 1.5],
    ];
  } else if (pose === "cheer") {
    legs = [[0.25, 0.25], [-0.25, -0.25]];
    const w = Math.sin(phase * 2) * 0.15;
    arms = [[2.6 + w, 2.9], [-2.5 - w, -2.9]];
  } else if (pose === "draw") {
    legs = [[0.35, 0.35], [-0.3, -0.3]];
    arms = [[1.57, 1.57], [0.4, 0.9]];
  } else if (pose === "fall") {
    legs = [[0.9, 0.9], [0.5, 0.2]];
    arms = [[2.4, 2.8], [-2.2, -2.6]];
  } else if (pose === "jump") {
    // knees tucked, arms flung up and back
    legs = [[1.25, -0.25], [0.35, -1.15]];
    arms = [[2.5, 2.2], [-1.4, -0.4]];
  } else {
    legs = [[0.2, 0.2], [-0.2, -0.2]];
    arms = [[0.35, 0.15], [-0.35, -0.15]];
  }

  // far limbs (darker), body, near limbs
  seg(joint(hip, legs[1][0], legs[1][1], L, L), back);
  seg(joint(sh, arms[1][0], arms[1][1], h * 0.17, h * 0.16), back);
  seg([hip, neck], color);
  seg(joint(hip, legs[0][0], legs[0][1], L, L), color);
  seg(joint(sh, arms[0][0], arms[0][1], h * 0.17, h * 0.16), color);

  // head
  const hr = h * 0.155;
  const hx = h * 0.05;
  const hy = -h * 0.74 - hr * 0.92;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, TAU);
  fillStroke(ctx, color, out, Math.max(1.5, h * 0.045));
  if (me) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(1.5, h * 0.035);
    ctx.beginPath();
    ctx.arc(hx, hy, hr + Math.max(2, h * 0.04), 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(hx - hr * 0.3, hy - hr * 0.35, hr * 0.42, hr * 0.28, -0.5, 0, TAU);
  ctx.fill();
  // eye
  if (pose === "fall") {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1, hr * 0.2);
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.25, hy - hr * 0.3);
    ctx.lineTo(hx + hr * 0.65, hy + hr * 0.1);
    ctx.moveTo(hx + hr * 0.65, hy - hr * 0.3);
    ctx.lineTo(hx + hr * 0.25, hy + hr * 0.1);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(hx + hr * 0.45, hy - hr * 0.12, hr * 0.3, hr * 0.36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(hx + hr * 0.56, hy - hr * 0.1, hr * 0.16, 0, TAU);
    ctx.fill();
    if (pose === "cheer") {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = Math.max(1, hr * 0.14);
      ctx.beginPath();
      ctx.arc(hx + hr * 0.35, hy + hr * 0.3, hr * 0.3, 0.2, Math.PI - 0.6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Top-down tank. s = pixels per world unit. */
export function drawTank(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  color: string,
  o: { angle: number; tread: number; recoil?: number; me?: boolean; alpha?: number; now?: number },
) {
  const { angle, tread, recoil = 0, me = false, now = 0 } = o;
  const out = darken(color, 0.6);
  const lw = Math.max(1.2, s * 0.07);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  if (me) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(2, s * 0.1);
    ctx.setLineDash([s * 0.3, s * 0.2]);
    ctx.lineDashOffset = -now / 40;
    ctx.beginPath();
    ctx.arc(x, y, s * 1.25, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // shadow
  ctx.save();
  ctx.translate(x + s * 0.14, y + s * 0.2);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.roundRect(-s * 0.9, -s * 0.72, s * 1.8, s * 1.44, s * 0.25);
  ctx.fill();
  ctx.restore();

  ctx.translate(x, y);
  ctx.rotate(angle);
  // treads
  for (const side of [-1, 1]) {
    const ty = side > 0 ? s * 0.36 : -s * 0.74;
    ctx.beginPath();
    ctx.roundRect(-s * 0.88, ty, s * 1.76, s * 0.38, s * 0.12);
    fillStroke(ctx, "#2f2f36", "#121216", lw);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "#55555f";
    ctx.lineWidth = Math.max(1, s * 0.07);
    const step = s * 0.22;
    const off = (((tread * s) % step) + step) % step;
    for (let tx = -s * 0.9 - step + off; tx < s * 0.9; tx += step) {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx, ty + s * 0.38);
      ctx.stroke();
    }
    ctx.restore();
  }
  // hull
  ctx.beginPath();
  ctx.roundRect(-s * 0.78, -s * 0.46, s * 1.56, s * 0.92, s * 0.16);
  fillStroke(ctx, color, out, lw);
  ctx.fillStyle = lighten(color, 0.18);
  ctx.beginPath();
  ctx.roundRect(-s * 0.66, -s * 0.36, s * 1.32, s * 0.36, s * 0.1);
  ctx.fill();
  ctx.fillStyle = darken(color, 0.25);
  ctx.fillRect(-s * 0.78, -s * 0.12, s * 0.12, s * 0.24); // exhaust
  // front light strip
  ctx.fillStyle = "#ffe58a";
  ctx.fillRect(s * 0.62, -s * 0.3, s * 0.08, s * 0.14);
  ctx.fillRect(s * 0.62, s * 0.16, s * 0.08, s * 0.14);
  // barrel
  const bl = s * (0.95 - recoil * 0.3);
  ctx.beginPath();
  ctx.roundRect(s * 0.05, -s * 0.1, bl, s * 0.2, s * 0.05);
  fillStroke(ctx, "#4b4f58", "#15161a", lw);
  ctx.beginPath();
  ctx.roundRect(s * 0.05 + bl - s * 0.16, -s * 0.13, s * 0.18, s * 0.26, s * 0.05);
  fillStroke(ctx, "#3a3d44", "#15161a", lw);
  // turret
  ctx.beginPath();
  ctx.arc(-s * 0.05, 0, s * 0.4, 0, TAU);
  fillStroke(ctx, darken(color, 0.08), out, lw);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(-s * 0.15, -s * 0.12, s * 0.2, s * 0.12, -0.5, 0, TAU);
  ctx.fill();
  // stickman driver popping out of the hatch
  ctx.beginPath();
  ctx.arc(-s * 0.12, 0, s * 0.19, 0, TAU);
  fillStroke(ctx, lighten(color, 0.3), out, Math.max(1, lw * 0.8));
  ctx.fillStyle = "#fff";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(-s * 0.02, side * s * 0.07, s * 0.05, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Waving flag on a pole planted at (x, y). */
export function drawFlag(ctx: Ctx, x: number, y: number, h: number, color: string, now: number) {
  shadowEllipse(ctx, x + h * 0.12, y, h * 0.18, h * 0.07, 0.3);
  ctx.strokeStyle = "#3b2a1a";
  ctx.lineWidth = Math.max(2, h * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  ctx.strokeStyle = "#d9c7a6";
  ctx.lineWidth = Math.max(1, h * 0.035);
  ctx.stroke();
  const fw = h * 0.62;
  const fh = h * 0.4;
  const wv = (t: number) => Math.sin(now / 140 + t * 4) * fh * 0.12 * t;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  for (let i = 1; i <= 6; i++) ctx.lineTo(x + (fw * i) / 6, y - h + wv(i / 6));
  for (let i = 6; i >= 0; i--) ctx.lineTo(x + (fw * i) / 6, y - h + fh + wv(i / 6));
  ctx.closePath();
  fillStroke(ctx, color, darken(color, 0.55), Math.max(1, h * 0.04));
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  for (let i = 1; i <= 6; i++) ctx.lineTo(x + (fw * i) / 6, y - h + wv(i / 6));
  for (let i = 6; i >= 0; i--) ctx.lineTo(x + (fw * i) / 6, y - h + fh * 0.35 + wv(i / 6));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd34d";
  ctx.beginPath();
  ctx.arc(x, y - h, Math.max(1.5, h * 0.06), 0, TAU);
  ctx.fill();
}

/** Cute chicken seen from slightly above. dir = 1 faces right, -1 faces left. */
export function drawChicken(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  o: { dir?: number; walk?: number; flap?: boolean; peck?: number; alpha?: number } = {},
) {
  const { dir = 1, walk = 0, flap = false, peck = 0 } = o;
  const out = "#5a4632";
  const lw = Math.max(1, s * 0.09);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  shadowEllipse(ctx, x, y + s * 0.42, s * 0.55, s * 0.18, 0.22);
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  // legs
  ctx.strokeStyle = "#f08c1a";
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.lineCap = "round";
  const lg = Math.sin(walk) * s * 0.14;
  for (const [lx, sw] of [[-s * 0.1, lg], [s * 0.12, -lg]]) {
    ctx.beginPath();
    ctx.moveTo(lx, s * 0.2);
    ctx.lineTo(lx + sw, s * 0.42);
    ctx.stroke();
  }
  // tail
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, -s * 0.05);
  ctx.lineTo(-s * 0.68, -s * 0.35);
  ctx.lineTo(-s * 0.58, -s * 0.02);
  ctx.lineTo(-s * 0.72, -s * 0.12);
  ctx.lineTo(-s * 0.45, s * 0.12);
  ctx.closePath();
  fillStroke(ctx, "#f2ece0", out, lw);
  // body
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.5, s * 0.36, 0, 0, TAU);
  fillStroke(ctx, "#fffdf6", out, lw);
  // wing
  ctx.save();
  ctx.translate(-s * 0.05, -s * 0.02);
  ctx.rotate(flap ? -0.9 + Math.sin(walk * 3) * 0.4 : 0.15);
  ctx.beginPath();
  ctx.ellipse(-s * 0.08, 0, s * 0.27, s * 0.17, 0, 0, TAU);
  fillStroke(ctx, "#efe6d4", out, lw * 0.8);
  ctx.restore();
  // head (bobs down when pecking)
  const hx = s * 0.38;
  const hy = -s * 0.32 + peck * s * 0.35;
  ctx.fillStyle = "#e8323c";
  ctx.beginPath();
  ctx.arc(hx - s * 0.04, hy - s * 0.2, s * 0.09, 0, TAU);
  ctx.arc(hx + s * 0.08, hy - s * 0.22, s * 0.08, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.22, 0, TAU);
  fillStroke(ctx, "#fffdf6", out, lw);
  ctx.fillStyle = "#f5a020";
  ctx.beginPath();
  ctx.moveTo(hx + s * 0.18, hy - s * 0.04);
  ctx.lineTo(hx + s * 0.38, hy + s * 0.03);
  ctx.lineTo(hx + s * 0.18, hy + s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e8323c";
  ctx.beginPath();
  ctx.ellipse(hx + s * 0.14, hy + s * 0.16, s * 0.05, s * 0.08, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#1d1530";
  ctx.beginPath();
  ctx.arc(hx + s * 0.07, hy - s * 0.04, Math.max(0.8, s * 0.05), 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Braided rope between two points. */
export function drawRope(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number) {
  ctx.lineCap = "round";
  ctx.strokeStyle = "#5c3d1e";
  ctx.lineWidth = w + 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = "#d9b27a";
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = "#a87b45";
  ctx.setLineDash([w * 0.55, w * 0.55]);
  ctx.lineWidth = w * 0.6;
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Small star used for "stunned" effects. */
export function drawStar(ctx: Ctx, x: number, y: number, r: number, color = "#ffd84a") {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const d = i % 2 ? r * 0.45 : r;
    i ? ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) : ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  fillStroke(ctx, color, "#8a5a00", Math.max(1, r * 0.2));
}
