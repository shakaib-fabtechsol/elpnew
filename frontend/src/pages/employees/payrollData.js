/**
 * What an employee is paid each month.
 *
 * A payslip is built from three groups: what is earned, what is held back, and
 * what is left. Only the first two are ever entered - every total is worked out
 * from them, so a payslip cannot state a net that its own lines do not support.
 */

/** The allowances that sit on top of basic pay, in the order they are asked for. */
export const ALLOWANCES = [
  { key: "special", label: "Special Allowance" },
  { key: "housing", label: "Housing Allowance" },
  { key: "transport", label: "Transportation Allowance" },
  { key: "electricity", label: "Electricity Allowance" },
  { key: "water", label: "Water Allowance" },
];

/** What can be held back from a month's pay. */
export const DEDUCTIONS = [
  { key: "loan", label: "Loan Installment" },
  { key: "administrative", label: "Administrative Deduction" },
];

const num = (value) => Number(value || 0);

/** Basic pay plus every allowance. */
export const totalEarnings = (draft) =>
  num(draft.basic) + ALLOWANCES.reduce((sum, a) => sum + num(draft[a.key]), 0);

/** Everything held back this month. */
export const totalDeductions = (draft) =>
  DEDUCTIONS.reduce((sum, d) => sum + num(draft[d.key]), 0);

/** What is left once the deductions come off. */
export const netSalary = (draft) => totalEarnings(draft) - totalDeductions(draft);

/**
 * A payment covers a month, or a quarter when it is a quarterly bonus, so the
 * quarters sit in the same list rather than in a field of their own.
 */
export const PAYMENT_MONTHS = [
  { value: "Jan", label: "January" },
  { value: "Feb", label: "February" },
  { value: "Mar", label: "March" },
  { value: "Apr", label: "April" },
  { value: "May", label: "May" },
  { value: "Jun", label: "June" },
  { value: "Jul", label: "July" },
  { value: "Aug", label: "August" },
  { value: "Sep", label: "September" },
  { value: "Oct", label: "October" },
  { value: "Nov", label: "November" },
  { value: "Dec", label: "December" },
  { value: "Q1", label: "Q1 (Jan - Mar)" },
  { value: "Q2", label: "Q2 (Apr - Jun)" },
  { value: "Q3", label: "Q3 (Jul - Sep)" },
  { value: "Q4", label: "Q4 (Oct - Dec)" },
];

/** The short month names, in the order a date gives them. */
export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** The twelve months written out, as a salary period names them. */
export const MONTH_FULL = PAYMENT_MONTHS.slice(0, 12).map((month) => month.label);

/** A salary is paid for a month, never for a quarter. */
export const SALARY_MONTHS = PAYMENT_MONTHS.slice(0, 12);

export const PAYMENT_YEARS = ["2024", "2025", "2026", "2027"];

/** Where the money leaves from. Cash is listed with the banks, not apart. */
export const PAYMENT_SOURCES = [
  "Bank Muscat",
  "National Bank of Oman",
  "Bank Dhofar",
  "Oman Arab Bank",
  "Sohar International",
  "Ahli Bank",
  "Cash",
];

/** The account nearly every payment leaves from. */
export const DEFAULT_BANK = "Bank Muscat";

/** How the banks are written in the history, where the column is narrow. */
export const SOURCE_SHORT = {
  "Bank Muscat": "Bank Muscat",
  "National Bank of Oman": "NBO",
  "Bank Dhofar": "Bank Dhofar",
  "Oman Arab Bank": "OAB",
  "Sohar International": "Sohar",
  "Ahli Bank": "Ahli",
  Cash: "Cash",
};

/* --------------------------------------------------------------- amounts */

/** An amount as it is shown anywhere in the system: figure then currency. */
export { money as amount } from "@/lib/money";

/** "Aug 2026", or "Q2 2026" for a quarterly payment. */
export const period = (record) => record.month + " " + record.year;

/** "26/08/2026" */
export const formatDate = (value) => {
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
};

/* ------------------------------------------------------------- the record */

/**
 * Payments already made.
 *
 * `allowances` and `deductions` are held as the totals that were paid, because
 * a payslip is a record of what happened - if the housing allowance changes
 * next year, last year's payslip must not change with it.
 */
export const salaryRecords = [];

/** What was actually paid on a past payment. */
export const netAmount = (record) =>
  record.amount != null
    ? num(record.amount)
    : num(record.basic) + num(record.allowances) - num(record.deductions);

/* ------------------------------------------------- how a payment is booked */

/**
 * Where a payment to an employee lands in the accounts.
 *
 * Type -> Category -> Subcategory, the same three levels the rest of the
 * system books expenses by. Only the branches an employee can be paid under
 * are listed here; the full tree belongs to General Invoices.
 */
export const PAYROLL_BOOKING = [
  {
    name: "Employee Expenses",
    categories: [
      {
        name: "Salaries & Bonuses",
        subcategories: [
          "Salary",
          "Salary Advance",
          "Bonus",
          "Overtime",
          "Commission",
          "Leave Salary",
          "End of Service Benefit",
        ],
      },
      {
        name: "Allowances & Benefits",
        subcategories: [
          "Housing Allowance",
          "Transportation Allowance",
          "Phone Allowance",
          "Other Allowance",
        ],
      },
    ],
  },
  {
    name: "Employee Advances & Loans",
    categories: [
      {
        name: "Advances & Loans",
        subcategories: ["Employee Loan", "Other Advance"],
      },
    ],
  },
];

/** The categories under a type, and the subcategories under those. */
export const categoriesOf = (type) =>
  PAYROLL_BOOKING.find((t) => t.name === type)?.categories || [];

export const subcategoriesOf = (type, category) =>
  categoriesOf(type).find((c) => c.name === category)?.subcategories || [];

/** What a salary is booked as unless somebody says otherwise. */
/**
 * Payments whose amount is not the monthly salary.
 *
 * A bonus, overtime, a commission, leave pay and an end-of-service settlement
 * are all worked out elsewhere, so the figure is entered rather than read off
 * the payslip - and the payslip summary is not shown, because it would be
 * describing a different payment. Nothing is asked for but the amount.
 */
export const ENTERED_AMOUNT = [
  "Bonus",
  "Overtime",
  "Commission",
  "Leave Salary",
  "End of Service Benefit",
];

/** Payments that cover a span of service rather than one month. */
export const WITH_PERIOD = ["End of Service Benefit"];

export const entersAmount = (subcategory) =>
  ENTERED_AMOUNT.includes(subcategory);

export const hasPeriod = (subcategory) => WITH_PERIOD.includes(subcategory);

export const DEFAULT_BOOKING = {
  expenseType: "Employee Expenses",
  category: "Salaries & Bonuses",
  subcategory: "Salary",
};

/* ------------------------------------------------- the salary history */

/**
 * The loan the monthly deductions are running against.
 *
 * One loan, described once: how much was borrowed, what comes off each month,
 * and over how many months. Everything the history shows about it - which
 * installment a month is, what is left, how many are still to come - is worked
 * out from this and from what was actually deducted, so no row can claim a
 * balance the deductions do not support.
 */
export const SALARY_LOAN = { principal: 0, installment: 0, count: 0 };

/**
 * What was paid each month, oldest first.
 *
 * Only what actually happened is recorded: the pay, the allowances, what came
 * off for the loan and what came off administratively, why that was held back,
 * and the account the rest went to. The net is not here - it is those figures,
 * and a stored total could disagree with them.
 */
export const salaryHistory = [];

/** "SAL-001", counted across the record so a number is never reused. */
export const nextSalaryNo = (history) =>
  "SAL-" +
  String(
    history.reduce(
      (max, row) =>
        Math.max(max, Number(String(row.salaryNo || "").replace(/\D/g, "")) || 0),
      0
    ) + 1
  ).padStart(3, "0");

/**
 * Where a salary stands.
 *
 * A salary starts as a request: it is on the list straight away, under a
 * temporary number, until it is either approved - when it takes the next
 * salary number - or refused.
 */
export const SALARY_PENDING = "Pending";
export const SALARY_REJECTED = "Rejected";
export const SALARY_TRANSFERRED = "Transferred";

export const SALARY_STATUS_TONE = {
  [SALARY_TRANSFERRED]: "bg-green-100 text-green-800",
  [SALARY_PENDING]: "bg-amber-100 text-amber-800",
  [SALARY_REJECTED]: "bg-red-100 text-red-800",
};

/** "REQ-001", the temporary number a salary carries until it is approved. */
export const nextRequestNo = (history) =>
  "REQ-" +
  String(
    history.reduce(
      (max, row) =>
        Math.max(max, Number(String(row.requestNo || "").replace(/\D/g, "")) || 0),
      0
    ) + 1
  ).padStart(3, "0");

/** What the list calls a salary: its number, or the request's until it has one. */
export const salaryRef = (record) => record.salaryNo || record.requestNo || "-";

/** A salary nobody has approved yet is still a request. */
export const isSalaryRequest = (record) => !record.salaryNo;

/** The month a salary is for, written out: "September 2026". */
export const salaryPeriod = (record) =>
  (MONTH_FULL[record.month - 1] || "") + " " + record.year;

/**
 * The history with everything that can be worked out, worked out.
 *
 * Read in order, oldest first, because each month's remaining loan depends on
 * every month before it. A month with nothing deducted is not an installment
 * at all, so it does not consume one.
 */
export function salaryHistoryRows(history = salaryHistory, loan = SALARY_LOAN) {
  let paid = 0;
  let taken = 0;

  const rows = [...history]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((record) => {
      const due = record.loanDeducted > 0 ? loan.installment : 0;
      if (record.loanDeducted > 0) {
        paid += record.loanDeducted;
        taken += 1;
      }

      return {
        ...record,
        gross: record.basic + record.allowances,
        // Everything held back from the month, as the summary reads it: the
        // loan installment and the administrative deduction are one figure to
        // whoever is checking what was transferred.
        deductions: record.loanDeducted + record.administrative,
        net: record.basic + record.allowances - record.loanDeducted - record.administrative,
        loan: {
          due,
          deducted: record.loanDeducted,
          // Full, part, or no installment at all - read off the two figures
          // rather than stamped on the record.
          state:
            record.loanDeducted === 0
              ? "none"
              : record.loanDeducted >= due
                ? "full"
                : "partial",
          shortfall: Math.max(due - record.loanDeducted, 0),
          number: taken,
          count: loan.count,
          remaining: Math.max(loan.principal - paid, 0),
          remainingInstallments: Math.max(loan.count - taken, 0),
        },
      };
    });

  // Newest first to read, though the sums were run oldest first - and a
  // request nobody has decided sits above them all, because it is the one
  // waiting on somebody.
  rows.reverse();
  return [
    ...rows.filter((row) => !row.salaryNo),
    ...rows.filter((row) => row.salaryNo),
  ];
}
