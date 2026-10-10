/**
 * Document Intake: the papers a new employee is added from.
 *
 * Each paper goes through Classification -> Extraction -> Field Mapping ->
 * Conflict Detection -> Draft Auto-Fill. Every value it fills is kept with
 * where it came from, how sure the reading was, and whether a person has
 * reviewed it.
 *
 * DEMO: nothing here reads the file. Until there is a server to send a paper
 * to - OCR or an AI model reading it - a paper is classified by its file name
 * and each kind fills in the same sample details, so the screens after it can
 * be seen filled. Swap `classifyDemo` and `extractDemo` for the real calls
 * when there are some; everything else stays as it is.
 */
import { LAWYER_DOCUMENT_TYPE } from "@/lib/constants";

/** The kinds of paper, in the order the design lists them. */
export const INTAKE_TYPES = [
  { key: "civilId", label: "Civil ID", fileAs: "National ID", numberKey: "civilId", expiryKey: "idExpiry" },
  { key: "passport", label: "Passport", fileAs: "Passport", numberKey: "passportNumber", expiryKey: "passportExpiry" },
  { key: "contract", label: "Employment Contract", fileAs: "Employment Contract" },
  { key: "cv", label: "CV / Resume", fileAs: "CV" },
  { key: "education", label: "Educational Certificate", fileAs: "University Degree" },
  { key: "lawyerCard", label: "Lawyer Card", fileAs: LAWYER_DOCUMENT_TYPE, numberKey: "lawyerCardNo", expiryKey: "lawyerCardExpiry" },
  { key: "bank", label: "Bank Document", fileAs: "Bank Document" },
  { key: "other", label: "Other", fileAs: "Other" },
];

export const intakeType = (key) => INTAKE_TYPES.find((type) => type.key === key);

/** What a paper may be uploaded as, and how large. */
export const INTAKE_ACCEPT = ".pdf,.jpg,.jpeg,.png";
export const INTAKE_MAX_BYTES = 10 * 1024 * 1024;
export const intakeFileProblem = (file) =>
  !/\.(pdf|jpe?g|png)$/i.test(file.name)
    ? file.name + ": only PDF, JPG, JPEG and PNG files can be uploaded."
    : file.size > INTAKE_MAX_BYTES
      ? file.name + ": the file is larger than 10 MB."
      : "";

/**
 * Every field a paper can fill: its label, the step it is asked on, and the
 * id of the control that shows it where that is not the field's own name.
 */
export const INTAKE_FIELDS = {
  employeeName: { label: "Full Name (English)", step: "personal" },
  arabicName: { label: "Full Name (Arabic)", step: "personal" },
  dateOfBirth: { label: "Date of Birth", step: "personal" },
  gender: { label: "Gender", step: "personal" },
  nationality: { label: "Nationality", step: "personal" },
  personalEmail: { label: "Personal Email", step: "personal" },
  phone: { label: "Phone Number", step: "personal" },
  address: { label: "Address", step: "personal" },
  emergencyName: { label: "Emergency Contact Name", step: "personal" },
  emergencyPhone: { label: "Emergency Contact Phone", step: "personal" },
  branch: { label: "Branch / Work Location", step: "employment" },
  position: { label: "Position", step: "employment" },
  department: { label: "Department", step: "employment" },
  grade: { label: "Grade", step: "employment" },
  workEmail: { label: "Work Email", step: "employment" },
  employmentType: { label: "Employment / Contract Type", step: "contract", el: "employmentContract" },
  contractType: { label: "Employment / Contract Type", step: "contract", el: "employmentContract" },
  dateOfJoining: { label: "Contract Start Date", step: "contract" },
  noticePeriod: { label: "Notice Period", step: "contract" },
  civilId: { label: "Civil ID / Resident Card No.", step: "identity" },
  idExpiry: { label: "Civil ID / Resident Card Expiry", step: "identity" },
  passportNumber: { label: "Passport No.", step: "identity" },
  passportExpiry: { label: "Passport Expiry Date", step: "identity" },
  lawyerCardNo: { label: "Lawyer Card No.", step: "identity" },
  lawyerCardExpiry: { label: "Lawyer Card Expiry Date", step: "identity" },
  salary: { label: "Basic Salary", step: "payroll" },
  housing: { label: "Housing Allowance", step: "payroll" },
  transport: { label: "Transport Allowance", step: "payroll" },
  bankName: { label: "Bank Name", step: "banking" },
  accountNumber: { label: "Account Number", step: "banking" },
  iban: { label: "IBAN", step: "banking" },
  swiftCode: { label: "SWIFT Code", step: "banking" },
  spRegistrationNo: { label: "Registration No.", step: "socialProtection" },
  spRegistrationDate: { label: "Registration Date", step: "socialProtection" },
};

/** The control a field is shown in, to mark it. */
export const fieldElementId = (key) => INTAKE_FIELDS[key]?.el || key;

/**
 * Which paper is believed first for a field: identity papers for who the
 * person is, the contract for the job and pay, the CV for how to reach them,
 * the bank's paper for the account.
 */
const IDENTITY = ["employeeName", "arabicName", "dateOfBirth", "gender", "nationality", "civilId", "idExpiry", "passportNumber", "passportExpiry"];
const CONTACT = ["personalEmail", "phone", "address", "emergencyName", "emergencyPhone"];
const sourceOrder = (key) =>
  IDENTITY.includes(key)
    ? ["civilId", "passport", "lawyerCard", "contract", "cv", "bank", "education", "other"]
    : CONTACT.includes(key)
      ? ["cv", "contract", "civilId", "passport", "bank", "education", "other"]
      : ["contract", "bank", "lawyerCard", "civilId", "passport", "cv", "education", "other"];

/** Below this, a reading is shown for review rather than taken as read. */
export const CONFIDENCE_FLOOR = 80;

/**
 * The fields a finished profile cannot be without. Some depend on others: a
 * lawyer's card for a lawyer, the Fund's number for somebody registered, the
 * leaving details for somebody inactive.
 */
export const requiredFields = (values) => [
  "arabicName",
  "employeeName",
  "dateOfBirth",
  "gender",
  "nationality",
  "phone",
  "address",
  "emergencyName",
  "emergencyPhone",
  "status",
  ...(values.status === "Inactive"
    ? ["lastWorkingDate", "decisionMaker"]
    : ["branch", "position", "department", "grade", "workEmail"]),
  "contractType",
  "dateOfJoining",
  "civilId",
  "idExpiry",
  ...(values.occupation === "Lawyer" ? ["lawyerCardNo", "lawyerCardExpiry"] : []),
  "salaryEffectiveDate",
  "salary",
  "bankName",
  "accountNumber",
  "iban",
  "swiftCode",
  ...(values.socialProtection === "Yes" ? ["spRegistrationNo", "spRegistrationDate"] : []),
];

/** The step a required field is asked on, for those not filled by papers. */
const REQUIRED_STEP = {
  status: "employment",
  lastWorkingDate: "employment",
  decisionMaker: "employment",
  salaryEffectiveDate: "payroll",
};
export const fieldStep = (key) => INTAKE_FIELDS[key]?.step || REQUIRED_STEP[key] || "personal";

/* -------------------------------------------------------------- the demo */

/** What kind of paper a file is, guessed from its name. DEMO. */
export function classifyDemo(fileName) {
  const name = fileName.toLowerCase();
  if (/passport/.test(name)) return "passport";
  if (/civil|resident|national id|\bid\b|id card/.test(name)) return "civilId";
  if (/contract|agreement|offer/.test(name)) return "contract";
  if (/\bcv\b|resume|résumé|curriculum/.test(name)) return "cv";
  if (/degree|certificate|diploma|bachelor|master|transcript|education/.test(name)) return "education";
  if (/lawyer|\bbar\b|oba|licen[cs]e/.test(name)) return "lawyerCard";
  if (/bank|iban|statement|account/.test(name)) return "bank";
  return "other";
}

/** What each kind of paper is read as saying, with how sure the reading is. DEMO. */
const DEMO = {
  civilId: {
    employeeName: ["Salma Al Harthy", 98],
    arabicName: ["سلمى الحارثية", 95],
    nationality: ["Omani", 99],
    gender: ["Female", 99],
    dateOfBirth: ["1994-03-12", 97],
    civilId: ["12345678", 99],
    idExpiry: ["2030-04-15", 98],
  },
  passport: {
    employeeName: ["Salma Al Harthy", 97],
    nationality: ["Omani", 99],
    gender: ["Female", 99],
    // Read differently from the Civil ID: a conflict to be confirmed.
    dateOfBirth: ["1994-03-21", 88],
    passportNumber: ["A12345678", 98],
    passportExpiry: ["2028-08-22", 97],
  },
  contract: {
    position: ["Employee", 92],
    employmentType: ["Full-Time", 94],
    contractType: ["Indefinite-term", 94],
    dateOfJoining: ["2026-10-15", 95],
    // Hard to read on the scan: shown for review.
    noticePeriod: ["1 Month", 72],
    salary: ["900.000", 96],
    housing: ["100.000", 93],
    transport: ["50.000", 93],
  },
  cv: {
    personalEmail: ["salma.harthy@example.com", 95],
    phone: ["9123 4567", 96],
    address: ["Al Khuwair, Muscat", 90],
  },
  education: {},
  lawyerCard: {
    lawyerCardNo: ["OBA-2026-0412", 97],
    lawyerCardExpiry: ["2027-12-31", 96],
    grade: ["Primary Court Lawyer", 90],
    practiceLevel: ["Primary Court Lawyer", 90],
    occupation: ["Lawyer", 90],
  },
  bank: {
    bankName: ["Bank Muscat", 98],
    accountNumber: ["0312 0456 7890 1234", 97],
    iban: ["OM81 0270 3120 4567 8901 234", 96],
    swiftCode: ["BMUSOMRX", 95],
  },
  other: {},
};

/**
 * What a degree says - kept with the paper, since the profile has no fields
 * for qualifications yet. DEMO.
 */
const DEMO_QUALIFICATION = {
  degree: "Bachelor of Laws (LLB)",
  specialization: "Law",
  institution: "Sultan Qaboos University",
  year: "2016",
};

/**
 * Reads one paper: what it is, and every value it carries with a confidence.
 * An empty file cannot be read and fails. DEMO.
 */
export function extractDemo(doc) {
  if (!doc.size) return { status: "failed", typeKey: doc.typeKey || "other", fields: {} };
  const typeKey = doc.typeKey || classifyDemo(doc.fileName);
  const type = intakeType(typeKey);
  const fields = Object.fromEntries(
    Object.entries(DEMO[typeKey] || {}).map(([key, [value, confidence]]) => [key, { value, confidence }])
  );
  return {
    typeKey,
    fields,
    number: type?.numberKey ? fields[type.numberKey]?.value || "" : "",
    expiry: type?.expiryKey ? fields[type.expiryKey]?.value || "" : "",
    qualification: typeKey === "education" ? DEMO_QUALIFICATION : null,
    status: Object.values(fields).some((f) => f.confidence < CONFIDENCE_FLOOR) ? "review" : "processed",
  };
}

/* ------------------------------------------------------ field mapping */

/**
 * Maps what the papers read into the draft.
 *
 * For every field the papers carry, the candidates are put in the order the
 * field's sources are believed in. A value the user has confirmed, or typed
 * themselves, is never written over. Where papers disagree the first is
 * filled but marked a conflict, to be confirmed; where the reading is unsure
 * it is marked for review. Every value is kept with its source document, its
 * confidence and its review status.
 */
export function mapExtraction(docs, current, previous) {
  const candidates = {};
  docs
    .filter((doc) => doc.status === "processed" || doc.status === "review")
    .forEach((doc) => {
      Object.entries(doc.fields || {}).forEach(([key, read]) => {
        (candidates[key] ||= []).push({
          value: read.value,
          confidence: read.confidence,
          source: doc.fileName,
          typeKey: doc.typeKey,
        });
      });
    });

  const meta = {};
  const fills = {};
  // What the user settled stays settled, whatever the papers now say.
  Object.entries(previous).forEach(([key, entry]) => {
    if (entry.status === "Confirmed") {
      meta[key] = { ...entry, candidates: candidates[key] || entry.candidates };
    } else if (!candidates[key] && String(current[key] ?? "") === String(entry.value)) {
      // No paper says it any more, but the value a paper filled is still
      // there: kept as filled, so it is not mistaken for one typed by hand.
      meta[key] = { ...entry, status: "Auto-filled", candidates: [] };
    }
  });

  Object.entries(candidates).forEach(([key, list]) => {
    if (meta[key]) return;
    const before = previous[key];
    const now = current[key];
    // Typed by the user - over nothing, or over what a paper had filled.
    if (now && (!before || String(now) !== String(before.value))) {
      meta[key] = { value: now, source: "Entered manually", confidence: 100, status: "Confirmed", candidates: list };
      return;
    }
    const order = sourceOrder(key);
    const ranked = [...list].sort(
      (a, b) => order.indexOf(a.typeKey) - order.indexOf(b.typeKey) || b.confidence - a.confidence
    );
    const top = ranked[0];
    const distinct = [...new Set(ranked.map((c) => String(c.value)))];
    meta[key] = {
      value: top.value,
      source: top.source,
      confidence: top.confidence,
      status:
        distinct.length > 1
          ? "Conflict"
          : top.confidence < CONFIDENCE_FLOOR
            ? "Review required"
            : "Auto-filled",
      candidates: ranked,
    };
    if (String(now ?? "") !== String(top.value)) fills[key] = top.value;
  });
  return { meta, fills };
}

/** Whether a field still waits on a person: unsure or disputed, and untouched since. */
export const needsReview = (entry, value) =>
  Boolean(entry) &&
  (entry.status === "Conflict" || entry.status === "Review required") &&
  String(value ?? "") === String(entry.value);
