"use client";

/**
 * A retrieved document, shown as its corpus id and expandable to the exact text
 * the model saw. The text is fetched only on expand, and only the 256th of the
 * corpus that contains this id.
 */

import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { loadDoc, type CorpusDoc, type DocRole } from "@/lib/traces";

const ROLE_STYLE: Record<DocRole, string> = {
  gold: "border-amber-300 bg-amber-50 text-amber-900",
  evidence: "border-sky-300 bg-sky-50 text-sky-900",
  other: "border-gray-200 bg-gray-50 text-gray-600",
};

const ROLE_BADGE: Record<DocRole, string> = {
  gold: "bg-amber-200 text-amber-900",
  evidence: "bg-sky-200 text-sky-900",
  other: "bg-gray-200 text-gray-600",
};

const ROLE_LABEL: Record<DocRole, string> = {
  gold: "gold",
  evidence: "evidence",
  other: "distractor",
};

export default function DocChip({
  dataset,
  docid,
  role,
  rank,
}: {
  dataset: string;
  docid: string | null;
  role: DocRole;
  rank?: number;
}) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<CorpusDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!docid) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-400">
        {rank !== undefined && <span className="mr-2">{rank}.</span>}
        document could not be matched to a corpus id
      </div>
    );
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !doc && !loading) {
      setLoading(true);
      const d = await loadDoc(dataset, docid!);
      setDoc(d);
      setFailed(!d);
      setLoading(false);
    }
  }

  const tone =
    doc?.kind === "failed"
      ? "border-rose-300 bg-rose-50 text-rose-900"
      : doc?.kind === "unmatched"
        ? "border-indigo-300 bg-indigo-50 text-indigo-900"
        : ROLE_STYLE[role];

  return (
    <div className={`rounded-md border ${tone}`}>
      <button
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 shrink-0 transition ${open ? "rotate-90" : ""}`}
        />
        {rank !== undefined && (
          <span className="text-xs tabular-nums opacity-60 w-5 shrink-0">
            {rank}.
          </span>
        )}
        <code className="text-xs font-mono shrink-0">{docid}</code>
        {doc?.kind && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${
              doc.kind === "failed"
                ? "bg-rose-200 text-rose-900"
                : "bg-indigo-200 text-indigo-900"
            }`}
          >
            {doc.kind === "failed" ? "fetch failed" : "unmatched"}
          </span>
        )}
        {/* gold/evidence labels are about corpus documents; these items have none */}
        {!doc?.kind && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${ROLE_BADGE[role]}`}
          >
            {ROLE_LABEL[role]}
          </span>
        )}
        {doc?.t && (
          <span className="text-xs truncate opacity-80">{doc.t}</span>
        )}
        {loading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
      </button>
      {open && (
        <div className="border-t border-black/10 px-3 py-2 bg-white/70">
          {failed ? (
            <p className="text-xs text-gray-500">
              This document is not in the released corpus slice.
            </p>
          ) : doc ? (
            <>
              <div className="text-xs font-semibold text-gray-900">{doc.t}</div>
              {doc.d && (
                <div className="text-[11px] text-gray-500 mb-1">{doc.d}</div>
              )}
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-700 max-h-72 overflow-y-auto">
                {doc.x}
              </pre>
              <p className="mt-1 text-[10px] text-gray-400">
                {doc.kind === "failed"
                  ? "The agent's own fetch failed here, so this is what it actually received."
                  : doc.kind === "unmatched"
                    ? "This item could not be tied to a corpus document, so it is shown verbatim and gold labels do not apply."
                    : "Shown as stored for the agent: seed documents were truncated to 2,200 characters, search results to 2,000."}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">Loading…</p>
          )}
        </div>
      )}
    </div>
  );
}
