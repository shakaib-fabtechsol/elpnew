// The Rial sign is drawn, not typed - see components/shared/money.jsx.

/* ------------------------------------------------------------- employees */

// Nationalities are written as the adjective, which is how a personnel record
// reads: "Omani", not "Oman". Omani first and the Gulf after it, because that
// is who the firm employs most; every other country follows in alphabetical
// order, Palestine in its place among them. The firm's list does not include
// the occupying state. "Other" is last, for anybody without a nationality.
const GULF_NATIONALITIES = ["Omani", "Emirati", "Saudi", "Qatari", "Kuwaiti", "Bahraini"];

const OTHER_NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan",
  "Antiguan and Barbudan", "Argentine", "Armenian", "Australian", "Austrian",
  "Azerbaijani", "Bahamian", "Bangladeshi", "Barbadian", "Basotho", "Belarusian",
  "Belgian", "Belizean", "Beninese", "Bhutanese", "Bissau-Guinean", "Bolivian",
  "Bosnian and Herzegovinian", "Botswanan", "Brazilian", "British", "Bruneian",
  "Bulgarian", "Burkinabe", "Burmese", "Burundian", "Cabo Verdean", "Cambodian",
  "Cameroonian", "Canadian", "Central African", "Chadian", "Chilean", "Chinese",
  "Colombian", "Comorian", "Congolese (DR Congo)", "Congolese (Republic of the Congo)",
  "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djiboutian",
  "Dominican (Dominica)", "Dominican (Dominican Republic)", "Dutch", "Ecuadorian",
  "Egyptian", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian", "Fijian",
  "Filipino", "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German",
  "Ghanaian", "Greek", "Grenadian", "Guatemalan", "Guinean", "Guyanese", "Haitian",
  "Honduran", "Hungarian", "I-Kiribati", "Icelandic", "Indian", "Indonesian",
  "Iranian", "Iraqi", "Irish", "Italian", "Ivorian", "Jamaican", "Japanese",
  "Jordanian", "Kazakh", "Kenyan", "Kittitian and Nevisian", "Kyrgyz", "Lao",
  "Latvian", "Lebanese", "Liberian", "Libyan", "Liechtensteiner", "Lithuanian",
  "Luxembourgish", "Malagasy", "Malawian", "Malaysian", "Maldivian", "Malian",
  "Maltese", "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian",
  "Moldovan", "Monegasque", "Mongolian", "Montenegrin", "Moroccan", "Mozambican",
  "Namibian", "Nauruan", "Nepali", "New Zealander", "Ni-Vanuatu", "Nicaraguan",
  "Nigerian", "Nigerien", "North Korean", "North Macedonian", "Norwegian",
  "Pakistani", "Palauan", "Palestinian", "Panamanian", "Papua New Guinean",
  "Paraguayan", "Peruvian", "Polish", "Portuguese", "Romanian", "Russian",
  "Rwandan", "Saint Lucian", "Salvadoran", "Samoan", "Sammarinese", "Sao Tomean",
  "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean",
  "Slovak", "Slovenian", "Solomon Islander", "Somali", "South African",
  "South Korean", "South Sudanese", "Spanish", "Sri Lankan", "Sudanese",
  "Surinamese", "Swazi", "Swedish", "Swiss", "Syrian", "Tajik", "Tanzanian",
  "Thai", "Timorese", "Togolese", "Tongan", "Trinidadian and Tobagonian",
  "Tunisian", "Turkish", "Turkmen", "Tuvaluan", "Ugandan", "Ukrainian",
  "Uruguayan", "Uzbek", "Venezuelan", "Vietnamese", "Vincentian", "Yemeni",
  "Zambian", "Zimbabwean",
  // Sorted here rather than trusted to the hand that typed it, so a name
  // added later still lands in its place.
].sort((a, b) => a.localeCompare(b, "en"));

export const NATIONALITIES = [...GULF_NATIONALITIES, ...OTHER_NATIONALITIES, "Other"];

export const GENDERS = ["Male", "Female"];

/**
 * Whether somebody is still working here. Two answers, because that is how
 * many there are - being away on approved leave is not a third standing, it
 * is a fact about this week that the leave book already holds, and "ended"
 * is answered by who decided it rather than by another word for it.
 */
export const EMPLOYEE_STATUSES = ["Active", "Inactive"];

/** Whose decision ended it. */
export const DECISION_MAKERS = ["Management Decision", "Employee Decision"];

/** And, where it was the firm's decision, on what ground. */
export const MANAGEMENT_DECISION_REASONS = [
  "Contract Expiry",
  "Termination / Dismissal",
];

/**
 * Why someone left. Only asked for once a status says they have - a reason for
 * leaving on an employee who is still here is a contradiction, not a blank.
 */
export const LEAVING_REASONS = [
  "Resignation",
  "End of Contract",
  "Termination",
  "Retirement",
  "Transfer",
  "Other",
];

/* ---------------------------------------------------------- job description */

/** A partner owns a share of the firm; everyone else is employed by it. */
export const EMPLOYEE_CATEGORIES = ["Partner", "Employee"];

/** How far up the firm somebody sits, regardless of what they do. */
export const JOB_LEVELS = ["Top Management", "Executive Management", "Staff"];

/** The side of the firm's work somebody belongs to. */
export const DEPARTMENTS = ["Partner", "Legal Services", "Administration"];

/**
 * The job titles each department can hold.
 *
 * A title belongs to a department rather than to the firm at large - there is
 * no such thing as an Accountant in Legal Services - so the list is kept here
 * by department and the form offers only the part that applies. Choosing a
 * department before a title is the order the work is actually decided in.
 */
export const JOB_TITLES = {
  Partner: ["Founding Partner", "Partner", "Managing Partner"],
  "Legal Services": ["Lawyer", "Legal Consultant", "Legal Associate"],
  Administration: ["Administrator", "Accountant", "Administrative Assistant"],
};

/** Every title there is, for reading a record back whatever its department. */
export const OCCUPATIONS = Object.values(JOB_TITLES).flat();

/* Employment Information, as Add Employee now asks it. */

/** Where somebody stands in the firm's line of authority. */
export const EMPLOYEE_POSITIONS = ["Partner", "Manager", "Employee"];

/** The firm's departments, the legal work apart from what supports it. */
export const DEPARTMENT_GROUPS = [
  { group: "LEGAL", options: ["Litigation", "Advisory & Contracts"] },
  {
    group: "SUPPORT SERVICES",
    options: ["Administration", "Finance", "Human Resources", "Information Technology"],
  },
];

/**
 * A grade: a consultant's seniority, or the courts a lawyer may plead
 * before. A lawyer's grade is their practice level, so it is asked once.
 */
export const LAWYER_GRADES = [
  "Trainee Lawyer",
  "Primary Court Lawyer",
  "Appeal Court Lawyer",
  "Supreme Court Lawyer",
  "Non-Practicing Lawyer",
];

export const GRADE_GROUPS = [
  { group: "Consultant Grade", options: ["Senior Associate", "Associate", "Legal Advisor"] },
  { group: "Lawyer Grade / Practice Level", options: LAWYER_GRADES },
];

/** What somebody actually does, which is not the same as their level. */
/** How a person is engaged, rather than what they are engaged to do. */
export const EMPLOYMENT_TYPES = ["Full-Time", "Part-Time", "Temporary"];

/** How long an employee's contract runs: to a date, or until it is ended. */
export const EMPLOYEE_CONTRACT_TYPES = ["Fixed-term", "Indefinite-term"];

/** The two contract terms as Contract Details names them, each to its stored value. */
export const CONTRACT_TERMS = { "Fixed Term": "Fixed-term", "Indefinite Term": "Indefinite-term" };

/**
 * How somebody is engaged and on what term, asked as one choice - "Full-Time -
 * Fixed Term" - and kept as the two answers it is.
 */
export const EMPLOYMENT_CONTRACT_GROUPS = EMPLOYMENT_TYPES.map((type) => ({
  group: type,
  options: Object.keys(CONTRACT_TERMS).map((term) => type + " - " + term),
}));

/** How long a new employee is on probation; fifteen days unless agreed otherwise. */
export const PROBATION_PERIODS = ["15 Days", "1 Month", "2 Months", "3 Months"];
export const DEFAULT_PROBATION = "15 Days";

/** The notice either side gives to end the contract. */
export const NOTICE_PERIODS = ["1 Month", "2 Months", "3 Months", "4 Months"];

/** The courts a lawyer is admitted to plead before, lowest first. */
export const PRACTICE_LEVELS = [
  "Trainee Lawyer",
  "Primary Lawyer",
  "Appeal Lawyer",
  "Supreme Court Lawyer",
  "Non-Practicing Lawyers Register",
];



export const EDUCATION_LEVELS = [
  "Secondary Education",
  "Diploma",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate",
];

// Client types as specified by the client (Phase 1 requirements)
export const CLIENT_TYPES = [
  "Bank",
  "Finance Company",
  "Insurance Company",
  "Telecom Company",
  "Real Estate Company",
  "Automotive Company",
  "Commercial Company",
  "Other Entities",
  "Individual",
];

// Banks a client can nominate to receive payments.
export const RECEIVING_BANKS = [
  "Bank Muscat",
  "National Bank of Oman",
  "Bank Dhofar",
  "Oman Arab Bank",
  "Sohar International",
  "Ahli Bank",
  "Bank Nizwa",
  "Alizz Islamic Bank",
];

// Standard payment delay periods, in days. "Custom" reveals a free-text field
// so an unusual term can be entered directly.
export const PAYMENT_DELAY_OPTIONS = ["15", "30", "45", "60", "90"];

// Contracts are not filed here - they have their own page, because a contract
// is renewed and amended over time while these are simply held on record.
export const DOCUMENT_TYPES = [
  "Power of Attorney",
  "Commercial Registration",
  "ID Card",
  "Tax Card",
  "Trade License",
  "Memorandum of Association",
  "Share Certificate",
  "Instructions",
];

/**
 * A general contract governs the whole relationship; a specific one is written
 * for a single matter, so it names the case file it belongs to.
 */
export const CONTRACT_TYPES = ["General", "Specific"];

// Document types that carry an expiry date of their own.
export const DOCUMENT_EXPIRY_LABELS = {
  "Power of Attorney": "Power of Attorney Expiry Date",
  "Commercial Registration": "Commercial Registration Expiry Date",
};

export const DOCUMENT_STATUSES = ["Valid", "Expiring Soon", "Expired", "Not Required"];

export const INVOICE_STATUSES = [
  "Paid",
  "Partially Paid",
  "Unpaid",
  "Overdue",
  "Cancelled",
];

export const INVOICE_STATUS_VARIANT = {
  Paid: "success",
  "Partially Paid": "warning",
  Unpaid: "secondary",
  Overdue: "destructive",
  Cancelled: "outline",
};

/**
 * The dot that carries an invoice's status where the words sit in plain black.
 *
 * `ring` is given separately because a pale fill on a white row disappears
 * without an edge, and a cancelled invoice is drawn hollow - nothing is owed on
 * it and nothing has been paid, so there is nothing to fill in.
 */
export const INVOICE_STATUS_DOT = {
  Paid: { fill: "#0B6623", ring: "#0B6623" },
  "Partially Paid": { fill: "#D9F7E3", ring: "#0B6623" },
  Unpaid: { fill: "#F59E0B", ring: "#F59E0B" },
  Overdue: { fill: "#DC2626", ring: "#DC2626" },
  Cancelled: { fill: "transparent", ring: "#9CA3AF" },
};

/**
 * Dial codes for the phone fields.
 *
 * Oman leads the list because it is the default, and the Gulf states follow
 * since they are the common case here; the rest are alphabetical.
 */
/** How the person named as an emergency contact is related to the employee. */
export const EMERGENCY_RELATIONSHIPS = [
  "Father",
  "Mother",
  "Husband",
  "Wife",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Relative",
  "Friend",
  "Other",
];

export const DEFAULT_DIAL_CODE = "+968";

export const COUNTRY_DIAL_CODES = [
  { code: "OM", name: "Oman", dial: "+968", flag: "🇴🇲" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", dial: "+965", flag: "🇰🇼" },
  { code: "BH", name: "Bahrain", dial: "+973", flag: "🇧🇭" },
  { code: "YE", name: "Yemen", dial: "+967", flag: "🇾🇪" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "IQ", name: "Iraq", dial: "+964", flag: "🇮🇶" },
  { code: "IR", name: "Iran", dial: "+98", flag: "🇮🇷" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "JO", name: "Jordan", dial: "+962", flag: "🇯🇴" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "LB", name: "Lebanon", dial: "+961", flag: "🇱🇧" },
  { code: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { code: "MA", name: "Morocco", dial: "+212", flag: "🇲🇦" },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "PS", name: "Palestine", dial: "+970", flag: "🇵🇸" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰" },
  { code: "SD", name: "Sudan", dial: "+249", flag: "🇸🇩" },
  { code: "SY", name: "Syria", dial: "+963", flag: "🇸🇾" },
  { code: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { code: "TR", name: "Turkey", dial: "+90", flag: "🇹🇷" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
];

/**
 * Papers held against a person rather than against the firm - the two lists are
 * kept apart because a bar card belongs to a lawyer and a commercial
 * registration belongs to the company.
 */
/**
 * The papers on an employee's file.
 *
 * Which of them can be filed depends on the employee: an Omani carries an ID
 * card where a foreigner carries a resident card and a passport, and only a
 * lawyer has a bar card. The rest everybody has, so they are asked for
 * whoever the employee is.
 */
/** The identity papers, offered to everybody in the order the board sets. */
export const IDENTITY_DOCUMENT_TYPES = ["National ID", "Passport", "Residence Card"];

/**
 * The papers an employee cannot work without: when one lapses and is not
 * renewed within the grace period, their access to the system is held.
 */
export const CRITICAL_DOCUMENT_TYPES = [
  "Law Practice License",
  "Residence Card",
];
export const LAWYER_DOCUMENT_TYPE = "Law Practice License";

/** Held by a lawyer alongside the licence itself. */
export const LAWYER_MEMBERSHIP_TYPE = "Professional Membership Card";

/** The catch-all each category ends with, kept apart by the category it ends. */
export const OTHER_DOCUMENT_TYPES = [
  "Other Identity Document",
  "Other Professional Licence",
  "Other Qualification",
  "Other Decision",
];

/** What a catch-all is called in a list where its category is already known. */
export const documentTypeLabel = (type) =>
  OTHER_DOCUMENT_TYPES.includes(type) ? "Other" : type;

export const COMMON_DOCUMENT_TYPES = [
  // Qualifications & Experience
  "CV",
  "University Degree",
  "Experience Certificate",
  "Training Certificate",
  // Administrative Decisions - one kind per decision, because a file that
  // lumps a promotion in with a warning cannot be read at a glance.
  "Appointment Decision",
  "Promotion Decision",
  "Transfer Decision",
  "Warning Decision",
  "Termination Decision",
  "Committee Formation Decision",
  ...OTHER_DOCUMENT_TYPES,
];

/** Every type there is, for anything that has to list them all. */
export const EMPLOYEE_DOCUMENT_TYPES = [
  ...IDENTITY_DOCUMENT_TYPES,
  LAWYER_DOCUMENT_TYPE,
  ...COMMON_DOCUMENT_TYPES,
];

/** The branches the firm's banks are held at. */
export const BANK_BRANCHES = [
  "Main Branch",
  "Shatti Al Qurum",
  "Ruwi",
  "Al Khuwair",
  "Seeb",
  "Nizwa",
  "Sohar",
  "Salalah",
];

/** What kind of account it is, which decides how the money can be used. */
export const ACCOUNT_TYPES = [
  "Current Account",
  "Savings Account",
  "Call Account",
  "Fixed Deposit",
];

/**
 * What an upload will take.
 *
 * Configured here rather than written into each control, so the types and the
 * size the system accepts are one edit - and so no screen can promise 5MB
 * while another quietly allows ten.
 */
export const UPLOAD_RULES = {
  accept: ".pdf,.jpg,.jpeg,.png",
  maxBytes: 5 * 1024 * 1024,
};

/** Those rules said in the words a person reads under the control. */
export function describeUpload({ accept, maxBytes } = UPLOAD_RULES) {
  const types = accept
    .split(",")
    .map((ext) => ext.trim().replace(/^\./, "").toUpperCase())
    .filter((ext, i, all) => all.indexOf(ext) === i)
    .join(", ");
  const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
  return types + " \u00b7 up to " + mb + " MB";
}
