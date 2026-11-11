"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { GameInput, RoomState } from "../shared/types";

// Player id lives in sessionStorage so each browser tab is its own player
// (handy for testing), while a phone reloading the page keeps its identity.
function store(kind: "local" | "session") {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function getPlayerId(): string {
  const s = store("session");
  let id = s?.getItem("party:id");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    s?.setItem("party:id", id);
  }
  return id;
}

export function savedName(): string {
  return store("local")?.getItem("party:name") ?? "";
}

export function useRoom() {
  const [state, setState] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = io();
    socketRef.current = s;
    s.on("connect", () => {
      setConnected(true);
      const name = savedName();
      if (store("session")?.getItem("party:joined") === "1" && name) {
        s.emit("join", { id: getPlayerId(), name });
      }
    });
    s.on("disconnect", () => setConnected(false));
    s.on("state", (st: RoomState) => setState(st));
    s.on("joined", (id: string) => {
      setMyId(id);
      setError(null);
      store("session")?.setItem("party:joined", "1");
    });
    s.on("joinError", (msg: string) => setError(msg));
    s.on("kicked", () => {
      setMyId(null);
      store("session")?.removeItem("party:joined");
      setError("The host removed you from the room.");
    });
    return () => {
      s.disconnect();
    };
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const join = useCallback(
    (name: string) => {
      store("local")?.setItem("party:name", name);
      emit("join", { id: getPlayerId(), name });
    },
    [emit],
  );

  const leave = useCallback(() => {
    emit("leave");
    store("session")?.removeItem("party:joined");
    setMyId(null);
  }, [emit]);

  const send = useCallback((msg: GameInput) => emit("input", msg), [emit]);

  return { state, connected, myId, error, emit, join, leave, send };
}

export type RoomApi = ReturnType<typeof useRoom>;
