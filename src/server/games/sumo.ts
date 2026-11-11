import type { GameInput, PlayerInfo, SumoFighter, SumoState, TeamId } from "../../shared/types";
import { type Game, type TeamScore, teamsOf } from "./game";

const START_R = 9;
const MIN_R = 3;
const SHRINK_START = 15;
const TIME_LIMIT = 60;
const BODY_R = 0.7;
const ACCEL = 20;
const FRICTION = 3;
const DASH_IMPULSE = 13;
const DASH_COOLDOWN = 1.3;
const DASH_TIME = 0.3;
const BOUNCE = 1.25;

interface Fighter {
  id: string;
  team: TeamId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ix: number;
  iy: number;
  alive: boolean;
  fellAt: number | null;
  dashCd: number;
  dashT: number;
  fx: number; // facing direction (for dashing while standing still)
  fy: number;
}

export function createSumo(players: PlayerInfo[]): Game {
  const sorted = [...players].sort((a, b) => a.team - b.team);
  const spawnR = Math.min(5.5, 2 + sorted.length * 0.4);
  const fighters: Fighter[] = sorted.map((p, i) => {
    const a = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
    return {
      id: p.id,
      team: p.team,
      x: Math.cos(a) * spawnR,
      y: Math.sin(a) * spawnR,
      vx: 0,
      vy: 0,
      ix: 0,
      iy: 0,
      alive: true,
      fellAt: null,
      dashCd: 0.5,
      dashT: 0,
      fx: -Math.cos(a),
      fy: -Math.sin(a),
    };
  });
  const teamIds = teamsOf(fighters);
  let elapsed = 0;
  let endedAt: number | null = null;

  const arenaR = () => {
    if (elapsed < SHRINK_START) return START_R;
    const t = Math.min(1, (elapsed - SHRINK_START) / (TIME_LIMIT - SHRINK_START));
    return START_R + (MIN_R - START_R) * t;
  };

  const shouldEnd = () => {
    const alive = fighters.filter((f) => f.alive);
    if (elapsed >= TIME_LIMIT) return true;
    if (teamIds.length > 1) return new Set(alive.map((f) => f.team)).size <= 1;
    return alive.length <= (fighters.length > 1 ? 1 : 0);
  };

  return {
    update(dt) {
      elapsed += dt;
      const R = arenaR();
      for (const f of fighters) {
        if (!f.alive) {
          // keep sliding off-screen while falling
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          continue;
        }
        f.dashCd = Math.max(0, f.dashCd - dt);
        f.dashT = Math.max(0, f.dashT - dt);
        if (endedAt === null) {
          f.vx += f.ix * ACCEL * dt;
          f.vy += f.iy * ACCEL * dt;
        }
        const fr = Math.exp(-FRICTION * dt);
        f.vx *= fr;
        f.vy *= fr;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }

      // Collisions between living fighters
      for (let i = 0; i < fighters.length; i++) {
        const a = fighters[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < fighters.length; j++) {
          const b = fighters[j];
          if (!b.alive) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.0001;
          const minD = BODY_R * 2;
          if (d >= minD) continue;
          const nx = dx / d;
          const ny = dy / d;
          const ma = a.dashT > 0 ? 3 : 1;
          const mb = b.dashT > 0 ? 3 : 1;
          const overlap = minD - d;
          a.x -= nx * overlap * (mb / (ma + mb));
          a.y -= ny * overlap * (mb / (ma + mb));
          b.x += nx * overlap * (ma / (ma + mb));
          b.y += ny * overlap * (ma / (ma + mb));
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const j = (-(1 + BOUNCE) * rel) / (1 / ma + 1 / mb);
            a.vx -= (j / ma) * nx;
            a.vy -= (j / ma) * ny;
            b.vx += (j / mb) * nx;
            b.vy += (j / mb) * ny;
          }
        }
      }

      for (const f of fighters) {
        if (f.alive && Math.hypot(f.x, f.y) > R) {
          f.alive = false;
          f.fellAt = elapsed;
        }
      }
      if (endedAt === null && shouldEnd()) endedAt = elapsed;
    },
    input(id, msg: GameInput) {
      const f = fighters.find((x) => x.id === id);
      if (!f || !f.alive || endedAt !== null) return;
      if (msg.type === "move") {
        let x = Number(msg.x) || 0;
        let y = Number(msg.y) || 0;
        const m = Math.hypot(x, y);
        if (m > 1) {
          x /= m;
          y /= m;
        }
        f.ix = x;
        f.iy = y;
        if (m > 0.2) {
          f.fx = x / Math.max(m, 1e-6);
          f.fy = y / Math.max(m, 1e-6);
        }
      } else if (msg.type === "action" && f.dashCd <= 0) {
        f.vx += f.fx * DASH_IMPULSE;
        f.vy += f.fy * DASH_IMPULSE;
        f.dashCd = DASH_COOLDOWN;
        f.dashT = DASH_TIME;
      }
    },
    state(): SumoState {
      const r2 = (n: number) => Math.round(n * 100) / 100;
      return {
        kind: "sumo",
        timeLeft: Math.max(0, TIME_LIMIT - elapsed),
        arenaR: r2(arenaR()),
        fighters: fighters.map(
          (f): SumoFighter => ({
            id: f.id,
            team: f.team,
            x: r2(f.x),
            y: r2(f.y),
            vx: r2(f.vx),
            vy: r2(f.vy),
            alive: f.alive,
            fellAt: f.fellAt,
            dashing: f.dashT > 0,
            dashReady: r2(1 - f.dashCd / DASH_COOLDOWN),
          }),
        ),
      };
    },
    done() {
      return endedAt !== null && elapsed - endedAt > 2;
    },
    scores(): TeamScore[] {
      return teamIds.map((team) => {
        const fs = fighters.filter((f) => f.team === team);
        const alive = fs.filter((f) => f.alive).length;
        const lastOut = Math.max(...fs.map((f) => f.fellAt ?? elapsed));
        return {
          team,
          score: alive * 1000 + lastOut,
          detail: alive > 0 ? `${alive} still standing` : `out at ${Math.round(lastOut)}s`,
        };
      });
    },
  };
}
