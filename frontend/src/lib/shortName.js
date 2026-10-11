import { employeeRecords } from "@/pages/employees/employeeData";

/**
 * The name an employee goes by across lists, requests, approvals, cards and
 * dashboards: first and family name ("Mohammed Al Yahyai"), in place of a
 * full name that may run to four or five.
 *
 * Records are still filed and matched under the full name - that is what a
 * request holds and what every lookup compares - so this is applied where a
 * name is drawn and nowhere else. The employee table, payroll, contracts and
 * official documents keep the full name and do not use it.
 *
 * A name that is nobody's on file (a client, a supplier, somebody since
 * removed) comes back as it was given.
 */
export const shortName = (fullName) => {
  if (!fullName) return fullName ?? "";
  const person = employeeRecords.find((one) => one.name === fullName);
  return person?.shortName || fullName;
};

/** The same in Arabic, for a record that has its Arabic names. */
export const shortNameAr = (person) => person?.shortNameAr || person?.nameAr || "";
