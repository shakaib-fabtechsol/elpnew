/**
 * Leave taken and asked for.
 *
 * A request is the employee's half - type, dates and reason. The decision is
 * management's half, and stays empty until one is made, so a request can never
 * look decided before it is.
 */

const DAY = 24 * 60 * 60 * 1000;

/**
 * The kinds of absence, and what each one is worth.
 *
 * The entitlement travels with the type rather than being written on a form
 * somewhere: it is the rule for that leave, and it is the same rule wherever
 * the leave is asked for. Several are a range because the law gives different
 * lengths for different circumstances - a bereavement depends on who died, and
 * widowhood on the woman's faith - so the exact figure is settled when the
 * request is decided, not when it is typed.
 */
export const ABSENCE_CATEGORIES = [
  {
    name: "Regular Leave",
    types: [
      { name: "Annual Leave", entitlement: "30 Days" },
      { name: "Sick Leave", entitlement: "Up to 182 Days" },
      { name: "Unpaid Leave", entitlement: "As Approved" },
    ],
  },
  {
    name: "Family Leave",
    types: [
      { name: "Paternity Leave", entitlement: "7 Days" },
      { name: "Maternity Leave", entitlement: "98 Days" },
      { name: "Marriage Leave", entitlement: "3 Days" },
      { name: "Bereavement Leave", entitlement: "2 / 3 / 10 Days" },
      { name: "Widowhood Leave", entitlement: "130 / 14 Days" },
    ],
  },
  {
    name: "Special Leave",
    types: [
      { name: "Hajj Leave", entitlement: "15 Days" },
      { name: "Study / Examination Leave", entitlement: "Up to 15 Days" },
      { name: "Patient Escort Leave", entitlement: "15 Days" },
    ],
  },
];

/** The types one category offers. */
export const typesIn = (category) =>
  ABSENCE_CATEGORIES.find((c) => c.name === category)?.types || [];

/** What a leave type is worth, wherever it is named. */
export function entitlementOf(type) {
  for (const category of ABSENCE_CATEGORIES) {
    const found = category.types.find((t) => t.name === type);
    if (found) return found.entitlement;
  }
  return "";
}

export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected"];

/**
 * The three stages a request goes through: the employee asks, the department
 * reviews, and management decides. A request sits at one of them until it is
 * approved or refused.
 */
export const LEAVE_STAGES = [
  { key: "submit", title: "Submit Request", note: "Leave request details" },
  { key: "department", title: "Relevant Department Approval", note: "Department review and approval" },
  { key: "management", title: "Management Approval", note: "Final management decision" },
];

/** "LEV-001", counted across the firm so a number is never reused. */
export const nextLeaveNo = (leaves) =>
  "LEV-" +
  String(
    leaves.reduce(
      (max, l) => Math.max(max, Number(String(l.leaveNo || "").replace(/\D/g, "")) || 0),
      0
    ) + 1
  ).padStart(3, "0");

/** What a reviewer can say about a request. */
export const LEAVE_DECISIONS = ["Approve", "Reject"];

/** A decision already taken, read back as what it did: "Approved". */
export const decisionTaken = (decision) =>
  decision === "Approve" ? "Approved" : decision === "Reject" ? "Rejected" : "";

/**
 * The stage a request is waiting at, so opening it from the list picks up
 * where it was left. A decided request opens on the stage that decided it.
 */
export const stageOf = (leave) => {
  if (leave.status !== "Pending") return "management";
  return leave.stage === "management" ? "management" : "department";
};

/**
 * Days of annual leave paid out instead of taken. Recorded with the leave so
 * they come off the balance like days taken, and say so on the list.
 */
export const ENCASHED_PAID = "Encashed – Paid";

/** Where the request stands, as the workflow column reads it. */
export const workflowLabel = (leave) => {
  if (leave.status === ENCASHED_PAID) return "Leave Encashment · " + (leave.encashmentNo || "Paid");
  if (leave.status === "Approved") return "Approved by Management";
  if (leave.status === "Rejected") return "Rejected";
  return leave.stage === "management"
    ? "Pending Management Approval"
    : "Pending Department Approval";
};

/** How a status is dressed wherever it is shown. */
export const LEAVE_STATUS_TONE = {
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  [ENCASHED_PAID]: "bg-blue-100 text-blue-800",
};

/**
 * How long a leave runs, counted inclusively.
 *
 * Never stored: a saved day count can disagree with the two dates it came
 * from, and the dates are what the employee actually asked for. Leaving on the
 * 1st and returning on the 5th is five days away, not four.
 */
export function leaveDays(from, to) {
  if (!from || !to) return 0;
  const days = Math.round((new Date(to) - new Date(from)) / DAY) + 1;
  return days > 0 ? days : 0;
}

/** The days a leave record counts for: its dates, or the days encashed. */
export const daysOf = (leave) =>
  leave.status === ENCASHED_PAID ? Number(leave.days || 0) : leaveDays(leave.from, leave.to);

/** The year a leave falls in: the year it starts in. */
export const leaveYear = (from) => (from ? from.slice(0, 4) : "");

/**
 * Advance annual leave: days taken now against next year's entitlement.
 *
 * Someone who has used up this year's annual leave can still be granted days
 * out of next year's. The leave is taken in this year but paid for out of
 * next, so the record carries the year it is charged to, and every balance is
 * counted by that year rather than by the dates.
 */
export const ADVANCE_LEAVE = "Advance Annual Leave";

export const chargedYear = (leave) => leave.year || leaveYear(leave.from);

// Only leave taken on dates can be taken in advance; encashed days have none.
export const isAdvance = (leave) =>
  Boolean(leave.from) && chargedYear(leave) > leaveYear(leave.from);

/** What a leave is called on a row: an advance says so. */
export const leaveTypeLabel = (leave) =>
  isAdvance(leave) ? ADVANCE_LEAVE : leave.type;

export const initialLeaves = [];

/** Everything one person has asked for, soonest first. */
export const leavesFor = (leaves, name) =>
  leaves
    .filter((leave) => leave.employee === name)
    .sort((a, b) => a.from.localeCompare(b.from));

/** The years a person has leave charged to, newest first, for the year picker. */
export const leaveYearsFor = (leaves, name) => [
  ...new Set(leavesFor(leaves, name).map(chargedYear)),
].sort((a, b) => b.localeCompare(a));

/**
 * The number of days an entitlement is worth, when it is a plain number.
 *
 * "30 Days" is a balance that can be counted down; "Up to 182 Days",
 * "As Approved" and "2 / 3 / 10 Days" are not - they depend on the case, and
 * are settled when the request is decided. Those return null rather than a
 * number nobody could stand behind.
 */
export function allowanceDays(type) {
  const match = /^(\d+) Days?$/.exec(entitlementOf(type));
  return match ? Number(match[1]) : null;
}

/**
 * What is left of one leave type in a year.
 *
 * Counted off the approved requests every time rather than stored: a balance
 * held as a number is a second copy of the leave already taken, and the two
 * drift apart the moment a request is corrected.
 *
 * Nothing carries over. A year that has ended has no balance left to give: on
 * the first day of the new year whatever was not taken expires, and the year
 * reads as fully used - which is also what makes an advance against next year
 * the only way to be granted days once this year's are gone.
 */
export function remainingBalance(leaves, name, type, year) {
  const allowance = allowanceDays(type);
  if (allowance === null) return null;

  const thisYear = String(new Date().getFullYear());
  if (String(year) < thisYear) {
    return { allowance, used: allowance, remaining: 0, expired: true };
  }

  // Counted by the year the leave is charged to, so days taken in advance come
  // off next year's entitlement rather than the year they were taken in.
  const used = leaves
    .filter(
      (leave) =>
        leave.employee === name &&
        leave.type === type &&
        chargedYear(leave) === String(year) &&
        (leave.status === "Approved" || leave.status === ENCASHED_PAID)
    )
    .reduce((sum, leave) => sum + daysOf(leave), 0);

  return { allowance, used, remaining: Math.max(allowance - used, 0), expired: false };
}

/**
 * Whether days can be asked for against next year.
 *
 * Only once this year's annual leave is gone: an advance is what is left to
 * ask for when there is nothing left to take, not a second balance to dip
 * into while the first still has days in it.
 */
export function canTakeAdvance(leaves, name, year) {
  const balance = remainingBalance(leaves, name, "Annual Leave", year);
  return Boolean(balance) && balance.remaining === 0;
}

/**
 * Whether somebody is away today.
 *
 * Approved leave covering the current date - not merely a request made, and
 * not a standing typed onto the employee record. A request still waiting on
 * a decision is not leave, and a record that says "On Leave" for a month
 * after the person came back is worse than saying nothing.
 */
export function onLeaveToday(leaves, name) {
  const today = new Date().toISOString().slice(0, 10);
  return leaves.some(
    (leave) =>
      leave.employee === name &&
      leave.status === "Approved" &&
      leave.from <= today &&
      leave.to >= today
  );
}

/**
 * Days of annual leave left to somebody this year.
 *
 * Counted off the approved requests rather than stored, for the same reason
 * the per-type balance is: a number kept on the record is a number that goes
 * stale the first time a request is approved anywhere else.
 */
export function annualLeaveLeft(leaves, name) {
  const balance = remainingBalance(
    leaves,
    name,
    "Annual Leave",
    String(new Date().getFullYear())
  );
  return balance ? balance.remaining : null;
}
