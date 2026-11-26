import { api } from "../client";

/**
 * Assigned assets (/employees/{id}/assets): the car, laptop, phone and work
 * ID issued to one employee, and whether each came back.
 *
 * Not loaded at sign-in: only the employee's own Assigned Assets screen reads
 * them, so they are fetched there, for that one person, when it opens.
 *
 * Nothing is ever deleted. Returning or disposing of an item stamps its date
 * and changes its status, and the row stays in the register as history.
 */

export const ASSET_TYPES = ["Car", "Computer / Laptop", "Mobile Phone", "Work ID Card"];

export const ASSET_STATUSES = ["Assigned", "Returned", "Disposed"];

export function assetFromApi(a) {
  return {
    id: a.id,
    employeeId: a.employeeId,
    type: a.type,
    assetNumber: a.assetNumber || "",
    makeModel: a.makeModel || "",
    serialNumber: a.serialNumber || "",
    issueDate: a.issueDate || "",
    returnDate: a.returnDate || "",
    disposalDate: a.disposalDate || "",
    status: a.status,
    notes: a.notes || "",
    recordedBy: a.recordedByName || "",
    recordedAt: a.createdAt || "",
  };
}

/** The fields of an item as the API takes them; blanks go as nothing. */
const toApi = ({ type, assetNumber, makeModel, serialNumber, issueDate, notes }) => ({
  type,
  assetNumber: (assetNumber || "").trim(),
  makeModel: makeModel || null,
  serialNumber: serialNumber || null,
  issueDate,
  notes: notes || null,
});

export const employeeAssetsApi = {
  /** The employee's register: items still out first, then the newest issued. */
  async list(employeeId) {
    const json = await api(`employees/${employeeId}/assets`);
    return (json?.data || []).map(assetFromApi);
  },

  /** Issues an item; the server records who did it and refuses a number already out. */
  async issue(employeeId, draft) {
    const json = await api(`employees/${employeeId}/assets`, { method: "POST", body: toApi(draft) });
    return assetFromApi(json.data);
  },

  /** date is YYYY-MM-DD, no earlier than the issue date and no later than today. */
  async markReturned(employeeId, id, date, notes) {
    const json = await api(`employees/${employeeId}/assets/${id}`, {
      method: "PATCH",
      body: { action: "return", returnDate: date, ...(notes ? { notes } : {}) },
    });
    return assetFromApi(json.data);
  },

  async markDisposed(employeeId, id, date, notes) {
    const json = await api(`employees/${employeeId}/assets/${id}`, {
      method: "PATCH",
      body: { action: "dispose", disposalDate: date, ...(notes ? { notes } : {}) },
    });
    return assetFromApi(json.data);
  },

  /** Corrects an item's details (number, model, serial, issue date, notes). */
  async update(employeeId, id, changes) {
    const body = Object.fromEntries(
      Object.entries(toApi({ ...changes })).filter(([key]) => key in changes)
    );
    const json = await api(`employees/${employeeId}/assets/${id}`, { method: "PATCH", body });
    return assetFromApi(json.data);
  },
};
