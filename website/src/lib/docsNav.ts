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
      { title: "Tutorial", href: "/docs/tutorial" },
    ],
  },
  {
    title: "Concepts",
    items: [
      { title: "Three Orthogonal Axes", href: "/docs/concepts/overview" },
      { title: "Latent Graph", href: "/docs/concepts/latent-graph" },
      { title: "Relational Memories", href: "/docs/concepts/relational-memories" },
      { title: "Why Orthogonal?", href: "/docs/concepts/why-orthogonal" },
    ],
  },
  {
    title: "Corpus Modes",
    items: [
      { title: "Document-Only", href: "/docs/corpus/document-only" },
      { title: "Memory-Only", href: "/docs/corpus/memory-only" },
      { title: "Joint-Index", href: "/docs/corpus/joint-index" },
      { title: "Dual-Tree", href: "/docs/corpus/dual-tree" },
    ],
  },
  {
    title: "Search Strategies",
    items: [
      { title: "Full Expansion", href: "/docs/search/full-expansion" },
      { title: "BeamDR", href: "/docs/search/beamdr" },
      { title: "Cross-View Beam", href: "/docs/search/cross-view-beam" },
      { title: "MMR", href: "/docs/search/mmr" },
    ],
  },
  {
    title: "Fusion",
    items: [
      { title: "Reciprocal Rank Fusion (RRF)", href: "/docs/fusion/rrf" },
      { title: "Document–Memory Agreement", href: "/docs/fusion/agreement" },
    ],
  },
  {
    title: "Combinations",
    items: [
      { title: "Interactive Matrix", href: "/docs/combinations" },
    ],
  },
  {
    title: "Tutorial",
    items: [
      { title: "1. Install", href: "/docs/tutorial/01-install" },
      { title: "2. Build a Graph", href: "/docs/tutorial/02-build-graph" },
      { title: "3. Encode", href: "/docs/tutorial/03-encode" },
      { title: "4. Retrieve", href: "/docs/tutorial/04-retrieve" },
      { title: "5. Evaluate", href: "/docs/tutorial/05-evaluate" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { title: "LatentGraphRAG", href: "/docs/api/latentgraphrag" },
      { title: "retrieve()", href: "/docs/api/retrieve" },
      { title: "Encoders", href: "/docs/api/encoders" },
      { title: "Evaluation", href: "/docs/api/evaluation" },
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
