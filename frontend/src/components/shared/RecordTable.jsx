import { cn } from "@/lib/utils";
import { SortButton } from "./SortMark";
import EmptyState from "./EmptyState";

// Loading and failure rows for hand-drawn tables, from the one place every
// table takes them: see TableStates.jsx.
export { SkeletonRows, ErrorRow } from "./TableStates";

/**
 * The one table every list of records is drawn with.
 *
 * Drawn as the client's Employees sheet draws its table, the one look every
 * SADEED table has (as DataTable's "sheet"): centred bold headings, a thin
 * rule between columns and under each row, plain white rows, content in the
 * middle of each cell. The frame is a single outer border with the container
 * radius, and no shadow.
 *
 * Anything a particular table needs on top of that is passed as a class; the
 * frame itself is not re-described in each file.
 *
 * Text reads from the logical start and money from the logical end, the way a
 * ledger is read - `text-end` on an amount column is for that, and it goes on
 * the heading and the cells together so the figures line up under their name.
 * Logical rather than left and right, so the whole thing turns round in
 * Arabic instead of staying put.
 */
export function RecordTable({ minWidth = 1040, children, className }) {
  // A box of its own, capped in height, so a long list scrolls inside it and
  // its heading row stays in sight at the top (HeadRow is sticky) - a table
  // that scrolls sideways cannot hold its heading against the page instead.
  return (
    <div className="max-h-[min(70vh,720px)] overflow-auto rounded-container border border-container-border bg-card">
      <table
        style={{ minWidth }}
        className={cn("table-hover-lines w-full text-start text-sm", className)}
      >
        {children}
      </table>
    </div>
  );
}

/** The header, which is always one row: no column is split over two lines. */
export function HeadRow({ children }) {
  return (
    <thead className="sticky top-0 z-10">
      <tr className="border-b border-container-border bg-table-head shadow-[0_1px_0_0_var(--container-border)]">
        {children}
      </tr>
    </thead>
  );
}

/**
 * One column heading: the title and nothing else.
 *
 * Title Case as written, never forced to capitals - "Employee Name" is read
 * faster than "EMPLOYEE NAME", and shouting every heading tells nobody which
 * one matters. What a column is made of is plain from the cells under it, so
 * no bracketed explanation follows the title.
 */
export function Th({ width, className, children, sortable, direction, onSort }) {
  return (
    <th
      style={width ? { width } : undefined}
      aria-sort={
        direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined
      }
      className={cn(
        "border-e border-container-border px-4 py-3 align-middle text-[15px] font-bold text-primary last:border-e-0",
        className,
        // Every heading centred, as the sheet draws them, whichever way its
        // column's figures read.
        "text-center"
      )}
    >
      {/* Sortable by the system's sorting standard (lib/sorting.js): pass
          the props useTableSort's sortProps(key) gives. */}
      {sortable && onSort ? (
        <SortButton direction={direction} onSort={onSort} className="text-center">
          {children}
        </SortButton>
      ) : (
        children
      )}
    </th>
  );
}

/**
 * The row a hand-drawn table shows when it has nothing to list - the same
 * empty state DataTable shows, spanning every column.
 */
export function EmptyRow({ colSpan, ...props }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState {...props} />
      </td>
    </tr>
  );
}

/**
 * One record.
 *
 * White and unruled: stripes say a row is different when the only thing
 * different about it is that it is even-numbered, and a rule under every row
 * draws a grid the data never asked for. The padding does the separating.
 *
 * Where the pointer is, is said with a tint over the whole row and nothing
 * else - see the table row hover rule in the stylesheet. Nothing is drawn around
 * the row or the cell on top of that: the rule under the row is there either
 * way, and a second line arriving under the pointer only flickers.
 */
export function Row({ className, children }) {
  return (
    <tr
      className={cn(
        "border-b border-container-border align-middle last:border-0",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Td({ className, colSpan, children }) {
  return (
    <td
      className={cn(
        "border-e border-container-border px-4 py-3 align-middle text-start last:border-e-0",
        className
      )}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}

/**
 * The first cell of a row: the record's own number, and the way into it.
 *
 * Standard 07 puts the way in on the reference itself rather than in a View
 * column of its own - the number is what somebody looks for anyway, and a
 * column holding one repeated word is a column of nothing.
 */
export function RecordLink({ onClick, className, children, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "numeric-value rounded text-start font-medium text-record-link",
        "hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
