import Link from "next/link";
import { findAdjacent } from "@/lib/docsNav";

export default function PrevNext({ pathname }: { pathname: string }) {
  const { prev, next } = findAdjacent(pathname);
  if (!prev && !next) return null;
  return (
    <nav className="mt-16 pt-6 border-t border-gray-200 flex items-stretch justify-between gap-3 text-sm">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex-1 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 p-4 transition"
        >
          <p className="text-xs text-gray-500 mb-1">← Previous</p>
          <p className="font-semibold text-gray-900 group-hover:text-blue-700">
            {prev.title}
          </p>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex-1 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 p-4 transition text-right"
        >
          <p className="text-xs text-gray-500 mb-1">Next →</p>
          <p className="font-semibold text-gray-900 group-hover:text-blue-700">
            {next.title}
          </p>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </nav>
  );
}
