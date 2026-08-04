/**
 * Section anchors for the landing page, shared between the page (which stamps the
 * matching `id` onto each section wrapper) and the floating SectionNav rail.
 *
 * Keep the order in sync with the render order in src/app/page.tsx.
 */
export type LandingSection = { id: string; label: string };

export const LANDING_SECTIONS: LandingSection[] = [
  { id: "overview", label: "Overview" },
  { id: "problem", label: "Problem" },
  { id: "retrieval", label: "Retrieval" },
  { id: "memories", label: "Memories" },
  { id: "dual-tree", label: "Dual Tree" },
  { id: "results", label: "Results" },
  { id: "agentic", label: "Agentic RAG" },
  { id: "ablations", label: "Ablations" },
  { id: "solution", label: "Solution" },
  { id: "upper-bound", label: "Upper Bound" },
  { id: "citation", label: "Citation" },
];
