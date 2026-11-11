import type { GameInput, PlayerInfo, QuickDrawState } from "../../shared/types";
import { type Game, type TeamScore, mean, teamsOf } from "./game";

const ROUNDS = 3;
const FALSE_START_MS = 1000;
const NO_ANSWER_MS = 1000;
const GO_WINDOW = 2; // seconds to answer
const REVEAL_TIME = 2.8;

export function createQuickDraw(players: PlayerInfo[]): Game {
  const participants = players.map((p) => ({ id: p.id, team: p.team }));
  const totals: Record<string, number> = Object.fromEntries(participants.map((p) => [p.id, 0]));
  let current: Record<string, number | null> = {};
  let roundNo = 0;
  let stage: QuickDrawState["stage"] = "wait";
  let stageT = 0;
  let waitFor = 0;
  let goId = 0;
  let finished = false;

  const startRound = () => {
    roundNo++;
    stage = "wait";
    stageT = 0;
    waitFor = 2 + Math.random() * 3.5;
    current = Object.fromEntries(participants.map((p) => [p.id, null]));
  };
  startRound();

  const allAnswered = () => participants.every((p) => current[p.id] !== null);

  const reveal = () => {
    for (const p of participants) {
      const v = current[p.id];
      if (v === null) current[p.id] = NO_ANSWER_MS;
      totals[p.id] += v === -1 ? FALSE_START_MS : (current[p.id] as number);
    }
    stage = "reveal";
    stageT = 0;
  };

  return {
    update(dt) {
      if (finished) {
        stageT += dt;
        return;
      }
      stageT += dt;
      if (stage === "wait" && (stageT >= waitFor || allAnswered())) {
        if (allAnswered()) reveal(); // everyone false-started
        else {
          stage = "go";
          stageT = 0;
          goId = Math.floor(Math.random() * 1e9);
        }
      } else if (stage === "go" && (stageT >= GO_WINDOW || allAnswered())) {
        reveal();
      } else if (stage === "reveal" && stageT >= REVEAL_TIME) {
        if (roundNo >= ROUNDS) {
          finished = true;
          stageT = 0;
        } else startRound();
      }
    },
    input(id, msg: GameInput) {
      if (!(id in totals) || current[id] !== null) return;
      if (msg.type === "early" && stage === "wait") current[id] = -1;
      else if (msg.type === "react" && stage === "go" && msg.goId === goId) {
        current[id] = Math.max(1, Math.min(NO_ANSWER_MS, Math.round(Number(msg.ms) || NO_ANSWER_MS)));
      }
    },
    state(): QuickDrawState {
      return {
        kind: "quickdraw",
        roundNo,
        totalRounds: ROUNDS,
        stage,
        goId,
        current,
        totals,
        participants,
      };
    },
    done() {
      return finished;
    },
    scores(): TeamScore[] {
      return teamsOf(participants).map((team) => {
        const avg = mean(participants.filter((p) => p.team === team).map((p) => totals[p.id] / ROUNDS));
        return { team, score: -avg, detail: `avg ${Math.round(avg)}ms` };
      });
    },
  };
}
