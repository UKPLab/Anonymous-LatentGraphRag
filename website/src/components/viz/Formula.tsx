/**
 * Formula — typesets a short TeX-like string as HTML, in the style of the deck's Eq. 1 slide:
 * serif, single-letter variables (Latin and Greek) in italics, function names upright, and
 * `_x` / `_{xy}` rendered as real subscripts (nesting allowed).
 *
 *   <Formula tex="z_s = f_θ([ι; q; ctx(O_s)])" />
 *
 * Enough for the operator's three update equations; anything larger belongs in a figure.
 */

import type { ReactNode } from "react";

const UPRIGHT = new Set(["cos", "ctx", "exp", "log", "max", "min", "top"]);

function parse(src: string, key = "f"): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const next = () => `${key}-${k++}`;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "_") {
      // subscript: _{...} or a single character
      let body: string;
      if (src[i + 1] === "{") {
        let depth = 1, j = i + 2;
        while (j < src.length && depth > 0) {
          if (src[j] === "{") depth++;
          else if (src[j] === "}") depth--;
          j++;
        }
        body = src.slice(i + 2, j - 1);
        i = j;
      } else {
        body = src[i + 1] ?? "";
        i += 2;
      }
      const id = next();
      out.push(<sub key={id} className="text-[0.72em]">{parse(body, id)}</sub>);
      continue;
    }
    const m = /^[A-Za-zͰ-Ͽℓ]+/.exec(src.slice(i));
    if (m) {
      const w = m[0];
      if (UPRIGHT.has(w)) out.push(<span key={next()}>{w}</span>);
      else out.push(<i key={next()}>{w}</i>);
      i += w.length;
      continue;
    }
    // operators and punctuation: a little air around relations
    if (ch === "=" || ch === "∪" || ch === "⊕") out.push(<span key={next()} className="px-[0.28em]">{ch}</span>);
    else out.push(<span key={next()}>{ch}</span>);
    i++;
  }
  return out;
}

export default function Formula({ tex, className = "" }: { tex: string; className?: string }) {
  return (
    <span className={`whitespace-nowrap font-serif not-italic ${className}`} aria-label={tex}>
      {parse(tex)}
    </span>
  );
}
