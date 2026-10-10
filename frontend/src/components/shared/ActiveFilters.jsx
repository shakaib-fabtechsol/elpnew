import { Button } from "@/components/ui/button";
import { X, Filter } from "lucide-react";

/**
 * Shows which filters the current view is narrowed by, and lets each one go.
 *
 * Arriving from a dashboard tile into a shorter list is confusing without this
 * - the count looks wrong until you can see why, and can undo it.
 */
export default function ActiveFilters({ filters, onClear, resultCount }) {
  if (!filters.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Filtered by</span>

      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onClear(filter.key)}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/70 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {filter.label}: {filter.display ? filter.display(filter.value) : filter.value}
          <X className="h-3 w-3" />
          <span className="sr-only">Remove this filter</span>
        </button>
      ))}

      <span className="text-xs text-muted-foreground">
        &middot; {resultCount} {resultCount === 1 ? "result" : "results"}
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="ms-auto h-7 text-xs"
        onClick={() => onClear()}
      >
        Clear all
      </Button>
    </div>
  );
}
