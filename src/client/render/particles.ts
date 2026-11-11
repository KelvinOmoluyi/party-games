// Lightweight particle system (screen-space pixels).
import { type Ctx, FONTS, TAU } from "./paint";

type Kind = "dust" | "smoke" | "fire" | "spark" | "confetti" | "feather" | "debris" | "ring" | "text" | "splash";

interface P {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  rot: number;
  vr: number;
  g: number;
  drag: number;
  text?: string;
}

const CONFETTI = ["#ff4d5e", "#3d8bff", "#2ecc71", "#ffc531", "#ff8af0", "#ffffff", "#7b5cff"];

export class Particles {
  list: P[] = [];
  private max = 600;

  add(p: Partial<P> & { kind: Kind; x: number; y: number }) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      vx: 0, vy: 0, life: 1, max: 1, size: 4, grow: 0, color: "#fff", rot: Math.random() * TAU, vr: 0, g: 0, drag: 0,
      ...p,
    } as P);
    const last = this.list[this.list.length - 1];
    last.max = last.life;
  }

  burst(kind: Kind, x: number, y: number, n: number, o: { speed?: number; size?: number; color?: string | string[]; life?: number; spread?: number; angle?: number; g?: number } = {}) {
    const { speed = 60, size = 4, life = 0.8, spread = TAU, angle = 0, g = 0 } = o;
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * (0.4 + Math.random() * 0.8);
      const color = Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : (o.color ?? "#fff");
      this.add({
        kind,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: size * (0.6 + Math.random() * 0.8),
        life: life * (0.6 + Math.random() * 0.7),
        color,
        vr: (Math.random() - 0.5) * 10,
        g,
        drag: kind === "smoke" || kind === "dust" ? 2.5 : kind === "confetti" ? 1.2 : kind === "feather" ? 3 : 1,
        grow: kind === "smoke" ? size * 2 : kind === "dust" ? size * 1.2 : 0,
      });
    }
  }

  explosion(x: number, y: number, s: number) {
    this.add({ kind: "ring", x, y, size: s * 0.3, grow: s * 5, life: 0.35, color: "#fff2b0" });
    this.burst("fire", x, y, 18, { speed: s * 5, size: s * 0.45, life: 0.5, color: ["#ffef7a", "#ffb02e", "#ff6a1f"] });
    this.burst("smoke", x, y, 12, { speed: s * 2.2, size: s * 0.4, life: 1.2, color: ["#3b3540", "#59525e", "#7a7280"] });
    this.burst("debris", x, y, 10, { speed: s * 6, size: s * 0.14, life: 0.7, color: ["#2a2a2a", "#555"] });
  }

  confetti(x: number, y: number, n = 40, colors: string[] = CONFETTI, power = 220) {
    this.burst("confetti", x, y, n, { speed: power, size: 6, life: 2.2, color: colors, angle: -Math.PI / 2, spread: 2.2, g: 380 });
  }

  floatText(x: number, y: number, text: string, color: string, size = 18) {
    this.add({ kind: "text", x, y, vy: -45, life: 1.1, size, color, text, drag: 1 });
  }

  update(dt: number) {
    for (const p of this.list) {
      p.life -= dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size += p.grow * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx: Ctx) {
    for (const p of this.list) {
      const t = Math.max(0, p.life / p.max);
      ctx.save();
      switch (p.kind) {
        case "dust":
        case "smoke":
          ctx.globalAlpha = t * (p.kind === "dust" ? 0.45 : 0.6);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, TAU);
          ctx.fill();
          break;
        case "fire":
        case "spark":
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = t;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size * (0.4 + t * 0.6)), 0, TAU);
          ctx.fill();
          break;
        case "splash":
          ctx.globalAlpha = t;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size * t), 0, TAU);
          ctx.fill();
          break;
        case "confetti":
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.rot * 2.3));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          break;
        case "feather":
          ctx.globalAlpha = t;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.strokeStyle = "rgba(90,70,50,0.6)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, TAU);
          ctx.fill();
          ctx.stroke();
          break;
        case "debris":
          ctx.globalAlpha = t;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          break;
        case "ring":
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, 6 * t);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.stroke();
          break;
        case "text":
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.font = `${p.size}px ${FONTS.display}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = p.size * 0.22;
          ctx.lineJoin = "round";
          ctx.strokeStyle = "#1a1030";
          ctx.strokeText(p.text ?? "", p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text ?? "", p.x, p.y);
          break;
      }
      ctx.restore();
    }
  }
}

/** Camera shake that decays over time. */
export class Shake {
  amount = 0;
  kick(a: number) {
    this.amount = Math.max(this.amount, a);
  }
  apply(ctx: Ctx, dt: number) {
    if (this.amount < 0.3) {
      this.amount = 0;
      return;
    }
    ctx.translate((Math.random() - 0.5) * this.amount * 2, (Math.random() - 0.5) * this.amount * 2);
    this.amount *= Math.exp(-9 * dt);
  }
}
