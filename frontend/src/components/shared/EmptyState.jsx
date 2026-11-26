import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What every table says when it has no rows to show - one component, so
 * every list in SADEED says it the same way.
 *
 * `label` is the record type in the plural ("employees", "invoices"). When a
 * search or filters are what emptied the list, it says so and offers the way
 * back: Clear Filters only while a filter is on, Clear Search only while
 * something is typed, both when both are.
 */
export default function EmptyState({
  label = "records",
  searching = false,
  filtering = false,
  onClearSearch,
  onClearFilters,
}) {
  const narrowed = searching || filtering;
  const showClearFilters = filtering && onClearFilters;
  const showClearSearch = searching && onClearSearch;

  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-muted-foreground">
        <SearchX className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="text-[15px] font-semibold text-primary">No {label} found</p>
      {narrowed && (
        <p className="text-sm text-muted-foreground">
          Try adjusting your search or filters.
        </p>
      )}
      {(showClearFilters || showClearSearch) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {showClearFilters && (
            <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
              Clear Filters
            </Button>
          )}
          {showClearSearch && (
            <Button type="button" variant="outline" size="sm" onClick={onClearSearch}>
              Clear Search
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
