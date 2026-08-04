"use client";

import { useEffect, useState } from "react";

/**
 * Drives a stepped animation from 0 .. maxStep on a loop.
 *
 * Returns the current step plus controls for pausing, replaying, and scrubbing.
 * Used by every search/corpus/fusion demo on the docs pages.
 */
export function useAutoPlay(opts: {
  maxStep: number;
  intervalMs?: number;
  startPaused?: boolean;
  /** ms to hold on the final step before restarting */
  pauseAtEndMs?: number;
}) {
  const intervalMs = opts.intervalMs ?? 800;
  const pauseAtEndMs = opts.pauseAtEndMs ?? 1400;
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(Boolean(opts.startPaused));

  useEffect(() => {
    if (paused) return;
    const delay = step >= opts.maxStep ? pauseAtEndMs : intervalMs;
    const t = window.setTimeout(() => {
      setStep((s) => (s >= opts.maxStep ? 0 : s + 1));
    }, delay);
    return () => window.clearTimeout(t);
  }, [step, paused, intervalMs, pauseAtEndMs, opts.maxStep]);

  return {
    step,
    paused,
    setStep,
    play: () => setPaused(false),
    pause: () => setPaused(true),
    toggle: () => setPaused((v) => !v),
    replay: () => setStep(0),
  };
}
