import { type BoulderState, cornerFor, type GameInput, type PlayerInfo, type TeamId } from "../../shared/types";
import { arenaFor, clampToArena, cornerSpawn, type Mover, moveMover, newMover, r2, separate, steer, tryDash } from "./arena";
import { type Game, type TeamScore, teamsOf } from "./game";

const TIME_LIMIT = 75;
const BODY_R = 0.5;
const SPEED = 6.4;
const DASH_SPEED = 15;
const DASH_TIME = 0.25;
const DASH_CD = 1.3;
const WARN = 1.1; // seconds of warning before a boulder rolls in
const GRACE = 2; // nobody gets squashed in the first seconds

interface Runner extends Mover {
  id: string;
  team: TeamId;
  alive: boolean;
  outAt: number | null;
}

interface Boulder {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Warning {
  id: number;
  x: number;
  y: number;
  a: number;
  r: number;
  t: number;
  speed: number;
}

export function createBoulder(players: PlayerInfo[]): Game {
  const { W, H } = arenaFor(players.length);
  const teamIds = teamsOf(players);
  const runners: Runner[] = players.map((p, i) => {
    const corner = cornerFor(teamIds.indexOf(p.team), teamIds.length, W, H, 4);
    const k = players.filter((q, j) => j < i && q.team === p.team).length;
    const s = cornerSpawn(corner, k, W, H);
    return { ...newMover(s.x, s.y, s.fx, s.fy), id: p.id, team: p.team, alive: true, outAt: null };
  });
  let boulders: Boulder[] = [];
  let warnings: Warning[] = [];
  let nextId = 1;
  let spawnT = 1.2;
  let elapsed = 0;
  let endedAt: number | null = null;

  const spawnWarning = () => {
    const t = Math.min(1, elapsed / TIME_LIMIT);
    const r = 0.7 + Math.random() * (0.6 + t * 0.9);
    const speed = 6 + t * 7 + Math.random() * 3;
    // pick an edge, aim roughly at a random living player (or across the arena)
    const alive = runners.filter((x) => x.alive);
    const target = alive.length && Math.random() < 0.7 ? alive[Math.floor(Math.random() * alive.length)] : { x: Math.random() * W, y: Math.random() * H };
    const edge = Math.floor(Math.random() * 4);
    const pad = r + 0.2;
    let x: number;
    let y: number;
    if (edge === 0) [x, y] = [Math.random() * W, -pad];
    else if (edge === 1) [x, y] = [W + pad, Math.random() * H];
    else if (edge === 2) [x, y] = [Math.random() * W, H + pad];
    else [x, y] = [-pad, Math.random() * H];
    const a = Math.atan2(target.y - y, target.x - x) + (Math.random() - 0.5) * 0.3;
    warnings.push({ id: nextId++, x, y, a, r, t: WARN, speed });
  };

  const shouldEnd = () => {
    const alive = runners.filter((r) => r.alive);
    if (elapsed >= TIME_LIMIT) return true;
    if (teamIds.length > 1) return new Set(alive.map((r) => r.team)).size <= 1;
    return alive.length === 0;
  };

  return {
    update(dt) {
      elapsed += dt;
      const playing = endedAt === null;
      for (const r of runners) {
        if (!r.alive) continue;
        moveMover(r, dt, SPEED, playing);
        clampToArena(r, BODY_R, W, H);
      }
      for (let i = 0; i < runners.length; i++)
        for (let j = i + 1; j < runners.length; j++)
          if (runners[i].alive && runners[j].alive) separate(runners[i], runners[j], BODY_R * 2);

      if (playing) {
        spawnT -= dt;
        if (spawnT <= 0) {
          const t = Math.min(1, elapsed / TIME_LIMIT);
          const n = 1 + (Math.random() < t * 0.8 ? 1 : 0) + (runners.length > 8 && Math.random() < 0.5 ? 1 : 0);
          for (let k = 0; k < n; k++) spawnWarning();
          spawnT = Math.max(0.45, 1.5 - t * 1.1) * (0.8 + Math.random() * 0.4);
        }
      }
      for (const w of warnings) w.t -= dt;
      for (const w of warnings.filter((w) => w.t <= 0)) {
        boulders.push({ id: w.id, x: w.x, y: w.y, vx: Math.cos(w.a) * w.speed, vy: Math.sin(w.a) * w.speed, r: w.r });
      }
      warnings = warnings.filter((w) => w.t > 0);
      boulders = boulders.filter((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const m = b.r + 2;
        return b.x > -m && b.y > -m && b.x < W + m && b.y < H + m;
      });
      if (playing && elapsed > GRACE) {
        for (const r of runners) {
          if (!r.alive || r.dashT > 0) continue; // dodge-roll = brief invincibility
          for (const b of boulders) {
            if (Math.hypot(r.x - b.x, r.y - b.y) < b.r + BODY_R * 0.8) {
              r.alive = false;
              r.outAt = elapsed;
              break;
            }
          }
        }
      }
      if (playing && shouldEnd()) endedAt = elapsed;
    },
    input(id, msg: GameInput) {
      const r = runners.find((x) => x.id === id);
      if (!r || !r.alive || endedAt !== null) return;
      if (msg.type === "move") steer(r, msg.x, msg.y);
      else if (msg.type === "action") tryDash(r, DASH_SPEED, DASH_TIME, DASH_CD);
    },
    state(): BoulderState {
      return {
        kind: "boulder",
        timeLeft: Math.max(0, TIME_LIMIT - elapsed),
        w: W,
        h: H,
        runners: runners.map((r) => ({
          id: r.id, team: r.team, x: r2(r.x), y: r2(r.y), vx: r2(r.vx), vy: r2(r.vy), alive: r.alive, outAt: r.outAt, dashing: r.dashT > 0,
        })),
        boulders: boulders.map((b) => ({ id: b.id, x: r2(b.x), y: r2(b.y), vx: r2(b.vx), vy: r2(b.vy), r: r2(b.r) })),
        warnings: warnings.map((w) => ({ id: w.id, x: r2(w.x), y: r2(w.y), a: r2(w.a), r: r2(w.r) })),
      };
    },
    done() {
      return endedAt !== null && elapsed - endedAt > 2;
    },
    scores(): TeamScore[] {
      return teamIds.map((team) => {
        const rs = runners.filter((r) => r.team === team);
        const alive = rs.filter((r) => r.alive).length;
        const last = Math.max(...rs.map((r) => r.outAt ?? elapsed));
        return { team, score: alive * 1000 + last, detail: alive ? `${alive} still standing` : `squashed at ${Math.round(last)}s` };
      });
    },
  };
}
