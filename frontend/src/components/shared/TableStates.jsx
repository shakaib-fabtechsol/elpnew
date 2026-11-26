import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What every SADEED table shows while its records are on their way, and when
 * they could not be fetched - one pattern, used by DataTable and by the tables
 * drawn by hand with RecordTable's pieces.
 */

/** A grey bar standing in for a line of text. */
export function Bone({ className }) {
  return <span aria-hidden="true" className={cn("block animate-pulse rounded bg-slate-200/80", className)} />;
}

// Widths vary row to row so the column reads as text still coming, not as a
// grid of identical blocks.
const WIDTHS = ["w-3/4", "w-2/3", "w-4/5", "w-3/5", "w-2/3", "w-3/4", "w-1/2", "w-4/5", "w-3/5", "w-2/3"];

/**
 * One skeleton cell. `shape` is the column's own `skeleton`:
 *   "avatar"  a round photo and two lines (a person)
 *   "lines"   two lines (a cell with a heading and detail under it)
 *   default   one line
 */
export function SkeletonCell({ shape, row = 0 }) {
  const width = WIDTHS[row % WIDTHS.length];
  if (shape === "avatar") {
    return (
      <span className="flex items-center gap-3">
        <Bone className="size-9 shrink-0 rounded-full" />
        <span className="flex-1 space-y-2">
          <Bone className={cn("h-3", width)} />
          <Bone className="h-2.5 w-1/2" />
        </span>
      </span>
    );
  }
  if (shape === "lines") {
    return (
      <span className="block space-y-2">
        <Bone className={cn("h-3", width)} />
        <Bone className="h-2.5 w-1/2" />
      </span>
    );
  }
  return <Bone className={cn("h-3", width)} />;
}

/**
 * Skeleton rows for a hand-drawn table, in the table's own columns, so the
 * layout holds still and the records drop into place when they arrive.
 * `shapes` gives a column's skeleton shape by position, where it is not one line.
 */
export function SkeletonRows({ columns, rows = 6, shapes = [] }) {
  return Array.from({ length: rows }, (_, row) => (
    <tr key={"skeleton-" + row} aria-hidden="true" className="border-b border-container-border last:border-0">
      {Array.from({ length: columns }, (_, column) => (
        <td key={column} className="px-4 py-4 align-middle">
          <SkeletonCell shape={shapes[column]} row={row + column} />
        </td>
      ))}
    </tr>
  ));
}

/**
 * The records could not be fetched: said inside the table, where they would
 * have been, with the way to try again. Retrying reloads only these records -
 * the search, filters, sorting, page and page size all stay as they were.
 */
export function LoadError({ label = "records", onRetry, retrying }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertCircle className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="text-[15px] font-semibold text-primary">Unable to load {label}</p>
      <p className="text-sm text-muted-foreground">Please try again.</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry} disabled={retrying}>
          <RotateCw className={cn("me-2 size-4", retrying && "animate-spin")} aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  );
}

/** The same, as a row spanning a hand-drawn table. */
export function ErrorRow({ colSpan, ...props }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <LoadError {...props} />
      </td>
    </tr>
  );
}
