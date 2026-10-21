import type { Cell } from "@/data/lgrPaper";

/** One cell as printed in the paper: bold = best, underline = second, significant Δ in green,
 * dagger / star as superscripts. The value string is never reformatted. */
export function CellView({ cell, className = "" }: { cell: Cell; className?: string }) {
  const cls = [
    cell.best ? "font-bold text-gray-900" : "",
    cell.second ? "underline decoration-gray-400 underline-offset-2" : "",
    cell.sig ? "font-semibold text-green-700" : "",
    className,
  ].join(" ");
  return (
    <span className={cls}>
      {cell.value}
      {cell.dagger && <sup>†</sup>}
      {cell.star && <sup>∗</sup>}
    </span>
  );
}

export interface ColumnGroup {
  benchmark: string;
  metrics: readonly string[];
}

export interface TableRow {
  label: string;
  note?: string;
  cells: Cell[];
  /** "lgr" rows are tinted; `strong` marks the paper's headline configuration. */
  tone?: "lgr" | "rdr" | "plain";
  strong?: boolean;
}

export interface RowGroup {
  title?: string;
  note?: string;
  rows: TableRow[];
}

const TONE: Record<NonNullable<TableRow["tone"]>, string> = {
  lgr: "bg-blue-50/60",
  rdr: "bg-sky-50/40",
  plain: "",
};

/** A paper table with a two-row header (benchmark groups over their metrics). */
export default function PaperTable({
  firstColumn,
  columns,
  groups,
  caption,
}: {
  firstColumn: string;
  columns: readonly ColumnGroup[];
  groups: RowGroup[];
  caption?: React.ReactNode;
}) {
  const nCols = 1 + columns.reduce((n, c) => n + c.metrics.length, 0);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs tabular-nums border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th rowSpan={2} className="px-3 py-2 text-left font-semibold text-gray-700 align-bottom">
                {firstColumn}
              </th>
              {columns.map((c) => (
                <th
                  key={c.benchmark}
                  colSpan={c.metrics.length}
                  className="px-3 pt-2 pb-1 text-center font-semibold text-gray-700 border-l border-gray-200"
                >
                  {c.benchmark}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.flatMap((c) =>
                c.metrics.map((m, i) => (
                  <th
                    key={`${c.benchmark}-${m}-${i}`}
                    className={`px-3 pb-2 text-center font-medium text-gray-500 ${i === 0 ? "border-l border-gray-200" : ""}`}
                  >
                    {m}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => (
              <GroupRows key={gi} group={g} nCols={nCols} columns={columns} />
            ))}
          </tbody>
        </table>
      </div>
      {caption && <div className="px-4 py-3 border-t border-gray-100 text-[11px] text-gray-500 leading-relaxed">{caption}</div>}
    </div>
  );
}

function GroupRows({ group, nCols, columns }: { group: RowGroup; nCols: number; columns: readonly ColumnGroup[] }) {
  const starts = new Set<number>();
  let k = 0;
  for (const c of columns) {
    starts.add(k);
    k += c.metrics.length;
  }
  return (
    <>
      {(group.title || group.note) && (
        <tr className="border-t border-gray-200">
          <td colSpan={nCols} className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
            {group.title}
            {group.note && <span className="normal-case tracking-normal font-normal text-gray-400"> · {group.note}</span>}
          </td>
        </tr>
      )}
      {group.rows.map((r) => (
        <tr key={r.label + (r.note ?? "")} className={`border-t border-gray-100 ${TONE[r.tone ?? "plain"]}`}>
          <td className={`px-3 py-1.5 text-left ${r.strong ? "font-semibold text-blue-900" : "text-gray-700"}`}>
            {r.label}
            {r.note && <span className="text-gray-400"> ({r.note})</span>}
          </td>
          {r.cells.map((cell, i) => (
            <td
              key={i}
              className={`px-3 py-1.5 text-center text-gray-600 ${starts.has(i) ? "border-l border-gray-100" : ""}`}
            >
              <CellView cell={cell} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
