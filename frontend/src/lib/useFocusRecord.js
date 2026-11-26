import { useEffect, useRef } from "react";

/**
 * Opens one record of a list as soon as it is there.
 *
 * A request's own section (a loan, a bonus, an allowance...) opens a request
 * by its id when the page that shows it already knows which one is wanted -
 * the firm's Requests list hands over the request somebody pressed, and the
 * section opens it exactly as a click on its own row would.
 *
 *   useFocusRecord(focusId, records, track);
 *
 * `open` is the section's own way of opening a row. It runs once per id, a
 * moment after the records arrive, so it never sets state while rendering.
 */
export default function useFocusRecord(focusId, records, open) {
  const latest = useRef(open);
  useEffect(() => {
    latest.current = open;
  });
  const done = useRef(null);

  useEffect(() => {
    if (focusId == null || done.current === focusId) return undefined;
    const record = (records || []).find((one) => one.id === focusId);
    if (!record) return undefined;
    const timer = setTimeout(() => {
      done.current = focusId;
      latest.current?.(record);
    }, 0);
    return () => clearTimeout(timer);
  }, [focusId, records]);
}
