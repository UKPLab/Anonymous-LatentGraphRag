"use client";

/**
 * Results / Trajectories switch, shared by the overview and the viewer.
 *
 * Clicking a result opens that specific run's trajectories, which is the natural
 * path. This exists for the other direction: reaching the trajectories without
 * first having to pick a row.
 */

import Link from "next/link";
import { BarChart3, ListTree } from "lucide-react";

export default function ViewSwitch({
  view,
  dataset,
}: {
  view: "results" | "traces";
  dataset: string;
}) {
  const base =
    "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition border";
  const on = "bg-blue-600 text-white border-blue-600 shadow-sm";
  const off =
    "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900";

  return (
    <div className="inline-flex gap-2" role="tablist">
      <Link
        href="/traces"
        role="tab"
        aria-selected={view === "results"}
        className={`${base} ${view === "results" ? on : off}`}
      >
        <BarChart3 className="w-4 h-4" />
        Results
      </Link>
      <Link
        href={`/traces/results/?ds=${dataset}`}
        role="tab"
        aria-selected={view === "traces"}
        className={`${base} ${view === "traces" ? on : off}`}
      >
        <ListTree className="w-4 h-4" />
        Trajectories
      </Link>
    </div>
  );
}
