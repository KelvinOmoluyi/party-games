"use client";

import { useEffect, useRef, useState } from "react";
import type { GameInput } from "../shared/types";
import { sound, vibrate } from "./sound";

type Send = (m: GameInput) => void;

/** Two big mash buttons (one per thumb). In landscape they float in the bottom corners. */
export function TapPad({ label, color, send }: { label: string; color: string; send: Send }) {
  const [taps, setTaps] = useState(0);
  const [pressed, setPressed] = useState<number | null>(null);
  const tap = (side: number) => {
    send({ type: "tap" });
    setTaps((t) => t + 1);
    setPressed(side);
    sound.play("tap", { minGap: 0 });
    vibrate(8);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "Enter" || e.code === "KeyF" || e.code === "KeyJ") && !e.repeat) {
        e.preventDefault();
        tap(e.code === "KeyF" ? 0 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="controls tap-controls">
      {[0, 1].map((side) => (
        <button
          key={side}
          className={`tap-btn ${pressed === side ? "pressed" : ""}`}
          style={{ "--btn": color } as React.CSSProperties}
          onPointerDown={(e) => {
            e.preventDefault();
            tap(side);
          }}
          onPointerUp={() => setPressed(null)}
          onPointerLeave={() => setPressed(null)}
        >
          <span className="tap-label">{label}</span>
          {side === 1 && <span className="tap-count">{taps}</span>}
        </button>
      ))}
    </div>
  );
}

/** Floating joystick on the left, action button on the right. WASD/arrows + space on a keyboard. */
export function StickControls({
  action,
  icon,
  color,
  send,
  rotated = false,
  badge,
  disabled = false,
}: {
  action: string;
  icon: string;
  color: string;
  send: Send;
  rotated?: boolean;
  badge?: string;
  disabled?: boolean;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<{ bx: number; by: number; kx: number; ky: number } | null>(null);
  const [firing, setFiring] = useState(false);
  const pointer = useRef<number | null>(null);
  const lastSent = useRef({ x: 0, y: 0, t: 0 });
  const pending = useRef<{ x: number; y: number } | null>(null);
  const keys = useRef(new Set<string>());
  const RADIUS = 52;

  const sendMove = (x: number, y: number, force = false) => {
    const now = performance.now();
    const l = lastSent.current;
    if (!force && Math.abs(l.x - x) < 0.05 && Math.abs(l.y - y) < 0.05) return;
    if (!force && now - l.t < 45) {
      pending.current = { x, y };
      return;
    }
    pending.current = null;
    lastSent.current = { x, y, t: now };
    send({ type: "move", x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (pending.current) sendMove(pending.current.x, pending.current.y, true);
    }, 50);
    return () => clearInterval(id);
  });

  const act = () => {
    send({ type: "action" });
    vibrate(15);
    setFiring(true);
    setTimeout(() => setFiring(false), 120);
  };

  useEffect(() => {
    const map: Record<string, [number, number]> = {
      KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
      KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
    };
    const update = () => {
      let x = 0;
      let y = 0;
      for (const k of keys.current) {
        x += map[k][0];
        y += map[k][1];
      }
      const m = Math.hypot(x, y) || 1;
      sendMove(x / m, y / m, true);
    };
    const down = (e: KeyboardEvent) => {
      if (map[e.code]) {
        e.preventDefault();
        if (!keys.current.has(e.code)) {
          keys.current.add(e.code);
          update();
        }
      } else if ((e.code === "Space" || e.code === "ShiftLeft" || e.code === "Enter") && !e.repeat) {
        e.preventDefault();
        act();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (map[e.code] && keys.current.delete(e.code)) update();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  /**
   * Touch position inside the joystick zone, in the game's own coordinates.
   * When the game screen is rotated 90° clockwise (phone held upright), the game's
   * x axis runs down the physical screen and its y axis runs right-to-left.
   */
  const local = (e: React.PointerEvent) => {
    const r = zone.current!.getBoundingClientRect();
    return rotated ? { x: e.clientY - r.top, y: r.right - e.clientX } : { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    if (pointer.current !== null) return;
    pointer.current = e.pointerId;
    try {
      zone.current?.setPointerCapture(e.pointerId);
    } catch {}
    const p = local(e);
    setKnob({ bx: p.x, by: p.y, kx: 0, ky: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerId !== pointer.current || !knob) return;
    const p = local(e);
    let dx = p.x - knob.bx;
    let dy = p.y - knob.by;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    setKnob({ ...knob, kx: dx, ky: dy });
    const m = Math.hypot(dx, dy) / RADIUS;
    sendMove(m < 0.12 ? 0 : dx / RADIUS, m < 0.12 ? 0 : dy / RADIUS);
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerId !== pointer.current) return;
    pointer.current = null;
    setKnob(null);
    sendMove(0, 0, true);
  };

  return (
    <div className="controls stick-controls">
      <div ref={zone} className="stick-zone" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {knob ? (
          <>
            <div className="stick-base" style={{ left: knob.bx, top: knob.by }} />
            <div className="stick-knob" style={{ left: knob.bx + knob.kx, top: knob.by + knob.ky, background: color }} />
          </>
        ) : (
          <div className="stick-idle">
            <div className="stick-base ghost" />
            <span>drag to move</span>
          </div>
        )}
      </div>
      <button
        className={`action-btn ${firing ? "pressed" : ""} ${disabled ? "empty" : ""}`}
        style={{ "--btn": color } as React.CSSProperties}
        onPointerDown={(e) => {
          e.preventDefault();
          act();
        }}
      >
        <span className="action-icon">{icon}</span>
        <span className="action-label">{action}</span>
        {badge !== undefined && <span className="action-badge">{badge}</span>}
      </button>
    </div>
  );
}
