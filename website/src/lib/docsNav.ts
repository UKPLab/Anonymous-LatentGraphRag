/**
 * Sidebar navigation config for /docs/*.
 *
 * This is the single source of truth — keep it ordered the way you want pages to
 * appear in the sidebar and in prev/next page links.
 */

export interface DocItem {
  title: string;
  href: string;
}

export interface DocSection {
  title: string;
  items: DocItem[];
}

export const docsNav: DocSection[] = [
  {
    title: "Get Started",
    items: [
      { title: "Overview", href: "/docs" },
      { title: "Installation", href: "/docs/installation" },
      { title: "Quickstart", href: "/docs/quickstart" },
      { title: "Index, Save, Reuse", href: "/docs/indexing" },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "Knowledge Construction", href: "/docs/construction" },
      { title: "Retrieval", href: "/docs/retrieval" },
      { title: "ReAct Agent", href: "/docs/agent" },
      { title: "Evaluation", href: "/docs/evaluation" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "API", href: "/docs/api" },
      { title: "Reproducing the Paper", href: "/docs/reproduce" },
    ],
  },
];

/** Flat ordered list of all doc pages (for prev/next links). */
export const docsFlat: DocItem[] = docsNav.flatMap((s) => s.items);

export function findAdjacent(href: string): { prev?: DocItem; next?: DocItem } {
  const i = docsFlat.findIndex((d) => d.href === href);
  if (i === -1) return {};
  return {
    prev: i > 0 ? docsFlat[i - 1] : undefined,
    next: i < docsFlat.length - 1 ? docsFlat[i + 1] : undefined,
  };
}
