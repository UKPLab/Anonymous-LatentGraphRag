"use client";

import { useEffect, useState } from "react";

type Heading = {
  id: string;
  text: string;
  level: 2 | 3;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Right-rail "On this page" navigation.
 *
 * Reads h2/h3 headings from the current `<article>` after mount, ensures each has a
 * stable id (rehype-slug already adds them in MDX; we add fallbacks for raw .tsx
 * pages), and uses an IntersectionObserver to highlight whichever heading is closest
 * to the top of the viewport.
 */
export default function OnThisPage() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const article = document.querySelector("article");
    if (!article) return;

    // Collect h2 and h3 (skip deeper levels — they'd clutter the rail).
    const nodes = Array.from(article.querySelectorAll("h2, h3")) as HTMLHeadingElement[];
    const usedIds = new Set<string>();
    const collected: Heading[] = [];

    for (const node of nodes) {
      const text = (node.textContent ?? "").trim();
      if (!text) continue;

      // Guarantee an id. If the heading wraps an anchor (rehype-autolink-headings),
      // walk up to find the heading element itself.
      let id = node.id;
      if (!id) {
        id = slugify(text);
        let suffix = 1;
        while (usedIds.has(id) || document.getElementById(id)) {
          id = `${slugify(text)}-${suffix++}`;
        }
        node.id = id;
      }
      usedIds.add(id);

      const level = (node.tagName === "H3" ? 3 : 2) as 2 | 3;
      collected.push({ id, text, level });
    }
    setHeadings(collected);

    if (collected.length === 0) return;

    // Highlight whichever heading is closest to the top once it's within the upper
    // third of the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -70% 0px",
        threshold: 0,
      }
    );
    for (const h of collected) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 px-2">
        On this page
      </p>
      <ul className="space-y-0.5 border-l border-gray-200">
        {headings.map((h) => (
          <li key={h.id} style={{ paddingLeft: h.level === 3 ? 18 : 0 }}>
            <a
              href={`#${h.id}`}
              className={`block py-1 px-2 -ml-px border-l-2 transition-colors ${
                activeId === h.id
                  ? "border-blue-500 text-blue-700 font-medium"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
