/**
 * One palette for every LatentGraphRAG animation (landing page and docs), aligned with the
 * Recursive Dense Retrieval site: indigo for the query state and the encoder, blue for documents,
 * emerald for triples, violet for propositions, orange for the fused ranking.
 */
export const LGR = {
  state: "#4f46e5",       // query state, encoder, recursion
  stateSoft: "#eef2ff",
  doc: "#2563eb",         // documents and the document tree
  docSoft: "#eff6ff",
  triple: "#059669",      // triples (rendered literally as "head relation tail.")
  tripleSoft: "#ecfdf5",
  prop: "#7c3aed",        // propositions
  propSoft: "#f5f3ff",
  path: "#d97706",        // highlighted path / continuation instruction
  pathSoft: "#fffbeb",
  fused: "#ea580c",       // CombMNZ / fused ranking
  fusedSoft: "#fff7ed",
  gold: "#16a34a",        // gold evidence marker (badge only, never a node fill)
  agent: "#0f172a",       // the ReAct controller
  search: "#0ea5e9",      // the agent's own search tool
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#cbd5e1",
  line: "#e2e8f0",
} as const;

export type LgrColor = keyof typeof LGR;

/**
 * Hop colours of the backbone section: one colour per hop of the recursion, used identically by
 * the operator chain, the search tree and the similarity net (hops 1–3, then the last hop, which
 * is scored for the readout). Chosen away from the indigo state and from the document, triple and
 * proposition colours used further down the page. `c` for strokes and fills (≥ 3:1 on white),
 * `ink` for text (≥ 4.5:1 on white), `soft` for backgrounds.
 */
export const HOP = [
  { c: "#0891b2", ink: "#0e7490", soft: "#ecfeff", name: "hop 1" },     // cyan
  { c: "#d97706", ink: "#b45309", soft: "#fffbeb", name: "hop 2" },     // amber
  { c: "#e11d48", ink: "#be123c", soft: "#fff1f2", name: "hop 3" },     // rose
  { c: "#78716c", ink: "#57534e", soft: "#f5f5f4", name: "readout" },   // stone: last hop + readout
] as const;
