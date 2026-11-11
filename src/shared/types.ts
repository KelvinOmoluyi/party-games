// Types and constants shared by the server and the phone client.

export const MAX_PLAYERS = 16;
export const MAX_TEAM_SIZE = 4;
export const TICK_HZ = 30;
export const COUNTDOWN_MS = 3500;

export type TeamId = 0 | 1 | 2 | 3;

export const TEAMS: { id: TeamId; name: string; color: string; dark: string }[] = [
  { id: 0, name: "Red", color: "#ff4d5e", dark: "#7a1f29" },
  { id: 1, name: "Blue", color: "#3d8bff", dark: "#1a3d73" },
  { id: 2, name: "Green", color: "#2ecc71", dark: "#145c33" },
  { id: 3, name: "Yellow", color: "#ffc531", dark: "#735810" },
];

export type GameId =
  | "race" | "tug" | "sumo" | "quickdraw" | "tanks" | "chicken"
  | "parkour" | "ice" | "boulder" | "dynamite" | "missile";

export const GAMES: Record<GameId, { name: string; emoji: string; blurb: string; howTo: string }> = {
  race: {
    name: "Stick Sprint",
    emoji: "🏃",
    blurb: "Tap like crazy to run to the finish line.",
    howTo: "Tap the big button as fast as you can! Use two thumbs.",
  },
  tug: {
    name: "Team Tug",
    emoji: "🪢",
    blurb: "Every team pulls the knot toward their side.",
    howTo: "Tap PULL as fast as you can. Drag the knot into your team's zone!",
  },
  sumo: {
    name: "Sumo Smash",
    emoji: "💥",
    blurb: "Push everyone off the shrinking platform.",
    howTo: "Drag on the left to move. Hit DASH to slam into people. Don't fall off!",
  },
  quickdraw: {
    name: "Quick Draw",
    emoji: "⚡",
    blurb: "Wait for it... then tap faster than everyone.",
    howTo: "Tap the moment the screen says TAP! Tapping early is a false start.",
  },
  tanks: {
    name: "Tank Flag Clash",
    emoji: "🚩",
    blurb: "Steal enemy flags and drive them home in your tank.",
    howTo: "Drag to drive, FIRE to shoot. Grab an enemy flag and bring it to your base. Hit a carrier to make them drop it! (Maze map with 5+ players.)",
  },
  chicken: {
    name: "Chicken Roundup",
    emoji: "🐔",
    blurb: "Catch chickens and pack the most into your team's pen.",
    howTo: "Drag to run into chickens (carry up to 4), then drop them in your pen. DASH into enemies to knock their chickens loose! (Bigger farm with 5+ players.)",
  },
  parkour: {
    name: "Rooftop Run",
    emoji: "🏙️",
    blurb: "Free-run across the rooftops. Jump the gaps and dodge the spikes.",
    howTo: "You run on your own. Tap JUMP to leap, tap again in the air to double jump. Fall or hit spikes and you restart at the last flag!",
  },
  ice: {
    name: "Ice Boat Derby",
    emoji: "⛵",
    blurb: "Slippery sail-boat race around a frozen lake. 3 laps!",
    howTo: "Point the joystick where you want to go. Boats slide on the ice, so turn early! BOOST for a burst of speed.",
  },
  boulder: {
    name: "Boulder Rush",
    emoji: "🪨",
    blurb: "Giant boulders roll through the canyon. Don't get flattened!",
    howTo: "Watch for the red warnings at the edges, then get out of the way. DODGE rolls you through danger. Last team standing wins!",
  },
  dynamite: {
    name: "Hot Dynamite",
    emoji: "🧨",
    blurb: "Hot potato with a lit fuse. Pass it before it blows!",
    howTo: "If you're holding the dynamite, run into someone to pass it on. Whoever holds it when it explodes is out!",
  },
  missile: {
    name: "Missile Mayhem",
    emoji: "🚀",
    blurb: "Grab missile ammo and blast the other teams. 3 lives each.",
    howTo: "Run over 🚀 crates to pick up missiles, then FIRE. You have 3 lives. Rare ❤️ pickups give one back!",
  },
};

export const GAME_IDS = Object.keys(GAMES) as GameId[];

export interface PlayerInfo {
  id: string;
  name: string;
  team: TeamId;
  connected: boolean;
}

export type Phase = "lobby" | "countdown" | "playing" | "results";

export interface TeamRank {
  team: TeamId;
  place: number; // 1-based, ties share a place
  points: number;
  detail: string;
}

export interface RoundResult {
  gameId: GameId;
  ranking: TeamRank[];
}

// ---- Per-game state that the server broadcasts ----

export interface RaceState {
  kind: "race";
  timeLeft: number;
  finish: number;
  runners: { id: string; team: TeamId; dist: number; speed: number; finishedAt: number | null }[];
}

export interface TugState {
  kind: "tug";
  timeLeft: number;
  radius: number;
  knot: { x: number; y: number };
  teams: { team: TeamId; angle: number; members: string[] }[];
  winner: TeamId | null;
  pulls: Record<string, number>; // recent pull "energy" per player, for animation
}

export interface SumoFighter {
  id: string;
  team: TeamId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  fellAt: number | null;
  dashing: boolean;
  dashReady: number; // 0..1
}

export interface SumoState {
  kind: "sumo";
  timeLeft: number;
  arenaR: number;
  fighters: SumoFighter[];
}

export interface QuickDrawState {
  kind: "quickdraw";
  roundNo: number;
  totalRounds: number;
  stage: "wait" | "go" | "reveal";
  goId: number;
  // ms reaction, -1 = false start, null = no answer yet
  current: Record<string, number | null>;
  totals: Record<string, number>;
  participants: { id: string; team: TeamId }[];
}

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TankState {
  kind: "tanks";
  timeLeft: number;
  w: number;
  h: number;
  walls: Wall[];
  bases: { team: TeamId; x: number; y: number }[];
  tanks: {
    id: string;
    team: TeamId;
    x: number;
    y: number;
    a: number;
    alive: boolean;
    respawnIn: number;
    shield: boolean;
    flag: TeamId | null;
  }[];
  bullets: { id: number; x: number; y: number; a: number; team: TeamId }[];
  flags: { team: TeamId; x: number; y: number; carrier: string | null; home: boolean }[];
  caps: Record<number, number>;
  kills: Record<number, number>;
}

export interface ChickenState {
  kind: "chicken";
  timeLeft: number;
  w: number;
  h: number;
  pens: { team: TeamId; x: number; y: number; r: number }[];
  runners: {
    id: string;
    team: TeamId;
    x: number;
    y: number;
    vx: number;
    vy: number;
    carrying: number;
    stunned: boolean;
    dashing: boolean;
  }[];
  chickens: { id: number; x: number; y: number; penned: boolean; flap: boolean }[];
  penned: Record<number, number>;
}

export interface ParkourState {
  kind: "parkour";
  timeLeft: number;
  seed: number; // the course is rebuilt from this on every phone
  runners: {
    id: string;
    team: TeamId;
    x: number;
    y: number; // feet
    vy: number;
    grounded: boolean;
    dead: boolean;
    finishedAt: number | null;
    cp: number; // checkpoint reached
  }[];
}

export interface IceTrack {
  cx: number;
  cy: number;
  a: number; // half length of the straights
  R: number; // radius of the centre line at the ends
  hw: number; // half track width
}

export interface IceState {
  kind: "ice";
  timeLeft: number;
  w: number;
  h: number;
  track: IceTrack;
  laps: number;
  obstacles: { x: number; y: number; r: number }[];
  boats: {
    id: string;
    team: TeamId;
    x: number;
    y: number;
    a: number;
    vx: number;
    vy: number;
    progress: number; // laps done, fractional
    finishedAt: number | null;
    boosting: boolean;
  }[];
}

export interface ArenaRunner {
  id: string;
  team: TeamId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  outAt: number | null;
  dashing: boolean;
}

export interface BoulderState {
  kind: "boulder";
  timeLeft: number;
  w: number;
  h: number;
  runners: ArenaRunner[];
  boulders: { id: number; x: number; y: number; vx: number; vy: number; r: number }[];
  warnings: { id: number; x: number; y: number; a: number; r: number }[];
}

export interface DynamiteState {
  kind: "dynamite";
  timeLeft: number;
  w: number;
  h: number;
  runners: ArenaRunner[];
  holder: string | null;
  fuse: number; // seconds left
  fuseMax: number;
  boom: { id: number; x: number; y: number; victim: string } | null;
}

export interface MissileState {
  kind: "missile";
  timeLeft: number;
  w: number;
  h: number;
  walls: Wall[];
  runners: (ArenaRunner & { a: number; lives: number; ammo: number; invuln: boolean })[];
  missiles: { id: number; x: number; y: number; a: number; team: TeamId }[];
  pickups: { id: number; x: number; y: number; type: "ammo" | "health" }[];
  booms: { id: number; x: number; y: number; team: TeamId }[];
}

export type GameState =
  | RaceState | TugState | SumoState | QuickDrawState | TankState | ChickenState
  | ParkourState | IceState | BoulderState | DynamiteState | MissileState;

/** Corner bases for arena games, assigned in order of the teams playing. */
export function cornerFor(index: number, count: number, w: number, h: number, inset: number) {
  const order = count === 2 ? [0, 2] : count === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  const c = order[index] ?? index;
  const corners = [
    { x: inset, y: inset },
    { x: w - inset, y: inset },
    { x: w - inset, y: h - inset },
    { x: inset, y: h - inset },
  ];
  return corners[c % 4];
}

export interface RoomState {
  phase: Phase;
  players: PlayerInfo[];
  hostId: string | null;
  scores: number[]; // indexed by TeamId
  round: number;
  gameId: GameId | null;
  participants: string[];
  countdown: number; // ms left
  game: GameState | null;
  result: RoundResult | null;
  joinUrls: string[];
}

// ---- Inputs from phones ----
export type GameInput =
  | { type: "tap" }
  | { type: "move"; x: number; y: number }
  | { type: "action" }
  | { type: "early" }
  | { type: "react"; goId: number; ms: number };
