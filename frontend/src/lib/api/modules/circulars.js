import { api } from "../client";
import { registerLoader } from "../session";
import { replaceAll } from "../store";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import {
  initialCirculars,
  initialAudit,
  pendingCirculars,
  stamp,
} from "@/lib/circulars/context";

/**
 * Circulars (/circulars, ?pending=1, /revise, /cancel, /acknowledge,
 * /circulars-audit).
 *
 * The API records an acknowledgement against the employee, with an ISO time;
 * the screens read who by name and when as "12/01/2026 09:40 AM". The firm's
 * finance team is "Accounting" on the server and "Finance" on screen. Those
 * translations live here.
 */

const GROUP_FROM_API = { Accounting: "Finance" };
const GROUP_TO_API = { Finance: "Accounting" };

/** An ISO moment as the screens show one, to the minute. */
const shown = (iso) => (iso ? stamp(new Date(iso)) : "");

export function circularFromApi(c) {
  return {
    id: c.id,
    circularNo: c.circularNo,
    branch: c.branch || "general",
    fileName: c.fileName || "",
    // The server keeps the paper but offers no download of it yet.
    fileUrl: "",
    date: c.date,
    targetGroup: GROUP_FROM_API[c.targetGroup] || c.targetGroup,
    content: c.content || "",
    issuedBy: c.issuedBy || "",
    status: c.status,
    supersedes: c.supersedes ?? null,
    supersededBy: c.supersededBy ?? null,
    acknowledgements: (c.acknowledgements || []).map((a) => ({
      employeeId: a.employeeId,
      name: a.name || "",
      at: shown(a.at),
    })),
  };
}

const auditFromApi = (e) => ({
  id: e.id,
  at: shown(e.at),
  action: e.action,
  circularNo: e.circularNo || "",
  by: e.by || "",
  detail: e.comment || "",
});

const circularBody = (circular, file) => ({
  date: circular.date,
  targetGroup: GROUP_TO_API[circular.targetGroup] || circular.targetGroup,
  branch: circular.branch || "general",
  content: circular.content,
  file: file || null,
});

export const circularsApi = {
  async list() {
    return ((await api("circulars")).data || []).map(circularFromApi);
  },

  /** The ones still waiting on the signed-in employee, oldest first. */
  async pending() {
    if (!CURRENT_USER.employeeId) return [];
    const rows = ((await api("circulars", { query: { pending: 1 } })).data || []).map(circularFromApi);
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  },

  /** Oldest first, as the trail is read. */
  async audit() {
    if (!CURRENT_USER.permissions?.manage) return [];
    return ((await api("circulars-audit")).data || []).map(auditFromApi).reverse();
  },

  async issue(circular, file) {
    return circularFromApi((await api("circulars", { method: "POST", body: circularBody(circular, file) })).data);
  },

  async revise(id, circular, file) {
    return circularFromApi((await api(`circulars/${id}/revise`, { method: "POST", body: circularBody(circular, file) })).data);
  },

  async cancel(id) {
    return circularFromApi((await api(`circulars/${id}/cancel`, { method: "POST" })).data);
  },

  async acknowledge(id) {
    return circularFromApi((await api(`circulars/${id}/acknowledge`, { method: "POST" })).data);
  },
};

registerLoader("circulars", async () => {
  const [rows, pending, audit] = await Promise.all([
    circularsApi.list(),
    circularsApi.pending(),
    circularsApi.audit(),
  ]);
  replaceAll(initialCirculars, rows);
  replaceAll(pendingCirculars, pending);
  replaceAll(initialAudit, audit);
});
