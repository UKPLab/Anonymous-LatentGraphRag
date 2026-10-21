"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SearchDialog from "./SearchDialog";

export default function TopNav() {
  const pathname = usePathname();
  const inDocs = pathname.startsWith("/docs");
  const inTraces = pathname.startsWith("/traces");
  const onPaper = !inDocs && !inTraces;
  const tab = (active: boolean) =>
    `px-1.5 sm:px-3 py-1.5 rounded-md transition ${
      active
        ? "text-blue-700 font-semibold bg-blue-50"
        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
    }`;
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 xl:px-8 h-14 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 text-sm sm:text-base shrink-0">
          <span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-full" />
          <span>LatentGraphRAG</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <SearchDialog />
          <nav className="flex items-center sm:gap-1 text-sm">
            <Link href="/" className={`${tab(onPaper)} hidden sm:inline-block`}>
              Paper
            </Link>
            <Link href="/traces" className={tab(inTraces)}>
              Traces
            </Link>
            <Link href="/docs" className={tab(inDocs)}>
              Docs
            </Link>
            <a
              href="https://anonymous.4open.science/r/Anonymous-LatenGraphRag-57C9"
              target="_blank"
              rel="noopener noreferrer"
              className="px-1.5 sm:px-3 py-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              Code
            </a>
            <a
              href="https://anonymous.4open.science/w/Recursive-Dense-Retrieval/"
              target="_blank"
              rel="noopener noreferrer"
              title="Recursive Dense Retrieval, the retrieval backbone (anonymous project page)"
              className="px-1.5 sm:px-3 py-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              RDR<span aria-hidden className="ml-0.5 text-gray-400 hidden sm:inline">↗</span>
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
