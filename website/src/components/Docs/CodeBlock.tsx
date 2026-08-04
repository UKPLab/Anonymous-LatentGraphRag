"use client";

import { ReactNode, useRef, useState } from "react";

/**
 * A fenced-code-block renderer with:
 *   - rehype-pretty-code syntax highlighting (already applied to children)
 *   - copy-to-clipboard button
 *   - optional language tag
 *   - optional filename caption (set via ```python title="example.py")
 */
interface CodeBlockProps {
  children?: ReactNode;
  "data-language"?: string;
  "data-theme"?: string;
  // rehype-pretty-code forwards anything in the meta string as data-* attributes
  // including `title` which we use for a filename caption.
  title?: string;
  [key: string]: unknown;
}

export default function CodeBlock({ children, ...rest }: CodeBlockProps) {
  const language = (rest["data-language"] as string | undefined) ?? "text";
  const title = rest.title as string | undefined;
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = ref.current?.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API blocked in some browsers; fail silently.
    }
  };

  return (
    <div className="my-5 rounded-xl border border-gray-200 bg-gray-950 overflow-hidden text-[13px]">
      {/* Caption + chrome */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
          {title ? <span className="text-gray-200">{title}</span> : null}
          {title && language ? <span className="text-gray-600">·</span> : null}
          <span>{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-gray-100 font-medium px-2 py-1 rounded hover:bg-gray-800 transition"
          aria-label="Copy code"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre
        ref={ref}
        className="overflow-x-auto px-4 py-3 text-gray-100 font-mono leading-6"
      >
        {children}
      </pre>
    </div>
  );
}
