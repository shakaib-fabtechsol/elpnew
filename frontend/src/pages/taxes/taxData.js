/**
 * The firm's taxes: VAT, quarter by quarter, and income tax, year by year.
 *
 * The VAT on every invoice is read off the records it belongs to - the firm's
 * invoices to its clients for the VAT it charged, and supplier invoices, rent
 * and asset expenses for the VAT it paid - so a return always adds up to the
 * invoices behind it. Only what happened at the tax office (when a return was
 * filed, its reference, when it was paid) is recorded here.
 */
import { installmentsOf, shortDate } from "@/pages/leases/leaseData";
import { expenseVat } from "@/pages/assets/assetData";
import { invoiceNet, invoiceTax } from "@/pages/expenses/expenseData";

const pad = (n) => String(n).padStart(2, "0");
const round3 = (value) => Math.round(value * 1000) / 1000;
const sum = (list, pick) => round3(list.reduce((total, item) => total + Number(pick(item) || 0), 0));

const lastDayOf = (year, month) => new Date(year, month, 0).getDate();

/* -------------------------------------------------------------------- VAT */

export const VAT_QUARTERS = [1, 2, 3, 4];

export const periodKey = (year, quarter) => year + "-Q" + quarter;
export const periodLabel = (year, quarter) => "Q" + quarter + " " + year;

export const quarterStart = (year, quarter) => year + "-" + pad((quarter - 1) * 3 + 1) + "-01";

export const quarterEnd = (year, quarter) =>
  year + "-" + pad(quarter * 3) + "-" + pad(lastDayOf(year, quarter * 3));

/** A quarter's return, and the VAT on it, is due by the end of the month after the quarter. */
export function vatDueDate(year, quarter) {
  let month = quarter * 3 + 1;
  let dueYear = Number(year);
  if (month > 12) {
    month = 1;
    dueYear += 1;
  }
  return dueYear + "-" + pad(month) + "-" + pad(lastDayOf(dueYear, month));
}

export const periodRange = (year, quarter) =>
  shortDate(quarterStart(year, quarter)) + " - " + shortDate(quarterEnd(year, quarter));

// A supplier invoice counts once the firm has accepted it for payment; one
// still under review, returned or rejected may never be paid.
const ACCEPTED_INVOICE = ["approved", "paid", "partiallyPaid"];

/**
 * Every invoice that carries VAT, newest first.
 *
 * Output VAT is what the firm charged its clients; input VAT is what it paid
 * suppliers, landlords (on rent actually paid) and whoever it bought or
 * maintained assets from. A cancelled client invoice charged nothing.
 */
export function vatRecords({ clientInvoices, clients, invoices, leases, assets, today }) {
  const records = [];
  const clientName = (clientNo) =>
    clients.find((client) => client.clientNo === clientNo)?.clientName || "Client " + clientNo;

  clientInvoices
    .filter((invoice) => invoice.status !== "Cancelled" && Number(invoice.vat) > 0)
    .forEach((invoice) =>
      records.push({
        id: "client-" + invoice.id,
        date: invoice.date,
        direction: "Output",
        source: "Client Invoice",
        reference: invoice.invoiceNo,
        party: clientName(invoice.clientNo),
        net: Number(invoice.legalFees),
        vat: Number(invoice.vat),
        total: Number(invoice.amount),
      })
    );

  invoices
    .filter((invoice) => ACCEPTED_INVOICE.includes(invoice.status) && invoiceTax(invoice) > 0)
    .forEach((invoice) =>
      records.push({
        id: "supplier-" + invoice.id,
        date: invoice.invoiceDate,
        direction: "Input",
        source: "Supplier Invoice",
        reference: invoice.invoiceNumber,
        party: invoice.supplier,
        net: round3(invoiceNet(invoice)),
        vat: round3(invoiceTax(invoice)),
        total: round3(invoiceNet(invoice) + invoiceTax(invoice)),
      })
    );

  leases.forEach((lease) =>
    installmentsOf(lease, today)
      .filter((row) => row.payment && row.vat > 0)
      .forEach((row) =>
        records.push({
          id: "rent-" + lease.id + "-" + row.no,
          date: row.payment.paidOn,
          direction: "Input",
          source: "Lease Rent",
          reference: (lease.contractNo || "Lease") + " · Installment " + row.no,
          party: lease.landlord,
          net: row.rentPart,
          vat: row.vat,
          total: row.amount,
        })
      )
  );

  assets.forEach((asset) =>
    (asset.expenses || [])
      .filter((expense) => expenseVat(expense) > 0)
      .forEach((expense) =>
        records.push({
          id: "asset-" + asset.id + "-" + expense.id,
          date: expense.invoiceDate,
          direction: "Input",
          source: "Asset Expense",
          reference: expense.invoiceNo + " · " + asset.assetNo,
          party: expense.payee,
          net: Number(expense.amount),
          vat: expenseVat(expense),
          total: round3(Number(expense.amount) + expenseVat(expense)),
        })
      )
  );

  return records
    .filter((record) => record.date)
    .sort((a, b) => b.date.localeCompare(a.date) || String(a.id).localeCompare(String(b.id)));
}

/** The records that fall in a year, and in one quarter of it if one is given. */
export const recordsIn = (records, year, quarter) =>
  records.filter((record) =>
    quarter
      ? record.date >= quarterStart(year, quarter) && record.date <= quarterEnd(year, quarter)
      : record.date.startsWith(String(year))
  );

/** A quarter's return, worked out from its invoices. */
export function vatReturnOf(records, year, quarter) {
  const inPeriod = recordsIn(records, year, quarter);
  const output = sum(inPeriod.filter((r) => r.direction === "Output"), (r) => r.vat);
  const input = sum(inPeriod.filter((r) => r.direction === "Input"), (r) => r.vat);
  return { year: Number(year), quarter, output, input, net: round3(output - input) };
}

export const VAT_RETURN_STATUS = {
  upcoming: { label: "Upcoming", dot: "bg-gray-300", text: "text-muted-foreground" },
  open: { label: "Open", dot: "bg-blue-400", text: "text-blue-700" },
  due: { label: "Due", dot: "bg-amber-400", text: "text-amber-700" },
  overdue: { label: "Overdue", dot: "bg-red-500", text: "text-red-600" },
  filed: { label: "Filed", dot: "bg-green-500", text: "text-green-700" },
};

/**
 * Where a quarter's return stands: filed once it is recorded as filed; until
 * then open while the quarter runs, due once it has ended, and overdue after
 * its due date. A quarter that has not started yet is upcoming.
 */
export function vatReturnStatus(year, quarter, filing, today) {
  if (filing?.filedOn) return "filed";
  if (today < quarterStart(year, quarter)) return "upcoming";
  if (today <= quarterEnd(year, quarter)) return "open";
  return today > vatDueDate(year, quarter) ? "overdue" : "due";
}

// Every return from 2023 up to the first quarter of 2026 was filed and paid a
// few days before it was due; the second quarter of 2026 has not been filed.
export const initialVatFilings = {};

/* ------------------------------------------------------------- income tax */

export const INCOME_TAX_RATE = 0.15;

/** A year's return, and the tax on it, is due by the end of April the year after. */
export const incomeTaxDueDate = (year) => Number(year) + 1 + "-04-30";

export const taxableIncomeOf = (record) =>
  round3(Number(record.revenue || 0) - Number(record.expenses || 0));

/** Tax on a profit; a loss owes nothing. */
export const incomeTaxOf = (record) =>
  round3(Math.max(taxableIncomeOf(record), 0) * INCOME_TAX_RATE);

export const incomeTaxBalance = (record) =>
  round3(incomeTaxOf(record) - Number(record.paidAmount || 0));

export const INCOME_TAX_STATUS = {
  open: { label: "Open", dot: "bg-blue-400", text: "text-blue-700" },
  due: { label: "Due", dot: "bg-amber-400", text: "text-amber-700" },
  overdue: { label: "Overdue", dot: "bg-red-500", text: "text-red-600" },
  balance: { label: "Filed - Balance Due", dot: "bg-orange-400", text: "text-orange-700" },
  settled: { label: "Filed & Paid", dot: "bg-green-500", text: "text-green-700" },
};

/**
 * Where a year's return stands: once filed, whether anything is still owed;
 * before that, open while the year runs, due once it has ended, and overdue
 * after the end of April.
 */
export function incomeTaxStatus(record, today) {
  if (record.filedOn) return incomeTaxBalance(record) > 0 ? "balance" : "settled";
  if (today <= record.year + "-12-31") return "open";
  return today > incomeTaxDueDate(record.year) ? "overdue" : "due";
}

export const initialIncomeTaxReturns = [];
