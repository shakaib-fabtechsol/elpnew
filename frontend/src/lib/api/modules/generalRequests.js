import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { replaceAll } from "../store";
import { initialGeneralRequests } from "@/pages/employees/generalRequestData";

/**
 * General requests, grievances and complaints (/general-requests?kind=).
 * One endpoint for all three; `kind` tells them apart, as it does on screen.
 */

/** "general/7/x1y2.pdf" -> "x1y2.pdf" */
const fileName = (path) => (path ? String(path).split("/").pop() : "");

export function generalRequestFromApi(r) {
  return {
    id: r.id,
    kind: r.kind || "general",
    employee: r.employee?.name || "",
    employeeId: r.employeeId,
    requestNo: r.requestNo,
    requestType: r.requestType,
    comment: r.comment || "",
    document: fileName(r.document),
    date: r.date || "",
    status: r.status,
    decisionDate: r.decisionDate || "",
    remarks: r.remarks || "",
    reviewedBy: r.reviewedBy || "",
  };
}

export const generalRequestsApi = {
  async submit(kind, draft, employeeId, document) {
    const json = await api("general-requests", {
      method: "POST",
      body: {
        kind,
        employeeId,
        requestType: draft.requestType,
        comment: String(draft.comment || "").trim(),
        document: document || null,
      },
    });
    return generalRequestFromApi(json.data);
  },

  /** "Approved" or "Rejected"; a refusal has to say why. */
  async decide(id, { answer, comment }) {
    const json = await api(`general-requests/${id}/decision`, {
      method: "POST",
      body: { decision: answer, remarks: String(comment || "").trim() || null },
    });
    return generalRequestFromApi(json.data);
  },
};

registerLoader("general requests", async () => {
  const rows = await fetchAll("general-requests");
  replaceAll(initialGeneralRequests, rows.map(generalRequestFromApi));
});
