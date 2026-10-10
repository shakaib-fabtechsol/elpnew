import { expiryState, EXPIRY_LABEL } from "@/lib/expiry";

/**
 * The dated papers the firm tracks against a client.
 *
 * Adding another tracked document means adding a line here and nothing else -
 * the alerts, the bell and the panel all read from this one list.
 */
const TRACKED = [
  {
    documentType: "Reference No.",
    numberField: "referenceNo",
    dateField: "referenceExpiryDate",
  },
  {
    documentType: "POA No.",
    numberField: "poaNo",
    dateField: "poaExpiryDate",
  },
];

/**
 * Every client paper that is running out or has already run out.
 *
 * Worked out from the records every time rather than stored: an alert is a
 * reading of a date, and a stored alert would go on claiming a document is
 * expiring after somebody has renewed it. Soonest first, because that is the
 * order they need dealing with.
 */
export function expiryAlerts(clients) {
  const alerts = [];

  for (const client of clients) {
    for (const tracked of TRACKED) {
      const date = client[tracked.dateField];
      const state = expiryState(date);
      if (state !== "soon" && state !== "expired") continue;

      alerts.push({
        // Stable across renders and reloads, so "already read" means something.
        id: client.id + ":" + tracked.dateField,
        clientId: client.id,
        clientNo: client.clientNo,
        clientName: client.clientName,
        documentType: tracked.documentType,
        number: client[tracked.numberField],
        expiryDate: date,
        state,
        status: EXPIRY_LABEL[state],
      });
    }
  }

  return alerts.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

const READ_KEY = "elp.expiryAlerts.read";

/** The alerts this browser has already been shown. */
export function readAlertIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(READ_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function writeAlertIds(ids) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(ids));
  } catch {
    // A browser that refuses storage still works; it just alerts again.
  }
}
