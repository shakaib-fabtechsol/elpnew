/**
 * Bonuses the firm pays an employee.
 *
 * A bonus is granted, not asked for: it is the firm's decision, recorded on
 * the employee's page once it has been paid. Every one is booked the same way
 * - Employee Expenses, under Bonus - and what changes is what it was for,
 * which is what the subcategory says.
 */

const DAY = 24 * 60 * 60 * 1000;

export const BONUS_EXPENSE_TYPE = "Employee Expenses";
export const BONUS_CATEGORY = "Bonus";

/** What a bonus can be for. */
export const BONUS_SUBCATEGORIES = [
  "Performance and Excellence",
  "Completion of a Case or Task",
  "Collection",
  "Business Development",
  "Annual Bonus",
  "Exceptional Bonus",
  "Other",
];

/** Anything that is not one of the reasons above has to say what it was. */
export const OTHER_BONUS = "Other";

/** How a bonus is filed once it is paid: the same booking every time. */
export const BONUS_BOOKING = {
  expenseType: BONUS_EXPENSE_TYPE,
  category: BONUS_CATEGORY,
};

/**
 * Where a bonus has got to.
 *
 * Asking for a bonus is not being granted one, and being granted one is not
 * being paid it, so the list says which of the three has happened.
 */
export const BONUS_PENDING = "Pending";
/** Approved by management, waiting on the financial department to pay it. */
export const BONUS_APPROVED = "Approved";
export const BONUS_DISBURSED = "Disbursed";

/** "BON-001", counted across the firm so a number is never reused. */
export const nextBonusNo = (bonuses) =>
  "BON-" +
  String(
    bonuses.reduce(
      (max, bonus) =>
        Math.max(max, Number(String(bonus.requestNo || "").replace(/\D/g, "")) || 0),
      0
    ) + 1
  ).padStart(3, "0");

export const BONUS_STATUS_CHIP = {
  [BONUS_PENDING]: "bg-amber-100 text-amber-800",
  [BONUS_APPROVED]: "bg-blue-100 text-blue-800",
  [BONUS_DISBURSED]: "bg-green-100 text-green-800",
};

/** The day the bonus was entered, which is what the list reads it by. */
export const bonusDate = (bonus) => bonus.recordedOn || bonus.paidOn;

/** What the bonus was for, as it reads on a row: "Other" says which other. */
export const bonusReason = (bonus) =>
  bonus.subcategory === OTHER_BONUS && bonus.bonusType
    ? bonus.bonusType
    : bonus.subcategory;

/** Everything paid to one person, newest first. */
export const bonusesFor = (bonuses, name) =>
  bonuses
    .filter((bonus) => bonus.employee === name)
    .sort(
      (a, b) =>
        String(bonusDate(b)).localeCompare(String(bonusDate(a))) || b.id - a.id
    );

export const initialBonuses = [];
