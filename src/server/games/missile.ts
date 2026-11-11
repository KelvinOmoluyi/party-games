import { cornerFor, type GameInput, type MissileState, type PlayerInfo, type TeamId, type Wall } from "../../shared/types";
import { clampToArena, cornerSpawn, type Mover, moveMover, newMover, pointInWall, pushOutOfWall, r2, separate, steer } from "./arena";
import { type Game, type TeamScore, teamsOf } from "./game";
import { mirror4 } from "./tanks";

const TIME_LIMIT = 120;
const BODY_R = 0.5;
const SPEED = 6;
const LIVES = 3;
const MAX_AMMO = 6;
const AMMO_PER_CRATE = 2;
const MISSILE_SPEED = 15;
const MISSILE_LIFE = 1.8;
const RELOAD = 0.45;
const BLAST_R = 1.4;
const INVULN = 1.3;
const HEALTH_CHANCE = 0.12; // per pickup spawn: hearts are rare

// Stone ruins, mirrored on both axes so no corner is favoured.
const SMALL = {
  W: 32,
  H: 18,
  walls: mirror4(32, 18, [
    { x: 7, y: 2.5, w: 3, h: 1 },
    { x: 4, y: 7, w: 1, h: 4 },
    { x: 11, y: 6, w: 2, h: 2 },
    { x: 14, y: 1.8, w: 1, h: 3 },
    { x: 14.5, y: 8, w: 3, h: 2 },
  ]),
};
const BIG = {
  W: 40,
  H: 20,
  walls: mirror4(40, 20, [
    { x: 7, y: 2.5, w: 3.5, h: 1 },
    { x: 4.5, y: 7.5, w: 1, h: 5 },
    { x: 11, y: 6, w: 2, h: 2 },
    { x: 16.5, y: 2, w: 1, h: 3.5 },
    { x: 18.5, y: 8.5, w: 3, h: 3 },
    { x: 14, y: 9, w: 1.5, h: 2 },
  ]),
};
export const missileMapFor = (players: number) => (players > 4 ? BIG : SMALL);

interface Runner extends Mover {
  id: string;
  team: TeamId;
  lives: number;
  ammo: number;
  reload: number;
  invuln: number;
  alive: boolean;
  outAt: number | null;
  kills: number;
}

export function createMissile(players: PlayerInfo[]): Game {
  const { W, H, walls } = missileMapFor(players.length);
  const teamIds = teamsOf(players);
  const runners: Runner[] = players.map((p, i) => {
    const corner = cornerFor(teamIds.indexOf(p.team), teamIds.length, W, H, 2.5);
    const k = players.filter((q, j) => j < i && q.team === p.team).length;
    const s = cornerSpawn(corner, k, W, H);
    return { ...newMover(s.x, s.y, s.fx, s.fy), id: p.id, team: p.team, lives: LIVES, ammo: 1, reload: 0, invuln: 1.5, alive: true, outAt: null, kills: 0 };
  });
  let missiles: { id: number; x: number; y: number; a: number; team: TeamId; owner: string; life: number }[] = [];
  let pickups: { id: number; x: number; y: number; type: "ammo" | "health" }[] = [];
  let booms: { id: number; x: number; y: number; team: TeamId; t: number }[] = [];
  let nextId = 1;
  let pickupT = 0.5;
  let elapsed = 0;
  let endedAt: number | null = null;
  const pickupTarget = Math.min(10, 3 + Math.ceil(players.length / 2));

  const freeSpot = () => {
    for (let tries = 0; tries < 40; tries++) {
      const x = 1.5 + Math.random() * (W - 3);
      const y = 1.5 + Math.random() * (H - 3);
      if (walls.some((w) => x > w.x - 0.8 && x < w.x + w.w + 0.8 && y > w.y - 0.8 && y < w.y + w.h + 0.8)) continue;
      if (runners.some((r) => r.alive && Math.hypot(r.x - x, r.y - y) < 2)) continue;
      if (pickups.some((p) => Math.hypot(p.x - x, p.y - y) < 2)) continue;
      return { x, y };
    }
    return null;
  };

  const explode = (x: number, y: number, team: TeamId, owner: string) => {
    booms.push({ id: nextId++, x, y, team, t: 0.6 });
    for (const r of runners) {
      if (!r.alive || r.team === team) continue; // no friendly fire
      const dx = r.x - x;
      const dy = r.y - y;
      const d = Math.hypot(dx, dy);
      if (d > BLAST_R + BODY_R) continue;
      // knockback
      const n = d || 0.01;
      r.vx += (dx / n) * 10;
      r.vy += (dy / n) * 10;
      r.dashT = 0.15;
      if (r.invuln > 0) continue;
      r.lives--;
      r.invuln = INVULN;
      if (r.lives <= 0) {
        r.alive = false;
        r.outAt = elapsed;
        const killer = runners.find((k) => k.id === owner);
        if (killer) killer.kills++;
      }
    }
  };

  const shouldEnd = () => {
    if (elapsed >= TIME_LIMIT) return true;
    const alive = runners.filter((r) => r.alive);
    if (teamIds.length > 1) return new Set(alive.map((r) => r.team)).size <= 1;
    return alive.length === 0;
  };

  const blocked = (x: number, y: number, ws: Wall[]) => ws.some((w) => pointInWall(x, y, w));

  return {
    update(dt) {
      elapsed += dt;
      const playing = endedAt === null;
      for (const r of runners) {
        r.reload = Math.max(0, r.reload - dt);
        r.invuln = Math.max(0, r.invuln - dt);
        if (!r.alive) continue;
        moveMover(r, dt, SPEED, playing);
        for (const w of walls) pushOutOfWall(r, BODY_R, w);
        clampToArena(r, BODY_R, W, H);
        // pick things up
        pickups = pickups.filter((p) => {
          if (Math.hypot(p.x - r.x, p.y - r.y) > BODY_R + 0.55) return true;
          if (p.type === "ammo") {
            if (r.ammo >= MAX_AMMO) return true;
            r.ammo = Math.min(MAX_AMMO, r.ammo + AMMO_PER_CRATE);
          } else {
            if (r.lives >= LIVES) return true;
            r.lives++;
          }
          return false;
        });
      }
      for (let i = 0; i < runners.length; i++)
        for (let j = i + 1; j < runners.length; j++)
          if (runners[i].alive && runners[j].alive) separate(runners[i], runners[j], BODY_R * 2);

      missiles = missiles.filter((m) => {
        m.life -= dt;
        // two sub-steps so fast missiles don't skip through thin walls
        for (let k = 0; k < 2; k++) {
          m.x += Math.cos(m.a) * MISSILE_SPEED * (dt / 2);
          m.y += Math.sin(m.a) * MISSILE_SPEED * (dt / 2);
          if (m.x < 0 || m.y < 0 || m.x > W || m.y > H || blocked(m.x, m.y, walls)) {
            explode(m.x, m.y, m.team, m.owner);
            return false;
          }
          for (const r of runners) {
            if (!r.alive || r.team === m.team) continue;
            if (Math.hypot(r.x - m.x, r.y - m.y) < BODY_R + 0.25) {
              explode(m.x, m.y, m.team, m.owner);
              return false;
            }
          }
        }
        if (m.life <= 0) {
          explode(m.x, m.y, m.team, m.owner);
          return false;
        }
        return true;
      });
      for (const b of booms) b.t -= dt;
      booms = booms.filter((b) => b.t > 0);

      if (playing) {
        pickupT -= dt;
        if (pickupT <= 0) {
          pickupT = 1.2 + Math.random();
          if (pickups.length < pickupTarget) {
            const spot = freeSpot();
            const hearts = pickups.filter((p) => p.type === "health").length;
            if (spot) pickups.push({ id: nextId++, ...spot, type: hearts === 0 && Math.random() < HEALTH_CHANCE ? "health" : "ammo" });
          }
        }
        if (shouldEnd()) endedAt = elapsed;
      }
    },
    input(id, msg: GameInput) {
      const r = runners.find((x) => x.id === id);
      if (!r || !r.alive || endedAt !== null) return;
      if (msg.type === "move") steer(r, msg.x, msg.y);
      else if (msg.type === "action" && r.ammo > 0 && r.reload <= 0) {
        r.ammo--;
        r.reload = RELOAD;
        const a = Math.atan2(r.fy, r.fx);
        missiles.push({ id: nextId++, x: r.x + r.fx * 0.7, y: r.y + r.fy * 0.7, a, team: r.team, owner: r.id, life: MISSILE_LIFE });
        // a little recoil
        r.vx -= r.fx * 2;
        r.vy -= r.fy * 2;
      }
    },
    state(): MissileState {
      return {
        kind: "missile",
        timeLeft: Math.max(0, TIME_LIMIT - elapsed),
        w: W,
        h: H,
        walls,
        runners: runners.map((r) => ({
          id: r.id, team: r.team, x: r2(r.x), y: r2(r.y), vx: r2(r.vx), vy: r2(r.vy), alive: r.alive, outAt: r.outAt, dashing: r.dashT > 0,
          a: r2(Math.atan2(r.fy, r.fx)), lives: r.lives, ammo: r.ammo, invuln: r.invuln > 0,
        })),
        missiles: missiles.map((m) => ({ id: m.id, x: r2(m.x), y: r2(m.y), a: r2(m.a), team: m.team })),
        pickups: pickups.map((p) => ({ ...p, x: r2(p.x), y: r2(p.y) })),
        booms: booms.map((b) => ({ id: b.id, x: r2(b.x), y: r2(b.y), team: b.team })),
      };
    },
    done() {
      return endedAt !== null && elapsed - endedAt > 2;
    },
    scores(): TeamScore[] {
      return teamIds.map((team) => {
        const rs = runners.filter((r) => r.team === team);
        const alive = rs.filter((r) => r.alive).length;
        const lives = rs.reduce((s, r) => s + Math.max(0, r.lives), 0);
        const kills = rs.reduce((s, r) => s + r.kills, 0);
        const last = Math.max(...rs.map((r) => r.outAt ?? elapsed));
        return {
          team,
          score: (alive ? 100000 : 0) + lives * 1000 + kills * 10 + last / 1000,
          detail: alive ? `${lives} ❤️ left, ${kills} KOs` : `out at ${Math.round(last)}s, ${kills} KOs`,
        };
      });
    },
  };
}
