"use client";

import { ReactNode } from "react";
import TopNav from "./TopNav";
import Sidebar from "./Sidebar";
import OnThisPage from "./OnThisPage";

/**
 * Client shell for /docs/* routes: sidebar | content | on-this-page TOC.
 *
 * The outer container uses `max-w-screen-2xl` (1536px) so wide monitors get a
 * meaningful layout instead of a narrow centered column floating in whitespace.
 * The sidebars stay fixed-width; the center grows.
 */
export default function DocsShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div data-pagefind-ignore="all">
        <TopNav />
      </div>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 xl:px-8 flex flex-col lg:flex-row gap-8 py-8">
        <aside
          data-pagefind-ignore="all"
          className="lg:w-60 lg:shrink-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
        >
          <Sidebar />
        </aside>
        <main className="flex-1 min-w-0" data-pagefind-body>
          <article className="prose-docs max-w-4xl">{children}</article>
        </main>
        <aside
          data-pagefind-ignore="all"
          className="hidden xl:block xl:w-60 xl:shrink-0 xl:sticky xl:top-20 xl:self-start xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto"
        >
          <OnThisPage />
        </aside>
      </div>
    </div>
  );
}
