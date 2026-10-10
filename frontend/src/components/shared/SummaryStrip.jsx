import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * How many columns the strip is divided into, by how many cells it holds.
 *
 * Two, three, four and six sit on the system's twelve-column grid, since
 * twelve divides by all of them. Five, seven, eight, nine and ten do not,
 * so those keep a track count of their own rather than being forced onto a
 * grid that cannot hold them evenly - a strip of seven figures with one of
 * them wider than the rest reads as a mistake.
 *
 * Written out rather than built up, because the class names have to be
 * readable in the file for the stylesheet to include them.
 */
const COLUMNS = {
  2: "form-grid form-grid-2",
  3: "form-grid form-grid-3",
  4: "form-grid",
  5: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
  6: "form-grid [&>*]:col-span-2",
  7: "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7",
  8: "grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-8",
  9: "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9",
  10: "grid grid-cols-1 sm:grid-cols-5 lg:grid-cols-10",
};

/**
 * The figures above a table, in one container rather than a row of cards.
 *
 * These are several readings of the same set of records, so they read across
 * as one line: one border around the lot, thin rules between them, and no gaps.
 * Separate cards said the opposite - that each figure was its own subject.
 *
 * A cell with an `onClick` is also the filter for the table below it, and the
 * selected one is underlined. The count belongs inside the label, because it
 * says how many of these there are rather than being a figure of its own.
 */
export default function SummaryStrip({ items, className }) {
  const columns = COLUMNS[Math.min(Math.max(items.length, 2), 10)];

  return (
    <Card className={className}>
      <CardContent
        className={cn(
          // Stacked on a narrow screen, so the rule between cells lies
          // across; side by side above that, where each cell draws its own
          // short rule (see below) instead.
          "grid grid-cols-1 divide-y divide-dashed p-0 sm:divide-y-0",
          columns
        )}
      >
        {items.map((item) => {
          const Cell = item.onClick ? "button" : "div";

          return (
            <Cell
              key={item.key ?? item.label}
              type={item.onClick ? "button" : undefined}
              onClick={item.onClick}
              className={cn(
                "relative px-4 py-3 text-start",
                // A half-height dashed rule, centred: enough to separate
                // the cells without ruling the strip into boxes. The first
                // cell has nothing to its left to be separated from.
                "sm:before:absolute sm:before:start-0 sm:before:top-1/2 sm:before:h-1/2 sm:before:-translate-y-1/2 sm:before:border-s sm:before:border-dashed sm:before:border-border sm:before:content-[''] sm:first:before:hidden",
                item.onClick &&
                  // focus-visible, not focus: a mouse click should not
                  // leave a ring drawn round the cell, but a keyboard
                  // user still has to be able to see where they are.
                  "transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              )}
            >
              <p
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold",
                  item.tone || "text-primary"
                )}
              >
                {/* A logo or icon, where the cell stands for something
                    with a face of its own - a bank, say. */}
                {item.mark}
                <span className="min-w-0 truncate">
                  {item.label}
                  {item.count !== undefined && " (" + item.count + ")"}
                </span>
                {/* A figure that belongs to the name rather than to the
                    value below it - how many banks, not how much. */}
                {item.trailing !== undefined && (
                  <span className="ms-auto shrink-0">{item.trailing}</span>
                )}
              </p>
              <p className="mt-1 text-lg font-bold">{item.value}</p>
              {item.note && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.note}
                </p>
              )}
              {item.selected && (
                <span
                  aria-hidden="true"
                  // bg-current, so the line is whatever colour the label
                  // is - red under Unpaid, green under Paid.
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-1 bg-current",
                    item.tone || "text-primary"
                  )}
                />
              )}
            </Cell>
          );
        })}
      </CardContent>
    </Card>
  );
}
