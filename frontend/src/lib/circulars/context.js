import { createContext, useContext } from "react";
import { employeeRecords } from "@/pages/employees/employeeData";

/**
 * Who a circular is addressed to.
 *
 * Groups rather than names: a circular is issued to a part of the firm and
 * stays addressed to it as people join and leave, which a list of names would
 * not do.
 */
export const ALL_EMPLOYEES = "All Employees";

export const TARGET_GROUPS = [
  ALL_EMPLOYEES,
  "Administration",
  "Finance",
  "Lawyers",
];

/** Where each job sits, for the purpose of being addressed. */
const GROUP_BY_ROLE = {
  Lawyer: "Lawyers",
  Accountant: "Finance",
};

export const groupOf = (employee) =>
  GROUP_BY_ROLE[employee.role] || "Administration";

/* ------------------------------------------------------------- the states */

/**
 * What a circular is doing now.
 *
 * A circular is never edited in place, so it never simply disappears: it is
 * either in force, replaced by a later version, or withdrawn. All three stay
 * on the record.
 */
export const ACTIVE = "Active";
export const COMPLETED = "Completed";
export const CANCELLED = "Cancelled";

export const STATUS_LABEL = {
  [ACTIVE]: "Active",
  [COMPLETED]: "Completed (superseded)",
  [CANCELLED]: "Cancelled",
};

export const STATUS_TONE = {
  [ACTIVE]: "bg-green-100 text-green-700",
  [COMPLETED]: "bg-muted text-muted-foreground",
  [CANCELLED]: "bg-red-100 text-red-700",
};

/* --------------------------------------------------------------- the stores */

/**
 * Circulars already issued, who has acknowledged them, and what has happened
 * to them - filled from the API at sign-in (src/lib/api/modules/circulars.js).
 *
 * `acknowledgements` is a list rather than a flag because a circular is issued
 * to a group: it is read by many people, and the firm has to be able to say
 * which of them have read it and when. `branch` is the office it applies to -
 * "general" when it covers the whole company. `supersedes` and `supersededBy`
 * link the versions of one instruction: a correction never edits what went
 * out, it issues a new circular and points the two at each other.
 */
export const initialCirculars = [];

/** What has happened to the circulars, in the order it happened. */
export const initialAudit = [];

/**
 * The circulars the signed-in person still has to acknowledge, as the server
 * counts them - it knows who each circular was issued to.
 */
export const pendingCirculars = [];

/* ------------------------------------------------------- what the app reads */

export const CircularsContext = createContext({
  circulars: [],
  pending: [],
  audit: [],
  issueCircular: () => {},
  reviseCircular: () => {},
  cancelCircular: () => {},
  acknowledge: () => {},
});

export const useCirculars = () => useContext(CircularsContext);

/** Everyone a circular is addressed to. */
export const audienceFor = (circular) =>
  circular.targetGroup === ALL_EMPLOYEES
    ? employeeRecords
    : employeeRecords.filter((e) => groupOf(e) === circular.targetGroup);

export const addressedTo = (circular, group) =>
  circular.targetGroup === ALL_EMPLOYEES || circular.targetGroup === group;

export const acknowledgementBy = (circular, name) =>
  circular.acknowledgements.find((a) => a.name === name) || null;

export const acknowledgedBy = (circular, name) =>
  Boolean(acknowledgementBy(circular, name));

/** "18 / 25 Acknowledged" */
export const acknowledgementCount = (circular) =>
  circular.acknowledgements.length + " / " + audienceFor(circular).length;

/**
 * The circulars one person still has to read, oldest first.
 *
 * Only circulars in force: a withdrawn one asks nothing of anybody, and a
 * superseded one has been replaced by a version that does. A new version is a
 * new circular, so it needs its own acknowledgement.
 */
export function pendingFor(circulars, group, name) {
  return circulars
    .filter(
      (c) =>
        c.status === ACTIVE && addressedTo(c, group) && !acknowledgedBy(c, name)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Every circular one person is addressed by, newest first. */
export function circularsFor(circulars, group) {
  return circulars
    .filter((c) => addressedTo(c, group))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** "CIR-2026-004" - the number the next circular will be given. */
export function nextCircularNo(circulars, year = new Date().getFullYear()) {
  const serial = circulars.reduce((max, c) => {
    const parts = String(c.circularNo).split("-");
    if (Number(parts[1]) !== year) return max;
    return Math.max(max, Number(parts[2]) || 0);
  }, 0);
  return "CIR-" + year + "-" + String(serial + 1).padStart(3, "0");
}

/* ------------------------------------------------------------------- dates */

export const today = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate())
  );
};

/** "2026-02-03" as "03/02/2026". */
export const formatDate = (value) => {
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
};

/** "02/09/2026 03:15 PM" - the moment something happened, to the minute. */
export function stamp(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const hour = now.getHours();
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return (
    pad(now.getDate()) +
    "/" +
    pad(now.getMonth() + 1) +
    "/" +
    now.getFullYear() +
    " " +
    pad(shown) +
    ":" +
    pad(now.getMinutes()) +
    (hour < 12 ? " AM" : " PM")
  );
}
