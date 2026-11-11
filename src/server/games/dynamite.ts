import { cornerFor, type DynamiteState, type GameInput, type PlayerInfo, type TeamId } from "../../shared/types";
import { arenaFor, clampToArena, cornerSpawn, type Mover, moveMover, newMover, r2, separate, steer, tryDash } from "./arena";
import { type Game, type TeamScore, teamsOf } from "./game";

const TIME_LIMIT = 150;
const BODY_R = 0.5;
const SPEED = 6.2;
const HOLDER_SPEED = 6.9; // the holder is a little faster so they can chase
const DASH_SPEED = 14;
const DASH_TIME = 0.22;
const DASH_CD = 1.5;
const PASS_DIST = 1.15;
const PASS_COOLDOWN = 0.6; // no instant pass-backs
const BETWEEN_ROUNDS = 2.2;
const BLAST_R = 3;

interface Runner extends Mover {
  id: string;
  team: TeamId;
  alive: boolean;
  outAt: number | null;
  noCatch: number; // just passed it on: can't get it straight back
}

export function createDynamite(players: PlayerInfo[]): Game {
  const { W, H } = arenaFor(players.length);
  const teamIds = teamsOf(players);
  const runners: Runner[] = players.map((p, i) => {
    const corner = cornerFor(teamIds.indexOf(p.team), teamIds.length, W, H, 4);
    const k = players.filter((q, j) => j < i && q.team === p.team).length;
    const s = cornerSpawn(corner, k, W, H);
    return { ...newMover(s.x, s.y, s.fx, s.fy), id: p.id, team: p.team, alive: true, outAt: null, noCatch: 0 };
  });
  let holder: Runner | null = null;
  let fuse = 0;
  let fuseMax = 1;
  let pause = 1.5;
  let holdCd = 0;
  let boom: DynamiteState["boom"] = null;
  let boomId = 0;
  let elapsed = 0;
  let endedAt: number | null = null;

  const aliveTeams = () => new Set(runners.filter((r) => r.alive).map((r) => r.team)).size;
  const shouldEnd = () => {
    if (elapsed >= TIME_LIMIT) return true;
    const alive = runners.filter((r) => r.alive).length;
    return teamIds.length > 1 ? aliveTeams() <= 1 : alive <= 1;
  };

  const newRound = () => {
    const alive = runners.filter((r) => r.alive);
    holder = alive[Math.floor(Math.random() * alive.length)] ?? null;
    // shorter fuses as fewer people remain
    fuseMax = Math.max(6, 9 + Math.random() * 6 - (runners.length - alive.length) * 0.3);
    fuse = fuseMax;
    holdCd = 1;
  };

  return {
    update(dt) {
      elapsed += dt;
      const playing = endedAt === null;
      for (const r of runners) {
        r.noCatch = Math.max(0, r.noCatch - dt);
        if (!r.alive) continue;
        moveMover(r, dt, r === holder ? HOLDER_SPEED : SPEED, playing);
        clampToArena(r, BODY_R, W, H);
      }
      for (let i = 0; i < runners.length; i++)
        for (let j = i + 1; j < runners.length; j++)
          if (runners[i].alive && runners[j].alive) separate(runners[i], runners[j], BODY_R * 2);
      if (!playing) return;

      if (!holder) {
        pause -= dt;
        if (pause <= 0) newRound();
      } else {
        fuse -= dt;
        holdCd = Math.max(0, holdCd - dt);
        // pass it on by touching someone
        if (holdCd <= 0) {
          let best: Runner | null = null;
          let bestD = PASS_DIST;
          for (const r of runners) {
            if (r === holder || !r.alive || r.noCatch > 0) continue;
            const d = Math.hypot(r.x - holder.x, r.y - holder.y);
            if (d < bestD) {
              best = r;
              bestD = d;
            }
          }
          if (best) {
            holder.noCatch = PASS_COOLDOWN;
            holder = best;
            holdCd = 0.25;
          }
        }
        if (fuse <= 0) {
          const h = holder;
          h.alive = false;
          h.outAt = elapsed;
          boom = { id: ++boomId, x: r2(h.x), y: r2(h.y), victim: h.id };
          // the blast shoves everyone nearby away
          for (const r of runners) {
            if (!r.alive) continue;
            const dx = r.x - h.x;
            const dy = r.y - h.y;
            const d = Math.hypot(dx, dy) || 0.01;
            if (d < BLAST_R) {
              const f = (1 - d / BLAST_R) * 16;
              r.vx += (dx / d) * f;
              r.vy += (dy / d) * f;
              r.dashT = 0.25; // let the shove carry
            }
          }
          holder = null;
          pause = BETWEEN_ROUNDS;
        }
      }
      if (shouldEnd()) {
        endedAt = elapsed;
        holder = null;
      }
    },
    input(id, msg: GameInput) {
      const r = runners.find((x) => x.id === id);
      if (!r || !r.alive || endedAt !== null) return;
      if (msg.type === "move") steer(r, msg.x, msg.y);
      else if (msg.type === "action") tryDash(r, DASH_SPEED, DASH_TIME, DASH_CD);
    },
    state(): DynamiteState {
      return {
        kind: "dynamite",
        timeLeft: Math.max(0, TIME_LIMIT - elapsed),
        w: W,
        h: H,
        runners: runners.map((r) => ({
          id: r.id, team: r.team, x: r2(r.x), y: r2(r.y), vx: r2(r.vx), vy: r2(r.vy), alive: r.alive, outAt: r.outAt, dashing: r.dashT > 0,
        })),
        holder: holder?.id ?? null,
        fuse: r2(Math.max(0, fuse)),
        fuseMax: r2(fuseMax),
        boom,
      };
    },
    done() {
      return endedAt !== null && elapsed - endedAt > 2.5;
    },
    scores(): TeamScore[] {
      return teamIds.map((team) => {
        const rs = runners.filter((r) => r.team === team);
        const alive = rs.filter((r) => r.alive).length;
        const last = Math.max(...rs.map((r) => r.outAt ?? elapsed));
        return { team, score: alive * 1000 + last, detail: alive ? `${alive} survived` : `blown up at ${Math.round(last)}s` };
      });
    },
  };
}
