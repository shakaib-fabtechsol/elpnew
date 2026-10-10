// Records the expense pages link against, the general invoices, and the
// approval workflow those invoices travel through.

import { dayOffset } from "@/pages/firm/firmData";

export { dayOffset, daysUntil, formatDate, money } from "@/pages/firm/firmData";

/** Registered fixed assets. A fixed-asset expense attaches to one of these. */
export const fixedAssets = [];

export const employees = [];

export const partners = [];

export const linkedCases = [];

export const PAYMENT_METHODS = [
  "Bank Transfer",
  "Cheque",
  "Cash",
  "Card",
  "Direct Debit",
];

/* ------------------------------------------------------------- workflow */

/**
 * Invoice statuses, in the order an invoice moves through them.
 *
 * The route depends on who raised the invoice, not on its value:
 *   Employee -> Accountant -> Finance Manager -> Payment
 *   Admin    -> Finance Manager -> Payment          (never the accountant)
 */
export const STATUS = {
  draft: "Draft",
  submitted: "Submitted",
  accountant: "Under Accountant Review",
  finance: "Under Finance Manager Review",
  returned: "Returned for Correction",
  rejected: "Rejected",
  approved: "Approved for Payment",
  partiallyPaid: "Partially Paid",
  paid: "Paid",
};

export const STATUS_VARIANT = {
  draft: "outline",
  submitted: "secondary",
  accountant: "warning",
  finance: "brand",
  returned: "warning",
  rejected: "destructive",
  approved: "brand",
  partiallyPaid: "warning",
  paid: "success",
};

/** Who can raise a general invoice, and where it goes first. */
export const CREATOR_ROLES = [
  { key: "employee", label: "Employee", firstReview: "accountant" },
  {
    key: "admin",
    label: "Admin / Administrative User",
    firstReview: "finance",
  },
];

export const firstReviewFor = (creatorRole) =>
  CREATOR_ROLES.find((r) => r.key === creatorRole)?.firstReview || "accountant";

/**
 * A filled-in form, turned into the request that goes for approval.
 *
 * The route it takes is decided by the raiser's own role rather than asked
 * for on the form - an admin-raised request skips the accountant entirely.
 * Two pages raise these now, the requests page and a supplier's own, so the
 * rule lives here instead of being written out on each of them.
 */
export function submittedRequest(invoice, user) {
  const creatorRole = user.role === "admin" ? "admin" : "employee";
  return {
    ...invoice,
    creatorRole,
    createdBy: user.name,
    status: firstReviewFor(creatorRole),
    payments: [],
    history: [
      {
        at: dayOffset(0),
        by: user.name,
        action:
          creatorRole === "admin"
            ? "Submitted by Admin - accountant step skipped"
            : "Submitted",
        reason: "",
      },
    ],
  };
}

/* ------------------------------------------------------ accountant review */

/**
 * What the accountant can decide, and where each decision sends the request.
 *
 * A return or a rejection stops the request, so the accountant has to say why -
 * the note is written into the history and shown to whoever raised it.
 */
export const ACCOUNTANT_REVIEW_RESULTS = [
  {
    key: "approve",
    label: "Approve for Payment",
    status: "finance",
    action: "Approved by Accountant",
    needsNote: false,
  },
  {
    key: "return",
    label: "Return for Correction",
    status: "returned",
    action: "Returned for Correction",
    needsNote: true,
  },
  {
    key: "reject",
    label: "Reject the Request",
    status: "rejected",
    action: "Rejected",
    needsNote: true,
  },
];

/* ------------------------------------------------- finance manager approval */

/**
 * What the finance manager can decide.
 *
 * Approving and paying is one action rather than two: the manager releasing the
 * money is the manager recording where it went, so the transfer details are
 * asked for at the same moment. A return or a rejection asks for a note.
 */
export const FINANCE_ACTIONS = [
  {
    key: "pay",
    label: "Approve & Process Payment",
    action: "Approved for Payment",
    needsNote: false,
    needsTransfer: true,
  },
  {
    key: "return",
    label: "Return for Correction",
    status: "returned",
    action: "Returned for Correction",
    needsNote: true,
  },
  {
    key: "reject",
    label: "Reject Request",
    status: "rejected",
    action: "Rejected",
    needsNote: true,
  },
];

/* ------------------------------------------------------- request numbers */

/**
 * The number a request is chased by while it is in flight - REQ 4/2026 and so
 * on, restarting each year.
 *
 * It is not the expense number. The expense keeps `reference` for good; this
 * only exists while somebody still has to act, and is dropped the moment the
 * payment goes through, so a settled expense cannot be quoted by a number that
 * no longer means anything.
 */
export const formatRequestNo = (serial, year) =>
  "REQ " + serial + "/" + year;

export function nextRequestNo(invoices, date = dayOffset(0)) {
  const year = Number(String(date).slice(0, 4));
  const used = invoices
    .map((i) => i.requestNo)
    .filter(Boolean)
    .map((no) => {
      const [serial, of] = no.replace("REQ ", "").split("/");
      return Number(of) === year ? Number(serial) : 0;
    });
  return formatRequestNo(Math.max(0, ...used) + 1, year);
}

/** Nothing is left to chase once the money has gone out in full. */
export const requestClosed = (status) => status === "paid";

/* --------------------------------------------------------- expense records */

/**
 * A request stops being a request once it has cleared approval. From that point
 * it is an expense the firm has committed to, so it leaves the request list and
 * is read from the expenses table instead - one record, in one place, whichever
 * way it was raised.
 */
export const APPROVED_STATUSES = ["approved", "partiallyPaid", "paid"];

export const isApprovedRequest = (invoice) =>
  APPROVED_STATUSES.includes(invoice.status);

/** Expense number: 1/26, 2/26 and so on, restarting each year. */
export const formatExpenseNo = (serial, date) =>
  serial + "/" + String(date).slice(2, 4);

/** Where an expense sits against its own settlement. */
export function settlement(paid, total) {
  if (paid <= 0) return { key: "unpaid", label: "Unpaid", variant: "secondary" };
  if (paid >= total)
    return { key: "fullyPaid", label: "Fully Paid", variant: "success" };
  return { key: "partiallyPaid", label: "Partially Paid", variant: "warning" };
}

/** The moment the request cleared approval, and who cleared it. */
function approvalOf(invoice) {
  const entry = [...invoice.history]
    .reverse()
    .find((h) => h.action.startsWith("Approved for Payment"));
  return { by: entry?.by || "", at: entry?.at || "" };
}

/**
 * The four hands a request passes through, read back off its history.
 *
 * Nothing is inferred from the status: each step is the entry that recorded it,
 * so a request that skipped the accountant simply has nothing under that head.
 */
function trackingOf(invoice) {
  const find = (test) => invoice.history.find(test) || null;
  const last = (test) => [...invoice.history].reverse().find(test) || null;

  const requested = invoice.history[0] || null;
  const accountant = find(
    (h) => /accountant/i.test(h.by) && /approv/i.test(h.action)
  );
  const finance = last((h) => /Approved for Payment/i.test(h.action));
  const paid = last((h) => /payment (processed|recorded)/i.test(h.action));

  const step = (entry) => ({ by: entry?.by || "", at: entry?.at || "" });

  return {
    requested: step(requested),
    accountant: step(accountant),
    finance: step(finance),
    paid: step(paid),
  };
}

/**
 * Everything the expenses table shows: expenses recorded directly, and the
 * requests that have cleared approval, in one shape.
 *
 * Numbered oldest first so the number and the order agree, and so a number once
 * given never shifts when something newer arrives.
 */
export function expenseRecords(expenses, invoices) {
  const fromRequests = invoices.filter(isApprovedRequest).map((invoice) => {
    const total = invoiceTotal(invoice);
    const paid = amountPaid(invoice);
    const approval = approvalOf(invoice);

    return {
      id: "request-" + invoice.id,
      source: "request",
      reference: invoice.reference,
      date: invoice.invoiceDate,
      supplier: invoice.supplier,
      invoiceNumber: invoice.invoiceNumber,
      invoiceFile: invoice.invoiceFile,
      lines: invoice.lines,
      net: invoiceNet(invoice),
      tax: invoiceTax(invoice),
      total,
      paid,
      payments: invoice.payments,
      createdBy: invoice.createdBy,
      createdAt: invoice.history[0]?.at || invoice.invoiceDate,
      approvedBy: approval.by,
      approvedAt: approval.at,
      tracking: trackingOf(invoice),
    };
  });

  // An expense recorded directly is money already spent, so it arrives settled
  // and carries no invoice or approval behind it.
  const direct = expenses.map((expense) => ({
    id: "expense-" + expense.id,
    source: "expense",
    expenseId: expense.id,
    reference: "",
    date: expense.date,
    supplier: "",
    invoiceNumber: "",
    invoiceFile: "",
    lines: [
      {
        id: expense.id,
        typeKey: expense.typeKey,
        path: expense.path,
        description: expense.description,
      },
    ],
    linkKind: expense.linkKind,
    linkId: expense.linkId,
    net: expense.amount,
    tax: 0,
    total: expense.amount,
    paid: expense.amount,
    payments: [{ id: 1, date: expense.date, amount: expense.amount, method: "" }],
    createdBy: "",
    createdAt: expense.date,
    approvedBy: "",
    approvedAt: "",
    tracking: null,
  }));

  const serials = {};
  return [...fromRequests, ...direct]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((row) => {
      const year = String(row.date).slice(0, 4);
      serials[year] = (serials[year] || 0) + 1;
      return { ...row, expenseNo: formatExpenseNo(serials[year], row.date) };
    });
}

/* ---------------------------------------------------- looking backwards */

const kindOf = (line) => line.typeKey + "|" + line.path.join("/");

/**
 * Earlier requests worth reading before deciding this one.
 *
 * The same supplier is the strongest signal - it is what makes a duplicate
 * invoice or a creeping price obvious. After that comes the same person
 * claiming the same kind of expense, which is what makes a habit obvious. A
 * request has to match on at least one of those to be worth showing, and the
 * strongest matches come first.
 */
export function similarRequests(invoices, invoice) {
  const kinds = new Set(invoice.lines.map(kindOf));

  return invoices
    .filter((other) => other.id !== invoice.id)
    .map((other) => {
      const sameSupplier = other.supplier === invoice.supplier;
      const sameApplicant = other.createdBy === invoice.createdBy;
      const sameKind = other.lines.some((line) => kinds.has(kindOf(line)));
      return {
        invoice: other,
        sameSupplier,
        sameApplicant,
        sameKind,
        score: (sameSupplier ? 4 : 0) + (sameKind ? 2 : 0) + (sameApplicant ? 1 : 0),
      };
    })
    .filter((match) => match.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.invoice.invoiceDate.localeCompare(a.invoice.invoiceDate)
    )
    .slice(0, 10);
}

/* ------------------------------------------- what the partners keep to
                                                themselves */

/**
 * Expense types that never pass the accountant.
 *
 * What a partner draws, what the staff are paid and what has been advanced
 * against a salary are the partners' own business. These requests go straight
 * to the finance manager and are read on the partners' page, not the one the
 * whole firm can open.
 */
const PARTNER_ONLY_TYPES = ["partner", "employee", "advances-loans"];

export const skipsAccountant = (invoice) =>
  invoice.creatorRole === "admin" ||
  invoice.lines.some((line) => PARTNER_ONLY_TYPES.includes(line.typeKey));

/* --------------------------------------------------------- who sees what */

/**
 * The roles a request page is read as. Auth is not wired up yet, so the page
 * offers these as a switcher the way the dashboard does.
 */
export const VIEWER_ROLES = [
  { key: "employee", label: "Employee" },
  { key: "accountant", label: "Accountant" },
  { key: "finance", label: "Finance Manager" },
  { key: "admin", label: "Admin / Management" },
];

/** Nothing is waiting on anyone once an invoice reaches one of these. */
const CLOSED = ["paid", "rejected"];

/**
 * Each role is shown only the requests that need it to act at that moment.
 *
 *   Employee        own requests that are still in flight
 *   Accountant      only what is sitting at the accountant step
 *   Finance Manager nothing until the accountant has acted, so the accountant's
 *                   review is not visible early either
 *   Admin           everything
 */
export function visibleInvoices(invoices, role, userName) {
  // A request that has cleared approval has become an expense and is read on
  // the expenses page, so it is off this list whoever is looking.
  const inFlight = invoices.filter((i) => !isApprovedRequest(i));

  switch (role) {
    case "employee":
      return inFlight.filter(
        (i) => i.createdBy === userName && !CLOSED.includes(i.status)
      );
    case "accountant":
      // Also what they have already passed on, so they can follow it through
      // the finance manager's review. Read-only from here.
      return inFlight.filter((i) =>
        ["accountant", "finance"].includes(i.status)
      );
    case "finance":
      return inFlight.filter((i) => i.status === "finance");
    default:
      return inFlight;
  }
}

/** The route an invoice takes, used to draw its progress. */
export function routeFor(creatorRole) {
  const steps = [
    { key: "submitted", label: "Submitted" },
    { key: "accountant", label: "Accountant" },
    { key: "finance", label: "Finance Manager" },
    { key: "approved", label: "Approved for Payment" },
    { key: "paid", label: "Payment" },
  ];
  // An admin-raised invoice never passes through the accountant.
  return creatorRole === "admin"
    ? steps.filter((s) => s.key !== "accountant")
    : steps;
}

/** Amounts on a line, with tax kept separate from the net amount. */
export const lineTotal = (line) =>
  Number(line.amountBeforeTax || 0) + Number(line.taxAmount || 0);

export const invoiceNet = (invoice) =>
  invoice.lines.reduce((sum, l) => sum + Number(l.amountBeforeTax || 0), 0);

export const invoiceTax = (invoice) =>
  invoice.lines.reduce((sum, l) => sum + Number(l.taxAmount || 0), 0);

export const invoiceTotal = (invoice) =>
  invoiceNet(invoice) + invoiceTax(invoice);

export const amountPaid = (invoice) =>
  (invoice.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

/** Paid in full, or only partly - the doc asks for both to be distinguished. */
export function settlementStatus(invoice) {
  const paid = amountPaid(invoice);
  if (paid <= 0) return null;
  return paid >= invoiceTotal(invoice) ? "paid" : "partiallyPaid";
}

/* ------------------------------------------------------- general invoices */

export const initialInvoices = [];

/**
 * Court fee payment requests.
 *
 * These are raised against a case file rather than a supplier invoice, so
 * they are counted on the requests page but not listed there - their table is
 * designed with the case file it belongs to.
 */
export const courtFeeRequests = [];

/** Expenses recorded outside General Invoices, on their own record pages. */
export const initialExpenses = [];
