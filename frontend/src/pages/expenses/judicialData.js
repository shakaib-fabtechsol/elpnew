/**
 * Judicial authority expenses - what the firm pays a court on a case's behalf.
 *
 * These are not supplier invoices. Every one of them belongs to a case file, so
 * the record carries the case it was paid for, the court that took the money,
 * and the transfer it went out on.
 */

/** The nine things a court is paid for. The tiles are drawn from this order. */
export const JUDICIAL_EXPENSE_TYPES = [
  "Lawsuit Filing Fees",
  "Supreme Court Deposit",
  "Petition Order Security Deposit",
  "Judicial Announcements",
  "Expert Fees",
  "Translation Expenses",
  "Document Expenses",
  "Prisoner Release Bail",
  "Execution Amount Payment",
];

/** Every one of these sits under the same category. */
export const JUDICIAL_CATEGORY = "Judicial Authority Expenses";

export const CASE_KINDS = [
  "Commercial Case",
  "Civil Case",
  "Labour Case",
  "Criminal Case",
  "Real Estate Case",
  "Administrative Case",
  "Family / Personal Status Case",
];

export const COURT_LEVELS = [
  "First Instance",
  "Appeal",
  "Supreme",
  "Execution",
];

export const JUDICIAL_STATUSES = ["Approved", "Pending"];

export const initialJudicialExpenses = [];

/** What each tile above the table counts, in the order they are shown. */
export function judicialTotals(expenses) {
  const of = (type) => expenses.filter((x) => x.expenseType === type);
  const sum = (rows) => rows.reduce((total, x) => total + Number(x.amount), 0);

  return [
    { label: "All Expenses", count: expenses.length, amount: sum(expenses) },
    ...JUDICIAL_EXPENSE_TYPES.map((type) => {
      const rows = of(type);
      return { label: type, count: rows.length, amount: sum(rows) };
    }),
  ];
}
