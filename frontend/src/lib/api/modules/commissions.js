import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { dateOnly, num, replaceAll, upsert } from "../store";
import {
  commissionRecords,
  invoiceFor,
  INVOICE_LINKED_COMMISSION,
} from "@/pages/firm/commissionData";

/**
 * Commissions (/commissions). Only management files one.
 *
 * The firm's page and an employee's record both read `commissionRecords`, so
 * every saved commission is put back into that one list as well as returned.
 *
 * The screens call the payee `paidTo`, the decision by its button's words
 * ("Full Approval"...), and a returned commission - which they have no way to
 * show - reads Pending. An agreed commission not yet paid reads Approved.
 */

const STATUS_FROM_API = { Returned: "Pending" };
const DECISION_FROM_API = { full: "Full Approval", partial: "Partial Approval", reject: "Rejection" };
const DECISION_TO_API = { "Full Approval": "full", "Partial Approval": "partial", Rejection: "reject" };

/** The groups the API files a payee under; anyone else is one of the firm's employees. */
const API_CLASSIFICATIONS = ["Partners", "Lawyers", "Consultants", "Employees"];

export function commissionFromApi(c) {
  return {
    id: c.id,
    commissionNo: c.commissionNo,
    employeeId: c.employeeId,
    paidTo: c.employee?.name || "",
    classification: c.classification || "",
    type: c.type,
    clientNo: c.clientNo || "",
    clientName: c.clientName || "",
    caseFileNo: c.caseFileNo || "",
    invoiceNo: c.invoiceNo || "",
    rate: num(c.rate),
    periodFrom: c.periodFrom || "",
    periodTo: c.periodTo || "",
    amount: num(c.amount),
    notes: c.notes || "",
    // The day it was recorded, which is what the list reads it by.
    date: dateOnly(c.createdAt),
    status: STATUS_FROM_API[c.status] || c.status,
    decision: c.decision ? DECISION_FROM_API[c.decision] : "",
    approvedAmount: c.approvedAmount == null ? undefined : num(c.approvedAmount),
    managementComment: c.managementComment || "",
    rejectionReason: c.status === "Rejected" ? c.managementComment || "" : "",
    method: c.paymentMethod || "",
    paymentDate: c.paymentDate || "",
    reference: c.paymentReference || "",
    paymentNotes: c.financeComment || c.managementComment || "",
    decidedBy: c.decidedBy || "",
    paidBy: c.paidBy || "",
    statusLabel: c.statusLabel,
    history: c.history || [],
  };
}

/**
 * What was agreed, as the API takes it. An invoice-linked commission is not
 * asked for a period on screen; it runs from the day its invoice was paid.
 */
function requestBody(record, employeeId) {
  const linked = record.type === INVOICE_LINKED_COMMISSION;
  const invoice = linked ? invoiceFor(record.clientNo, record.invoiceNo) : null;
  return {
    employeeId,
    type: record.type,
    classification: API_CLASSIFICATIONS.includes(record.classification) ? record.classification : "Employees",
    clientNo: record.clientNo,
    clientName: record.clientName,
    caseFileNo: record.caseFileNo || null,
    invoiceNo: linked ? record.invoiceNo : null,
    rate: Number(record.rate),
    periodFrom: record.periodFrom || invoice?.paidDate || invoice?.date || new Date().toISOString().slice(0, 10),
    periodTo: linked ? null : record.periodTo || null,
    amount: record.amount === undefined || record.amount === "" ? null : Number(record.amount),
    notes: record.notes || null,
  };
}

/** Each saved commission goes back into the list both pages read. */
const kept = (json) => upsert(commissionRecords, commissionFromApi(json.data));

export const commissionsApi = {
  async submit(record, employeeId) {
    return kept(await api("commissions", { method: "POST", body: requestBody(record, employeeId) }));
  },

  async update(id, record, employeeId) {
    return kept(await api(`commissions/${id}`, { method: "PUT", body: requestBody(record, employeeId) }));
  },

  async decide(id, { decision, approvedAmount, comment }) {
    const answer = DECISION_TO_API[decision] || decision;
    return kept(
      await api(`commissions/${id}/decision`, {
        method: "POST",
        body: {
          decision: answer,
          approvedAmount: answer === "partial" ? Number(approvedAmount) : null,
          comment: comment || null,
        },
      })
    );
  },

  async pay(id, pay) {
    return kept(
      await api(`commissions/${id}/payment`, {
        method: "POST",
        body: {
          paymentMethod: pay.method,
          paymentDate: pay.paymentDate,
          bankAccount: pay.bankAccount || null,
          paymentReference: pay.reference || null,
          financeComment: pay.financeComment || null,
        },
      })
    );
  },
};

registerLoader("commissions", async () => {
  const rows = await fetchAll("commissions");
  replaceAll(commissionRecords, rows.map(commissionFromApi));
});
