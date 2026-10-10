import { expiryState, EXPIRY_LABEL, daysUntil, addDays } from "@/lib/expiry";
/**
 * The people the firm employs.
 *
 * One record each, read by the list and by the form behind it, so a change to
 * the shape is made once.
 */

import {
  IDENTITY_DOCUMENT_TYPES,
  LAWYER_DOCUMENT_TYPE,
  LAWYER_MEMBERSHIP_TYPE,
  COMMON_DOCUMENT_TYPES,
  CRITICAL_DOCUMENT_TYPES,
} from "@/lib/constants";

export const employeeRecords = [];

/** The number the next new employee will be given: EMP-0026 and so on. */
export function nextEmployeeNo(records) {
  const highest = records.reduce((max, e) => {
    const serial = Number(String(e.empNo || '').split('-')[1]) || 0;
    return Math.max(max, serial);
  }, 0);
  return 'EMP-' + String(highest + 1).padStart(4, '0');
}

/**
 * Papers already on an employee's file.
 *
 * `uploadedAt` carries the time as well as the date because two documents are
 * often filed on the same day and the list is read newest first. Replaced
 * with the API's papers at sign-in (lib/api/modules/documents.js).
 */
export const employeeDocuments = [];

/**
 * Corrections asked for on an employee's record, waiting to be decided.
 *
 * A correction never changes the record by itself: it is held, with what
 * each field says now and what it should say, until somebody approves it.
 * Sent to and read from the API by correctionsApi (lib/api/modules/documents.js).
 */
export const correctionRequests = [];

/** The corrections still waiting on one employee's record, for one section. */
export const pendingCorrections = (employeeId, section) =>
  correctionRequests.filter(
    (r) => r.employeeId === employeeId && r.section === section && r.status === "Pending"
  );

/** The papers filed against one employee. */
export const documentsFor = (employeeId) =>
  employeeDocuments.filter((doc) => doc.employeeId === employeeId);

/** Whether any paper has been filed against them at all. */
export const hasDocuments = (employeeId) =>
  employeeDocuments.some((doc) => doc.employeeId === employeeId);

/**
 * The document types one employee can file.
 *
 * Every category offers its whole list, to everybody. Which papers a person
 * actually holds is answered by what they file, not by the system deciding
 * in advance which ones they are allowed to have.
 */
export function documentTypesFor() {
  return [
    ...IDENTITY_DOCUMENT_TYPES,
    LAWYER_DOCUMENT_TYPE,
    LAWYER_MEMBERSHIP_TYPE,
    ...COMMON_DOCUMENT_TYPES,
  ];
}

/** An employee's papers are chased three months before they lapse. */
export const DOCUMENT_EXPIRING_DAYS = 90;

/**
 * The papers a person holds one of at a time, and so keeps versions of: a
 * renewed passport is version 2 of the passport, and version 1 is archived.
 * A second degree or certificate is simply another paper, so the other types
 * are never versioned.
 */
const ONE_AT_A_TIME = [
  ...IDENTITY_DOCUMENT_TYPES,
  LAWYER_DOCUMENT_TYPE,
];

/** The heading each kind of paper is filed under. */
const DOCUMENT_CATEGORY = {
  "National ID": "Identity & Residency",
  "Residence Card": "Identity & Residency",
  Passport: "Identity & Residency",
  [LAWYER_DOCUMENT_TYPE]: "Professional Licenses",
  [LAWYER_MEMBERSHIP_TYPE]: "Professional Licenses",
  CV: "Qualifications & Experience",
  "University Degree": "Qualifications & Experience",
  "Experience Certificate": "Qualifications & Experience",
  "Training Certificate": "Qualifications & Experience",
  "Appointment Decision": "Administrative Decisions",
  "Promotion Decision": "Administrative Decisions",
  "Transfer Decision": "Administrative Decisions",
  "Warning Decision": "Administrative Decisions",
  "Termination Decision": "Administrative Decisions",
  "Committee Formation Decision": "Administrative Decisions",
  "Other Identity Document": "Identity & Residency",
  "Other Professional Licence": "Professional Licenses",
  "Other Qualification": "Qualifications & Experience",
  "Other Decision": "Administrative Decisions",
};

export const documentCategory = (type) => DOCUMENT_CATEGORY[type] || "Other";

/**
 * The papers that stand for details held elsewhere on the record: the copy
 * can only be filed once the number and expiry it is a copy of are saved,
 * so the paper and the record cannot disagree about which passport it is.
 * These are also the papers that expire; the rest are held as they are.
 */
const RELATED_RECORD = {
  "National ID": { number: "civilId", expiry: "idExpiry" },
  "Residence Card": { number: "civilId", expiry: "idExpiry" },
  Passport: { number: "passportNumber", expiry: "passportExpiry" },
  "Work Permit": { number: "workPermitNo", expiry: "workPermitExpiry" },
  // Asked for on Identity & Immigration; the Legal Practice section that
  // once held it was taken out.
  [LAWYER_DOCUMENT_TYPE]: { number: "lawyerCardNo", expiry: "lawyerCardExpiry" },
};

/** Whether a paper of this type runs out, and so asks for its expiry date. */
export const documentExpires = (type) => type in RELATED_RECORD;

/**
 * Whether this employee's saved record holds what a paper of this type
 * stands for. Types that stand for nothing can always be filed.
 */
export const hasRelatedRecord = (type, employee) => {
  const related = RELATED_RECORD[type];
  return !related || Boolean(employee?.[related.number] && employee?.[related.expiry]);
};

/** The number the record already holds for this type, to start the copy from. */
export const relatedNumber = (type, employee) =>
  RELATED_RECORD[type] ? employee?.[RELATED_RECORD[type].number] || "" : "";

/** The expiry the record already holds for this type, to start the copy from. */
export const relatedExpiry = (type, employee) =>
  RELATED_RECORD[type] ? employee?.[RELATED_RECORD[type].expiry] || "" : "";

/** Filed later than the other paper - by upload time, then by the order kept. */
const newer = (a, b) =>
  String(a.uploadedAt).localeCompare(String(b.uploadedAt)) > 0 ||
  (a.uploadedAt === b.uploadedAt && a.id > b.id);

/** Whether a paper of this type is kept in versions. */
export const isVersioned = (type) => ONE_AT_A_TIME.includes(type);

/**
 * Every version of a versioned paper on file, oldest first, numbered from 1.
 *
 * Nothing is ever overwritten: renewing a paper files a new one, so the
 * history is simply the papers of that type in the order they were filed.
 * The last is the current one; every one before it is archived.
 */
export function documentVersions(type, papers) {
  return papers
    .filter((paper) => paper.type === type)
    .sort((a, b) => (newer(a, b) ? 1 : -1))
    .map((paper, index, all) => ({
      ...paper,
      version: index + 1,
      current: index === all.length - 1,
    }));
}

/** Whether a newer version of this paper has been filed after it. */
const archived = (document, papers) =>
  isVersioned(document?.type) &&
  papers.some(
    (other) =>
      other.id !== document.id && other.type === document.type && newer(other, document)
  );

/**
 * Where a document stands.
 *
 * Archived first: once a newer version of the same paper is on file, the old
 * one is history whatever its date says, and nobody is chased about it.
 * Otherwise it is read off the expiry date on the firm's calendar - Expired
 * from the day after it, Expiring Soon from today to ninety days out, Active
 * beyond that. A paper with no expiry date never lapses, so it is Active.
 *
 * Worked out every time rather than stored, so a paper cannot claim to be
 * valid on a day its own expiry date has passed. `papers` is the employee's
 * file it is read against; a page holding its own copy of that file passes it.
 */
export function documentStatus(document, papers = documentsFor(document?.employeeId)) {
  if (archived(document, papers)) return "Archived";
  const state = expiryState(document?.expiry, DOCUMENT_EXPIRING_DAYS);
  return state === "none" ? "Active" : EXPIRY_LABEL[state];
}

/**
 * Reminders for employees' papers, for the notification bell.
 *
 * A paper is brought up ninety days before it expires, again at thirty, on
 * the day, and once it has expired - each of those is its own reminder, so
 * one read three months ago does not silence the one due today. Only the
 * current version is followed: an archived paper has been renewed.
 */
export function employeeDocumentAlerts() {
  const alerts = [];
  for (const employee of employeeRecords) {
    const papers = documentsFor(employee.id);
    for (const paper of papers) {
      if (!paper.expiry || archived(paper, papers)) continue;
      const days = daysUntil(paper.expiry);
      const milestone =
        days < 0 ? "expired" : days === 0 ? "today" : days <= 30 ? "30" : days <= 90 ? "90" : null;
      if (!milestone) continue;
      alerts.push({
        id: "employee:" + paper.id + ":" + milestone,
        title: employee.name,
        detail: paper.type,
        expiryDate: paper.expiry,
        state: days < 0 ? "expired" : "soon",
        status: days < 0 ? "Expired" : "Expiring Soon",
        href: "/employees/" + employee.id,
      });
    }
  }
  return alerts;
}

/**
 * Whether an employee's access is held for a lapsed critical paper.
 *
 * Only the current version of a critical paper counts - an archived one has
 * been renewed. Its first day expired starts the grace period; once that has
 * run out without a renewal, access is held with the action the firm chose.
 * The most serious answer wins: one held paper holds the whole account.
 *
 * Returns null when nothing is wrong, or { state: "grace" | "held", type,
 * expiry, until, daysLeft, action }.
 */
export function accessHold(papers, control) {
  let worst = null;
  for (const paper of papers) {
    if (!CRITICAL_DOCUMENT_TYPES.includes(paper.type) || !paper.expiry) continue;
    if (archived(paper, papers)) continue;

    const daysExpired = -daysUntil(paper.expiry);
    if (daysExpired < 1) continue;

    const until = addDays(paper.expiry, control.graceDays);
    const held = daysExpired > control.graceDays;
    const found = {
      state: held ? "held" : "grace",
      type: paper.type,
      expiry: paper.expiry,
      until,
      daysLeft: Math.max(control.graceDays - daysExpired + 1, 0),
      action: control.action,
    };
    if (!worst || (held && worst.state !== "held")) worst = found;
  }
  return worst;
}

/** "2026-08-26T10:30" as "26/08/2026  10:30 AM". */
export function formatUploadedAt(value) {
  const [date, time] = String(value).split("T");
  const [year, month, day] = date.split("-");
  const [rawHour, minute] = (time || "00:00").split(":");
  const hour = Number(rawHour);
  const suffix = hour < 12 ? "AM" : "PM";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${day}/${month}/${year}  ${String(shown).padStart(2, "0")}:${minute} ${suffix}`;
}

/** The allowances that sit on top of basic pay. */
// `phoneAllowance`, not `phone`: `phone` is the employee's number.
export const ALLOWANCE_KEYS = [
  "special",
  "housing",
  "phoneAllowance",
  "transport",
  "electricity",
  "water",
];

/**
 * What can be held back from a month's pay. A record without one of these
 * simply has nothing held back under it.
 */
export const DEDUCTION_KEYS = [
  "loan",
  "salaryAdvance",
  "disciplinary",
  "otherDeduction",
  "administrative",
];

const sum = (employee, keys) =>
  keys.reduce((total, key) => total + Number(employee[key] || 0), 0);

/**
 * The three figures a payslip is read by.
 *
 * None of them is stored: a total held beside its parts can disagree with
 * them, and then nobody knows which of the two is the truth. Every one is
 * worked out from the components on the record.
 */
export const totalAllowances = (employee) => sum(employee, ALLOWANCE_KEYS);

export const totalDeductions = (employee) => sum(employee, DEDUCTION_KEYS);

export const netSalary = (employee) =>
  Number(employee.salary || 0) +
  totalAllowances(employee) -
  totalDeductions(employee);

/** An amount as it is shown anywhere in the system: figure then currency. */
export { money as amount } from "@/lib/money";
