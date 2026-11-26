import { api } from "../client";

/**
 * Employee Offboarding (/offboardings): End of Service as a process of its
 * own - initiation, approval, the notice period, the clearance checklist,
 * the exit interview and the final settlement, ending with the employee
 * Inactive and their access revoked.
 *
 * Not loaded at sign-in: the Offboarding pages fetch what they show when
 * they open.
 */

export const OFFBOARDING_TYPES = ["Resignation", "Termination", "End of Contract", "Retirement"];

export const NOTICE_MODES = ["Served", "Waived", "Paid in lieu"];

export const OFFBOARDING_STATUSES = [
  "Pending Approval",
  "In Progress",
  "Completed",
  "Rejected",
  "Cancelled",
];

export const OPEN_STATUSES = ["Pending Approval", "In Progress"];

export const TASK_STATUSES = ["Pending", "Done", "Not Applicable"];

/** Why somebody leaves, for each kind of departure. */
export const REASONS_BY_TYPE = {
  Resignation: ["Better Opportunity", "Career Change", "Relocation", "Personal / Family Reasons", "Further Studies", "Health Reasons", "Other"],
  Termination: ["Performance", "Misconduct", "Restructuring", "Redundancy", "Probation Not Passed", "Other"],
  "End of Contract": ["Contract Expired - Not Renewed", "Project Completed", "Other"],
  Retirement: ["Statutory Retirement Age", "Early Retirement", "Medical Retirement"],
};

export function offboardingFromApi(c) {
  return {
    id: c.id,
    caseNo: c.caseNo,
    employeeId: c.employeeId,
    employee: c.employee || null,
    employeeName: c.employee?.shortName || c.employee?.name || "",
    department: c.employee?.department || "",
    type: c.type,
    reason: c.reason || "",
    details: c.details || "",
    noticeDate: c.noticeDate || "",
    noticeDays: c.noticeDays ?? 0,
    noticeMode: c.noticeMode,
    lastWorkingDate: c.lastWorkingDate || "",
    noticeDaysRemaining: c.noticeDaysRemaining ?? 0,
    status: c.status,
    initiatedByParty: c.initiatedByParty,
    decisionMaker: c.decisionMaker,
    initiatedBy: c.initiatedByName || "",
    decidedBy: c.decidedByName || "",
    decidedAt: c.decidedAt || "",
    decisionComment: c.decisionComment || "",
    completedBy: c.completedByName || "",
    completedAt: c.completedAt || "",
    createdAt: c.createdAt || "",
    progress: c.progress || { total: 0, cleared: 0, required: 0, requiredOpen: 0 },
    exitInterview: c.exitInterview || null,
    settlement: c.settlement || null,
    // Only on an opened case:
    tasks: c.tasks || [],
    assets: c.assets || [],
    assetsOutstanding: c.assetsOutstanding ?? 0,
    settlementEstimate: c.settlementEstimate || null,
    blockers: c.blockers || [],
    hasLogin: Boolean(c.hasLogin),
  };
}

const one = (json) => offboardingFromApi(json.data);

export const offboardingApi = {
  async list(query) {
    const json = await api("offboardings", { query });
    return (json?.data || []).map(offboardingFromApi);
  },
  async get(id) {
    return one(await api(`offboardings/${id}`));
  },
  async start(body) {
    return one(await api("offboardings", { method: "POST", body }));
  },
  async update(id, body) {
    return one(await api(`offboardings/${id}`, { method: "PATCH", body }));
  },
  async decide(id, decision, comment) {
    return one(await api(`offboardings/${id}/decision`, { method: "POST", body: { decision, comment: comment || null } }));
  },
  async setTask(id, taskId, status, notes) {
    return one(
      await api(`offboardings/${id}/tasks/${taskId}`, {
        method: "PATCH",
        body: { status, ...(notes !== undefined ? { notes: notes || null } : {}) },
      })
    );
  },
  async interview(id, body) {
    return one(await api(`offboardings/${id}/interview`, { method: "PUT", body }));
  },
  async complete(id) {
    return one(await api(`offboardings/${id}/complete`, { method: "POST" }));
  },
  async cancel(id, comment) {
    return one(await api(`offboardings/${id}/cancel`, { method: "POST", body: { comment } }));
  },
};
