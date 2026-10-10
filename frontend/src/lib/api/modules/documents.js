import { api, getToken } from "../client";
import { notify } from "../notice";
import { registerLoader } from "../session";
import { replaceAll, upsert } from "../store";
import { employeesLoaded } from "./employees";
import {
  correctionRequests,
  documentTypesFor,
  employeeDocuments,
  employeeRecords,
} from "@/pages/employees/employeeData";

/**
 * Employee documents and corrections (/employees/{id}/documents, /corrections).
 *
 * Papers are kept per employee on the API, but the list's Documents column,
 * its Expired Documents card and the notification bell read every
 * employee's papers at once - so they are loaded at sign-in, one small
 * request per employee the user can see (25 for management, one for anybody
 * else), side by side.
 */

const BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");

export function documentFromApi(d) {
  return {
    id: d.id,
    employeeId: d.employeeId,
    uploadedAt: d.uploadedAt || "",
    type: d.type,
    number: d.documentNumber || "",
    expiry: d.expiry || "",
    fileName: d.fileName || "",
    // Personal papers are served only to a signed-in user: viewing one fetches
    // it with the token (viewDocument) rather than opening a public link.
    fileUrl: "",
    downloadPath: d.fileName ? `employees/${d.employeeId}/documents/${d.id}/download` : "",
    notes: d.notes || "",
  };
}

/** The kinds the API files; a kind it does not know is filed as Other, named in the notes. */
const fileableType = (type, notes) =>
  documentTypesFor().includes(type)
    ? { type, notes: notes || null }
    : { type: "Other", notes: [type, notes].filter(Boolean).join(" - ") || null };

export const documentsApi = {
  /** One paper with its copy; the server stamps when and by whom. */
  async upload(employeeId, { type, file, number, expiry, notes }) {
    const json = await api(`employees/${employeeId}/documents`, {
      method: "POST",
      body: {
        ...fileableType(type, notes),
        file,
        documentNumber: number || null,
        expiry: expiry || null,
      },
    });
    return upsert(employeeDocuments, documentFromApi(json.data));
  },

  async remove(employeeId, id) {
    await api(`employees/${employeeId}/documents/${id}`, { method: "DELETE" });
    replaceAll(employeeDocuments, employeeDocuments.filter((doc) => doc.id !== id));
  },
};

/** Opens a filed paper in a new tab, fetched with the signed-in user's token. */
export async function viewDocument(paper) {
  if (paper.fileUrl) {
    window.open(paper.fileUrl, "_blank", "noopener,noreferrer");
    return;
  }
  // Opened before the fetch, so the browser does not take it for a pop-up.
  const tab = window.open("", "_blank");
  try {
    const response = await fetch(BASE + "/" + paper.downloadPath, {
      headers: { Authorization: "Bearer " + getToken() },
    });
    if (!response.ok) throw new Error();
    const url = URL.createObjectURL(await response.blob());
    if (tab) tab.location.href = url;
    else window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    tab?.close();
    notify("The copy of this document could not be opened.");
  }
}

registerLoader("employee documents", async () => {
  await employeesLoaded();
  const lists = await Promise.all(
    employeeRecords.map((employee) => api(`employees/${employee.id}/documents`))
  );
  replaceAll(employeeDocuments, lists.flatMap((json) => (json?.data || []).map(documentFromApi)));
});

/* ------------------------------------------------------------ corrections */

export function correctionFromApi(c) {
  return {
    id: c.id,
    employeeId: c.employeeId,
    section: c.section,
    changes: c.changes || [],
    status: c.status,
    submittedAt: c.createdAt || "",
    decisionComment: c.decisionComment || "",
    decidedAt: c.decidedAt || "",
  };
}

/**
 * Corrections asked for on a record. Nothing on screen sends or lists them
 * yet; these keep correctionRequests (employeeData.js) in step with the API
 * for the screen that will.
 */
export const correctionsApi = {
  async list(employeeId) {
    const json = await api(`employees/${employeeId}/corrections`);
    const rows = json.data.map(correctionFromApi);
    replaceAll(correctionRequests, [
      ...correctionRequests.filter((r) => r.employeeId !== employeeId),
      ...rows,
    ]);
    return rows;
  },

  /** changes: [{ field, requested }] - the server records what each says now. */
  async submit(employeeId, section, changes) {
    const json = await api(`employees/${employeeId}/corrections`, {
      method: "POST",
      body: { section, changes },
    });
    return upsert(correctionRequests, correctionFromApi(json.data));
  },

  /** Approved changes the record on the server; Rejected needs a comment. */
  async decide(id, decision, comment) {
    const json = await api(`corrections/${id}/decision`, {
      method: "POST",
      body: { decision, comment: comment || null },
    });
    return upsert(correctionRequests, correctionFromApi(json.data));
  },
};
