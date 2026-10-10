import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/panels";
import {
  Settled,
  Choice,
  Field,
  checkRequired,
} from "@/components/shared/formFields";
import { PAYING_ACCOUNTS } from "@/pages/firm/firmData";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
  RecordLink,
} from "@/components/shared/RecordTable";
import { RequestSteps, DecisionChoice } from "@/components/shared/RequestSteps";
import { AdvanceSteps, longDate } from "./AdvanceSalarySection";
import MonthPicker from "@/components/shared/MonthPicker";
import { SheetCard, HistoryCard, UploadButton, PayeeFacts } from "@/components/shared/RequestSheet";
import InvoiceIntake, { InvoiceAnalysis } from "./InvoiceIntake";
import { needsInvoice } from "../invoiceAI";
import { useSuppliers } from "@/lib/suppliers/context";
import { entitlementsApi } from "@/lib/api/modules/entitlements";
import { attempt } from "@/lib/api/notice";
import { upserted } from "@/lib/api/store";
import {
  Lock,
  Save,
  Clock,
  Banknote,
  CalendarDays,
  User,
  Landmark,
  FileText,
  FileCheck,
  History,
  UploadCloud,
  X,
  Stethoscope,
  Bus,
  Plane,
  Ticket,
  FileClock,
  HandCoins,
  Send,
} from "lucide-react";
import UploadIcon from "@/components/shared/UploadIcon";
import { cn } from "@/lib/utils";
import { amountValue } from "@/lib/money";
import RequestTable from "@/components/shared/RequestTable";
import RequestOverview from "@/components/shared/RequestOverview";
import { useLeaves } from "@/lib/leaves/context";
import { formatDate } from "@/pages/firm/firmData";
import { remainingBalance } from "../leaveData";
import { PAYMENT_YEARS, SALARY_MONTHS } from "../payrollData";
import { PAYMENT_METHODS } from "@/pages/expenses/expenseData";
import {
  ENTITLEMENT_EXPENSE_TYPE,
  TRANSPORT_GENERAL,
  TRANSPORT_COURT,
  ASSISTANCE_CATEGORY,
  ASSISTANCE_TYPES,
  ENTITLEMENT_CATEGORY,
  ENTITLEMENT_SUBCATEGORY,
  ENTITLEMENT_PENDING,
  ENTITLEMENT_APPROVED,
  ENTITLEMENT_REJECTED,
  ENTITLEMENT_AWAITING,
  ENTITLEMENT_STATUS_CHIP,
  DAYS_IN_MONTH,
  encashmentAmount,
  overtimeAmount,
  hourlyRate,
  nextKindRequestNo,
  entitlementsFor,
  nextEntitlementNo,
  modeOf,
  lastSimilar,
  entitlementHistory,
} from "../entitlementData";

import DateField from "@/components/shared/DateField";
const NOTES_LIMIT = 500;

/**
 * A section heading, with the rule down its left.
 *
 * The same mark the page's own heading uses, one step quieter - so a run of
 * fields always sits under something that says which question they answer.
 */
const HEADING = "border-s-4 border-primary ps-3 text-base font-bold text-primary";

/** "OTR-008" asked in 2026, as the head of the request reads it: "OTR 08/2026". */
const shortRequestNo = (requestNo, on) => {
  const [prefix, count] = String(requestNo).split("-");
  return /^\d+$/.test(count || "")
    ? prefix + " " + String(Number(count)).padStart(2, "0") + "/" + String(on).slice(0, 4)
    : requestNo;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * The tabs whose request has a sheet of its own: a head with the employee and
 * the number, a two-step bar, and only the fields the request is made of.
 */
const SHEETS = {
  overtime: {
    icon: Clock,
    title: "Overtime Request",
    intro: "Submit a new overtime request with the required details.",
    note: "Enter overtime details",
    decisionTitle: "Management Comment",
    decisionNote: "Review and approve",
  },
  leaveEncashment: {
    icon: CalendarDays,
    title: "Leave Request",
    intro: "Submit a new leave request with the required details.",
    note: "Enter leave details",
    decisionTitle: "Management Decision",
    decisionNote: "Review, approve and disburse",
  },
  medical: {
    icon: Stethoscope,
    title: "Medical Allowance Request",
    intro: "Submit a new medical allowance request with the required details and supporting documents.",
    note: "Enter medical allowance details",
    decisionTitle: "Management Decision",
    decisionNote: "Review, approve and disburse",
    // Fields laid out by the shared sheet, with the history at its foot.
    shared: true,
  },
  transport: {
    icon: Bus,
    title: "Transportation Allowance Request",
    intro: "Submit a new transportation allowance request with the required details and supporting documents.",
    note: "Enter transportation allowance details",
    decisionTitle: "Management Decision",
    decisionNote: "Review, approve and disburse",
    // Fields laid out by the shared sheet, with the history at its foot.
    shared: true,
  },
  travel: {
    icon: Plane,
    title: "Travel Allowance Request",
    intro: "Submit a new travel allowance request with the required details and supporting documents.",
    note: "Enter travel allowance details",
    decisionTitle: "Management Decision",
    decisionNote: "Review, approve and disburse",
    // Fields laid out by the shared sheet, with the history at its foot.
    shared: true,
  },
  airTicket: {
    icon: Ticket,
    title: "Air Ticket Request",
    intro: "Submit a new air ticket request with the required details and supporting documents.",
    note: "Enter air ticket details",
    decisionTitle: "Management Decision",
    decisionNote: "Review, approve and disburse",
    // Fields laid out by the shared sheet, with the history at its foot.
    shared: true,
  },
  notice: {
    icon: FileClock,
    title: "Notice Pay Request",
    intro: "Submit a new notice pay request with the required details and supporting documents.",
    note: "Enter notice pay details",
    decisionTitle: "Management Decision",
    decisionNote: "Review, approve and disburse",
    // Fields laid out by the shared sheet, with the history at its foot.
    shared: true,
  },
  endOfService: {
    icon: HandCoins,
    title: "End-of-Service Gratuity Request",
    intro: "Submit a new end-of-service gratuity request with the required details and supporting documents.",
    note: "Enter end-of-service gratuity details",
    decisionTitle: "Management Decision",
    decisionNote: "Review, approve and disburse",
    // Fields laid out by the shared sheet, with the history at its foot.
    shared: true,
  },
};

/** Only annual leave is encashable: sick leave is there to be taken and
 * unpaid leave is worth nothing. */
const ENCASHABLE_LEAVE = ["Annual Leave"];

// A leave request starts with its year and type unpicked, as its sheet asks
// for both; every other tab keeps the current year and annual leave.
const emptyDraft = (kind) => ({
  requestDate: todayIso(),
  year: kind === "leaveEncashment" ? "" : String(new Date().getFullYear()),
  month: "",
  leaveType: kind === "leaveEncashment" ? "" : "Annual Leave",
  days: "",
  amount: "",
  reason: "",
  // Overtime is claimed as a month's hours, at the ordinary hourly rate.
  hours: "",
  // A transport claim is general, or made for a case - in which case it
  // names the file and the day of the trip.
  transportType: TRANSPORT_GENERAL,
  fileNo: "",
  travelDate: "",
  // What kind of help an assistance request is for.
  assistanceType: "",
  // On a medical claim: what insurance already paid of the invoice.
  insurance: "",
});

const emptyPayment = () => ({
  approved: "",
  // What a partial approval grants, in the unit the request was counted in.
  // The money follows from these; only a request already made in money asks
  // for `approved` directly.
  approvedDays: "",
  approvedHours: "",
  // What happened on the case the trip was for, recorded as the claim is paid.
  updateDate: todayIso(),
  updateText: "",
  method: "",
  // One choice for where it leaves from: the account carries its bank.
  bankAccount: "",
  paymentDate: todayIso(),
  reference: "",
});

/** A field's label. */
function FieldLabel({ htmlFor, children }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
    </Label>
  );
}

/**
 * Where the request is booked. None of it is a choice - every entitlement is
 * filed the same way - so the box wears a lock rather than a chevron.
 */
function Booked({ id, label, value }) {
  return (
    <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Lock
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          readOnly
          tabIndex={-1}
          value={value}
          className="cursor-default bg-locked ps-9 text-muted-foreground"
        />
      </div>
    </div>
  );
}

/**
 * One fact of the card under the decision.
 *
 * The label carries the icon and the value sits under it, lighter and
 * smaller: the card is read across for what the request is, not down.
 */
function Fact({ icon, label, children }) {
  const Icon = icon;
  return (
    <div className="px-0 lg:px-4 lg:first:ps-0">
      <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </p>
      {/* Lighter and smaller than the label above it: the card is read for
          what the request is, not for any one figure in it. */}
      <p className="mt-1 text-xs font-normal text-primary">{children}</p>
    </div>
  );
}

/** A figure the form works out rather than asks for. */
function Worked({ id, label, value }) {
  return (
    <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        readOnly
        tabIndex={-1}
        value={value}
        className="cursor-default bg-locked text-muted-foreground"
      />
    </div>
  );
}

/**
 * One entitlement, asked for and decided.
 *
 * Every tab in the section works this way, and differs only in what it counts:
 * days off a leave balance, hours of overtime, or a sum the employee names.
 * Everything after that - the classification, the decision, the payment and
 * the numbering - is the same, so it is written once here.
 */
export default function EntitlementTab({
  kind,
  label,
  employee,
  records,
  onRecords,
  // The words on the button that asks for one.
  addLabel,
  adding,
  onCloseAdd,
  onOpenAdd,
  // The firm decides; on My Profile the request is asked for and only read.
  canDecide = true,
}) {
  const { leaves, recordEncashment } = useLeaves();
  const [draft, setDraft] = useState(() => emptyDraft(kind));
  const [payment, setPayment] = useState(emptyPayment);
  // A request made on an invoice starts with the invoice itself.
  const firstStage = needsInvoice(kind) && SHEETS[kind] ? "invoice" : "request";
  const [stage, setStage] = useState(firstStage);
  // What the AI read off the invoice uploaded for a new request, while it
  // is being read, and whether the employee confirmed the reading.
  const [invoice, setInvoice] = useState(null);
  // What the server's checks found on that invoice, and the file itself -
  // filed with the request as the paper it was made on.
  const [invoiceRisk, setInvoiceRisk] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  // The server registers a new supplier when the claim is filed; the
  // directory is read again afterwards.
  const { refreshSuppliers } = useSuppliers();
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
  // The record the server returned, in place of the one on the list.
  const keepRecord = (row) => {
    if (row) onRecords((prev) => upserted(prev, row));
    return row;
  };
  const [decision, setDecision] = useState("");
  const [openId, setOpenId] = useState(null);
  const [reason, setReason] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));
  const setPay = (name, value) =>
    setPayment((prev) => ({ ...prev, [name]: value }));

  const mode = modeOf(kind);
  // The allowances whose sheets put the sum asked for beside the decision
  // and at the head of the summary, rather than an account or a type.
  const namesAmount =
    kind === "medical" ||
    kind === "transport" ||
    kind === "travel" ||
    kind === "airTicket" ||
    kind === "notice";
  // Where the decision's own row sits inside the box of decisions, and the
  // day of the request is the employee's to set.
  const medicalLayout =
    kind === "medical" || kind === "travel" || kind === "airTicket";
  // Notice pay dates its own request too, but keeps its decision row under
  // a heading of its own.
  const ownDate = medicalLayout || kind === "notice";
  // Assistance has a sheet of its own for the decision, and a shorter note.
  const assisting = kind === "assistance";
  // Overtime has a sheet of its own: a head, the period and the hours.
  const overtiming = kind === "overtime";
  const sheet = SHEETS[kind];
  const notesLimit = assisting || kind === "notice" ? 300 : NOTES_LIMIT;
  const open = records.find((row) => row.id === openId) || null;
  const settled = open?.status === ENTITLEMENT_APPROVED;
  const refused = open?.status === ENTITLEMENT_REJECTED;
  // Decided by management, waiting on the financial department.
  const awaiting = open?.status === ENTITLEMENT_AWAITING;
  // Made on an invoice: the invoice is read first, and what it says is
  // the claim. A request already made carries the reading with it.
  const invoiceKind = needsInvoice(kind) && Boolean(sheet);
  const shownInvoice = invoice || open?.invoice || null;
  // The server's checks: on an invoice just read, what the analysis found;
  // on a request already filed, what was found when it was filed.
  const risk = invoice ? invoiceRisk : open?.risk || null;

  const mine = entitlementsFor(records, employee?.name, kind).map((record, index) => ({
    ...record,
    no: record.entitlementNo || record.requestNo || index + 1,
    detail:
      record.leaveType && modeOf(record.kind) === "leaveDays"
        ? record.leaveType
        : record.assistanceType || label,
  }));

  // "January" rather than "01", as the card under the decision writes it.
  const monthName =
    SALARY_MONTHS.find((month) => month.value === draft.month)?.label || "";

  // The number it already carries, or the one it is about to be given. Shown
  // before it is saved so the employee can quote it.
  const requestNo = open?.requestNo || nextKindRequestNo(records, kind);

  // Who it is for, as a personnel record names them: the name alone is not an
  // identifier, and two people can share one.
  const whose =
    (employee?.name || "") + (employee?.empNo ? " \u2014 " + employee.empNo : "");

  // What is left of the leave being encashed - counted off the leave already
  // taken, never stored.
  const balance =
    mode === "leaveDays"
      ? remainingBalance(leaves, employee?.name, draft.leaveType, draft.year)
      : null;
  const available = balance && !balance.expired ? balance.remaining : 0;
  const days = Number(draft.days || 0);
  const after = Math.max(available - days, 0);
  const exceeded = mode === "leaveDays" && days > available;

  // How long the overtime shift ran, counted off the clock rather than typed.
  // The overtime hours the employee is claiming for the month.
  const workedHours = mode === "hours" ? Number(draft.hours || 0) : 0;

  // What an hour of it is worth: the ordinary hourly rate, lifted by however
  // much the kind of day it fell on is worth.
  // What the request comes to. Days and hours are worth what the salary says
  // they are worth; anything else is the sum that was asked for.
  const amount =
    mode === "leaveDays"
      ? encashmentAmount(employee?.salary, days)
      : mode === "hours"
        ? overtimeAmount(employee?.salary, workedHours)
        : invoiceKind && shownInvoice
          ? Math.max(0, Number((shownInvoice.total - Number(draft.insurance || 0)).toFixed(3)))
          : Number(draft.amount || 0);

  const counted =
    invoiceKind && shownInvoice
      ? amount > 0
      : mode === "leaveDays"
      ? days > 0
      : mode === "hours"
        ? workedHours > 0
        : Number(draft.amount) > 0;

  // A court-linked trip names its file and its day; a general one does not.
  const courtLinked =
    kind === "transport" && draft.transportType === TRANSPORT_COURT;

  // Transport asks for a comment but does not insist on one; every other
  // request has to say why it is being made.
  // Overtime's sheet asks for no comment at all.
  const reasonRequired =
    kind !== "transport" && kind !== "medical" && (!sheet || sheet.shared);

  const canSubmit =
    draft.requestDate &&
    counted &&
    !exceeded &&
    (mode !== "leaveDays" || (draft.year && draft.leaveType)) &&
    (mode !== "hours" ||
      (draft.year && draft.month && workedHours > 0)) &&
    (!courtLinked || (draft.fileNo.trim() && draft.travelDate)) &&
    (!assisting || draft.assistanceType) &&
    (!reasonRequired || draft.reason.trim()) &&
    // Read by the AI and confirmed by the employee before it is sent.
    (!invoiceKind || (Boolean(shownInvoice) && (confirmed || Boolean(open))));

  // A full approval grants what was asked for; only a partial one names a
  // figure of its own, and a refusal grants nothing at all.
  const amending = decision === "partial";
  /**
   * Nothing is disbursed on either of these. A refusal ends the request; a
   * return keeps it alive and asks the employee for what is missing. Both
   * want a comment and neither wants a payment, so the form treats them the
   * same from here on.
   */
  const returning = decision === "completion";
  const refusing = decision === "rejected" || returning;

  /**
   * What a decision actually grants, in the unit the request was made in.
   *
   * A full approval grants what was asked for. A partial one is management
   * cutting the count - days of leave, or hours of overtime - so that is the
   * figure they type, and the money follows from it. The other way round
   * would have them working out a sum to arrive at a number of days, which is
   * the calculation the form is there to do.
   */
  const approvedDays =
    mode !== "leaveDays"
      ? null
      : amending
        ? Number(payment.approvedDays || 0)
        : days;

  const approvedHours =
    mode !== "hours"
      ? null
      : amending
        ? Number(payment.approvedHours || 0)
        : workedHours;

  /**
   * What that comes to. Worked out from whatever was granted, never typed
   * beside it: a sum and a count that disagree is a record nobody can settle.
   * Only the kinds counted in money are asked for a figure directly.
   */
  const approvedAmount =
    mode === "leaveDays"
      ? encashmentAmount(employee?.salary, approvedDays)
      : mode === "hours"
        ? overtimeAmount(employee?.salary, approvedHours)
        : amending
          ? Number(payment.approved || 0)
          : amount;
  const decidedOn = open?.decisionDate || todayIso();
  const attachedName = open?.attachment || "";
  // Its category and subcategory: assistance is filed under the kind of help.
  const category = assisting ? ASSISTANCE_CATEGORY : ENTITLEMENT_CATEGORY;
  const subcategory = assisting
    ? draft.assistanceType
    : ENTITLEMENT_SUBCATEGORY[kind] || label + " Request";
  // What this person was given last time, where there was a last time.
  const previous = lastSimilar(records, employee?.name, kind, openId);

  /**
   * Whether a partial approval grants something possible.
   *
   * More than nothing, and never more than was asked for: an office that may
   * grant less than the request may not use the same answer to grant more.
   * Checked in the unit that was actually typed, so the message can name it.
   */
  const grantIsSound =
    !amending ||
    (approvedDays !== null
      ? approvedDays > 0 && approvedDays <= days
      : approvedHours !== null
        ? approvedHours > 0 && approvedHours <= workedHours
        : approvedAmount > 0 && approvedAmount <= amount);

  const canDisburse =
    Boolean(decision) &&
    !refusing &&
    canDecide &&
    grantIsSound &&
    approvedAmount > 0 &&
    approvedAmount <= amount &&
    payment.method &&
    payment.bankAccount &&
    payment.paymentDate &&
    payment.reference.trim() &&
    // A court-linked trip is paid together with what happened on the case.
    (!courtLinked || (payment.updateDate && payment.updateText.trim()));

  const close = () => {
    setDraft(emptyDraft(kind));
    setPayment(emptyPayment());
    setReceipt(null);
    setShowHistory(false);
    setStage(firstStage);
    setDecision("");
    setOpenId(null);
    setReason("");
    setInvoice(null);
    setInvoiceRisk(null);
    setInvoiceFile(null);
    setAnalyzing(false);
    setConfirmed(false);
    onCloseAdd();
  };

  /**
   * The request made. It is on the list straight away, under a temporary
   * number and waiting on a decision.
   */
  const submit = async () => {
    if (!checkRequired() || !canSubmit) return;
    // Assistance is not filed under /entitlements: its tab keeps its own list.
    if (assisting) {
      submitAssistance();
      return;
    }
    // The server numbers it, works out the amount, runs the invoice checks
    // again and registers a supplier it does not know.
    const options = {
      employeeId: employee?.id,
      invoice: invoiceKind ? shownInvoice : null,
      file: invoiceFile || receipt || null,
    };
    const filed = { ...draft, reason: draft.reason.trim(), fileNo: draft.fileNo.trim() };
    const saved = keepRecord(
      await send(() =>
        open
          ? entitlementsApi.resubmit(open.id, kind, filed, options)
          : entitlementsApi.submit(kind, filed, options)
      )
    );
    if (!saved) return;
    if (invoiceKind && risk && !risk.supplier) refreshSuppliers();
    // From here the request shows what was filed: its invoice and its checks.
    setOpenId(saved.id);
    setInvoice(null);
    setInvoiceRisk(null);
    setInvoiceFile(null);
    setDecision(saved.decision || "");
    setPay("approved", String(saved.amount));
    // The upload beside the transfer is a different paper from the request's.
    setReceipt(null);
    setStage("decision");
  };

  /** Assistance, filed on this tab's own list as before. */
  const submitAssistance = () => {
    const details = {
      requestDate: draft.requestDate,
      amount,
      reason: draft.reason.trim(),
      assistanceType: draft.assistanceType,
      // The paper the request was made on, kept by name with the request.
      attachment: receipt?.name || open?.attachment || "",
    };

    if (open) {
      onRecords((prev) =>
        prev.map((row) => (row.id === openId ? { ...row, ...details } : row))
      );
    } else {
      const id = records.reduce((max, row) => Math.max(max, row.id), 0) + 1;
      onRecords((prev) => [
        {
          id,
          kind,
          employee: employee?.name || "",
          requestNo: nextKindRequestNo(prev, kind),
          entitlementNo: "",
          status: ENTITLEMENT_PENDING,
          rejectionReason: "",
          ...details,
        },
        ...prev,
      ]);
      setOpenId(id);
    }
    setPay("approved", String(amount));
    // The upload beside the transfer is a different paper from the request's.
    setReceipt(null);
    setStage("decision");
  };

  /**
   * The financial department's payment. The server gives the request the
   * list's own number when it is approved, and files paid-out leave days on
   * the leave record.
   */
  const disburse = async () => {
    if (!openId || !canDisburse) return;
    if (assisting) {
      disburseAssistance();
      return;
    }
    const saved = keepRecord(
      await send(() =>
        entitlementsApi.pay(openId, {
          method: payment.method,
          bankAccount: payment.bankAccount,
          paymentDate: payment.paymentDate,
          reference: payment.reference.trim(),
          // What happened on the case the trip was for goes with the payment.
          financeComment: courtLinked
            ? ("File update " + payment.updateDate + ": " + payment.updateText.trim()).slice(0, 300)
            : null,
          expenseType: ENTITLEMENT_EXPENSE_TYPE,
          category,
          subcategory,
        })
      )
    );
    if (!saved) return;
    // Encashed days are days of leave used: they go on the Leaves list as
    // Encashed – Paid and come off the year's balance on this screen too.
    if (mode === "leaveDays" && approvedDays > 0) {
      recordEncashment({
        employee: employee?.name || "",
        category: "Regular Leave",
        type: draft.leaveType || "Annual Leave",
        year: draft.year,
        from: "",
        to: "",
        days: approvedDays,
        reason: "Leave encashment",
        encashmentNo: saved.entitlementNo || saved.requestNo,
        decidedAt: payment.paymentDate,
        comments: "Paid out as leave encashment.",
      });
    }
    close();
  };

  /** Assistance, approved and paid on this tab's own list. */
  const disburseAssistance = () => {
    onRecords((prev) =>
      prev.map((row) =>
        row.id === openId
          ? {
              ...row,
              entitlementNo: row.entitlementNo || nextEntitlementNo(prev),
              status: ENTITLEMENT_APPROVED,
              rejectionReason: "",
              amount: approvedAmount,
              approvedAmount,
              decisionDate: decidedOn,
              decidedBy: CURRENT_USER.name,
              managementComment: reason.trim(),
              method: payment.method,
              bankAccount: payment.bankAccount,
              paymentDate: payment.paymentDate,
              reference: payment.reference.trim(),
              receipt: receipt?.name || "",
            }
          : row
      )
    );
    close();
  };

  /**
   * Management's answer, saved on its own. An approval waits for the
   * financial department to pay it; a refusal or a return ends here.
   */
  const confirmDecision = async () => {
    if (!openId || !decision || !canDecide) return;
    if (refusing) {
      reject();
      return;
    }
    if (!grantIsSound || approvedAmount <= 0) return;
    // A cut in days or hours is granted as the money it comes to.
    const saved = keepRecord(
      await send(() =>
        entitlementsApi.decide(openId, { decision, approvedAmount, comment: reason.trim() })
      )
    );
    if (saved) setStage("finance");
  };

  /** The invoice in: the server reads and checks it, and the claim is filled in from it. */
  const pickInvoice = async (file) => {
    setAnalyzing(true);
    setConfirmed(false);
    const read = await attempt(() => entitlementsApi.analyze(file, kind, employee?.id));
    setAnalyzing(false);
    if (!read) return;
    setInvoice(read.invoice);
    setInvoiceRisk(read.risk);
    setInvoiceFile(file);
    setDraft((prev) => ({
      ...prev,
      insurance: "",
      requestDate: read.invoice.invoiceDate || prev.requestDate,
      amount: String(read.invoice.total),
    }));
  };

  /**
   * Refused, or handed back for what is missing: either way the comment says
   * why. The request keeps its temporary number.
   */
  const reject = async () => {
    if (!openId || !reason.trim()) return;
    if (assisting) {
      onRecords((prev) =>
        prev.map((row) =>
          row.id === openId
            ? {
                ...row,
                status: ENTITLEMENT_REJECTED,
                decisionDate: decidedOn,
                decidedBy: CURRENT_USER.name,
                managementComment: reason.trim(),
                rejectionReason: reason.trim(),
              }
            : row
        )
      );
      close();
      return;
    }
    const saved = keepRecord(
      await send(() =>
        entitlementsApi.decide(openId, {
          decision: returning ? "completion" : "rejected",
          comment: reason.trim(),
        })
      )
    );
    if (saved) close();
  };

  /** A request opened back off the list, to be followed or decided. */
  const track = (record) => {
    setOpenId(record.id);
    setStage(
      record.status === ENTITLEMENT_AWAITING || record.status === ENTITLEMENT_APPROVED
        ? "finance"
        : "decision"
    );
    setDecision(
      record.status === ENTITLEMENT_REJECTED
        ? "rejected"
        : record.decision || (record.status === ENTITLEMENT_APPROVED ? "full" : "")
    );
    setReason(record.managementComment || "");
    setInvoice(null);
    setInvoiceRisk(null);
    setInvoiceFile(null);
    setConfirmed(true);
    setDraft({
      ...emptyDraft(kind),
      requestDate: record.requestDate,
      year: record.year || "",
      month: record.month || "",
      leaveType: record.leaveType || "Annual Leave",
      days: String(record.days || ""),
      hours: String(record.hours || ""),
      transportType: record.transportType || TRANSPORT_GENERAL,
      fileNo: record.fileNo || "",
      travelDate: record.travelDate || "",
      assistanceType: record.assistanceType || "",
      amount: String(record.amount || ""),
      reason: record.reason || "",
      insurance: String(record.invoice?.insuranceCovered || ""),
    });
    setPayment({
      ...emptyPayment(),
      approved: String(record.approvedAmount ?? record.amount ?? ""),
      // The server keeps a partial grant as money; the days or hours it
      // stands for are read back off the salary they were worked out from.
      approvedDays: String(
        record.approvedDays ??
          (record.decision === "partial" && mode === "leaveDays" && Number(employee?.salary)
            ? Math.round(record.approvedAmount / (Number(employee.salary) / DAYS_IN_MONTH))
            : "")
      ),
      approvedHours: String(
        record.approvedHours ??
          (record.decision === "partial" && mode === "hours" && hourlyRate(employee?.salary)
            ? Number((record.approvedAmount / hourlyRate(employee?.salary)).toFixed(2))
            : "")
      ),
      method: record.method || "",
      bankAccount: record.bankAccount || "",
      paymentDate: record.paymentDate || todayIso(),
      reference: record.reference || "",
    });
    onOpenAdd();
  };

  /** What the list shows a request was for, in one line. */
  const measure = (record) =>
    modeOf(record.kind) === "leaveDays"
      ? record.days + " Days"
      : modeOf(record.kind) === "hours"
        ? record.hours + " Hours"
        : "-";

  // The list's columns, on the page and in the History window alike.
  const columns = [
    {
      // A request waiting on a decision carries its temporary number
      // and opens back into the form.
      key: "no",
      header: "No.",
      width: "12%",
      render: (value, record) =>
        record.entitlementNo ? (
          <span className="font-medium text-primary">{value}</span>
        ) : (
          <button
            type="button"
            onClick={() => track(record)}
            className="rounded font-bold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {value}
          </button>
        ),
    },
    {
      key: "requestDate",
      header: "Request Date",
      width: "14%",
      render: (value) => <span className="whitespace-nowrap">{formatDate(value)}</span>,
    },
    {
      key: "detail",
      header: "Request Details",
      width: "28%",
      render: (value, record) => (
        <>
          <span className="block font-semibold text-primary">{value}</span>
          <span className="block text-xs text-muted-foreground">{record.reason}</span>
        </>
      ),
    },
    {
      key: "quantity",
      header: "Quantity",
      width: "12%",
      render: (_, record) => <span className="whitespace-nowrap">{measure(record)}</span>,
      exportValue: (record) => measure(record),
    },
    {
      key: "amount",
      header: "Amount (OMR)",
      width: "16%",
      render: (value) => <span className="whitespace-nowrap font-bold text-green-700">{amountValue(value)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      render: (value) => (
        <span
          className={cn(
            "block w-fit rounded-md px-2.5 py-0.5 text-xs font-semibold",
            ENTITLEMENT_STATUS_CHIP[value]
          )}
        >
          {value}
        </span>
      ),
    },
  ];


  /**
   * The decision itself: when it was given, what it grants, and why.
   *
   * One row of four - the date, what was granted in the request's own unit,
   * the money that comes to, and the comment - the way every one of the
   * request sheets draws it. A refusal or a return grants nothing, so it has
   * no figures to show and the comment takes the whole row.
   */
  const decisionFields = (
    <div className="form-grid">
      {!refusing && (
        <>
                  <Settled
                    id="ent-decision-date"
                    label="Decision Date"
                    value={formatDate(decidedOn)}
                  />

                  {namesAmount && (
                    <Settled
                      id="ent-requested"
                      label="Requested Amount (OMR)"
                      value={amountValue(amount)}
                    />
                  )}

                  {/* A partial approval is management cutting the count, so
                      that is the field it opens. A full approval grants what
                      was asked for and has nothing to type. */}
                  {approvedDays !== null &&
                    (amending ? (
                      <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                        <FieldLabel htmlFor="ent-approved-days" required>
                          Days Requested for Encashment
                        </FieldLabel>
                        <Input
                          id="ent-approved-days"
                          inputMode="numeric"
                          value={payment.approvedDays}
                          onChange={(e) =>
                            setPay("approvedDays", e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="0"
                          className={cn(!grantIsSound && "border-destructive")}
                        />
                        {!grantIsSound && (
                          <p role="alert" className="text-xs font-semibold text-destructive">
                            {"Between 1 and " + days + " days"}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Settled
                        id="ent-approved-days"
                        label="Days Requested for Encashment"
                        value={approvedDays + " Days"}
                      />
                    ))}

                  {approvedHours !== null &&
                    (amending ? (
                      <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                        <FieldLabel htmlFor="ent-approved-hours" required>
                          Approved Overtime Hours
                        </FieldLabel>
                        <Input
                          id="ent-approved-hours"
                          inputMode="decimal"
                          value={payment.approvedHours}
                          onChange={(e) =>
                            setPay("approvedHours", e.target.value.replace(/[^\d.]/g, ""))
                          }
                          placeholder="0"
                          className={cn(!grantIsSound && "border-destructive")}
                        />
                        {!grantIsSound && (
                          <p role="alert" className="text-xs font-semibold text-destructive">
                            {"Between 0 and " + workedHours + " hours"}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Settled
                        id="ent-approved-hours"
                        label="Approved Overtime Hours"
                        value={approvedHours + " Hours"}
                      />
                    ))}

                  {/* Worked out from whatever was granted above, except where
                      the request is a sum in the first place. */}
                  {amending && approvedDays === null && approvedHours === null ? (
                    <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                      <FieldLabel htmlFor="ent-approved" required>
                        Approved Amount (OMR)
                      </FieldLabel>
                      <Input
                        id="ent-approved"
                        inputMode="decimal"
                        value={payment.approved}
                        onChange={(e) =>
                          setPay("approved", e.target.value.replace(/[^\d.]/g, ""))
                        }
                        placeholder="0.000"
                        className={cn(!grantIsSound && "border-destructive")}
                      />
                    </div>
                  ) : (
                    <Settled
                      id="ent-approved"
                      label="Approved Amount (OMR)"
                      value={amountValue(approvedAmount)}
                    />
                  )}
        </>
      )}

      <div
        className={cn(
          "form-field flex h-full flex-col justify-end gap-2",
          refusing ? "span-12" : "span-3"
        )}
      >
        <FieldLabel htmlFor="ent-comment">
          {returning
            ? "What is Missing"
            : refusing
              ? "Reason for Rejection"
              : "Management Comment"}
        </FieldLabel>
        <Textarea
          id="ent-comment"
          rows={refusing ? 3 : 1}
          maxLength={NOTES_LIMIT}
          required={refusing}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={!canDecide || settled || refused}
          placeholder={
            returning
              ? "Say what the employee still has to supply"
              : refusing
                ? "Say why this request is refused"
                : "Enter management comment"
          }
          className={cn(!refusing && "min-h-9 resize-none")}
        />
        {refusing && (
          <p className="text-end text-xs text-muted-foreground">
            {reason.length} / {NOTES_LIMIT}
          </p>
        )}
      </div>
    </div>
  );

  /**
   * Assistance, decided. Its sheet reads the request back before the
   * decision - the number, the day, who and what kind, and the employee's own
   * words - then puts the decision, the payment and the transfer summary
   * under it.
   */
  const assistanceDecision = (
    <>
      <div className="space-y-4">
        <h3 className={HEADING}>Request Information</h3>
        <div className="form-grid">
          <div className="relative">
            <Settled id="ent-request-no" label="Request No." value={requestNo} />
            {attachedName && (
              <p className="absolute start-0 top-full mt-1 text-xs text-record-link">
                {attachedName}
              </p>
            )}
          </div>
          <Settled
            id="ent-request-date"
            label="Request Date"
            value={formatDate(draft.requestDate)}
          />
          <Settled id="ent-employee" label="Employee Name" value={whose} />
          <Settled
            id="ent-assistance-type"
            label="Assistance Type"
            value={draft.assistanceType || "-"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className={HEADING}>Employee Comment</h3>
        <p className="rounded-field border border-field-border bg-locked px-3 py-2 text-sm text-muted-foreground">
          {draft.reason || "-"}
        </p>
      </div>

      <DecisionChoice
        value={decision}
        onChange={setDecision}
        disabled={!canDecide || settled || refused}
        offers={["full", "partial", "rejected"]}
        notes={{
          full: "Approve the assistance as requested",
          rejected: "Reject the assistance request",
        }}
      />

      {decision && !refusing && (
        <div className="space-y-4">
          <h3 className={HEADING}>Assistance Approval &amp; Disbursement</h3>
          <div className="form-grid">
            <Settled id="ent-type" label="Expense Type" value={ENTITLEMENT_EXPENSE_TYPE} />
            <Settled id="ent-category" label="Category" value={category} />
            <Settled id="ent-subcategory" label="Subcategory" value={subcategory} />
            <Settled
              id="ent-requested"
              label="Requested Amount"
              value={amountValue(amount) + " OMR"}
            />

            {/* A partial approval is the one place a figure is typed. */}
            {amending ? (
              <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                <FieldLabel htmlFor="ent-approved">Approved Amount (OMR)</FieldLabel>
                <Input
                  required
                  id="ent-approved"
                  inputMode="decimal"
                  value={payment.approved}
                  onChange={(e) =>
                    setPay("approved", e.target.value.replace(/[^\d.]/g, ""))
                  }
                  placeholder="0.000"
                  className={cn(!grantIsSound && "border-destructive")}
                />
                {!grantIsSound && (
                  <p role="alert" className="text-xs font-semibold text-destructive">
                    {"More than 0 and at most " + amountValue(amount) + " OMR"}
                  </p>
                )}
              </div>
            ) : (
              <Settled
                id="ent-approved"
                label="Approved Amount"
                value={amountValue(approvedAmount) + " OMR"}
                payable
              />
            )}
            <Choice
              id="ent-method"
              label="Payment Method"
              value={payment.method}
              onChange={(value) => value && setPay("method", value)}
              placeholder="Select method"
              options={PAYMENT_METHODS}
            />
            <Choice
              id="ent-bank"
              label="Bank Account"
              value={payment.bankAccount}
              onChange={(value) => value && setPay("bankAccount", value)}
              placeholder="Select bank account"
              options={PAYING_ACCOUNTS}
            />
            <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
              <FieldLabel htmlFor="ent-payment-date">Payment Date</FieldLabel>
              <DateField
                required
                id="ent-payment-date"
                value={payment.paymentDate}
                onChange={(e) => setPay("paymentDate", e.target.value)}
              />
            </div>

            <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
              <FieldLabel htmlFor="ent-reference">Transfer No.</FieldLabel>
              <div className="flex w-full min-w-0 items-center gap-2">
                <Input
                  required
                  id="ent-reference"
                  className="min-w-0 flex-1"
                  value={payment.reference}
                  onChange={(e) => setPay("reference", e.target.value)}
                  placeholder="TRX-0000-00000"
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
                    onChange={(e) => e.target.files[0] && setReceipt(e.target.files[0])}
                  />
                </label>
              </div>
            </div>
            <Settled
              id="ent-decision-date"
              label="Decision Date"
              value={formatDate(decidedOn)}
            />
          </div>
        </div>
      )}

      {/* Optional on an approval; a rejection has to say why. */}
      <div className="space-y-2">
        <h3 className={HEADING}>
          {refusing ? "Reason for Rejection" : "Management Comment"}
        </h3>
        <Textarea
          id="ent-comment"
          rows={refusing ? 3 : 1}
          maxLength={notesLimit}
          required={refusing}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={!canDecide || settled || refused}
          placeholder={
            refusing
              ? "Say why the assistance is refused"
              : "Add management comment (optional)"
          }
          className={cn(!refusing && "min-h-9 resize-none")}
        />
        <p className="text-end text-xs text-muted-foreground">
          {reason.length} / {notesLimit}
        </p>
      </div>

      {/* Who is paid, into what, and how much - wearing the decision's colour. */}
      {decision && !refusing && (
        <div
          className={cn(
            "rounded-lg border p-4",
            decision === "full" && "border-green-600/50 bg-decision-full",
            decision === "partial" && "border-decision-partial-ink bg-decision-partial"
          )}
        >
          <h3 className={HEADING}>Assistance Approval &amp; Transfer Summary</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:[&>*+*]:border-s">
            <Fact icon={User} label="Employee Name">
              {employee?.name || "-"}
            </Fact>
            <Fact icon={Landmark} label="Bank Name">
              {employee?.bankName || "-"}
            </Fact>
            <Fact icon={FileText} label="Employee Account Number">
              {employee?.accountNumber || "-"}
            </Fact>
            <Fact icon={Banknote} label="Approved Amount">
              {amountValue(approvedAmount) + " OMR"}
            </Fact>
          </div>
        </div>
      )}
    </>
  );

  // What a partial approval grants, in the unit the request was made in -
  // typed on the decision, read on the payment.
  const grantField = (
    amending && approvedDays !== null ? (
      <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
        <FieldLabel htmlFor="ent-approved-days" required>
          Approved Days
        </FieldLabel>
        <Input
          id="ent-approved-days"
          inputMode="numeric"
          value={payment.approvedDays}
          onChange={(e) =>
            setPay("approvedDays", e.target.value.replace(/\D/g, ""))
          }
          placeholder="0"
          className={cn(!grantIsSound && "border-destructive")}
        />
        {!grantIsSound && (
          <p role="alert" className="text-xs font-semibold text-destructive">
            {"Between 1 and " + days + " days"}
          </p>
        )}
      </div>
    ) : amending && approvedHours !== null ? (
      <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
        <FieldLabel htmlFor="ent-approved-hours" required>
          Approved Overtime Hours
        </FieldLabel>
        <Input
          id="ent-approved-hours"
          inputMode="decimal"
          value={payment.approvedHours}
          onChange={(e) =>
            setPay("approvedHours", e.target.value.replace(/[^\d.]/g, ""))
          }
          placeholder="0"
          className={cn(!grantIsSound && "border-destructive")}
        />
        {!grantIsSound && (
          <p role="alert" className="text-xs font-semibold text-destructive">
            {"Between 0 and " + workedHours + " hours"}
          </p>
        )}
      </div>
    ) : amending ? (
      <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
        <FieldLabel htmlFor="ent-approved" required>
          Approved Amount (OMR)
        </FieldLabel>
        <Input
          id="ent-approved"
          inputMode="decimal"
          value={payment.approved}
          onChange={(e) =>
            setPay("approved", e.target.value.replace(/[^\d.]/g, ""))
          }
          placeholder="0.000"
          className={cn(!grantIsSound && "border-destructive")}
        />
      </div>
    ) : null
  );

  // The stages of a request: the invoice first where there is one, then
  // the request, management's decision and the financial department.
  const sheetSteps = sheet
    ? [
        ...(invoiceKind
          ? [{ key: "invoice", title: "Invoice Upload", note: "AI reads and checks the invoice", done: Boolean(shownInvoice) }]
          : []),
        {
          key: "request",
          title: invoiceKind ? "Review & Submit" : sheet.title,
          note: invoiceKind ? "Confirm the extracted details" : sheet.note,
          done: Boolean(open),
          disabled: invoiceKind && !shownInvoice,
        },
        {
          key: "decision",
          title: sheet.decisionTitle,
          note: "Review and approve",
          done: awaiting || settled || refused,
          disabled: !open,
        },
        {
          key: "finance",
          title: "Financial Department Actions",
          note: "Disbursement and transfer",
          done: settled,
          disabled: !open || !(awaiting || settled),
        },
      ]
    : [];

  const form = (
    <div className="space-y-6">
      {sheet ? (
        <>
          {/* The request's head: what it is, then whose it is, when it was
              asked and its number - the close button beyond them. */}
          <div className="flex flex-wrap items-start gap-4 pe-16">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary"
            >
              <sheet.icon className="size-7" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-2xl font-bold text-primary">{sheet.title}</DialogTitle>
              <DialogDescription className="text-sm text-primary/75">
                {stage === "invoice"
                  ? "Upload the invoice - the AI reads it and fills in the request."
                  : stage === "decision"
                    ? "Review the request and record your decision."
                    : stage === "finance"
                      ? "Review the management decision and process the payment."
                      : sheet.intro}
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
              {stage === "finance" ? (
                <PayeeFacts employee={employee} />
              ) : (
                <>
                  <span>{longDate(draft.requestDate)}</span>
                  <span aria-hidden="true" className="h-5 w-px bg-container-border" />
                  <span className="rounded-md bg-primary/10 px-3 py-1.5 text-base font-bold text-primary">
                    {shortRequestNo(requestNo, draft.requestDate)}
                  </span>
                </>
              )}
            </div>
            <DialogClose className="absolute end-5 top-5 rounded-md p-1 text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-7" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>

          <AdvanceSteps active={stage} onChange={setStage} steps={sheetSteps} />
        </>
      ) : (
      <RequestSteps
        active={stage}
        onChange={setStage}
        steps={[
          {
            key: "request",
            title: label + " Request",
            note: assisting
              ? canSubmit
                ? "Assistance details and supporting document completed"
                : "Enter assistance details and supporting document"
              : canSubmit
                ? label + " details completed"
                : "Enter " + label.toLowerCase() + " details",
            done: Boolean(canSubmit),
          },
          {
            key: "decision",
            title: "Management Decision",
            note: "Review, approve and disburse",
            done: Boolean(decision),
            disabled: !canSubmit,
          },
        ]}
      />
      )}

      {stage === "invoice" && sheet ? (
        <InvoiceIntake
          invoice={shownInvoice}
          risk={risk}
          analyzing={analyzing}
          onPick={pickInvoice}
          onClear={open ? undefined : () => setInvoice(null)}
        />
      ) : stage === "decision" && assisting ? (
        assistanceDecision
      ) : stage === "decision" || stage === "finance" ? (
        <>
          {/* What the invoice says and what the AI found, before anything is
              decided - a duplicate or a repeated claim is read first. */}
          {stage === "decision" && shownInvoice && (
            <InvoiceAnalysis invoice={shownInvoice} risk={risk} title="Invoice Analysis" />
          )}

          {/* What the financial department pays out against, on one row. */}
          {stage === "finance" && (
            <section className="space-y-3 rounded-xl border bg-blue-50/30 p-4 sm:p-5">
              <h3 className={HEADING}>Request Summary</h3>
              <dl className="grid gap-4 rounded-lg bg-white px-4 py-3 *:min-w-0 sm:grid-cols-2 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:gap-x-0 lg:divide-x lg:divide-container-border lg:[&>*:not(:first-child)]:ps-6 lg:[&>*:not(:last-child)]:pe-6">
                <div className="flex flex-col gap-1">
                  <dt className="whitespace-nowrap text-sm text-primary">Requested Amount</dt>
                  <dd className="mt-auto whitespace-nowrap text-xl font-bold text-red-600">
                    {amountValue(amount)} <span className="text-sm font-normal text-primary/75">OMR</span>
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="whitespace-nowrap text-sm text-primary">Approved Amount</dt>
                  <dd className="mt-auto w-fit whitespace-nowrap rounded-md bg-green-50 px-3 py-1 text-xl font-bold text-green-700">
                    {amountValue(approvedAmount)} <span className="text-sm font-normal text-primary/75">OMR</span>
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-sm text-primary">Management Comment</dt>
                  <dd className="mt-auto rounded-md border bg-blue-50/40 px-3 py-2 text-sm text-primary">
                    {reason || open?.managementComment || "No comment."}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="whitespace-nowrap text-sm text-primary">Decision Date</dt>
                  <dd className="mt-auto whitespace-nowrap pt-1 text-base font-bold text-primary">
                    {formatDate(decidedOn)}
                  </dd>
                </div>
              </dl>
            </section>
          )}
          {/* The request is not read back here. What it was for is on
              the stage behind this one, and the four facts a decision
              actually needs - who, when, what kind, which account - are
              on the card at the foot of the page. Saying them twice on
              one screen is what the drawing takes out. */}

          {/* Each answer says what it does, in the name of the thing being
              decided - "approve the leave encashment", not "approve" - so the
              three cards cannot be told apart only by their colour. Built
              from the tab's own label rather than written out nine times. */}
          {stage === "decision" && (
          <>
          <DecisionChoice
            value={decision}
            onChange={setDecision}
            disabled={!canDecide || settled || refused || awaiting}
            offers={["full", "partial", "completion", "rejected"]}
            notes={
              mode === "hours"
                ? {
                    full: "Approve the overtime request as submitted",
                    partial: "Approve adjusted overtime hours or amount",
                    completion: "Return for missing information or documents",
                    rejected: "Reject the overtime request",
                  }
                : {
                    full: "Approve the " + label.toLowerCase() + " as requested",
                    partial:
                      namesAmount && kind !== "notice"
                        ? "Approve an adjusted allowance amount"
                        : "Approve a portion of the " + label.toLowerCase(),
                    completion: "Return for missing information or documents",
                    rejected: "Reject the " + label.toLowerCase() + " request",
                  }
            }
          >
            {medicalLayout && decisionFields}
          </DecisionChoice>
          {/* A partial approval names what it grants, beside the answer. */}
          {!medicalLayout && amending && <div className="form-grid">{grantField}</div>}
          </>
          )}


          {/* Where the case stands now. Only a trip made for a case has a
              file to bring up to date, and only an approved one gets it. */}
          {courtLinked && stage === "finance" && (
            <div className="space-y-4">
              <h3 className={HEADING}>File Update</h3>
              <div className="form-grid">
                <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                  <FieldLabel htmlFor="ent-update-date">Update Date</FieldLabel>
                  <DateField
                    required
                    id="ent-update-date"
                    value={payment.updateDate}
                    onChange={(e) => setPay("updateDate", e.target.value)}
                    disabled={settled}
                  />
                </div>
                <div className="form-field span-9 flex h-full flex-col justify-end gap-2">
                  <FieldLabel htmlFor="ent-update">Update</FieldLabel>
                  <Textarea
                    required
                    id="ent-update"
                    rows={1}
                    maxLength={NOTES_LIMIT}
                    value={payment.updateText}
                    onChange={(e) => setPay("updateText", e.target.value)}
                    disabled={settled}
                    placeholder="Enter the update on the file"
                    className="min-h-9 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* What an approval settles, in the one order every request in the
              system settles it in: where it is booked and when it goes, then
              how much goes and by what route. No heading over it - it is what
              the answer above it carries out. */}
          {stage === "finance" && (
            <div className="space-y-4 sm:space-y-6">
              <h3 className={HEADING}>Financial Department Actions</h3>
              <div className="form-grid">
                <Settled
                  id="ent-type"
                  label="Expense Type"
                  value={ENTITLEMENT_EXPENSE_TYPE}
                />
                <Settled id="ent-category" label="Category" value={category} />
                <Settled
                  id="ent-subcategory"
                  label="Subcategory"
                  value={subcategory}
                />

                <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                  <FieldLabel htmlFor="ent-payment-date" required>
                    Payment Date
                  </FieldLabel>
                  <DateField
                    id="ent-payment-date"
                    value={payment.paymentDate}
                    onChange={(e) => setPay("paymentDate", e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid">
                {/* What was granted, as management decided it - read here,
                    not changed: the financial department pays it. */}
                <Settled
                  id="ent-approved"
                  label="Approved Amount (OMR)"
                  value={amountValue(approvedAmount)}
                  payable
                />

                <Choice
                  id="ent-method"
                  label="Payment Method"
                  value={payment.method}
                  onChange={(value) => value && setPay("method", value)}
                  placeholder="Select method"
                  options={PAYMENT_METHODS}
                />

                {/* One choice, not two: the account carries the bank it is
                    held at, so they cannot be set to disagree. */}
                <Choice
                  id="ent-bank"
                  label="Bank Account"
                  value={payment.bankAccount}
                  onChange={(value) => value && setPay("bankAccount", value)}
                  placeholder="Select bank account"
                  options={PAYING_ACCOUNTS}
                />

                {/* The proof of the transfer sits beside its number as a
                    plain icon: nothing to press but the paperclip itself. */}
                <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                  <FieldLabel htmlFor="ent-reference" required>
                    Transfer No.
                  </FieldLabel>
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <Input
                      id="ent-reference"
                      className="min-w-0 flex-1"
                      value={payment.reference}
                      onChange={(e) => setPay("reference", e.target.value)}
                      placeholder="TRX-0000-00000"
                    />
                    <label
                      className="shrink-0 cursor-pointer text-primary hover:text-primary/70"
                      title={
                        receipt ? receipt.name + " attached" : "Upload transfer receipt"
                      }
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
                        onChange={(e) =>
                          e.target.files[0] && setReceipt(e.target.files[0])
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Directly below what the approval settles, and never required:
              a decision is made by the answer above it, and holding one back
              for want of a sentence only stops the work. */}
          {stage === "decision" && decision && !medicalLayout && (
            <div className="relative space-y-2 pb-5">
              <FieldLabel htmlFor="ent-comment">
                {returning
                  ? "What is Missing"
                  : refusing
                    ? "Reason for Rejection"
                    : "Management Comment"}
              </FieldLabel>
              <Textarea
                id="ent-comment"
                rows={3}
                maxLength={NOTES_LIMIT}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={!canDecide || settled || refused || awaiting}
                placeholder={
                  returning
                    ? "Say what the employee still has to supply"
                    : refusing
                      ? "Say why this request is refused"
                      : "Enter management comment"
                }
              />
              <p className="absolute bottom-0 end-0 text-xs text-muted-foreground">
                {reason.length} / {NOTES_LIMIT}
              </p>
            </div>
          )}

          {/* Everything about the request itself, in one line under the
              decision it belongs to - wearing the colour of that decision,
              so the answer is read before a word of it. */}
          <div
            className={cn(
              "rounded-lg border p-4",
              decision === "full" && "border-green-600/50 bg-decision-full",
              decision === "partial" &&
                "border-decision-partial-ink bg-decision-partial",
              returning && "border-frame-alt/50 bg-decision-partial/40",
              decision === "rejected" && "border-red-500/50 bg-decision-rejected",
              !decision && "bg-card"
            )}
          >
            {kind === "notice" && (
              <h3 className={cn(HEADING, "mb-3")}>{label} Request Summary</h3>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:[&>*+*]:border-s">
              {namesAmount && (
                <Fact icon={FileText} label="Request No.">
                  {requestNo}
                </Fact>
              )}
              {courtLinked ? (
                <Fact icon={FileText} label="File No.">
                  {draft.fileNo || "-"}
                </Fact>
              ) : (
                <Fact icon={CalendarDays} label="Request Date">
                  {draft.requestDate ? formatDate(draft.requestDate) : "-"}
                  {attachedName && (
                    <span className="mt-0.5 block text-primary">{attachedName}</span>
                  )}
                </Fact>
              )}
              {namesAmount ? null : mode === "hours" ? (
                <Fact icon={CalendarDays} label="Month">
                  {monthName ? monthName + " " + draft.year : "-"}
                </Fact>
              ) : (
                <Fact icon={FileText} label="Request Type">
                  {label}
                </Fact>
              )}
              <Fact icon={User} label={kind === "notice" ? "Employee" : "Employee Name"}>
                {whose}
              </Fact>
              {courtLinked && (
                <Fact icon={CalendarDays} label="Travel Date">
                  {draft.travelDate ? formatDate(draft.travelDate) : "-"}
                </Fact>
              )}
              {mode === "hours" && (
                <Fact icon={Clock} label="Approved Hours">
                  {approvedHours ? approvedHours + " Hours" : "-"}
                </Fact>
              )}

              {/* Where the money lands, and what it comes to. Both belong on
                  every card: a decision is checked against the account it
                  will leave for and the figure it will carry. */}
              <Fact icon={Landmark} label="Bank Name & Account Number">
                {employee?.bankName
                  ? employee.bankName + " - " + employee.accountNumber
                  : "-"}
              </Fact>
              <Fact icon={Banknote} label="Total Amount">
                {amountValue(decision ? approvedAmount : amount) + " OMR"}
              </Fact>
              <Fact icon={History} label="History">
                <RecordLink onClick={() => setShowHistory(true)}>
                  View history
                  </RecordLink>
              </Fact>
            </div>

            {/* What this person was given last time, where there was a last
                time: the one comparison every decision wants. */}
            {previous && (
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                Last Similar Request:{" "}
                <span className="text-primary">
                  {label} &middot; {previous.entitlementNo || previous.requestNo}{" "}
                  &middot; Paid {formatDate(previous.paymentDate)}
                </span>
              </p>
            )}
          </div>
        </>
      ) : kind === "leaveEncashment" ? (
        <section className="space-y-4 rounded-xl border p-4 sm:p-5">
          <h3 className={HEADING}>Leave Request Details</h3>
          <div className="grid items-start gap-4 md:grid-cols-2">
            <div>
              <Field id="ent-year" label="Year" required>
                <Select value={draft.year} onValueChange={(value) => value && set("year", value)}>
                  <SelectTrigger id="ent-year">
                    {/* Beside the chevron rather than wrapped with the value:
                        the trigger clamps its first span to one line, which
                        would cut the year short to make room for the icon. */}
                    <SelectValue placeholder="Select year" />
                    <CalendarDays className="ms-auto me-2 size-4 shrink-0 text-primary" aria-hidden="true" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* A balance is drawn on this year or the next, never a
                        year already closed. */}
                    {PAYMENT_YEARS.filter((year) => Number(year) >= new Date().getFullYear()).map(
                      (year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div>
              <Field id="ent-leave-type" label="Leave Type" required>
                <Select
                  value={draft.leaveType}
                  onValueChange={(value) => value && set("leaveType", value)}
                >
                  <SelectTrigger id="ent-leave-type">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENCASHABLE_LEAVE.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {/* How many days are cashed in, against what the balance holds -
              asked once the year and the type say which balance it is. */}
          {draft.year && draft.leaveType && (
            <div className="form-grid">
              <Booked
                id="ent-available"
                label="Available Leave Balance"
                value={balance ? available + " Days" : "-"}
              />
              <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                <FieldLabel htmlFor="ent-days" required>
                  Days Requested for Encashment
                </FieldLabel>
                <Input
                  required
                  id="ent-days"
                  inputMode="numeric"
                  value={draft.days}
                  onChange={(e) => set("days", e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className={cn(exceeded && "border-destructive text-destructive")}
                />
                {exceeded && (
                  <p role="alert" className="text-xs font-semibold text-destructive">
                    More days than the balance holds
                  </p>
                )}
              </div>
              <Booked
                id="ent-after"
                label="Balance After Request"
                value={balance ? after + " Days" : "-"}
              />
              <Worked
                id="ent-estimated"
                label="Estimated Amount (OMR)"
                value={amountValue(amount)}
              />
            </div>
          )}
        </section>
      ) : overtiming ? (
        <section className="space-y-4 rounded-xl border p-4 sm:p-5">
          <h3 className={HEADING}>Overtime Details</h3>
          <div className="grid items-start gap-4 md:grid-cols-2">
            <div>
              <Field id="ent-month" label="Period" required>
                <MonthPicker
                  id="ent-month"
                  month={draft.month}
                  year={draft.year}
                  months={SALARY_MONTHS}
                  onChange={({ month, year }) =>
                    setDraft((prev) => ({ ...prev, month, year }))
                  }
                />
              </Field>
            </div>
            <div>
              <Field id="ent-hours" label="Overtime Hours" required>
                <div className="relative">
                  <Input
                    required
                    id="ent-hours"
                    inputMode="decimal"
                    className="pe-16"
                    value={draft.hours}
                    onChange={(e) =>
                      set("hours", e.target.value.replace(/[^\d.]/g, ""))
                    }
                    placeholder="Enter total overtime hours"
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Hours
                  </span>
                </div>
              </Field>
            </div>
          </div>
        </section>
      ) : sheet?.shared ? (
        <>
        {/* Made on an invoice: what the AI read, to be checked and
            confirmed - nothing is typed again. */}
        {invoiceKind && shownInvoice && (
          <InvoiceAnalysis invoice={shownInvoice} risk={risk} title="Review the extracted details" />
        )}
        <SheetCard title={label + " Request Details"}>
          {/* General or for a case. The choice decides what else is asked,
              so it comes first and the fields follow it. */}
          {kind === "transport" && (
            <div
              role="radiogroup"
              aria-label="Kind of transport"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {[
                { value: TRANSPORT_GENERAL, title: "General" },
                { value: TRANSPORT_COURT, title: "Court-Linked" },
              ].map((option) => {
                const picked = draft.transportType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={picked}
                    onClick={() => set("transportType", option.value)}
                    className={cn(
                      "flex items-center gap-3 rounded-field border px-4 py-3 text-start font-medium transition-colors",
                      picked
                        ? "border-primary bg-secondary text-primary"
                        : "border-field-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                        picked ? "border-primary" : "border-muted-foreground/50"
                      )}
                    >
                      {picked && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </span>
                    {option.title}
                  </button>
                );
              })}
            </div>
          )}

          {/* Each field sits in a cell of its own - the form's fields bring
              their twelve-column spans, which mean nothing outside that grid. */}
          <div className="grid items-start gap-4 md:grid-cols-3">
            {ownDate && !invoiceKind && (
              <div>
                <Field id="ent-request-date" label="Request Date" required>
                  <DateField
                    required
                    id="ent-request-date"
                    value={draft.requestDate}
                    max={todayIso()}
                    onChange={(e) => set("requestDate", e.target.value)}
                  />
                </Field>
              </div>
            )}
            {courtLinked && (
              <>
                <div>
                  <Field id="ent-file-no" label="File No." required>
                    <Input
                      required
                      id="ent-file-no"
                      value={draft.fileNo}
                      onChange={(e) => set("fileNo", e.target.value)}
                      placeholder="Enter the case file number"
                    />
                  </Field>
                </div>
                <div>
                  <Field id="ent-travel-date" label="Travel Date" required>
                    <DateField
                      required
                      id="ent-travel-date"
                      value={draft.travelDate}
                      max={todayIso()}
                      onChange={(e) => set("travelDate", e.target.value)}
                    />
                  </Field>
                </div>
              </>
            )}
            {invoiceKind && shownInvoice ? (
              <>
                {/* A medical claim is what insurance did not pay. */}
                {kind === "medical" && (
                  <div>
                    <Field id="ent-insurance" label="Insurance Covered Amount (OMR)">
                      <Input
                        id="ent-insurance"
                        inputMode="decimal"
                        value={draft.insurance}
                        onChange={(e) => set("insurance", e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder="0.000"
                        disabled={Boolean(open)}
                      />
                    </Field>
                  </div>
                )}
                <div>
                  <Field id="ent-amount" label="Requested Amount (OMR)">
                    <Input
                      id="ent-amount"
                      readOnly
                      tabIndex={-1}
                      value={amountValue(amount)}
                      className="cursor-default bg-locked font-semibold text-primary"
                    />
                  </Field>
                </div>
              </>
            ) : (
            <div>
              <Field id="ent-amount" label="Requested Amount (OMR)" required>
                <div className="flex items-end gap-3">
                  <div className="relative min-w-0 flex-1">
                    <Input
                      required
                      id="ent-amount"
                      inputMode="decimal"
                      className="pe-14"
                      value={draft.amount}
                      onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="0.000"
                    />
                    <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      OMR
                    </span>
                  </div>
                  {/* The paper behind the claim, beside the sum it backs. */}
                  <UploadButton file={receipt} onPick={setReceipt} />
                </div>
              </Field>
            </div>
            )}
          </div>
          {(receipt || attachedName) && (
            <p className="flex items-center gap-1.5 text-sm text-primary">
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              {receipt?.name || attachedName}
            </p>
          )}

          <Field
            id="ent-reason-notes"
            label={reasonRequired ? "Employee Comment" : "Employee Comment (Optional)"}
            required={reasonRequired}
          >
            <Textarea
              id="ent-reason-notes"
              maxLength={notesLimit}
              value={draft.reason}
              onChange={(e) => set("reason", e.target.value)}
              required={reasonRequired}
              placeholder={"Enter the reason for this " + label.toLowerCase() + " request..."}
            />
            <p className="-mt-1 text-end text-xs text-muted-foreground">
              {draft.reason.length}/{notesLimit}
            </p>
          </Field>

          {/* The employee says the reading is right before it is sent. */}
          {invoiceKind && !open && (
            <label className="flex items-start gap-3 rounded-lg border bg-blue-50/40 px-4 py-3 text-sm text-primary">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--primary)]"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I have reviewed the details read from the invoice and confirm they are accurate.
            </label>
          )}
        </SheetCard>
        </>
      ) : (
        <>
          {/* Who is asking, and under what number. None of it is asked for:
              the request is being written on this person's own record, on the
              day it is being written. Where it is booked is not here either -
              that belongs beside the payment it governs, on the stage that
              makes one. */}
          <div className="space-y-4">
            <h3 className={HEADING}>
              Request Information
            </h3>
            <div className="form-grid">
              {/* The paper the request is made on hangs off its number. */}
              <Field id="ent-request-no" label="Request No.">
                <div className="relative flex w-full min-w-0 items-center gap-2">
                  <Input
                    id="ent-request-no"
                    readOnly
                    tabIndex={-1}
                    value={requestNo}
                    className="min-w-0 flex-1 cursor-default"
                  />
                  {kind !== "transport" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        asChild
                        title={
                          receipt ? receipt.name + " attached" : "Upload a supporting document"
                        }
                        className={cn(
                          "shrink-0",
                          receipt && "border-green-600 text-green-600"
                        )}
                      >
                        <label htmlFor="ent-request-file" className="cursor-pointer">
                          {receipt ? (
                            <FileCheck className="h-4 w-4" />
                          ) : (
                            <UploadIcon className="h-4 w-4" />
                          )}
                          <span className="sr-only">Upload a supporting document</span>
                        </label>
                      </Button>
                      <Input
                        id="ent-request-file"
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files[0] && setReceipt(e.target.files[0])}
                      />
                    </>
                  )}
                  {/* Hung below the box, so the row's boxes stay in line. */}
                  {assisting && (receipt || attachedName) && (
                    <p className="absolute start-0 top-full mt-1 text-xs text-record-link">
                      {receipt?.name || attachedName}
                    </p>
                  )}
                </div>
              </Field>
              {ownDate ? (
                <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                  <FieldLabel htmlFor="ent-request-date">Request Date</FieldLabel>
                  <DateField
                    required
                    id="ent-request-date"
                    value={draft.requestDate}
                    max={todayIso()}
                    onChange={(e) => set("requestDate", e.target.value)}
                  />
                </div>
              ) : (
                <Booked
                  id="ent-request-date"
                  label="Request Date"
                  value={formatDate(draft.requestDate)}
                />
              )}
              {!assisting && (
                <Booked id="ent-employee" label="Employee Name" value={whose} />
              )}

              {assisting && (
                <div
                  data-required="true"
                  className="form-field span-3 flex h-full flex-col justify-end gap-2"
                >
                  <FieldLabel htmlFor="ent-assistance-type">Assistance Type</FieldLabel>
                  <Select
                    value={draft.assistanceType}
                    onValueChange={(value) => value && set("assistanceType", value)}
                  >
                    <SelectTrigger id="ent-assistance-type">
                      <SelectValue placeholder="Select assistance type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSISTANCE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Which year the request belongs to: the balance being drawn
                  on, or the month the overtime was worked in. */}
              {(mode === "leaveDays" || mode === "hours") && (
                <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                  <FieldLabel htmlFor="ent-year" required>
                    Year
                  </FieldLabel>
                  <Select
                    value={draft.year}
                    onValueChange={(value) => value && set("year", value)}
                  >
                    <SelectTrigger id="ent-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_YEARS.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            {/* Days off a leave balance. */}
            {mode === "leaveDays" && (
              <>
                {/* Not a choice: only annual leave is encashable. Sick leave
                    is there to be taken and unpaid leave is worth nothing, so
                    offering either would be offering a mistake. */}
                <Booked
                  id="ent-available"
                  label="Available Leave Balance"
                  value={balance ? available + " Days" : "-"}
                />

                <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                  <FieldLabel htmlFor="ent-days" required>
                    Days Requested for Encashment
                  </FieldLabel>
                  <Input
                    id="ent-days"
                    inputMode="numeric"
                    value={draft.days}
                    onChange={(e) => set("days", e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    className={cn(exceeded && "border-destructive text-destructive")}
                  />
                  {exceeded && (
                    <p role="alert" className="text-xs font-semibold text-destructive">
                      More days than the balance holds
                    </p>
                  )}
                </div>

                <Booked
                  id="ent-after"
                  label="Balance After Request"
                  value={balance ? after + " Days" : "-"}
                />
              </>
            )}

            {/* A month's overtime, at the employee's ordinary hourly rate.
                The rate is read off the salary, never typed, so the amount
                below cannot disagree with the pay it is worked out from. */}
            {mode === "hours" && (
              <>
                <div
                  data-required="true"
                  className="form-field span-3 flex h-full flex-col justify-end gap-2"
                >
                  <FieldLabel htmlFor="ent-month">Month</FieldLabel>
                  <Select
                    value={draft.month}
                    onValueChange={(value) => value && set("month", value)}
                  >
                    <SelectTrigger id="ent-month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {SALARY_MONTHS.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                  <FieldLabel htmlFor="ent-hours">Overtime Hours</FieldLabel>
                  <Input
                    required
                    id="ent-hours"
                    inputMode="decimal"
                    value={draft.hours}
                    onChange={(e) =>
                      set("hours", e.target.value.replace(/[^\d.]/g, ""))
                    }
                    placeholder="0"
                  />
                </div>

                <Booked
                  id="ent-rate"
                  label="Hourly Rate (OMR)"
                  value={amountValue(hourlyRate(employee?.salary))}
                />
              </>
            )}

            {/* A sum the employee names. Transport asks for it in its own
                section, under the choice of what kind of trip it was. */}
            {mode === "amount" && kind !== "transport" && (
              <div className="form-field span-3 flex h-full flex-col justify-end gap-2">
                <FieldLabel htmlFor="ent-amount">
                  {assisting ? "Requested Amount" : "Requested Amount (OMR)"}
                </FieldLabel>
                <div className="relative">
                  <Input
                    required
                    id="ent-amount"
                    inputMode="decimal"
                    value={draft.amount}
                    onChange={(e) =>
                      set("amount", e.target.value.replace(/[^\d.]/g, ""))
                    }
                    placeholder="0.000"
                    className={cn(assisting && "pe-14")}
                  />
                  {assisting && (
                    <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      OMR
                    </span>
                  )}
                </div>
              </div>
            )}

            {mode !== "amount" && (
              <Worked
                id="ent-estimated"
                label="Estimated Amount (OMR)"
                value={amountValue(amount)}
              />
            )}
            </div>
          </div>

          {kind === "transport" && (
            <div className="space-y-4">
              <h3 className={HEADING}>{label} Details</h3>

              {/* General or for a case. The choice decides what else is
                  asked, so it comes first and the fields follow it. */}
              <div
                role="radiogroup"
                aria-label="Kind of transport"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {[
                  { value: TRANSPORT_GENERAL, title: "General" },
                  { value: TRANSPORT_COURT, title: "Court-Linked" },
                ].map((option) => {
                  const picked = draft.transportType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={picked}
                      onClick={() => set("transportType", option.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-field border px-4 py-3 text-start font-medium transition-colors",
                        picked
                          ? "border-primary bg-secondary text-primary"
                          : "border-field-border hover:bg-muted/50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                          picked ? "border-primary" : "border-muted-foreground/50"
                        )}
                      >
                        {picked && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                      </span>
                      {option.title}
                    </button>
                  );
                })}
              </div>
              <p className="helper-text">
                When General is selected, only Requested Amount is shown.
              </p>

              <div className="form-grid form-grid-3">
                {courtLinked && (
                  <>
                    <div className="form-field flex h-full flex-col justify-end gap-2">
                      <FieldLabel htmlFor="ent-file-no">File No.</FieldLabel>
                      <Input
                        required
                        id="ent-file-no"
                        value={draft.fileNo}
                        onChange={(e) => set("fileNo", e.target.value)}
                        placeholder="Enter the case file number"
                      />
                    </div>
                    <div className="form-field flex h-full flex-col justify-end gap-2">
                      <FieldLabel htmlFor="ent-travel-date">Travel Date</FieldLabel>
                      <DateField
                        required
                        id="ent-travel-date"
                        value={draft.travelDate}
                        max={todayIso()}
                        onChange={(e) => set("travelDate", e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="form-field flex h-full flex-col justify-end gap-2">
                  <FieldLabel htmlFor="ent-amount">Requested Amount (OMR)</FieldLabel>
                  <Input
                    required
                    id="ent-amount"
                    inputMode="decimal"
                    value={draft.amount}
                    onChange={(e) =>
                      set("amount", e.target.value.replace(/[^\d.]/g, ""))
                    }
                    placeholder="0.000"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {kind === "travel" || kind === "airTicket" || kind === "notice" ? (
              <FieldLabel htmlFor="ent-reason-notes">Reason / Notes</FieldLabel>
            ) : (
            <h3 className={HEADING}>
              {assisting
                ? "Request Details"
                : kind === "transport"
                  ? "Employee Comment"
                  : "Reason / Notes"}
            </h3>
            )}
            {assisting && (
              <FieldLabel htmlFor="ent-reason-notes">Employee Comment</FieldLabel>
            )}
            <Textarea
              id="ent-reason-notes"
              rows={3}
              maxLength={notesLimit}
              value={draft.reason}
              onChange={(e) => set("reason", e.target.value)}
              required={reasonRequired}
              placeholder={
                assisting
                  ? "Describe what the assistance is for"
                  : kind === "transport"
                  ? "Add details of the transport allowance request (optional)"
                  : "Enter the reason for requesting " + label.toLowerCase()
              }
            />
            <p className="text-end text-xs text-muted-foreground">
              {draft.reason.length} / {notesLimit}
            </p>
          </div>
        </>
      )}

      {/* Assistance keeps its history at the foot of both stages, beside a
          plain Cancel and Save. */}
      {sheet && stage === "invoice" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <HistoryCard onClick={() => setShowHistory(true)} />
          <div className="ms-auto flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="min-w-36" onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              className="min-w-48"
              disabled={!shownInvoice || analyzing}
              onClick={() => setStage("request")}
            >
              Continue to Review
            </Button>
          </div>
        </div>
      ) : sheet && stage === "request" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
          {sheet.shared && <HistoryCard onClick={() => setShowHistory(true)} />}
          <div className="ms-auto flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="min-w-36" onClick={close}>
              Cancel
            </Button>
            <Button type="button" className="min-w-48" onClick={submit}>
              Submit Request
            </Button>
          </div>
        </div>
      ) : assisting ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-6">
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 rounded font-medium text-primary hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <History className="h-5 w-5" />
            History
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            {stage !== "decision" ? (
              <Button type="button" onClick={submit}>
                <Save className="me-2 h-4 w-4" />
                Save
              </Button>
            ) : (
              !settled &&
              !refused && (
                <Button
                  type="button"
                  variant={refusing ? "destructive" : "default"}
                  onClick={refusing ? reject : disburse}
                  disabled={!decision || (refusing && !reason.trim())}
                >
                  <Save className="me-2 h-4 w-4" />
                  Save
                </Button>
              )
            )}
          </div>
        </div>
      ) : (
      // Management decides, then the financial department pays: each stage
      // has its own button, and nothing on it once its part is done.
      <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <HistoryCard onClick={() => setShowHistory(true)} />
        <div className="ms-auto flex flex-wrap gap-3">
          <Button type="button" variant="outline" className="min-w-36" onClick={close}>
            Cancel
          </Button>
          {stage === "decision" &&
            canDecide &&
            !settled &&
            !refused &&
            !awaiting &&
            (refusing ? (
              <Button
                type="button"
                variant={returning ? "outline" : "destructive"}
                className={cn(
                  "min-w-48",
                  returning && "border-frame-alt text-frame-alt hover:bg-decision-partial/40"
                )}
                onClick={reject}
                disabled={!reason.trim()}
              >
                {returning ? "Return to Employee" : "Confirm Rejection"}
              </Button>
            ) : (
              <Button
                type="button"
                className="min-w-48"
                onClick={confirmDecision}
                disabled={!decision || !grantIsSound}
              >
                Confirm Decision
              </Button>
            ))}
          {stage === "finance" && canDecide && !settled && (
            <Button type="button" className="min-w-48" onClick={disburse} disabled={!canDisburse}>
              <Send className="me-2 size-4" aria-hidden="true" />
              Process Payment
            </Button>
          )}
        </div>
      </div>
      )}
    </div>
  );

  return (
    <>
      {/* Opened over the page, so the list it is filed into stays behind. */}
      <Dialog open={Boolean(adding)} onOpenChange={(o) => !o && close()}>
        <DialogContent
          hideClose={Boolean(sheet)}
          className="max-h-[90vh] w-[95vw] max-w-[1700px] overflow-y-auto"
        >
          {!sheet && (
            <DialogHeader>
              <DialogTitle>
                {(assisting || kind === "notice") && stage === "decision"
                  ? label + " Management Decision"
                  : label + " Request"}
              </DialogTitle>
            </DialogHeader>
          )}
          {form}
        </DialogContent>
      </Dialog>

      {/* What has already happened to this request, newest first. Nothing
          here is kept twice: every line is read off the record itself. */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-h-[85vh] w-[92vw] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {sheet?.shared && !open
                ? label + " History · " + (employee?.name || "")
                : "History - " + (open?.entitlementNo || open?.requestNo || label)}
            </DialogTitle>
          </DialogHeader>

          {sheet?.shared && !open ? null : entitlementHistory(open).length === 0 ? (
            <EmptyState>Nothing has happened to this request yet.</EmptyState>
          ) : (
            <RecordTable minWidth={980}>
              <HeadRow>
                <Th width="14%">Date &amp; Time</Th>
                <Th width="14%">Action</Th>
                <Th width="11%">Previous Status</Th>
                <Th width="11%">New Status</Th>
                <Th width="14%">Performed By</Th>
                <Th width="10%" className="text-end">
                  Amount
                </Th>
                <Th width="16%">Comment</Th>
                <Th width="10%">Reference</Th>
              </HeadRow>
              <tbody>
                {entitlementHistory(open).map((event, index) => (
                  <Row key={index}>
                    <Td className="whitespace-nowrap text-primary">
                      {formatDate(event.at)}
                    </Td>
                    <Td className="text-primary">{event.action}</Td>
                    <Td className="text-muted-foreground">{event.from}</Td>
                    <Td className="text-primary">{event.to}</Td>
                    <Td className="text-primary">{event.by}</Td>
                    <Td className="whitespace-nowrap text-end font-semibold text-green-700">
                      {amountValue(event.amount)}
                    </Td>
                    <Td className="text-start text-muted-foreground">
                      {event.comment || "-"}
                    </Td>
                    <Td className="text-primary">{event.reference || "-"}</Td>
                  </Row>
                ))}
              </tbody>
            </RecordTable>
          )}

          {/* What this employee has asked for of this kind before. */}
          {sheet?.shared && (
            <RequestTable
              rows={mine}
              columns={columns}
              searchPlaceholder={"Search " + label.toLowerCase() + " requests..."}
              itemLabel={label.toLowerCase() + " requests"}
              exportFileName={kind + ".csv"}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* What has been asked for, a reading of it, and the way to ask -
          over the list itself. */}
      <RequestOverview
        icon={sheet?.icon || FileText}
        title={label}
        subtitle={"Request " + label.toLowerCase() + " and track your requests."}
        noun={label.toLowerCase() + " request"}
        newLabel={"New " + label + " Request"}
        onNew={addLabel && !adding ? onOpenAdd : null}
        money
        typeLabel="Request Type"
        rows={mine.map((record) => ({
          id: record.id,
          no: record.no,
          date: record.requestDate,
          amount: record.amount,
          status: record.status,
          type: record.detail,
          record,
        }))}
        onOpen={adding ? null : track}
        // Only a request asked for as a sum can be started at the suggested
        // one: days and hours are what overtime and encashment are asked in.
        onApply={
          mode === "amount" && addLabel && !adding
            ? (suggested) => {
                setDraft({ ...emptyDraft(kind), amount: String(suggested) });
                onOpenAdd?.();
              }
            : null
        }
        renderAll={() => (
          <RequestTable
            rows={mine}
            columns={columns}
            searchPlaceholder={"Search " + label.toLowerCase() + " requests..."}
            itemLabel={label.toLowerCase() + " requests"}
            exportFileName={kind + ".csv"}
          />
        )}
      />

      <RequestTable
        rows={mine}
        columns={columns}
        searchPlaceholder={"Search " + label.toLowerCase() + " requests..."}
        itemLabel={label.toLowerCase() + " requests"}
        exportFileName={kind + ".csv"}
      />
    </>
  );
}
