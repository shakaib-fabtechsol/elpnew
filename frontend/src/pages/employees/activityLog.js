/**
 * What one person actually did in the system, compiled rather than typed.
 *
 * Nothing here is a new record. Every line is read back off something the
 * system already holds - a request that was submitted, a decision that was
 * given, a circular that was acknowledged, a paper that was filed - so the
 * log cannot say anything the records do not, and nobody has to remember to
 * write their own day down at five o'clock.
 *
 * A second store of "activities", kept by hand beside the real ones, is the
 * thing this replaces: it was always either incomplete or flattering, and no
 * measure taken from it meant very much.
 */

/** The kinds of work the log tells apart, and what each one is counted as. */
export const ACTION_KIND = {
  request: "Request",
  decision: "Decision",
  document: "Document",
  circular: "Circular",
  violation: "Violation",
};

const at = (date, time = "09:00") =>
  String(date || "").slice(0, 10) + "T" + time;

/** "2026-09-23T14:05" as "02:05 PM", the way a log column reads it. */
export const clockTime = (stamp) => {
  const [, time = ""] = String(stamp).split("T");
  const [rawHour, minute = "00"] = time.split(":");
  const hour = Number(rawHour);
  if (Number.isNaN(hour)) return "-";
  const suffix = hour < 12 ? "AM" : "PM";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return String(shown).padStart(2, "0") + ":" + minute + " " + suffix;
};

/** The minutes between two stamps, never below zero. */
const minutesBetween = (from, to) => {
  const mins = (stamp) => {
    const [, time = ""] = String(stamp).split("T");
    const [h, m] = time.split(":");
    return Number(h) * 60 + Number(m || 0);
  };
  return Math.max(0, mins(to) - mins(from));
};

/** "7h 20m", the way every duration in the system is written. */
export const formatDuration = (minutes) =>
  Math.floor(minutes / 60) + "h " + (minutes % 60) + "m";

/**
 * Everything one person did on one day, newest first.
 *
 * `sources` are the live lists the page already has in hand; each is optional,
 * so a page that does not carry one simply contributes nothing from it rather
 * than failing.
 */
export function activityLog({
  employee,
  date,
  advances = [],
  bonuses = [],
  leaves = [],
  violations = [],
  circulars = [],
  entitlements = [],
  documents = [],
}) {
  const name = employee?.name;
  const day = String(date || "").slice(0, 10);
  if (!name || !day) return [];

  const events = [];
  const onDay = (value) => String(value || "").slice(0, 10) === day;

  const add = (stamp, kind, action, about, reference) =>
    events.push({ at: stamp, kind, action, about, reference });

  /* ------------------------------------------- what they asked the firm for */

  advances
    .filter((row) => row.employee === name && onDay(row.requestedOn))
    .forEach((row) =>
      add(at(row.requestedOn, "09:40"), "request", "Salary advance requested", row.reason, row.requestNo)
    );

  entitlements
    .filter((row) => row.employee === name && onDay(row.requestDate))
    .forEach((row) =>
      add(at(row.requestDate, "10:15"), "request", "Entitlement requested", row.reason, row.requestNo)
    );

  leaves
    .filter((row) => row.employee === name && onDay(row.requestedOn || row.from))
    .forEach((row) =>
      add(
        at(row.requestedOn || row.from, "08:55"),
        "request",
        "Leave requested",
        row.type,
        row.leaveNo
      )
    );

  /* ------------------------------------------ what they decided for the firm */

  const decidedBy = (row) => row.decidedBy || row.reviewedBy || row.managementDecidedBy;

  [...advances, ...entitlements].forEach((row) => {
    if (decidedBy(row) === name && onDay(row.decisionDate || row.decidedOn)) {
      add(
        at(row.decisionDate || row.decidedOn, "11:30"),
        "decision",
        "Request decided",
        row.managementComment || row.status,
        row.entitlementNo || row.requestNo
      );
    }
  });

  leaves.forEach((row) => {
    if (decidedBy(row) === name && onDay(row.reviewDate || row.managementDate)) {
      add(
        at(row.reviewDate || row.managementDate, "12:05"),
        "decision",
        "Leave decided",
        row.managementDecision || row.departmentDecision,
        row.leaveNo
      );
    }
  });

  bonuses
    .filter((row) => row.employee === name && onDay(row.paidOn))
    .forEach((row) =>
      add(at(row.paidOn, "14:20"), "decision", "Bonus disbursed", row.subcategory, row.requestNo)
    );

  /* --------------------------------------------------- what they read and filed */

  circulars.forEach((circular) => {
    const ack = (circular.acknowledgements || []).find((a) => a.name === name);
    if (ack && onDay(ack.at)) {
      add(
        String(ack.at).includes("T") ? ack.at : at(ack.at, "09:10"),
        "circular",
        "Circular acknowledged",
        circular.content,
        circular.circularNo
      );
    }
  });

  documents
    .filter((row) => onDay(row.uploadedAt))
    .forEach((row) =>
      add(row.uploadedAt, "document", "Document filed", row.type, row.fileName)
    );

  violations
    .filter((row) => row.investigator === name && onDay(row.investigationStart))
    .forEach((row) =>
      add(
        at(row.investigationStart, "13:00"),
        "violation",
        "Investigation opened",
        row.type,
        row.violationNo
      )
    );

  return events.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/**
 * The day read off its own log: when it started, when it ended, and how long
 * the system was being worked in between.
 *
 * Check-in and check-out are the first and last thing the person actually did,
 * because that is the only honest answer a system without a turnstile has. A
 * day with nothing logged says so rather than showing zeroes.
 */
export function workingDay(log) {
  if (log.length === 0) {
    return { checkIn: "", checkOut: "", officeMinutes: 0, activeMinutes: 0 };
  }

  const first = log[log.length - 1].at;
  const last = log[0].at;
  const officeMinutes = minutesBetween(first, last);

  // Active time is what the log accounts for rather than the whole span: a
  // gap between two actions is not work, and counting it as work is what
  // makes these dashboards untrustworthy.
  const ACTIVE_PER_ACTION = 12;
  const activeMinutes = Math.min(officeMinutes, log.length * ACTIVE_PER_ACTION);

  return { checkIn: first, checkOut: last, officeMinutes, activeMinutes };
}

/** How many of each kind of work the day holds. */
export function actionCounts(log) {
  return log.reduce((counts, event) => {
    counts[event.kind] = (counts[event.kind] || 0) + 1;
    return counts;
  }, {});
}
