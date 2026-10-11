import { api } from "../client";

/**
 * Employee Management (/employees/{id}/management): how one employee is
 * doing - standing, the signals read off their records, evaluations, the
 * development plan and the last management insight - and the firm-wide
 * view of who is doing well and who needs attention.
 */
export const managementApi = {
  async load(employeeId) {
    return (await api(`employees/${employeeId}/management`)).data;
  },

  /** Writes the management insight again from the records as they stand. */
  async writeInsight(employeeId) {
    return (await api(`employees/${employeeId}/management/insight`, { method: "POST" })).data;
  },

  async saveEvaluation(employeeId, evaluation) {
    const { id, ...body } = evaluation;
    return (
      await api(`employees/${employeeId}/evaluations` + (id ? "/" + id : ""), { method: id ? "PUT" : "POST", body })
    ).data;
  },

  async addAction(employeeId, action) {
    return (await api(`employees/${employeeId}/development`, { method: "POST", body: action })).data;
  },

  async updateAction(employeeId, id, changes) {
    return (await api(`employees/${employeeId}/development/${id}`, { method: "PATCH", body: changes })).data;
  },

  /** Everybody within the user's record access, by standing. */
  async standing() {
    return (await api("employees-standing")).data;
  },
};
