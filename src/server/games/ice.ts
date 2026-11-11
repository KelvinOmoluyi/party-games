import type { GameInput, IceState, IceTrack, PlayerInfo, TeamId } from "../../shared/types";
import { normInput, r2, separate } from "./arena";
import { type Game, type TeamScore, mean, teamsOf } from "./game";

const W = 40;
const H = 20;
const LAPS = 3;
const TIME_LIMIT = 100;
const BOAT_R = 0.55;
const THRUST = 11;
const TURN = 3.6;
const DRAG_FWD = 0.35; // ice: barely slows you down
const DRAG_SIDE = 1.6; // sideways grip (low = more drift)
const MAX_SPEED = 13;
const BOOST = 7;
const BOOST_CD = 4;
const WALL_BOUNCE = 0.45;

export const ICE_TRACK: IceTrack = { cx: W / 2, cy: H / 2, a: 10.5, R: 5.6, hw: 2.7 };
const OBSTACLES = [
  { x: W / 2 + 5, y: H / 2 - ICE_TRACK.R + 0.9, r: 0.55 },
  { x: W / 2 - 5, y: H / 2 + ICE_TRACK.R - 0.9, r: 0.55 },
  { x: W / 2 + ICE_TRACK.a + ICE_TRACK.R - 0.2, y: H / 2, r: 0.5 },
  { x: W / 2 - ICE_TRACK.a - ICE_TRACK.R + 0.2, y: H / 2, r: 0.5 },
];

const T = ICE_TRACK;
const LOOP = 4 * T.a + 2 * Math.PI * T.R;

/** Signed distance from the track's centre line (+ = outside the loop), and the outward normal. */
export function trackOffset(x: number, y: number) {
  if (Math.abs(x - T.cx) <= T.a) {
    const top = y < T.cy;
    return { d: Math.abs(y - T.cy) - T.R, nx: 0, ny: top ? -1 : 1 };
  }
  const ex = x > T.cx ? T.cx + T.a : T.cx - T.a;
  const dx = x - ex;
  const dy = y - T.cy;
  const len = Math.hypot(dx, dy) || 1;
  return { d: len - T.R, nx: dx / len, ny: dy / len };
}

/** Distance along the loop (clockwise on screen), 0 at the start line in the middle of the top straight. */
export function loopPos(x: number, y: number) {
  let s: number;
  if (Math.abs(x - T.cx) <= T.a) {
    s = y < T.cy ? x - (T.cx - T.a) : 2 * T.a + Math.PI * T.R + (T.cx + T.a - x);
  } else if (x > T.cx) {
    const th = Math.atan2(y - T.cy, x - (T.cx + T.a));
    s = 2 * T.a + (th + Math.PI / 2) * T.R;
  } else {
    let th = Math.atan2(y - T.cy, x - (T.cx - T.a));
    if (th < 0) th += Math.PI * 2;
    s = 4 * T.a + Math.PI * T.R + (th - Math.PI / 2) * T.R;
  }
  return (((s - T.a) % LOOP) + LOOP) % LOOP;
}

interface Boat {
  id: string;
  team: TeamId;
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  ix: number;
  iy: number;
  lap: number;
  last: number;
  finishedAt: number | null;
  boostCd: number;
  boostT: number;
}

export function createIce(players: PlayerInfo[]): Game {
  const boats: Boat[] = players.map((p, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = T.cx - 1.2 - row * 1.6;
    const y = T.cy - T.R + (col - 1.5) * 1.25;
    const last = loopPos(x, y);
    // the grid is just behind the start line, so crossing it the first time starts lap 1
    const lap = last > LOOP / 2 ? -1 : 0;
    return { id: p.id, team: p.team, x, y, a: 0, vx: 0, vy: 0, ix: 0, iy: 0, lap, last, finishedAt: null, boostCd: 1, boostT: 0 };
  });
  let elapsed = 0;
  let doneAt: number | null = null;
  const progress = (b: Boat) => b.lap + b.last / LOOP;

  return {
    update(dt) {
      elapsed += dt;
      for (const b of boats) {
        b.boostCd = Math.max(0, b.boostCd - dt);
        b.boostT = Math.max(0, b.boostT - dt);
        const racing = b.finishedAt === null && doneAt === null;
        const m = Math.hypot(b.ix, b.iy);
        if (racing && m > 0.15) {
          const target = Math.atan2(b.iy, b.ix);
          let diff = Math.atan2(Math.sin(target - b.a), Math.cos(target - b.a));
          b.a += Math.sign(diff) * Math.min(Math.abs(diff), TURN * dt);
          diff = Math.atan2(Math.sin(target - b.a), Math.cos(target - b.a));
          const push = THRUST * m * Math.max(0.2, Math.cos(diff));
          b.vx += Math.cos(b.a) * push * dt;
          b.vy += Math.sin(b.a) * push * dt;
        }
        // ice friction: little drag forwards, a bit more sideways (so you drift)
        const fx = Math.cos(b.a);
        const fy = Math.sin(b.a);
        let along = b.vx * fx + b.vy * fy;
        let side = -b.vx * fy + b.vy * fx;
        along *= Math.exp(-(racing ? DRAG_FWD : 2.5) * dt);
        side *= Math.exp(-DRAG_SIDE * dt);
        b.vx = along * fx - side * fy;
        b.vy = along * fy + side * fx;
        const sp = Math.hypot(b.vx, b.vy);
        const cap = MAX_SPEED + (b.boostT > 0 ? BOOST : 0);
        if (sp > cap) {
          b.vx *= cap / sp;
          b.vy *= cap / sp;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        // snowbank walls on both sides of the track
        const o = trackOffset(b.x, b.y);
        const lim = T.hw - BOAT_R;
        if (Math.abs(o.d) > lim) {
          const sgn = o.d > 0 ? 1 : -1;
          const over = Math.abs(o.d) - lim;
          b.x -= o.nx * sgn * over;
          b.y -= o.ny * sgn * over;
          const vn = (b.vx * o.nx + b.vy * o.ny) * sgn;
          if (vn > 0) {
            b.vx -= o.nx * sgn * vn * (1 + WALL_BOUNCE);
            b.vy -= o.ny * sgn * vn * (1 + WALL_BOUNCE);
            b.vx *= 0.85;
            b.vy *= 0.85;
          }
        }
        for (const ob of OBSTACLES) {
          const dx = b.x - ob.x;
          const dy = b.y - ob.y;
          const d = Math.hypot(dx, dy) || 0.001;
          if (d < ob.r + BOAT_R) {
            const nx = dx / d;
            const ny = dy / d;
            b.x = ob.x + nx * (ob.r + BOAT_R);
            b.y = ob.y + ny * (ob.r + BOAT_R);
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) {
              b.vx -= nx * vn * 1.6;
              b.vy -= ny * vn * 1.6;
            }
          }
        }
        // laps (crossing the start line forwards / backwards)
        const pos = loopPos(b.x, b.y);
        if (b.last > LOOP * 0.8 && pos < LOOP * 0.2) b.lap++;
        else if (b.last < LOOP * 0.2 && pos > LOOP * 0.8) b.lap--;
        b.last = pos;
        if (b.finishedAt === null && progress(b) >= LAPS) b.finishedAt = elapsed;
      }
      // boats bump each other
      for (let i = 0; i < boats.length; i++) {
        for (let j = i + 1; j < boats.length; j++) {
          const a = boats[i];
          const c = boats[j];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d >= BOAT_R * 2 || d === 0) continue;
          separate(a, c, BOAT_R * 2);
          const nx = dx / d;
          const ny = dy / d;
          const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rel < 0) {
            const j2 = -rel * 0.9;
            a.vx -= nx * j2;
            a.vy -= ny * j2;
            c.vx += nx * j2;
            c.vy += ny * j2;
          }
        }
      }
      if (doneAt === null && (boats.every((b) => b.finishedAt !== null) || elapsed >= TIME_LIMIT)) doneAt = elapsed;
    },
    input(id, msg: GameInput) {
      const b = boats.find((x) => x.id === id);
      if (!b) return;
      if (msg.type === "move") {
        const v = normInput(msg.x, msg.y);
        b.ix = v.x;
        b.iy = v.y;
      } else if (msg.type === "action" && b.boostCd <= 0 && b.finishedAt === null) {
        b.boostCd = BOOST_CD;
        b.boostT = 0.8;
        b.vx += Math.cos(b.a) * BOOST;
        b.vy += Math.sin(b.a) * BOOST;
      }
    },
    state(): IceState {
      return {
        kind: "ice",
        timeLeft: Math.max(0, TIME_LIMIT - elapsed),
        w: W,
        h: H,
        track: T,
        laps: LAPS,
        obstacles: OBSTACLES,
        boats: boats.map((b) => ({
          id: b.id,
          team: b.team,
          x: r2(b.x),
          y: r2(b.y),
          a: r2(b.a),
          vx: r2(b.vx),
          vy: r2(b.vy),
          progress: Math.round(progress(b) * 1000) / 1000,
          finishedAt: b.finishedAt,
          boosting: b.boostT > 0,
        })),
      };
    },
    done() {
      return doneAt !== null && elapsed - doneAt > 2;
    },
    scores(): TeamScore[] {
      return teamsOf(boats).map((team) => {
        const bs = boats.filter((b) => b.team === team);
        const vals = bs.map((b) => (b.finishedAt !== null ? 10000 - b.finishedAt : Math.max(0, progress(b)) * 1000));
        const fin = bs.filter((b) => b.finishedAt !== null);
        const detail =
          fin.length === bs.length
            ? `avg ${mean(fin.map((b) => b.finishedAt!)).toFixed(1)}s`
            : `${fin.length}/${bs.length} finished`;
        return { team, score: mean(vals), detail };
      });
    },
  };
}
