"use client";

import { useRef } from "react";
import { useCityStore } from "@/state/useCityStore";
import { touchInput } from "@/world/touch";

const RADIUS = 52;
/** Push the stick past this share of its radius to run. */
const RUN_AT = 0.9;

/**
 * Phone controls: a joystick on the left (push further to run) and jump /
 * action buttons on the right. Dragging anywhere else on the screen turns the
 * camera, and pinching zooms (handled by the camera controls).
 */
export function TouchControls() {
  const knob = useRef<HTMLSpanElement>(null);
  const pointer = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0 });
  const nearby = useCityStore((s) => s.nearby);
  const seat = useCityStore((s) => s.seat);
  const interact = useCityStore((s) => s.interact);
  const driving = useCityStore((s) => s.driving);

  const move = (clientX: number, clientY: number) => {
    let dx = clientX - center.current.x;
    let dy = clientY - center.current.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    touchInput.x = dx / RADIUS;
    touchInput.y = -dy / RADIUS;
    touchInput.run = len / RADIUS > RUN_AT;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const release = () => {
    pointer.current = null;
    touchInput.x = 0;
    touchInput.y = 0;
    touchInput.run = false;
    if (knob.current) knob.current.style.transform = "";
  };

  return (
    <div className="touch-controls pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div
        className="touch-stick pointer-events-auto"
        role="application"
        aria-label="Joystick: drag to walk, push to the edge to run"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          pointer.current = e.pointerId;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Capture can fail for synthetic pointers; moves still arrive while over the stick.
          }
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.pointerId === pointer.current) move(e.clientX, e.clientY);
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span ref={knob} className="touch-knob" />
      </div>

      <div className="pointer-events-auto flex items-end gap-3">
        {(nearby || seat || driving) && (
          <button
            type="button"
            className="touch-button touch-action"
            onClick={interact}
            aria-label={seat ? "Stand up" : driving ? "Get out of the car" : nearby?.label}
          >
            {seat ? "Stand" : driving ? "Exit" : "E"}
          </button>
        )}
        <button
          type="button"
          className="touch-button"
          aria-label={driving ? "Brake" : "Jump"}
          onPointerDown={() => (touchInput.jump = true)}
          onPointerUp={() => (touchInput.jump = false)}
          onPointerCancel={() => (touchInput.jump = false)}
          onPointerLeave={() => (touchInput.jump = false)}
        >
          {driving ? "■" : "⤒"}
        </button>
      </div>
    </div>
  );
}
