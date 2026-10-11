import { api } from "../client";

/**
 * The Smart Request (/requests/interpret, /revise, /retype, /submit).
 *
 * The employee writes what they need, or attaches a document; the server
 * (OpenAI or Gemini, or plain rules when AI is not switched on) proposes the request
 * type and its fields. The proposal is reviewed on screen and only then
 * submitted - through the module's own endpoint on the server, so every
 * limit and the whole approval workflow apply as they do for the fixed forms.
 */

/** The screens' invoice panel reads the supplier's number as `supplierId`. */
const draftFromApi = (draft) => ({
  ...draft,
  risk: draft.risk?.supplier
    ? { ...draft.risk, supplier: { ...draft.risk.supplier, supplierId: draft.risk.supplier.supplierNo } }
    : draft.risk || null,
});

/** The values of a draft's fields, by key. */
export const valuesOf = (fields) =>
  Object.fromEntries((fields || []).map((field) => [field.key, field.value ?? ""]));

/**
 * A request made from the box belongs to one of a dozen lists, each held by
 * its own screen. Rather than teach the box about every one of them, the
 * records are loaded again as at sign-in - and what was just created is kept
 * here across that reload, so the page comes back on the new request's list
 * and says that it was sent.
 */
const CREATED_KEY = "sadeed.smartRequest";

export const createdRequest = {
  /** The request just created for this employee, if the page is coming back from one. */
  read(employeeId) {
    try {
      const kept = JSON.parse(sessionStorage.getItem(CREATED_KEY) || "null");
      return kept && kept.employeeId === employeeId ? kept : null;
    } catch {
      return null;
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(CREATED_KEY);
    } catch {
      // Storage switched off: there is nothing kept to clear.
    }
  },
  /** Keeps it and asks for the records to be loaded again. */
  reload(employeeId, result) {
    try {
      sessionStorage.setItem(
        CREATED_KEY,
        JSON.stringify({ employeeId, type: result.type, typeLabel: result.typeLabel, requestNo: result.requestNo || "" })
      );
    } catch {
      // Without storage the lists still reload; only the note is lost.
    }
    window.dispatchEvent(new CustomEvent("sadeed:reload"));
  },
};

export const unifiedApi = {
  /** What the text and/or document is understood to be asking for. */
  async interpret({ text, file, employeeId }) {
    const json = await api("requests/interpret", {
      method: "POST",
      body: { text: text || null, file: file || null, employeeId: employeeId || null },
    });
    return draftFromApi(json.data);
  },

  /**
   * The draft brought up to date from what the employee says next: an answer
   * to a question, another document, or a correction in their own words.
   */
  async revise({ type, values, invoice, message, file, employeeId }) {
    const fields = Object.fromEntries(Object.entries(values || {}).filter(([, value]) => value !== "" && value != null));
    const json = await api("requests/revise", {
      method: "POST",
      body: { type, fields, invoice: invoice || null, message: message || null, file: file || null, employeeId: employeeId || null },
    });
    return draftFromApi(json.data);
  },

  /** The same review for a type picked by hand, keeping what carries over. */
  async retype({ type, values, invoice, employeeId }) {
    const json = await api("requests/retype", {
      method: "POST",
      body: { type, fields: values, invoice: invoice || null, employeeId: employeeId || null },
    });
    return draftFromApi(json.data);
  },

  /** Creates the request; returns { type, typeLabel, requestNo, record }. */
  async submit({ type, values, invoice, file, employeeId }) {
    const fields = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value === "" ? null : value])
    );
    const json = await api("requests/submit", {
      method: "POST",
      body: { type, fields, invoice: invoice || null, file: file || null, employeeId: employeeId || null },
    });
    return json.data;
  },
};
