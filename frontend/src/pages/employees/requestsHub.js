import {
  CalendarCheck,
  CalendarDays,
  Car,
  ClipboardList,
  Clock,
  Coins,
  FileClock,
  FilePenLine,
  Gift,
  HandHeart,
  Handshake,
  MessageCircleWarning,
  Percent,
  Plane,
  SquarePlus,
  Ticket,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { loanRecords } from "./loanData";
import { assistanceRecords } from "./assistanceData";
import { initialEntitlements, entitlementHistory } from "./entitlementData";
import { initialGeneralRequests } from "./generalRequestData";
import { ENCASHED_PAID, leaveTypeLabel, daysOf } from "./leaveData";
import { commissionRecords } from "@/pages/firm/commissionData";

/**
 * Every request an employee has made, of every kind, as one list.
 *
 * Each kind is still kept by its own module, with its own numbers, limits
 * and approval steps (salary advances, loans, allowances, leave...). This
 * file only reads them side by side, in the five groups the Requests page
 * and the Add Request window both use, and says each one's standing in the
 * same four words.
 */

/** The five groups, in the order the Add Request window shows them. */
export const REQUEST_GROUPS = [
  { key: "financing", label: "Financing", icon: Coins, note: "Choose the request type you want to submit." },
  { key: "entitlements", label: "Entitlements", icon: Gift, note: "Choose the entitlement you want to claim." },
  { key: "allowances", label: "Allowances", icon: Car, note: "Choose the allowance you want to claim." },
  { key: "endOfService", label: "End of Service", icon: Handshake, note: "Choose the end-of-service request." },
  { key: "administrative", label: "Administrative", icon: ClipboardList, note: "Choose the administrative request." },
];

/**
 * Every kind of request, by the key the server's request catalogue uses
 * (RequestCatalog::TYPES), with the group it is shown under.
 *
 * Commission is listed but not offered in Add Request: only management files
 * one, so it is never asked for by the employee.
 */
export const REQUEST_TYPES = {
  salaryAdvance: { label: "Salary Advance", full: "Salary Advance (Payroll Financing)", group: "financing", icon: Wallet, dataset: "salary advances" },
  loan: { label: "Loan", full: "Loan (Installment Financing)", group: "financing", icon: Coins, dataset: "loans" },
  assistance: { label: "Financial Assistance", group: "financing", icon: HandHeart, dataset: "assistance" },
  bonus: { label: "Bonus", group: "entitlements", icon: Gift, dataset: "bonuses" },
  overtime: { label: "Overtime", group: "entitlements", icon: Clock, dataset: "entitlements" },
  leaveEncashment: { label: "Leave Encashment", group: "entitlements", icon: CalendarCheck, dataset: "entitlements" },
  commission: { label: "Commission", group: "entitlements", icon: Percent, dataset: "commissions", noRequest: true },
  medical: { label: "Medical Allowance", group: "allowances", icon: SquarePlus, dataset: "entitlements" },
  transport: { label: "Transportation Allowance", group: "allowances", icon: Car, dataset: "entitlements" },
  travel: { label: "Travel Allowance", group: "allowances", icon: Plane, dataset: "entitlements" },
  airTicket: { label: "Air Ticket Allowance", group: "allowances", icon: Ticket, dataset: "entitlements" },
  notice: { label: "Notice Pay", group: "endOfService", icon: FileClock, dataset: "entitlements" },
  endOfService: { label: "End-of-Service Gratuity", group: "endOfService", icon: Handshake, dataset: "entitlements" },
  leave: { label: "Leave", full: "Leave Request", group: "administrative", icon: CalendarDays, dataset: "leaves" },
  general: { label: "General Request", group: "administrative", icon: FilePenLine, dataset: "general requests" },
  grievance: { label: "Grievance", group: "administrative", icon: MessageCircleWarning, dataset: "general requests" },
  complaint: { label: "Complaint", group: "administrative", icon: TriangleAlert, dataset: "general requests" },
};

/** The kinds of one group that can be asked for in Add Request. */
export const typesIn = (group) =>
  Object.entries(REQUEST_TYPES)
    .filter(([, type]) => type.group === group && !type.noRequest)
    .map(([key, type]) => ({ key, ...type }));

export const groupOf = (type) => REQUEST_TYPES[type]?.group || "administrative";
export const groupLabel = (group) => REQUEST_GROUPS.find((one) => one.key === group)?.label || "";

/** Every dataset the list is read from (see lib/api/modules). */
export const REQUEST_DATASETS = [
  "salary advances",
  "loans",
  "assistance",
  "bonuses",
  "commissions",
  "entitlements",
  "leaves",
  "general requests",
];

/* ---------------------------------------------------------------- status */

export const REQUEST_STATUSES = ["Pending", "Approved", "Rejected", "On Hold"];

/**
 * One standing in four words, whatever the module calls it.
 *
 *   Rejected  <- Rejected, Cancelled, Withdrawn
 *   On Hold   <- Returned (sent back to the employee to complete: their
 *                action is required), and a request kept as Pending with the
 *                decision "completion" - the same return, as the screens of
 *                salary advances and allowances read it
 *   Approved  <- Approved, Partially Approved, Full / Partial Approval (a
 *                loan), Awaiting Payment (approved, the payment still to
 *                come), Paid, Disbursed, Transferred, Encashed
 *   Pending   <- Pending (at any stage: department, management), Submitted,
 *                Under Review, Awaiting Approval - and anything not named
 *
 * Awaiting Payment counts as Approved rather than Pending: management has
 * decided and said yes, and the modules themselves already show an approved
 * but unpaid advance or bonus as Approved. What is still due is said beside
 * the status (the module's own word), so nothing is hidden.
 */
export function normaliseStatus(label, decision) {
  const text = String(label || "").toLowerCase();
  if (/reject|cancel|withdrawn|declin/.test(text)) return "Rejected";
  if (/return|hold|completion/.test(text) || decision === "completion") return "On Hold";
  if (/awaiting payment/.test(text)) return "Approved";
  if (/pending|submitted|review|awaiting|draft|new/.test(text)) return "Pending";
  if (/approv|paid|disburs|transfer|encash|complete|settled/.test(text)) return "Approved";
  return "Pending";
}

/** The pill each of the four words is drawn in. */
export const STATUS_PILL = {
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Rejected: "bg-red-50 text-red-700 ring-red-200",
  "On Hold": "bg-orange-50 text-orange-700 ring-orange-200",
};
export const STATUS_DOT = {
  Pending: "bg-amber-500",
  Approved: "bg-emerald-600",
  Rejected: "bg-red-600",
  "On Hold": "bg-orange-500",
};

/* ----------------------------------------------------------------- words */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-07" (or a full timestamp) -> "07 Nov 2026". */
export function longDate(value) {
  const iso = String(value || "").slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return value ? String(value) : "";
  return `${d} ${MONTHS[Number(m) - 1] || m} ${y}`;
}

/** 300 -> "300.000"; nothing for nothing. */
export const omr = (value) =>
  value === null || value === undefined || value === "" || Number.isNaN(Number(value))
    ? ""
    : Number(value).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** "December", "2026" -> "Dec 2026". */
const monthYear = (month, year) => [String(month || "").slice(0, 3), year].filter(Boolean).join(" ");

const num = (value) => (value === null || value === undefined || value === "" ? null : Number(value));

/* ------------------------------------------------------------------ rows */

/** The dataset each module's records are loaded as (lib/api/modules). */
export const SOURCE_DATASET = {
  advance: "salary advances",
  loan: "loans",
  assistance: "assistance",
  bonus: "bonuses",
  commission: "commissions",
  entitlement: "entitlements",
  leave: "leaves",
  general: "general requests",
};

/**
 * One row of the list from one record. `source` names the module, `type` the
 * catalogue's kind, `detail` the short fact the history tables show beside
 * the amount (the month an advance comes off, the dates of a leave...).
 */
function row(source, record, type, fields) {
  const statusLabel = fields.statusLabel || record.statusLabel || record.status || "Pending";
  return {
    id: source + "-" + record.id,
    source,
    recordId: record.id,
    type,
    typeLabel: REQUEST_TYPES[type]?.label || type,
    group: groupOf(type),
    category: groupLabel(groupOf(type)),
    employeeId: record.employeeId ?? null,
    employee: record.employee || record.paidTo || "",
    status: normaliseStatus(statusLabel, record.decision),
    statusLabel,
    record,
    dataset: SOURCE_DATASET[source],
    ...fields,
  };
}

const fromAdvance = (a) =>
  row("advance", a, "salaryAdvance", {
    number: a.requestNo,
    date: a.requestedOn,
    amount: num(a.approvedAmount ?? a.amount),
    summary: a.purpose === "Other (Please specify)" ? a.reason || "Other" : a.purpose || "",
    detail: monthYear(a.deductMonth, a.deductYear),
    detailLabel: "Deduction Month",
    // The screens read a returned advance as Pending + "completion", and a
    // paid one as Approved; the API's own word is kept in statusLabel.
    statusLabel: a.statusLabel || (a.decision === "completion" ? "Returned" : a.status),
  });

const fromLoan = (l) =>
  row("loan", l, "loan", {
    number: l.requestNo,
    date: l.requestedOn,
    amount: num(l.loanAmount),
    summary: l.employeeComment || (l.monthly ? `${omr(l.monthly)} OMR a month from ${l.startMonth || "–"}` : ""),
    detail: l.monthly ? `${omr(l.monthly)} / month` : "",
    detailLabel: "Installment",
  });

const fromAssistance = (a) =>
  row("assistance", a, "assistance", {
    number: a.requestNo,
    date: a.requestDate,
    amount: num(a.amount),
    summary: [a.subcategory, a.beneficiary && a.beneficiary !== "Employee (Self)" ? a.beneficiary : ""]
      .filter(Boolean)
      .join(" · "),
    detail: a.subcategory || "",
    detailLabel: "Assistance Type",
    statusLabel:
      a.statusLabel ||
      (a.decision === "Approved" ? (a.paymentDate ? "Paid" : "Approved") : a.decision || "Pending"),
  });

const fromBonus = (b) =>
  row("bonus", b, "bonus", {
    number: b.requestNo,
    date: b.recordedOn,
    amount: num(b.approvedAmount ?? b.amount),
    summary: b.subcategory === "Other" ? b.bonusType || "Other" : b.subcategory || "",
    detail: b.subcategory || "",
    detailLabel: "Bonus Type",
  });

const fromCommission = (c) =>
  row("commission", c, "commission", {
    number: c.commissionNo,
    date: c.date,
    amount: num(c.approvedAmount ?? c.amount),
    summary: [c.type, c.clientName].filter(Boolean).join(" · "),
    detail: c.clientName || "",
    detailLabel: "Client",
    employee: c.paidTo || "",
  });

function entitlementSummary(e) {
  if (e.kind === "overtime") return `${e.hours || 0} overtime hours · ${[e.month, e.year].filter(Boolean).join(" ")}`;
  if (e.kind === "leaveEncashment") return `${e.days || 0} leave days encashed · ${e.year}`;
  const invoice = e.invoice;
  if (invoice?.supplierName) return [invoice.purpose || e.reason, invoice.supplierName].filter(Boolean).join(" · ");
  return e.reason || REQUEST_TYPES[e.kind]?.label || "";
}

const fromEntitlement = (e) =>
  row("entitlement", e, REQUEST_TYPES[e.kind] ? e.kind : "medical", {
    number: e.requestNo || e.entitlementNo,
    date: e.requestDate,
    amount: num(e.approvedAmount ?? e.amount),
    summary: entitlementSummary(e),
    detail:
      e.kind === "overtime"
        ? `${e.hours || 0} h`
        : e.kind === "leaveEncashment"
          ? `${e.days || 0} days`
          : e.invoice?.invoiceNo || "",
    detailLabel: e.kind === "overtime" ? "Hours" : e.kind === "leaveEncashment" ? "Days" : "Invoice",
    // A returned claim is kept as Pending with the decision "completion".
    statusLabel: e.statusLabel || (e.decision === "completion" ? "Returned" : e.status),
  });

const fromLeave = (l) =>
  row("leave", l, "leave", {
    number: l.leaveNo,
    date: l.requestedOn || l.from,
    amount: null,
    summary: `${leaveTypeLabel(l)}: ${longDate(l.from)} – ${longDate(l.to)} (${daysOf(l)} day${daysOf(l) === 1 ? "" : "s"})`,
    detail: `${longDate(l.from)} – ${longDate(l.to)}`,
    detailLabel: "Period",
    statusLabel:
      l.status === "Pending"
        ? l.stage === "management"
          ? "Pending Management Approval"
          : "Pending Department Approval"
        : l.status,
  });

const fromGeneral = (g) =>
  row("general", g, REQUEST_TYPES[g.kind] ? g.kind : "general", {
    number: g.requestNo,
    date: g.date,
    amount: null,
    summary: g.requestType || g.comment || "",
    detail: g.requestType || "",
    detailLabel: "Type",
  });

/**
 * Every request the signed-in user may see, as rows - one person's when
 * `employee` is given (matched by id, or by name for an older record that
 * carries no id), everybody's otherwise. Newest first.
 *
 * Leave days paid out instead of taken are the leave side of a Leave
 * Encashment request, which is already listed; they are not listed twice.
 */
export function collectRequests({ advances, bonuses, leaves }, employee) {
  const rows = [
    ...advances.map(fromAdvance),
    ...loanRecords.map(fromLoan),
    ...assistanceRecords.map(fromAssistance),
    ...bonuses.map(fromBonus),
    ...commissionRecords.map(fromCommission),
    ...initialEntitlements.map(fromEntitlement),
    ...leaves.filter((leave) => leave.status !== ENCASHED_PAID).map(fromLeave),
    ...initialGeneralRequests.map(fromGeneral),
  ];
  const mine = employee
    ? rows.filter((one) =>
        one.employeeId != null ? one.employeeId === employee.id : one.employee === employee.name
      )
    : rows;
  return mine
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.number).localeCompare(String(a.number)))
    .map((one, index) => ({ ...one, seq: index + 1 }));
}

/* --------------------------------------------------------------- details */

/** The request's own facts, as label and value, for the details window. */
export function detailsOf(one) {
  const r = one.record;
  const facts = {
    advance: [
      ["Purpose", r.purpose],
      ["Deduction Month", one.detail],
      ["Requested Amount (OMR)", omr(r.amount)],
      ["Approved Amount (OMR)", r.approvedAmount != null ? omr(r.approvedAmount) : ""],
      ["Remarks", r.reason],
    ],
    loan: [
      ["Loan Amount (OMR)", omr(r.loanAmount)],
      ["Monthly Installment (OMR)", omr(r.monthly)],
      ["Deductions Start", r.startMonth],
      ["Disbursed On", longDate(r.disbursementDate)],
      ["Comment", r.employeeComment],
    ],
    assistance: [
      ["Assistance Type", r.subcategory],
      ["Beneficiary", r.beneficiary],
      ["Requested Amount (OMR)", omr(r.requestedAmount)],
      ["Granted Amount (OMR)", r.decision === "Approved" ? omr(r.amount) : ""],
      ["Comment", r.notes],
    ],
    bonus: [
      ["Bonus Type", one.summary],
      ["Requested Amount (OMR)", omr(r.amount)],
      ["Approved Amount (OMR)", r.approvedAmount != null ? omr(r.approvedAmount) : ""],
      ["Comment", r.notes],
    ],
    commission: [
      ["Commission Type", r.type],
      ["Client", r.clientName],
      ["Case File", r.caseFileNo],
      ["Rate (%)", r.rate],
      ["Amount (OMR)", omr(r.amount)],
      ["Notes", r.notes],
    ],
    entitlement: [
      ["Year", r.year],
      ["Month", r.month],
      ["Hours", r.hours],
      ["Days", r.days],
      ["Invoice", r.invoice ? [r.invoice.invoiceNo, r.invoice.supplierName].filter(Boolean).join(" · ") : ""],
      ["Invoice Total (OMR)", r.invoice ? omr(r.invoice.total) : ""],
      ["Covered by Insurance (OMR)", r.invoice?.insuranceCovered ? omr(r.invoice.insuranceCovered) : ""],
      ["Amount (OMR)", omr(r.amount)],
      ["Approved Amount (OMR)", r.approvedAmount != null ? omr(r.approvedAmount) : ""],
      ["Comment", r.reason],
    ],
    leave: [
      ["Leave Type", leaveTypeLabel(r)],
      ["From", longDate(r.from)],
      ["To", longDate(r.to)],
      ["Days", daysOf(r)],
      ["Covering Colleague", r.replacement],
      ["Reason", r.reason],
    ],
    general: [
      ["Type", r.requestType],
      ["Details", r.comment],
      ["Document", r.document],
    ],
  }[one.source];
  return (facts || []).filter(([, value]) => value !== "" && value !== null && value !== undefined && value !== 0);
}

/**
 * What has happened to the request, oldest first: the record's own history
 * where it carries one, read off its dates otherwise.
 */
export function timelineOf(one) {
  const r = one.record;
  if (Array.isArray(r.history) && r.history.length) {
    return r.history
      .map((event) => ({
        at: event.at || event.createdAt,
        title: event.action || event.toStatus || "Updated",
        by: event.by || "",
        note: event.comment || "",
      }))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  }
  if (one.source === "entitlement") {
    return entitlementHistory(r)
      .map((event) => ({ at: event.at, title: event.action, by: event.by, note: event.comment }))
      .reverse();
  }
  const events = [{ at: one.date, title: "Request submitted", by: one.employee }];
  if (one.source === "leave") {
    if (r.reviewDate) {
      events.push({ at: r.reviewDate, title: "Department " + (r.departmentDecision === "Reject" ? "rejected" : "approved"), by: r.reviewedBy, note: r.departmentComments });
    }
    if (r.decidedAt) {
      events.push({ at: r.decidedAt, title: "Management " + (r.status === "Rejected" ? "rejected" : "approved"), by: r.managementDecidedBy, note: r.comments });
    }
    return events;
  }
  const decided = r.decidedOn || r.decisionDate;
  if (decided) {
    events.push({
      at: decided,
      title: one.status === "On Hold" ? "Returned for completion" : one.status === "Rejected" ? "Rejected" : "Approved",
      by: r.decidedBy || r.reviewedBy || "Management",
      note: r.managementComment || r.remarks || "",
    });
  }
  const paid = r.paidOn || (one.source !== "leave" ? r.paymentDate : "") || r.disbursementDate;
  if (paid) events.push({ at: paid, title: "Paid", by: r.paidBy || "Finance", note: r.reference || "" });
  return events;
}
