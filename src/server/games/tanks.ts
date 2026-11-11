import { cornerFor, type GameInput, type PlayerInfo, type TankState, type TeamId, type Wall } from "../../shared/types";
import { clampToArena, normInput, pointInWall, pushOutOfWall, r2, separate } from "./arena";
import { type Game, type TeamScore, teamsOf } from "./game";

const TIME_LIMIT = 100;
const TANK_R = 0.75;
const SPEED = 5.2;
const FLAG_SPEED = 0.8; // carrying a flag slows you down
const TURN = 12;
const RELOAD = 0.55;
const BULLET_SPEED = 13;
const BULLET_LIFE = 1.4;
const RESPAWN = 3;
const SHIELD = 1.5;
const FLAG_RETURN = 12;

interface TankMap {
  W: number;
  H: number;
  walls: Wall[];
}

/** Copy a top-left-quarter layout into all four quarters (mirror on both axes), dropping duplicates. */
export function mirror4(W: number, H: number, quarter: Wall[]): Wall[] {
  const out = new Map<string, Wall>();
  for (const q of quarter) {
    for (const m of [
      { ...q },
      { ...q, x: W - q.x - q.w },
      { ...q, y: H - q.y - q.h },
      { ...q, x: W - q.x - q.w, y: H - q.y - q.h },
    ]) {
      out.set(`${m.x},${m.y},${m.w},${m.h}`, m);
    }
  }
  return [...out.values()];
}

// Small map (up to 4 players). Mirror-symmetric on both axes, so no corner base is favoured.
// Boxes 1.5+ tall/wide are drawn as crate stacks, thin ones as concrete barriers.
const SMALL: TankMap = {
  W: 32,
  H: 18,
  walls: mirror4(32, 18, [
    { x: 14.5, y: 7.5, w: 3, h: 3 }, // centre crates
    { x: 8, y: 3, w: 1, h: 4 },
    { x: 13, y: 2.5, w: 6, h: 1 },
    { x: 3.5, y: 8.5, w: 3, h: 1 },
    { x: 10.5, y: 8.25, w: 1.5, h: 1.5 },
  ]),
};

// Big maze map (5+ players): wider, with corridors and cover. Every gap is at least
// 2 units wide so tanks (1.5 across) never get wedged.
const BIG: TankMap = {
  W: 40,
  H: 20,
  walls: mirror4(40, 20, [
    { x: 6.5, y: 0, w: 1, h: 4.3 }, // shield right of the base
    { x: 0, y: 6, w: 3.6, h: 1 }, // shield below the base
    { x: 9.5, y: 4.5, w: 1.5, h: 1.5 }, // crate
    { x: 13, y: 0, w: 1, h: 4.5 }, // top corridor wall
    { x: 5.2, y: 8, w: 4.3, h: 1 }, // mid-left wall
    { x: 16, y: 2.2, w: 3, h: 1 }, // top-centre barrier
    { x: 16, y: 5.2, w: 1.5, h: 1.5 }, // crate
    { x: 11.5, y: 8, w: 1, h: 4 }, // pillar across the middle line
    { x: 18.5, y: 8.5, w: 3, h: 3 }, // centre crates
  ]),
};

export const tankMapFor = (players: number) => (players > 4 ? BIG : SMALL);

interface Tank {
  id: string;
  team: TeamId;
  x: number;
  y: number;
  a: number;
  ix: number;
  iy: number;
  alive: boolean;
  respawnIn: number;
  shield: number;
  reload: number;
  flag: TeamId | null;
}

interface Flag {
  team: TeamId;
  x: number;
  y: number;
  carrier: string | null;
  home: boolean;
  droppedFor: number;
}

export function createTanks(players: PlayerInfo[]): Game {
  const { W, H, walls: WALLS } = tankMapFor(players.length);
  const teamIds = teamsOf(players);
  const bases = teamIds.map((team, i) => ({ team, ...cornerFor(i, teamIds.length, W, H, 2.4) }));
  const baseOf = (t: TeamId) => bases.find((b) => b.team === t)!;

  const spawnPos = (t: TeamId, k: number) => {
    const b = baseOf(t);
    const toC = Math.atan2(H / 2 - b.y, W / 2 - b.x);
    const side = ((k % 4) - 1.5) * 1.1;
    return { x: b.x + Math.cos(toC + Math.PI / 2) * side, y: b.y + Math.sin(toC + Math.PI / 2) * side, a: toC };
  };

  const tanks: Tank[] = players.map((p, i) => {
    const s = spawnPos(p.team, players.filter((q, j) => j < i && q.team === p.team).length);
    return { id: p.id, team: p.team, x: s.x, y: s.y, a: s.a, ix: 0, iy: 0, alive: true, respawnIn: 0, shield: SHIELD, reload: 0.5, flag: null };
  });
  const flags: Flag[] = bases.map((b) => ({ team: b.team, x: b.x, y: b.y, carrier: null, home: true, droppedFor: 0 }));
  let bullets: { id: number; x: number; y: number; vx: number; vy: number; a: number; team: TeamId; life: number }[] = [];
  let nextBullet = 1;
  const caps: Record<number, number> = Object.fromEntries(teamIds.map((t) => [t, 0]));
  const kills: Record<number, number> = Object.fromEntries(teamIds.map((t) => [t, 0]));
  let elapsed = 0;
  let endedAt: number | null = null;

  const resetFlag = (f: Flag) => {
    const b = baseOf(f.team);
    f.x = b.x;
    f.y = b.y;
    f.carrier = null;
    f.home = true;
    f.droppedFor = 0;
  };

  const destroy = (t: Tank, by: TeamId) => {
    t.alive = false;
    t.respawnIn = RESPAWN;
    kills[by] = (kills[by] ?? 0) + 1;
    if (t.flag !== null) {
      const f = flags.find((x) => x.team === t.flag)!;
      f.carrier = null;
      f.home = false;
      f.droppedFor = 0;
      f.x = t.x;
      f.y = t.y;
      t.flag = null;
    }
  };

  return {
    update(dt) {
      elapsed += dt;
      if (endedAt !== null) return;

      for (const t of tanks) {
        if (!t.alive) {
          t.respawnIn -= dt;
          if (t.respawnIn <= 0) {
            const s = spawnPos(t.team, tanks.indexOf(t));
            Object.assign(t, { x: s.x, y: s.y, a: s.a, alive: true, shield: SHIELD, reload: 0.3 });
          }
          continue;
        }
        t.shield = Math.max(0, t.shield - dt);
        t.reload = Math.max(0, t.reload - dt);
        const m = Math.hypot(t.ix, t.iy);
        if (m > 0.15) {
          const target = Math.atan2(t.iy, t.ix);
          let diff = target - t.a;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          t.a += Math.sign(diff) * Math.min(Math.abs(diff), TURN * dt);
          const sp = SPEED * m * (t.flag !== null ? FLAG_SPEED : 1);
          t.x += t.ix * sp * dt;
          t.y += t.iy * sp * dt;
        }
        for (const w of WALLS) pushOutOfWall(t, TANK_R, w);
        clampToArena(t, TANK_R, W, H);
      }
      for (let i = 0; i < tanks.length; i++)
        for (let j = i + 1; j < tanks.length; j++)
          if (tanks[i].alive && tanks[j].alive) separate(tanks[i], tanks[j], TANK_R * 2);

      // bullets
      bullets = bullets.filter((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > W || b.y > H) return false;
        if (WALLS.some((w) => pointInWall(b.x, b.y, w))) return false;
        for (const t of tanks) {
          if (!t.alive || t.team === b.team) continue;
          if (Math.hypot(t.x - b.x, t.y - b.y) < TANK_R + 0.1) {
            if (t.shield <= 0) destroy(t, b.team);
            return false;
          }
        }
        return true;
      });

      // flags
      for (const f of flags) {
        if (f.carrier) {
          const c = tanks.find((t) => t.id === f.carrier)!;
          f.x = c.x;
          f.y = c.y;
          continue;
        }
        if (!f.home) {
          f.droppedFor += dt;
          if (f.droppedFor > FLAG_RETURN) resetFlag(f);
        }
        for (const t of tanks) {
          if (!t.alive || Math.hypot(t.x - f.x, t.y - f.y) > TANK_R + 0.6) continue;
          if (t.team === f.team) {
            if (!f.home) resetFlag(f); // touching your dropped flag sends it home
          } else if (t.flag === null) {
            f.carrier = t.id;
            f.home = false;
            t.flag = f.team;
            break;
          }
        }
      }

      // captures
      for (const t of tanks) {
        if (!t.alive || t.flag === null) continue;
        const b = baseOf(t.team);
        if (Math.hypot(t.x - b.x, t.y - b.y) < 1.8) {
          caps[t.team]++;
          resetFlag(flags.find((f) => f.team === t.flag)!);
          t.flag = null;
        }
      }

      if (elapsed >= TIME_LIMIT) endedAt = elapsed;
    },
    input(id, msg: GameInput) {
      const t = tanks.find((x) => x.id === id);
      if (!t) return;
      if (msg.type === "move") {
        const v = normInput(msg.x, msg.y);
        t.ix = v.x;
        t.iy = v.y;
      } else if (msg.type === "action" && t.alive && t.reload <= 0 && endedAt === null) {
        t.reload = RELOAD;
        const dx = Math.cos(t.a);
        const dy = Math.sin(t.a);
        bullets.push({ id: nextBullet++, a: t.a, x: t.x + dx * TANK_R * 1.3, y: t.y + dy * TANK_R * 1.3, vx: dx * BULLET_SPEED, vy: dy * BULLET_SPEED, team: t.team, life: BULLET_LIFE });
      }
    },
    state(): TankState {
      return {
        kind: "tanks",
        timeLeft: Math.max(0, TIME_LIMIT - elapsed),
        w: W,
        h: H,
        walls: WALLS,
        bases,
        tanks: tanks.map((t) => ({
          id: t.id,
          team: t.team,
          x: r2(t.x),
          y: r2(t.y),
          a: r2(t.a),
          alive: t.alive,
          respawnIn: r2(Math.max(0, t.respawnIn)),
          shield: t.shield > 0,
          flag: t.flag,
        })),
        bullets: bullets.map((b) => ({ id: b.id, x: r2(b.x), y: r2(b.y), a: r2(b.a), team: b.team })),
        flags: flags.map((f) => ({ team: f.team, x: r2(f.x), y: r2(f.y), carrier: f.carrier, home: f.home })),
        caps,
        kills,
      };
    },
    done() {
      return endedAt !== null && elapsed - endedAt > 1.5;
    },
    scores(): TeamScore[] {
      return teamIds.map((team) => ({
        team,
        score: caps[team] * 1000 + kills[team],
        detail: `${caps[team]} flag${caps[team] === 1 ? "" : "s"}, ${kills[team]} hits`,
      }));
    },
  };
}
