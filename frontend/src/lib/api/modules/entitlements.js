import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { dateOnly, num, replaceAll, upsert } from "../store";
import {
  ENTITLEMENT_APPROVED,
  ENTITLEMENT_AWAITING,
  ENTITLEMENT_PENDING,
  initialEntitlements,
} from "@/pages/employees/entitlementData";
import { SALARY_MONTHS } from "@/pages/employees/payrollData";

/**
 * Allowances, overtime, leave encashment, notice pay and end of service
 * (/entitlements), and the invoice analysis invoice-based claims start with
 * (/invoices/analyze).
 *
 * The API keeps one status per state; the tab was written with four words:
 * Pending, Awaiting Payment (API Approved - decided, not yet paid), Approved
 * (API Paid) and Rejected. A returned request reads as Pending with the
 * decision "completion", as the salary advance does. The translations below
 * are the only place that difference lives.
 */

const DECISION_FROM_API = { full: "full", partial: "partial", return: "completion", reject: "rejected" };
const DECISION_TO_API = { full: "full", partial: "partial", completion: "return", rejected: "reject" };

const STATUS_FROM_API = {
  Pending: ENTITLEMENT_PENDING,
  Returned: ENTITLEMENT_PENDING,
  Approved: ENTITLEMENT_AWAITING,
  Paid: ENTITLEMENT_APPROVED,
};

/** "Jan" for "2026-01", as the overtime picker names its months. */
const monthOf = (period) => SALARY_MONTHS[Number(String(period || "").slice(5, 7)) - 1]?.value || "";

/** "2026-01" from the picker's month and year. */
const periodOf = (month, year) => {
  const index = SALARY_MONTHS.findIndex((m) => m.value === month);
  return index < 0 || !year ? null : `${year}-${String(index + 1).padStart(2, "0")}`;
};

/** The stored file's own name, as the screens show an attachment. */
const fileName = (path) => (path ? String(path).split("/").pop() : "");

/**
 * An invoice as the analysis read it. Sent back as multipart it is stored with
 * its figures as text, so they are made numbers again here.
 */
export function invoiceFromApi(invoice) {
  if (!invoice) return null;
  return {
    ...invoice,
    supplierVat: invoice.supplierVat || "",
    supplierCr: invoice.supplierCr || "",
    supplierPhone: invoice.supplierPhone || "",
    items: (invoice.items || []).map((item) => ({ ...item, quantity: Number(item.quantity), amount: Number(item.amount) })),
    subtotal: Number(invoice.subtotal),
    vat: Number(invoice.vat),
    total: Number(invoice.total),
    confidence: invoice.confidence
      ? Object.fromEntries(Object.entries(invoice.confidence).map(([key, value]) => [key, Number(value)]))
      : undefined,
  };
}

/** The checks' findings; the screen names a known supplier by its SUP number. */
export function riskFromApi(risk) {
  if (!risk) return null;
  return {
    level: risk.level,
    reasons: risk.reasons || [],
    notes: risk.notes || [],
    repeated: risk.repeated || [],
    duplicateOf: risk.duplicateOf || "",
    supplier: risk.supplier ? { ...risk.supplier, supplierId: risk.supplier.supplierNo } : null,
  };
}

export function entitlementFromApi(a) {
  const paid = a.status === "Paid";
  const invoice = invoiceFromApi(a.invoice);
  return {
    id: a.id,
    kind: a.kind,
    employee: a.employee?.name || "",
    employeeId: a.employeeId,
    requestNo: a.requestNo,
    entitlementNo: a.entitlementNo || "",
    requestDate: a.requestDate,
    year: a.year ? String(a.year) : a.period ? String(a.period).slice(0, 4) : "",
    month: monthOf(a.period),
    leaveType: a.leaveType || "",
    days: num(a.days) ?? "",
    hours: num(a.hours) ?? "",
    amount: num(a.amount),
    reason: a.reason || "",
    transportType: a.transportType || undefined,
    fileNo: a.caseFileNo || "",
    travelDate: a.travelDate || "",
    attachment: invoice?.fileName || fileName(a.attachment),
    // The invoice carries what insurance paid, as the tab reads it back.
    invoice: invoice ? { ...invoice, insuranceCovered: num(a.insuranceCovered) || 0 } : undefined,
    risk: riskFromApi(a.risk),
    status: STATUS_FROM_API[a.status] || a.status,
    decision: a.decision ? DECISION_FROM_API[a.decision] : "",
    approvedAmount: num(a.approvedAmount) ?? undefined,
    decisionDate: dateOnly(a.decidedAt),
    decidedBy: a.decidedBy || "",
    managementComment: a.managementComment || "",
    rejectionReason: a.status === "Rejected" ? a.managementComment || "" : "",
    method: a.paymentMethod || "",
    bankAccount: a.bankAccount || "",
    // Only a payment made has a date: the history and "last similar" read it so.
    paymentDate: paid ? a.paymentDate || dateOnly(a.paidAt) : "",
    reference: a.paymentReference || "",
    financeComment: a.financeComment || "",
    paidBy: a.paidBy || "",
    statusLabel: a.statusLabel,
    history: a.history || [],
  };
}

/**
 * The request as the API takes it, from the tab's draft. Amounts the server
 * works out (overtime from hours, encashment from days, an invoice claim from
 * the invoice less insurance) are not sent.
 */
function requestBody(kind, draft, { employeeId, invoice, file }) {
  const body = { employeeId, kind, reason: draft.reason || null };

  if (kind === "leaveEncashment") {
    Object.assign(body, { year: Number(draft.year), leaveType: draft.leaveType, days: Number(draft.days) });
  } else if (kind === "overtime") {
    Object.assign(body, { period: periodOf(draft.month, draft.year), hours: Number(draft.hours) });
  } else if (invoice) {
    // The invoice as the analysis returned it, without what the tab adds on.
    const read = { ...invoice };
    delete read.insuranceCovered;
    delete read.risk;
    Object.assign(body, { invoice: read, insuranceCovered: Number(draft.insurance || 0), confirmed: true });
  } else {
    body.amount = Number(draft.amount);
  }

  if (kind === "transport") {
    body.transportType = draft.transportType || null;
    body.caseFileNo = draft.transportType === "court" ? draft.fileNo || null : null;
    body.travelDate = draft.transportType === "court" ? draft.travelDate || null : null;
  }

  // The paper the request is made on: the invoice itself, or a receipt.
  if (file) body.attachment = file;
  return body;
}

/** Every answer replaces the record on the list it came from. */
const keep = (json) => {
  const row = entitlementFromApi(json.data);
  upsert(initialEntitlements, row);
  return row;
};

export const entitlementsApi = {
  /** Reads an uploaded invoice and checks it; nothing is saved. */
  async analyze(file, kind, employeeId) {
    const json = await api("invoices/analyze", { method: "POST", body: { file, kind, employeeId } });
    return {
      invoice: invoiceFromApi(json.data.invoice),
      risk: riskFromApi(json.data.risk),
      demo: Boolean(json.data.demo),
    };
  },

  async submit(kind, draft, options) {
    return keep(await api("entitlements", { method: "POST", body: requestBody(kind, draft, options) }));
  },

  /** A pending request corrected, or a returned one sent back to management. */
  async resubmit(id, kind, draft, options) {
    // A file goes as multipart, which PHP reads only on POST; the route takes both.
    return keep(
      await api(`entitlements/${id}`, { method: options.file ? "POST" : "PUT", body: requestBody(kind, draft, options) })
    );
  },

  async decide(id, { decision, approvedAmount, comment }) {
    return keep(
      await api(`entitlements/${id}/decision`, {
        method: "POST",
        body: {
          decision: DECISION_TO_API[decision] || decision,
          approvedAmount: decision === "partial" ? Number(approvedAmount) : null,
          comment: comment || null,
        },
      })
    );
  },

  async pay(id, pay) {
    return keep(
      await api(`entitlements/${id}/payment`, {
        method: "POST",
        body: {
          paymentMethod: pay.method,
          paymentDate: pay.paymentDate,
          bankAccount: pay.bankAccount || null,
          paymentReference: pay.reference || null,
          financeComment: pay.financeComment || null,
          expenseType: pay.expenseType || null,
          category: pay.category || null,
          subcategory: pay.subcategory || null,
        },
      })
    );
  },
};

registerLoader("entitlements", async () => {
  const rows = await fetchAll("entitlements");
  replaceAll(initialEntitlements, rows.map(entitlementFromApi));
});
