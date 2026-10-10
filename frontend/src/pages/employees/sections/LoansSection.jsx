import {
  Fragment,
  useState } from "react";
import { PayeeFacts, HistoryCard } from "@/components/shared/RequestSheet";
import LoanLedger, { ExistingLoans } from "./LoanLedger";
import { AdvanceSteps, longDate } from "./AdvanceSalarySection";
import DateField from "@/components/shared/DateField";
import { amountValue } from "@/lib/money";
import { Button } from "@/components/ui/button";
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
import { Bordered, EmptyState } from "@/components/shared/panels";
import {
  FieldLabel,
  Settled,
  Said,
  Choice,
  Attach,
  checkRequired,
} from "@/components/shared/formFields";
import AiSearch from "@/components/shared/AiSearch";
import { PAYMENT_METHODS } from "@/pages/expenses/expenseData";
import { PAYING_ACCOUNTS } from "@/pages/firm/firmData";
import { Card, CardContent } from "@/components/ui/card";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
} from "@/components/shared/RecordTable";
import { cn } from "@/lib/utils";
import { Rial } from "@/components/shared/Rial";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequestSteps, DecisionChoice } from "@/components/shared/RequestSteps";
import {
  HandCoins,
  Plus,
  History,
  FileText,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Coins,
  FilePenLine,
  Info,
  X,
} from "lucide-react";
import {
  LOAN_EXPENSE_TYPE,
  LOAN_CATEGORY,
  LOAN_INCREASE,
  LOAN_REJECTED,
  LOAN_RETURNED,
  isApprovedLoan,
  LOAN_DECISION_STATUS,
  LOAN_STATUS_CHIP,
  loanCategoryFor,
  nextLoanNo,
  startMonths,
  monthEnd,
  outstandingTotal,
  pendingRequest,
  loanRecords,
  loansFor,
  schedule,
  dueDate,
  INSTALLMENT_STATUS_TONE,
  amount,
  formatDate,
} from "../loanData";
import { loansApi } from "@/lib/api/modules/loans";
import { attempt } from "@/lib/api/notice";
import { upsert, upserted } from "@/lib/api/store";

// Three figures are asked for and everything else is counted from them:
// how much is wanted, what comes off each month, and when the first one
// falls due. Where the loan is booked is not among them: it is settled by
// what the employee already owes.
const emptyDraft = {
  requested: "",
  extraRequested: "",
  monthly: "",
  startMonth: "",
  comment: "",
};

const COMMENT_LIMIT = 300;

/**
 * One labelled line of a loan's summary.
 *
 * The labels are given a fixed width so the colons line up down the cell,
 * which is what makes three different facts read as one block.
 */
function Detail({ label, children }) {
  return (
    <span className="block text-xs">
      <span className="inline-block w-32 text-muted-foreground">{label}</span>
      <span className="font-semibold text-primary">: {children}</span>
    </span>
  );
}

/** An amount field, with the currency named in its label. */
function AmountField({ id, label, required, value, onChange, readOnly }) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id}>
        {label} (<Rial />)
      </FieldLabel>
      <Input
        required={required && !readOnly}
        id={id}
        type={readOnly ? "text" : "number"}
        min={readOnly ? undefined : "0"}
        step={readOnly ? undefined : "0.001"}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        placeholder="0.000"
        className={cn(readOnly && "cursor-default bg-locked text-muted-foreground")}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

/**
 * What the employee has borrowed, and the form that adds to it.
 *
 * The outstanding balance is not typed in either: it is what is still owed on
 * everything borrowed before, so a new loan cannot be entered against a figure
 * that disagrees with the loans already on the list.
 */
/** "LNR-006" asked in 2026, as the head of the request reads it: "LNR 6/2026". */
const shortLoanNo = (requestNo, on) => {
  const [prefix, count] = String(requestNo).split("-");
  return count ? prefix + " " + Number(count) + "/" + String(on).slice(0, 4) : requestNo;
};

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "November 2026" as a date field holds it: its first day. */
const firstOfMonth = (label) => {
  const [name, year] = String(label || "").split(" ");
  const month = MONTH_LABELS.indexOf(name);
  return month < 0 || !year ? "" : year + "-" + String(month + 1).padStart(2, "0") + "-01";
};

/** The month a date falls in, as the loan keeps it: "November 2026". */
const monthLabel = (iso) => {
  const [year, month] = String(iso || "").split("-");
  return year && month ? MONTH_LABELS[Number(month) - 1] + " " + year : "";
};

export default function LoansSection({
  employee,
  adding,
  onCloseAdd,
  // Opening a request from the list puts the section back into adding, so
  // the window over the page is the one that shows it.
  onOpenAdd,
  // The words on the button that opens the form, over the list it adds to.
  addLabel = "Add Loan",
  // Management decides a request; on My Profile the decision is only read.
  canDecide = true,
}) {
  // A loan belongs to somebody, so a page shows only that person's.
  const [records, setRecords] = useState(() =>
    loansFor(loanRecords, employee?.name)
  );
  const [draft, setDraft] = useState(emptyDraft);
  // Which stage of the request is open, and what management decided.
  const [stage, setStage] = useState("request");
  const [decision, setDecision] = useState("");
  // The request that has been submitted and is now being decided, and the
  // terms management is deciding it on.
  const [openId, setOpenId] = useState(null);
  const [review, setReview] = useState({
    approved: "",
    monthly: "",
    startMonth: "",
    notes: "",
  });
  // How an approved loan actually reaches the employee.
  const [payout, setPayout] = useState({
    method: "",
    bankAccount: "",
    paymentDate: "",
    reference: "",
  });
  const [receipt, setReceipt] = useState(null);

  const [attachment, setAttachment] = useState(null);
  // Everything borrowed before, open over the request.
  const [showHistory, setShowHistory] = useState(false);

  // While a call to the server is out, its button waits rather than sending twice.
  const [busy, setBusy] = useState(false);
  const send = async (call) => {
    if (busy) return null;
    setBusy(true);
    try {
      return await attempt(call);
    } finally {
      setBusy(false);
    }
  };
  /** The loan the server returned, in place of the one on screen. */
  const keep = (record) => {
    upsert(loanRecords, record);
    setRecords((prev) => upserted(prev, record));
    return record;
  };

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));

  const num = (value) => Number(value || 0);

  // The loan belongs to whoever's record it was opened from.
  const borrower = draft.employee ?? (employee?.name || "");

  // What the employee still owes on everything approved, and therefore which
  // of the two categories this request falls under. Neither is asked for:
  // both follow from the loans already on the list, and a request waiting for
  // a decision is not money in hand.
  const outstanding = outstandingTotal(records);
  const category = loanCategoryFor(records);
  const isIncrease = category === LOAN_INCREASE;

  // One request at a time: nothing can be asked for while the office is still
  // deciding the last one. The request just submitted on this form is the one
  // being decided here, so it does not block itself.
  const waiting = pendingRequest(records.filter((record) => record.id !== openId));

  const requested = num(isIncrease ? draft.extraRequested : draft.requested);
  const totalLoan = isIncrease ? outstanding + requested : requested;

  // An installment comes off the pay at the end of a month, so the month is
  // what is asked for and the day follows from it.
  const firstDate = monthEnd(draft.startMonth);

  // The number of months, the size of the final instalment and the day it
  // falls due all follow from the three figures above. None of them is typed,
  // so none of them can contradict the loan it describes.
  const plan = schedule(totalLoan, num(draft.monthly));
  const lastDue = plan.months ? dueDate(firstDate, plan.months - 1) : "";

  const requestedOn =
    records.find((record) => record.id === openId)?.requestedOn ||
    new Date().toISOString().slice(0, 10);
  // The months a repayment can start in, settled once rather than on every
  // keystroke in the form above them.
  const months = startMonths();

  const requestNo = openId
    ? records.find((record) => record.id === openId)?.requestNo || ""
    : // Counted across the firm's loans, not only this person's, so two
      // people's requests can never share a number.
      nextLoanNo([...loanRecords, ...records]);

  // Only a partial approval may amend the terms; a full one grants what was
  // asked for, and a refusal grants nothing.
  const amending = decision === "partial";
  const setReviewField = (name, value) =>
    setReview((prev) => ({ ...prev, [name]: value }));
  const setPayoutField = (name, value) =>
    setPayout((prev) => ({ ...prev, [name]: value }));
  const refusing = decision === "rejected";
  // Handed back to the employee to complete: nothing granted, nothing refused.
  const returning = decision === "completion";
  const openRecord = records.find((record) => record.id === openId) || null;
  // Granted and waiting to be paid out, or paid out.
  const granted = Boolean(openRecord) && isApprovedLoan(openRecord);
  const paidOut = granted && Boolean(openRecord.disbursementDate);
  // Management decides on the terms; the financial department then pays.
  const canConfirm =
    Boolean(openId) &&
    Boolean(decision) &&
    canDecide &&
    (refusing || returning
      ? Boolean(review.notes.trim())
      : num(review.approved) > 0 &&
        num(review.monthly) > 0 &&
        // A full approval keeps the start the request already has.
        Boolean(review.startMonth || (!amending && openRecord?.firstDue)));
  const canPay = payout.method && payout.bankAccount && payout.paymentDate && payout.reference.trim();

  const canSave =
    !waiting &&
    borrower &&
    requested > 0 &&
    num(draft.monthly) > 0 &&
    draft.startMonth;

  /**
   * The request submitted. It is on record straight away, waiting for a
   * decision, and the form moves on to the stage that gives one.
   */
  const save = async () => {
    if (!checkRequired() || !canSave) return;
    // The server numbers it, settles whether it is a new loan or an increase,
    // and checks the limit and the one-at-a-time rule again.
    const saved = await send(() =>
      loansApi.submit(
        {
          loanAmount: requested,
          monthly: num(draft.monthly),
          startMonth: draft.startMonth,
          comment: draft.comment.trim(),
          attachment,
        },
        employee?.id
      )
    );
    if (!saved) return;
    keep(saved);
    setOpenId(saved.id);
    // Management decides on what was asked for, until it amends it.
    setReview({
      approved: String(requested),
      monthly: draft.monthly,
      startMonth: draft.startMonth,
      notes: "",
    });
    setStage("decision");
  };

  /**
   * The decision confirmed. A full approval grants what was asked for; a
   * partial one grants the amended terms; a rejection grants nothing, so the
   * request is left as it was asked for and marked refused.
   */
  const confirmDecision = async () => {
    if (!checkRequired() || !canConfirm) return;
    const grantedNow = !refusing && !returning;
    // The server records who decided and when; a partial approval carries
    // its amount and installment.
    const saved = await send(() =>
      loansApi.decide(openId, {
        decision,
        approvedAmount: num(review.approved),
        approvedMonthly: num(review.monthly),
        comment: review.notes.trim(),
      })
    );
    if (!saved) return;
    keep(saved);
    if (grantedNow) {
      setStage("finance");
      return;
    }
    closeAdd();
  };

  /** Paid out by the financial department: the loan starts running. */
  const processPayout = async () => {
    if (!checkRequired() || !canPay || !granted || !canDecide) return;
    const saved = await send(() =>
      loansApi.pay(openId, { ...payout, reference: payout.reference.trim() })
    );
    if (!saved) return;
    keep(saved);
    closeAdd();
  };

  const closeAdd = () => {
    setDraft(emptyDraft);
    setAttachment(null);
    setStage("request");
    setDecision("");
    setOpenId(null);
    setReview({ approved: "", monthly: "", startMonth: "", notes: "" });
    setPayout({ method: "", bankAccount: "", paymentDate: "", reference: "" });
    setReceipt(null);
    setShowHistory(false);
    onCloseAdd();
  };

  /** A request opened back off the list, to be followed or decided. */
  const track = (record) => {
    setOpenId(record.id);
    setStage(isApprovedLoan(record) ? "finance" : "decision");
    setDecision(
      Object.keys(LOAN_DECISION_STATUS).find(
        (key) => LOAN_DECISION_STATUS[key] === record.status
      ) || ""
    );
    setDraft({
      requested: String(record.loanAmount),
      extraRequested: String(record.loanAmount),
      monthly: String(record.monthly),
      startMonth: record.startMonth || "",
      comment: record.employeeComment || "",
      employee: record.employee,
    });
    setReview({
      approved: String(record.loanAmount),
      monthly: String(record.monthly),
      startMonth: record.startMonth || "",
      notes: record.managementNotes || "",
    });
    setPayout({
      method: record.method || "",
      bankAccount: record.bankAccount || "",
      paymentDate: record.disbursementDate || "",
      reference: record.reference || "",
    });
    onOpenAdd?.();
  };

  /* ------------------------------------------------- the request being made */

  // Nothing can be asked for while a request is still being decided: a second
  // one would be asking for the same money twice.
  const blocked = adding && waiting && stage === "request";

  const form = blocked ? (
      <div className="space-y-6">
        {/* The window still says what it is, as every sheet's head does. */}
        <DialogTitle className="text-2xl font-bold text-primary">Loan Request</DialogTitle>
        <DialogDescription className="sr-only">
          A new loan cannot be requested while another is awaiting approval.
        </DialogDescription>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
          </span>
          <span>
            <span className="block font-semibold">
              A loan request is already awaiting approval.
            </span>
            <span className="block">
              {amount(waiting.loanAmount)} was asked for and is still being
              decided. A new request cannot be made until then.
            </span>
          </span>
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={closeAdd}>
            Back to Loans
          </Button>
        </div>
      </div>
  ) : (
        <div className="space-y-6">
          {/* The request's head: what it is, then whose it is, when it was
              asked and its number - the close button beyond them. */}
          <div className="flex flex-wrap items-start gap-4 pe-16">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary"
            >
              <Coins className="size-7" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-2xl font-bold text-primary">Loan Request</DialogTitle>
              <DialogDescription className="text-sm text-primary/75">
                {stage === "request"
                  ? "Request a new loan based on your eligibility and existing loans."
                  : "Review the request and record your decision."}
              </DialogDescription>
            </div>
            <div className="ms-auto flex flex-wrap items-center gap-3 pt-2 text-sm text-primary">
              <span>{employee?.empNo || ""}</span>
              <span aria-hidden="true" className="h-5 w-px bg-container-border" />
              <span>{borrower}</span>
              <span aria-hidden="true" className="h-5 w-px bg-container-border" />
              {/* On the step that pays, the head says where the money goes -
                  the employee's bank and account - in place of the date and
                  the number, as the finance design draws it. */}
              {stage === "finance" ? (
                <PayeeFacts employee={employee} />
              ) : (
                <>
                  <span>{longDate(requestedOn)}</span>
                  <span aria-hidden="true" className="h-5 w-px bg-container-border" />
                  <span className="rounded-md bg-primary/10 px-3 py-1.5 text-base font-bold text-primary">
                    {shortLoanNo(requestNo, requestedOn)}
                  </span>
                </>
              )}
            </div>
            <DialogClose className="absolute end-5 top-5 rounded-md p-1 text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-7" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>

          {/* The three stages of the request. The financial department's
              payment is asked for with the decision until its own stage is
              designed, so the third opens the second. */}
          <AdvanceSteps
            active={stage}
            onChange={setStage}
            steps={[
              { key: "request", title: "Submit Request", done: Boolean(openId) },
              {
                key: "decision",
                title: "Management Comment",
                done: granted || openRecord?.status === LOAN_REJECTED || openRecord?.status === LOAN_RETURNED,
                // Nothing can be decided until there is a request to decide.
                disabled: !openId,
              },
              {
                key: "finance",
                title: "Financial Department Actions",
                done: paidOut,
                disabled: !openId || !granted,
              },
            ]}
          />

          {stage === "decision" || stage === "finance" ? (
            <>
              {/* The request is not read back here: what it was for is on the
                  stage behind this one, and the facts a decision needs are on
                  the card at the foot of the page. */}
              {stage === "decision" && (
              <DecisionChoice
                value={decision}
                onChange={setDecision}
                disabled={!canDecide || granted || openRecord?.status === LOAN_REJECTED}
                // A loan is granted on terms, not only on an amount.
                notes={{
                  full: "Approve the loan as requested",
                  partial: "Approve with amended terms",
                  completion: "Return for missing information or documents",
                  rejected: "Reject the loan request",
                }}
              />
              )}

              {/* Nothing is granted and nothing leaves the firm on a refusal,
                  so both are asked about only once something is approved. */}
              {decision && !refusing && !returning && (
                <>
                  {/* The terms the loan runs on. They are what was asked for
                      unless management is amending them, which only a partial
                      approval does. */}
                  <Bordered title="Loan Approval & Repayment">
                    <div className="form-grid">
                      <Settled
                        id="decision-requested"
                        label="Requested Loan Amount"
                        value={amount(totalLoan)}
                      />

                      {amending ? (
                        <AmountField
                          id="decision-approved"
                          label="Approved Loan Amount"
                          required
                          value={review.approved}
                          onChange={(e) => setReviewField("approved", e.target.value)}
                        />
                      ) : (
                        <Settled
                          id="decision-approved"
                          label="Approved Loan Amount"
                          value={amount(num(review.approved))}
                          payable
                        />
                      )}

                      {amending ? (
                        <AmountField
                          id="decision-monthly"
                          label="Monthly Installment"
                          required
                          value={review.monthly}
                          onChange={(e) => setReviewField("monthly", e.target.value)}
                        />
                      ) : (
                        <Settled
                          id="decision-monthly"
                          label="Monthly Installment"
                          value={amount(num(review.monthly))}
                        />
                      )}

                      {amending ? (
                        <Choice
                          id="decision-start-month"
                          label="Start Month"
                          value={review.startMonth}
                          onChange={(value) => value && setReviewField("startMonth", value)}
                          placeholder="Select start month"
                          options={months}
                        />
                      ) : (
                        <Settled
                          id="decision-start-month"
                          label="Start Month"
                          value={review.startMonth}
                        />
                      )}
                    </div>
                  </Bordered>

                  {/* Where the loan is booked, and how it actually leaves -
                      the financial department's step. */}
                  {stage === "finance" && (
                  <Bordered title="Financial Department Actions">
                    <div className="form-grid">
                      <Settled
                        id="decision-expense-type"
                        label="Expense Type"
                        value={LOAN_EXPENSE_TYPE}
                      />
                      <Settled
                        id="decision-category"
                        label="Category"
                        value={LOAN_CATEGORY}
                      />
                      <Settled
                        id="decision-subcategory"
                        label="Subcategory"
                        value={category}
                      />

                      <Choice
                        id="decision-method"
                        label="Payment Method"
                        value={payout.method}
                        onChange={(value) => value && setPayoutField("method", value)}
                        placeholder="Select method"
                        options={PAYMENT_METHODS}
                      />

                      {/* One choice, not two: the account carries the bank it
                          is held at, so they cannot be set to disagree. */}
                      <Choice
                        id="decision-bank"
                        label="Bank Account"
                        value={payout.bankAccount}
                        onChange={(value) => value && setPayoutField("bankAccount", value)}
                        placeholder="Select bank account"
                        options={PAYING_ACCOUNTS}
                      />

                      <div className="flex h-full flex-col justify-end gap-2">
                        <FieldLabel htmlFor="decision-pay-date" required>
                          Payment Date
                        </FieldLabel>
                        <DateField
                          id="decision-pay-date"
                          value={payout.paymentDate}
                          onChange={(e) => setPayoutField("paymentDate", e.target.value)}
                        />
                      </div>

                      {/* What the bank called the transfer, and the proof. */}
                      <div className="flex h-full flex-col justify-end gap-2">
                        <FieldLabel htmlFor="decision-reference" required>
                          Transfer No.
                        </FieldLabel>
                        <div className="flex w-full min-w-0 items-center gap-2">
                          <Input
                            id="decision-reference"
                            className="min-w-0 flex-1"
                            value={payout.reference}
                            onChange={(e) => setPayoutField("reference", e.target.value)}
                            placeholder="TRX-0000-00000"
                          />
                          <Attach
                            file={receipt}
                            onPick={setReceipt}
                            label="transfer receipt"
                          />
                        </div>
                      </div>

                      <Settled
                        id="decision-to-disburse"
                        label="Amount to Disburse"
                        value={amount(num(review.approved))}
                        payable
                      />
                    </div>
                  </Bordered>
                  )}
                </>
              )}

              {/* A refusal is only as good as its reason, so there the
                  comment is required; on an approval it is a note. */}
              {stage === "decision" && (
              <Bordered
                title={
                  <>
                    {refusing ? "Reason for Rejection" : returning ? "What is Missing" : "Management Comment"}
                  </>
                }
              >
                <div className="space-y-2">
                  <Textarea
                    id="decision-notes"
                    rows={3}
                    maxLength={COMMENT_LIMIT}
                    value={review.notes}
                    onChange={(e) => setReviewField("notes", e.target.value)}
                    placeholder={
                      refusing
                        ? "Enter the reason for rejection"
                        : returning
                          ? "Say what the employee still has to supply"
                          : "Add management comment (optional)"
                    }
                    disabled={!canDecide || granted || openRecord?.status === LOAN_REJECTED}
                  />
                  <p className="text-end text-xs text-muted-foreground">
                    {review.notes.length} / {COMMENT_LIMIT}
                  </p>
                </div>
              </Bordered>
              )}

              {/* What was granted and what leaves, in one line to be read
                  against the terms above before it is confirmed. */}
              {stage === "finance" && (
                <div className="rounded-lg border border-green-600/40 bg-green-50/50 p-4">
                  <p className="mb-3 flex items-center gap-2 font-semibold text-green-700">
                    <span
                      aria-hidden="true"
                      className="h-5 w-1 shrink-0 rounded-full bg-green-600"
                    />
                    Loan Approval &amp; Transfer Summary
                  </p>
                  <div className="form-grid lg:[&>*+*]:border-s">
                    <Said label="Employee Name" value={borrower} />
                    <Said label="Bank Name" value={employee?.bankName || "-"} />
                    <Said label="Account Number" value={employee?.accountNumber || "-"} />
                    <Said
                      label="Approved Loan Amount"
                      value={amount(num(review.approved))}
                      settled
                    />
                    <Said
                      label="Monthly Installment"
                      value={amount(num(review.monthly))}
                      settled
                    />
                    <Said
                      label="Transfer Amount"
                      value={amount(num(review.approved))}
                      settled
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* What the employee already owes, read before asking for more. */}
              <ExistingLoans records={records} />

              {/* How much, how fast, and from when. The period, the end and
                  the last installment are counted from these three. */}
              <section className="space-y-4 rounded-xl border p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-primary">
                    <FilePenLine className="size-6" strokeWidth={1.5} />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-primary">New Loan Request</h3>
                    <p className="text-sm text-primary/75">Enter the details for your new loan request.</p>
                  </div>
                </div>
                <div className="grid gap-x-6 gap-y-4 md:grid-cols-3">
                  <AmountField
                    id="loan-requested"
                    label="Requested Loan Amount"
                    required
                    value={isIncrease ? draft.extraRequested : draft.requested}
                    onChange={(e) => set(isIncrease ? "extraRequested" : "requested", e.target.value)}
                  />
                  <AmountField
                    id="loan-monthly"
                    label="Monthly Installment"
                    required
                    value={draft.monthly}
                    onChange={(e) => set("monthly", e.target.value)}
                  />
                  {/* Worked out, not asked: how many months the loan runs. */}
                  <div className="space-y-1.5 md:row-span-1">
                    <div className="flex items-center gap-3 rounded-lg bg-blue-50/70 px-4 py-2.5">
                      <CalendarDays className="size-6 shrink-0 text-primary" aria-hidden="true" />
                      <div>
                        <p className="text-xs text-primary/75">Loan Period (Auto-calculated)</p>
                        <p className="text-xl font-bold text-primary">
                          {plan.months || 0} <span className="text-sm font-normal text-primary/70">Months</span>
                        </p>
                      </div>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-primary/75">
                      <Info className="size-3.5 shrink-0" aria-hidden="true" />
                      Calculated based on loan amount and monthly installment.
                    </p>
                  </div>

                  {/* An installment comes off the pay at the end of a month:
                      the day chosen says which month the deductions start. */}
                  <div className="space-y-2">
                    <FieldLabel htmlFor="loan-start">
                      Start Deduction From<span aria-hidden="true" className="ms-1 text-destructive">*</span>
                    </FieldLabel>
                    <DateField
                      id="loan-start"
                      name="loanStart"
                      value={firstOfMonth(draft.startMonth)}
                      onChange={(e) => set("startMonth", monthLabel(e.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="loan-end">Calculated End Date</FieldLabel>
                    <Input
                      id="loan-end"
                      readOnly
                      tabIndex={-1}
                      value={lastDue ? formatDate(lastDue) : ""}
                      placeholder="DD/MM/YYYY"
                      className="cursor-default bg-locked text-muted-foreground"
                    />
                  </div>
                  <AmountField
                    id="loan-last"
                    label="Last Installment Amount"
                    readOnly
                    value={plan.months ? amountValue(plan.last) : ""}
                  />
                </div>
              </section>
            </>
          )}

          {/* Plain buttons: this form sits inside the employee form, which a
              submit button here would send instead. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {stage === "request" ? (
              <div className="flex items-start gap-3 rounded-xl border bg-blue-50/50 px-4 py-3">
                <Info className="mt-0.5 size-6 shrink-0 fill-primary text-white" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-semibold text-primary">Note</p>
                  <p className="text-primary/80">
                    The loan period and end date are automatically calculated based on the
                    requested amount and monthly installment.
                  </p>
                </div>
              </div>
            ) : (
              // Everything borrowed before, opened over this window.
              <HistoryCard onClick={() => setShowHistory(true)} />
            )}

            <div className="ms-auto flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="min-w-36" onClick={closeAdd}>
                Cancel
              </Button>
              {stage === "decision" ? (
                canDecide &&
                !granted &&
                openRecord?.status !== LOAN_REJECTED && (
                  <Button
                    type="button"
                    className="min-w-48"
                    variant={refusing ? "destructive" : "default"}
                    onClick={confirmDecision}
                    disabled={!canConfirm}
                  >
                    {refusing ? "Confirm Rejection" : returning ? "Return to Employee" : "Confirm Decision"}
                  </Button>
                )
              ) : stage === "finance" ? (
                canDecide &&
                granted &&
                !paidOut && (
                  <Button type="button" className="min-w-48" onClick={processPayout} disabled={!canPay}>
                    Process Payment
                  </Button>
                )
              ) : (
                <Button type="button" className="min-w-48" onClick={save}>
                  Submit Request
                </Button>
              )}
            </div>
          </div>
        </div>
  );

  return (
    <div className="space-y-6">
      {/* Opened over the page, so the list it is filed into stays behind. */}
      <Dialog open={Boolean(adding)} onOpenChange={(o) => !o && closeAdd()}>
        <DialogContent hideClose className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
          {form}
          <Dialog open={showHistory} onOpenChange={setShowHistory}>
            <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
              <DialogTitle className="text-xl font-bold text-primary">Loan History · {employee?.name}</DialogTitle>
              <DialogDescription>Every loan and loan request on this employee's record.</DialogDescription>
              <LoanLedger records={records} employee={employee} />
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      {/* The loans already running, with what they come to and their
          installments folded under each. */}
      <LoanLedger
        records={records}
        employee={employee}
        onOpen={track}
        onAdd={addLabel && !adding ? onOpenAdd : null}
        addLabel="New Loan Request"
        // The suggested sum, written into a new request for the employee to
        // confirm or change - never submitted on its own.
        onApply={
          addLabel && !adding
            ? (suggested) => {
                // Both fields: the form asks for one or the other, depending
                // on whether a loan is already running.
                setDraft((prev) => ({
                  ...prev,
                  requested: String(suggested),
                  extraRequested: String(suggested),
                }));
                onOpenAdd?.();
              }
            : null
        }
      />
    </div>
  );
}
