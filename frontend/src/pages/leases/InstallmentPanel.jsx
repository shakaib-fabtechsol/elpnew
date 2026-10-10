import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Coins, FileText, Landmark, Save, WalletCards, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPENSE_TYPES, isPathComplete } from "@/lib/expenses/taxonomy";
import ExpenseClassificationPicker from "@/pages/expenses/ExpenseClassificationPicker";
import { Field, FieldLabel, Worked, Attach } from "./fields";
import {
  CHEQUE,
  INSTALLMENT_STATUS,
  rentBookingOf,
  expenseTypeName,
  addressOf,
  paymentFacts,
  omr,
  shortDate,
  todayIso,
} from "./leaseData";

import DateField from "@/components/shared/DateField";
/** A label and its value on one line, the value pushed to the right edge. */
export function AmountLine({ label, value, strong }) {
  return (
    <p className={cn("flex justify-between gap-4", strong && "font-semibold text-primary")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </p>
  );
}

/** A titled box of label - value lines. */
function DetailCard({ icon, title, children }) {
  const Icon = icon;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <p className="flex items-center gap-2 border-b bg-secondary/60 px-3 py-2 text-sm font-semibold text-primary">
        <Icon className="h-4 w-4 shrink-0" />
        {title}
      </p>
      <div className="space-y-1.5 p-3 text-sm">{children}</div>
    </div>
  );
}

/** Label - value lines whose values all start at the same edge. */
function DetailLines({ lines }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      {lines.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="whitespace-nowrap text-muted-foreground">{label}</dt>
          <dd className="min-w-0 wrap-break-word">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const NOTE_LIMIT = 500;
const EMPTY_ENTRY = { paidOn: "", transactionNo: "", receiptFile: "", note: "" };

/**
 * One installment of a lease: the property it is for, where it is booked,
 * what it comes to and how it is paid - with its payment recorded underneath.
 *
 * It opens from the lease's payment schedule, and shows up by itself among the
 * pending disbursements once the installment falls due. Several can be on one
 * page, so every field id carries the lease and the installment.
 *
 * The payment date is what marks the installment paid. Clear empties the
 * entry, so saving after it takes a payment recorded by mistake back off.
 */
export default function InstallmentPanel({ id, className, row, lease, branchName, bankAccounts, count, onSave }) {
  const [entry, setEntry] = useState(() => ({
    paidOn: row.payment?.paidOn || "",
    transactionNo: row.payment?.transactionNo || "",
    receiptFile: row.payment?.receiptFile || "",
    note: row.note,
  }));
  // The expense entry, filled in from the lease: Office Expenses, Rent and the
  // property type. Whoever records the payment only completes what is missing.
  const [booking, setBooking] = useState(() => rentBookingOf(lease, row));
  const [error, setError] = useState("");
  const status = INSTALLMENT_STATUS[row.status];
  const vatExempt = lease.vatApplied === false;
  const byCheque = lease.method === CHEQUE;
  const fieldId = (name) => name + "-" + lease.id + "-" + row.no;

  const set = (name, value) => setEntry((prev) => ({ ...prev, [name]: value }));

  /** Empties what was typed; the expense entry goes back to the lease's own. */
  const clear = () => {
    setEntry(EMPTY_ENTRY);
    setBooking(rentBookingOf(lease, { ...row, payment: null }));
    setError("");
  };

  const save = () => {
    const transactionNo = entry.transactionNo.trim();
    if (!entry.paidOn && (transactionNo || entry.receiptFile)) {
      setError("Enter the payment date for this payment.");
      return;
    }
    const type = EXPENSE_TYPES.find((option) => option.key === booking.typeKey);
    if (entry.paidOn && !isPathComplete(type, booking.path)) {
      setError("Complete the expense entry before recording the payment.");
      return;
    }
    setError("");
    onSave({
      payment: entry.paidOn
        ? {
            paidOn: entry.paidOn,
            transactionNo,
            receiptFile: entry.receiptFile,
            typeKey: booking.typeKey,
            path: booking.path,
          }
        : null,
      note: entry.note.trim(),
    });
  };

  return (
    <div
      id={id}
      data-installment={lease.id + "-" + row.no}
      className={cn(
        "scroll-mt-24 space-y-4 rounded-xl border bg-secondary/30 p-4 sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <h3 className="text-lg font-semibold text-primary">
          Installment {row.no} Details
        </h3>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
            status.pill
          )}
        >
          <span className={cn("h-2.5 w-2.5 rounded-full", status.dot)} />
          {status.label}
        </span>
      </div>

      {/* The same classification the Add Expense page asks for, already
          answered from the lease. */}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <WalletCards className="h-4 w-4 shrink-0" aria-hidden="true" />
          Expense Entry
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          <ExpenseClassificationPicker
            value={booking}
            onChange={(next) => {
              setBooking((prev) => ({ ...prev, ...next }));
              setError("");
            }}
            idPrefix={fieldId("expense")}
          />
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6",
          // The last column is the pair of fields to fill in, so it takes the room of two.
          byCheque
            ? "lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2.6fr)]"
            : "lg:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,2.4fr)]"
        )}
      >
        <Worked id={fieldId("installmentNo")} label="Installment No." value={"Installment " + row.no} />
        <Worked id={fieldId("installmentDue")} label="Due Date" value={shortDate(row.due)} />
        {byCheque && (
          <Worked id={fieldId("installmentChequeNo")} label="Cheque No." value={row.chequeNo || "-"} />
        )}

        {/* Everything else here is filled in already; these two are what the
            person recording the payment has to enter, so they sit together in
            a tinted box that sets them apart from the grey figures beside them.
            On a wide screen the box's top and bottom padding is taken back out
            of its margin, so its labels and inputs still line up with the row. */}
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-6 lg:col-span-1 lg:-my-3 [&_label]:font-semibold [&_label]:text-primary">
          <Field>
            <FieldLabel htmlFor={fieldId("installmentPaidOn")}>Payment Date</FieldLabel>
            <DateField
              id={fieldId("installmentPaidOn")}
              value={entry.paidOn}
              max={todayIso()}
              onChange={(e) => set("paidOn", e.target.value)}
              className="border-primary/40 bg-white"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("installmentTransactionNo")}>Transaction No.</FieldLabel>
            <div className="flex gap-2">
              <Input
                id={fieldId("installmentTransactionNo")}
                value={entry.transactionNo}
                onChange={(e) => set("transactionNo", e.target.value)}
                placeholder="Enter transaction number"
                autoComplete="off"
                className="min-w-0 flex-1 border-primary/40 bg-white"
              />
              <Attach
                id={fieldId("installmentReceipt")}
                file={entry.receiptFile}
                onFile={(name) => set("receiptFile", name)}
                what="payment receipt"
              />
            </div>
          </Field>
        </div>
      </div>

      {/* Room below the tinted box, which reaches into the gap above. Padding,
          not margin: a margin here would merge with the gap and add nothing. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:pt-3 xl:grid-cols-4">
        <DetailCard icon={Building2} title="Leased Property Details">
          <DetailLines
            lines={[
              ["Property Type:", lease.propertyType || "-"],
              ["Address:", addressOf(lease) || "-"],
              ["Branch:", branchName],
              ["Landlord:", lease.landlord || "-"],
            ]}
          />
        </DetailCard>

        <DetailCard icon={FileText} title="Payment Details">
          <DetailLines
            lines={[
              ["Expense Type:", expenseTypeName(booking.typeKey)],
              ["Category:", booking.path[0] || "-"],
              ["Subcategory:", booking.path[1] || "-"],
            ]}
          />
        </DetailCard>

        <DetailCard icon={Coins} title="Amount Details">
          <AmountLine label="Rental Amount:" value={omr(row.rentPart)} />
          <AmountLine label={vatExempt ? "VAT (exempt):" : "VAT (5%):"} value={omr(row.vat)} />
          <div className="border-t pt-2">
            <AmountLine label="Total Amount:" value={omr(row.amount)} strong />
          </div>
        </DetailCard>

        <DetailCard icon={Landmark} title="Payment Method & Details">
          <DetailLines
            lines={[
              ["Payment Method:", lease.method || "-"],
              ...paymentFacts(lease, row, bankAccounts, count).map((fact) => [
                fact.label + ":",
                fact.value,
              ]),
            ]}
          />
        </DetailCard>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Label
          htmlFor={fieldId("installmentNote")}
          className="flex shrink-0 items-center gap-2 text-primary"
        >
          <FileText className="h-5 w-5" />
          Notes
        </Label>
        <div className="relative min-w-0 flex-1">
          <Input
            id={fieldId("installmentNote")}
            value={entry.note}
            maxLength={NOTE_LIMIT}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Enter notes for this installment..."
            autoComplete="off"
            className="pe-20"
          />
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {entry.note.length}/{NOTE_LIMIT}
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={save}>
            <Save className="me-2 h-4 w-4" />
            Save
          </Button>
          <Button type="button" variant="outline" onClick={clear}>
            <X className="me-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
