import { useState } from "react";

/**
 * SADEED's table sorting standard - one rule for every table in the system.
 *
 *   Column type                 Ascending        Descending
 *   text   (names, words)       A - Z            Z - A
 *   number (numbers, IDs)       ascending        descending
 *   money  (financial values)   low -> high      high -> low
 *   date                        oldest -> newest newest -> oldest
 *   balance                     lowest -> highest highest -> lowest
 *   status (status / priority)  the defined order, then reversed
 *   false  (descriptive or combined information) not sortable
 *
 * A column says which it is with `sort`. Where it does not, the type is read
 * off the values it holds - but a column that combines several facts in one
 * cell must say `sort: false`, since nothing in its values says so.
 *
 * Money, numbers and balances are compared as numbers, never as the text on
 * screen: "1,950.000 OMR" sorts after "300.000 OMR", not before it.
 */

/**
 * The order statuses and priorities are read in: what needs somebody first,
 * what is finished or gone last. A column whose statuses mean something else
 * passes its own `sortOrder`.
 */
export const STATUS_ORDER = [
  // Priority
  "critical",
  "urgent",
  "high",
  "medium",
  "normal",
  "low",
  // Waiting on somebody
  "draft",
  "new",
  "open",
  "submitted",
  "pending",
  "awaiting approval",
  "under review",
  "in review",
  "in progress",
  "on hold",
  "overdue",
  "unpaid",
  "partially paid",
  // Papers
  "expired",
  "expiring soon",
  "missing",
  "incomplete",
  "valid",
  "complete",
  // Settled
  "approved",
  "active",
  "paid",
  "completed",
  "closed",
  // Ended
  "rejected",
  "cancelled",
  "canceled",
  "inactive",
];

const DASHES = new Set(["", "-", "–", "—", "n/a"]);

const blank = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && DASHES.has(value.trim().toLowerCase()));

/**
 * "1,950.000 OMR", "OMR 300", "-12.5", "A006" -> the number they are.
 * A dash is a minus sign only where it stands on its own before the figure,
 * so the dash in "EMP-0010" is read as the separator it is. (References made
 * of several numbers, like "INV-2024-011", are IDs: they sort as "text",
 * which already puts the digits inside them in numeric order.)
 */
function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value);
  const match = text.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const at = match.index;
  const negative = text[at - 1] === "-" && (at === 1 || /\s/.test(text[at - 2]));
  const n = parseFloat(match[0].replace(/,/g, ""));
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const DMY_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const WORDY_DATE = /^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$|^[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4}$|^[A-Za-z]{3,}\s+\d{4}$/;

/** A date as the firm writes it - 2026-11-07, 07/11/2026, 07 Nov 2026 - as a time. */
function toTime(value) {
  if (value instanceof Date) return value.getTime();
  const text = String(value).trim();
  const dmy = text.match(DMY_DATE);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]).getTime();
  const time = Date.parse(text);
  return Number.isNaN(time) ? null : time;
}

const looksLikeDate = (value) =>
  value instanceof Date ||
  (typeof value === "string" &&
    (ISO_DATE.test(value.trim()) || DMY_DATE.test(value.trim()) || WORDY_DATE.test(value.trim())));

// A figure, with a currency or unit at most: "1,950.000 OMR", "OMR -5", "12%".
// "EMP-0001" and "A006" are references, not figures, and sort as text.
const looksLikeNumber = (value) =>
  typeof value === "number" ||
  (typeof value === "string" &&
    /^(?:[A-Za-z]{1,4}\s+)?-?[\d,]+(\.\d+)?(?:\s*[A-Za-z%]{1,4})?$/.test(value.trim()));

const STATUS_COLUMN = /status|priority|stage|state/i;

/** What a column sorts on, for one row. */
export function rawSortValue(column, row) {
  if (column.sortValue) return column.sortValue(row);
  if (column.exportValue) return column.exportValue(row);
  return row[column.key];
}

/**
 * The sort type a column has: its own `sort`, or what its values look like.
 * `false` where there is nothing sensible to sort by.
 */
export function sortTypeOf(column, rows) {
  if (column.sort !== undefined) return column.sort;
  if (column.disableSort) return false;
  if (column.key === "actions" || !column.header) return false;

  const values = rows.map((row) => rawSortValue(column, row)).filter((v) => !blank(v));
  if (!values.length) return false;
  // A cell built from several facts has nothing single to be put in order by.
  if (values.some((v) => typeof v === "object" && !(v instanceof Date))) return false;

  if (STATUS_COLUMN.test(column.key) || STATUS_COLUMN.test(String(column.header))) {
    return "status";
  }
  if (values.every(looksLikeDate)) return "date";
  if (values.every(looksLikeNumber)) return "number";
  return "text";
}

/** The value a row is compared by, for a column of the given type. */
function comparable(type, value, order) {
  if (blank(value)) return null;
  switch (type) {
    case "number":
    case "money":
    case "balance":
      return toNumber(value);
    case "date":
      return toTime(value);
    case "status": {
      const said = String(value).trim().toLowerCase();
      const at = (order || STATUS_ORDER).findIndex((s) => String(s).toLowerCase() === said);
      // Anything not in the list comes after everything that is, A - Z.
      return [at === -1 ? Number.MAX_SAFE_INTEGER : at, said];
    }
    default:
      return String(value).trim().toLowerCase();
  }
}

function compare(left, right) {
  if (Array.isArray(left)) {
    return left[0] - right[0] || left[1].localeCompare(right[1]);
  }
  if (typeof left === "number") return left - right;
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * The rows in the order a column asks for. Blanks always go last, whichever
 * way the column points, so turning a sort round never leads with empties.
 */
export function sortRows(rows, column, direction, type) {
  const dir = direction === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, key: comparable(type, rawSortValue(column, row), column.sortOrder) }))
    .sort((a, b) => {
      if (a.key === null && b.key === null) return a.index - b.index;
      if (a.key === null) return 1;
      if (b.key === null) return -1;
      return compare(a.key, b.key) * dir || a.index - b.index;
    })
    .map((entry) => entry.row);
}

/**
 * Off, then ascending, then descending, then off again - so a sort can always
 * be taken back off. The same on every table.
 */
export function nextSort(previous, key) {
  if (previous?.key !== key) return { key, direction: "asc" };
  return previous.direction === "asc" ? { key, direction: "desc" } : null;
}

/**
 * Sorting for a table drawn by hand with RecordTable's pieces.
 *
 *   const { rows, sortProps } = useTableSort(records, columns);
 *   <SortableTh {...sortProps("amount")}>Amount</SortableTh>
 *
 * `columns` is { key: { sort, sortValue, sortOrder } } - the same column
 * description DataTable reads, keyed by column.
 */
export function useTableSort(data, columns) {
  const [sort, setSort] = useState(null);
  const columnFor = (key) => ({ key, header: key, ...(columns[key] || {}) });

  let rows = data;
  if (sort) {
    const column = columnFor(sort.key);
    const type = sortTypeOf(column, data);
    if (type) rows = sortRows(data, column, sort.direction, type);
  }

  const sortProps = (key) => {
    const column = columnFor(key);
    const sortable = Boolean(sortTypeOf(column, data));
    return {
      sortable,
      direction: sort?.key === key ? sort.direction : null,
      onSort: () => setSort((previous) => nextSort(previous, key)),
    };
  };

  return { rows, sort, setSort, sortProps };
}
