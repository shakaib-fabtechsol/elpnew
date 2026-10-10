/**
 * Loans taken by the firm.
 *
 * A loan is not a payment - it is drawn once and repaid over months - so the
 * record carries both sides: what was borrowed, and the schedule it comes back
 * on. Everything about that schedule is worked out from three figures, which is
 * why so few of the fields on the form are asked for.
 */

/** A loan taken for the first time, and money added to one already running. */
export const NEW_LOAN = "New Loan";
export const LOAN_INCREASE = "Loan Amount Increase";

/**
 * Where a loan lands in the accounts.
 *
 * Neither of these is a choice. A loan is always an employee expense, and
 * which of the two categories it falls under is decided by what the employee
 * already owes - asking would only invite an answer the loans contradict.
 */
export const LOAN_EXPENSE_TYPE = "Employee Expenses";

/** The one category a loan is booked under, whichever kind of loan it is. */
export const LOAN_CATEGORY = "Loan";

/* ------------------------------------------------------ where a request is */

/**
 * What has become of a request.
 *
 * A rejected or cancelled request is not money owed and never was, so neither
 * counts towards what the employee is carrying.
 */
export const LOAN_PENDING = "Pending";
export const LOAN_APPROVED = "Approved";
export const LOAN_REJECTED = "Rejected";
export const LOAN_CANCELLED = "Cancelled";
/** Handed back to the employee to complete; it waits on them, not on management. */
export const LOAN_RETURNED = "Returned";

/**
 * How management answered a request.
 *
 * A full approval grants what was asked for; a partial one grants amended
 * terms. Both are money in hand, so both count as approved.
 */
export const LOAN_FULL_APPROVAL = "Full Approval";
export const LOAN_PARTIAL_APPROVAL = "Partial Approval";

/** The answer a decision on the form turns into on the record. */
export const LOAN_DECISION_STATUS = {
  full: LOAN_FULL_APPROVAL,
  partial: LOAN_PARTIAL_APPROVAL,
  completion: LOAN_RETURNED,
  rejected: LOAN_REJECTED,
};

export const LOAN_STATUS_TONE = {
  [LOAN_PENDING]: "text-amber-600",
  [LOAN_APPROVED]: "text-green-700",
  [LOAN_FULL_APPROVAL]: "text-green-700",
  [LOAN_PARTIAL_APPROVAL]: "text-blue-700",
  [LOAN_REJECTED]: "text-destructive",
  [LOAN_RETURNED]: "text-orange-600",
  [LOAN_CANCELLED]: "text-muted-foreground",
};

/** The same statuses as a chip, where the table shows one. */
export const LOAN_STATUS_CHIP = {
  [LOAN_PENDING]: "bg-amber-100 text-amber-800",
  [LOAN_APPROVED]: "bg-green-100 text-green-800",
  [LOAN_FULL_APPROVAL]: "bg-green-100 text-green-800",
  [LOAN_PARTIAL_APPROVAL]: "bg-blue-100 text-blue-800",
  [LOAN_REJECTED]: "bg-red-100 text-red-800",
  [LOAN_RETURNED]: "bg-orange-100 text-orange-800",
  [LOAN_CANCELLED]: "bg-muted text-muted-foreground",
};

/** Granted, whether in full or on amended terms. */
export const isApprovedLoan = (record) =>
  record.status === LOAN_APPROVED ||
  record.status === LOAN_FULL_APPROVAL ||
  record.status === LOAN_PARTIAL_APPROVAL;

/** A request that was turned down or withdrawn counts for nothing. */
export const isLiveLoan = (record) =>
  record.status !== LOAN_REJECTED && record.status !== LOAN_CANCELLED;

/** What has been repaid against one loan. */
export const paidOn = (record) =>
  (record.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

/** What is still owed on one loan. */
export const outstandingOf = (record) =>
  Math.max(Number((loanTotal(record) - paidOn(record)).toFixed(3)), 0);

/**
 * What the employee still owes on everything approved.
 *
 * A request waiting for a decision is not money in hand, so it is not counted
 * here; nor is anything rejected or cancelled.
 */
export const outstandingTotal = (records) =>
  Number(
    records
      .filter(isApprovedLoan)
      .reduce((sum, record) => sum + outstandingOf(record), 0)
      .toFixed(3)
  );

/** The request still waiting for a decision, if there is one. */
export const pendingRequest = (records) =>
  records.find((record) => record.status === LOAN_PENDING || record.status === LOAN_RETURNED) || null;

/**
 * Which of the two categories a new request falls under.
 *
 * Nothing owed - no loan yet, or the last one repaid in full - is a new loan;
 * anything still outstanding makes the request an increase on it.
 */
export const loanCategoryFor = (records) =>
  outstandingTotal(records) > 0 ? LOAN_INCREASE : NEW_LOAN;

/* ------------------------------------------------------- the repayment plan */

/**
 * The schedule a loan comes back on.
 *
 * The last instalment is whatever is left after the whole ones, so it is
 * smaller than the rest unless the total divides evenly. Nothing here is typed
 * in - a schedule that disagreed with the amount it repays would be wrong on
 * the face of it.
 */
export function schedule(total, monthly) {
  if (!total || !monthly || monthly <= 0) {
    return { months: 0, installment: monthly || 0, last: 0 };
  }
  const months = Math.ceil(total / monthly);
  const last = Number((total - (months - 1) * monthly).toFixed(3));
  return { months, installment: monthly, last };
}

/** An amount as it is shown anywhere in the system: figure then currency. */
export { money as amount } from "@/lib/money";

/** "26/08/2026" */
/** "LNR-001", counted across the firm so a number is never reused. */
export const nextLoanNo = (records) =>
  "LNR-" +
  String(
    records.reduce(
      (max, record) =>
        Math.max(max, Number(String(record.requestNo || "").replace(/\D/g, "")) || 0),
      0
    ) + 1
  ).padStart(3, "0");

const MONTH_NAMES = [
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
 * The months a repayment can start in: this one and the two years after it.
 *
 * A month is what is asked for rather than a date, because an installment
 * always comes off the pay at the end of a month - there is no day to choose.
 */
export const startMonths = (count = 24, from = new Date()) =>
  Array.from({ length: count }, (_, index) => {
    const month = new Date(Date.UTC(from.getFullYear(), from.getMonth() + index, 1));
    return MONTH_NAMES[month.getUTCMonth()] + " " + month.getUTCFullYear();
  });

/** The day the first installment falls due: the end of the month it starts in. */
export const monthEnd = (label) => {
  const [name, year] = String(label || "").split(" ");
  const month = MONTH_NAMES.indexOf(name);
  if (month < 0 || !year) return "";
  return new Date(Date.UTC(Number(year), month + 1, 0)).toISOString().slice(0, 10);
};

export const formatDate = (value) => {
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Aug 2026", read off the payment date rather than asked for twice. */
export const period = (value) => {
  const [year, month] = String(value).split("-");
  return MONTHS[Number(month) - 1] + " " + year;
};

/**
 * The month a run of instalments ends on.
 *
 * Counted forward from the date the money goes out, so the end date cannot be
 * typed to say something the instalment count does not.
 */
export function endDate(start, months) {
  const count = Number(months);
  if (!start || !count) return "";
  const [year, month, day] = start.split("-").map(Number);
  const date = new Date(year, month - 1 + count, day);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
  );
}

/** What a row of the schedule is waiting for, or no longer is. */
export const INSTALLMENT_STATUS_TONE = {
  Paid: "bg-green-100 text-green-800",
  "Partially Paid": "bg-blue-100 text-blue-800",
  Deferred: "bg-amber-100 text-amber-800",
  Pending: "bg-muted text-muted-foreground",
};

/** What the loan is repaying: its own amount plus anything merged into it. */
export const loanTotal = (record) =>
  Number(record.loanAmount || 0) + Number(record.merged || 0);

/** The year a loan belongs to, which is the year it was drawn. */
export const loanYear = (record) =>
  String(record.disbursementDate || record.firstDue || "").slice(0, 4);

/**
 * Every instalment of a loan, and what has been paid against it.
 *
 * The schedule is not stored: it follows from the amount, the monthly
 * instalment and the day the first one falls due, so it cannot drift out of
 * step with them. Only the payments are recorded - a row's status and the
 * balance left after it are read off those, which is why no figure here can
 * disagree with the one above it.
 */
export function scheduleRows(total, monthly, first, payments = []) {
  const plan = schedule(Number(total), Number(monthly));
  if (!plan.months || !first) return [];

  let paidSoFar = 0;

  return Array.from({ length: plan.months }, (_, index) => {
    const due = dueDate(first, index);
    const installment =
      index === plan.months - 1 ? plan.last : plan.installment;
    const payment = payments.find((entry) => entry.due === due);
    const paid = payment ? Number(payment.amount || 0) : 0;
    paidSoFar += paid;

    return {
      no: index + 1,
      of: plan.months,
      due,
      installment,
      paid,
      remaining: Number((Number(total) - paidSoFar).toFixed(3)),
      status:
        payment && payment.deferred
          ? "Deferred"
          : paid >= installment
            ? "Paid"
            : paid > 0
              ? "Partially Paid"
              : "Pending",
      paymentDate: payment ? payment.date || "" : "",
    };
  });
}

const lastDayOf = (year, month) => new Date(year, month + 1, 0).getDate();

/**
 * The day instalment `index` falls due, counted from the first one.
 *
 * A schedule that starts on the last day of a month stays on the last day of
 * every month after it - 30 September is followed by 31 October, not by the
 * 30th. Any other start keeps its own day, and shortens only where the month
 * is too short to hold it.
 */
export function dueDate(first, index) {
  if (!first) return "";
  const [year, month, day] = String(first).split("-").map(Number);
  const onMonthEnd = day === lastDayOf(year, month - 1);

  const target = new Date(year, month - 1 + index, 1);
  const targetYear = target.getFullYear();
  const targetMonth = target.getMonth();
  const last = lastDayOf(targetYear, targetMonth);

  const pad = (n) => String(n).padStart(2, "0");
  return (
    targetYear +
    "-" +
    pad(targetMonth + 1) +
    "-" +
    pad(onMonthEnd ? last : Math.min(day, last))
  );
}

/** How the banks are written in the list, where the column is narrow. */
export const SOURCE_SHORT = {
  "Bank Muscat": "Bank Muscat",
  "National Bank of Oman": "NBO",
  "Bank Dhofar": "Bank Dhofar",
  "Oman Arab Bank": "OAB",
  "Sohar International": "Sohar",
  "Ahli Bank": "Ahli",
};

/* ---------------------------------------------------------------- the list */

/**
 * Loans already drawn.
 *
 * `merged` is what was still owed on an earlier loan when this one absorbed
 * it, so the balance the schedule works down is the whole debt rather than
 * just the new draw. `payments` is the only record of repayment - everything
 * the list shows about an instalment is worked out from it.
 */
export const loanRecords = [];

/** Everything one employee has borrowed. */
export const loansFor = (records, name) =>
  records.filter((record) => record.employee === name);
