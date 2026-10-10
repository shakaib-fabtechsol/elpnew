/**
 * Helpers for filling the app's existing stores with what the API returned.
 *
 * The screens read module-level arrays (employeeRecords, loanRecords...) and
 * providers seeded from them. Replacing an array's contents in place - rather
 * than the array - keeps every import of it pointing at the live data.
 */

/** Puts `rows` into `target` in place of what it held. */
export function replaceAll(target, rows) {
  target.splice(0, target.length, ...rows);
  return target;
}

/** Puts one record in place of the one with the same id, or adds it. */
export function upsert(target, row) {
  const index = target.findIndex((item) => item.id === row.id);
  if (index >= 0) target[index] = row;
  else target.push(row);
  return row;
}

/** The same, for a React state setter: returns the next list. */
export const upserted = (list, row) =>
  list.some((item) => item.id === row.id)
    ? list.map((item) => (item.id === row.id ? row : item))
    : [...list, row];

/** "2026-10-03T10:00:00.000000Z" -> "2026-10-03" */
export const dateOnly = (value) => (value ? String(value).slice(0, 10) : "");

/** A number the screens can add up; null and "" stay empty. */
export const num = (value) => (value === null || value === undefined || value === "" ? value : Number(value));
