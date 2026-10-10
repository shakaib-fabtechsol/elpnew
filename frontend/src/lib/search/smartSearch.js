/**
 * Contextual search over a table.
 *
 * Every value on a row is searched, not only the columns on screen, so a query
 * finds data the table renders inside a cell or does not show at all. Terms are
 * ANDed, which is what people expect when they type two words.
 *
 * Supported in a query:
 *
 *   bank muscat        both words must appear somewhere on the row
 *   "gulf construction" the phrase, as written
 *   type:bank          only that field
 *   -merged            rows that do NOT match
 *   expired            any date on the row has passed
 *   expiring           any date falls inside the next 60 days
 *   active / inactive  a status field with that value
 *
 * `runAiSearch` is the seam for a real AI service. Give DataTable an
 * `onAiSearch` handler and the query goes there instead of here, so swapping in
 * a model later touches nothing else.
 */

const DAY = 24 * 60 * 60 * 1000;
export const EXPIRING_SOON_DAYS = 60;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A term matches where a word starts with it.
 *
 * Plain "contains" would make "active" match "Inactive" and "paid" match
 * "Unpaid", which reads as a bug. Anchoring to a word start still lets a
 * half-typed word match, so search-as-you-type keeps working.
 */
function containsWordStartingWith(value, term) {
  return new RegExp("\\b" + escapeRegex(term), "i").test(value);
}

/** Every primitive value on a row, including nested objects. */
function valuesOf(row, depth = 0) {
  if (row === null || row === undefined || depth > 3) return [];
  if (typeof row !== "object") return [String(row)];
  return Object.values(row).flatMap((value) => valuesOf(value, depth + 1));
}

const datesOf = (row) =>
  valuesOf(row).filter((value) => ISO_DATE.test(value));

/** Splits a query into terms, keeping quoted phrases whole. */
function tokenise(query) {
  const tokens = [];
  const pattern = /-?(?:"[^"]*"|\S+)/g;
  let match;
  while ((match = pattern.exec(query))) {
    const raw = match[0];
    const negated = raw.startsWith("-");
    const body = (negated ? raw.slice(1) : raw).replace(/"/g, "");
    if (body) tokens.push({ body: body.toLowerCase(), negated });
  }
  return tokens;
}

/** Conditions a plain word can stand for. */
const WORD_CONDITIONS = {
  expired: (row) =>
    datesOf(row).some((d) => new Date(d) < startOfToday()),
  expiring: (row) =>
    datesOf(row).some((d) => {
      const days = (new Date(d) - startOfToday()) / DAY;
      return days >= 0 && days <= EXPIRING_SOON_DAYS;
    }),
  overdue: (row) =>
    datesOf(row).some((d) => new Date(d) < startOfToday()),
};

function matchesToken(row, token) {
  const { body } = token;

  // field:value narrows the search to one field.
  const colon = body.indexOf(":");
  if (colon > 0) {
    const field = body.slice(0, colon);
    const wanted = body.slice(colon + 1);
    const entry = Object.entries(row).find(
      ([key]) => key.toLowerCase() === field
    );
    if (entry) {
      return containsWordStartingWith(String(entry[1] ?? ""), wanted);
    }
  }

  const condition = WORD_CONDITIONS[body];
  if (condition && condition(row)) return true;

  return valuesOf(row).some((value) => containsWordStartingWith(value, body));
}

/** Filters rows by a query. An empty query returns everything. */
export function smartSearch(rows, query) {
  const trimmed = (query || "").trim();
  if (!trimmed) return rows;

  const tokens = tokenise(trimmed);
  if (!tokens.length) return rows;

  return rows.filter((row) =>
    tokens.every((token) => {
      const hit = matchesToken(row, token);
      return token.negated ? !hit : hit;
    })
  );
}
