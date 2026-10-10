import { useState } from "react";
import { PayeeFacts } from "@/components/shared/RequestSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RequestTable from "@/components/shared/RequestTable";
import RequestOverview from "@/components/shared/RequestOverview";
import { AdvanceSteps, longDate } from "./AdvanceSalarySection";
import { Card, CardContent } from "@/components/ui/card";
import { Bordered, EmptyState } from "@/components/shared/panels";
import {
  FieldLabel,
  Settled,
  Said,
  Choice,
  Field,
  Attach,
  checkRequired,
} from "@/components/shared/formFields";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
  RecordLink,
} from "@/components/shared/RecordTable";
import { Rial } from "@/components/shared/Rial";
import {
  FileText,
  History,
  Plus,
  Gift,
  X,
  FilePenLine,
  CloudUpload,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { amountValue } from "@/lib/money";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REQUEST_REJECTED, REQUEST_STATUS_CHIP } from "../requestFlow";
import { DecisionChoice } from "@/components/shared/RequestSteps";
import { useBonuses } from "@/lib/bonuses/context";
import { formatDate } from "../loanData";
import { PAYMENT_METHODS } from "@/pages/expenses/expenseData";
import { PAYING_ACCOUNTS } from "@/pages/firm/firmData";
import {
  BONUS_BOOKING,
  BONUS_EXPENSE_TYPE,
  BONUS_CATEGORY,
  BONUS_SUBCATEGORIES,
  BONUS_DISBURSED,
  BONUS_APPROVED,
  BONUS_STATUS_CHIP,
  OTHER_BONUS,
  bonusDate,
  bonusReason,
  bonusesFor,
  nextBonusNo,
} from "../bonusData";

import DateField from "@/components/shared/DateField";
const COMMENT_LIMIT = 500;

/** "BON-008" asked in 2026, as the head of the request reads it: "BON 08/2026". */
const shortBonusNo = (requestNo, on) => {
  const [prefix, count] = String(requestNo).split("-");
  return /^\d+$/.test(count || "")
    ? prefix + " " + String(Number(count)).padStart(2, "0") + "/" + String(on).slice(0, 4)
    : requestNo;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyDraft = () => ({
  subcategory: "",
  bonusType: "",
  amount: "",
  bonusDate: todayIso(),
  comment: "",
});

/** How the bonus actually reaches the employee, once it is granted. */
const emptyPayment = () => ({
  ...BONUS_BOOKING,
  method: "",
  bankAccount: "",
  paidOn: todayIso(),
  reference: "",
});

/**
 * The bonuses one employee has asked for, and what became of each.
 *
 * A bonus is asked for the way everything else in this section is: the
 * employee writes the request, it goes on the list under its own number
 * waiting on a decision, and management answers it - granting what was asked
 * for, granting less, or refusing it and saying why. Every one is booked to
 * Employee Expenses under Bonus, which is shown rather than asked for.
 */
export default function BonusSection({
  employee,
  adding,
  onCloseAdd,
  // Opening a request from the list puts the section back into adding, so
  // the window over the page is the one that shows it.
  onOpenAdd,
  // The words on the button that opens the form, over the list it adds to.
  addLabel = "Bonus Request",
  // The firm pays a bonus out; on the employee's own page the payment is
  // read and never recorded.
  canDecide = true,
}) {
  const { bonuses, addBonus, updateBonus, decideBonus, payBonus } = useBonuses();
  // While a call to the server is out, its button waits rather than sending twice.
  const [busy, setBusy] = useState(false);
  const send = async (call) => {
    if (busy) return null;
    setBusy(true);
    try {
      return await call();
    } finally {
      setBusy(false);
    }
  };
  const [draft, setDraft] = useState(emptyDraft);
  // Which half of the bonus is open - what is being asked for, and then how
  // it was paid out - and the request the form is open on.
  const [stage, setStage] = useState("request");
  const [openId, setOpenId] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [payment, setPayment] = useState(emptyPayment);
  const [receipt, setReceipt] = useState(null);
  // History, open over the form.
  const [showHistory, setShowHistory] = useState(false);
  // Management's answer: approve in full or in part, or refuse - and why.
  const [decision, setDecision] = useState("");
  const [approved, setApproved] = useState("");
  const [comment, setComment] = useState("");

  const open = bonuses.find((bonus) => bonus.id === openId) || null;
  const settled = open?.status === BONUS_DISBURSED;
  const refused = open?.status === REQUEST_REJECTED;
  // Approved by management and waiting to be paid.
  const awaiting = open?.status === BONUS_APPROVED;

  const mine = bonusesFor(bonuses, employee?.name).map((bonus) => ({
    ...bonus,
    bonusOn: bonusDate(bonus),
    reasonText: bonusReason(bonus),
  }));
  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));
  const setPay = (name, value) =>
    setPayment((prev) => ({ ...prev, [name]: value }));

  const isOther = draft.subcategory === OTHER_BONUS;
  const requestNo = open?.requestNo || nextBonusNo(bonuses);
  const requestedOn = open ? bonusDate(open) : todayIso();
  const attachedName = attachment?.name || open?.attachment || "";
  // What the bonus is called, which is also what it is filed under.
  const bonusName = isOther ? draft.bonusType.trim() : draft.subcategory;

  const requested = Number(draft.amount) || 0;
  const refusing = decision === "rejected";
  const amending = decision === "partial";
  // What is paid: what was asked for, unless management granted less.
  const approvedAmount = amending
    ? Number(approved) || 0
    : open?.approvedAmount ?? requested;
  const grantIsSound = !amending || (approvedAmount > 0 && approvedAmount < requested);
  const canConfirm =
    Boolean(open) && canDecide && Boolean(decision) && grantIsSound && (!refusing || comment.trim());

  const canSubmit = draft.subcategory && (!isOther || draft.bonusType.trim()) && requested > 0;

  // Nothing is paid out until the transfer says where it went and what the
  // bank called it.
  const canPay =
    Boolean(open) &&
    payment.method &&
    payment.bankAccount &&
    payment.paidOn &&
    payment.reference.trim();

  const close = () => {
    setDraft(emptyDraft());
    setPayment(emptyPayment());
    setReceipt(null);
    setAttachment(null);
    setStage("request");
    setOpenId(null);
    setDecision("");
    setApproved("");
    setComment("");
    onCloseAdd();
  };

  /**
   * The bonus asked for. It goes on the list straight away, under its own
   * number and waiting on a decision.
   */
  const submit = async () => {
    if (!checkRequired() || !canSubmit) return;
    const details = {
      subcategory: draft.subcategory,
      bonusType: isOther ? draft.bonusType.trim() : "",
      amount: requested,
      notes: draft.comment.trim(),
    };

    // The server numbers it and dates it; a refusal leaves the form as it was.
    const saved = await send(() =>
      open
        ? updateBonus(open.id, details, attachment, employee?.id)
        : addBonus(details, attachment, employee?.id)
    );
    if (saved) close();
  };

  /** Paid out: the bonus is disbursed, and the record says how. */
  const disburse = async () => {
    if (!checkRequired() || !canPay || !canDecide || !open || !awaiting) return;
    const saved = await send(() =>
      payBonus(open.id, {
        method: payment.method,
        bankAccount: payment.bankAccount,
        paidOn: payment.paidOn,
        reference: payment.reference.trim(),
      })
    );
    if (saved) close();
  };

  /**
   * Management's answer, saved before anything is paid. An approval moves on
   * to the financial department; a refusal ends the request with its reason.
   */
  const confirmDecision = async () => {
    if (!canConfirm) return;
    // The server records who decided and when.
    const saved = await send(() =>
      decideBonus(open.id, { decision, approvedAmount, comment: comment.trim() })
    );
    if (!saved) return;
    if (refusing) {
      close();
      return;
    }
    setStage("disbursement");
  };

  /** A request opened back off the list, to be followed or decided. */
  const track = (bonus) => {
    setOpenId(bonus.id);
    setStage(
      bonus.status === BONUS_APPROVED || bonus.status === BONUS_DISBURSED ? "disbursement" : "decision"
    );
    setDecision(bonus.decision || (bonus.status === REQUEST_REJECTED ? "rejected" : ""));
    setApproved(bonus.decision === "partial" ? String(bonus.approvedAmount ?? "") : "");
    setComment(bonus.managementComment || bonus.rejectionReason || "");
    setAttachment(null);
    setReceipt(null);
    setDraft({
      subcategory: bonus.subcategory,
      bonusType: bonus.bonusType || "",
      amount: String(bonus.amount),
      bonusDate: bonusDate(bonus),
      comment: bonus.notes || "",
    });
    setPayment({
      ...emptyPayment(),
      method: bonus.method || "",
      bankAccount: bonus.bankAccount || "",
      paidOn: bonus.paidOn || todayIso(),
      reference: bonus.reference || "",
    });
    onOpenAdd?.();
  };

  // The list's columns, on the page and in the History window alike.
  const columns = [
    {
      // Clicking the number opens the request back up.
      key: "requestNo",
      header: "Request No.",
      width: "12%",
      render: (value, bonus) => <RecordLink onClick={() => track(bonus)}>{value}</RecordLink>,
    },
    {
      key: "bonusOn",
      header: "Bonus Date",
      width: "13%",
      render: (value) => <span className="whitespace-nowrap text-primary">{formatDate(value)}</span>,
    },
    {
      key: "reasonText",
      header: "Bonus Details",
      width: "24%",
      render: (value, bonus) => (
        <>
          <span className="block font-semibold text-primary">{value}</span>
          <span className="block text-xs text-muted-foreground">
            {bonus.expenseType} &rarr; {bonus.category}
          </span>
        </>
      ),
    },
    {
      key: "amount",
      header: "Bonus Amount (OMR)",
      width: "15%",
      render: (value) => <span className="whitespace-nowrap font-bold text-green-700">{amountValue(value)}</span>,
    },
    {
      key: "notes",
      header: "Employee Comment",
      width: "22%",
      render: (value) => <span className="text-muted-foreground">{value || "-"}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "14%",
      render: (value) => (
        <span
          className={cn(
            "block w-fit rounded-md px-2.5 py-0.5 text-xs font-semibold",
            BONUS_STATUS_CHIP[value] || REQUEST_STATUS_CHIP[value]
          )}
        >
          {value}
        </span>
      ),
    },
  ];

  // The form opens over the page rather than pushing it down: the list it is
  // filed into stays where it was, behind it.
  const form = (
    <div className="space-y-6">
      {/* The request's head: what it is, then whose it is, when it was
          asked and its number - the close button beyond them. */}
      <div className="flex flex-wrap items-start gap-4 pe-16">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary"
        >
          <Gift className="size-7" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <DialogTitle className="text-2xl font-bold text-primary">Bonus Request</DialogTitle>
          <DialogDescription className="text-sm text-primary/75">
            {stage === "request"
              ? "Submit a new bonus request with the required details and supporting documents."
              : "Record how the bonus was paid out."}
          </DialogDescription>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-3 pt-2 text-sm text-primary">
          <span>{employee?.empNo || ""}</span>
          <span aria-hidden="true" className="h-5 w-px bg-container-border" />
          <span>{employee?.name || ""}</span>
          <span aria-hidden="true" className="h-5 w-px bg-container-border" />
          {/* On the step that pays, the head says where the money goes -
              the employee's bank and account - in place of the date and
              the number, as the finance design draws it. */}
          {stage === "disbursement" ? (
            <PayeeFacts employee={employee} />
          ) : (
            <>
              <span>{longDate(requestedOn)}</span>
              <span aria-hidden="true" className="h-5 w-px bg-container-border" />
              <span className="rounded-md bg-primary/10 px-3 py-1.5 text-base font-bold text-primary">
                {shortBonusNo(requestNo, requestedOn)}
              </span>
            </>
          )}
        </div>
        <DialogClose className="absolute end-5 top-5 rounded-md p-1 text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-7" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </div>

      {/* The three stages: the request, management's decision, and the
          financial department paying it. */}
      <AdvanceSteps
        active={stage === "disbursement" ? "finance" : stage}
        onChange={(key) => setStage(key === "finance" ? "disbursement" : key)}
        steps={[
          {
            key: "request",
            title: "Bonus Request",
            note: "Enter bonus details and upload supporting documents",
            done: Boolean(open),
          },
          {
            key: "decision",
            title: "Management Comment",
            note: "Review and approve",
            done: awaiting || settled || refused,
            disabled: !open,
          },
          {
            key: "finance",
            title: "Disbursement Actions",
            note: "Financial department processing",
            done: settled,
            disabled: !open || !(awaiting || settled),
          },
        ]}
      />

      {stage === "decision" ? (
        <>
          {/* What was asked for, read back before it is decided. */}
          <Bordered title="Request Summary">
            <div className="form-grid">
              <Settled id="bonus-type-said" label="Bonus Type" value={bonusName || "-"} />
              <Settled id="bonus-on-said" label="Bonus Date" value={formatDate(requestedOn)} />
              <Settled id="bonus-requested-said" label="Requested Amount" value={amountValue(requested)} payable />
              <Settled id="bonus-file-said" label="Supporting Document" value={attachedName || "-"} />
            </div>
            {draft.comment && (
              <p className="mt-4 rounded-md border bg-blue-50/40 px-3 py-2 text-sm text-primary">
                <span className="font-semibold">Employee Comment: </span>
                {draft.comment}
              </p>
            )}
          </Bordered>

          <DecisionChoice
            value={decision}
            onChange={setDecision}
            disabled={!canDecide || awaiting || settled || refused}
            offers={["full", "partial", "rejected"]}
            notes={{
              full: "Approve the bonus as requested",
              partial: "Approve a lower bonus amount",
              rejected: "Reject the bonus request",
            }}
          />

          <div className={cn("grid gap-4", amending && "md:grid-cols-[1fr_3fr]")}>
            {amending && (
              <div className="form-field space-y-2">
                <FieldLabel htmlFor="bonus-approved" required>
                  Approved Amount (<Rial />)
                </FieldLabel>
                <Input
                  id="bonus-approved"
                  inputMode="decimal"
                  value={approved}
                  onChange={(e) => setApproved(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0.000"
                  disabled={!canDecide || awaiting || settled}
                  aria-invalid={!grantIsSound || undefined}
                />
                {!grantIsSound && approved && (
                  <p role="alert" className="text-xs font-semibold text-destructive">
                    Less than the {amountValue(requested)} requested
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <FieldLabel htmlFor="bonus-decision-comment" required={refusing}>
                {refusing ? "Reason for Rejection" : "Management Comment"}
              </FieldLabel>
              <Textarea
                id="bonus-decision-comment"
                maxLength={300}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={!canDecide || awaiting || settled || refused}
                placeholder={refusing ? "Enter the reason for rejection" : "Enter your comment here..."}
              />
              <p className="text-end text-xs text-muted-foreground">{comment.length}/300</p>
            </div>
          </div>
        </>
      ) : stage === "disbursement" ? (
        <>
          {/* Management's answer, read before it is paid. */}
          <Bordered title="Management Decision">
            <div className="form-grid">
              <Settled id="bonus-decision-said" label="Decision" value={open?.decision === "partial" ? "Partial Approval" : open?.decision ? "Full Approval" : "-"} />
              <Settled id="bonus-decided-on" label="Decision Date" value={open?.decidedOn ? formatDate(open.decidedOn) : "-"} />
              <Settled id="bonus-approved-said" label="Approved Amount" value={amountValue(approvedAmount)} payable />
              <Settled id="bonus-comment-said" label="Management Comment" value={open?.managementComment || "-"} />
            </div>
          </Bordered>

          {/* What is being paid, read off the request rather than asked for
              again. */}
          <Bordered title="Bonus Information">
            <div className="form-grid">
              <Settled id="bonus-no-said" label="Bonus No." value={requestNo} />
              <Settled
                id="bonus-date-said"
                label="Bonus Date"
                value={formatDate(draft.bonusDate)}
              />
              <Settled
                id="bonus-employee-said"
                label="Employee Name"
                value={employee?.name || ""}
              />
              <Settled
                id="bonus-amount-said"
                label="Bonus Amount"
                value={amountValue(approvedAmount)}
                payable
              />
            </div>
          </Bordered>

          {/* Where it is booked, and how it actually leaves. */}
          <Bordered title="Expense & Disbursement Details">
            <div className="form-grid">
              <Settled
                id="bonus-expense-type"
                label="Expense Type"
                value={BONUS_EXPENSE_TYPE}
              />
              <Settled
                id="bonus-category"
                label="Category"
                value={BONUS_CATEGORY}
              />
              <Settled
                id="bonus-subcategory"
                label="Subcategory"
                value={bonusName}
              />

              <Choice
                id="bonus-method"
                label="Payment Method"
                value={payment.method}
                onChange={(value) => value && setPay("method", value)}
                placeholder="Select method"
                options={PAYMENT_METHODS}
              />

              {/* One choice, not two: the account carries the bank it is
                  held at, so they cannot be set to disagree. */}
              <Choice
                id="bonus-bank"
                label="Bank Account"
                value={payment.bankAccount}
                onChange={(value) => value && setPay("bankAccount", value)}
                placeholder="Select bank account"
                options={PAYING_ACCOUNTS}
              />

              <div className="flex h-full flex-col justify-end gap-2">
                <FieldLabel htmlFor="bonus-paid-on" required>
                  Payment Date
                </FieldLabel>
                <DateField
                  id="bonus-paid-on"
                  value={payment.paidOn}
                  onChange={(e) => setPay("paidOn", e.target.value)}
                />
              </div>

              {/* What the bank called the transfer, and the proof of it. */}
              <div className="flex h-full flex-col justify-end gap-2">
                <FieldLabel htmlFor="bonus-reference" required>
                  Transfer No.
                </FieldLabel>
                <div className="flex w-full min-w-0 items-center gap-2">
                  <Input
                    id="bonus-reference"
                    className="min-w-0 flex-1"
                    value={payment.reference}
                    onChange={(e) => setPay("reference", e.target.value)}
                    placeholder="TRX-0000-00000"
                  />
                  <Attach
                    file={receipt}
                    onPick={setReceipt}
                    label="transfer receipt"
                  />
                </div>
              </div>

              {/* The figure being transferred is the one the request settled
                  on, so it is shown rather than typed again. */}
              <Settled
                id="bonus-to-disburse"
                label="Amount to Disburse"
                value={amountValue(approvedAmount)}
                payable
              />
            </div>
          </Bordered>

          {/* Who is being paid and where it lands, in one line to be read
              against the transfer above before it is confirmed. */}
          <div className="rounded-lg border border-green-600/40 bg-green-50/50 p-4">
            <p className="mb-3 flex items-center gap-2 font-semibold text-green-700">
              <span
                aria-hidden="true"
                className="h-5 w-1 shrink-0 rounded-full bg-green-600"
              />
              Employee &amp; Transfer Summary
            </p>
            <div className="form-grid lg:[&>*+*]:border-s">
              <Said label="Employee No." value={employee?.empNo || ""} />
              <Said label="Employee Name" value={employee?.name || ""} />
              {/* Where the money lands: the employee's own account, not the
                  firm's account it leaves from. */}
              <Said label="Bank Name" value={employee?.bankName || "-"} />
              <Said label="Account Number" value={employee?.accountNumber || "-"} />
              <Said
                label="Transfer Amount"
                value={amountValue(approvedAmount)}
                settled
              />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* What it is for, the paper that backs it, how much, and why. */}
          <section className="space-y-4 rounded-xl border p-4 sm:p-5">
            <h3 className="flex items-center gap-3 text-lg font-bold text-primary">
              <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-lg bg-blue-50">
                <FilePenLine className="size-6" strokeWidth={1.5} />
              </span>
              Request Details
            </h3>
            {/* Each field sits in a cell of its own - the form's fields bring
                their twelve-column spans, which mean nothing outside that grid. */}
            <div className="grid items-start gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,7fr)]">
              <div className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <Choice
                      id="bonus-subcategory-pick"
                      label="Bonus Type"
                      value={draft.subcategory}
                      onChange={(value) => value && set("subcategory", value)}
                      placeholder="Select bonus type"
                      options={BONUS_SUBCATEGORIES}
                    />
                  </div>
                  {/* The supporting document, beside what it supports. */}
                  <label
                    className="flex h-[42px] w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-blue-50/60 text-primary transition-colors hover:bg-blue-50 focus-within:ring-2 focus-within:ring-ring"
                    title={attachedName || "Upload supporting document"}
                  >
                    <CloudUpload className="size-6" aria-hidden="true" />
                    <span className="sr-only">Upload supporting document</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) setAttachment(file);
                      }}
                    />
                  </label>
                </div>
                {attachedName && (
                  <p className="flex items-center gap-1.5 text-sm text-primary">
                    <FileText className="h-4 w-4 shrink-0" />
                    {attachedName}
                  </p>
                )}
                {/* Only where the list does not already say what the bonus is
                    for, under the choice that asked the question. */}
                {isOther && (
                  <Field id="bonus-other-type" label="Say What For" required>
                    <Input
                      id="bonus-other-type"
                      value={draft.bonusType}
                      onChange={(e) => set("bonusType", e.target.value)}
                      placeholder="Say what the bonus is for"
                      autoComplete="off"
                    />
                  </Field>
                )}
              </div>

              <div>
                <Field id="bonus-amount" label="Requested Amount (OMR)" required>
                  <div className="relative">
                    <Input
                      id="bonus-amount"
                      inputMode="decimal"
                      className="pe-14"
                      value={draft.amount}
                      onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="0.000"
                    />
                    <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Rial />
                    </span>
                  </div>
                </Field>
              </div>

              <div>
                <Field id="bonus-comment" label="Employee Comment" required>
                  <Textarea
                    id="bonus-comment"
                    maxLength={COMMENT_LIMIT}
                    value={draft.comment}
                    onChange={(e) => set("comment", e.target.value)}
                    placeholder="Enter the reason for this bonus request..."
                  />
                  <p className="-mt-1 text-end text-xs text-muted-foreground">
                    {draft.comment.length}/{COMMENT_LIMIT}
                  </p>
                </Field>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Plain buttons: this form sits inside the employee form, which either
          would otherwise submit. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Everything asked for before, over this window. */}
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="flex w-full items-center gap-4 rounded-xl border bg-blue-50/40 px-4 py-3 text-start transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-md"
        >
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <History className="size-6" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold text-primary">History</span>
            <span className="block text-sm text-primary/75">
              View this request timeline and employee&apos;s previous requests
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
        </button>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="min-w-36" onClick={close}>
            Cancel
          </Button>
          {stage === "decision" ? (
            canDecide &&
            !awaiting &&
            !settled &&
            !refused && (
              <Button
                type="button"
                className="min-w-48"
                variant={refusing ? "destructive" : "default"}
                onClick={confirmDecision}
                disabled={!canConfirm || busy}
              >
                {refusing ? "Confirm Rejection" : "Confirm Decision"}
              </Button>
            )
          ) : stage === "disbursement" ? (
            canDecide &&
            awaiting && (
              <Button type="button" className="min-w-48" onClick={disburse} disabled={!canPay || busy}>
                Process Payment
              </Button>
            )
          ) : (
            <Button type="button" className="min-w-48" onClick={submit} disabled={busy}>
              Submit Request
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        {/* Opened over the page, so the list it is filed into stays behind. */}
        <Dialog open={Boolean(adding)} onOpenChange={(o) => !o && close()}>
          <DialogContent hideClose className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
            {form}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Bonus History · {employee?.name}</DialogTitle>
                  <DialogDescription>Every bonus this employee has asked for.</DialogDescription>
                </DialogHeader>
                <RequestTable
                  rows={mine}
                  columns={columns}
                  searchPlaceholder="Search by request no., reason or comment..."
                  itemLabel="bonuses"
                  exportFileName="bonuses.csv"
                />
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>

        {/* What has been asked for, a reading of it, and the way to ask -
            over the list itself. */}
        <RequestOverview
          icon={Gift}
          title="Bonus"
          subtitle="Request a bonus and track your requests."
          noun="bonus request"
          newLabel="New Bonus Request"
          onNew={addLabel && !adding ? onOpenAdd : null}
          money
          typeLabel="Bonus Type"
          rows={mine.map((bonus) => ({
            id: bonus.id,
            no: bonus.requestNo,
            date: bonus.bonusOn,
            amount: bonus.amount,
            status: bonus.status,
            type: bonus.reasonText,
            record: bonus,
          }))}
          onOpen={adding ? null : track}
          // The suggested sum, written into a new request to confirm or change.
          onApply={
            addLabel && !adding
              ? (suggested) => {
                  setDraft({ ...emptyDraft(), amount: String(suggested) });
                  onOpenAdd?.();
                }
              : null
          }
          renderAll={() => (
            <RequestTable
              rows={mine}
              columns={columns}
              searchPlaceholder="Search by request no., reason or comment..."
              itemLabel="bonuses"
              exportFileName="bonuses.csv"
            />
          )}
        />

        <RequestTable
          rows={mine}
          columns={columns}
          searchPlaceholder="Search by request no., reason or comment..."
          itemLabel="bonuses"
          exportFileName="bonuses.csv"
        />
      </CardContent>
    </Card>
  );
}
