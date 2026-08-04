"use client";

import { ReactNode } from "react";

interface DemoControlsProps {
  paused: boolean;
  step: number;
  maxStep: number;
  onPlayPause: () => void;
  onReplay: () => void;
  stepLabel?: (step: number, maxStep: number) => ReactNode;
  /** Optional right-side knob row (sliders, toggles, etc.) */
  rightSide?: ReactNode;
}

/**
 * Shared player chrome below every demo animation.
 *
 * Houses the play/pause/replay buttons, the hop counter, and an optional slot for
 * per-demo knobs (e.g. a branching slider).
 */
export default function DemoControls({
  paused,
  step,
  maxStep,
  onPlayPause,
  onReplay,
  stepLabel,
  rightSide,
}: DemoControlsProps) {
  return (
    <div className="flex items-center justify-between gap-3 mt-3 px-2 text-xs text-gray-600">
      <div className="flex items-center gap-2">
        <button
          onClick={onPlayPause}
          aria-label={paused ? "Play" : "Pause"}
          className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition"
        >
          {paused ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 1.5v9l8-4.5z" />
            </svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1.5" width="2.5" height="9" rx="0.5" />
              <rect x="7.5" y="1.5" width="2.5" height="9" rx="0.5" />
            </svg>
          )}
        </button>
        <button
          onClick={onReplay}
          aria-label="Replay"
          className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-50 transition"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 6a4 4 0 1 0 1-2.65" />
            <path d="M2 1.5V4h2.5" />
          </svg>
        </button>
        <span className="font-mono text-gray-500">
          {stepLabel ? stepLabel(step, maxStep) : `hop ${step} / ${maxStep}`}
        </span>
      </div>
      {rightSide ? <div className="flex items-center gap-3">{rightSide}</div> : null}
    </div>
  );
}
