import type { GameInput, PlayerInfo, RaceState, TeamId } from "../../shared/types";
import { type Game, type TeamScore, mean, teamsOf } from "./game";

const FINISH = 100;
const TIME_LIMIT = 35;
const TAP_BOOST = 3.2;
const MAX_SPEED = 28;
const DRAG = 2; // per second
const MIN_TAP_GAP_MS = 35;

interface Runner {
  id: string;
  team: TeamId;
  dist: number;
  speed: number;
  finishedAt: number | null;
  lastTap: number;
}

export function createRace(players: PlayerInfo[]): Game {
  const runners: Runner[] = players.map((p) => ({
    id: p.id,
    team: p.team,
    dist: 0,
    speed: 0,
    finishedAt: null,
    lastTap: 0,
  }));
  let elapsed = 0;
  let doneAt: number | null = null;

  const allDone = () => runners.every((r) => r.finishedAt !== null);

  return {
    update(dt) {
      elapsed += dt;
      for (const r of runners) {
        if (r.finishedAt !== null) {
          r.speed *= Math.exp(-4 * dt);
          continue;
        }
        r.speed *= Math.exp(-DRAG * dt);
        r.dist += r.speed * dt;
        if (r.dist >= FINISH) {
          r.dist = FINISH;
          r.finishedAt = elapsed;
        }
      }
      if (doneAt === null && (allDone() || elapsed >= TIME_LIMIT)) doneAt = elapsed;
    },
    input(id, msg: GameInput) {
      if (msg.type !== "tap") return;
      const r = runners.find((x) => x.id === id);
      if (!r || r.finishedAt !== null) return;
      const now = Date.now();
      if (now - r.lastTap < MIN_TAP_GAP_MS) return;
      r.lastTap = now;
      r.speed = Math.min(MAX_SPEED, r.speed + TAP_BOOST);
    },
    state(): RaceState {
      return {
        kind: "race",
        timeLeft: Math.max(0, TIME_LIMIT - elapsed),
        finish: FINISH,
        runners: runners.map(({ id, team, dist, speed, finishedAt }) => ({
          id,
          team,
          dist: Math.round(dist * 100) / 100,
          speed: Math.round(speed * 10) / 10,
          finishedAt,
        })),
      };
    },
    done() {
      return doneAt !== null && elapsed - doneAt > 1.5;
    },
    scores(): TeamScore[] {
      return teamsOf(runners).map((team) => {
        const rs = runners.filter((r) => r.team === team);
        const vals = rs.map((r) => (r.finishedAt !== null ? 200 - r.finishedAt : r.dist));
        const finished = rs.filter((r) => r.finishedAt !== null);
        const detail =
          finished.length === rs.length
            ? `avg ${mean(finished.map((r) => r.finishedAt!)).toFixed(1)}s`
            : `${finished.length}/${rs.length} finished`;
        return { team, score: mean(vals), detail };
      });
    },
  };
}
