import type { GameInput, PlayerInfo, TeamId, TugState } from "../../shared/types";
import { type Game, type TeamScore, teamsOf } from "./game";

const RADIUS = 10;
const TIME_LIMIT = 40;
const TEAM_PULL = 1.25; // velocity added per tap, split across team members
const DAMPING = 1.5;
const MIN_TAP_GAP_MS = 35;

export function createTug(players: PlayerInfo[]): Game {
  const teamIds = teamsOf(players);
  const n = teamIds.length;
  // Spread team directions evenly. Two teams = left vs right.
  const teams = teamIds.map((team, i) => {
    const angle = n === 2 ? (i === 0 ? Math.PI : 0) : n === 1 ? 0 : -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { team, angle, members: players.filter((p) => p.team === team).map((p) => p.id) };
  });
  const teamOf = new Map(players.map((p) => [p.id, p.team]));
  const lastTap = new Map<string, number>();
  const pulls: Record<string, number> = {};
  const knot = { x: 0, y: 0, vx: 0, vy: 0 };
  let elapsed = 0;
  let winner: TeamId | null = null;
  let endedAt: number | null = null;

  const dirOf = (team: TeamId) => {
    const t = teams.find((x) => x.team === team)!;
    return { x: Math.cos(t.angle), y: Math.sin(t.angle) };
  };
  const progress = (team: TeamId) => {
    const d = dirOf(team);
    return knot.x * d.x + knot.y * d.y;
  };

  return {
    update(dt) {
      elapsed += dt;
      for (const id in pulls) pulls[id] *= Math.exp(-6 * dt);
      if (endedAt !== null) return;
      const damp = Math.exp(-DAMPING * dt);
      knot.vx *= damp;
      knot.vy *= damp;
      knot.x += knot.vx * dt;
      knot.y += knot.vy * dt;
      const dist = Math.hypot(knot.x, knot.y);
      if (dist >= RADIUS && n > 1) {
        winner = [...teamIds].sort((a, b) => progress(b) - progress(a))[0];
        endedAt = elapsed;
      } else if (dist >= RADIUS) {
        knot.x *= RADIUS / dist;
        knot.y *= RADIUS / dist;
      }
      if (elapsed >= TIME_LIMIT && endedAt === null) endedAt = elapsed;
    },
    input(id, msg: GameInput) {
      if (msg.type !== "tap" || endedAt !== null) return;
      const team = teamOf.get(id);
      if (team === undefined) return;
      const now = Date.now();
      if (now - (lastTap.get(id) ?? 0) < MIN_TAP_GAP_MS) return;
      lastTap.set(id, now);
      const size = teams.find((t) => t.team === team)!.members.length;
      const d = dirOf(team);
      // Each team's total pull scales with its average tap speed, not head count.
      const push = TEAM_PULL / size;
      knot.vx += d.x * push;
      knot.vy += d.y * push;
      pulls[id] = Math.min(1, (pulls[id] ?? 0) + 0.35);
    },
    state(): TugState {
      return {
        kind: "tug",
        timeLeft: Math.max(0, TIME_LIMIT - elapsed),
        radius: RADIUS,
        knot: { x: Math.round(knot.x * 100) / 100, y: Math.round(knot.y * 100) / 100 },
        teams,
        winner,
        pulls: Object.fromEntries(Object.entries(pulls).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      };
    },
    done() {
      return endedAt !== null && elapsed - endedAt > 2;
    },
    scores(): TeamScore[] {
      return teamIds.map((team) => {
        const p = progress(team);
        const won = team === winner;
        return {
          team,
          score: (won ? 1000 : 0) + p,
          detail: won ? "dragged the knot home!" : `${Math.round(((p + RADIUS) / (2 * RADIUS)) * 100)}% pull`,
        };
      });
    },
  };
}
