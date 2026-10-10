import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ReceiptText,
  Plus,
  Trash2,
  Paperclip,
  ArrowRight,
  Check,
  Undo2,
  X,
  Banknote,
  Building2,
  FileText,
  CalendarDays,
  Tag,
  ListTree,
  AlignLeft,
  Percent,
  Calculator,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/panels";
import { useExpenses } from "@/lib/expenses/context";
import { useSuppliers } from "@/lib/suppliers/context";
import { useFirm } from "@/lib/firm/context";
import { useLeases } from "@/lib/leases/context";
import InstallmentPanel from "@/pages/leases/InstallmentPanel";
import { dueInstallments } from "@/pages/leases/leaseData";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { initialBankAccounts } from "@/pages/firm/firmData";
import { findType } from "./links";
import { Rial } from "@/components/shared/Rial";
import {
  PAYMENT_METHODS,
  VIEWER_ROLES,
  ACCOUNTANT_REVIEW_RESULTS,
  courtFeeRequests,
  skipsAccountant,
  FINANCE_ACTIONS,
  STATUS,
  STATUS_VARIANT,
  firstReviewFor,
  routeFor,
  visibleInvoices,
  similarRequests,
  isApprovedRequest,
  invoiceNet,
  invoiceTax,
  invoiceTotal,
  amountPaid,
  settlementStatus,
  lineTotal,
  dayOffset,
  formatDate,
  money,
} from "./expenseData";

import DateField from "@/components/shared/DateField";
/**
 * The route this invoice takes, with the step it has reached marked.
 *
 * A finished step carries the date it happened, so the card says how long the
 * request has been sitting where it is without anyone opening the history.
 */
function Route({ invoice }) {
  const steps = routeFor(invoice.creatorRole);
  const settled = ["paid", "partiallyPaid"].includes(invoice.status);
  const at = settled
    ? steps.length - 1
    : steps.findIndex((s) => s.key === invoice.status);

  if (["rejected", "returned"].includes(invoice.status)) {
    return (
      <div
        className={cn(
          "rounded-md border-s-4 px-3 py-2 text-xs",
          invoice.status === "rejected"
            ? "border-s-red-500 bg-red-50 text-red-800"
            : "border-s-amber-500 bg-amber-50 text-amber-900"
        )}
      >
        <span className="font-semibold">{STATUS[invoice.status]}: </span>
        {invoice.history[invoice.history.length - 1]?.reason || "No reason given."}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {steps.map((step, i) => {
        const done = i < at;
        const current = i === at;
        // Each action writes one history entry, so they line up with the steps.
        const happened = done ? invoice.history[i]?.at : null;

        return (
          <span key={step.key} className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  done
                    ? "bg-green-600 text-white"
                    : current
                    ? "border-[5px] border-primary bg-background"
                    : "bg-muted-foreground/25"
                )}
              >
                {done && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="leading-tight">
                <span
                  className={cn(
                    "block text-xs",
                    current
                      ? "font-semibold text-primary"
                      : done
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                {(happened || current) && (
                  <span className="block text-[11px] text-muted-foreground">
                    {current ? "Current step" : formatDate(happened)}
                  </span>
                )}
              </span>
            </span>
            {i < steps.length - 1 && (
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Every step this one request has been through.
 *
 * The supplier history answers what the firm has paid these people before;
 * this answers what has happened to this request, which is a different
 * question and so a different window.
 */
function RequestHistoryDialog({ invoice, onOpenChange }) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request History</DialogTitle>
          <DialogDescription>
            {invoice.requestNo} &middot; {invoice.reference}
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {invoice.history.map((entry, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
              />
              <span>
                <span className="block font-medium">{entry.action}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDate(entry.at)} &middot; {entry.by}
                </span>
                {entry.reason && (
                  <span className="mt-1 block text-xs">{entry.reason}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The frames requests are drawn in, taken in turn.
 *
 * Consecutive cards read as one long page unless something separates them, so
 * each request takes the next frame colour and no two neighbours match.
 */
const FRAMES = ["border-primary", "border-frame-alt"];

/**
 * Who the request is with.
 *
 * A request that has been decided names the person who decided it; one still
 * moving names the step it is waiting at, because nobody has put their name to
 * it yet.
 */
function approverOf(invoice) {
  const decided = [...invoice.history]
    .reverse()
    .find((entry) => entry.action !== "Submitted");
  if (decided) return decided.by;
  return STATUS[invoice.status] || "Pending";
}

/** The bar between two facts that belong on one line. */
function Divider() {
  return <span className="px-2 text-muted-foreground">|</span>;
}

/**
 * One panel of a request card.
 *
 * The heading carries the icon and, where there is one, the link that opens
 * what sits behind the panel - so the action belongs to the fact it acts on
 * rather than floating in a box of its own.
 */
function InfoBox({ icon, label, action, children }) {
  const Icon = icon;
  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-lg bg-secondary p-2 text-secondary-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-medium">{label}</span>
        </span>
        {action}
      </div>
      <div className="mt-3 text-sm">{children}</div>
    </div>
  );
}

/** The strip the panels sit in, so every card lines up the same way. */
function InfoRow({ children }) {
  return (
    <div className="form-grid [&>*+*]:border-t rounded-lg border sm:[&>*+*]:border-t-0 lg:[&>*+*]:border-s">
      {children}
    </div>
  );
}

/**
 * What is waiting at one stage of the route.
 *
 * The count is the headline because it is the queue length; the amount says
 * what the firm is committed to at that stage.
 */
function StageTile({ label, count, amount, note, active, onClick }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-4 text-start",
        onClick && "hover:border-primary/50 hover:bg-muted/40",
        active && "border-primary ring-1 ring-primary"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-lg font-bold text-primary">{count}</p>
      </div>
      <p className="mt-1 text-lg font-semibold">{money(amount)}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </Wrapper>
  );
}
/**
 * The accountant's decision on a request, taken on the request itself.
 *
 * Only shown to the accountant, and only while the request is sitting at their
 * step. A return or a rejection asks for the note before it will submit.
 */
function AccountantReview({ invoiceId, onDecide }) {
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");

  const chosen = ACCOUNTANT_REVIEW_RESULTS.find((r) => r.key === result);
  const noteRequired = Boolean(chosen?.needsNote);
  const ready = Boolean(chosen) && (!noteRequired || note.trim().length > 0);

  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-4">
      <p className="text-sm font-semibold text-primary">
        Accountant&apos;s Review
      </p>

      <div className="grid grid-cols-1 gap-4 sm:max-w-md">
        <div data-required="true" className="form-field space-y-2">
          <Label htmlFor={"review-" + invoiceId}>Review Result</Label>
          <Select
            value={result}
            onValueChange={(value) => {
              setResult(value);
              setNote("");
            }}
          >
            <SelectTrigger id={"review-" + invoiceId}>
              <SelectValue placeholder="Please Select" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNTANT_REVIEW_RESULTS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {noteRequired && (
          <div className="form-field space-y-2">
            <Label htmlFor={"note-" + invoiceId}>Accountant&apos;s Note</Label>
            <Textarea
              required
              id={"note-" + invoiceId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain what needs correcting, or why this is rejected"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!ready}
          onClick={() => onDecide(chosen, note.trim())}
        >
          <Check className="me-1.5 h-4 w-4" />
          Submit Review
        </Button>
      </div>
    </div>
  );
}

/**
 * The finance manager's decision, and where the money went.
 *
 * Approving releases the payment, so the transfer is recorded in the same
 * breath - which account it left, when, and the reference it carries. Where the
 * supplier is paid comes from the supplier record and is shown, not asked for.
 */
function FinanceApproval({ invoice, supplierAccount, outstanding, onDecide }) {
  const [action, setAction] = useState("");
  const [note, setNote] = useState("");
  const [transfer, setTransfer] = useState({
    bankId: "",
    date: dayOffset(0),
    reference: "",
    document: "",
  });

  const chosen = FINANCE_ACTIONS.find((a) => a.key === action);
  const account = initialBankAccounts.find(
    (a) => String(a.id) === transfer.bankId
  );

  const ready =
    Boolean(chosen) &&
    (!chosen.needsNote || note.trim().length > 0) &&
    (!chosen.needsTransfer || (transfer.bankId && transfer.date));

  const id = (name) => name + "-" + invoice.id;

  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-4">
      <p className="text-sm font-semibold text-primary">
        Finance Manager Approval
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div data-required="true" className="form-field space-y-2">
          <Label htmlFor={id("financeAction")}>Finance Manager Action</Label>
          <Select
            value={action}
            onValueChange={(value) => {
              setAction(value);
              setNote("");
            }}
          >
            <SelectTrigger id={id("financeAction")}>
              <SelectValue placeholder="Please Select" />
            </SelectTrigger>
            <SelectContent>
              {FINANCE_ACTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Supplier&apos;s Bank</Label>
          <Input value={supplierAccount?.bank || "-"} readOnly disabled className="bg-locked" />
        </div>

        <div className="space-y-2">
          <Label>Supplier&apos;s Account Number</Label>
          <Input
            value={supplierAccount?.accountNumber || "-"}
            readOnly
            disabled
            className="bg-locked"
          />
        </div>
      </div>

      {chosen?.needsTransfer && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div data-required="true" className="form-field space-y-2">
            <Label htmlFor={id("fromBank")}>Withdrawal Bank</Label>
            <Select
              value={transfer.bankId}
              onValueChange={(value) => setTransfer({ ...transfer, bankId: value })}
            >
              <SelectTrigger id={id("fromBank")}>
                <SelectValue placeholder="Please Select" />
              </SelectTrigger>
              <SelectContent>
                {initialBankAccounts
                  .filter((a) => a.active)
                  .map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.bankName} - {a.accountNumber}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Transfer From Account Number</Label>
            <Input
              value={account?.accountNumber || "-"}
              readOnly
              disabled
              className="bg-locked"
            />
          </div>

          <div className="form-field space-y-2">
            <Label htmlFor={id("withdrawnAt")}>Date of Withdrawal</Label>
            <DateField
              required
              id={id("withdrawnAt")}
              value={transfer.date}
              onChange={(e) => setTransfer({ ...transfer, date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={id("txRef")}>Transaction Number</Label>
            <Input
              id={id("txRef")}
              value={transfer.reference}
              onChange={(e) =>
                setTransfer({ ...transfer, reference: e.target.value })
              }
              placeholder="If available"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Bank Transfer Document</Label>
            {transfer.document ? (
              <div className="flex h-9 items-center justify-between gap-2 rounded-md bg-muted/40 px-3">
                <span className="truncate text-sm">{transfer.document}</span>
                <button
                  type="button"
                  onClick={() => setTransfer({ ...transfer, document: "" })}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove document</span>
                </button>
              </div>
            ) : (
              <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted/50">
                <Paperclip className="h-3.5 w-3.5" />
                Attach transfer document
                <Input
                  type="file"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files[0] &&
                    setTransfer({ ...transfer, document: e.target.files[0].name })
                  }
                />
              </label>
            )}
          </div>
        </div>
      )}

      {chosen?.needsNote && (
        <div className="form-field space-y-2 sm:max-w-md">
          <Label htmlFor={id("financeNote")}>Notes</Label>
          <Textarea
            required
            id={id("financeNote")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain what needs correcting, or why this is rejected"
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {chosen?.needsTransfer && (
          <span className="text-xs text-muted-foreground">
            Paying {money(outstanding)}
          </span>
        )}
        <Button size="sm" disabled={!ready} onClick={() => onDecide(chosen, note.trim(), { ...transfer, account })}>
          <Check className="me-1.5 h-4 w-4" />
          Submit Decision
        </Button>
      </div>
    </div>
  );
}

/**
 * What has come in before that resembles the request being decided.
 *
 * Each row says why it is here, so a reviewer can tell a repeat supplier
 * invoice apart from the same person claiming the same thing again.
 */
function SupplierHistoryDialog({ invoice, invoices, accountFor, onOpenChange }) {
  const matches = similarRequests(invoices, invoice);

  return (
    <Dialog open={Boolean(invoice)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Previous Requests Like This One</DialogTitle>
          <DialogDescription>
            {invoice.supplier} · raised by {invoice.createdBy}
          </DialogDescription>
        </DialogHeader>

        {matches.length === 0 ? (
          <EmptyState>
            Nothing earlier resembles this request.
          </EmptyState>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[720px] border text-sm">
              <thead>
                <tr className="border-b text-start text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Id</th>
                  <th className="pb-2 font-medium">Supplier</th>
                  <th className="pb-2 font-medium">Invoice Date / Number</th>
                  <th className="pb-2 font-medium">Expense Details</th>
                  <th className="pb-2 text-end font-medium">Invoice Amount</th>
                  <th className="pb-2 font-medium">Invoice Status</th>
                  <th className="pb-2 font-medium">Match</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(({ invoice: past, sameSupplier, sameApplicant, sameKind }) => {
                  const account = accountFor(past.supplier);
                  return (
                    <tr key={past.id} className="border-b align-top transition-colors last:border-0 hover:bg-primary/10">
                      <td className="py-2 font-medium">
                        {past.reference}
                        {past.requestNo && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {past.requestNo}
                          </span>
                        )}
                      </td>

                      <td className="py-2">
                        <span className="block">{past.supplier}</span>
                        <span className="block text-xs text-muted-foreground">
                          {account?.bank || "-"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {account?.accountNumber || "-"}
                        </span>
                      </td>

                      <td className="py-2 text-muted-foreground">
                        <span className="block">{formatDate(past.invoiceDate)}</span>
                        <span className="block text-xs">{past.invoiceNumber}</span>
                        {past.invoiceFile ? (
                          <span
                            title={past.invoiceFile}
                            className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary"
                          >
                            <Paperclip className="h-3 w-3" />
                            Invoice
                          </span>
                        ) : (
                          <span className="text-xs">No invoice copy</span>
                        )}
                      </td>

                      <td className="py-2 text-xs text-muted-foreground">
                        {past.lines.map((line) => (
                          <span key={line.id} className="block">
                            {findType(line.typeKey)?.name} · {line.path.join(" / ")}
                          </span>
                        ))}
                      </td>

                      <td className="py-2 text-end">
                        <span className="block font-semibold">
                          {money(invoiceTotal(past))}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Net {money(invoiceNet(past))}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          VAT {money(invoiceTax(past))}
                        </span>
                      </td>

                      <td className="py-2">
                        <Badge variant={STATUS_VARIANT[past.status]}>
                          {STATUS[past.status]}
                        </Badge>
                      </td>

                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {sameSupplier && <Badge variant="outline">Same supplier</Badge>}
                          {sameKind && <Badge variant="outline">Same expense</Badge>}
                          {sameApplicant && <Badge variant="outline">Same applicant</Badge>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The requests still waiting on somebody.
 *
 * The same page serves the firm and the partners. What separates them is the
 * data: everything the accountant has to see, or everything they must not -
 * partner drawings, salaries and advances, which reach the finance manager
 * without passing through anyone else.
 */
export default function GeneralInvoices({ partnersOnly = false }) {
  const navigate = useNavigate();
  const { invoices, updateInvoice } = useExpenses();
  const { suppliers } = useSuppliers();
  const { leases, recordInstallment } = useLeases();
  const { branches, bankAccounts } = useFirm();

  // Where this supplier is paid, taken from the supplier record.
  const accountFor = (name) => suppliers.find((s) => s.name === name) || null;

  // Auth is not wired up yet, so the role is switchable here to make the
  // visibility rules visible. It becomes the signed-in user's role later.
  const [role, setRole] = useState("admin");
  const roleLabel = VIEWER_ROLES.find((r) => r.key === role)?.label || "";

  // Clicking a stage tile narrows the list to that stage.
  const [stage, setStage] = useState(null);

  // The date a request was raised - what it is ordered by.
  const raisedAt = (invoice) => invoice.history[0]?.at || invoice.invoiceDate;

  const forRole = partnersOnly
    ? invoices.filter((i) => !isApprovedRequest(i) && skipsAccountant(i))
    : visibleInvoices(invoices, role, CURRENT_USER.name).filter(
        (i) => !skipsAccountant(i)
      );
  const visible = forRole
    .filter((i) => !stage || i.status === stage)
    // Oldest first, so whatever has waited longest is dealt with first.
    .slice()
    .sort((a, b) => raisedAt(a).localeCompare(raisedAt(b)) || a.id - b.id);

  // Rent needs nobody to raise a request: a lease installment joins the
  // partners' queue by itself once it falls due, and leaves it once it is
  // paid. It is not waiting at any stage, so narrowing to one hides it.
  const dueRent = partnersOnly && !stage ? dueInstallments(leases) : [];

  const atStage = (key) => forRole.filter((i) => i.status === key);
  const sumOf = (list) => list.reduce((sum, i) => sum + invoiceTotal(i), 0);
  const awaitingAccountant = atStage("accountant");
  const awaitingFinance = atStage("finance");
  const courtFees = courtFeeRequests.reduce((sum, r) => sum + r.amount, 0);

  // Reason capture for a return or rejection, and the payment dialog.
  const [reasonFor, setReasonFor] = useState(null);
  const [reason, setReason] = useState("");
  const [payingFor, setPayingFor] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [requestHistoryFor, setRequestHistoryFor] = useState(null);
  const [payment, setPayment] = useState({
    date: dayOffset(0),
    amount: "",
    method: "",
    reference: "",
  });

  const record = (invoice, status, action, note = "") =>
    updateInvoice(invoice.id, {
      status,
      history: [
        ...invoice.history,
        { at: dayOffset(0), by: roleLabel, action, reason: note },
      ],
    });

  const approve = (invoice) => {
    if (invoice.status === "accountant") {
      record(invoice, "finance", "Approved by Accountant");
    } else if (invoice.status === "finance") {
      record(invoice, "approved", "Approved for Payment");
    }
  };

  /**
   * The finance manager's decision. Approving settles the invoice and files the
   * transfer against it in one write, so a paid request always carries the
   * record of how it was paid.
   */
  const decideFinance = (invoice, decision, note, transfer) => {
    if (!decision.needsTransfer) {
      return record(invoice, decision.status, decision.action, note);
    }

    const outstanding = invoiceTotal(invoice) - amountPaid(invoice);
    const payments = [
      ...invoice.payments,
      {
        id: invoice.payments.length + 1,
        date: transfer.date,
        amount: outstanding,
        method: "Bank Transfer",
        reference: transfer.reference,
        fromAccount: transfer.account
          ? transfer.account.bankName + " - " + transfer.account.accountNumber
          : "",
        document: transfer.document,
      },
    ];

    updateInvoice(invoice.id, {
      payments,
      status: settlementStatus({ ...invoice, payments }),
      history: [
        ...invoice.history,
        {
          at: transfer.date,
          by: roleLabel,
          action: decision.action + " - payment processed",
          reason: transfer.reference ? "Transaction " + transfer.reference : "",
        },
      ],
    });
  };

  const savePayment = () => {
    const amount = Number(payment.amount);
    if (!(amount > 0) || !payment.method) return;

    const updated = {
      ...payingFor,
      payments: [
        ...payingFor.payments,
        { id: payingFor.payments.length + 1, ...payment, amount },
      ],
    };
    updateInvoice(payingFor.id, {
      payments: updated.payments,
      status: settlementStatus(updated),
      history: [
        ...payingFor.history,
        {
          at: payment.date,
          by: "Finance",
          action:
            settlementStatus(updated) === "paid"
              ? "Payment recorded in full"
              : "Part payment recorded",
          reason: "",
        },
      ],
    });
    setPayingFor(null);
    setPayment({ date: dayOffset(0), amount: "", method: "", reference: "" });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary p-2 sm:p-3">
            <ReceiptText className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">
              {partnersOnly ? "Pending Disbursements" : "Payment Requests"}
            </h1>
            <p className="text-xs text-primary/75 sm:text-sm">
              {partnersOnly
                ? "Partners only - what reaches the finance manager directly"
                : "Requests waiting to be paid, oldest first"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Only the partners open their own page, so there is nobody to
              switch to on it. */}
          {!partnersOnly && (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Viewing as
              </span>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-9 w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEWER_ROLES.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button variant="outline" onClick={() => navigate("/expense-requests/create")}>
            <Plus className="me-1.5 h-4 w-4" />
            New Payment Request
          </Button>
        </div>
      </div>

      {/* What is waiting at each stage of the route */}
      <div className="form-grid form-grid-3">
        {/* Nothing on the partners' page waits on the accountant. */}
        {!partnersOnly && (
          <StageTile
            label="Awaiting Accountant Approval"
            count={awaitingAccountant.length}
            amount={sumOf(awaitingAccountant)}
            active={stage === "accountant"}
            onClick={() =>
              setStage(stage === "accountant" ? null : "accountant")
            }
          />
        )}
        <StageTile
          label="Awaiting Finance Manager Approval"
          count={awaitingFinance.length}
          amount={sumOf(awaitingFinance)}
          active={stage === "finance"}
          onClick={() => setStage(stage === "finance" ? null : "finance")}
        />
        {/* Court fees are raised against a case file, so they are counted here
            and listed with the case once that table is designed. */}
        <StageTile
          label="Court Fee Payment Requests"
          count={courtFeeRequests.length}
          amount={courtFees}
          note="Listed with the case file"
        />
      </div>

      {/* ------------------------------------------------------- invoices */}
      <div className="space-y-4">
        {visible.length === 0 && dueRent.length === 0 && (
          <Card>
            <CardContent className="p-6">
              <EmptyState>
                {stage
                  ? "Nothing is waiting at that stage."
                  : partnersOnly
                  ? "No partner disbursements are pending."
                  : role === "admin"
                  ? "No requests are pending."
                  : "Nothing is waiting for you at the moment."}
              </EmptyState>
            </CardContent>
          </Card>
        )}

        {visible.map((invoice, position) => {
          const total = invoiceTotal(invoice);
          const paid = amountPaid(invoice);
          const isAdmin = role === "admin";
          // The accountant and the finance manager each decide through their own
          // block, so the loose buttons are not offered to them as well.
          const accountantReview =
            role === "accountant" && invoice.status === "accountant";
          const financeApproval =
            role === "finance" && invoice.status === "finance";
          const canApprove =
            !accountantReview &&
            !financeApproval &&
            ((invoice.status === "accountant" &&
              (isAdmin || role === "accountant")) ||
              (invoice.status === "finance" && (isAdmin || role === "finance")));
          const canPay =
            ["approved", "partiallyPaid"].includes(invoice.status) &&
            (isAdmin || role === "finance");
          // Whoever is judging the request can read what came before it.
          const canReview =
            accountantReview || financeApproval || canApprove || isAdmin;
          const canResubmit =
            invoice.status === "returned" && (isAdmin || role === "employee");

          return (
            <Card key={invoice.id} className={cn("border-2", FRAMES[position % FRAMES.length])}>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <Route invoice={invoice} />

                <InfoRow>
                  <InfoBox
                    icon={FileText}
                    label="Request Details"
                    action={
                      invoice.invoiceFile ? (
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-primary">
                          <Paperclip className="h-3 w-3" />
                          {invoice.invoiceFile}
                        </span>
                      ) : (
                        <Badge variant="outline">No invoice copy</Badge>
                      )
                    }
                  >
                    <p>
                      <span className="font-semibold text-primary">
                        {invoice.requestNo}
                      </span>
                      {invoice.branch && (
                        <>
                          <Divider />
                          {invoice.branch} Branch
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {invoice.reference} &middot; Invoice {invoice.invoiceNumber}
                    </p>
                  </InfoBox>

                  <InfoBox
                    icon={CalendarDays}
                    label="Submit Request"
                    action={
                      canReview && (
                        <button
                          type="button"
                          onClick={() => setRequestHistoryFor(invoice)}
                          className="rounded text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          View Request History
                        </button>
                      )
                    }
                  >
                    <p>
                      <span className="text-muted-foreground">Applicant:</span>{" "}
                      <span className="font-medium">{invoice.createdBy}</span>
                    </p>
                    <p className="mt-1">
                      <span className="text-muted-foreground">Approval:</span>{" "}
                      <span className="font-medium">{approverOf(invoice)}</span>
                    </p>
                  </InfoBox>

                  <InfoBox
                    icon={Building2}
                    label="Supplier details"
                    action={
                      canReview && (
                        <button
                          type="button"
                          onClick={() => setHistoryFor(invoice)}
                          className="rounded text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          View Supplier History
                        </button>
                      )
                    }
                  >
                    <p>
                      <span className="font-medium">{invoice.supplier}</span>
                      {accountFor(invoice.supplier)?.accountNumber && (
                        <>
                          <Divider />
                          {accountFor(invoice.supplier).accountNumber}
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {accountFor(invoice.supplier)?.bank || "No account on file"}
                    </p>
                  </InfoBox>

                  <InfoBox icon={ClipboardList} label="Request Summary">
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <span>
                        <span className="block text-[11px] text-muted-foreground">
                          Before VAT
                        </span>
                        {money(invoiceNet(invoice))}
                      </span>
                      <span>
                        <span className="block text-[11px] text-muted-foreground">
                          VAT
                        </span>
                        {money(invoiceTax(invoice))}
                      </span>
                      <span>
                        <span className="block text-[11px] text-muted-foreground">
                          Total
                        </span>
                        <span className="font-bold text-destructive">
                          {money(total)}
                        </span>
                      </span>
                    </div>
                    {paid > 0 && (
                      <p className="mt-1 text-xs font-medium text-green-600">
                        Paid {money(paid)} of {money(total)}
                      </p>
                    )}
                  </InfoBox>
                </InfoRow>

                <div className="rounded-lg border">
                  <p className="border-b px-4 py-2 text-sm font-semibold">
                    Expenses ({invoice.lines.length})
                  </p>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-start text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-medium">#</th>
                        <th className="px-4 py-2 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            Expense Type
                          </span>
                        </th>
                        <th className="px-4 py-2 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <Tag className="h-3.5 w-3.5" />
                            Category
                          </span>
                        </th>
                        <th className="px-4 py-2 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <ListTree className="h-3.5 w-3.5" />
                            Subcategory
                          </span>
                        </th>
                        <th className="px-4 py-2 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <AlignLeft className="h-3.5 w-3.5" />
                            Description
                          </span>
                        </th>
                        <th className="px-4 py-2 text-end font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <Calculator className="h-3.5 w-3.5" />
                            Before VAT
                          </span>
                        </th>
                        <th className="px-4 py-2 text-end font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <Percent className="h-3.5 w-3.5" />
                            VAT
                          </span>
                        </th>
                        <th className="px-4 py-2 text-end font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <ClipboardList className="h-3.5 w-3.5" />
                            Total
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lines.map((line, i) => (
                        <tr key={line.id} className="border-b transition-colors last:border-0 hover:bg-primary/10">
                          <td className="px-4 py-2 text-muted-foreground">
                            {i + 1}
                          </td>
                          <td className="px-4 py-2 font-medium">
                            {findType(line.typeKey)?.name}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {line.path[0]}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {line.path[1] || "-"}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {line.description || "-"}
                          </td>
                          <td className="px-4 py-2 text-end">
                            {money(line.amountBeforeTax)}
                          </td>
                          <td className="px-4 py-2 text-end text-muted-foreground">
                            {money(line.taxAmount)}
                          </td>
                          <td className="px-4 py-2 text-end font-semibold">
                            {money(lineTotal(line))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>

                {/* Payments recorded so far */}
                {invoice.payments.length > 0 && (
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="mb-2 text-xs font-semibold">Payments</p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {invoice.payments.map((p) => (
                        <li key={p.id} className="flex justify-between gap-3">
                          <span>
                            {formatDate(p.date)} · {p.method}
                            {p.reference && " · " + p.reference}
                            {p.fromAccount && " · from " + p.fromAccount}
                            {p.document && (
                              <span className="ms-1 inline-flex items-center gap-1 text-primary">
                                <Paperclip className="h-3 w-3" />
                                {p.document}
                              </span>
                            )}
                          </span>
                          <span className="font-medium text-foreground">
                            {money(p.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Trail of who did what, and why */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    History ({invoice.history.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {invoice.history.map((entry, i) => (
                      <li key={i} className="text-muted-foreground">
                        {formatDate(entry.at)} · {entry.by} · {entry.action}
                        {entry.reason && (
                          <span className="text-foreground"> - {entry.reason}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>

                {accountantReview && (
                  <AccountantReview
                    invoiceId={invoice.id}
                    onDecide={(decision, note) =>
                      record(invoice, decision.status, decision.action, note)
                    }
                  />
                )}

                {financeApproval && (
                  <FinanceApproval
                    invoice={invoice}
                    supplierAccount={accountFor(invoice.supplier)}
                    outstanding={total - paid}
                    onDecide={(decision, note, transfer) =>
                      decideFinance(invoice, decision, note, transfer)
                    }
                  />
                )}

                {/* Actions available at this step */}
                <div className="flex flex-wrap justify-end gap-2">
                  {canApprove && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReasonFor({ invoice, kind: "returned" });
                          setReason("");
                        }}
                      >
                        <Undo2 className="me-1.5 h-4 w-4" />
                        Return for Correction
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          setReasonFor({ invoice, kind: "rejected" });
                          setReason("");
                        }}
                      >
                        <X className="me-1.5 h-4 w-4" />
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => approve(invoice)}>
                        <Check className="me-1.5 h-4 w-4" />
                        {invoice.status === "accountant"
                          ? "Approve"
                          : "Approve for Payment"}
                      </Button>
                    </>
                  )}

                  {canPay && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setPayingFor(invoice);
                        setPayment({
                          date: dayOffset(0),
                          amount: String(total - paid),
                          method: "",
                          reference: "",
                        });
                      }}
                    >
                      <Banknote className="me-1.5 h-4 w-4" />
                      Record Payment
                    </Button>
                  )}

                  {canResubmit && (
                    <Button
                      size="sm"
                      onClick={() =>
                        record(
                          invoice,
                          firstReviewFor(invoice.creatorRole),
                          "Resubmitted after correction"
                        )
                      }
                    >
                      Resubmit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {dueRent.map(({ lease, row, count }, i) => (
          <InstallmentPanel
            key={lease.id + "-" + row.no}
            className={cn("border-2", FRAMES[(visible.length + i) % FRAMES.length])}
            row={row}
            lease={lease}
            count={count}
            branchName={
              branches.find((branch) => branch.id === Number(lease.branchId))?.name || "-"
            }
            bankAccounts={bankAccounts}
            onSave={(entry) => recordInstallment(lease.id, row.no, entry)}
          />
        ))}
      </div>

      {requestHistoryFor && (
        <RequestHistoryDialog
          invoice={requestHistoryFor}
          onOpenChange={(open) => !open && setRequestHistoryFor(null)}
        />
      )}

      {historyFor && (
        <SupplierHistoryDialog
          invoice={historyFor}
          invoices={invoices}
          accountFor={accountFor}
          onOpenChange={(open) => !open && setHistoryFor(null)}
        />
      )}

      {/* Reason is compulsory for a return or a rejection */}
      <Dialog
        open={Boolean(reasonFor)}
        onOpenChange={(open) => !open && setReasonFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonFor?.kind === "rejected"
                ? "Reject invoice"
                : "Return for correction"}
            </DialogTitle>
            <DialogDescription>
              The reason is recorded against the invoice and shown to whoever
              raised it.
            </DialogDescription>
          </DialogHeader>
          <div className="form-field space-y-2">
            <Label htmlFor="decisionReason">Reason</Label>
            <Textarea
              required
              id="decisionReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain what needs correcting, or why this is rejected"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                record(
                  reasonFor.invoice,
                  reasonFor.kind,
                  reasonFor.kind === "rejected"
                    ? "Rejected"
                    : "Returned for Correction",
                  reason.trim()
                );
                setReasonFor(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment details the document asks to be recorded */}
      <Dialog
        open={Boolean(payingFor)}
        onOpenChange={(open) => !open && setPayingFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              {payingFor && (
                <>
                  Outstanding{" "}
                  {money(invoiceTotal(payingFor) - amountPaid(payingFor))} of{" "}
                  {money(invoiceTotal(payingFor))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {payingFor && accountFor(payingFor.supplier) && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p className="mb-1 font-medium">
                Pay {payingFor.supplier}
              </p>
              <p className="text-muted-foreground">
                {accountFor(payingFor.supplier).bank || "-"} &middot;{" "}
                {accountFor(payingFor.supplier).accountNumber || "-"}
              </p>
            </div>
          )}

          <div className="form-grid form-grid-2">
            <div className="form-field space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <DateField
                required
                id="paymentDate"
                value={payment.date}
                onChange={(e) => setPayment({ ...payment, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Amount Paid (<Rial />)</Label>
              <Input
                id="paymentAmount"
                type="number"
                min="1"
                value={payment.amount}
                onChange={(e) =>
                  setPayment({ ...payment, amount: e.target.value })
                }
              />
            </div>
            <div data-required="true" className="form-field space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={payment.method}
                onValueChange={(value) =>
                  setPayment({ ...payment, method: value })
                }
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Please Select" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentReference">Transaction / Reference No.</Label>
              <Input
                id="paymentReference"
                value={payment.reference}
                onChange={(e) =>
                  setPayment({ ...payment, reference: e.target.value })
                }
                placeholder="If available"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={!(Number(payment.amount) > 0) || !payment.method}
              onClick={savePayment}
            >
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
