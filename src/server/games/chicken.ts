import { type ChickenState, cornerFor, type GameInput, type PlayerInfo, type TeamId } from "../../shared/types";
import { clampToArena, normInput, r2, separate } from "./arena";
import { type Game, type TeamScore, teamsOf } from "./game";

// Field size, flock size and round length grow with the number of players.
export function chickenMapFor(players: number) {
  return players > 4
    ? { W: 40, H: 20, chickens: Math.min(52, 18 + players * 2.5), time: 70 }
    : { W: 32, H: 18, chickens: Math.min(36, 10 + players * 2), time: 60 };
}
const PEN_R = 2.8;
const BODY_R = 0.55;
const MAX_CARRY = 4;
const BASE_SPEED = 6.5;
const CARRY_SLOW = 0.6;
const CHICK_SPEED = 3.7;
const SCARE_DIST = 3.2;
const CATCH_DIST = 0.95;
const DASH_SPEED = 14;
const DASH_TIME = 0.22;
const DASH_COOLDOWN = 1.4;
const STUN = 1.1;

interface Runner {
  id: string;
  team: TeamId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ix: number;
  iy: number;
  fx: number;
  fy: number;
  carrying: number;
  dashT: number;
  dashCd: number;
  stun: number;
}

interface Chicken {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  penned: boolean;
  wanderA: number;
  wanderT: number;
  scared: boolean;
}

export function createChicken(players: PlayerInfo[]): Game {
  const { W, H, chickens: target, time: TIME_LIMIT } = chickenMapFor(players.length);
  const teamIds = teamsOf(players);
  const pens = teamIds.map((team, i) => ({ team, ...cornerFor(i, teamIds.length, W, H, 3), r: PEN_R }));
  const penOf = (t: TeamId) => pens.find((p) => p.team === t)!;
  const penned: Record<number, number> = Object.fromEntries(teamIds.map((t) => [t, 0]));
  let nextId = 1;
  let elapsed = 0;
  let spawnT = 0;
  let endedAt: number | null = null;

  const runners: Runner[] = players.map((p, i) => {
    const pen = penOf(p.team);
    const k = players.filter((q, j) => j < i && q.team === p.team).length;
    const toC = Math.atan2(H / 2 - pen.y, W / 2 - pen.x);
    const x = pen.x + Math.cos(toC) * (PEN_R + 0.8) + Math.cos(toC + Math.PI / 2) * (k - 1.5) * 1.2;
    const y = pen.y + Math.sin(toC) * (PEN_R + 0.8) + Math.sin(toC + Math.PI / 2) * (k - 1.5) * 1.2;
    return { id: p.id, team: p.team, x, y, vx: 0, vy: 0, ix: 0, iy: 0, fx: Math.cos(toC), fy: Math.sin(toC), carrying: 0, dashT: 0, dashCd: 0, stun: 0 };
  });

  const chickens: Chicken[] = [];
  const inAnyPen = (x: number, y: number, pad = 0) => pens.some((p) => Math.hypot(x - p.x, y - p.y) < p.r + pad);
  const spawnChicken = (x?: number, y?: number, vx = 0, vy = 0) => {
    let cx = x ?? 0;
    let cy = y ?? 0;
    if (x === undefined) {
      for (let tries = 0; tries < 20; tries++) {
        cx = 6 + Math.random() * (W - 12);
        cy = 3.5 + Math.random() * (H - 7);
        if (!inAnyPen(cx, cy, 1.5)) break;
      }
    }
    chickens.push({ id: nextId++, x: cx, y: cy, vx, vy, penned: false, wanderA: Math.random() * 6.28, wanderT: 0, scared: false });
  };
  for (let i = 0; i < target; i++) spawnChicken();

  const putInPen = (team: TeamId, count: number) => {
    const pen = penOf(team);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * (pen.r - 0.5);
      chickens.push({ id: nextId++, x: pen.x + Math.cos(a) * d, y: pen.y + Math.sin(a) * d, vx: 0, vy: 0, penned: true, wanderA: a, wanderT: 0, scared: false });
    }
    penned[team] += count;
  };

  return {
    update(dt) {
      elapsed += dt;
      const playing = endedAt === null;

      for (const r of runners) {
        r.stun = Math.max(0, r.stun - dt);
        r.dashT = Math.max(0, r.dashT - dt);
        r.dashCd = Math.max(0, r.dashCd - dt);
        const sp = BASE_SPEED - r.carrying * CARRY_SLOW;
        const tx = playing && r.stun <= 0 ? r.ix * sp : 0;
        const ty = playing && r.stun <= 0 ? r.iy * sp : 0;
        const k = 1 - Math.exp(-(r.dashT > 0 ? 1 : 12) * dt);
        r.vx += (tx - r.vx) * k;
        r.vy += (ty - r.vy) * k;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        clampToArena(r, BODY_R, W, H);
      }
      for (let i = 0; i < runners.length; i++)
        for (let j = i + 1; j < runners.length; j++) separate(runners[i], runners[j], BODY_R * 2);

      // tackles: dashing into an enemy knocks their chickens loose
      for (const a of runners) {
        if (a.dashT <= 0) continue;
        for (const b of runners) {
          if (b.team === a.team || b.stun > 0 || Math.hypot(a.x - b.x, a.y - b.y) > BODY_R * 2.3) continue;
          for (let i = 0; i < b.carrying; i++) {
            const ang = Math.random() * Math.PI * 2;
            spawnChicken(b.x + Math.cos(ang) * 0.8, b.y + Math.sin(ang) * 0.8, Math.cos(ang) * 6, Math.sin(ang) * 6);
          }
          b.carrying = 0;
          b.stun = STUN;
          b.vx = a.vx * 0.6;
          b.vy = a.vy * 0.6;
        }
      }

      // chickens
      for (let i = chickens.length - 1; i >= 0; i--) {
        const c = chickens[i];
        if (c.penned) {
          c.wanderT -= dt;
          if (c.wanderT <= 0) {
            c.wanderT = 1 + Math.random() * 2;
            c.wanderA = Math.random() * Math.PI * 2;
          }
          continue;
        }
        let nearest: Runner | null = null;
        let nd = Infinity;
        for (const r of runners) {
          const d = Math.hypot(r.x - c.x, r.y - c.y);
          if (d < nd) {
            nd = d;
            nearest = r;
          }
        }
        let tx: number;
        let ty: number;
        if (nearest && nd < SCARE_DIST) {
          c.scared = true;
          const ax = (c.x - nearest.x) / (nd || 1);
          const ay = (c.y - nearest.y) / (nd || 1);
          // steer away from walls so they don't get stuck in corners forever
          const wx = c.x < 2 ? 1 : c.x > W - 2 ? -1 : 0;
          const wy = c.y < 2 ? 1 : c.y > H - 2 ? -1 : 0;
          tx = (ax + wx * 0.9) * CHICK_SPEED;
          ty = (ay + wy * 0.9) * CHICK_SPEED;
        } else {
          c.scared = false;
          c.wanderT -= dt;
          if (c.wanderT <= 0) {
            c.wanderT = 0.8 + Math.random() * 2;
            c.wanderA = Math.random() < 0.3 ? -1 : Math.random() * Math.PI * 2;
          }
          tx = c.wanderA < 0 ? 0 : Math.cos(c.wanderA) * 1.2;
          ty = c.wanderA < 0 ? 0 : Math.sin(c.wanderA) * 1.2;
        }
        const k = 1 - Math.exp(-6 * dt);
        c.vx += (tx - c.vx) * k;
        c.vy += (ty - c.vy) * k;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        clampToArena(c, 0.4, W, H);
        // free chickens can't wander into pens
        for (const p of pens) {
          const d = Math.hypot(c.x - p.x, c.y - p.y);
          if (d < p.r + 0.3) {
            c.x = p.x + ((c.x - p.x) / (d || 1)) * (p.r + 0.3);
            c.y = p.y + ((c.y - p.y) / (d || 1)) * (p.r + 0.3);
          }
        }
        if (!playing) continue;
        for (const r of runners) {
          if (r.stun > 0 || r.carrying >= MAX_CARRY) continue;
          if (Math.hypot(r.x - c.x, r.y - c.y) < CATCH_DIST) {
            r.carrying++;
            chickens.splice(i, 1);
            break;
          }
        }
      }

      // drop off at own pen
      if (playing) {
        for (const r of runners) {
          if (r.carrying === 0) continue;
          const p = penOf(r.team);
          if (Math.hypot(r.x - p.x, r.y - p.y) < p.r + 0.3) {
            putInPen(r.team, r.carrying);
            r.carrying = 0;
          }
        }
        // keep the field stocked
        spawnT -= dt;
        const free = chickens.filter((c) => !c.penned).length;
        if (spawnT <= 0 && free < target * 0.6) {
          spawnChicken();
          spawnT = 0.4;
        }
      }

      if (playing && elapsed >= TIME_LIMIT) endedAt = elapsed;
    },
    input(id, msg: GameInput) {
      const r = runners.find((x) => x.id === id);
      if (!r) return;
      if (msg.type === "move") {
        const v = normInput(msg.x, msg.y);
        r.ix = v.x;
        r.iy = v.y;
        if (v.mag > 0.2) {
          r.fx = v.x / v.mag;
          r.fy = v.y / v.mag;
        }
      } else if (msg.type === "action" && r.dashCd <= 0 && r.stun <= 0 && endedAt === null) {
        r.vx = r.fx * DASH_SPEED;
        r.vy = r.fy * DASH_SPEED;
        r.dashT = DASH_TIME;
        r.dashCd = DASH_COOLDOWN;
      }
    },
    state(): ChickenState {
      return {
        kind: "chicken",
        timeLeft: Math.max(0, TIME_LIMIT - elapsed),
        w: W,
        h: H,
        pens,
        runners: runners.map((r) => ({
          id: r.id,
          team: r.team,
          x: r2(r.x),
          y: r2(r.y),
          vx: r2(r.vx),
          vy: r2(r.vy),
          carrying: r.carrying,
          stunned: r.stun > 0,
          dashing: r.dashT > 0,
        })),
        chickens: chickens.map((c) => ({ id: c.id, x: r2(c.x), y: r2(c.y), penned: c.penned, flap: c.scared })),
        penned,
      };
    },
    done() {
      return endedAt !== null && elapsed - endedAt > 1.5;
    },
    scores(): TeamScore[] {
      return teamIds.map((team) => ({
        team,
        score: penned[team],
        detail: `${penned[team]} chicken${penned[team] === 1 ? "" : "s"} packed`,
      }));
    },
  };
}
