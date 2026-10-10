/**
 * General requests: anything an employee asks the administration for that has
 * no form of its own - a parking card, a laptop, a chair.
 *
 * The request is the employee's half - what kind of request it is, what they
 * are asking for, and any paper that supports it. The decision is the
 * administration's half, and stays empty until one is made, so a request can
 * never look decided before it is.
 */

/**
 * What kind of thing is being raised.
 *
 * Asked for instead of a subject line: a subject is a sentence somebody has
 * to compose, and two people describing the same thing write it two ways,
 * which is no use to anyone sorting a year of them.
 */
export const REQUEST_TYPES = [
  "Suggestions",
  "Report",
  "Administrative Request",
  "Other Requests",
];

/**
 * The administrative requests that share this form, and what sets each
 * apart: its name, the letters it is numbered under, and the kinds of thing
 * it can be about. A record without a `kind` is a general request.
 */
export const REQUEST_KINDS = {
  general: {
    title: "General Request",
    noun: "general request",
    prefix: "GR",
    typeLabel: "Request Type",
    types: REQUEST_TYPES,
  },
  grievance: {
    title: "Grievance",
    noun: "grievance",
    prefix: "GRV",
    typeLabel: "Grievance Type",
    types: [
      "Pay & Benefits",
      "Working Conditions",
      "Workload & Hours",
      "Management Decision",
      "Other Grievance",
    ],
  },
  complaint: {
    title: "Complaint",
    noun: "complaint",
    prefix: "CMP",
    typeLabel: "Complaint Type",
    types: [
      "Harassment",
      "Discrimination",
      "Misconduct",
      "Health & Safety",
      "Other Complaint",
    ],
  },
};

/** Which kind a record is, reading an unmarked one as a general request. */
export const kindOf = (request) => request.kind || "general";

/** How long each side of the conversation may be, so the form can say so. */
export const COMMENT_LIMIT = 500;
export const DECISION_COMMENT_LIMIT = 300;

export const REQUEST_STATUSES = ["Pending", "Approved", "Rejected"];

/** The two answers the administration can give. */
export const APPROVED = "Approved";
export const REJECTED = "Rejected";

/** How a status is dressed wherever it is shown - the same as leave. */
export const REQUEST_STATUS_TONE = {
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
};

/** Today as a plain YYYY-MM-DD in the user's own timezone. */
export const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

/** "10/09/2026" - the short form, because dates are compared down a column. */
export const shortDate = (value) => {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  return day + "/" + month + "/" + year;
};

export const initialGeneralRequests = [];

/** Everything one person has asked for of one kind, newest first. */
export const requestsFor = (requests, name, kind = "general") =>
  requests
    .filter((request) => request.employee === name && kindOf(request) === kind)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.requestNo.localeCompare(a.requestNo)
    );

/**
 * The next number in the year's run of one kind: GR-2026-006, GRV-2026-003.
 *
 * Counted across every request of the kind, not just one person's, so two
 * people asking on the same day can never be given the same number.
 */
export function nextRequestNo(requests, date, letters = "GR") {
  const prefix = letters + "-" + String(date).slice(0, 4) + "-";
  const highest = requests
    .filter((request) => request.requestNo.startsWith(prefix))
    .reduce(
      (max, request) =>
        Math.max(max, Number(request.requestNo.slice(prefix.length)) || 0),
      0
    );
  return prefix + String(highest + 1).padStart(3, "0");
}
