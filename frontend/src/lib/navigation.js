import {
  Archive,
  Briefcase,
  Calculator,
  FileBarChart,
  Landmark,
  ListTree,
  Percent,
  ReceiptText,
  Scale,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";

/**
 * The header's menus, and the pages under them.
 *
 * Kept out of the header itself because a page's own heading needs the same
 * answer - which section a page belongs to - and two lists of that would
 * disagree the first time one of them was edited.
 */
export const navSections = [
  { name: "Active Cases", path: "/litigation", key: "litigation", icon: Scale },
  {
    name: "Administration",
    key: "private",
    icon: ListTree,
    items: [
      {
        name: "Employees",
        path: "/employees",
        key: "employees",
        icon: Users,
        description: "Staff records, branches and roles",
      },
      {
        name: "Clients",
        path: "/clients",
        key: "clients",
        icon: Users,
        description: "Client directory and profiles",
      },
      {
        name: "Finance Center",
        path: "/finance",
        key: "finance",
        icon: Wallet,
        description: "Invoices and the money against them",
      },
    ],
  },
  {
    name: "Payment Request",
    path: "/expense-requests",
    key: "expense-requests",
    icon: ReceiptText,
  },
  {
    name: "Expenses",
    key: "spending",
    icon: Wallet,
    items: [
      {
        name: "Pending Disbursements",
        path: "/partner-disbursements",
        key: "partner-disbursements",
        icon: Wallet,
        description: "Partners only - no accountant approval",
      },
      {
        name: "Court Fee Payment",
        path: "/court-fee-payments",
        key: "court-fee-payments",
        icon: Landmark,
        description: "Fees raised against a case file",
      },
      {
        name: "Expense Reports",
        path: "/expenses",
        key: "expenses",
        icon: FileBarChart,
        description: "Every expense, and what has been paid against it",
      },
    ],
  },
  {
    // A menu of its own rather than a place under Expenses: VAT is charged on
    // the firm's invoices as well as paid on its purchases, and income tax is
    // owed on the year as a whole.
    name: "Taxes",
    key: "taxes",
    icon: Calculator,
    items: [
      {
        name: "Income Tax",
        path: "/taxes/income-tax",
        key: "taxes/income-tax",
        icon: Landmark,
        description: "Corporate income tax returns and payments",
      },
      {
        name: "Value Added Tax (VAT)",
        path: "/taxes/vat",
        key: "taxes/vat",
        icon: Percent,
        description: "VAT returns and the VAT on every invoice",
      },
    ],
  },
  // { name: "Corporate Matters", path: "/corporate", icon: Briefcase, key: "corporate" },
  // { name: "Invoices", path: "/finance", icon: Wallet, key: "finance" },
  // { name: "Archive", path: "/archive", icon: Archive, key: "archive" },
  {
    // A page about the person reading it, so it sits in the header rather
    // than inside a menu of the firm's records.
    name: "My Profile",
    path: "/my-profile",
    key: "my-profile",
    icon: UserCircle,
  },
];

/** The section a path sits under, and the page inside it. */
export function trailFor(pathname) {
  const matches = (key) => pathname === "/" + key || pathname.startsWith("/" + key + "/");
  for (const section of navSections) {
    if (section.items) {
      const item = section.items.find((entry) => matches(entry.key));
      if (item) return { section: section.name, page: item.name };
    } else if (matches(section.key)) {
      return { section: null, page: section.name };
    }
  }
  return null;
}
