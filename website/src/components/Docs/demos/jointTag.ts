/**
 * Joint-index tagging helper.
 *
 * In `joint_index` mode the document index and the memory index are merged into a
 * single pool, so each candidate a search strategy retrieves is *either* a document
 * or a memory — and we don't control the mix. A given hop could surface mostly
 * documents, mostly memories, or anything in between.
 *
 * To reflect that honestly (instead of a clean alternating pattern), we assign the
 * doc/memory type pseudo-randomly, seeded by the node id so the assignment stays
 * stable across re-renders and replays. The result *looks* random but never flickers.
 */

// FNV-1a + murmur3 finalizer. The finalizer gives good avalanche so the low bit
// isn't correlated with the input's last character — without it, ids that differ
// by one digit (e.g. "2.0" vs "2.1") would alternate doc/mem in a visible pattern.
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Stable pseudo-random "doc" | "mem" tag for a node id (≈50/50, but locally varied). */
export function jointTag(id: string, salt = ""): "doc" | "mem" {
  return hashSeed(`${id}|${salt}`) % 2 === 0 ? "doc" : "mem";
}

// Substrate colors shared by the joint-mode demos.
export const DOC_COLOR = { fill: "#3b82f6", stroke: "#93c5fd" };
export const MEM_COLOR = { fill: "#22c55e", stroke: "#86efac" };
