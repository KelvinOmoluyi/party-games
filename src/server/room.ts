import type { Server, Socket } from "socket.io";
import {
  COUNTDOWN_MS,
  GAME_IDS,
  type GameId,
  type GameInput,
  MAX_PLAYERS,
  MAX_TEAM_SIZE,
  type Phase,
  type PlayerInfo,
  type RoomState,
  type RoundResult,
  TEAMS,
  type TeamId,
  TICK_HZ,
} from "../shared/types";
import { createBoulder } from "./games/boulder";
import { createChicken } from "./games/chicken";
import { createDynamite } from "./games/dynamite";
import type { Game, GameFactory } from "./games/game";
import { createIce } from "./games/ice";
import { createMissile } from "./games/missile";
import { createParkour } from "./games/parkour";
import { createQuickDraw } from "./games/quickdraw";
import { createRace } from "./games/race";
import { createSumo } from "./games/sumo";
import { createTanks } from "./games/tanks";
import { createTug } from "./games/tug";

const FACTORIES: Record<GameId, GameFactory> = {
  race: createRace,
  tug: createTug,
  sumo: createSumo,
  quickdraw: createQuickDraw,
  tanks: createTanks,
  chicken: createChicken,
  parkour: createParkour,
  ice: createIce,
  boulder: createBoulder,
  dynamite: createDynamite,
  missile: createMissile,
};

const POINTS_BY_PLACE = [3, 2, 1, 0];

interface Player extends PlayerInfo {
  socketId: string | null;
  joinedAt: number;
}

export class Room {
  private players = new Map<string, Player>();
  private socketToPlayer = new Map<string, string>();
  private hostId: string | null = null;
  private phase: Phase = "lobby";
  private scores = [0, 0, 0, 0];
  private round = 0;
  private gameId: GameId | null = null;
  private game: Game | null = null;
  private participants: string[] = [];
  private countdownMs = 0;
  private result: RoundResult | null = null;
  private lastPlayed: GameId | null = null;
  private dirty = true;

  constructor(
    private io: Server,
    private joinUrls: string[],
  ) {
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.tick(dt);
    }, 1000 / TICK_HZ);
  }

  attach(socket: Socket) {
    socket.emit("state", this.snapshot());

    socket.on("join", (data: { id?: string; name?: string }) => {
      const id = String(data?.id ?? "").slice(0, 64);
      const name = String(data?.name ?? "").trim().slice(0, 16) || "Player";
      if (!id) return;
      let p = this.players.get(id);
      if (!p) {
        if (this.players.size >= MAX_PLAYERS) {
          socket.emit("joinError", `Room is full (${MAX_PLAYERS} players max).`);
          return;
        }
        p = { id, name, team: this.smallestTeam(), connected: true, socketId: socket.id, joinedAt: Date.now() };
        this.players.set(id, p);
      }
      // Same player reconnecting (e.g. phone screen turned off)
      if (p.socketId && p.socketId !== socket.id) this.socketToPlayer.delete(p.socketId);
      p.socketId = socket.id;
      p.connected = true;
      p.name = name;
      this.socketToPlayer.set(socket.id, id);
      if (!this.hostId || !this.players.get(this.hostId)?.connected) this.hostId = id;
      socket.emit("joined", id);
      this.dirty = true;
    });

    socket.on("setTeam", (team: number) => {
      const p = this.playerFor(socket);
      if (!p || this.phase !== "lobby" || ![0, 1, 2, 3].includes(team)) return;
      if (this.teamCount(team as TeamId) >= MAX_TEAM_SIZE) return;
      p.team = team as TeamId;
      this.dirty = true;
    });

    socket.on("rename", (name: string) => {
      const p = this.playerFor(socket);
      if (!p) return;
      p.name = String(name ?? "").trim().slice(0, 16) || p.name;
      this.dirty = true;
    });

    socket.on("startGame", (which: GameId | "random") => {
      if (!this.isHost(socket) || (this.phase !== "lobby" && this.phase !== "results")) return;
      const ready = [...this.players.values()].filter((p) => p.connected);
      if (ready.length === 0) return;
      let id: GameId;
      if (which === "random" || !GAME_IDS.includes(which)) {
        const options = GAME_IDS.filter((g) => g !== this.lastPlayed);
        id = options[Math.floor(Math.random() * options.length)];
      } else id = which;
      this.gameId = id;
      this.lastPlayed = id;
      this.participants = ready.map((p) => p.id);
      this.game = FACTORIES[id](ready.map(({ id, name, team, connected }) => ({ id, name, team, connected })));
      this.result = null;
      this.phase = "countdown";
      this.countdownMs = COUNTDOWN_MS;
      this.round++;
      this.dirty = true;
    });

    socket.on("input", (msg: GameInput) => {
      const p = this.playerFor(socket);
      if (!p || !this.game || this.phase !== "playing" || !msg || typeof msg !== "object") return;
      this.game.input(p.id, msg);
    });

    socket.on("backToLobby", () => {
      if (!this.isHost(socket)) return;
      this.phase = "lobby";
      this.game = null;
      this.gameId = null;
      this.dirty = true;
    });

    socket.on("resetScores", () => {
      if (!this.isHost(socket) || this.phase !== "lobby") return;
      this.scores = [0, 0, 0, 0];
      this.round = 0;
      this.dirty = true;
    });

    socket.on("kick", (id: string) => {
      if (!this.isHost(socket) || this.phase !== "lobby") return;
      const p = this.players.get(id);
      if (!p || id === this.hostId) return;
      if (p.socketId) {
        this.io.to(p.socketId).emit("kicked");
        this.socketToPlayer.delete(p.socketId);
      }
      this.players.delete(id);
      this.dirty = true;
    });

    socket.on("makeHost", (id: string) => {
      if (!this.isHost(socket) || !this.players.get(id)?.connected) return;
      this.hostId = id;
      this.dirty = true;
    });

    socket.on("leave", () => {
      const p = this.playerFor(socket);
      if (!p) return;
      this.socketToPlayer.delete(socket.id);
      this.players.delete(p.id);
      if (this.hostId === p.id) this.pickNewHost();
      this.dirty = true;
    });

    socket.on("disconnect", () => {
      const p = this.playerFor(socket);
      this.socketToPlayer.delete(socket.id);
      if (!p || p.socketId !== socket.id) return;
      p.connected = false;
      p.socketId = null;
      if (this.hostId === p.id) this.pickNewHost();
      this.dirty = true;
    });
  }

  private tick(dt: number) {
    if (this.phase === "countdown") {
      this.countdownMs -= dt * 1000;
      if (this.countdownMs <= 0) this.phase = "playing";
      this.dirty = true;
    } else if (this.phase === "playing" && this.game) {
      this.game.update(dt);
      if (this.game.done()) this.finishRound();
      this.dirty = true;
    }
    if (this.dirty) {
      this.dirty = false;
      this.io.emit("state", this.snapshot());
    }
  }

  private finishRound() {
    const scores = this.game!.scores().sort((a, b) => b.score - a.score);
    const ranking = scores.map((s, i) => {
      // ties share the better place
      let place = i + 1;
      for (let k = i - 1; k >= 0 && Math.abs(scores[k].score - s.score) < 1e-6; k--) place = k + 1;
      const points = scores.length > 1 ? POINTS_BY_PLACE[place - 1] ?? 0 : 0;
      return { team: s.team, place, points, detail: s.detail };
    });
    for (const r of ranking) this.scores[r.team] += r.points;
    this.result = { gameId: this.gameId!, ranking };
    this.phase = "results";
  }

  private snapshot(): RoomState {
    return {
      phase: this.phase,
      players: [...this.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map(({ id, name, team, connected }) => ({ id, name, team, connected })),
      hostId: this.hostId,
      scores: this.scores,
      round: this.round,
      gameId: this.gameId,
      participants: this.participants,
      countdown: Math.max(0, Math.round(this.countdownMs)),
      game: this.game && this.phase !== "lobby" ? this.game.state() : null,
      result: this.result,
      joinUrls: this.joinUrls,
    };
  }

  private playerFor(socket: Socket) {
    const id = this.socketToPlayer.get(socket.id);
    return id ? this.players.get(id) : undefined;
  }

  private isHost(socket: Socket) {
    return !!this.hostId && this.socketToPlayer.get(socket.id) === this.hostId;
  }

  private pickNewHost() {
    const next = [...this.players.values()].filter((p) => p.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    this.hostId = next?.id ?? null;
  }

  private teamCount(team: TeamId) {
    return [...this.players.values()].filter((p) => p.team === team).length;
  }

  private smallestTeam(): TeamId {
    return TEAMS.map((t) => t.id).sort((a, b) => this.teamCount(a) - this.teamCount(b))[0];
  }
}
