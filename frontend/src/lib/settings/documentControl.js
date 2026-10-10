/**
 * How the firm treats an employee whose critical paper has lapsed.
 *
 * Set on System Settings and read wherever an employee's access is shown.
 * Held in this browser until there is a server to hold it for the firm; the
 * two functions below are the only things that know where it is kept, so
 * moving it there changes this file and nothing else.
 */

/** What happens to access once the grace period runs out. */
export const ACCESS_ACTIONS = ["Restrict access", "Suspend access"];

export const DEFAULT_DOCUMENT_CONTROL = {
  // Days after a critical paper has expired before access is held.
  graceDays: 5,
  action: "Suspend access",
};

const KEY = "elp.documentControl";

export function readDocumentControl() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved ? { ...DEFAULT_DOCUMENT_CONTROL, ...saved } : DEFAULT_DOCUMENT_CONTROL;
  } catch {
    return DEFAULT_DOCUMENT_CONTROL;
  }
}

export function writeDocumentControl(control) {
  try {
    localStorage.setItem(KEY, JSON.stringify(control));
  } catch {
    // A browser that refuses storage keeps the defaults.
  }
}
