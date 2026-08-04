import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { ReactNode } from "react";
import CodeBlock from "@/components/Docs/CodeBlock";
import InlineCode from "@/components/Docs/InlineCode";

/**
 * Global MDX component overrides. Applied to every .mdx page in the site.
 *
 * Style tokens are intentionally close to the landing-page design system so the docs
 * feel like a continuation of the marketing page, not a foreign citizen.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mt-2 mb-6">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-gray-700 leading-7 my-4">{children}</p>
    ),
    a: ({ href, children }) => {
      const target = href ?? "#";
      const external = /^https?:\/\//.test(target);
      if (external) {
        return (
          <a
            href={target}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            {children}
          </a>
        );
      }
      return (
        <Link
          href={target}
          className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
        >
          {children}
        </Link>
      );
    },
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-6 my-4 space-y-1 text-gray-700">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-6 my-4 space-y-1 text-gray-700">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-7">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-300 bg-blue-50/50 px-4 py-2 my-5 text-gray-700 italic">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="text-left px-4 py-2 font-semibold text-gray-900">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 border-b border-gray-100 align-top text-gray-700">
        {children}
      </td>
    ),
    hr: () => <hr className="my-10 border-gray-200" />,
    // Inline `code` — but not when rendered as part of a <pre> block.
    code: ({ children, ...rest }: { children?: ReactNode; [key: string]: unknown }) => {
      // rehype-pretty-code adds data-language / data-theme attributes; pass through.
      if (rest["data-language"]) {
        return <code {...rest}>{children}</code>;
      }
      return <InlineCode>{children}</InlineCode>;
    },
    // Fenced code blocks (with copy button + filename caption).
    pre: ({ children, ...rest }) => <CodeBlock {...rest}>{children}</CodeBlock>,
    ...components,
  };
}
