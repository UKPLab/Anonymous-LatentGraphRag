"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { LANDING_SECTIONS } from "./sections";

/**
 * SectionNav — a slim, fixed left-rail table of contents for the landing page.
 *
 * Design constraints (per request):
 *   • It must NOT shrink the main content — the animations keep their current width.
 *     So the rail is `position: fixed` and lives entirely in the left gutter; it is
 *     only shown at ≥1440px, where the centred content (max-w-5xl = 1024px) leaves
 *     ≥208px of gutter on each side. Below that width the rail is hidden and the page
 *     is byte-for-byte what it is today.
 *   • Slim: a single narrow column (w-40) of short labels with a left accent bar.
 *
 * Scroll-spy: the active section is the last one whose top has scrolled above a small
 * offset (just below the 56px sticky TopNav). Section offsets are measured once (and
 * re-measured on any layout change via ResizeObserver), so the scroll handler only
 * reads window.scrollY — it forces NO layout and stays smooth on this animation-heavy
 * page.
 */

// A little below the sticky TopNav (h-14 = 56px) so a section counts as "active"
// once its heading clears the header.
const ACTIVE_OFFSET = 130;

export default function SectionNav() {
  const [activeId, setActiveId] = useState<string>(LANDING_SECTIONS[0].id);
  // Cached absolute document Y of each section + the page's max scroll — refreshed only
  // when the layout actually changes, never during scroll.
  const topsRef = useRef<{ id: string; top: number }[]>([]);
  const maxScrollRef = useRef(0);
  const activeRef = useRef(activeId);

  const measure = useCallback(() => {
    const y = window.scrollY;
    topsRef.current = LANDING_SECTIONS.map((s) => {
      const el = document.getElementById(s.id);
      return { id: s.id, top: el ? el.getBoundingClientRect().top + y : Infinity };
    });
    maxScrollRef.current = document.documentElement.scrollHeight;
  }, []);

  const recompute = useCallback(() => {
    // Pure arithmetic over cached offsets + scroll position → no forced layout.
    const threshold = window.scrollY + ACTIVE_OFFSET;
    let current = LANDING_SECTIONS[0].id;
    for (const t of topsRef.current) {
      if (t.top <= threshold) current = t.id;
    }
    // Snap to the last section near the very bottom (covers a short final section).
    if (window.innerHeight + window.scrollY >= maxScrollRef.current - 4) {
      current = LANDING_SECTIONS[LANDING_SECTIONS.length - 1].id;
    }
    if (current !== activeRef.current) {
      activeRef.current = current;
      setActiveId(current);
    }
  }, []);

  useEffect(() => {
    measure();
    recompute();
    const onScroll = () => recompute();
    const onLayout = () => {
      measure();
      recompute();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onLayout);
    window.addEventListener("load", onLayout);
    // Catch late layout shifts (fonts/images/animated content changing height).
    const ro = new ResizeObserver(onLayout);
    ro.observe(document.body);
    const t = setTimeout(onLayout, 600);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("load", onLayout);
      ro.disconnect();
      clearTimeout(t);
    };
  }, [measure, recompute]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return; // let the native hash jump handle it as a fallback
    e.preventDefault();
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Reflect the hash without an extra scroll jump.
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav
      aria-label="Page sections"
      className="hidden min-[1440px]:flex flex-col fixed left-6 top-1/2 -translate-y-1/2 z-30 w-40 select-none"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5 pl-3">
        On this page
      </p>
      {LANDING_SECTIONS.map((s) => {
        const active = activeId === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => handleClick(e, s.id)}
            aria-current={active ? "true" : undefined}
            className={`flex items-center gap-2 pl-3 py-1.5 border-l-2 transition-colors duration-150 ${
              active
                ? "border-blue-500 text-blue-700 font-semibold"
                : "border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <span className="text-xs leading-tight">{s.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
