/**
 * The client's cases, one record each.
 *
 * Analytics used to read pre-summed monthly totals, which could answer "how
 * many cases this month" but not "how many commercial cases this month" - the
 * breakdown simply was not in the data. Holding the cases themselves means
 * every figure on the page is counted from the same list, so a type total and a
 * period total can never contradict each other.
 */

const DAY = 24 * 60 * 60 * 1000;

/** The case types the client works in. */
export const CASE_TYPES = [
  "Criminal Cases",
  "Civil Cases",
  "Commercial Cases",
  "Labor Cases",
  "Family/Personal Status Cases",
  "Real Estate Cases",
  "Administrative Cases",
];

/**
 * The court a case stands before.
 *
 * A case sent back to a differently constituted panel, or raised as a dispute
 * over the ruling, is at the same court but is a case of its own - so each is
 * counted separately rather than folded back into the plain level.
 */
export const CASE_LEVELS = [
  "Primary",
  "Appeal",
  "Supreme",
  "Execution",
  "Primary (Different Panel)",
  "Appeal (Different Panel)",
  "Supreme (Different Panel)",
  "Primary (Dispute)",
  "Appeal (Dispute)",
  "Supreme (Dispute)",
];

/**
 * Where a case has reached in the office's own handling of it, as opposed to
 * which court it stands before. A closed file has reached the last of them.
 */
export const CASE_STAGES = [
  "Case Registration",
  "Running Cases",
  "Post Judgement",
  "Close file",
];


export const clientCases = [];

/**
 * A deleted case is struck off but not thrown away.
 *
 * Every other figure on the page is counted from the live cases, so a deletion
 * takes a case out of the totals the moment it happens - but the case is still
 * there to be counted on its own, which is the point of recording the deletion
 * rather than removing the row.
 */
export const isDeleted = (legalCase) => legalCase.deletedAt !== null;

export const liveCases = clientCases.filter((k) => !isDeleted(k));
export const deletedCases = clientCases.filter(isDeleted);

export const isOpen = (legalCase) => legalCase.closedAt === null;

/** What a set of files claims between them. */
export const claimTotal = (cases) =>
  cases.reduce((sum, k) => sum + Number(k.claimAmount || 0), 0);

/** The count shown beside the page title: live cases still open. */
export const activeCaseCount = liveCases.filter(isOpen).length;


/**
 * A case counts as in progress once it is past registration - the file is open
 * and something is actually happening on it.
 */
export const isInProgress = (legalCase) =>
  isOpen(legalCase) && legalCase.stage !== "Case Registration";

/** Cases received between two dates, inclusive. */
export const receivedBetween = (cases, from, to) =>
  cases.filter((k) => k.receivedAt >= from && k.receivedAt <= to);

/** Counts per key, keeping every key so an empty one still shows as zero. */
export function countBy(cases, keys, pick) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const legalCase of cases) {
    const key = pick(legalCase);
    if (key in counts) counts[key] += 1;
  }
  return counts;
}

/* ------------------------------------------------- the Cases Received cards */

const startOfMonth = (offset) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toIso = (date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

const monthLabel = (date) =>
  date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/**
 * The periods the Cases Received cards cover: each of the last three months,
 * the three of them together, then this year and last.
 */
export function receivedPeriods() {
  const periods = [];

  for (let back = 0; back < 3; back++) {
    const from = startOfMonth(-back);
    const to = new Date(startOfMonth(-back + 1).getTime() - DAY);
    periods.push({ label: monthLabel(from), from: toIso(from), to: toIso(to) });
  }

  const threeFrom = startOfMonth(-2);
  const threeTo = new Date(startOfMonth(1).getTime() - DAY);
  periods.push({
    label: "Last 3 Months",
    from: toIso(threeFrom),
    to: toIso(threeTo),
  });

  const year = new Date().getFullYear();
  periods.push({
    label: String(year),
    from: year + "-01-01",
    to: year + "-12-31",
  });
  periods.push({
    label: String(year - 1),
    from: year - 1 + "-01-01",
    to: year - 1 + "-12-31",
  });

  return periods;
}
