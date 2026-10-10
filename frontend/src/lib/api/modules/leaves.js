import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { dateOnly, num, replaceAll } from "../store";
import { initialLeaves } from "@/pages/employees/leaveData";
import { employeeRecords } from "@/pages/employees/employeeData";

/**
 * Leave (/leaves, /employees/{id}/leave-balance).
 *
 * The API speaks of a stage's decision as approve / reject; the review sheet
 * reads it back as the option that was picked ("Approve", "Reject"). The
 * year comes back as a number, and the screens count balances by the year as
 * a string. Both translations live here and nowhere else.
 */

const DECISION_FROM_API = { approve: "Approve", reject: "Reject" };
const DECISION_TO_API = { Approve: "approve", Reject: "reject" };

export function leaveFromApi(l) {
  return {
    id: l.id,
    leaveNo: l.leaveNo,
    employee: l.employee?.name || "",
    employeeId: l.employeeId,
    category: l.category || "",
    type: l.type,
    // Encashed days have no dates; the list sorts on them, so never null.
    from: l.from || "",
    to: l.to || "",
    year: String(l.year),
    days: num(l.days),
    encashmentNo: l.encashmentNo || "",
    reason: l.reason || "",
    replacement: l.replacement?.name || "",
    requestedOn: dateOnly(l.createdAt),
    stage: l.stage,
    status: l.status,
    // The department's half of the review.
    departmentDecision: l.departmentDecision ? DECISION_FROM_API[l.departmentDecision] : "",
    departmentComments: l.departmentComment || "",
    reviewedBy: l.departmentBy || "",
    reviewDate: dateOnly(l.departmentAt),
    // Management's answer - or the department's, when it refused and ended it.
    comments: l.comments || l.departmentComment || "",
    managementDecidedBy: l.decidedBy || "",
    decidedAt: dateOnly(l.decidedAt),
  };
}

/** The colleague covering the work is chosen by name; the API wants their id. */
const replacementId = (name) =>
  name ? employeeRecords.find((person) => person.name === name)?.id ?? null : null;

const requestBody = (draft, employeeId) => ({
  employeeId,
  type: draft.type,
  from: draft.from,
  to: draft.to,
  year: Number(draft.year),
  reason: String(draft.reason || "").trim(),
  replacementEmployeeId: replacementId(draft.replacement),
});

const decisionBody = ({ decision, comments }) => ({
  decision: DECISION_TO_API[decision] || decision,
  comment: String(comments || "").trim() || null,
});

export const leavesApi = {
  async submit(draft, employeeId) {
    const json = await api("leaves", { method: "POST", body: requestBody(draft, employeeId) });
    return leaveFromApi(json.data);
  },

  /** Stage 2: the department passes it up to management, or ends it. */
  async departmentDecide(id, review) {
    const json = await api(`leaves/${id}/department-decision`, { method: "POST", body: decisionBody(review) });
    return leaveFromApi(json.data);
  },

  /** Stage 3: management's final answer. */
  async decide(id, review) {
    const json = await api(`leaves/${id}/decision`, { method: "POST", body: decisionBody(review) });
    return leaveFromApi(json.data);
  },

  async list() {
    return (await fetchAll("leaves")).map(leaveFromApi);
  },

  /** What is left of each type for one employee, as the server counts it. */
  async balance(employeeId, year) {
    const json = await api(`employees/${employeeId}/leave-balance`, { query: { year } });
    return json.data;
  },
};

registerLoader("leaves", async () => {
  replaceAll(initialLeaves, await leavesApi.list());
});
