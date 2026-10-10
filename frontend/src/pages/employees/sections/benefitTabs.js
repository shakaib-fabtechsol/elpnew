import { Wallet, Gift, HandCoins, HandHeart, Percent } from "lucide-react";

/**
 * The kinds of money an employee is owed, in the order they are asked about.
 *
 * They live in a file of their own because two places need them: the heading
 * of the section, which carries the tabs, and the section itself, which shows
 * whichever one is open.
 *
 * `add` is the wording of the button that opens that category's form; a
 * category without one has nothing to add here - commission is agreed on the
 * Company Profile, and only read from this side.
 *
 * `office` marks what belongs to whoever keeps the firm's records rather than
 * to the person the record is about: it is kept off My Profile entirely.
 */
export const BENEFIT_TABS = [
  {
    key: "salaries",
    label: "Salaries",
    icon: Wallet,
    note: "View your salary payments and allowances",
    // Salary is recorded here, not asked for: the form enters a salary
    // payment against the payslip above, and the history below lists them.
    add: "Add Salary",
    // What the employee may do with the same salary on their own page. They
    // cannot pay themselves, but they can ask for part of it early - and the
    // firm never asks for an advance on somebody else's behalf, so this is
    // the one place it exists.
    selfAdd: "Salary Advance Request",
  },
  {
    // A bonus is asked for the way everything else here is: the employee
    // writes the request, and the office answers it.
    key: "bonus",
    label: "Bonus",
    icon: Gift,
    note: "Bonuses asked for and paid to this employee",
    add: "Bonus Request",
  },
  {
    key: "loans",
    label: "Loans",
    icon: HandCoins,
    note: "View your loans and repayment details",
    add: "Add Loan",
  },
  {
    key: "assistance",
    label: "Assistance",
    icon: HandHeart,
    note: "View your financial assistance requests and payments",
    add: "Add Assistance",
  },
  {
    key: "commission",
    label: "Commission",
    icon: Percent,
    note: "Commission agreed with you on collected legal fees",
    add: "Add Commission",
  },
];
