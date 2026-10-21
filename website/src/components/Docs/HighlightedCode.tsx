import { codeToHtml, type ShikiTransformer } from "shiki";

/**
 * Build-time syntax highlighting (server component): the static export ships highlighted HTML, no
 * highlighter in the browser. Used inside <CodeShowcase> and <CodePanel>. Port of the RDR docs' component.
 *
 * Step labels: a line ending in `#@ Label` (e.g. `index = lgr.build(documents, inventory)  #@ Index`) is
 * highlighted and labelled in a gutter on the left; the marker itself is removed from the shown and the
 * copied code (`stripSteps`). The label's first word picks the colour (see STEP_KIND and globals.css).
 */
const STEP = /[ \t]*#@[ \t]*([^\n#]+?)[ \t]*$/;

const STEP_KIND: Record<string, string> = {
  install: "install", rdr: "install", package: "install", extras: "install",
  inventory: "memory", triples: "memory", propositions: "memory", memories: "memory",
  model: "model", retriever: "model", llm: "model",
  index: "index", build: "index",
  search: "search", ranking: "search",
  seed: "seed",
  agent: "agent", run: "agent", trajectory: "agent",
  grade: "grade", verdict: "grade",
};

export function parseSteps(code: string): { code: string; labels: (string | null)[] } {
  const labels: (string | null)[] = [];
  const lines = code.replace(/\n+$/, "").split("\n").map((line) => {
    const m = STEP.exec(line);
    labels.push(m ? m[1] : null);
    return m ? line.slice(0, m.index).replace(/\s+$/, "") : line;
  });
  return { code: lines.join("\n"), labels };
}

/** the code as it is copied: without the `#@ Label` markers */
export function stripSteps(code: string): string {
  return parseSteps(code).code;
}

export default async function HighlightedCode({ code, lang = "python" }: { code: string; lang?: string }) {
  const { code: clean, labels } = parseSteps(code);
  const hasSteps = labels.some(Boolean);
  const transformers: ShikiTransformer[] = hasSteps
    ? [{
        line(node, line) {
          const label = labels[line - 1];
          if (!label) return;
          const kind = STEP_KIND[label.toLowerCase().split(/[\s/+]/)[0]] ?? "other";
          this.addClassToHast(node, ["lgr-step", `lgr-step-${kind}`]);
          node.properties["data-step"] = label;
        },
      }]
    : [];
  const html = await codeToHtml(clean, { lang, theme: "github-dark-default", transformers });
  return (
    <div
      className={`text-[13px] leading-6 [&_pre]:!bg-transparent [&_pre]:px-4 [&_pre]:py-3 [&_pre]:overflow-x-auto [&_pre]:m-0 [&_code]:font-mono ${
        hasSteps ? "lgr-steps" : ""
      }`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
