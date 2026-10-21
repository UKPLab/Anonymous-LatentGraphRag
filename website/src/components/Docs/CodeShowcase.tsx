import { ReactElement, ReactNode } from "react";
import HighlightedCode, { stripSteps } from "./HighlightedCode";
import Showcase from "./Showcase";
import CodeTabs from "./CodeTabs";

/**
 * Server wrapper of <Showcase>: highlights each variant's code at build time.
 *
 *   <CodeShowcase variants={[{ label: "quick start", code: "…" }, { label: "install", code: "…", lang: "bash" }]}
 *                 demo={<ReActDemo />} stacked />
 */
export default function CodeShowcase({
  title,
  variants,
  demo,
  caption,
  stacked,
}: {
  title?: string;
  variants: { label: string; code: string; lang?: string; demo?: ReactElement }[];
  demo?: ReactElement;
  caption?: ReactNode;
  stacked?: boolean;
}) {
  return (
    <Showcase
      title={title}
      demo={demo}
      caption={caption}
      stacked={stacked}
      variants={variants.map((v) => ({
        label: v.label,
        text: stripSteps(v.code),
        demo: v.demo,
        code: <HighlightedCode code={v.code} lang={v.lang} />,
      }))}
    />
  );
}

/** A plain highlighted code panel (no animation) with a copy button. */
export function CodePanel({ code, title = "python", lang = "python" }: { code: string; title?: string; lang?: string }) {
  return (
    <div className="not-prose my-5">
      <CodeTabs title={title} variants={[{ label: title, text: stripSteps(code), code: <HighlightedCode code={code} lang={lang} /> }]} />
    </div>
  );
}

/** Code tabs without an animation: several highlighted variants (e.g. pip / editable install). */
export function CodeVariants({ variants }: { variants: { label: string; code: string; lang?: string }[] }) {
  return (
    <div className="not-prose my-5">
      <CodeTabs
        variants={variants.map((v) => ({
          label: v.label,
          text: stripSteps(v.code),
          code: <HighlightedCode code={v.code} lang={v.lang} />,
        }))}
      />
    </div>
  );
}
