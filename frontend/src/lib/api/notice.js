/**
 * A message from the server that the person should see - a refusal, a lost
 * connection - shown by <ApiNotice /> at the foot of the screen. Kept outside
 * React so any provider or handler can raise one without passing anything down.
 */

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Shows a message: "error" (default) or "success". `lines` lists details
 * under it (one per field the server refused); `sticky` keeps it until it is
 * closed, for a list too long to read in a few seconds.
 */
export function notify(message, tone = "error", { lines = [], sticky = false } = {}) {
  if (!message) return;
  listeners.forEach((listener) => listener({ message, tone, lines, sticky, at: Date.now() }));
}

/** "accountNumber" -> "Account Number"; "invoice.items.0.name" -> "Invoice Items 1 Name". */
export const fieldLabel = (key) =>
  String(key)
    .split(".")
    .map((part) => (/^\d+$/.test(part) ? String(Number(part) + 1) : part))
    .join(" ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/ (.)/g, (m) => m.toUpperCase());

/**
 * Every field the server refused, as "Label: message" lines - so the person
 * knows which field to correct, even when it sits on another step.
 */
export const errorLines = (error, labels = {}) =>
  Object.entries(error?.errors || {}).map(
    ([field, messages]) => (labels[field] || fieldLabel(field)) + ": " + [].concat(messages)[0]
  );

/** Shows a refusal: the server's own words, then each field it named. */
export function notifyError(error, labels) {
  const lines = errorLines(error, labels);
  notify(
    lines.length ? "Please correct the following and try again:" : error?.message || "Something went wrong.",
    "error",
    { lines, sticky: lines.length > 1 }
  );
}

/**
 * Runs a server call and reports a refusal instead of throwing it. Returns
 * the result, or null when it failed - so a handler can simply stop.
 */
export async function attempt(call, labels) {
  try {
    return await call();
  } catch (error) {
    notifyError(error, labels);
    return null;
  }
}
