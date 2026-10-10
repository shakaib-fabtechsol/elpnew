/**
 * Violations recorded against an employee, and what came of each.
 *
 * A violation goes through five stages, always in this order: it is recorded
 * and an investigation starts, the employee answers it, a penalty is decided,
 * the employee may appeal, and the appeal is settled. Each stage fills in its
 * own part of the one record - nothing is re-entered at a later stage.
 *
 * The violation is not numbered until a penalty is approved: a case that
 * ends in nothing never takes a number in the register.
 */

/** The stages, in order, with what each one is for. */
export const VIOLATION_STAGES = [
  { key: "violation", title: "Add Violation", note: "Basic violation details" },
  { key: "response", title: "Employee Response", note: "Response and supporting documents" },
  { key: "decision", title: "Decision", note: "Determine and issue the penalty" },
  { key: "appeal", title: "Appeal Against Decision", note: "Appeal grounds and documents" },
  { key: "outcome", title: "Appeal Outcome", note: "Outcome and manager approval" },
];

export const VIOLATION_TYPES = [
  "Attendance",
  "Unauthorized Absence",
  "Negligence",
  "Breach of Instructions",
  "Workplace Conduct",
  "Breach of Confidentiality",
  "Misuse of Office Assets",
  "Other",
];

export const INVESTIGATION_RESULTS = ["Guilty", "Not Guilty"];

export const PENALTY_TYPES = [
  "Written Notice",
  "Written Warning",
  "Final Warning",
  "Financial Deduction",
  "Suspension from Work",
  "Termination of Employment",
  "No Penalty",
];

/** The one penalty that takes an amount with it. */
export const DEDUCTION_PENALTY = "Financial Deduction";

/** A case that ends in no penalty is never numbered: nothing was issued. */
export const NO_PENALTY = "No Penalty";

export const APPEAL_OUTCOMES = [
  "Reject Appeal and Uphold Decision",
  "Partially Accept Appeal and Modify Penalty",
  "Accept Appeal and Cancel Penalty",
];

/** The one outcome that takes the penalty away again. */
export const CANCELLING_OUTCOME = "Accept Appeal and Cancel Penalty";

/** Where a violation has got to, as the status column reads it. */
export const VIOLATION_STATUS_TONE = {
  "Under Investigation": { dot: "bg-amber-400", chip: "bg-amber-100 text-amber-900" },
  "Penalty Issued": { dot: "bg-blue-500", chip: "bg-blue-100 text-blue-900" },
  "Under Appeal": { dot: "bg-violet-500", chip: "bg-violet-100 text-violet-900" },
  Closed: { dot: "bg-muted-foreground", chip: "bg-muted text-muted-foreground" },
  Cancelled: { dot: "bg-red-500", chip: "bg-red-100 text-red-800" },
};

/** Which stages a record has already been through. */
export const stagesDone = (record) => ({
  violation: Boolean(record),
  response: Boolean(record?.response),
  decision: Boolean(record?.penaltyType),
  appeal: Boolean(record?.appealGrounds),
  outcome: Boolean(record?.appealOutcome),
});

/** The first stage still to be done - where an open record picks up. */
export const nextStage = (record) => {
  const done = stagesDone(record);
  return (VIOLATION_STAGES.find((stage) => !done[stage.key]) || VIOLATION_STAGES[4]).key;
};

/**
 * "VIO-001", counted across the whole firm. Only violations that reached a
 * penalty are counted, because only those were ever given a number.
 */
export const nextViolationNo = (violations) =>
  "VIO-" +
  String(
    violations.reduce(
      (max, v) => Math.max(max, Number(String(v.violationNo || "").replace(/\D/g, "")) || 0),
      0
    ) + 1
  ).padStart(3, "0");

/** One person's violations, newest first. */
export const violationsFor = (violations, name) =>
  violations.filter((v) => v.employee === name).sort((a, b) => b.id - a.id);

export const initialViolations = [];
