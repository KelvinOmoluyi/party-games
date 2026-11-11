"use client";

import { useEffect } from "react";
import { GameScreen, JoinScreen, Lobby, ResultsScreen } from "../client/Screens";
import { sound } from "../client/sound";
import { useRoom } from "../client/useRoom";

export default function Home() {
  const api = useRoom();
  const { state, myId } = api;

  // Phones only allow audio after a touch, so unlock on every first touch/key.
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Background music: chill in menus, upbeat in games, silence for the Quick Draw showdown.
  const phase = state?.phase;
  const gameId = state?.gameId;
  useEffect(() => {
    if (!phase) return;
    if (phase === "playing" || phase === "countdown") sound.music(gameId === "quickdraw" ? null : "game");
    else sound.music("lobby");
  }, [phase, gameId]);

  if (!state) {
    return (
      <div className="page center loading">
        <h1 className="logo">
          <span className="logo-a">STICK</span>
          <span className="logo-b">PARTY</span>
        </h1>
        <p className="muted">Connecting to the game server…</p>
      </div>
    );
  }

  const joined = !!myId && state.players.some((p) => p.id === myId);
  if (state.phase === "countdown" || state.phase === "playing") {
    return <GameScreen api={api} state={state} />;
  }
  if (!joined) return <JoinScreen api={api} />;
  if (state.phase === "results") return <ResultsScreen api={api} state={state} />;
  return <Lobby api={api} state={state} />;
}
