"use client";

import { ReactNode, useState } from "react";

/** A dark code card with variant tabs and a copy button (variants are pre-highlighted on the server). */
export default function CodeTabs({ variants, title = "python" }: { variants: { label: string; code: ReactNode; text: string }[]; title?: string }) {
  const [v, setV] = useState(0);
  const [copied, setCopied] = useState(false);
  const cur = variants[Math.min(v, variants.length - 1)];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cur.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-800 bg-gray-900">
        {variants.length > 1 ? (
          <div className="flex items-center gap-1" role="tablist">
            {variants.map((x, i) => (
              <button key={x.label} role="tab" aria-selected={i === v} onClick={() => setV(i)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${i === v ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-100"}`}>
                {x.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-gray-400 font-mono">{title}</span>
        )}
        <button onClick={copy} className="text-[11px] text-gray-400 hover:text-gray-100 px-1.5 py-0.5 rounded hover:bg-gray-800" aria-label="Copy code">
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <div className="text-gray-100 [&_pre]:!text-[12px] [&_pre]:!leading-[1.55rem] [&_pre]:!px-3.5 flex-1">{cur.code}</div>
    </div>
  );
}
