import { clientInvoices } from "@/pages/clients/clientMockData";

/* ------------------------------------------ what commission is counted on */

/**
 * The only kind of invoice commission is earned on.
 *
 * Court charges, execution fees, expenses and disbursements are money the firm
 * collects and passes on, not fees it earns, so an invoice for any of them
 * earns nobody a share.
 */
export const LEGAL_FEES = "Legal Fees";

export const isLegalFeesInvoice = (invoice) => invoice.feeType === LEGAL_FEES;

/**
 * Settled in full, going by the money rather than the label.
 *
 * What was paid has to reach the whole invoice, VAT included, and there has to
 * be a day it arrived. A part payment earns nothing until it is complete, and a
 * cancelled invoice never does. The status is not trusted on its own: it is
 * written separately, and a stored label can disagree with the amounts beside
 * it.
 */
export const isFullyPaid = (invoice) =>
  invoice.status !== "Cancelled" &&
  Boolean(invoice.paidDate) &&
  Number(invoice.paidAmount || 0) >= Number(invoice.amount || 0);

/**
 * What an invoice earns commission on: its legal fees before VAT.
 *
 * An invoice of OMR 105 made of 100 legal fees and 5 VAT earns commission on
 * the 100. VAT is the government's money, collected on its behalf.
 */
const feesBeforeVat = (invoice) => Number(invoice.legalFees || 0);

/**
 * The legal fees a client paid in full within a period.
 *
 * Counted on the day the money arrived rather than the day the invoice was
 * raised, because that is when the commission fell due - so an invoice raised
 * in March and settled in May belongs to May. Both ends of the period count.
 */
export function legalFeesCollected(clientNo, from, to) {
  if (!clientNo || !from) return 0;
  return clientInvoices
    .filter(
      (invoice) =>
        invoice.clientNo === clientNo &&
        isLegalFeesInvoice(invoice) &&
        isFullyPaid(invoice) &&
        invoice.paidDate >= from &&
        (!to || invoice.paidDate <= to)
    )
    .reduce((sum, invoice) => sum + feesBeforeVat(invoice), 0);
}

/**
 * The legal-fees invoices raised to a client.
 *
 * What an invoice-linked commission can be calculated from. The case file is
 * not asked for first: an invoice already knows which file it belongs to, so
 * asking would only be a second way to say the same thing - and a way to get
 * it wrong. The file is read back off whichever invoice is chosen.
 *
 * An invoice for court charges or execution fees earns nobody a share, so it
 * is never offered.
 */
export const legalFeesInvoicesFor = (clientNo) =>
  !clientNo
    ? []
    : clientInvoices.filter(
        (invoice) =>
          invoice.clientNo === clientNo && isLegalFeesInvoice(invoice)
      );

/**
 * One invoice, whole.
 *
 * The form shows the date it was raised, whether it was paid and when - all
 * read off the invoice rather than typed, because they are facts about it and
 * a typed copy could disagree with the original.
 */
export const invoiceFor = (clientNo, invoiceNo) =>
  !clientNo || !invoiceNo
    ? null
    : clientInvoices.find(
        (invoice) =>
          invoice.clientNo === clientNo && invoice.invoiceNo === invoiceNo
      ) || null;

/**
 * What one invoice earns commission on: its legal fees before VAT.
 *
 * An invoice of OMR 105 made of 100 legal fees and 5 VAT earns on the 100. Only
 * once it is paid in full, by the same rule as a period - an invoice still
 * owed has earned nothing yet.
 */
export function legalFeesOnInvoice(clientNo, invoiceNo) {
  if (!clientNo || !invoiceNo) return 0;
  const invoice = clientInvoices.find(
    (candidate) =>
      candidate.clientNo === clientNo && candidate.invoiceNo === invoiceNo
  );
  return invoice && isLegalFeesInvoice(invoice) && isFullyPaid(invoice)
    ? feesBeforeVat(invoice)
    : 0;
}

/* ------------------------------------------------- where it lands in the books */

/** A standing arrangement, and one agreed against a single paid invoice. */
export const FIXED_COMMISSION = "Fixed Commission";
export const INVOICE_LINKED_COMMISSION = "Invoice-Linked Commission";

/**
 * Where a commission lands in the accounts.
 *
 * One type and one category, because every commission the firm agrees is
 * booked the same way. What changes is whether it stands for the period or was
 * agreed once, which is what the subcategory records.
 */
export const COMMISSION_BOOKING = [
  {
    name: "Employee Expenses",
    categories: [
      {
        name: "Commission",
        subcategories: [FIXED_COMMISSION, INVOICE_LINKED_COMMISSION],
      },
    ],
  },
];

export const categoriesOf = (type) =>
  COMMISSION_BOOKING.find((t) => t.name === type)?.categories || [];

export const subcategoriesOf = (type, category) =>
  categoriesOf(type).find((c) => c.name === category)?.subcategories || [];

// The subcategory is left for the user to choose: it decides which questions
// the form asks next, so it is never answered for them.
export const DEFAULT_COMMISSION_BOOKING = {
  expenseType: "Employee Expenses",
  category: "Commission",
  subcategory: "",
};

/* ------------------------------------------------------------ the arrangements */

/**
 * The commission arrangements the firm has agreed.
 *
 * A record holds who is paid, on whose fees, at what rate and over what period.
 * It never holds the commission itself: that is the fees times the rate, and a
 * stored answer can disagree with the two numbers it came from.
 *
 * Kept here rather than inside the page that manages them, because an employee
 * is shown their own arrangements on their own record - one list, so the two
 * screens cannot disagree about what was agreed.
 */
export const commissionRecords = [];

/**
 * The next number in the year's run: COM-2026-004.
 *
 * Kept here because two pages add commissions - the firm's own page and an
 * employee's record - and a number handed out twice would name two things.
 */
export function nextCommissionNo(records) {
  const year = new Date().getFullYear();
  const prefix = "COM-" + year + "-";
  const highest = records
    .filter((r) => r.commissionNo.startsWith(prefix))
    .reduce(
      (max, r) => Math.max(max, Number(r.commissionNo.slice(prefix.length))),
      0
    );
  return prefix + String(highest + 1).padStart(3, "0");
}

/**
 * The month an arrangement started, as the list writes it: 01/2024.
 *
 * Read off the date the period opens rather than asked for a second time - a
 * month that disagreed with the date beside it would be wrong on sight.
 */
export const monthAndYear = (record) => {
  const [year, month] = String(record.periodFrom || "").split("-");
  return year && month ? month + "/" + year : "-";
};

/**
 * The fees an arrangement has run on so far.
 *
 * Which fees those are depends on what kind it is: a specific commission is
 * calculated from one invoice on one case file, while a fixed one stands over
 * a period and earns on every legal fee paid inside it.
 */
export const feesFor = (record) =>
  record.type === INVOICE_LINKED_COMMISSION
    ? legalFeesOnInvoice(record.clientNo, record.invoiceNo)
    : legalFeesCollected(record.clientNo, record.periodFrom, record.periodTo);

/** What it has earned: the fees times the rate, worked out on the spot. */
export const commissionOn = (record) =>
  (feesFor(record) * Number(record.rate || 0)) / 100;

/** Everything agreed with one person. */
export const commissionsFor = (name) =>
  commissionRecords.filter((record) => record.paidTo === name);
