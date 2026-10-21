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
  { id: "backbone", label: "RDR Backbone" },
  { id: "memories", label: "Memories" },
  { id: "fusion", label: "Two Trees" },
  { id: "results", label: "Retrieval" },
  { id: "robustness", label: "Robustness" },
  { id: "agents", label: "Readers & Agents" },
  { id: "ablations", label: "Ablations" },
  { id: "citation", label: "Citation" },
];
