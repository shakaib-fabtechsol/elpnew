import { cn } from "@/lib/utils";
import { EmptyState } from "./panels";

/**
 * A list of counts, drawn as bars against the largest of them.
 *
 * Tiles put every count in a box of its own, which makes them impossible to
 * compare: the eye has to read each number and hold it. A bar measured against
 * the biggest answers "where is the work" before a single number is read, so
 * the same data says more in the same space.
 *
 * The firm's dashboard and a client's both use it, so a breakdown looks the
 * same wherever it is read.
 */
export default function CountBars({ rows, onSelect, labelWidth = "w-44" }) {
  const shown = rows.filter(Boolean);
  if (shown.length === 0) {
    return <EmptyState>Nothing recorded yet.</EmptyState>;
  }

  // Measured against the busiest row rather than the total: with a dozen rows
  // every bar would be a sliver, and the comparison is between them anyway.
  const peak = Math.max(...shown.map((row) => row.count), 1);

  return (
    <div className="space-y-2">
      {shown.map((row) => {
        const bar = (
          <>
            <span className={cn("shrink-0 truncate text-sm", labelWidth)}>
              {row.label}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: (row.count / peak) * 100 + "%" }}
              />
            </span>
            <span className="w-10 shrink-0 text-end text-sm font-semibold">
              {row.count}
            </span>
          </>
        );

        return onSelect ? (
          <button
            key={row.label}
            type="button"
            onClick={() => onSelect(row)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {bar}
          </button>
        ) : (
          <div
            key={row.label}
            className="flex w-full items-center gap-3 px-2 py-1.5"
          >
            {bar}
          </div>
        );
      })}
    </div>
  );
}
