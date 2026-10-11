import { api } from "../client";

/**
 * System Permissions (/employees/{id}/permissions): what one employee may
 * see and do - the catalogue, their settings, temporary access, the access
 * review and the history, all in one page of data.
 */

/** The settings as the server takes them, from the page's draft. */
const stateOf = (draft) => ({
  template: draft.template,
  grants: draft.grants,
  scope: draft.scope,
  departments: draft.scope === "department" ? draft.departments : [],
  approvalLimit: draft.approvalLimit === "" || draft.approvalLimit == null ? null : Number(draft.approvalLimit),
  paymentLimit: draft.paymentLimit === "" || draft.paymentLimit == null ? null : Number(draft.paymentLimit),
});

export const permissionsApi = {
  async load(employeeId) {
    return (await api(`employees/${employeeId}/permissions`)).data;
  },

  async save(employeeId, draft) {
    return (await api(`employees/${employeeId}/permissions`, { method: "PUT", body: stateOf(draft) })).data;
  },

  /** The access review for a draft that has not been saved. */
  async review(employeeId, draft) {
    return (await api(`employees/${employeeId}/permissions/review`, { method: "POST", body: stateOf(draft) })).data.risks;
  },

  /** An instruction in words -> a proposed change. Nothing is saved. */
  async assist(employeeId, draft, instruction) {
    return (await api(`employees/${employeeId}/permissions/assist`, { method: "POST", body: { ...stateOf(draft), instruction: instruction || null } })).data;
  },

  async delegate(employeeId, { permissions, fromEmployeeId, startsOn, endsOn, reason }) {
    return (
      await api(`employees/${employeeId}/permissions/delegations`, {
        method: "POST",
        body: { permissions, fromEmployeeId: fromEmployeeId || null, startsOn, endsOn, reason },
      })
    ).data;
  },

  async revoke(employeeId, delegationId) {
    return (await api(`employees/${employeeId}/permissions/delegations/${delegationId}`, { method: "DELETE" })).data;
  },
};
