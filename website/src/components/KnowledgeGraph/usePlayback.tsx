"use client";

/**
 * Time-based playback shared by the memory and fusion figures (same behaviour as the RDR site's
 * TreeSearchFlow): playback starts when the figure scrolls into view, chips seek to a step and play on,
 * Play/Pause holds any frame, and with prefers-reduced-motion the finished figure is shown and Play opts
 * in. `?<param>=<ms>` freezes the figure at that time (used for screenshot checks).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type TimedStep = { ms: number };

export const c01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => 1 - Math.pow(1 - x, 2.6);

/** index and progress (0..1) of the step that is playing at `el` ms */
export function locate(steps: TimedStep[], el: number) {
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    if (el < acc + steps[i].ms || i === steps.length - 1) return { si: i, sp: c01((el - acc) / steps[i].ms) };
    acc += steps[i].ms;
  }
  return { si: steps.length - 1, sp: 1 };
}

/** ms at which step `j` begins */
export function startAt(steps: TimedStep[], j: number) {
  let t = 0;
  for (let i = 0; i < j; i++) t += steps[i].ms;
  return t;
}

export function usePlayback(total: number, param: string, threshold = 0.3) {
  const [el, setEl] = useState(0);
  const [playing, setPlaying] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const started = useRef(false);
  const raf = useRef<number | null>(null);
  const base = useRef<number | null>(null);
  const elRef = useRef(el);
  const seekRef = useRef<number | null>(null);

  useEffect(() => {
    elRef.current = el;
  }, [el]);

  // read after hydration, so server and client render the same first frame
  useEffect(() => {
    const frozen = new URLSearchParams(window.location.search).get(param);
    if (frozen === null) return;
    started.current = true;
    const t = Math.min(total, Number(frozen));
    elRef.current = t;
    const id = requestAnimationFrame(() => setEl(t));
    return () => cancelAnimationFrame(id);
  }, [param, total]);

  useEffect(() => {
    if (started.current || !box.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      started.current = true;
      const id = requestAnimationFrame(() => setEl(total));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !started.current) {
        started.current = true;
        setPlaying(true);
        io.disconnect();
      }
    }, { threshold });
    io.observe(box.current);
    return () => io.disconnect();
  }, [total, threshold]);

  useEffect(() => {
    if (!playing) return;
    base.current = null;
    const loop = (now: number) => {
      if (seekRef.current !== null) { base.current = now - seekRef.current; seekRef.current = null; }
      if (base.current === null) base.current = now - elRef.current;
      const e = now - base.current;
      if (e >= total) { setEl(total); setPlaying(false); return; }
      setEl(e);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, total]);

  const seek = useCallback((t: number) => {
    started.current = true;
    seekRef.current = t;
    elRef.current = t;
    setEl(t);
    setPlaying(true);
  }, []);
  const done = el >= total;
  const toggle = useCallback(() => {
    if (playing) setPlaying(false);
    else if (elRef.current >= total) seek(0);
    else { started.current = true; setPlaying(true); }
  }, [playing, total, seek]);

  return { el, playing, done, seek, toggle, replay: () => seek(0), box };
}

/** Play/Pause button in the RDR site's style */
export function PlayButton({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={playing ? "Pause" : "Play"}
      className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-700">
      {playing ? (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1" width="2.4" height="8" rx="0.6" fill="currentColor" /><rect x="6.1" y="1" width="2.4" height="8" rx="0.6" fill="currentColor" /></svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.2 1.2 L8.6 5 L2.2 8.8 Z" fill="currentColor" /></svg>
      )}
    </button>
  );
}

/** A step chip: active (playing), past, or upcoming */
export function StepChip({ label, state, onClick, tone = "indigo" }: {
  label: string; state: "active" | "past" | "next"; onClick: () => void; tone?: "indigo" | "amber";
}) {
  const active = tone === "amber" ? "border-amber-400 bg-amber-50 font-medium text-amber-900" : "border-violet-400 bg-violet-50 font-medium text-violet-900";
  return (
    <button type="button" onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors hover:border-violet-300 hover:text-violet-800 ${
        state === "active" ? active : state === "past" ? "border-slate-300 bg-slate-50 text-slate-600" : "border-slate-200 bg-white text-slate-400"}`}>
      {label}
    </button>
  );
}
