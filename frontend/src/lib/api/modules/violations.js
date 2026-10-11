import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { dateOnly, num, replaceAll } from "../store";
import { initialViolations, DEDUCTION_PENALTY, PARTIAL_OUTCOME } from "@/pages/employees/violationData";

/**
 * Violations (/violations and its five stages).
 *
 * The API keeps the files it was given under its own path; the screens show
 * the file's name. The investigation's standing is not stored - it is over
 * once a penalty has been decided - so it is read off the record here.
 */

/** "violations/7/x1y2.pdf" -> "x1y2.pdf" */
const fileName = (path) => (path ? String(path).split("/").pop() : "");

export function violationFromApi(v) {
  return {
    id: v.id,
    violationNo: v.violationNo || "",
    employee: v.employee?.name || "",
    employeeId: v.employeeId,
    type: v.type,
    date: v.date || "",
    description: v.description || "",
    documentName: fileName(v.document),
    investigationStart: v.investigationStart || "",
    investigationStatus: v.penaltyType ? "Investigation Completed" : "Under Investigation",
    investigator: v.investigator || "",
    acknowledgedAt: dateOnly(v.acknowledgedAt),
    response: v.response || "",
    responseDocument: fileName(v.responseDocument),
    investigationResult: v.investigationResult || "",
    penaltyType: v.penaltyType || "",
    deductionAmount: v.deductionAmount == null ? "" : num(v.deductionAmount),
    decisionReasons: v.decisionReasons || "",
    decisionDocument: fileName(v.decisionDocument),
    penaltyDate: v.penaltyDate || "",
    approvedBy: v.approvedBy || "",
    approvalDate: dateOnly(v.approvedAt),
    appealDate: v.appealDate || "",
    appealGrounds: v.appealGrounds || "",
    appealDocument: fileName(v.appealDocument),
    appealOutcome: v.appealOutcome || "",
    outcomeReasons: v.outcomeReasons || "",
    modifiedPenaltyType: v.modifiedPenaltyType || "",
    modifiedDeductionAmount: v.modifiedDeductionAmount == null ? "" : num(v.modifiedDeductionAmount),
    outcomeApprovedBy: v.outcomeApprovedBy || "",
    outcomeDate: v.outcomeDate || "",
    status: v.status,
  };
}

const post = async (path, body) => violationFromApi((await api(path, { method: "POST", body })).data);

export const violationsApi = {
  /** 1. Recorded against an employee; the investigation starts. */
  add: (employeeId, draft, document) =>
    post("violations", {
      employeeId,
      type: draft.type,
      date: draft.date,
      description: draft.description.trim(),
      investigationStart: draft.investigationStart || null,
      document: document || null,
    }),

  /** The employee has read it. */
  acknowledge: (id) => post(`violations/${id}/acknowledge`),

  /** 2. The employee's answer. */
  respond: (id, draft, document) =>
    post(`violations/${id}/response`, {
      response: draft.response.trim(),
      responseDocument: document || null,
    }),

  /** 3. The penalty - numbered VIO-xxx by the server when one is issued. */
  decide: (id, draft, document) =>
    post(`violations/${id}/decision`, {
      investigationResult: draft.investigationResult,
      penaltyType: draft.penaltyType,
      deductionAmount: draft.penaltyType === DEDUCTION_PENALTY ? Number(draft.deductionAmount) : null,
      decisionReasons: draft.decisionReasons.trim(),
      penaltyDate: draft.penaltyDate,
      decisionDocument: document || null,
    }),

  /** 4. The employee's appeal. */
  appeal: (id, draft, document) =>
    post(`violations/${id}/appeal`, {
      appealGrounds: draft.appealGrounds.trim(),
      appealDocument: document || null,
    }),

  /**
   * 5. How the appeal was settled. Only a partly accepted appeal carries a
   * penalty to put in the place of the first, and only a deduction an amount -
   * a choice made and then changed away from is not sent with the one kept.
   */
  outcome: (id, draft) => {
    const partial = draft.appealOutcome === PARTIAL_OUTCOME;
    return post(`violations/${id}/outcome`, {
      appealOutcome: draft.appealOutcome,
      outcomeReasons: draft.outcomeReasons.trim(),
      modifiedPenaltyType: partial ? draft.modifiedPenaltyType || null : null,
      modifiedDeductionAmount:
        partial && draft.modifiedPenaltyType === DEDUCTION_PENALTY ? Number(draft.modifiedDeductionAmount) : null,
    });
  },
};

registerLoader("violations", async () => {
  const rows = await fetchAll("violations");
  replaceAll(initialViolations, rows.map(violationFromApi));
});
