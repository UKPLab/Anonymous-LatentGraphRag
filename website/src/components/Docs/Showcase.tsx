"use client";

import { cloneElement, isValidElement, ReactElement, ReactNode, useEffect, useState } from "react";

/**
 * Code and animation side by side (or stacked). The code shows the calls; the animation shows what they
 * do on a real example. "Expand" opens both at full screen, and the animation receives `expanded`.
 * Port of the RDR docs' component.
 *
 * `variants` switch the code (and optionally the animation) between related snippets.
 */
export interface ShowcaseVariant {
  label: string;
  /** highlighted code (a <HighlightedCode> element rendered on the server) */
  code: ReactNode;
  /** plain code for the copy button */
  text: string;
  /** optional animation for this variant (defaults to the showcase's `demo`) */
  demo?: ReactElement;
}

function withExpanded(demo: ReactElement | undefined, expanded: boolean): ReactNode {
  if (!demo || !isValidElement(demo)) return demo ?? null;
  return cloneElement(demo as ReactElement<{ expanded?: boolean }>, { expanded });
}

export default function Showcase({
  title,
  variants,
  demo,
  caption,
  stacked = false,
}: {
  title?: string;
  variants: ShowcaseVariant[];
  demo?: ReactElement;
  caption?: ReactNode;
  /** code in full width above the animation (for complete, runnable examples) instead of side by side */
  stacked?: boolean;
}) {
  const [v, setV] = useState(0);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const cur = variants[Math.min(v, variants.length - 1)];
  const anim = cur.demo ?? demo;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cur.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  const tabs =
    variants.length > 1 ? (
      <div className="flex items-center gap-1" role="tablist">
        {variants.map((x, i) => (
          <button
            key={x.label}
            role="tab"
            aria-selected={i === v}
            onClick={() => setV(i)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
              i === v ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-100"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
    ) : (
      <span className="text-[11px] text-gray-400 font-mono">{title ?? "python"}</span>
    );

  const codePane = (tall: boolean) => (
    <div className={`rounded-xl border border-gray-800 bg-gray-950 overflow-hidden flex flex-col ${tall ? "h-full" : ""}`}>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-800 bg-gray-900">
        {tabs}
        <button onClick={copy} className="text-[11px] text-gray-400 hover:text-gray-100 px-1.5 py-0.5 rounded hover:bg-gray-800" aria-label="Copy code">
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <div className={`text-gray-100 [&_pre]:!text-[12px] [&_pre]:!leading-[1.55rem] [&_pre]:!px-3.5 ${tall ? "overflow-auto flex-1" : ""}`}>{cur.code}</div>
    </div>
  );

  return (
    <div className="not-prose my-6">
      <div className={`grid grid-cols-1 gap-4 items-start ${stacked ? "" : "lg:grid-cols-2"}`}>
        {codePane(false)}
        <div className="relative rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-3 pt-10">
          <button
            onClick={() => setOpen(true)}
            className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-gray-200 bg-white/90 px-2 py-1 text-[11px] text-gray-600 hover:text-gray-900 hover:border-gray-300"
            aria-label="Expand code and animation"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M7.5 1.5h3v3M10.5 1.5 7 5M4.5 10.5h-3v-3M1.5 10.5 5 7" />
            </svg>
            expand
          </button>
          {stacked ? <div className="mx-auto max-w-[560px]">{withExpanded(anim, false)}</div> : withExpanded(anim, false)}
        </div>
      </div>
      {caption ? <p className="text-[12px] text-gray-500 mt-2 leading-5">{caption}</p> : null}

      {open && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-stretch justify-center p-3 md:p-6" onClick={() => setOpen(false)}>
          <div
            className="relative w-full max-w-[1500px] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Code and animation"}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-900">{title ?? cur.label}</span>
              <button onClick={() => setOpen(false)} className="text-[12px] text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100" aria-label="Close">
                close ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 p-4 overflow-auto">
              <div className="min-h-0">{codePane(true)}</div>
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 overflow-auto">{withExpanded(anim, true)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
