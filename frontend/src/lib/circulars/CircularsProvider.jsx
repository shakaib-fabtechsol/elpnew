import { useState } from "react";
import {
  CircularsContext,
  initialCirculars,
  initialAudit,
  pendingCirculars,
} from "./context";
import { circularsApi } from "@/lib/api/modules/circulars";
import { attempt } from "@/lib/api/notice";
import { upserted } from "@/lib/api/store";

/**
 * Holds the firm's circulars, who has acknowledged them, and what has happened
 * to them - loaded from the API at sign-in.
 *
 * Kept above the router so the same list is read by the page that issues
 * circulars, by the employee's own copy, and by the prompt that blocks the
 * application until they are read - one list, so a circular cannot be
 * outstanding in one place and settled in another.
 *
 * Nothing here ever deletes or overwrites: a correction adds a version, a
 * withdrawal changes a status, and the server writes every one of those to
 * the audit trail, which is read back after each.
 */
export default function CircularsProvider({ children }) {
  const [circulars, setCirculars] = useState(initialCirculars);
  const [pending, setPending] = useState(pendingCirculars);
  const [audit, setAudit] = useState(initialAudit);

  const keep = (record) => {
    if (record) setCirculars((prev) => upserted(prev, record));
    return record;
  };

  /** The trail again, as the server now has it. */
  const refreshAudit = async () => {
    const rows = await attempt(() => circularsApi.audit());
    if (rows) setAudit(rows);
  };

  /**
   * A new circular. `file` is the written circular, when one is attached; it
   * stays viewable from this browser until the page is reloaded.
   */
  const issueCircular = async (circular, file) => {
    const saved = await attempt(() => circularsApi.issue(circular, file));
    if (!saved) return null;
    keep({ ...saved, fileUrl: file ? circular.fileUrl : "" });
    refreshAudit();
    return saved;
  };

  /**
   * Corrects a circular by issuing a new one in its place. The server marks
   * the original superseded and keeps every acknowledgement against it, so
   * the whole list is read again to show both versions as they now stand.
   */
  const reviseCircular = async (originalId, circular, file) => {
    const saved = await attempt(() => circularsApi.revise(originalId, circular, file));
    if (!saved) return null;
    const rows = await attempt(() => circularsApi.list());
    if (rows) setCirculars(rows);
    else keep(saved);
    refreshAudit();
    return saved;
  };

  const cancelCircular = async (id) => {
    const saved = keep(await attempt(() => circularsApi.cancel(id)));
    if (saved) refreshAudit();
    return saved;
  };

  /**
   * The signed-in person's acknowledgement - the server records whose and
   * when. What is still waiting on them is read again afterwards.
   */
  const acknowledge = async (id) => {
    const saved = keep(await attempt(() => circularsApi.acknowledge(id)));
    if (!saved) return null;
    setPending((prev) => prev.filter((c) => c.id !== id));
    const still = await attempt(() => circularsApi.pending());
    if (still) setPending(still);
    refreshAudit();
    return saved;
  };

  return (
    <CircularsContext
      value={{
        circulars,
        pending,
        audit,
        issueCircular,
        reviseCircular,
        cancelCircular,
        acknowledge,
      }}
    >
      {children}
    </CircularsContext>
  );
}
