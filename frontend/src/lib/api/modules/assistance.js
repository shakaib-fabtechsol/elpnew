import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { dateOnly, num, replaceAll } from "../store";
import { assistanceRecords, DEFAULT_ASSISTANCE_BOOKING } from "@/pages/employees/assistanceData";

/**
 * Financial assistance (/assistance-requests).
 *
 * The screens read a request by its `decision` (Pending, Approved, Rejected,
 * Returned) and a payment date, and work out "Paid" from the two
 * (assistanceData.statusOf); the API keeps one status per state. They also
 * read `amount` as what was granted once a request is approved, with what was
 * asked for kept beside it. Both translations live here.
 */

const DECISION_OF_STATUS = { Approved: "Approved", Paid: "Approved", Rejected: "Rejected", Returned: "Returned" };
const DECISION_FROM_API = { full: "full", partial: "partial", return: "completion", reject: "rejected" };
const DECISION_TO_API = { full: "full", partial: "partial", completion: "return", rejected: "reject" };

/** "requests/7/abc.pdf" -> "abc.pdf": the list shows the file's name. */
const fileName = (path) => (path ? String(path).split("/").pop() : "");

export function assistanceFromApi(a) {
  const granted = a.status === "Approved" || a.status === "Paid";
  return {
    id: a.id,
    requestNo: a.requestNo,
    employee: a.employee?.name || "",
    employeeId: a.employeeId,
    requestDate: a.requestDate,
    beneficiary: a.beneficiary || "",
    decision: DECISION_OF_STATUS[a.status] || a.status,
    decisionChoice: a.decision ? DECISION_FROM_API[a.decision] : "",
    expenseType: a.expenseType || DEFAULT_ASSISTANCE_BOOKING.expenseType,
    category: a.category || DEFAULT_ASSISTANCE_BOOKING.category,
    // What the help was for is also what it is booked under.
    subcategory: a.assistanceType,
    purpose: a.purpose || "",
    // What was granted once it is approved; what was asked for until then.
    amount: granted ? num(a.approvedAmount ?? a.amount) : num(a.amount),
    requestedAmount: num(a.amount),
    decisionDate: dateOnly(a.decidedAt),
    decidedBy: a.decidedBy || "",
    managementComment: a.managementComment || "",
    rejectionReason: a.status === "Rejected" ? a.managementComment || "" : "",
    paymentDate: a.status === "Paid" ? a.paymentDate || dateOnly(a.paidAt) : "",
    method: a.paymentMethod || "",
    bankAccount: a.bankAccount || "",
    account: a.bankAccount || "",
    reference: a.paymentReference || "",
    proof: fileName(a.proof),
    notes: a.notes || "",
    statusLabel: a.statusLabel,
    history: a.history || [],
  };
}

/** The request as the API takes it, from the form's draft and its document. */
const requestBody = (draft, proof, employeeId) => ({
  employeeId,
  assistanceType: draft.subcategory,
  amount: Number(draft.amount),
  // The screen asks for one comment, which is both why and what for - unless
  // the request already said what for.
  purpose: String(draft.purpose || draft.notes || "").trim().slice(0, 255) || null,
  notes: String(draft.notes || "").trim(),
  ...(proof ? { proof } : {}),
});

export const assistanceApi = {
  async submit(draft, proof, employeeId) {
    const json = await api("assistance-requests", { method: "POST", body: requestBody(draft, proof, employeeId) });
    return assistanceFromApi(json.data);
  },

  async resubmit(id, draft, proof, employeeId) {
    // A file can only travel by POST in multipart; the API takes POST as PUT here.
    const body = requestBody(draft, proof, employeeId);
    const json = await api(`assistance-requests/${id}`, { method: proof ? "POST" : "PUT", body });
    return assistanceFromApi(json.data);
  },

  async decide(id, { decision, approvedAmount, comment }) {
    const json = await api(`assistance-requests/${id}/decision`, {
      method: "POST",
      body: {
        decision: DECISION_TO_API[decision] || decision,
        approvedAmount: decision === "partial" ? Number(approvedAmount) : null,
        comment: comment || null,
      },
    });
    return assistanceFromApi(json.data);
  },

  async pay(id, pay) {
    const json = await api(`assistance-requests/${id}/payment`, {
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
    });
    return assistanceFromApi(json.data);
  },
};

registerLoader("assistance", async () => {
  const rows = await fetchAll("assistance-requests");
  replaceAll(assistanceRecords, rows.map(assistanceFromApi));
});
