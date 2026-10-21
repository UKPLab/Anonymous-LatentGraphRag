import { headlineClaims, paperMeta } from "@/data/lgrPaper";

/** A headline claim from the submitted paper, by id. Throws at build time if the id is unknown,
 * so a renamed claim cannot silently disappear from the page. */
export function claim(id: string): string {
  const c = headlineClaims.find((x) => x.id === id);
  if (!c) throw new Error(`unknown claim id: ${id}`);
  return c.text;
}

/** "Recursive Dense Retrieval (RDR; Anonymous, 2026)", composed from the paper's own citation. */
export const backboneWithCitation = (() => {
  const name = paperMeta.backbone.replace(/\)$/, "");          // "Recursive Dense Retrieval (RDR"
  const cite = paperMeta.backboneCitation.replace(/\s*\((.*)\)$/, ", $1"); // "Anonymous, 2026"
  return `${name}; ${cite})`;
})();
