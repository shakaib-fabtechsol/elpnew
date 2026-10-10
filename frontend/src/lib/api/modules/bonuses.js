import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { dateOnly, num, replaceAll } from "../store";
import {
  initialBonuses,
  BONUS_EXPENSE_TYPE,
  BONUS_CATEGORY,
  BONUS_PENDING,
  BONUS_APPROVED,
  BONUS_DISBURSED,
  OTHER_BONUS,
} from "@/pages/employees/bonusData";

/**
 * Bonuses (/bonuses).
 *
 * The screens read a paid bonus as "Disbursed" (the API's statusLabel says
 * the same) and know no returned state - a returned bonus waits on the
 * employee, so it reads Pending there. The decision comes back in the words
 * the decision buttons use.
 */

const STATUS_FROM_API = {
  Pending: BONUS_PENDING,
  Returned: BONUS_PENDING,
  Approved: BONUS_APPROVED,
  Paid: BONUS_DISBURSED,
};
const DECISION_FROM_API = { full: "full", partial: "partial", return: "completion", reject: "rejected" };
const DECISION_TO_API = { full: "full", partial: "partial", completion: "return", rejected: "reject" };

/** "requests/7/abc.pdf" -> "abc.pdf": the form shows the file's name. */
const fileName = (path) => (path ? String(path).split("/").pop() : "");

export function bonusFromApi(b) {
  return {
    id: b.id,
    requestNo: b.requestNo,
    employee: b.employee?.name || "",
    employeeId: b.employeeId,
    expenseType: b.expenseType || BONUS_EXPENSE_TYPE,
    category: b.category || BONUS_CATEGORY,
    subcategory: b.bonusSubcategory,
    bonusType: b.bonusType || "",
    amount: num(b.amount),
    recordedOn: b.recordedOn,
    status: STATUS_FROM_API[b.status] || b.status,
    decision: b.decision ? DECISION_FROM_API[b.decision] : "",
    approvedAmount: b.approvedAmount == null ? undefined : num(b.approvedAmount),
    decidedOn: dateOnly(b.decidedAt),
    decidedBy: b.decidedBy || "",
    managementComment: b.managementComment || "",
    rejectionReason: b.status === "Rejected" ? b.managementComment || "" : "",
    paidOn: b.status === "Paid" ? b.paymentDate || dateOnly(b.paidAt) : "",
    method: b.paymentMethod || "",
    bankAccount: b.bankAccount || "",
    reference: b.paymentReference || "",
    attachment: fileName(b.attachment),
    notes: b.notes || "",
    statusLabel: b.statusLabel,
    history: b.history || [],
  };
}

/** The request as the API takes it: what it is for, how much, and why. */
const requestBody = (details, file, employeeId) => ({
  employeeId,
  bonusSubcategory: details.subcategory,
  bonusType: details.subcategory === OTHER_BONUS ? details.bonusType || null : null,
  amount: Number(details.amount),
  notes: details.notes || "",
  ...(file ? { attachment: file } : {}),
});

export const bonusesApi = {
  async submit(details, file, employeeId) {
    const json = await api("bonuses", { method: "POST", body: requestBody(details, file, employeeId) });
    return bonusFromApi(json.data);
  },

  /** A pending request corrected, or a returned one sent back. */
  async update(id, details, file, employeeId) {
    // A file can only travel by POST in multipart; the API takes POST as PUT here.
    const json = await api(`bonuses/${id}`, {
      method: file ? "POST" : "PUT",
      body: requestBody(details, file, employeeId),
    });
    return bonusFromApi(json.data);
  },

  async decide(id, { decision, approvedAmount, comment }) {
    const json = await api(`bonuses/${id}/decision`, {
      method: "POST",
      body: {
        decision: DECISION_TO_API[decision] || decision,
        approvedAmount: decision === "partial" ? Number(approvedAmount) : null,
        comment: comment || null,
      },
    });
    return bonusFromApi(json.data);
  },

  async pay(id, pay) {
    const json = await api(`bonuses/${id}/payment`, {
      method: "POST",
      body: {
        paymentMethod: pay.method,
        paymentDate: pay.paidOn,
        bankAccount: pay.bankAccount || null,
        paymentReference: pay.reference || null,
        expenseType: pay.expenseType || null,
        category: pay.category || null,
        subcategory: pay.subcategory || null,
      },
    });
    return bonusFromApi(json.data);
  },
};

registerLoader("bonuses", async () => {
  const rows = await fetchAll("bonuses");
  replaceAll(initialBonuses, rows.map(bonusFromApi));
});
