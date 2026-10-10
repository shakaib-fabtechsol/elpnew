import { advanceStatusOf, initialAdvances } from "./advanceSalaryData";
import { loanRecords } from "./loanData";
import { assistanceRecords, statusOf } from "./assistanceData";
import { initialBonuses } from "./bonusData";
import { initialEntitlements } from "./entitlementData";
import { initialGeneralRequests, kindOf } from "./generalRequestData";

/**
 * How many of each kind of request one employee has made, and where they
 * stand - the figures on the Requests page's cards.
 *
 * Read from the same records the request pages list, so a card cannot claim a
 * number its own page does not show. A kind with no page of its own yet has
 * nothing to count.
 */

/** Where a request stands, in the four words the cards count by. */
const bucket = (status) => {
  if (status === "Returned") return "returned";
  if (status === "Rejected" || status === "Cancelled") return "rejected";
  if (status === "Pending") return "pending";
  return "approved";
};

const tally = (rows, statusOf) => {
  const counts = { total: rows.length, approved: 0, pending: 0, returned: 0, rejected: 0 };
  rows.forEach((row) => {
    counts[bucket(statusOf(row))] += 1;
  });
  return counts;
};

const plain = (row) => row.status;

const mine = (rows, name) => rows.filter((row) => row.employee === name);

/** An entitlement of one kind, as the Entitlements page keeps it. */
const entitlement = (kind) => (name) =>
  tally(
    mine(initialEntitlements, name).filter((row) => row.kind === kind),
    plain
  );

/** A general request, grievance or complaint, as its page keeps it. */
const administrative = (kind) => (name) =>
  tally(
    mine(initialGeneralRequests, name).filter((row) => kindOf(row) === kind),
    plain
  );

const COUNTERS = {
  salaryAdvance: (name) => tally(mine(initialAdvances, name), advanceStatusOf),
  loan: (name) => tally(mine(loanRecords, name), plain),
  assistance: (name) => tally(mine(assistanceRecords, name), statusOf),
  bonus: (name) => tally(mine(initialBonuses, name), plain),
  overtime: entitlement("overtime"),
  leavePay: entitlement("leaveEncashment"),
  medical: entitlement("medical"),
  transport: entitlement("transport"),
  travel: entitlement("travel"),
  airTicket: entitlement("airTicket"),
  notice: entitlement("notice"),
  gratuity: entitlement("endOfService"),
  general: administrative("general"),
  grievance: administrative("grievance"),
  complaint: administrative("complaint"),
};

const NONE = { total: 0, approved: 0, pending: 0, returned: 0, rejected: 0 };

/** { total, approved, pending, returned, rejected } for one kind of request. */
export const requestCountFor = (key, name) => COUNTERS[key]?.(name) ?? NONE;
