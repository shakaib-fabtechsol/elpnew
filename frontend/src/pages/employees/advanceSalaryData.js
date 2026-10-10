/**
 * Advances an employee asks for against their own salary.
 *
 * This is the one thing on the salary page the employee does rather than the
 * firm: they ask, the office decides, and the amount comes back out of a month
 * they name. So it is asked for on My Profile and nowhere else - the firm does
 * not ask for an advance on somebody's behalf.
 */

export const ADVANCE_STATUSES = ["Pending", "Approved", "Rejected"];

export const ADVANCE_STATUS_TONE = {
  Pending: "text-amber-600",
  Approved: "text-green-700",
  Rejected: "text-destructive",
};

/** Where a request has got to, as the chip under its number reads it. */
export const ADVANCE_STATUS_CHIP = {
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  // Handed back by management, waiting on the employee to correct it.
  Returned: "bg-orange-100 text-orange-800",
};

/**
 * Where a request stands, as the list says it. A request handed back is
 * still waiting, but on the employee rather than on management - so it is
 * said apart from one that has not been looked at yet.
 */
export const advanceStatusOf = (advance) =>
  advance.status === "Pending" && advance.decision === "completion" ? "Returned" : advance.status;

/** How an advance is filed once it is paid: the same booking every time. */
export const ADVANCE_BOOKING = {
  expenseType: "Employee Expenses",
  category: "Salary",
  subcategory: "Salary Advance",
};

/**
 * What the financial department can book an advance as. The booking above is
 * what it is set to; the lists say what else it may be put under.
 */
export const DISBURSEMENT_TYPES = ["Employee Expenses", "Employee Advances & Loans"];
export const DISBURSEMENT_CATEGORIES = ["Salary", "Advances & Loans"];
export const DISBURSEMENT_SUBCATEGORIES = ["Salary Advance", "Other Employee Advance"];

/** How a saved decision reads on the review's status chip. */
export const DECISION_STATUS = {
  full: "Fully Approved",
  partial: "Partially Approved",
};

/** What an advance can be asked for. The last asks the employee to say. */
export const ADVANCE_PURPOSES = [
  "Emergency Case",
  "Education Expenses",
  "Medical Expenses",
  "Family Expenses",
  "Other (Please specify)",
];
export const OTHER_PURPOSE = "Other (Please specify)";

/**
 * "SA-2026-00012": the year it was asked in, then a count across the firm so
 * a number is never reused. The count is the number's last part.
 */
export const nextAdvanceNo = (advances, year = new Date().getFullYear()) =>
  "SA-" +
  year +
  "-" +
  String(
    advances.reduce(
      (max, a) => Math.max(max, Number(String(a.requestNo || "").split("-").pop()) || 0),
      0
    ) + 1
  ).padStart(5, "0");

/** The months, as an advance names the one it comes out of. */
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * What is still owed on advances already granted.
 *
 * An advance comes back out of one named month, so it is owed until that month
 * has been reached; once it has, the salary for it carried the deduction.
 */
export const owedAdvances = (advances, name, today = new Date()) => {
  const reached = today.getFullYear() * 12 + today.getMonth();
  return advances.filter(
    (advance) =>
      advance.employee === name &&
      advance.status === "Approved" &&
      Number(advance.deductYear) * 12 + MONTHS.indexOf(advance.deductMonth) >
        reached
  );
};

/**
 * What those advances come to.
 *
 * Counted off the same list the payroll takes them from, so the figure on the
 * request form and the figure coming off the pay cannot disagree.
 */
export const outstandingAdvance = (advances, name, today = new Date()) =>
  owedAdvances(advances, name, today).reduce(
    (total, advance) => total + Number(advance.approvedAmount ?? advance.amount ?? 0),
    0
  );

/** One person's requests, newest first. */
export const advancesFor = (advances, name) =>
  advances
    .filter((advance) => advance.employee === name)
    .sort((a, b) => b.requestedOn.localeCompare(a.requestedOn) || b.id - a.id);

/** The month the advance is to be deducted from, as it reads on a row. */
export const deductedFrom = (advance) =>
  advance.deductMonth && advance.deductYear
    ? advance.deductMonth + " " + advance.deductYear
    : "-";

export const initialAdvances = [];
