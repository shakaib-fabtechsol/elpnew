import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { replaceAll } from "../store";
import { employeeRecords } from "@/pages/employees/employeeData";

/**
 * Employees: the API's record in the shape the screens already read
 * (src/pages/employees/employeeData.js).
 */

/** What the screens call a person's role, from what they do. */
const ROLE_OF = {
  Partner: "Partner",
  Lawyer: "Lawyer",
  "Legal Consultant": "Advisor",
  Accountant: "Accountant",
  "Administrative Assistant": "Administrative",
};

export function employeeFromApi(e) {
  // The form's inputs are controlled: an empty field is "", never null.
  const filled = Object.fromEntries(Object.entries(e).map(([key, value]) => [key, value ?? ""]));
  return {
    ...filled,
    // The list and older screens read these names.
    designation: e.occupation || "",
    role: ROLE_OF[e.occupation] || e.occupation || "",
    email: e.workEmail || "",
    socialProtection: e.socialProtection === false ? "No" : "Yes",
    annualLeaveDays: e.annualLeaveDays == null ? "" : String(e.annualLeaveDays),
  };
}

/** The fields the API keeps on a record, under the names the form uses. */
const FIELDS = [
  "employeeName", "arabicName", "nationality", "gender", "dateOfBirth",
  "civilId", "idExpiry", "passportNumber", "passportExpiry", "visaNo", "visaExpiry",
  "workPermitNo", "workPermitExpiry", "lawyerCardNo", "lawyerCardExpiry",
  "dialCode", "phone", "workDialCode", "workPhone", "workEmail", "personalEmail", "address",
  "emergencyName", "emergencyRelationship", "emergencyDialCode", "emergencyPhone",
  "status", "branch", "dateOfJoining", "employmentType", "employmentEndDate", "category",
  "jobLevel", "department", "occupation", "practiceLevel", "position", "grade",
  "lastWorkingDate", "decisionMaker", "reasonForLeaving", "managementReason",
  "contractType", "contractStartDate", "probationPeriod", "noticePeriod", "annualLeaveDays",
  "salary", "special", "housing", "phoneAllowance", "transport", "electricity", "water",
  "loan", "salaryAdvance", "disciplinary", "otherDeduction", "administrative", "salaryEffectiveDate",
  "bankName", "accountHolder", "accountNumber", "iban", "swiftCode",
  "socialProtection", "spRegistrationNo", "spRegistrationDate",
];

/** What a record cannot be without: left out of a change rather than emptied. */
const REQUIRED = ["employeeName", "dateOfJoining", "department", "occupation", "salary"];

/**
 * The record as the API takes it, from the form's fields. An empty field is
 * sent as nothing (null); on a change, a required one left empty is not sent
 * at all, so the server keeps what it has.
 */
function employeeBody(form, { change = false } = {}) {
  const body = {};
  FIELDS.forEach((key) => {
    if (!(key in form)) return;
    const value = form[key];
    body[key] = value === "" || value === undefined ? null : value;
  });
  if ("socialProtection" in form) body.socialProtection = form.socialProtection !== "No";
  if (body.annualLeaveDays !== null && body.annualLeaveDays !== undefined) {
    body.annualLeaveDays = Number(body.annualLeaveDays);
  }
  if (change) REQUIRED.forEach((key) => body[key] === null && delete body[key]);
  return body;
}

export const employeesApi = {
  /** The number the next employee will be given - shown before saving only. */
  async nextNumber() {
    const json = await api("employees/next-number");
    return json.data.empNo;
  },

  async create(form) {
    const json = await api("employees", { method: "POST", body: employeeBody(form) });
    return employeeFromApi(json.data);
  },

  async update(id, form) {
    const json = await api(`employees/${id}`, { method: "PATCH", body: employeeBody(form, { change: true }) });
    return employeeFromApi(json.data);
  },
};

// Other modules that load per employee (documents) wait on this.
let loading = Promise.resolve();

/** Settles once this sign-in's employees are in employeeRecords. */
export const employeesLoaded = () => loading;

registerLoader("employees", () => {
  loading = fetchAll("employees", {}, 200).then((rows) => {
    replaceAll(employeeRecords, rows.map(employeeFromApi));
  });
  return loading;
});
