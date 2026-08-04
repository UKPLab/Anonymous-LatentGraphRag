"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { docsNav } from "@/lib/docsNav";

/**
 * Hybrid search dialog: title-only ranking from docsNav (instant, works in dev), plus
 * Pagefind full-text results once the static build has produced /_pagefind/.
 *
 * Pagefind is loaded lazily on first open so the dev landing page doesn't pay the cost.
 * When Pagefind is unavailable (dev mode without `npm run pagefind`), we silently fall
 * back to title-only matching.
 */

type TitleHit = {
  kind: "title";
  title: string;
  section: string;
  href: string;
  score: number;
};

type FullTextHit = {
  kind: "fulltext";
  title: string;
  url: string;
  excerpt: string; // HTML with <mark> tags around matched terms
};

type Hit = TitleHit | FullTextHit;

// Minimal Pagefind API surface we use.
type PagefindAPI = {
  search: (q: string) => Promise<{
    results: { data: () => Promise<{ url: string; meta: { title?: string }; excerpt: string }> }[];
  }>;
};

declare global {
  interface Window {
    __pagefind?: PagefindAPI;
    __pagefindLoadAttempted?: boolean;
  }
}

async function loadPagefind(): Promise<PagefindAPI | null> {
  if (typeof window === "undefined") return null;
  if (window.__pagefind) return window.__pagefind;
  if (window.__pagefindLoadAttempted) return null;
  window.__pagefindLoadAttempted = true;
  try {
    // Pagefind ships its runtime as an ES module under /_pagefind/. The path is held
    // in a variable so TS doesn't try to resolve it at compile time; webpackIgnore
    // prevents webpack from bundling it.
    // absolute path must carry the base path, or search breaks on a
    // subdirectory deployment (GitHub Pages project site, anonymised mirror)
    const url = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/_pagefind/pagefind.js`;
    const mod = (await import(/* webpackIgnore: true */ url)) as PagefindAPI | undefined;
    if (mod?.search) {
      window.__pagefind = mod;
      return mod;
    }
  } catch {
    // Index not built (dev), or fetch failed. Silently fall back.
  }
  return null;
}

export default function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fullText, setFullText] = useState<FullTextHit[]>([]);
  const [pagefindAvailable, setPagefindAvailable] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setFullText([]);
      requestAnimationFrame(() => inputRef.current?.focus());
      loadPagefind().then((p) => setPagefindAvailable(Boolean(p)));
    }
  }, [open]);

  // Run Pagefind search whenever the query changes.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setFullText([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const pf = await loadPagefind();
      if (!pf || cancelled) return;
      try {
        const res = await pf.search(q);
        const top = await Promise.all(res.results.slice(0, 8).map((r) => r.data()));
        if (cancelled) return;
        setFullText(
          top.map((r) => ({
            kind: "fulltext" as const,
            title: r.meta?.title ?? r.url,
            url: r.url,
            excerpt: r.excerpt,
          }))
        );
      } catch {
        if (!cancelled) setFullText([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, open]);

  // Title-only ranking from the static nav config.
  const titleFlat = useMemo<TitleHit[]>(() => {
    const out: TitleHit[] = [];
    for (const section of docsNav) {
      for (const item of section.items) {
        out.push({ kind: "title", title: item.title, section: section.title, href: item.href, score: 0 });
      }
    }
    return out;
  }, []);

  const titleHits = useMemo<TitleHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return titleFlat.slice(0, 8);
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored = titleFlat
      .map((h) => {
        const hay = `${h.title} ${h.section}`.toLowerCase();
        let score = 0;
        for (const t of tokens) {
          if (hay.includes(t)) score += 1;
          if (h.title.toLowerCase().startsWith(t)) score += 2;
        }
        return { ...h, score };
      })
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 8);
  }, [titleFlat, query]);

  const allHits: Hit[] = [...titleHits, ...fullText];
  const showEmptyState = query.trim().length > 0 && allHits.length === 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search docs"
        className="hidden md:flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-200 hover:border-gray-300 bg-white transition"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 4 4" />
        </svg>
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden lg:inline-block ml-2 text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600">
          ⌘K
        </kbd>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="9" r="6" />
                <path d="m14 14 4 4" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={pagefindAvailable ? "Search the docs…" : "Search page titles…"}
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400 text-gray-900"
              />
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-500">
                esc
              </kbd>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto py-2">
              {titleHits.length > 0 && (
                <li className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Pages
                </li>
              )}
              {titleHits.map((h) => (
                <li key={`t-${h.href}`}>
                  <Link
                    href={h.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-4 py-2 hover:bg-blue-50 transition group"
                  >
                    <span className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                      {h.title}
                    </span>
                    <span className="text-xs text-gray-400">{h.section}</span>
                  </Link>
                </li>
              ))}
              {fullText.length > 0 && (
                <li className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Content
                </li>
              )}
              {fullText.map((h, i) => (
                <li key={`f-${h.url}-${i}`}>
                  <Link
                    href={h.url}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 hover:bg-blue-50 transition group"
                  >
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                      {h.title}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-0.5 leading-snug [&>mark]:bg-yellow-100 [&>mark]:text-gray-900 [&>mark]:rounded [&>mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: h.excerpt }}
                    />
                  </Link>
                </li>
              ))}
              {showEmptyState && (
                <li className="px-4 py-6 text-center text-sm text-gray-500">
                  No matches for &ldquo;{query}&rdquo;
                </li>
              )}
            </ul>
            {!pagefindAvailable && (
              <div className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100 font-mono">
                tip: run <span className="text-gray-600">npm run build</span> to enable full-text search
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
