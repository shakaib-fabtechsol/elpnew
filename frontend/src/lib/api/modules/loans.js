import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { dateOnly, num, replaceAll } from "../store";
import {
  LOAN_APPROVED,
  LOAN_FULL_APPROVAL,
  LOAN_PARTIAL_APPROVAL,
  loanRecords,
} from "@/pages/employees/loanData";

/**
 * Loans and their installments (/loans).
 *
 * The API keeps one status per state (Pending, Returned, Approved, Paid,
 * Rejected, Cancelled). The screens read a granted loan as "Full Approval" or
 * "Partial Approval" until it is paid out, and a paid-out one as "Approved"
 * with a disbursement date; and they work the schedule out themselves from
 * the payments made against it. Both translations live here.
 */

const DECISION_TO_API = { full: "full", partial: "partial", completion: "return", rejected: "reject" };

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 2026-11-30 -> "November 2026", the month the deductions start in. */
const startMonthOf = (iso) => {
  const [year, month] = String(iso || "").split("-");
  return year && month ? MONTH_LABELS[Number(month) - 1] + " " + year : "";
};

function statusFromApi(l) {
  if (l.status === "Paid") return LOAN_APPROVED;
  if (l.status === "Approved") return l.decision === "partial" ? LOAN_PARTIAL_APPROVAL : LOAN_FULL_APPROVAL;
  return l.status;
}

export function loanFromApi(l) {
  // Granted terms replace the asked-for ones once management has decided.
  const granted = l.status === "Approved" || l.status === "Paid";
  return {
    id: l.id,
    requestNo: l.requestNo,
    employee: l.employee?.name || "",
    employeeId: l.employeeId,
    kind: l.kind,
    requestedOn: l.requestedOn || "",
    startMonth: startMonthOf(l.firstDue),
    employeeComment: l.comment || "",
    attachment: l.attachment || "",
    status: statusFromApi(l),
    loanAmount: num(granted && l.approvedAmount != null ? l.approvedAmount : l.loanAmount),
    merged: num(l.merged) || 0,
    monthly: num(granted && l.approvedMonthly != null ? l.approvedMonthly : l.monthly),
    firstDue: l.firstDue || "",
    disbursementDate: l.disbursementDate || "",
    bankName: l.bankName || "",
    accountNumber: l.accountNumber || "",
    // What was repaid against each installment: the screens build the
    // schedule's rows and balances from these.
    payments: (l.schedule || [])
      .filter((row) => row.paid > 0 || row.status === "Deferred")
      .map((row) => ({
        due: row.due,
        amount: num(row.paid),
        date: row.paymentDate || "",
        deferred: row.status === "Deferred",
      })),
    managementNotes: l.managementComment || "",
    decidedOn: dateOnly(l.decidedAt),
    decidedBy: l.decidedBy || "",
    method: l.paymentMethod || "",
    bankAccount: l.bankAccount || "",
    reference: l.paymentReference || "",
    paidBy: l.paidBy || "",
    statusLabel: l.statusLabel,
    history: l.history || [],
  };
}

/** The request as the API takes it, from the form's figures. */
const requestBody = (draft, employeeId) => ({
  employeeId,
  loanAmount: Number(draft.loanAmount),
  monthly: Number(draft.monthly),
  startMonth: draft.startMonth,
  comment: draft.comment || null,
  ...(draft.attachment ? { attachment: draft.attachment } : {}),
});

export const loansApi = {
  async submit(draft, employeeId) {
    const json = await api("loans", { method: "POST", body: requestBody(draft, employeeId) });
    return loanFromApi(json.data);
  },

  /** A returned request, corrected and sent back (or a pending one corrected). */
  async resubmit(id, draft, employeeId) {
    const json = await api(`loans/${id}`, { method: "PUT", body: requestBody(draft, employeeId) });
    return loanFromApi(json.data);
  },

  /** Withdrawn before a decision. */
  async withdraw(id) {
    const json = await api(`loans/${id}`, { method: "DELETE" });
    return loanFromApi(json.data);
  },

  async decide(id, { decision, approvedAmount, approvedMonthly, comment }) {
    const partial = decision === "partial";
    const json = await api(`loans/${id}/decision`, {
      method: "POST",
      body: {
        decision: DECISION_TO_API[decision] || decision,
        approvedAmount: partial ? Number(approvedAmount) : null,
        // A partial approval may set a new installment as well.
        approvedMonthly: partial && Number(approvedMonthly) > 0 ? Number(approvedMonthly) : null,
        comment: comment || null,
      },
    });
    return loanFromApi(json.data);
  },

  /** Paid out by the financial department: the loan starts running. */
  async pay(id, pay) {
    const json = await api(`loans/${id}/payment`, {
      method: "POST",
      body: {
        paymentMethod: pay.method,
        paymentDate: pay.paymentDate,
        bankAccount: pay.bankAccount || null,
        paymentReference: pay.reference || null,
        financeComment: pay.financeComment || null,
      },
    });
    return loanFromApi(json.data);
  },

  /** What was repaid against one installment, or that it was deferred. */
  async recordInstallment(id, { due, amount, paidOn, deferred = false }) {
    const json = await api(`loans/${id}/installments`, {
      method: "POST",
      body: { dueDate: due, amount: deferred ? 0 : Number(amount), paidOn: paidOn || null, deferred },
    });
    return loanFromApi(json.data);
  },
};

registerLoader("loans", async () => {
  const rows = await fetchAll("loans");
  replaceAll(loanRecords, rows.map(loanFromApi));
});
