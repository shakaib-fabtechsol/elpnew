import { cn } from "@/lib/utils";

/**
 * The one table every list of records is drawn with.
 *
 * Standard 07: the body is frameless. There are no lines between columns -
 * only a rule under each row - because the padding already separates one
 * column from the next, and a full grid of lines competes with the data it is
 * supposed to be organising. The frame is a single outer border with the
 * container radius, and no shadow: a list is part of the page, not something
 * floating over it.
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
  return (
    <div className="overflow-x-auto rounded-container border border-container-border bg-card">
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
    <thead>
      <tr className="border-b border-container-border bg-table-head">
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
export function Th({ width, className, children }) {
  return (
    <th
      style={width ? { width } : undefined}
      className={cn(
        "px-4 py-3 text-start text-xs font-semibold text-table-head-ink",
        className
      )}
    >
      {children}
    </th>
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
        "border-b border-container-border align-top last:border-0",
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
      className={cn("px-4 py-3 align-top text-start", className)}
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
