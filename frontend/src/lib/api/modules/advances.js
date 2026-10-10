import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { dateOnly, num, replaceAll } from "../store";
import { initialAdvances, OTHER_PURPOSE } from "@/pages/employees/advanceSalaryData";

/**
 * Salary advances (POST/GET /salary-advances).
 *
 * The API keeps one status per state (Pending, Returned, Approved, Paid,
 * Rejected); the screens were written to read a returned request as Pending
 * with decision "completion", and a paid one as Approved with a payment date.
 * The two translations below are the only place that difference lives.
 */

const DECISION_FROM_API = { full: "full", partial: "partial", return: "completion", reject: "rejected" };
const DECISION_TO_API = { full: "full", partial: "partial", completion: "return", rejected: "reject" };

export function advanceFromApi(a) {
  const paid = a.status === "Paid";
  return {
    id: a.id,
    requestNo: a.requestNo,
    employee: a.employee?.name || "",
    employeeId: a.employeeId,
    requestedOn: a.requestedOn,
    amount: num(a.amount),
    deductMonth: a.deductMonth,
    deductYear: String(a.deductYear),
    purpose: a.purpose,
    // "Other" is said in the remarks on screen; the API keeps it apart.
    reason: a.reason || (a.purpose === OTHER_PURPOSE ? a.purposeOther || "" : ""),
    status: a.status === "Returned" ? "Pending" : paid ? "Approved" : a.status,
    decision: a.decision ? DECISION_FROM_API[a.decision] : "",
    approvedAmount: num(a.approvedAmount),
    managementComment: a.managementComment || "",
    decidedOn: dateOnly(a.decidedAt),
    decidedBy: a.decidedBy || "",
    expenseType: a.expenseType || "",
    category: a.category || "",
    subcategory: a.subcategory || "",
    method: a.paymentMethod || "",
    paymentDate: a.paymentDate || "",
    reference: a.paymentReference || "",
    financeComment: a.financeComment || "",
    paidOn: paid ? a.paymentDate || dateOnly(a.paidAt) : "",
    paidBy: a.paidBy || "",
    statusLabel: a.statusLabel,
    history: a.history || [],
  };
}

/** The request as the API takes it, from the form's draft. */
const requestBody = (draft, employeeId) => ({
  employeeId,
  amount: Number(draft.amount),
  deductMonth: draft.deductMonth,
  deductYear: Number(draft.deductYear),
  purpose: draft.purpose,
  purposeOther: draft.purpose === OTHER_PURPOSE ? String(draft.reason || "").slice(0, 120) : null,
  reason: draft.reason || null,
});

export const advancesApi = {
  async submit(draft, employeeId) {
    const json = await api("salary-advances", { method: "POST", body: requestBody(draft, employeeId) });
    return advanceFromApi(json.data);
  },

  async resubmit(id, draft, employeeId) {
    const json = await api(`salary-advances/${id}`, { method: "PUT", body: requestBody(draft, employeeId) });
    return advanceFromApi(json.data);
  },

  async decide(id, { decision, approvedAmount, comment }) {
    const json = await api(`salary-advances/${id}/decision`, {
      method: "POST",
      body: {
        decision: DECISION_TO_API[decision] || decision,
        approvedAmount: decision === "partial" ? Number(approvedAmount) : null,
        comment: comment || null,
      },
    });
    return advanceFromApi(json.data);
  },

  async pay(id, pay) {
    const json = await api(`salary-advances/${id}/payment`, {
      method: "POST",
      body: {
        paymentMethod: pay.method,
        paymentDate: pay.paymentDate,
        paymentReference: pay.reference || null,
        financeComment: pay.financeComment || null,
        expenseType: pay.expenseType || null,
        category: pay.category || null,
        subcategory: pay.subcategory || null,
      },
    });
    return advanceFromApi(json.data);
  },
};

registerLoader("salary advances", async () => {
  const rows = await fetchAll("salary-advances");
  replaceAll(initialAdvances, rows.map(advanceFromApi));
});
