/**
 * How everything on Financial Benefits is asked for.
 *
 * A salary, a bonus, a loan, assistance, a commission - each is entered in a
 * window over its list, and each lands on that list straight away under a
 * temporary number, waiting on a decision. Approved, it takes the list's own
 * number; refused, it keeps the temporary one and says why. So the temporary
 * number is the thread the whole request hangs on, and clicking it opens the
 * window again.
 *
 * The rule lives here because five lists follow it and a rule written five
 * times is a rule five places can disagree about.
 */

export const REQUEST_PENDING = "Pending";
export const REQUEST_REJECTED = "Rejected";

/** How a request's state is dressed wherever it is shown. */
export const REQUEST_STATUS_CHIP = {
  [REQUEST_PENDING]: "bg-amber-100 text-amber-800",
  [REQUEST_REJECTED]: "bg-red-100 text-red-800",
};

/**
 * "REQ-001": the next temporary number on a list.
 *
 * Counted off the temporary numbers already handed out, never off the list's
 * own numbering, so the two runs cannot collide.
 */
export const nextRequestNo = (rows, prefix = "REQ") =>
  prefix +
  "-" +
  String(
    rows.reduce(
      (max, row) =>
        Math.max(max, Number(String(row.requestNo || "").replace(/\D/g, "")) || 0),
      0
    ) + 1
  ).padStart(3, "0");

/** A row nobody has decided yet is still a request, whatever else it holds. */
export const isRequest = (row, settledKey) => !row?.[settledKey];
