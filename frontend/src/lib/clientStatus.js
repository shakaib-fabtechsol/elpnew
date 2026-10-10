// Client status model, per the client's Phase 1 specification.

/** Today as a plain YYYY-MM-DD in the user's own timezone. */
const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export const CLIENT_STATUSES = ["Active", "Inactive", "Merged"];

/**
 * The statuses an admin may set by hand.
 *
 * Merged is deliberately absent: it is only ever the outcome of a merge, run
 * from the Merge Clients screen, so it is never something to pick from a list.
 */
export const MANUAL_CLIENT_STATUSES = CLIENT_STATUSES.filter(
  (status) => status !== "Merged"
);

export const CLIENT_STATUS_VARIANT = {
  Active: "success",
  Inactive: "secondary",
  Merged: "outline",
};

/**
 * Status is derived from case activity alone - never from finances. A client
 * whose cases are all closed but who still owes on an invoice stays Inactive.
 *
 *   Merged   - merged into another client. The record stays readable so the
 *              cases it brought in before the merger remain visible.
 *   Active   - at least one open case. Applied the moment a case is opened,
 *              which covers both first activation and later reactivation.
 *   Inactive - no open cases. Applied the moment the last one closes, with no
 *              waiting period.
 *
 * `statusOverride` lets an admin pin a status by hand; a merge still wins over
 * it, since the merge is a structural fact rather than a judgement call.
 */
export function deriveClientStatus(client) {
  if (client.mergedIntoClientNo) return "Merged";
  // A deactivation date takes effect on the day it is reached, and outranks a
  // manual override - the date was set deliberately, for that day.
  if (client.deactivationDate && client.deactivationDate <= todayIso()) {
    return "Inactive";
  }
  if (client.statusOverride) return client.statusOverride;
  return client.activeCases > 0 ? "Active" : "Inactive";
}
