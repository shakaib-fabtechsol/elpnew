/**
 * What the firm owes an employee beyond the monthly salary.
 *
 * Every entitlement is claimed the same way: the employee asks, the office
 * decides, and the money is paid. So they share one booking (an employee
 * expense, under Allowance Request) and differ only in what the request is
 * for, which is what the subcategory says.
 */

export const ENTITLEMENT_EXPENSE_TYPE = "Employee Expenses";
export const ENTITLEMENT_CATEGORY = "Allowance Request";

/** What each tab's request is filed as. */
export const ENTITLEMENT_SUBCATEGORY = {
  leaveEncashment: "Leave Encashment Request",
  overtime: "Overtime Pay Request",
  medical: "Medical Allowance Request",
  transport: "Transport Allowance",
  assistance: "Assistance",
  travel: "Travel Allowance Request",
  airTicket: "Air Ticket Allowance Request",
  notice: "Notice Pay Request",
  endOfService: "End of Service Request",
};

/**
 * The two kinds of transport claim.
 *
 * General is travel on the firm's ordinary business, and needs only a sum.
 * Court-linked is travel for a case, so it names the file and the day - which
 * is what lets the trip be read back against the case it was for.
 */
export const TRANSPORT_GENERAL = "general";
export const TRANSPORT_COURT = "court";

/**
 * Assistance is help the firm gives, not an allowance it owes, so it is booked
 * under a category of its own and filed under the kind of help it was.
 */
export const ASSISTANCE_CATEGORY = "Assistance";
export const ASSISTANCE_TYPES = [
  "Medical Assistance",
  "Financial Assistance",
  "Emergency Assistance",
  "Bereavement Assistance",
  "Education Assistance",
];

/** Where a request stands. */
export const ENTITLEMENT_PENDING = "Pending";
export const ENTITLEMENT_APPROVED = "Approved";
export const ENTITLEMENT_REJECTED = "Rejected";
/**
 * Approved by management and waiting on the financial department to pay it:
 * the decision and the payment are two stages, made by two departments.
 */
export const ENTITLEMENT_AWAITING = "Awaiting Payment";

export const ENTITLEMENT_STATUS_CHIP = {
  [ENTITLEMENT_PENDING]: "bg-amber-100 text-amber-800",
  [ENTITLEMENT_AWAITING]: "bg-blue-100 text-blue-800",
  [ENTITLEMENT_APPROVED]: "bg-green-100 text-green-800",
  [ENTITLEMENT_REJECTED]: "bg-red-100 text-red-800",
};

/** A month of pay, divided into days - what one day of leave is worth. */
export const DAYS_IN_MONTH = 30;

/** A working day, for turning a monthly salary into an hourly rate. */
export const HOURS_IN_DAY = 8;

/**
 * What each tab asks for beyond the classification it shares with the rest.
 *
 * "leaveDays" counts days off a leave balance, "hours" counts overtime, and
 * everything else - medical allowance included - is a sum the employee
 * names. The amount follows from the
 * choice, so no tab asks for a figure it can work out.
 */
export const ENTITLEMENT_MODE = {
  leaveEncashment: "leaveDays",
  overtime: "hours",
};

export const modeOf = (kind) => ENTITLEMENT_MODE[kind] || "amount";

/** What one ordinary hour of the salary is worth. */
export const hourlyRate = (salary) =>
  Number((Number(salary || 0) / DAYS_IN_MONTH / HOURS_IN_DAY).toFixed(3));

/**
 * What a run of leave days is worth in money.
 *
 * Worked out from the salary every time, never stored: a figure saved beside
 * the days it came from is a figure that can disagree with them.
 */
export const encashmentAmount = (salary, days) =>
  Number(
    ((Number(salary || 0) / DAYS_IN_MONTH) * Number(days || 0)).toFixed(3)
  );

/**
 * What a month's overtime hours come to: the hours at the employee's
 * ordinary hourly rate. The rate is read off the salary rather than typed, so
 * the sum cannot disagree with the pay it is worked out from.
 */
export const overtimeAmount = (salary, hours) =>
  Number((hourlyRate(salary) * Number(hours || 0)).toFixed(3));

/** Everything one employee has claimed, newest first. */
export const entitlementsFor = (records, name, kind) =>
  records
    .filter((row) => row.employee === name && row.kind === kind)
    .sort(
      (a, b) =>
        String(b.requestDate).localeCompare(String(a.requestDate)) || b.id - a.id
    );

/**
 * The last request of the same kind this person had paid.
 *
 * What was given before is the first thing anyone deciding a request wants to
 * know, so it is read off the list rather than looked up by hand.
 */
export const lastSimilar = (records, name, kind, exceptId) =>
  records
    .filter(
      (row) =>
        row.employee === name &&
        row.kind === kind &&
        row.id !== exceptId &&
        row.status === ENTITLEMENT_APPROVED &&
        row.paymentDate
    )
    .sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)))[0] ||
  null;

/**
 * What has happened to one request, newest first.
 *
 * There is no separate log: each step leaves its own mark on the record - the
 * day it was asked for, the day it was decided, the day it was paid - so the
 * history is read back off those rather than kept twice and left to disagree.
 */
export const entitlementHistory = (record) => {
  if (!record) return [];
  const events = [];

  if (record.requestDate) {
    events.push({
      at: record.requestDate,
      action: "Request submitted",
      from: "-",
      to: ENTITLEMENT_PENDING,
      by: record.employee,
      amount: record.amount,
      comment: record.reason || "",
      reference: record.requestNo || "",
    });
  }

  if (record.decisionDate) {
    events.push({
      at: record.decisionDate,
      action: record.status === ENTITLEMENT_REJECTED ? "Request rejected" : "Request approved",
      from: ENTITLEMENT_PENDING,
      to: record.status,
      by: record.decidedBy || "Management",
      amount: record.status === ENTITLEMENT_REJECTED ? 0 : record.approvedAmount ?? record.amount,
      comment: record.managementComment || record.rejectionReason || "",
      reference: record.entitlementNo || "",
    });
  }

  if (record.paymentDate) {
    events.push({
      at: record.paymentDate,
      action: "Amount disbursed",
      from: ENTITLEMENT_APPROVED,
      to: ENTITLEMENT_APPROVED,
      by: record.decidedBy || "Management",
      amount: record.approvedAmount ?? record.amount,
      comment: record.method || "",
      reference: record.reference || "",
    });
  }

  return events.sort((a, b) => String(b.at).localeCompare(String(a.at)));
};

export const initialEntitlements = [];

/**
 * The letters each kind of request is numbered under.
 *
 * A number that says what it is can be quoted on its own - "OTR-004" tells
 * whoever hears it which list to look in, where "REQ-004" does not.
 */
export const REQUEST_PREFIX = {
  leaveEncashment: "LER",
  overtime: "OTR",
  medical: "MAR",
  transport: "TRA",
  assistance: "ASR",
  travel: "TAR",
  airTicket: "ATA",
  notice: "NPR",
  endOfService: "EOS",
};

/**
 * The next number in one kind's run: OTR-004.
 *
 * Counted across that kind alone, so each list numbers from one and two kinds
 * cannot hand out the same number.
 */
export function nextKindRequestNo(records, kind) {
  const prefix = (REQUEST_PREFIX[kind] || "REQ") + "-";
  const highest = records
    .filter((row) => String(row.requestNo || "").startsWith(prefix))
    .reduce(
      (max, row) =>
        Math.max(max, Number(String(row.requestNo).slice(prefix.length)) || 0),
      0
    );
  return prefix + String(highest + 1).padStart(3, "0");
}

/** "ENT-001", the number a request takes once it has been approved. */
export const nextEntitlementNo = (records) =>
  "ENT-" +
  String(
    records.reduce(
      (max, row) =>
        Math.max(max, Number(String(row.entitlementNo || "").replace(/\D/g, "")) || 0),
      0
    ) + 1
  ).padStart(3, "0");
