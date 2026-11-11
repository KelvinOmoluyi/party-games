"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GAME_IDS, GAMES, MAX_TEAM_SIZE, type RoomState, TEAMS } from "../shared/types";
import { Avatar, GameThumb, Hero, Podium } from "./Art";
import { StickControls, TapPad } from "./Controls";
import { BoulderView } from "./games/BoulderView";
import { ChickenView } from "./games/ChickenView";
import { DynamiteView } from "./games/DynamiteView";
import { IceView } from "./games/IceView";
import { MissileView } from "./games/MissileView";
import { ParkourView } from "./games/ParkourView";
import { QuickDrawView } from "./games/QuickDrawView";
import { RaceView } from "./games/RaceView";
import { SumoView } from "./games/SumoView";
import { TanksView } from "./games/TanksView";
import { TugView } from "./games/TugView";
import { sound } from "./sound";
import { type RoomApi, savedName } from "./useRoom";

// ---------- small shared bits ----------

function useSoundState() {
  return useSyncExternalStore(
    (cb) => sound.subscribe(cb),
    () => `${sound.sfxOn ? 1 : 0}${sound.musicOn ? 1 : 0}`,
    () => "11",
  );
}

async function toggleFullscreen(landscape: boolean) {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
      if (landscape) await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape");
    } else {
      await document.exitFullscreen?.();
    }
  } catch {
    /* iPhone Safari has no fullscreen API; that's fine */
  }
}

export function Toggles({ landscape = false }: { landscape?: boolean }) {
  useSoundState();
  return (
    <div className="toggles">
      <button className={`icon-btn ${sound.sfxOn ? "" : "off"}`} title="Sound effects" onClick={() => sound.setSfx(!sound.sfxOn)}>
        {sound.sfxOn ? "🔊" : "🔇"}
      </button>
      <button className={`icon-btn ${sound.musicOn ? "" : "off"}`} title="Music" onClick={() => sound.setMusic(!sound.musicOn)}>
        🎵
      </button>
      <button className="icon-btn" title="Fullscreen" onClick={() => toggleFullscreen(landscape)}>
        ⛶
      </button>
    </div>
  );
}

function click() {
  sound.unlock();
  sound.play("click");
}

export function Invite({ urls }: { urls: string[] }) {
  const [qr, setQr] = useState<string | null>(null);
  const url = urls[0];
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#1d1530", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);
  if (!url) return null;
  return (
    <div className="card invite">
      {qr && <img src={qr} alt="QR code to join" width={104} height={104} />}
      <div>
        <div className="muted small">Friends on the same Wi-Fi: scan or open</div>
        <div className="url">{url}</div>
        {urls.slice(1).map((u) => (
          <div key={u} className="muted small">
            or {u}
          </div>
        ))}
      </div>
    </div>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <h1 className={`logo ${small ? "small" : ""}`}>
      <span className="logo-a">STICK</span>
      <span className="logo-b">PARTY</span>
    </h1>
  );
}

// ---------- screens ----------

export function JoinScreen({ api }: { api: RoomApi }) {
  const [name, setName] = useState("");
  useEffect(() => setName(savedName()), []);
  const players = api.state?.players ?? [];
  return (
    <div className="page join-page">
      <div className="topbar end">
        <Toggles />
      </div>
      <Logo />
      <div className="tagline">Team mini-games for up to 16 players</div>
      <Hero />
      <form
        className="card join"
        onSubmit={(e) => {
          e.preventDefault();
          sound.unlock();
          if (name.trim()) {
            api.join(name.trim());
            sound.play("join");
          }
        }}
      >
        <label htmlFor="name">What should we call you?</label>
        <input id="name" value={name} maxLength={16} autoComplete="off" placeholder="Your name" onChange={(e) => setName(e.target.value)} />
        <button className="btn primary big" disabled={!name.trim() || !api.connected}>
          {api.connected ? "LET'S PLAY!" : "Connecting…"}
        </button>
        {api.error && <div className="error">{api.error}</div>}
      </form>
      {players.length > 0 && (
        <div className="in-room">
          <span className="muted small">{players.length} in the room:</span>
          {players.map((p) => (
            <span key={p.id} className="chip-name" style={{ background: TEAMS[p.team].color }}>
              {p.name}
            </span>
          ))}
        </div>
      )}
      {api.state && <Invite urls={api.state.joinUrls} />}
    </div>
  );
}

function Scoreboard({ state }: { state: RoomState }) {
  const teams = TEAMS.filter((t) => state.players.some((p) => p.team === t.id) || state.scores[t.id] > 0);
  const max = Math.max(1, ...teams.map((t) => state.scores[t.id]));
  const leaders = teams.filter((t) => state.scores[t.id] === max);
  return (
    <div className="scoreboard">
      {[...teams]
        .sort((a, b) => state.scores[b.id] - state.scores[a.id])
        .map((t) => (
          <div key={t.id} className="score-row">
            <span className="score-name" style={{ color: t.color }}>
              {leaders.length === 1 && leaders[0].id === t.id && max > 0 ? "👑 " : ""}
              {t.name}
            </span>
            <div className="score-bar">
              <div style={{ width: `${(state.scores[t.id] / max) * 100}%`, background: t.color }} />
            </div>
            <span className="score-num">{state.scores[t.id]}</span>
          </div>
        ))}
    </div>
  );
}

export function Lobby({ api, state }: { api: RoomApi; state: RoomState }) {
  const me = state.players.find((p) => p.id === api.myId);
  const isHost = state.hostId === api.myId;
  const host = state.players.find((p) => p.id === state.hostId);
  const [showInvite, setShowInvite] = useState(state.players.length < 2);
  const count = useRef(state.players.length);
  useEffect(() => {
    if (state.players.length > count.current) sound.play("join");
    count.current = state.players.length;
  }, [state.players.length]);

  return (
    <div className="page lobby">
      <div className="topbar">
        <Logo small />
        <div className="row-tight">
          <button className="btn ghost small" onClick={() => (click(), setShowInvite((s) => !s))}>
            {showInvite ? "Hide invite" : "📲 Invite"}
          </button>
          <Toggles />
        </div>
      </div>
      {showInvite && <Invite urls={state.joinUrls} />}

      <div className="section-title">
        Pick your team <span className="muted small">(up to {MAX_TEAM_SIZE} each)</span>
      </div>
      <div className="teams">
        {TEAMS.map((t) => {
          const members = state.players.filter((p) => p.team === t.id);
          const mine = me?.team === t.id;
          const full = members.length >= MAX_TEAM_SIZE;
          return (
            <button
              key={t.id}
              className={`team ${mine ? "mine" : ""}`}
              style={{ "--team": t.color, "--team-dark": t.dark } as React.CSSProperties}
              onClick={() => {
                if (!mine && !full) {
                  click();
                  api.emit("setTeam", t.id);
                }
              }}
            >
              <div className="team-head">
                <span className="team-name">{t.name}</span>
                <span className="team-score">{state.scores[t.id]} pts</span>
              </div>
              <div className="members">
                {members.map((p) => (
                  <div key={p.id} className={`member ${p.connected ? "" : "offline"}`}>
                    <Avatar team={t.id} size={30} />
                    <span className="member-name">
                      {p.id === state.hostId && "👑 "}
                      {p.name}
                      {p.id === api.myId && <span className="you"> you</span>}
                      {!p.connected && " 💤"}
                    </span>
                    {isHost && p.id !== api.myId && (
                      <span
                        role="button"
                        className="x"
                        title="Remove player"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove ${p.name}?`)) api.emit("kick", p.id);
                        }}
                      >
                        ✕
                      </span>
                    )}
                  </div>
                ))}
                {Array.from({ length: MAX_TEAM_SIZE - members.length }).map((_, i) => (
                  <div key={i} className="member empty">
                    <span className="slot" />
                    {i === 0 && !mine && <span className="muted small">Tap to join</span>}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {state.round > 0 && (
        <>
          <div className="section-title">
            Scores after {state.round} round{state.round === 1 ? "" : "s"}
          </div>
          <Scoreboard state={state} />
        </>
      )}

      {isHost ? (
        <>
          <div className="section-title">You&apos;re the host 👑 Pick a game</div>
          <div className="games">
            {GAME_IDS.map((g) => (
              <button key={g} className="game-card" onClick={() => (click(), api.emit("startGame", g))}>
                <GameThumb id={g} />
                <span className="game-name">
                  {GAMES[g].emoji} {GAMES[g].name}
                </span>
                <span className="game-blurb">{GAMES[g].blurb}</span>
              </button>
            ))}
            <button className="game-card random" onClick={() => (click(), api.emit("startGame", "random"))}>
              <span className="dice">🎲</span>
              <span className="game-name">Surprise me!</span>
              <span className="game-blurb">Random game</span>
            </button>
          </div>
          {state.round > 0 && (
            <button className="btn ghost small" onClick={() => confirm("Reset all team scores to 0?") && api.emit("resetScores")}>
              Reset scores
            </button>
          )}
        </>
      ) : (
        <div className="card center waiting">
          <div className="waiting-dots">
            <span />
            <span />
            <span />
          </div>
          Waiting for <b>{host?.name ?? "the host"}</b> to start a game
        </div>
      )}

      <button className="btn ghost small leave" onClick={() => confirm("Leave the party?") && api.leave()}>
        Leave
      </button>
    </div>
  );
}

function Countdown({ ms, gameId, team }: { ms: number; gameId: keyof typeof GAMES; team?: (typeof TEAMS)[number] }) {
  const n = Math.max(1, Math.ceil(ms / 1000));
  const last = useRef(0);
  useEffect(() => {
    if (n !== last.current) {
      last.current = n;
      sound.play("beep", { minGap: 0 });
    }
  }, [n]);
  const info = GAMES[gameId];
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="overlay-title">
          {info.emoji} {info.name}
        </div>
        <div className="overlay-how">{info.howTo}</div>
        {team && (
          <div className="overlay-team" style={{ background: team.color }}>
            You&apos;re on {team.name}!
          </div>
        )}
      </div>
      <div key={n} className="countdown">
        {n}
      </div>
    </div>
  );
}

const isTouchPhone = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function readOrientation() {
  if (typeof window === "undefined") return { rotate: false, landscape: false };
  const portrait = window.innerHeight > window.innerWidth;
  const rotate = portrait && isTouchPhone();
  return { rotate, landscape: !portrait || rotate };
}

/**
 * Games always play in landscape on phones. If the phone is held upright we turn the
 * game screen sideways in CSS (works everywhere, even with auto-rotate off). On Android
 * the first touch also goes fullscreen and locks real landscape, hiding the browser bars.
 */
function useGameOrientation() {
  const [o, setO] = useState(readOrientation);
  useEffect(() => {
    const update = () => setO(readOrientation());
    window.addEventListener("resize", update);
    screen.orientation?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("resize", update);
      screen.orientation?.removeEventListener?.("change", update);
    };
  }, []);

  useEffect(() => {
    if (!isTouchPhone()) return;
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };
    const onFirstTouch = async () => {
      window.removeEventListener("pointerdown", onFirstTouch, true);
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        }
        await orientation.lock?.("landscape");
      } catch {
        /* iPhone Safari can't do either; the CSS rotation covers it */
      }
    };
    window.addEventListener("pointerdown", onFirstTouch, true);
    return () => {
      window.removeEventListener("pointerdown", onFirstTouch, true);
      // Back to menus: let the phone rotate freely again (we stay fullscreen).
      try {
        orientation.unlock?.();
      } catch {}
    };
  }, []);
  return o;
}

export function GameScreen({ api, state }: { api: RoomApi; state: RoomState }) {
  const g = state.game;
  const me = state.players.find((p) => p.id === api.myId);
  const canPlay = !!me && state.participants.includes(me.id);
  const isHost = state.hostId === api.myId;
  const team = me ? TEAMS[me.team] : TEAMS[0];
  const { rotate, landscape } = useGameOrientation();
  const wasCountdown = useRef(state.phase === "countdown");
  useEffect(() => {
    if (wasCountdown.current && state.phase === "playing" && state.gameId !== "quickdraw") sound.play("go");
    wasCountdown.current = state.phase === "countdown";
  }, [state.phase, state.gameId]);

  if (!g || !state.gameId) return null;
  const info = GAMES[state.gameId];
  const timeLeft = "timeLeft" in g ? Math.ceil(g.timeLeft) : null;
  const props = { players: state.players, myId: api.myId };

  let view: React.ReactNode;
  let controls: React.ReactNode = null;
  const send = state.phase === "playing" ? api.send : () => {};
  switch (g.kind) {
    case "race":
      view = <RaceView game={g} {...props} />;
      controls = <TapPad label="RUN!" color={team.color} send={send} />;
      break;
    case "tug":
      view = <TugView game={g} {...props} />;
      controls = <TapPad label="PULL!" color={team.color} send={send} />;
      break;
    case "sumo":
      view = <SumoView game={g} {...props} />;
      controls = <StickControls action="DASH" icon="💨" color={team.color} send={send} rotated={rotate} />;
      break;
    case "tanks":
      view = <TanksView game={g} {...props} />;
      controls = <StickControls action="FIRE" icon="💥" color={team.color} send={send} rotated={rotate} />;
      break;
    case "chicken":
      view = <ChickenView game={g} {...props} />;
      controls = <StickControls action="DASH" icon="💨" color={team.color} send={send} rotated={rotate} />;
      break;
    case "quickdraw":
      view = <QuickDrawView game={g} {...props} send={send} canPlay={canPlay && state.phase === "playing"} />;
      break;
    case "parkour":
      view = <ParkourView game={g} {...props} />;
      controls = <TapPad label="JUMP!" color={team.color} send={send} />;
      break;
    case "ice":
      view = <IceView game={g} {...props} />;
      controls = <StickControls action="BOOST" icon="⚡" color={team.color} send={send} rotated={rotate} />;
      break;
    case "boulder":
      view = <BoulderView game={g} {...props} />;
      controls = <StickControls action="DODGE" icon="🌀" color={team.color} send={send} rotated={rotate} />;
      break;
    case "dynamite":
      view = <DynamiteView game={g} {...props} />;
      controls = <StickControls action="DASH" icon="💨" color={team.color} send={send} rotated={rotate} />;
      break;
    case "missile": {
      view = <MissileView game={g} {...props} />;
      const mine = g.runners.find((r) => r.id === api.myId);
      controls = (
        <StickControls action="FIRE" icon="🚀" color={team.color} send={send} rotated={rotate} badge={String(mine?.ammo ?? 0)} disabled={!mine || mine.ammo === 0} />
      );
      break;
    }
  }

  let chips: React.ReactNode = null;
  if (g.kind === "tanks") {
    chips = g.bases.map((b) => (
      <span key={b.team} className="chip" style={{ background: TEAMS[b.team].color }}>
        🚩 {g.caps[b.team] ?? 0}
      </span>
    ));
  } else if (g.kind === "chicken") {
    chips = g.pens.map((p) => (
      <span key={p.team} className="chip" style={{ background: TEAMS[p.team].color }}>
        🐔 {g.penned[p.team] ?? 0}
      </span>
    ));
  } else if (g.kind === "quickdraw") {
    chips = (
      <span className="chip neutral">
        Round {g.roundNo}/{g.totalRounds}
      </span>
    );
  } else if (g.kind === "ice") {
    const mine = g.boats.find((b) => b.id === api.myId);
    if (mine) {
      const place = [...g.boats].sort((a, b) => b.progress - a.progress).findIndex((b) => b.id === mine.id) + 1;
      const lap = Math.min(g.laps, Math.max(1, Math.floor(mine.progress) + 1));
      chips = (
        <>
          <span className="chip neutral">
            Lap {lap}/{g.laps}
          </span>
          <span className="chip" style={{ background: team.color }}>
            #{place}
          </span>
        </>
      );
    }
  } else if (g.kind === "boulder" || g.kind === "dynamite" || g.kind === "missile") {
    // players still in, per team
    const teamsIn = [...new Set(g.runners.map((r) => r.team))].sort();
    chips = teamsIn.map((t) => (
      <span key={t} className="chip" style={{ background: TEAMS[t].color }}>
        {g.kind === "missile" ? "❤" : "👤"} {g.kind === "missile" ? g.runners.filter((r) => r.team === t).reduce((n, r) => n + Math.max(0, r.lives), 0) : g.runners.filter((r) => r.team === t && r.alive).length}
      </span>
    ));
  }

  return (
    <div className={`game-screen kind-${g.kind} ${landscape ? "ls" : ""} ${rotate ? "rot" : ""}`}>
      <div className="stage">
        {view}
        <div className="hud">
          <div className="hud-left">
            <span className="hud-title">
              {info.emoji} <span className="hide-narrow">{info.name}</span>
            </span>
            {me && <span className="hud-team" style={{ background: team.color }} title={`You're on ${team.name}`} />}
          </div>
          {timeLeft !== null && <div className={`timer ${timeLeft <= 5 ? "hurry" : ""}`}>{timeLeft}</div>}
          <div className="hud-right">
            <span className="chips">{chips}</span>
            <Toggles landscape />
            {isHost && (
              <button className="icon-btn" title="End game" onClick={() => confirm("End this game and go back to the lobby? (no points)") && api.emit("backToLobby")}>
                ✕
              </button>
            )}
          </div>
        </div>
        {state.phase === "countdown" && <Countdown ms={state.countdown} gameId={state.gameId} team={me ? team : undefined} />}
        {!api.connected && <div className="reconnecting">Reconnecting…</div>}
      </div>
      {canPlay ? controls : g.kind !== "quickdraw" && <div className="controls spectate">👀 Spectating. You&apos;ll play in the next game.</div>}
    </div>
  );
}

export function ResultsScreen({ api, state }: { api: RoomApi; state: RoomState }) {
  const r = state.result;
  const isHost = state.hostId === api.myId;
  const me = state.players.find((p) => p.id === api.myId);
  const played = useRef(false);
  const myRank = r?.ranking.find((x) => x.team === me?.team);
  useEffect(() => {
    if (played.current || !r || r.ranking.length < 2) return;
    played.current = true;
    sound.play(myRank?.place === 1 ? "win" : "lose");
  }, [r, myRank]);
  if (!r) return null;
  const info = GAMES[r.gameId];
  const medal = ["🥇", "🥈", "🥉", "4th"];
  const winner = r.ranking[0];
  return (
    <div className="page results">
      <div className="topbar">
        <div className="muted">
          {info.emoji} {info.name} · round {state.round}
        </div>
        <Toggles />
      </div>
      {winner && (
        <h1 className="winner" style={{ color: TEAMS[winner.team].color }}>
          {r.ranking.length > 1 ? `${TEAMS[winner.team].name} wins!` : "Practice round done!"}
        </h1>
      )}
      {myRank && r.ranking.length > 1 && (
        <div className="my-result">{myRank.place === 1 ? "🎉 Your team won! 🎉" : `Your team came ${["1st", "2nd", "3rd", "4th"][myRank.place - 1]}`}</div>
      )}
      <Podium ranking={r.ranking} />
      <div className="ranking">
        {r.ranking.map((t) => (
          <div key={t.team} className="rank-row" style={{ borderColor: TEAMS[t.team].color }}>
            <span className="rank-medal">{medal[t.place - 1]}</span>
            <span className="rank-team" style={{ color: TEAMS[t.team].color }}>
              {TEAMS[t.team].name}
              <span className="rank-detail"> {t.detail}</span>
            </span>
            <span className="rank-pts">+{t.points}</span>
          </div>
        ))}
      </div>
      <div className="section-title">Total score</div>
      <Scoreboard state={state} />
      {isHost ? (
        <div className="row">
          <button className="btn primary big" onClick={() => (click(), api.emit("backToLobby"))}>
            Next game
          </button>
          <button className="btn big" onClick={() => (click(), api.emit("startGame", r.gameId))}>
            Rematch
          </button>
        </div>
      ) : (
        <div className="card center waiting">Waiting for the host…</div>
      )}
    </div>
  );
}
