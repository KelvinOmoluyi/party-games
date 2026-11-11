import { type Box, makeCourse, overlaps, PARKOUR } from "../../shared/parkour";
import type { GameInput, ParkourState, PlayerInfo, TeamId } from "../../shared/types";
import { r2 } from "./arena";
import { type Game, type TeamScore, mean, teamsOf } from "./game";

const TIME_LIMIT = 80;
const RESPAWN = 1.1;
const COYOTE = 0.1;
const BUFFER = 0.15;
const { RUN, GRAVITY, JUMP, JUMP2, W, H, FALL_Y } = PARKOUR;

interface Runner {
  id: string;
  team: TeamId;
  x: number;
  y: number; // feet
  vy: number;
  grounded: boolean;
  sinceGround: number;
  jumps: number;
  jumpReq: number; // buffered jump, seconds left
  dead: boolean;
  respawnIn: number;
  cp: number;
  finishedAt: number | null;
}

export function createParkour(players: PlayerInfo[]): Game {
  const seed = Math.floor(Math.random() * 1e9);
  const course = makeCourse(seed);
  const solids: Box[] = [...course.roofs, ...course.crates, ...course.walls];
  const runners: Runner[] = players.map((p, i) => ({
    id: p.id,
    team: p.team,
    x: 2 - (i % 4) * 0.5,
    y: 0,
    vy: 0,
    grounded: true,
    sinceGround: 0,
    jumps: 0,
    jumpReq: 0,
    dead: false,
    respawnIn: 0,
    cp: 0,
    finishedAt: null,
  }));
  let elapsed = 0;
  let doneAt: number | null = null;

  const box = (r: Runner): Box => ({ x: r.x - W / 2, y: r.y - H, w: W, h: H });

  const step = (r: Runner, dt: number) => {
    // horizontal: auto-run, small ledges are stepped up, anything taller blocks you
    const vx = r.finishedAt !== null ? RUN * 0.4 : RUN;
    r.x += vx * dt;
    for (const s of solids) {
      const b = box(r);
      if (!overlaps(b, s)) continue;
      if (r.y - s.y <= 0.35 && r.vy >= 0) {
        r.y = s.y; // step up
      } else {
        r.x = s.x - W / 2 - 0.001;
      }
    }
    // vertical
    const prevFeet = r.y;
    r.vy = Math.min(r.vy + GRAVITY * dt, 30);
    r.y += r.vy * dt;
    r.grounded = false;
    for (const s of solids) {
      const b = box(r);
      if (!overlaps(b, s)) continue;
      if (r.vy >= 0 && prevFeet <= s.y + 0.05) {
        r.y = s.y;
        r.vy = 0;
        r.grounded = true;
      } else if (r.vy < 0) {
        r.y = s.y + s.h + H + 0.001; // bonk your head
        r.vy = 0;
      }
    }
  };

  const die = (r: Runner) => {
    r.dead = true;
    r.respawnIn = RESPAWN;
  };

  return {
    update(dt) {
      elapsed += dt;
      for (const r of runners) {
        if (r.dead) {
          r.respawnIn -= dt;
          if (r.respawnIn <= 0) {
            const cp = course.checkpoints[r.cp];
            Object.assign(r, { dead: false, x: cp.x, y: cp.y, vy: 0, grounded: true, jumps: 0, jumpReq: 0 });
          }
          continue;
        }
        if (doneAt !== null && r.finishedAt === null) continue;
        r.jumpReq = Math.max(0, r.jumpReq - dt);
        r.sinceGround = r.grounded ? 0 : r.sinceGround + dt;
        if (r.jumpReq > 0 && r.finishedAt === null) {
          if (r.grounded || r.sinceGround < COYOTE) {
            r.vy = -JUMP;
            r.jumps = 1;
            r.grounded = false;
            r.sinceGround = COYOTE;
            r.jumpReq = 0;
          } else if (r.jumps < 2) {
            r.vy = -JUMP2;
            r.jumps = 2;
            r.jumpReq = 0;
          }
        }
        // two sub-steps keep collisions solid at 30 ticks/s
        for (let i = 0; i < 2; i++) step(r, dt / 2);
        if (r.grounded) r.jumps = 0;
        if (r.y > FALL_Y || course.spikes.some((s) => overlaps(box(r), s))) {
          die(r);
          continue;
        }
        while (r.cp + 1 < course.checkpoints.length && r.x >= course.checkpoints[r.cp + 1].x) r.cp++;
        if (r.finishedAt === null && r.x >= course.finishX) r.finishedAt = elapsed;
      }
      if (doneAt === null && (runners.every((r) => r.finishedAt !== null) || elapsed >= TIME_LIMIT)) doneAt = elapsed;
    },
    input(id, msg: GameInput) {
      const r = runners.find((x) => x.id === id);
      if (!r || r.dead) return;
      if (msg.type === "tap" || msg.type === "action") r.jumpReq = BUFFER;
    },
    state(): ParkourState {
      return {
        kind: "parkour",
        timeLeft: Math.max(0, TIME_LIMIT - elapsed),
        seed,
        runners: runners.map((r) => ({
          id: r.id,
          team: r.team,
          x: r2(r.x),
          y: r2(r.y),
          vy: r2(r.vy),
          grounded: r.grounded,
          dead: r.dead,
          finishedAt: r.finishedAt,
          cp: r.cp,
        })),
      };
    },
    done() {
      return doneAt !== null && elapsed - doneAt > 2;
    },
    scores(): TeamScore[] {
      return teamsOf(runners).map((team) => {
        const rs = runners.filter((r) => r.team === team);
        const vals = rs.map((r) => (r.finishedAt !== null ? 10000 - r.finishedAt : (r.x / course.finishX) * 1000));
        const fin = rs.filter((r) => r.finishedAt !== null);
        const detail =
          fin.length === rs.length
            ? `avg ${mean(fin.map((r) => r.finishedAt!)).toFixed(1)}s`
            : `${fin.length}/${rs.length} finished, ${Math.round(mean(rs.map((r) => Math.min(1, r.x / course.finishX))) * 100)}% avg`;
        return { team, score: mean(vals), detail };
      });
    },
  };
}
