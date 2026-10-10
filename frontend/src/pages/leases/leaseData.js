/**
 * The properties the firm rents: offices, flats for staff, storage.
 *
 * A lease records what was agreed - where, from whom, for how long, the
 * monthly rent, how it is paid and in how many installments - and, as they
 * happen, the payments made against it. Everything that follows from those
 * (how many months it runs, the VAT, each installment's date, amount and
 * status, the next payment, whether the lease is running out) is worked out
 * each time rather than stored, so it can never disagree with what it came
 * from.
 */

import { EXPENSE_TYPES, RENT_PROPERTY_TYPES } from "@/lib/expenses/taxonomy";

/** What a lease can be for - the same list rent is classified by in the expenses. */
export const PROPERTY_TYPES = RENT_PROPERTY_TYPES;

/** Whether the contract is the first one for the property or a renewal of it. */
export const CONTRACT_STATUSES = ["New Contract", "Renewal"];

/** How rent is paid. */
export const LEASE_PAYMENT_METHODS = [
  "Bank Transfer",
  "Cash",
  "Cheque",
  "Standing Order",
];

export const CASH = "Cash";
export const CHEQUE = "Cheque";

/** A bank account that is not one of the firm's own. */
export const OTHER_ACCOUNT = "other";

/** The contract's rent can be split into anything from one payment to twelve. */
export const INSTALLMENT_COUNTS = Array.from({ length: 12 }, (_, i) => i + 1);

/** The day of the month an installment falls due. */
export const PAYMENT_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export const VAT_RATE = 0.05;

/**
 * Where rent lands in the accounts: Office Expenses, under Rent, with the
 * property type the lease is for as the subcategory.
 */
const RENT_TYPE_KEY = "office";
const RENT_CATEGORY = "Rent";

/**
 * How an installment is booked as an expense: what was chosen when it was
 * paid, or - until then - the lease's own rent booking, filled in for whoever
 * records the payment.
 */
export const rentBookingOf = (lease, row) =>
  row.payment?.typeKey
    ? { typeKey: row.payment.typeKey, path: row.payment.path || [] }
    : { typeKey: RENT_TYPE_KEY, path: [RENT_CATEGORY, lease.propertyType].filter(Boolean) };

/** An expense type's name, from its key. */
export const expenseTypeName = (typeKey) =>
  EXPENSE_TYPES.find((type) => type.key === typeKey)?.name || "-";

/**
 * How early a lease is flagged as running out.
 *
 * Longer than the month given to documents: a lease has to be renewed, or
 * notice given, before it ends - and that takes negotiating, not just filing.
 */
export const LEASE_WARNING_DAYS = 60;

/** How early an installment is flagged as coming due. */
export const DUE_SOON_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");
const round3 = (value) => Math.round(value * 1000) / 1000;

/** A YYYY-MM-DD string as a local date, so a timezone cannot move the day. */
const toDate = (iso) => {
  const [year, month, day] = String(iso).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const toIso = (date) =>
  date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());

const daysBetween = (from, to) => Math.ceil((toDate(to) - toDate(from)) / DAY);

/** Today, as a plain date in the user's own timezone. */
export const todayIso = () => toIso(new Date());

/** "01/10/2026" - short, because dates are compared down a column. */
export const shortDate = (iso) => {
  if (!iso) return "-";
  const [year, month, day] = String(iso).split("-");
  return day + "/" + month + "/" + year;
};

/** "500.000 OMR" - an amount as it is shown anywhere in the system. */
export { money as omr } from "@/lib/money";

/** "0123 4567 89" - an account number in fours. */
export const groupedAccountNumber = (number) =>
  String(number || "").replace(/(.{4})/g, "$1 ").trim();

/** "Bank Muscat – 0123 4567 89" - the bank, and the account in fours. */
export const accountLabel = (account) =>
  account.bankName + " – " + groupedAccountNumber(account.accountNumber);

/**
 * How many months a lease runs, counting both its first and last day: from
 * 01/10/2026 to 30/09/2027 is twelve months, not eleven.
 */
export function leaseMonths(start, end) {
  if (!start || !end || end < start) return 0;
  const from = toDate(start);
  const until = toDate(end);
  until.setDate(until.getDate() + 1);
  let months =
    (until.getFullYear() - from.getFullYear()) * 12 +
    (until.getMonth() - from.getMonth());
  if (until.getDate() < from.getDate()) months -= 1;
  return Math.max(months, 0);
}

/**
 * VAT on a month's rent - none where the lease is exempt. Residential lettings
 * are, which is why a flat for staff can be entered without it.
 */
export const vatOf = (rent, applied = true) =>
  applied === false ? 0 : round3(Number(rent || 0) * VAT_RATE);

/** A month's rent with its VAT, where there is any. */
export const totalOf = (rent, applied = true) =>
  round3(Number(rent || 0) + vatOf(rent, applied));

/**
 * How an installment stands.
 *
 * Paid and cancelled are facts someone recorded; the rest are read off the
 * date. Due Soon is the month before the due date, Unpaid is once it has
 * passed with nothing paid, and anything further off is simply upcoming - an
 * installment a year away is not yet unpaid.
 */
export const INSTALLMENT_STATUS = {
  paid: { label: "Paid", dot: "bg-green-500", pill: "bg-green-100 text-green-800" },
  soon: { label: "Due Soon", dot: "bg-amber-400", pill: "bg-amber-100 text-amber-800" },
  unpaid: { label: "Unpaid", dot: "bg-red-500", pill: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", dot: "bg-amber-800", pill: "bg-orange-100 text-amber-900" },
  upcoming: { label: "Upcoming", dot: "bg-gray-400", pill: "bg-muted text-muted-foreground" },
};

/**
 * Every installment of the contract: its date, its amount split into rent and
 * VAT, and how it stands.
 *
 * The whole contract comes to the monthly rent with VAT times its months, split
 * evenly across the installments - the last one takes whatever fils the split
 * leaves over, so the installments always add up to the contract exactly.
 * They fall at even steps through the contract, on the chosen day of the month
 * (or the month's last day, where it is shorter), and never before the
 * contract starts.
 */
export function installmentsOf(lease, today = todayIso()) {
  const months = leaseMonths(lease.start, lease.end);
  const count = Number(lease.installments);
  const rent = Number(lease.rent || 0);
  if (!months || !count || rent <= 0) return [];

  const day = Number(lease.paymentDay) || toDate(lease.start).getDate();
  const vatApplied = lease.vatApplied !== false;
  const contractTotal = round3(totalOf(rent, vatApplied) * months);
  const each = Math.floor((contractTotal * 1000) / count) / 1000;
  const first = toDate(lease.start);
  const payments = lease.payments || {};
  const cancelled = lease.cancelled || [];
  const notes = lease.installmentNotes || {};

  const rows = [];
  for (let k = 0; k < count; k++) {
    const no = k + 1;
    const offset = Math.round((k * months) / count);
    const month = new Date(first.getFullYear(), first.getMonth() + offset, 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    month.setDate(Math.min(day, lastDay));
    let due = toIso(month);
    if (due < lease.start) due = lease.start;

    const amount = k === count - 1 ? round3(contractTotal - each * (count - 1)) : each;
    // The rent and VAT inside the installment, so the three always add up.
    const rentPart = vatApplied ? round3(amount / (1 + VAT_RATE)) : amount;
    const payment = payments[no] || null;
    const isCancelled = cancelled.includes(no);

    let status = "upcoming";
    if (payment) status = "paid";
    else if (isCancelled) status = "cancelled";
    else if (due < today) status = "unpaid";
    else if (daysBetween(today, due) <= DUE_SOON_DAYS) status = "soon";

    rows.push({
      no,
      due,
      amount,
      rentPart,
      vat: round3(amount - rentPart),
      payment,
      status,
      note: notes[no] || "",
      chequeNo: (lease.cheques && lease.cheques[no]) || "",
    });
  }

  const next = rows.find(
    (row) => !row.payment && row.status !== "cancelled" && row.due >= today && row.due <= lease.end
  );
  const open = (row) => !row.payment && row.status !== "cancelled";

  return rows.map((row) => ({
    ...row,
    isNext: Boolean(next && row.no === next.no),
    // For cheques: how many of the cheques still to be cashed are this one or later.
    remainingCheques: rows.filter((other) => other.no >= row.no && open(other)).length,
  }));
}

/**
 * What the payment method says about one installment: which cheque pays it and
 * how many are still to be cashed, or which account the rent goes to. Cash says
 * nothing beyond its name. `labelled` facts need their label to be understood.
 */
export function paymentFacts(lease, row, bankAccounts, count) {
  if (lease.method === CHEQUE) {
    const facts = [{ label: "Cheque No.", value: row.chequeNo || "-", labelled: true }];
    if (!row.payment && row.status !== "cancelled") {
      facts.push({
        label: "Remaining Cheques",
        value: row.remainingCheques + " of " + count,
        labelled: true,
      });
    }
    return facts;
  }
  if (!lease.method || lease.method === CASH) return [];
  if (lease.bankAccountId === OTHER_ACCOUNT) {
    return [{ label: "Bank Account", value: "Other account" }];
  }
  const account = bankAccounts.find((option) => option.id === Number(lease.bankAccountId));
  return account
    ? [
        { label: "Bank", value: account.bankName },
        { label: "Account No.", value: groupedAccountNumber(account.accountNumber) },
      ]
    : [{ label: "Bank Account", value: "-" }];
}

/**
 * The installments waiting to be paid across every lease - overdue, or due
 * within DUE_SOON_DAYS - earliest due date first, so whatever is most late is
 * dealt with first. Each comes with its lease and how many installments that
 * lease has.
 */
export function dueInstallments(leases, today = todayIso()) {
  return leases
    .flatMap((lease) => {
      const rows = installmentsOf(lease, today);
      return rows
        .filter((row) => row.status === "unpaid" || row.status === "soon")
        .map((row) => ({ lease, row, count: rows.length }));
    })
    .sort((a, b) => a.row.due.localeCompare(b.row.due) || a.lease.id - b.lease.id);
}

/** The next installment still to be paid, today or later. An ended lease has none. */
export function nextPaymentDate(lease, today = todayIso()) {
  if (!lease.end || lease.end < today) return "";
  return installmentsOf(lease, today).find((row) => row.isNext)?.due || "";
}

const EVERY = { 1: "Monthly", 3: "Quarterly", 6: "Semi-Annually", 12: "Annually" };

/**
 * How often rent is paid, read off the contract's months and its installments:
 * twelve months in four installments is Quarterly. A split that is not a whole
 * number of months apart is described by its count instead.
 */
export function frequencyLabel(lease) {
  const months = leaseMonths(lease.start, lease.end);
  const count = Number(lease.installments);
  if (!months || !count) return "";
  const step = months / count;
  if (EVERY[step]) return EVERY[step];
  if (Number.isInteger(step)) return "Every " + step + " Months";
  return count + " Installments";
}

/** Where the property is, in one line: its address, or its building and unit. */
export const addressOf = (lease) =>
  lease.address || [lease.building, lease.unit].filter(Boolean).join(", ");

/**
 * Where a lease stands, read off its end date.
 *
 * A lease that has not started yet is still one the firm is bound by, so it
 * counts as active rather than as something in between. One whose contract
 * dates have not been entered yet cannot be anything but pending: calling it
 * active would claim a contract nobody has recorded.
 */
export function leaseState(lease, today = todayIso()) {
  if (!lease.start || !lease.end) return "pending";
  if (lease.end < today) return "expired";
  const daysLeft = daysBetween(today, lease.end);
  return daysLeft <= LEASE_WARNING_DAYS ? "soon" : "active";
}

export const LEASE_STATE = {
  pending: { label: "Contract details pending", dot: "bg-gray-400" },
  active: { label: "Active", dot: "bg-green-500" },
  soon: { label: "Expiring Soon", dot: "bg-amber-400" },
  expired: { label: "Expired", dot: "bg-black" },
};

/* ------------------------------------------------------------ the contracts */

// branchId points at the firm's own branches (1 Muscat, 2 Salalah, 3 Sohar)
// and bankAccountId at its own accounts (1 Bank Muscat, 2 National Bank of
// Oman, 4 Sohar International). Rent is monthly. The contract number is the
// one written on the signed contract, so it is entered rather than generated.
// `payments` holds what was actually paid, by installment number; `cancelled`
// the installments called off.
//
// The leases were entered as they stood on SEEDED_ON: unless a lease lists its
// own payments, every installment that had fallen due by then was paid on its
// due date.
const SEEDED_ON = "2026-09-13";
const TRANSACTION_PREFIX = { "Bank Transfer": "TRF", "Standing Order": "SO", Cheque: "CHQ", Cash: "RCPT" };


export const initialLeases = [];
