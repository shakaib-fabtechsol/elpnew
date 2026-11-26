import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Which way a column is sorted - the one mark every SADEED table uses.
 *
 * An idle arrow on every heading is a row of arrows, and a row of arrows
 * reads as decoration, so the unsorted mark appears when the heading is
 * pointed at or focused.
 */
export function SortMark({ direction }) {
  if (!direction) {
    return (
      <ChevronsUpDown className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/sort:opacity-40 group-focus-visible/sort:opacity-40" />
    );
  }
  const Icon = direction === "asc" ? ChevronUp : ChevronDown;
  return <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />;
}

/** A column heading's title, as a button that sorts the column. */
export function SortButton({ direction, onSort, className, children }) {
  return (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        "group/sort inline-flex items-start gap-1 rounded text-start hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <span>{children}</span>
      <SortMark direction={direction} />
    </button>
  );
}
