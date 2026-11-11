import type { GameInput, GameState, PlayerInfo, TeamId } from "../../shared/types";

export interface TeamScore {
  team: TeamId;
  score: number; // higher is better
  detail: string;
}

export interface Game {
  update(dt: number): void;
  input(playerId: string, msg: GameInput): void;
  state(): GameState;
  done(): boolean;
  /** One entry per team that took part. Higher score wins. */
  scores(): TeamScore[];
}

export type GameFactory = (players: PlayerInfo[]) => Game;

export function teamsOf(players: { team: TeamId }[]): TeamId[] {
  return [...new Set(players.map((p) => p.team))].sort() as TeamId[];
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
