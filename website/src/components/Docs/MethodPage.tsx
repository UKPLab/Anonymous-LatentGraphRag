"use client";

import { ReactNode } from "react";
import PrevNext from "./PrevNext";

interface ParameterRow {
  name: string;
  type: string;
  default?: string;
  description: ReactNode;
}

interface MethodPageProps {
  pathname: string;
  title: string;
  lead: ReactNode;
  /** Code snippet (string) to render in the sticky left column. Highlighted via shiki at runtime — we keep this simple and use a dark monospace block instead. */
  code: string;
  /** The right-column demo component (typically auto-playing). */
  demo: ReactNode;
  parameters?: ParameterRow[];
  /** Optional rich content to render below the code/demo pair (algorithm, notes, citations). */
  children?: ReactNode;
}

/**
 * The standard layout for a search / corpus / fusion method page.
 *
 * On large screens: title + lead, then a 2-column body with a sticky code snippet on
 * the left and a sticky animation on the right. Below the fold: parameters, notes.
 *
 * On small screens: stacks vertically. The animation comes first below the code so
 * mobile readers see the visualization without scrolling far.
 */
export default function MethodPage({
  pathname,
  title,
  lead,
  code,
  demo,
  parameters,
  children,
}: MethodPageProps) {
  return (
    <article className="prose-docs">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mt-2 mb-2">
        {title}
      </h1>
      <div className="text-lg text-gray-600 leading-relaxed mb-8">{lead}</div>

      {/* Split row: sticky code on the left, sticky demo on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12 not-prose">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-gray-200 bg-gray-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
              <span className="text-xs text-gray-400 font-mono">python</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">live demo →</span>
            </div>
            <pre className="overflow-x-auto px-4 py-3 text-gray-100 font-mono text-[13px] leading-6 whitespace-pre">
              {code}
            </pre>
          </div>
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-3 min-h-[360px] flex items-center justify-center">
            {demo}
          </div>
        </div>
      </div>

      {/* Parameters table */}
      {parameters && parameters.length > 0 && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-12 mb-4 pb-2 border-b border-gray-200">
            Parameters
          </h2>
          <div className="my-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-gray-900 w-44">Name</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-900 w-36">Type</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-900 w-28">Default</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-900">Description</th>
                </tr>
              </thead>
              <tbody>
                {parameters.map((p) => (
                  <tr key={p.name} className="border-b border-gray-100 align-top">
                    <td className="px-4 py-2 font-mono text-blue-700 text-xs">{p.name}</td>
                    <td className="px-4 py-2 font-mono text-gray-600 text-xs">{p.type}</td>
                    <td className="px-4 py-2 font-mono text-gray-500 text-xs">{p.default ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-700">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Extra content (algorithms, notes) */}
      {children}

      <PrevNext pathname={pathname} />
    </article>
  );
}
