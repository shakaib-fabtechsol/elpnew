/**
 * Law Firm Profile data.
 *
 * Section 11 of the specification asks that these areas are not separate
 * islands at the UI level, so the records below are related by id in the chain
 * the document sets out:
 *
 *   Law Firm -> Branches -> Clients -> Cases -> Invoices -> Payments
 *                                                        -> Bank Accounts
 *
 * Nothing that can be derived is stored. Bank balances come from transactions,
 * client totals come from invoices and payments, and document status comes from
 * the expiry date - so a figure on screen can never drift from its records.
 */

import { withRial } from "@/lib/money";

const DAY = 24 * 60 * 60 * 1000;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Formatted from the local parts, not through toISOString(): east of UTC the
// UTC form of local midnight still falls on the previous day, which made
// "today" render as yesterday in the date fields.
const isoDate = (date) =>
  date.getFullYear() +
  "-" +
  String(date.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(date.getDate()).padStart(2, "0");

export const dayOffset = (days) =>
  isoDate(new Date(startOfToday().getTime() + days * DAY));

export const daysUntil = (dateStr) =>
  Math.round(
    (new Date(dateStr).setHours(0, 0, 0, 0) - startOfToday().getTime()) / DAY
  );

export const formatDate = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

/** The bare figure, for inputs and anywhere a plain string is needed. */
export const moneyValue = (amount) =>
  Number(amount).toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const money = (amount) => withRial(moneyValue(amount));

/* ------------------------------------------------- 1. Law firm information */

export const initialFirmInfo = {
  nameAr: "مكتب ياندس للمحاماة",
  nameEn: "YANDS",
  // The name the company trades under, which need not be its registered one.
  tradeName: "Y&S Associates",
  address: "Building 214, Way 3009, Shatti Al Qurum, Muscat, Oman",
  mojLicenseNo: "MOJ-2010-0447",
  crNumber: "1234567",
  crExpiryDate: dayOffset(120),
  // The branch the company answers from, chosen from the branches it has.
  primaryBranchId: 1,
};

/* --------------------------------------------------------- 2. Document types */

export const DOCUMENT_TYPES = [
  "Commercial Registration",
  "Ministry of Justice License",
  "Membership Certificate",
  "Office Lease Contract",
  "Apartment Lease Contract",
  "Work Rules",
  "Other",
];

/**
 * A document either applies to the whole company or to one branch, so the
 * branch field carries null for the general case rather than a separate flag.
 */
export const GENERAL_BRANCH = "general";

export const branchLabel = (branches, branchId) =>
  branchId ? branches.find((b) => b.id === branchId)?.name || "-" : "General";

/** The reference a document is quoted by: DOC-001, DOC-002 and so on. */
export const formatDocumentId = (serial) =>
  "DOC-" + String(serial).padStart(3, "0");

export function nextDocumentId(documents) {
  const highest = documents.reduce((max, d) => {
    const serial = Number(String(d.docId || "").replace("DOC-", ""));
    return Number.isFinite(serial) ? Math.max(max, serial) : max;
  }, 0);
  return formatDocumentId(highest + 1);
}

// A document is Expiring Soon inside this window.
export const EXPIRY_WARNING_DAYS = 60;

/**
 * Status is never stored - it is read off the expiry date every time, so it can
 * never be stale. A document with no expiry date is simply Active.
 */
export function documentStatus(document) {
  if (!document.expiryDate) return "Active";
  const days = daysUntil(document.expiryDate);
  if (days < 0) return "Expired";
  if (days <= EXPIRY_WARNING_DAYS) return "Expiring Soon";
  return "Active";
}

export const DOCUMENT_STATUS_VARIANT = {
  Active: "success",
  "Expiring Soon": "warning",
  Expired: "destructive",
};

/* ----------------------------------------------------------- 3. Branches */

/**
 * The offices the company works from.
 *
 * Name and address are each held in both languages, because the table shows
 * them one under the other in a single column - the Arabic is a second line
 * of the same fact, not a column of its own.
 */
export const initialBranches = [
  { id: 1, branchNumber: 1, name: "Muscat", nameAr: "مسقط", address: "Shatti Al Qurum, Muscat", addressAr: "شاطئ القرم، مسقط", phone: "+968 2411 1111", email: "muscat@company.com", managerId: 1, active: true },
  { id: 2, branchNumber: 2, name: "Salalah", nameAr: "صلالة", address: "Al Saada Street, Salalah", addressAr: "شارع السعادة، صلالة", phone: "+968 2329 2222", email: "salalah@company.com", managerId: 7, active: true },
  { id: 3, branchNumber: 3, name: "Sohar", nameAr: "صحار", address: "Falaj Al Qabail, Sohar", addressAr: "فلج القبائل، صحار", phone: "+968 2684 3333", email: "sohar@company.com", managerId: 11, active: true },
];

/**
 * The next branch number, taken from the highest one already stored.
 *
 * The number is derived here and saved onto the branch record. Case numbering
 * later reads it from the record rather than recomputing it, so adding a branch
 * never requires a change to the case-numbering logic.
 */
export function nextBranchNumber(branches) {
  return branches.reduce((max, b) => Math.max(max, b.branchNumber), 0) + 1;
}

/* ------------------------------------------------------- 4. Bank accounts */

/**
 * The company's bank accounts.
 *
 * A branch is written on three lines because that is how a bank writes it:
 * the branch's name, the district it stands in, and the city it is in. The
 * SWIFT code is held beside the IBAN since a transfer from abroad needs both.
 *
 * `logo` names an image file for the bank's own mark. None are on disk yet,
 * so the cards fall back to the bank's initials - dropping the files in is
 * all that is needed to replace them.
 */
export const initialBankAccounts = [];

/**
 * The initials a bank is drawn by until its own mark is available.
 *
 * Words like "of" and "the" are skipped so National Bank of Oman reads NBO
 * rather than NBOO.
 */
const SKIPPED_WORDS = ["of", "the", "and", "for"];

export function bankInitials(name) {
  return String(name)
    .split(" ")
    .filter((word) => word && !SKIPPED_WORDS.includes(word.toLowerCase()))
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

/* ------------------------- 8. Clients, cases and invoices (the relation chain) */

export const clients = [];

export const cases = [];

export const invoices = [];

// A payment settles an invoice and lands in one bank account.
export const initialPayments = [];

/**
 * Money leaving an account.
 *
 * `kind` decides how the row reads in an account's activity - who is named,
 * and what the document beside it is called. An office invoice names its
 * supplier; a court fee names the case it was paid on.
 */
export const initialExpenses = [];

export const initialTransfers = [];

/**
 * "Bank Muscat - **** 6789", the way an account is named on a transfer.
 *
 * One choice rather than two: the account carries the bank it is held at, so
 * the two can never be set to disagree.
 */
export const accountLabel = (account) =>
  account.bankName + " — •••• " + String(account.accountNumber).slice(-4);

/**
 * The accounts money can actually leave from, as a transfer names them.
 *
 * Read by payment forms across the app, so it is kept in step with the
 * firm's bank accounts by FirmProvider (syncBankAccounts) - an account added
 * on the firm's page is offered everywhere straight away.
 */
export const PAYING_ACCOUNTS = [];

/** Puts the firm's current accounts in the lists other screens read. */
export function syncBankAccounts(accounts) {
  initialBankAccounts.splice(0, initialBankAccounts.length, ...accounts);
  PAYING_ACCOUNTS.splice(
    0,
    PAYING_ACCOUNTS.length,
    ...accounts.filter((account) => account.active).map(accountLabel)
  );
}

/**
 * An account number is shown masked wherever the account is only being
 * identified - the last four digits are enough to tell one from another, and
 * the rest has no business being on a screen anyone can look over.
 */
export function maskAccountNumber(accountNumber) {
  const digits = String(accountNumber || "").replace(/\s/g, "");
  if (digits.length <= 4) return digits;
  return "**** **** **** " + digits.slice(-4);
}

/** The reference a transfer is quoted by: TRF-2026-0001 and so on. */
export function nextTransferNo(transfers, date = dayOffset(0)) {
  const year = String(date).slice(0, 4);
  const highest = transfers.reduce((max, t) => {
    const [, of, serial] = String(t.transferNo || "").split("-");
    return of === year ? Math.max(max, Number(serial) || 0) : max;
  }, 0);
  return "TRF-" + year + "-" + String(highest + 1).padStart(4, "0");
}

/* -------------------------------------------------------- 2. Documents */

export const initialDocuments = [];

/* --------------------------------------------------- 5 & 7. Derived money */

/**
 * Every movement against one account, oldest first, with a running balance.
 *
 * The opening balance is the first row rather than a separate field, so the
 * final running balance IS the current balance - the two can never disagree.
 */
/** How an expense reads, by what kind of expense it is. */
const EXPENSE_SHAPES = {
  Office: {
    title: "Office Expense Payment",
    documentLabel: "Expense Invoice No.",
    documentAction: "View Invoice",
    details: (e) =>
      [e.supplier && "Supplier: " + e.supplier, e.expenseType && "Type: " + e.expenseType].filter(Boolean),
  },
  Court: {
    title: "Court Expense Payment",
    documentLabel: "Receipt No.",
    documentAction: "View Receipt",
    details: (e) => [e.caseNo && "Case No.: " + e.caseNo].filter(Boolean),
  },
  Salary: {
    title: "Salary Payment",
    documentLabel: "Voucher No.",
    documentAction: "View Voucher",
    details: (e) => [e.description].filter(Boolean),
  },
};

const DEFAULT_EXPENSE_SHAPE = {
  title: "Expense Payment",
  documentLabel: "Reference No.",
  documentAction: "View Document",
  details: (e) => [e.description].filter(Boolean),
};

/**
 * Everything that has moved through one account, oldest first.
 *
 * Each row carries not just its figures but how it should be read: the kind
 * of movement it was, who it involved, and what the document beside it is
 * called. That belongs here rather than in the table, because the same row is
 * read on more than one screen and must say the same thing on each.
 *
 * `accounts` is optional and only used to name the other side of a transfer;
 * a caller that just wants the balance does not have to pass it.
 */
export function accountTransactions(
  account,
  { payments, expenses, transfers, invoices: invoiceList, accounts = [] }
) {
  const accountName = (id) => {
    const other = accounts.find((a) => a.id === id);
    return other ? other.bankName : "another account";
  };

  const rows = [
    {
      id: "opening-" + account.id,
      date: account.openedAt,
      title: "Opening Balance",
      details: [],
      description: "Opening Balance",
      reference: "",
      documentLabel: "",
      documentAction: "",
      type: "Opening",
      amount: account.openingBalance,
    },
  ];

  payments
    .filter((p) => p.bankAccountId === account.id)
    .forEach((p) => {
      const invoice = invoiceList.find((i) => i.id === p.invoiceId);
      const client = invoice
        ? clients.find((c) => c.id === invoice.clientId)
        : null;
      rows.push({
        id: "pay-" + p.id,
        date: p.date,
        title: "Client Invoice Payment",
        details: [
          client && "Client: " + client.name,
          invoice && "Invoice: " + invoice.invoiceNo,
        ].filter(Boolean),
        description: "Invoice Payment",
        reference: invoice ? invoice.invoiceNo : "",
        documentLabel: "Invoice No.",
        documentAction: "View Invoice",
        type: "Income",
        amount: p.amount,
      });
    });

  expenses
    .filter((e) => e.bankAccountId === account.id)
    .forEach((e) => {
      const shape = EXPENSE_SHAPES[e.kind] || DEFAULT_EXPENSE_SHAPE;
      rows.push({
        id: "exp-" + e.id,
        date: e.date,
        title: shape.title,
        details: shape.details(e),
        description: e.description,
        reference: e.reference,
        documentLabel: shape.documentLabel,
        documentAction: shape.documentAction,
        type: "Expense",
        amount: -e.amount,
      });
    });

  transfers.forEach((t) => {
    const shared = {
      date: t.date,
      title: "Transfer Between Accounts",
      description: t.description,
      reference: t.transferNo || t.reference || "",
      documentLabel: "Transfer Ref.",
      documentAction: "View Receipt",
    };
    if (t.toAccountId === account.id) {
      rows.push({
        ...shared,
        id: "trf-in-" + t.id,
        details: ["From: " + accountName(t.fromAccountId)],
        type: "Transfer In",
        amount: t.amount,
      });
    }
    if (t.fromAccountId === account.id) {
      rows.push({
        ...shared,
        id: "trf-out-" + t.id,
        details: ["To: " + accountName(t.toAccountId)],
        type: "Transfer Out",
        amount: -t.amount,
      });
    }
  });
  rows.sort((a, b) => a.date.localeCompare(b.date));

  let balance = 0;
  return rows.map((row) => {
    balance += row.amount;
    return { ...row, balance };
  });
}

export function accountBalance(account, ledgers) {
  const rows = accountTransactions(account, ledgers);
  return rows.length ? rows[rows.length - 1].balance : account.openingBalance;
}

/* ------------------------------------- 8. Invoiced / paid / outstanding */

export function clientTotals(clientId, { payments }) {
  const clientInvoices = invoices.filter((i) => i.clientId === clientId);
  const invoiced = clientInvoices.reduce((sum, i) => sum + i.amount, 0);
  const paid = clientInvoices.reduce(
    (sum, invoice) =>
      sum +
      payments
        .filter((p) => p.invoiceId === invoice.id)
        .reduce((s, p) => s + p.amount, 0),
    0
  );
  return { invoiced, paid, outstanding: invoiced - paid };
}

export function caseTotals(caseId, { payments }) {
  const caseInvoices = invoices.filter((i) => i.caseId === caseId);
  const invoiced = caseInvoices.reduce((sum, i) => sum + i.amount, 0);
  const paid = caseInvoices.reduce(
    (sum, invoice) =>
      sum +
      payments
        .filter((p) => p.invoiceId === invoice.id)
        .reduce((s, p) => s + p.amount, 0),
    0
  );
  return { invoiced, paid, outstanding: invoiced - paid };
}

/* ----------------------------------------------------- 9. Overview figures */

// New cases are those opened within this window.
export const NEW_CASE_WINDOW_DAYS = 30;

export function overviewFigures({ branches, documents, bankAccounts, payments, expenses, transfers }) {
  const ledgers = { payments, expenses, transfers, invoices };

  const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const clientsWithOpenCases = clients.filter((c) =>
    cases.some((k) => k.clientId === c.id && k.status === "Active")
  );
  const clientsWithOutstanding = clients.filter(
    (c) => clientTotals(c.id, ledgers).outstanding > 0
  );

  const statuses = documents.map(documentStatus);

  return {
    cases: {
      total: cases.length,
      active: cases.filter((c) => c.status === "Active").length,
      closed: cases.filter((c) => c.status === "Closed").length,
      newCases: cases.filter(
        (c) => Math.abs(daysUntil(c.openedAt)) <= NEW_CASE_WINDOW_DAYS
      ).length,
      byBranch: branches.map((branch) => ({
        branch,
        count: cases.filter((c) => c.branchId === branch.id).length,
      })),
    },
    clients: {
      total: clients.length,
      active: clients.filter((c) => c.active).length,
      withOpenCases: clientsWithOpenCases.length,
      withOutstanding: clientsWithOutstanding.length,
    },
    financial: {
      totalInvoiced,
      totalPaid,
      totalOutstanding: totalInvoiced - totalPaid,
      totalExpenses,
    },
    bank: {
      total: bankAccounts.reduce((sum, a) => sum + accountBalance(a, ledgers), 0),
      byAccount: bankAccounts.map((account) => ({
        account,
        balance: accountBalance(account, ledgers),
      })),
    },
    documents: {
      active: statuses.filter((s) => s === "Active").length,
      expiringSoon: statuses.filter((s) => s === "Expiring Soon").length,
      expired: statuses.filter((s) => s === "Expired").length,
    },
  };
}

/* ------------------------------------------------------- Branch staff roles */

/** The roles a branch staffs, in the order they are assigned to a client. */
// In the order a client's work passes through them: the supervisor over it, the
// consultant advising on it, the lawyer running it, the officer enforcing it.
export const BRANCH_ROLES = [
  "General Supervisor",
  "Legal Consultant",
  "Lawyer",
  "Enforcement Officer",
];

/**
 * Staff, each belonging to one branch.
 *
 * A client is managed by people from a single branch, so the role pickers only
 * ever offer that branch's staff. Case tasks will later be assigned from the
 * same list.
 */
export const firmStaff = [];

/** Staff of one branch who hold a given role. */
export const staffFor = (branchId, role) =>
  firmStaff.filter((s) => s.branchId === Number(branchId) && s.role === role);
