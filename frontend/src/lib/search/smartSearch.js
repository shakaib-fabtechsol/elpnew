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
 *   branch:"al khuwair" only that field, a value of several words
 *   salary>1000        a number or a date compared: > >= < <=
 *   expiry<2027-03-01
 *   -merged            rows that do NOT match
 *   expired            any date on the row has passed
 *   expiring           any date falls inside the next 60 days
 *   active / inactive  a status field with that value
 *
 * A question in plain words ("lawyers in Salalah earning over 1500") is not
 * read here. The search box (AiSearch) sends it to the AI service, which
 * answers with a query in the syntax above - and that query is what arrives
 * here. The AI is told the list's columns (`fieldsSeenFor`), never its rows.
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

/** Splits a query into terms, keeping quoted phrases - and quoted field values - whole. */
function tokenise(query) {
  const tokens = [];
  const pattern = /-?(?:[A-Za-z_]\w*(?::|>=|<=|>|<))?(?:"[^"]*"|\S+)/g;
  let match;
  while ((match = pattern.exec(query))) {
    const raw = match[0];
    const negated = raw.startsWith("-");
    const body = (negated ? raw.slice(1) : raw).replace(/"/g, "");
    if (body) tokens.push({ body: body.toLowerCase(), negated });
  }
  return tokens;
}

/** A row's own field by name, whatever the letter case. */
const fieldOf = (row, name) =>
  Object.entries(row).find(([key]) => key.toLowerCase() === name);

const NUMBER = /^-?[\d,]+(?:\.\d+)?$/;

/**
 * A field compared with a value: as dates where both are dates, as numbers
 * where both are numbers. Anything else - an empty cell, a name asked to be
 * "more than" something - does not match rather than guessing.
 */
function compares(value, operator, wanted) {
  const have = String(value ?? "").trim();
  let left;
  let right;
  if (ISO_DATE.test(wanted) && ISO_DATE.test(have.slice(0, 10))) {
    left = have.slice(0, 10);
    right = wanted;
  } else if (NUMBER.test(wanted) && NUMBER.test(have)) {
    left = Number(have.replace(/,/g, ""));
    right = Number(wanted.replace(/,/g, ""));
  } else {
    return false;
  }
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  return left <= right;
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

  // field>value and its kin compare one field's number or date.
  const compared = body.match(/^([a-z_]\w*)(>=|<=|>|<)(.+)$/);
  if (compared) {
    const entry = fieldOf(row, compared[1]);
    return entry ? compares(entry[1], compared[2], compared[3]) : false;
  }

  // field:value narrows the search to one field.
  const colon = body.indexOf(":");
  if (colon > 0) {
    const field = body.slice(0, colon);
    const wanted = body.slice(colon + 1);
    const entry = fieldOf(row, field);
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

  // Which list this query was run over, for the AI to be told its columns.
  if (rows.length) {
    lastSearched.delete(trimmed);
    lastSearched.set(trimmed, rows);
    if (lastSearched.size > 6) lastSearched.delete(lastSearched.keys().next().value);
  }

  return rows.filter((row) =>
    tokens.every((token) => {
      const hit = matchesToken(row, token);
      return token.negated ? !hit : hit;
    })
  );
}

// The last few queries and the lists they were run over - what lets the
// search box describe a list's columns without every page handing them in.
const lastSearched = new Map();

const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * The columns of the list a query was last run over, as the AI is told them:
 * each field's name, whether it holds text, numbers or dates, and - only for
 * a field with a handful of values that repeat across rows, such as a status
 * or a department - those values. Names, numbers and anything particular to
 * one record are never included, and the rows themselves never leave.
 */
export function fieldsSeenFor(query) {
  const rows = lastSearched.get((query || "").trim()) || [];
  const sample = rows.slice(0, 300);
  if (!sample.length) return [];

  const keys = [...new Set(sample.flatMap((row) => Object.keys(row || {})))].filter((key) => FIELD_NAME.test(key));

  return keys
    .map((key) => {
      const values = sample
        .map((row) => row[key])
        .filter((value) => value !== null && value !== undefined && value !== "" && typeof value !== "object")
        .map(String);
      if (!values.length) return null;

      const kind = values.every((value) => ISO_DATE.test(value.slice(0, 10)))
        ? "date"
        : values.every((value) => NUMBER.test(value))
          ? "number"
          : "text";
      const distinct = [...new Set(values)];
      // Fixed values only: few of them, short, and each seen on several rows.
      const fixed =
        kind === "text" &&
        distinct.length <= 10 &&
        distinct.length * 2 <= values.length &&
        distinct.every((value) => value.length <= 40);

      return { key, kind, ...(fixed ? { values: distinct } : {}) };
    })
    .filter(Boolean)
    .slice(0, 60);
}
