import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileCheck, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldLabel, Settled, Choice } from "@/components/shared/formFields";
import { PAYMENT_METHODS } from "@/pages/expenses/expenseData";
import { PAYING_ACCOUNTS } from "@/pages/firm/firmData";

import DateField from "@/components/shared/DateField";
export const COMMENT_LIMIT = 500;

/**
 * What an approval settles, in the one order every request settles it in.
 *
 * Two rows of four: where the money is booked and when it goes, then how much
 * goes and by what route. The order is fixed here rather than in each module
 * so the same eight fields cannot end up in eight arrangements.
 *
 * Only a partial approval types an amount - a full one grants what was asked
 * for, so there the figure is shown rather than asked for again.
 */
export function DecisionFields({
  booking,
  amountLabel = "Approved Amount (OMR)",
  amount,
  approved,
  onApproved,
  amending,
  exceeded,
  payment,
  onPayment,
  receipt,
  onReceipt,
  disabled,
  idPrefix = "decision",
}) {
  const id = (name) => idPrefix + "-" + name;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        <Settled
          id={id("expense-type")}
          label="Expense Type"
          value={booking.expenseType}
        />
        <Settled id={id("category")} label="Category" value={booking.category} />
        <Settled
          id={id("subcategory")}
          label="Subcategory"
          value={booking.subcategory}
        />

        <div className="flex h-full flex-col justify-end gap-2">
          <FieldLabel htmlFor={id("payment-date")} required>
            Payment Date
          </FieldLabel>
          <DateField
            id={id("payment-date")}
            value={payment.paymentDate}
            onChange={(e) => onPayment("paymentDate", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {amending ? (
          <div className="flex h-full flex-col justify-end gap-2">
            <FieldLabel htmlFor={id("approved")} required>
              {amountLabel}
            </FieldLabel>
            <Input
              id={id("approved")}
              inputMode="decimal"
              value={approved}
              onChange={(e) => onApproved(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0.000"
              className={cn(exceeded && "border-destructive")}
              disabled={disabled}
            />
          </div>
        ) : (
          <Settled id={id("approved")} label={amountLabel} value={amount} payable />
        )}

        <Choice
          id={id("method")}
          label="Payment Method"
          value={payment.method}
          onChange={(value) => value && onPayment("method", value)}
          placeholder="Select method"
          options={PAYMENT_METHODS}
          disabled={disabled}
        />

        {/* One choice, not two: the account carries the bank it is held at,
            so the pair cannot be set to disagree. */}
        <Choice
          id={id("bank")}
          label="Bank Account"
          value={payment.bankAccount}
          onChange={(value) => value && onPayment("bankAccount", value)}
          placeholder="Select bank account"
          options={PAYING_ACCOUNTS}
          disabled={disabled}
        />

        {/* What the bank called the transfer, and the proof of it: a plain
            icon beside the field, with nothing drawn around it. */}
        <div className="flex h-full flex-col justify-end gap-2">
          <FieldLabel htmlFor={id("reference")} required>
            Transfer No.
          </FieldLabel>
          <div className="flex w-full min-w-0 items-center gap-2">
            <Input
              id={id("reference")}
              className="min-w-0 flex-1"
              value={payment.reference}
              onChange={(e) => onPayment("reference", e.target.value)}
              placeholder="TRX-0000-00000"
              disabled={disabled}
            />
            <label
              className="shrink-0 cursor-pointer text-primary hover:text-primary/70"
              title={receipt ? receipt.name + " attached" : "Upload transfer receipt"}
            >
              {receipt ? (
                <FileCheck className="h-5 w-5 text-green-600" />
              ) : (
                <UploadCloud className="h-5 w-5" />
              )}
              <span className="sr-only">Upload transfer receipt</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => e.target.files[0] && onReceipt(e.target.files[0])}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * What the office wants to say about its decision, under the fields that
 * carry it out.
 *
 * Never required: a decision is made by the answer above it, and holding one
 * back for want of a sentence only stops the work.
 */
export function ManagementComment({
  value,
  onChange,
  disabled,
  id = "management-comment",
}) {
  return (
    <div className="relative space-y-2 pb-5">
      <FieldLabel htmlFor={id}>Management Comment</FieldLabel>
      <Textarea
        id={id}
        rows={3}
        maxLength={COMMENT_LIMIT}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter management comment"
      />
      {/* Hung below the box rather than set under it, so a field beside this
          one is not pushed out of line by a counter. */}
      <p className="absolute bottom-0 right-0 text-xs text-muted-foreground">
        {value.length} / {COMMENT_LIMIT}
      </p>
    </div>
  );
}
