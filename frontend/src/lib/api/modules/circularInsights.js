import { api } from "../client";

/**
 * Circulars understood and followed up: the AI brief of a circular, answers
 * to questions about it, who has opened it, and - for management - where
 * acknowledgement stands across the firm.
 */
export const circularInsightsApi = {
  /** Written once and kept with the circular; `refresh` asks for it again (management). */
  async brief(circularId, { refresh = false } = {}) {
    return (await api(`circulars/${circularId}/brief`, { method: "POST", query: refresh ? { refresh: 1 } : undefined })).data;
  },

  /** With no question: what the circular means for the person asking. */
  async ask(circularId, question) {
    return (await api(`circulars/${circularId}/ask`, { method: "POST", body: { question: question || null } })).data;
  },

  /** That the signed-in employee opened it. Never worth interrupting them over. */
  async markRead(circularId) {
    try {
      await api(`circulars/${circularId}/read`, { method: "POST" });
    } catch {
      // Reading is still reading if this could not be recorded.
    }
  },

  async compliance() {
    return (await api("circulars-compliance")).data;
  },
};
