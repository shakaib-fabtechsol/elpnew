import { useState } from "react";
import { PayeeFacts } from "@/components/shared/RequestSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SalaryLedger from "./SalaryLedger";
import { salaryHistory as defaultSalaryHistory } from "../payrollData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RequestTable from "@/components/shared/RequestTable";
import { Card, CardContent } from "@/components/ui/card";
import { Bordered, EmptyState } from "@/components/shared/panels";
import DateField from "@/components/shared/DateField";
import { checkRequired } from "@/components/shared/formFields";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
  RecordLink,
} from "@/components/shared/RecordTable";
import { Rial } from "@/components/shared/Rial";
import { cn } from "@/lib/utils";
import { amountValue } from "@/lib/money";
import { firmToday } from "@/lib/expiry";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Download,
  FileText,
  Info,
  MessageCircle,
  Undo2,
  Plus,
  Printer,
  Send,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useAdvances } from "@/lib/advances/context";
import { amount, formatDate } from "../loanData";
import { PAYMENT_METHODS } from "@/pages/expenses/expenseData";
import { advanceSummaryPdf } from "../advanceSummaryPdf";
import {
  ADVANCE_BOOKING,
  ADVANCE_PURPOSES,
  ADVANCE_STATUS_CHIP,
  ADVANCE_STATUS_TONE,
  advanceStatusOf,
  DISBURSEMENT_CATEGORIES,
  DISBURSEMENT_SUBCATEGORIES,
  DISBURSEMENT_TYPES,
  OTHER_PURPOSE,
  advancesFor,
  deductedFrom,
  nextAdvanceNo,
  outstandingAdvance,
} from "../advanceSalaryData";

const REASON_LIMIT = 500;
const COMMENT_LIMIT = 300;
// Remarks longer than this carry "Show more", and are cut to two lines until
// it is pressed - a sentence or two of remarks has it, as the design shows.
const REMARKS_PREVIEW = 80;

/** What management can answer an advance with, as the review names it. */
const ADVANCE_DECISIONS = [
  { key: "full", label: "Full Approval" },
  { key: "partial", label: "Partial Approval" },
  // Handed back to be sent again: nothing granted, nothing refused.
  { key: "completion", label: "Return Request" },
  { key: "rejected", label: "Rejection" },
];

/**
 * The months an advance can come out of: this one and the two after it, as
 * the employee picks between them. Each is kept as its month and year.
 */
const deductOptions = (today = new Date()) =>
  [0, 1, 2].map((ahead) => {
    const at = new Date(today.getFullYear(), today.getMonth() + ahead, 1);
    return {
      month: at.toLocaleDateString("en-GB", { month: "long" }),
      year: String(at.getFullYear()),
    };
  });

const emptyDraft = () => {
  const [first] = deductOptions();
  return {
    amount: "",
    deductMonth: first.month,
    deductYear: first.year,
    purpose: "",
    reason: "",
  };
};

/** "03 Oct 2026", as the head of the request gives its date. */
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Spelled out here: the browser's own short month is "Sept" in some places.
export const longDate = (iso) => {
  const [year, month, day] = String(iso).split("-");
  return `${day} ${SHORT_MONTHS[Number(month) - 1]} ${year}`;
};

/** "SA-2026-00012" as the head of the request reads it: "SA 12/2026". */
const shortRequestNo = (requestNo) => {
  const [prefix, year, count] = String(requestNo).split("-");
  return count ? `${prefix} ${Number(count)}/${year}` : requestNo;
};

/** The red mark of a field that must be answered. */
function Star() {
  return (
    <span aria-hidden="true" className="ms-1 text-destructive">
      *
    </span>
  );
}

/**
 * The three stages of the request as numbered circles on one line: the open
 * one filled, a finished one ticked, and the line between them filling as
 * the request moves along. A stage that cannot be opened yet is greyed.
 */
export function AdvanceSteps({ steps, active, onChange }) {
  const at = steps.findIndex((step) => step.key === active);
  return (
    <ol className="flex items-start rounded-xl border bg-blue-50/40 px-4 py-3 sm:px-6">
      {steps.map((step, index) => {
        const open = index === at;
        const done = step.done && !open;
        const last = index === steps.length - 1;
        return (
          <li key={step.key} className="relative flex flex-1 flex-col items-center">
            {!last && (
              <span
                aria-hidden="true"
                className="absolute start-[calc(50%+2rem)] end-[calc(-50%+2rem)] top-5.5 h-0.5 overflow-hidden rounded-full bg-slate-200"
              >
                <span
                  className={cn(
                    "block h-full bg-primary",
                    index < at ? "w-full" : open ? "w-1/2" : "w-0"
                  )}
                />
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(step.key)}
              disabled={step.disabled}
              aria-current={open ? "step" : undefined}
              className="flex flex-col items-center gap-2 rounded-lg px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
            >
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full text-lg font-semibold",
                  open
                    ? step.activeTone === "navy"
                      ? "bg-primary text-white"
                      : "bg-primary text-primary-foreground"
                    : done
                      ? // A finished stage is ticked in green, as on every
                        // stepper in the system.
                        "bg-green-600 text-white"
                      : "bg-slate-200 text-primary"
                )}
              >
                {done ? <Check className="size-6" aria-label="Done" /> : index + 1}
              </span>
              {/* Not greyed when it cannot be opened yet: the design reads
                  every stage's name at full strength. */}
              <span
                className={cn(
                  "text-center text-sm sm:text-base",
                  open
                    ? step.activeTone === "navy"
                      ? "font-bold text-primary"
                      : "font-bold text-primary"
                    : "text-primary"
                )}
              >
                {step.title}
              </span>
              {/* What the stage is for, where a request says it. */}
              {step.note && (
                <span className="-mt-1.5 text-center text-xs text-primary/70">{step.note}</span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One thing chosen from a list, label over box. Stacked from the top, so a
 * row of these lines up with a date, an input or a taller comment beside it.
 */
function Pick({ id, label, value, onChange, placeholder, options, disabled }) {
  return (
    <div className="form-field space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** One figure the form works out rather than asks for, large in its box. */
function Figure({ label, value }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-primary">{label}</p>
      <p className="flex h-14 items-center gap-2 rounded-lg bg-blue-50/70 px-5">
        <span className="text-2xl font-bold text-primary">{amountValue(value)}</span>
        <Rial className="text-sm text-muted-foreground" />
      </p>
    </div>
  );
}

/**
 * Asking for part of a month's salary now.
 *
 * The salary itself is not asked about: the form reads it off the record and
 * works out what is left afterwards, so the amount being requested can be
 * judged without anyone doing the arithmetic. What the employee settles is
 * which month it comes out of, how much, and why.
 */
export function AdvanceSalaryForm({
  employee,
  net,
  onClose,
  // A request opened back off the list, to be followed or decided. A new
  // request has none, and opens on the first stage instead.
  requestId = null,
  // Sent from an employee's record, the window stays open on the request
  // just sent; sent from My Profile, it closes.
  stayOpen = false,
  // The employee's salary payments, for History to show beside the advances.
  salaryHistory = defaultSalaryHistory,
  // Whoever is deciding, decides here - the same as every other request in
  // the system, which is where this stage is answered from.
  canDecide = true,
}) {
  const { advances, submitAdvance, resubmitAdvance, decideAdvance, payAdvance } = useAdvances();
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
  // The form is mounted afresh each time it opens, so what it opens on is
  // settled once here rather than kept in step with a prop.
  // The request the form is on: the one it was opened on, or - once a new one
  // is sent from an employee's record - the one just sent.
  const [currentId, setCurrentId] = useState(requestId);
  const openRequest = advances.find((a) => a.id === currentId) || null;

  const [draft, setDraft] = useState(() =>
    openRequest
      ? {
          amount: String(openRequest.amount),
          deductMonth: openRequest.deductMonth,
          deductYear: openRequest.deductYear,
          purpose: openRequest.purpose || "",
          reason: openRequest.reason,
        }
      : emptyDraft()
  );
  const requestNo = openRequest?.requestNo || nextAdvanceNo(advances);
  const requestedOn =
    openRequest?.requestedOn || firmToday();

  // Which stage of the request is open. A request already on the list is
  // opened to be decided, not written again.
  // Which stage of the request is open. A request already on the list opens
  // where it has got to: granted and not yet paid, on the financial
  // department's stage; otherwise on management's.
  // A request handed back is reopened on the first stage, to be corrected.
  const returned =
    openRequest?.status === "Pending" && openRequest?.decision === "completion";
  const [stage, setStage] = useState(() =>
    !openRequest || returned
      ? "request"
      : openRequest.status === "Approved" && openRequest.decidedOn && !openRequest.paidOn
        ? "finance"
        : "decision"
  );
  const [decision, setDecision] = useState(openRequest?.decision || "");
  const [comment, setComment] = useState(openRequest?.managementComment || "");
  // What is being approved, where that is not simply what was asked for.
  const [approved, setApproved] = useState(
    openRequest?.approvedAmount ? String(openRequest.approvedAmount) : ""
  );
  const [pay, setPay] = useState({
    ...ADVANCE_BOOKING,
    method: openRequest?.method || "",
    paymentDate: openRequest?.paymentDate || firmToday(),
    reference: openRequest?.reference || "",
    financeComment: openRequest?.financeComment || "",
  });
  const [showAllRemarks, setShowAllRemarks] = useState(false);
  // History, open over the form.
  const [showHistory, setShowHistory] = useState(false);
  // The transaction summary, once the payment is processed: shown in place
  // of the form, to be printed and filed.
  const [pdfUrl, setPdfUrl] = useState("");

  // Whatever an earlier request had attached to it.
  const attachedName = openRequest?.attachment || "";

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));
  const setPaid = (name, value) => setPay((prev) => ({ ...prev, [name]: value }));

  // What is already owed on earlier advances, and so what is left to ask for:
  // an advance cannot be taken twice out of the same salary.
  const outstanding = outstandingAdvance(advances, employee?.name);
  const limit = Math.max(0, Number((net - outstanding).toFixed(3)));
  const requested = Number(draft.amount) || 0;
  const overLimit = requested > limit;

  // A full approval grants what was asked for; only a partial approval sets
  // a figure of its own, so only there is the amount typed.
  const rejected = decision === "rejected";
  // Handed back rather than answered: nothing is granted and nothing is
  // refused, so the request goes on waiting under its own number.
  const returning = decision === "completion";
  const amending = decision === "partial";
  // Only something granted reaches the financial department.
  const granted = Boolean(decision) && !rejected && !returning;
  // Older requests were approved before a decision was written on them.
  const approvedAmount = amending
    ? Number(approved) || 0
    : Number(openRequest?.approvedAmount) || requested;
  const afterDeduction = Number(
    (net - (stage === "request" ? requested : approvedAmount)).toFixed(3)
  );
  // Management's answer as it was saved: what the financial department acts on.
  const decided = openRequest?.status === "Approved";

  // "Other" is a purpose only once it is said what it is, in the remarks.
  const specifying = draft.purpose === OTHER_PURPOSE;
  const canSubmit =
    requested > 0 &&
    !overLimit &&
    draft.deductMonth &&
    draft.deductYear &&
    draft.purpose &&
    (!specifying || draft.reason.trim());

  // A partial approval says how much, and no more than was asked for.
  const canConfirm =
    canDecide &&
    Boolean(decision) &&
    (!amending || (approvedAmount > 0 && approvedAmount < requested));

  // Money only leaves once it is said how and when; anything but cash has a
  // reference to trace it by.
  const canProcess =
    canDecide &&
    decided &&
    pay.method &&
    pay.paymentDate &&
    (pay.method === "Cash" || pay.reference.trim());

  const submit = async () => {
    if (!checkRequired() || !canSubmit) return;
    // The server numbers it and checks the limit again.
    const saved = await send(() =>
      submitAdvance({ ...draft, reason: draft.reason.trim() }, employee?.id)
    );
    if (!saved) return;
    if (stayOpen) {
      // From the employee's record the transaction goes on: the request just
      // sent, under its number, open at Management Comment.
      setCurrentId(saved.id);
      setStage("decision");
      return;
    }
    setDraft(emptyDraft());
    onClose();
  };

  /**
   * Management's answer, saved as it is given. A refusal or a hand-back ends
   * here; a grant goes on to the financial department, which pays it.
   */
  const confirmDecision = async () => {
    if (!canConfirm || !openRequest) return;
    // A hand-back leaves the request waiting on the employee, with what is
    // missing written on it; the server records who decided and when.
    const saved = await send(() =>
      decideAdvance(openRequest.id, { decision, approvedAmount, comment: comment.trim() })
    );
    if (!saved) return;
    if (granted) setStage("finance");
    else onClose();
  };

  /**
   * The payment, recorded, and the whole transaction put on one page: the
   * request, management's decision and the disbursement, to print and file
   * in the employee's personnel record.
   */
  /**
   * A returned request, corrected and sent back to management. What it was
   * returned for is kept on it, so its history shows each round; the decision
   * is cleared, so management decides it afresh.
   */
  const resubmit = async () => {
    if (!checkRequired() || !canSubmit || !openRequest) return;
    // The return stays in the request's history on the server; the decision
    // is cleared there, so management decides it afresh.
    const saved = await send(() =>
      resubmitAdvance(openRequest.id, { ...draft, reason: draft.reason.trim() }, employee?.id)
    );
    if (saved) onClose();
  };

  const processPayment = async () => {
    if (!canProcess || !openRequest) return;
    const saved = await send(() =>
      payAdvance(openRequest.id, {
        ...pay,
        reference: pay.reference.trim(),
        financeComment: pay.financeComment.trim(),
      })
    );
    if (!saved) return;
    setPdfUrl(await advanceSummaryPdf({ advance: saved, employee, net }));
  };

  // The first stage of a new request is the one being written; every other
  // view of the request is reviewing it.
  const writing = stage === "request" && !openRequest;
  // A returned request, open to be corrected and sent again.
  const correcting = stage === "request" && returned;

  return (
    <div className="space-y-6">
      {/* The request's head: what it is and its number, then whose it is and
          when it was asked - the close button sits beyond them. */}
      <div className="flex flex-wrap items-start gap-4 pe-16">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary"
        >
          <Wallet className="size-7" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <DialogTitle className="text-2xl font-bold text-primary">
              {correcting ? "Salary Advance Request Correction" : "Salary Advance Request"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-primary/75">
            {writing
              ? "Request a salary advance for the selected month."
              : correcting
                ? "Review the management comments, correct the request, and resubmit it."
                : stage === "finance"
                ? "Review the management decision and process the payment."
                : "Review the request and record your decision."}
          </DialogDescription>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-3 pt-2 text-sm text-primary">
          {/* Whose it is, when it was asked, and its number - the same on
              every stage of the request. */}
          <span>{employee?.empNo || ""}</span>
          <span aria-hidden="true" className="h-5 w-px bg-container-border" />
          <span>{employee?.name || ""}</span>
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
                {shortRequestNo(requestNo)}
              </span>
            </>
          )}
        </div>
        {/* The window's own close, at the size the design draws it. */}
        <DialogClose className="absolute end-5 top-5 rounded-md p-1 text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-7" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </div>

      {/* Once paid, the whole transaction on one page, shown where the form
          was: printed from here and filed in the personnel record. */}
      {pdfUrl ? (
        <div className="space-y-4">
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
          >
            <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
            Payment processed. Print the summary below and file it in the
            employee&apos;s personnel record.
          </p>
          <iframe
            title={"Transaction summary " + requestNo}
            src={pdfUrl}
            className="h-[65vh] w-full rounded-lg border"
          />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button asChild variant="outline" className="min-w-36">
              <a href={pdfUrl} download={requestNo + " - Transaction Summary.pdf"}>
                <Download className="me-2 h-4 w-4" aria-hidden="true" />
                Download PDF
              </a>
            </Button>
            <Button asChild variant="outline" className="min-w-36">
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <Printer className="me-2 h-4 w-4" aria-hidden="true" />
                Open to Print
              </a>
            </Button>
            <Button type="button" className="min-w-36" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <>
      <AdvanceSteps
        active={stage}
        onChange={setStage}
        steps={[
          returned
            ? {
                key: "request",
                title: "Request Correction",
                done: false,
                activeTone: "navy",
              }
            : { key: "request", title: "Submit Request", done: Boolean(openRequest) },
          {
            key: "decision",
            title: "Management Comment",
            // Handing a request back is not deciding it: management has it
            // again once it is resubmitted.
            done: !returned && Boolean(openRequest?.decidedOn || decided),
            // A grant is ticked in green: it is what lets the money go.
            doneTone: decided ? "green" : undefined,
            // Nothing can be decided until there is a request to decide: a
            // new one is saved first, and opened back off the list.
            disabled: !openRequest,
          },
          {
            key: "finance",
            title: "Financial Department Actions",
            done: Boolean(openRequest?.paidOn),
            activeTone: "navy",
            // Only an advance that was granted is paid out, once the grant
            // is saved.
            disabled: !decided,
          },
        ]}
      />

      {/* A returned request: why it came back and who sent it, what
          management said, then the request itself, open to be put right. */}
      {correcting && (
        <>
          <section className="flex flex-wrap items-center gap-4 rounded-xl border border-red-200 border-s-4 border-s-red-700 bg-red-50 px-4 py-3">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"
            >
              <Undo2 className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-red-800">Returned for Correction</h3>
              <p className="text-sm text-primary">
                Please review the management comments below, correct the request
                information and resubmit it.
              </p>
            </div>
            <div className="flex items-center gap-3 border-s border-red-200 ps-4">
              <CalendarDays className="size-6 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <div className="text-sm">
                <p className="text-primary/75">Returned Date</p>
                <p className="font-bold text-primary">
                  {openRequest?.decidedOn ? longDate(openRequest.decidedOn) : "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-s border-red-200 ps-4">
              <User className="size-6 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <div className="text-sm">
                <p className="text-primary/75">Returned By</p>
                <p className="font-bold text-primary">{openRequest?.decidedBy || "-"}</p>
                {openRequest?.decidedByTitle && (
                  <p className="text-xs text-primary/75">{openRequest.decidedByTitle}</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border bg-blue-50/40 p-4">
            <h3 className="flex items-center gap-3 font-bold text-primary">
              <MessageCircle className="size-6" strokeWidth={1.5} aria-hidden="true" />
              Management Comment
            </h3>
            <p className="rounded-lg border bg-blue-50/60 px-4 py-2.5 text-sm text-primary sm:ms-9">
              {openRequest?.managementComment || "No comment."}
            </p>
          </section>

          <section className="space-y-4 rounded-xl border p-4 sm:p-5">
            <h3 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">
              Request Information
            </h3>
            <div className="form-grid items-start gap-y-4">
              <div className="space-y-2">
                <p className="text-sm text-primary">
                  {draft.deductMonth + " " + draft.deductYear + " Salary"}
                </p>
                <p className="flex h-12 items-center gap-2 rounded-lg bg-locked px-4">
                  <span className="text-xl font-bold text-primary/75">{amountValue(net)}</span>
                  <Rial className="text-sm text-muted-foreground" />
                </p>
              </div>
              <div className="form-field space-y-2">
                <Label htmlFor="advance-amount">Advance Amount (Requested)</Label>
                <div className="relative">
                  <Input
                    id="advance-amount"
                    inputMode="decimal"
                    value={draft.amount}
                    onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0.000"
                    required
                    aria-invalid={overLimit || undefined}
                    className={cn("h-12 pe-16 font-semibold", overLimit && "border-destructive")}
                  />
                  <Rial className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
                </div>
                {overLimit && (
                  <p className="text-xs text-destructive">
                    More than the eligible limit of {amount(limit)}
                  </p>
                )}
              </div>
              <Pick
                id="advance-purpose"
                label="Purpose"
                value={draft.purpose}
                onChange={(value) => value && set("purpose", value)}
                placeholder="Select a purpose"
                options={ADVANCE_PURPOSES}
              />
              {/* The same three months as when it was asked, as a list here;
                  one that has since passed stays on it while it is chosen. */}
              <Pick
                id="advance-month"
                label="Deduct From Salary Of"
                value={draft.deductMonth + " " + draft.deductYear}
                onChange={(value) => {
                  if (!value) return;
                  const [month, year] = value.split(" ");
                  setDraft((prev) => ({ ...prev, deductMonth: month, deductYear: year }));
                }}
                options={[
                  ...new Set([
                    draft.deductMonth + " " + draft.deductYear,
                    ...deductOptions().map((option) => option.month + " " + option.year),
                  ]),
                ]}
              />
              <div className="form-field span-12 space-y-2">
                <Label htmlFor="advance-reason">
                  {specifying ? (
                    <>
                      Employee Remarks
                      <Star />
                    </>
                  ) : (
                    "Employee Remarks"
                  )}
                </Label>
                <Textarea
                  id="advance-reason"
                  rows={3}
                  maxLength={REASON_LIMIT}
                  value={draft.reason}
                  onChange={(e) => set("reason", e.target.value)}
                  required={specifying}
                  placeholder={specifying ? "Please specify the purpose..." : "Enter your remarks..."}
                />
                <p className="text-end text-xs text-muted-foreground">
                  {draft.reason.length}/{REASON_LIMIT}
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      {stage === "request" && !correcting && (
        <div className="space-y-6 rounded-xl border p-4 sm:p-6">
          {/* The salary it comes out of, which month, how much, and what is
              left - each beside the next, divided by a rule. */}
          <div className="grid gap-6 md:grid-cols-2 xl:gap-x-0 *:min-w-0 xl:grid-cols-[1fr_1.2fr_1fr_1fr] xl:divide-x xl:divide-container-border xl:[&>*:not(:first-child)]:ps-6 xl:[&>*:not(:last-child)]:pe-6">
            <Figure
              label={draft.deductMonth + " " + draft.deductYear + " Salary"}
              value={net}
            />

            {/* An advance is not a loan: it comes back out of one month's
                pay, and the employee says which. */}
            <div className="space-y-2">
              <p id="advance-month-label" className="text-sm font-semibold text-primary">
                Deduct From Salary Of
                <Star />
              </p>
              <div
                role="radiogroup"
                aria-labelledby="advance-month-label"
                className="grid h-14 grid-cols-3 overflow-hidden rounded-lg border"
              >
                {deductOptions().map((option) => {
                  const chosen =
                    draft.deductMonth === option.month && draft.deductYear === option.year;
                  return (
                    <button
                      key={option.month + option.year}
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          deductMonth: option.month,
                          deductYear: option.year,
                        }))
                      }
                      className={cn(
                        "whitespace-nowrap border-s px-1 text-xs tracking-tight transition-colors first:border-s-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        chosen ? "bg-primary text-primary-foreground" : "text-primary hover:bg-menu-hover"
                      )}
                    >
                      {option.month} {option.year}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Labelled like the figures either side of it, so all four
                labels and boxes sit on one line. */}
            <div className="form-field space-y-2">
              <label htmlFor="advance-amount" className="block text-sm font-semibold text-primary">
                Advance Amount (<Rial />)
                <Star />
              </label>
              <div className="relative">
                <Input
                  id="advance-amount"
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0.000"
                  required
                  aria-invalid={overLimit || undefined}
                  className={cn("h-14 pe-16 text-lg", overLimit && "border-destructive")}
                />
                <Rial className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
              </div>
              {overLimit && (
                <p className="text-xs text-destructive">
                  More than the eligible limit of {amount(limit)}
                </p>
              )}
            </div>

            <Figure label="Remaining Salary After Deduction" value={afterDeduction} />
          </div>

          <div className="grid gap-6 md:gap-x-0 *:min-w-0 border-t pt-6 md:grid-cols-[1fr_2fr] md:divide-x md:divide-container-border md:[&>*:last-child]:ps-6 md:[&>*:first-child]:pe-6">
            <div className="form-field space-y-2" data-required="true">
              <Label htmlFor="advance-purpose" className="font-semibold text-primary">
                Purpose
                <Star />
              </Label>
              <Select value={draft.purpose} onValueChange={(value) => value && set("purpose", value)}>
                <SelectTrigger id="advance-purpose">
                  <SelectValue placeholder="Select a purpose" />
                </SelectTrigger>
                <SelectContent>
                  {ADVANCE_PURPOSES.map((purpose) => (
                    <SelectItem key={purpose} value={purpose}>
                      {purpose}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optional, except where the purpose is "Other": then this is
                where it is said. */}
            <div className="form-field space-y-2">
              <Label htmlFor="advance-reason" className="font-semibold text-primary">
                {specifying ? (
                  <>
                    Additional Remarks
                    <Star />
                  </>
                ) : (
                  "Additional Remarks (Optional)"
                )}
              </Label>
              <Textarea
                id="advance-reason"
                rows={3}
                maxLength={REASON_LIMIT}
                value={draft.reason}
                onChange={(e) => set("reason", e.target.value)}
                required={specifying}
                placeholder={specifying ? "Please specify the purpose..." : "Enter your remarks..."}
              />
              <p className="text-end text-xs text-muted-foreground">
                {draft.reason.length}/{REASON_LIMIT}
              </p>
            </div>
          </div>
        </div>
      )}

      {stage !== "request" && (
        <>
          {/* What was asked for, read off the request rather than asked for
              again: five figures side by side, then the employee's own words
              and whatever was attached. */}
          <section className="space-y-4 rounded-xl border bg-blue-50/30 p-4 sm:p-5">
            <h3 className="flex items-center gap-3 text-xl font-bold text-primary">
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-lg bg-blue-50"
              >
                <FileText className="size-5" strokeWidth={1.5} />
              </span>
              Request Summary
            </h3>
            {stage === "finance" ? (
              // What the financial department pays out against, on one row:
              // what was asked, what was granted, management's word on it,
              // and the salary it comes out of.
              <dl className="grid gap-4 rounded-lg bg-white px-4 py-3 *:min-w-0 sm:grid-cols-2 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:gap-x-0 lg:divide-x lg:divide-container-border lg:[&>*:not(:first-child)]:ps-6 lg:[&>*:not(:last-child)]:pe-6">
                <div className="flex flex-col gap-1">
                  <dt className="whitespace-nowrap text-sm text-primary">Advance Amount (Requested)</dt>
                  <dd className="mt-auto whitespace-nowrap text-xl font-bold text-red-600">
                    {amountValue(requested)}
                    <Rial className="ms-2 text-sm font-normal text-primary/75" />
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="whitespace-nowrap text-sm text-primary">Approved Amount</dt>
                  <dd className="mt-auto w-fit whitespace-nowrap rounded-md bg-green-50 px-3 py-1 text-xl font-bold text-green-700">
                    {amountValue(approvedAmount)}
                    <Rial className="ms-2 text-sm font-normal text-primary/75" />
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-sm text-primary">Comment</dt>
                  <dd className="mt-auto rounded-md border bg-blue-50/40 px-3 py-2 text-sm text-primary">
                    {openRequest?.managementComment || "No comment."}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="whitespace-nowrap text-sm text-primary">Deduct From Salary Of</dt>
                  <dd className="mt-auto whitespace-nowrap pt-1 text-base font-bold text-primary">
                    {deductedFrom(draft)}
                  </dd>
                </div>
              </dl>
            ) : (
            <dl className="grid gap-4 lg:gap-x-0 *:min-w-0 rounded-lg bg-white px-4 py-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] lg:divide-x lg:divide-container-border lg:[&>*:not(:first-child)]:ps-6 lg:[&>*:not(:last-child)]:pe-6">
              {[
                [draft.deductMonth + " " + draft.deductYear + " Salary", amountValue(net), "money"],
                ["Advance Amount (Requested)", amountValue(requested), "held"],
                ["Remaining Salary After Deduction", amountValue(afterDeduction), "money"],
                ["Purpose", draft.purpose || "-"],
                ["Deduct From Salary Of", deductedFrom(draft)],
              ].map(([label, value, kind]) => (
                // Each label on one line, as the design asks; every figure
                // sits at the foot of its column.
                <div key={label} className="flex flex-col gap-1">
                  <dt className="text-sm text-primary lg:whitespace-nowrap">{label}</dt>
                  <dd
                    className={cn(
                      "mt-auto font-bold lg:whitespace-nowrap",
                      kind ? "text-xl" : "pt-1 text-sm",
                      kind === "held" ? "text-red-600" : "text-primary"
                    )}
                  >
                    {value}
                    {kind && <Rial className="ms-2 text-sm font-normal text-primary/75" />}
                  </dd>
                </div>
              ))}
            </dl>
            )}
            {stage !== "finance" && (draft.reason || attachedName) && (
              <div className="space-y-2 rounded-lg border bg-blue-50/50 px-4 py-3 text-sm">
                <p className="font-semibold text-primary">Employee Remarks</p>
                {draft.reason && (
                  <div className="flex items-start gap-4">
                    <p className={cn("flex-1 text-primary/85", !showAllRemarks && "line-clamp-2")}>
                      {draft.reason}
                    </p>
                    {/* Offered wherever the remarks are more than a line. */}
                    {draft.reason.length > REMARKS_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setShowAllRemarks((open) => !open)}
                        aria-expanded={showAllRemarks}
                        className="flex shrink-0 items-center gap-1 font-medium text-primary hover:text-primary/80"
                      >
                        {showAllRemarks ? "Show less" : "Show more"}
                        <ChevronDown
                          aria-hidden="true"
                          className={cn("size-4 transition-transform", showAllRemarks && "rotate-180")}
                        />
                      </button>
                    )}
                  </div>
                )}
                {attachedName && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-primary no-underline hover:text-primary/70"
                    title={"Open " + attachedName}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                    {attachedName}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Management's answer and its comment, in one box. A refusal is
              only as good as its reason; on an approval the comment is a
              note. */}
          {stage === "decision" && (
          <section className="space-y-4 rounded-xl border p-4 sm:p-5">
            <h3 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">
              Management Decision
            </h3>
            {/* On the employee's own page the choices are shown but shut:
                nobody decides their own request, and saying so stops the
                shut cards reading as broken. */}
            {!canDecide && (
              <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                <Info className="size-4 shrink-0" aria-hidden="true" />
                {decision
                  ? "Decided by management. Shown here for your reference."
                  : "Awaiting management decision. Only management can decide this request."}
              </p>
            )}
            <div
              role="radiogroup"
              aria-label="Management decision"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {ADVANCE_DECISIONS.map((option) => {
                const chosen = decision === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    disabled={!canDecide}
                    onClick={() => setDecision(option.key)}
                    className={cn(
                      "flex items-center gap-4 rounded-lg border px-5 py-3 text-start font-semibold text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                      chosen ? "border-primary bg-primary/5" : "bg-blue-50/40 hover:bg-blue-50"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                        chosen ? "border-primary" : "border-primary"
                      )}
                    >
                      {chosen && <span className="size-3 rounded-full bg-primary" />}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
            {/* A partial approval says how much beside its comment, on one
                row: the amount narrow, the comment the rest. */}
            <div
              className={cn(
                "grid gap-4",
                amending &&
                  "md:grid-cols-[1fr_3fr] md:gap-x-0 md:divide-x md:divide-container-border md:*:min-w-0 md:[&>*:first-child]:pe-6 md:[&>*:last-child]:ps-6"
              )}
            >
              {amending && (
                <div className="form-field space-y-2">
                  <label htmlFor="advance-approved" className="block text-sm font-semibold text-primary">
                    Approved Amount (<Rial />)
                    <Star />
                  </label>
                  <Input
                    id="advance-approved"
                    inputMode="decimal"
                    value={approved}
                    onChange={(e) => setApproved(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0.000"
                    disabled={!canDecide}
                    aria-invalid={approvedAmount >= requested || undefined}
                    className={cn(approvedAmount >= requested && "border-destructive")}
                  />
                  {approvedAmount >= requested && (
                    <p className="text-xs text-destructive">
                      A partial approval is less than the {amount(requested)} requested.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="advance-comment" className="block text-sm font-semibold text-primary">
                  Management Comment
                </label>
                <Textarea
                  id="advance-comment"
                  maxLength={COMMENT_LIMIT}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={!canDecide}
                  placeholder="Enter your comment here..."
                />
                <p className="text-end text-xs text-muted-foreground">
                  {comment.length}/{COMMENT_LIMIT}
                </p>
              </div>
            </div>
          </section>
          )}

          {stage === "finance" && (
            <>
              {/* What the financial department does with it: how it is
                  booked, when and how it goes out, and what traces it. */}
              <section className="space-y-4 rounded-xl border p-4 sm:p-5">
                <h3 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">
                  Financial Department Actions
                </h3>
                {/* On the employee's own page the fields are shown but shut,
                    and say why. */}
                {!canDecide && (
                  <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                    <Info className="size-4 shrink-0" aria-hidden="true" />
                    {openRequest?.paidOn
                      ? "Paid by the financial department. Shown here for your reference."
                      : "Awaiting payment. Only the financial department can process it."}
                  </p>
                )}
                {/* The firm's twelve-column field grid, four to a row: the
                    choices size themselves to it. */}
                <div className="form-grid items-start gap-y-4">
                  <Pick
                    id="advance-expense-type"
                    label="Disbursement Type"
                    value={pay.expenseType}
                    onChange={(value) => value && setPaid("expenseType", value)}
                    options={DISBURSEMENT_TYPES}
                    disabled={!canDecide}
                  />
                  <Pick
                    id="advance-category"
                    label="Category"
                    value={pay.category}
                    onChange={(value) => value && setPaid("category", value)}
                    options={DISBURSEMENT_CATEGORIES}
                    disabled={!canDecide}
                  />
                  <Pick
                    id="advance-subcategory"
                    label="Sub-Category"
                    value={pay.subcategory}
                    onChange={(value) => value && setPaid("subcategory", value)}
                    options={DISBURSEMENT_SUBCATEGORIES}
                    disabled={!canDecide}
                  />
                  <div className="form-field space-y-2">
                    <Label htmlFor="advance-pay-date">Disbursement Date</Label>
                    <DateField
                      id="advance-pay-date"
                      name="paymentDate"
                      value={pay.paymentDate}
                      onChange={(e) => setPaid("paymentDate", e.target.value)}
                      disabled={!canDecide}
                    />
                  </div>
                  <Pick
                    id="advance-method"
                    label="Payment Method"
                    value={pay.method}
                    onChange={(value) => value && setPaid("method", value)}
                    placeholder="Select method"
                    options={PAYMENT_METHODS}
                    disabled={!canDecide}
                  />
                  {/* What the bank or the cheque called the payment. */}
                  <div className="form-field space-y-2">
                    <Label htmlFor="advance-reference">Reference No.</Label>
                    <Input
                      id="advance-reference"
                      value={pay.reference}
                      onChange={(e) => setPaid("reference", e.target.value)}
                      placeholder="Enter reference number"
                      disabled={!canDecide}
                    />
                  </div>
                  <div className="form-field span-6 space-y-2">
                    <Label htmlFor="advance-finance-comment">Financial Comment</Label>
                    {/* One line, the height of the fields beside it. */}
                    <Input
                      id="advance-finance-comment"
                      maxLength={COMMENT_LIMIT}
                      value={pay.financeComment}
                      onChange={(e) => setPaid("financeComment", e.target.value)}
                      disabled={!canDecide}
                      placeholder="Enter your comment here..."
                    />
                    <p className="text-end text-xs text-muted-foreground">
                      {pay.financeComment.length}/{COMMENT_LIMIT}
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {/* Plain buttons: this form sits inside the employee form, which either
          would otherwise submit. */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          writing && "rounded-xl bg-blue-50/50 px-4 py-4"
        )}
      >
        {/* What was decided before is the list behind this form - offered
            where a decision is being read, not where one is being written. */}
        {!writing && (
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="flex w-full items-center gap-4 rounded-xl border bg-blue-50/40 px-4 py-3 text-start transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-md"
          >
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white"
            >
              <Clock className="size-6" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-primary">History</span>
              <span className="block text-sm text-primary/75">
                View this request timeline and employee&apos;s previous requests
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
          </button>
        )}

        {/* Every transaction of this kind for the employee - the same table
            the Requests page shows under Salary Advance - over this window,
            to read before deciding. */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Salary Advance History · {employee?.name}</DialogTitle>
            </DialogHeader>
            <SalaryLedger employee={employee} history={salaryHistory} />
          </DialogContent>
        </Dialog>

        <div className="ms-auto flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="min-w-36" onClick={onClose}>
            Cancel
          </Button>
          {stage === "request" &&
            // A request already sent is read here, not sent again.
            !openRequest && (
              <Button
                type="button"
                className="min-w-48"
                onClick={submit}
              >
                Submit Request
              </Button>
            )}
          {correcting && (
            <Button type="button" className="min-w-48" disabled={!canSubmit} onClick={resubmit}>
              <Send className="me-2 h-4 w-4" aria-hidden="true" />
              Resubmit Request
            </Button>
          )}
          {/* The employee asks; only the firm's side answers, so on their own
              page there is nothing here to press. */}
          {stage === "decision" && canDecide && (
            <Button
              type="button"
              className="min-w-48"
              disabled={!canConfirm}
              onClick={confirmDecision}
            >
              Confirm Decision
            </Button>
          )}
          {stage === "finance" && canDecide && !openRequest?.paidOn && (
            <Button
              type="button"
              className="min-w-48"
              disabled={!canProcess}
              onClick={processPayment}
            >
              <Send className="me-2 h-4 w-4" aria-hidden="true" />
              Process Payment
            </Button>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

/**
 * The advances this employee has asked for, and what became of them.
 *
 * It sits between the salary and the payments made against it, which is where
 * an advance belongs: asked for out of the salary above, settled in one of the
 * months below.
 */
export function AdvanceRequests({
  employee,
  onAdd = null,
  addLabel = "",
  // Clicking a request's number opens it back up, to be followed or decided.
  onOpenRequest = null,
  // Further ways to add, beside the main one: [{ label, onClick }].
  moreAdds = [],
}) {
  const { advances } = useAdvances();
  const rows =advancesFor(advances, employee?.name).map((advance) => ({
    ...advance,
    deductFrom: deductedFrom(advance),
    // Shown, not stored: a handed-back request reads "Returned".
    status: advanceStatusOf(advance),
  }));

  const columns = [
    {
      key: "requestNo",
      header: "Request No.",
      width: "14%",
      render: (value, advance) =>
        onOpenRequest ? (
          <RecordLink onClick={() => onOpenRequest(advance)}>{value}</RecordLink>
        ) : (
          <span className="font-medium text-primary">{value}</span>
        ),
    },
    {
      key: "requestedOn",
      header: "Request Date",
      width: "13%",
      render: (value) => <span className="whitespace-nowrap text-primary">{formatDate(value)}</span>,
    },
    {
      // No unit in the heading: every figure below carries it.
      key: "amount",
      header: "Requested Amount",
      width: "15%",
      render: (value) => <span className="whitespace-nowrap font-bold text-green-700">{amount(value)}</span>,
      exportValue: (row) => row.amount,
    },
    { key: "deductFrom", header: "Deducted From", width: "14%" },
    {
      key: "purpose",
      header: "Request Details",
      width: "30%",
      render: (value, advance) => (
        <span className="text-muted-foreground">
          {value && <span className="block font-medium text-primary">{value}</span>}
          {advance.reason}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "14%",
      render: (value) => (
        <span
          className={cn(
            "flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold",
            ADVANCE_STATUS_CHIP[value] || ADVANCE_STATUS_TONE[value]
          )}
        >
          {value}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <RequestTable
          rows={rows}
          columns={columns}
          searchPlaceholder="Search by request no., month or purpose..."
          itemLabel="salary advances"
          exportFileName="salary-advances.csv"
          filterBy={[
            { key: "status", label: "Status" },
            { key: "purpose", label: "Purpose" },
          ]}
          onAdd={onAdd}
          addLabel={addLabel}
          moreAdds={moreAdds}
        />
      </CardContent>
    </Card>
  );
}
