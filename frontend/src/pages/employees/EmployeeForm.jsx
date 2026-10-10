import { Fragment, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RecordSidebar from "@/components/shared/RecordSidebar";
import DateField from "@/components/shared/DateField";
import {
  documentCategoryIcon,
  documentTypeIcon,
} from "./documentIcons";
import PageHeader from "@/components/shared/PageHeader";
import PhoneInput from "@/components/shared/PhoneInput";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  Plus,
  ArrowLeft,
  Info,
  User,
  FileText,
  Wallet,
  ListTree,

  CalendarClock,
  Megaphone,
  Gauge,
  Lock,
  CalendarCheck,
  ShieldCheck,
  ClipboardList,
  Phone,
  Mail,
  FileSpreadsheet,
  Eye,
  CloudUpload,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Gavel,
  CircleCheck,
  UserPlus,
  ArrowRight,
  UserCog,
  LayoutGrid,
  Pencil,
  ChartNoAxesColumnIncreasing,
  HandCoins,
  FileUser,
  FilePenLine,
  Banknote,
  Coins,
  Gift,
  Percent,
  Clock,
  CalendarDays,
  Stethoscope,
  Bus,
  Plane,
  Ticket,
  FileClock,
  Award,
  MessageCircleWarning,
  TriangleAlert,
  Check,
  MapPin,
  Briefcase,
  Network,
  Scale,
  Calculator,
  ChevronRight,
  Landmark,
  Users,
  FileWarning,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { amountValue } from "@/lib/money";
import { readDocumentControl } from "@/lib/settings/documentControl";
import { Rial } from "@/components/shared/Rial";
import { EmptyState } from "@/components/shared/panels";
import {
  NATIONALITIES,
  GENDERS,
  EMPLOYEE_CATEGORIES,
  JOB_LEVELS,
  DEPARTMENTS,
  JOB_TITLES,
  EMPLOYEE_STATUSES,
  DECISION_MAKERS,
  EMPLOYEE_POSITIONS,
  EMPLOYMENT_CONTRACT_GROUPS,
  CONTRACT_TERMS,
  PROBATION_PERIODS,
  DEFAULT_PROBATION,
  NOTICE_PERIODS,
  DEPARTMENT_GROUPS,
  GRADE_GROUPS,
  LAWYER_GRADES,
  MANAGEMENT_DECISION_REASONS,
  LEAVING_REASONS,
  DEFAULT_DIAL_CODE,
  COUNTRY_DIAL_CODES,
  EMERGENCY_RELATIONSHIPS,
  EMPLOYMENT_TYPES,
  EMPLOYEE_CONTRACT_TYPES,
  PRACTICE_LEVELS,
  documentTypeLabel,
  RECEIVING_BANKS,
} from "@/lib/constants";
import { initialBranches } from "@/pages/firm/firmData";
import FinancialBenefitsSection from "./sections/FinancialBenefitsSection";
import EntitlementsSection from "./sections/EntitlementsSection";


import DailyActivitiesSection from "./sections/DailyActivitiesSection";
import PerformanceSection from "./sections/PerformanceSection";
import ViolationsSection from "./sections/ViolationsSection";
import EmployeeCircularsSection from "./sections/CircularsSection";
import LeavesSection from "./sections/LeavesSection";
import GeneralRequestSection from "./sections/GeneralRequestSection";
import DocumentIntake, { IntakeReview } from "./sections/DocumentIntake";
import { INTAKE_FIELDS, fieldElementId, fieldStep, intakeType } from "./documentIntake";
import { useDocumentIntake } from "./useDocumentIntake";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
} from "@/components/shared/RecordTable";
import { formatDate } from "@/pages/firm/firmData";
import {
  employeeRecords,
  nextEmployeeNo,
  documentsFor,
  documentTypesFor,
  documentStatus,
  documentCategory,
  isVersioned,
  documentVersions,
  accessHold,
  documentExpires,
  relatedExpiry,
  relatedNumber,
} from "./employeeData";
import { checkRequired, clearRequiredCheck } from "@/components/shared/formFields";
import { employeesApi } from "@/lib/api/modules/employees";
import { documentsApi, viewDocument } from "@/lib/api/modules/documents";
import { attempt, fieldLabel, notifyError } from "@/lib/api/notice";
import { upsert } from "@/lib/api/store";

/**
 * The employee record, section by section.
 *
 * The sections are the sides of one person's file rather than steps in a wizard,
 * so any of them can be opened at any time and they all save together.
 */
const SECTIONS = [
  {
    // The whole file in the tabs it was added in, open to be changed and
    // saved. On a record only - My Profile keeps its own pages.
    key: "profile",
    label: "Employee Information",
    icon: UserCog,
    noSave: true,
    recordOnly: true,
  },
  {
    // What the employee has asked of the firm, gathered under one heading.
    key: "requests",
    label: "Requests",
    icon: LayoutGrid,
    noSave: true,
    recordOnly: true,
  },
  {
    // Who the person is, what they do and how to reach them: three
    // entries in this menu that were all one answer, so they are one page
    // with a box each.
    key: "information",
    label: "Employee Data",
    title: "Employee",
    icon: User,
    note: "Employee profile, job description and contact details",
  },
  {
    // The papers the details above were taken from, in a section of their own
    // again - they are looked up as often as the details themselves.
    noSave: true,
    key: "documents",
    label: "Documents",
    icon: FileText,
    note: "The papers on file for this employee",
  },
  {
    // Salary, loans, assistance and commission were four entries in this
    // menu, all answering the same question: what the firm pays this
    // person, and why. One page with four tabs instead.
    key: "benefits",
    label: "Financial Benefits",
    icon: Wallet,
    noSave: true,
    note: "Salaries, bonuses, loans, assistance and commission",
  },
  {
    // Allowances on top of the pay, and the sums the law requires when
    // somebody leaves. Nine lists, one page, a tab each.
    key: "entitlements",
    label: "Employee Entitlements",
    icon: FileSpreadsheet,
    noSave: true,
    note: "Employee allowances and statutory entitlements",
  },
  {
    // Anything asked of the administration that has no form of its own - a
    // parking card, a laptop. Nothing to save on the page: each request is
    // submitted on its own.
    key: "generalRequest",
    label: "General Requests",
    icon: ClipboardList,
    noSave: true,
    note: "Submit your request to the administration",
  },
  {
    key: "leaves",
    label: "Leaves",
    icon: CalendarCheck,
    noSave: true,
    note: "Leave requests and what was decided about them",
  },
  {
    noSave: true,
    key: "circulars",
    label: "Circulars",
    icon: Megaphone,
    note: "Notices addressed to this employee",
  },
  {
    // The firm's own running record of the employee - the day's work, how it
    // is judged, and what was done wrong - gathered under one heading, as
    // Requests gathers what the employee asks.
    key: "management",
    label: "Employee Management",
    icon: Users,
    noSave: true,
    recordOnly: true,
  },
  {
    key: "daily",
    label: "Daily Activities",
    icon: CalendarClock,
    note: "Record today's working time and activities",
    save: "Save Daily Activity",
  },
  {
    noSave: true,
    key: "performance",
    label: "Performance Evaluation",
    icon: Gauge,
    note: "Statistics collected by the system from recorded activity",
  },
  {
    // Recorded by the firm; on My Profile the history is only read.
    noSave: true,
    key: "violations",
    label: "Violations & Penalties",
    icon: Gavel,
    note: "Violations recorded and the penalties that followed",
  },
  {
    // What one employee may see and change. Set for someone by whoever
    // administers the firm, so it is not on the page a person opens on
    // themselves - nobody grants themselves permissions.
    noSave: true,
    key: "permissions",
    label: "System Permissions",
    icon: ShieldCheck,
    note: "What this employee may see and change",
    notOnOwnProfile: true,
  },
];

/**
 * The mark beside a field that has to be filled in.
 *
 * It is a demand, so it is only shown where the page is asking for something:
 * on My Profile, where the record is only being read, there is nothing to
 * demand and the mark would be noise.
 */
function Required({ show }) {
  if (!show) return null;
  // Hidden from a screen reader: the control it marks carries `required`, and
  // that is what gets announced. Read out as well, the asterisk is noise.
  return (
    <span aria-hidden="true" className="ms-1 text-destructive">
      *
    </span>
  );
}

/**
 * How the sides of one employee's file are grouped in the sidebar.
 *
 * Standard 07 names two: the dossier - who the person is and the papers that
 * prove it - and the money the firm owes them. Everything else is gathered
 * below until the standard says where it belongs.
 */
const SECTION_GROUPS = [
  // Sections of their own at the top of the rail, above the groups. Every
  // group below stays as it was until its own redesign arrives.
  { key: "profile", link: true },
  { key: "requests", link: true },
  { key: "circulars", link: true },
  { key: "management", link: true },
  { key: "permissions", link: true },
  {
    key: "dossier",
    label: "Employee Dossier",
    icon: User,
    items: ["information", "documents"],
  },
  {
    key: "financial",
    label: "Financial Requests",
    icon: Wallet,
    items: ["benefits", "entitlements"],
  },
  {
    key: "other",
    label: "Other sections",
    icon: ListTree,
    // Daily activities, performance and violations open from Employee
    // Management where a record has it; My Profile keeps them here.
    items: ["generalRequest", "leaves", "daily", "performance", "violations"],
  },
];

/** What Employee Management opens, each its mark, its name and what it holds. */
const MANAGEMENT_ITEMS = [
  {
    key: "daily",
    label: "Daily Activities",
    icon: CalendarDays,
    note: "View and manage the employee's daily activities, records and reports.",
  },
  {
    key: "performance",
    label: "Performance Evaluation",
    icon: ChartNoAxesColumnIncreasing,
    note: "View employee evaluations, rating and performance history.",
  },
  {
    key: "violations",
    label: "Violations & Penalties",
    icon: FileWarning,
    note: "View recorded violations, penalties and related documents.",
  },
];

/**
 * What can be asked for, by kind, as the Requests page lists it.
 *
 * Each request opens the page the record already keeps it on - the same
 * section and tab the sidebar leads to - so nothing is kept twice. A request
 * with no page of its own yet (`section` left out) says so rather than
 * having one invented for it.
 */
const REQUEST_CATEGORIES = [
  {
    key: "financing",
    label: "Financial Financing",
    // What the strip of kinds calls it, short enough for one line.
    short: "Financing",
    icon: Wallet,
    items: [
      { key: "salaryAdvance", label: "Salary Advance", icon: Banknote, section: "benefits", tab: "salaries" },
      { key: "loan", label: "Loan", icon: Coins, section: "benefits", tab: "loans" },
      { key: "assistance", label: "Assistance", tabLabel: "Financial Assistance", icon: HandCoins, section: "benefits", tab: "assistance" },
    ],
  },
  {
    key: "entitlements",
    label: "Financial Entitlements",
    short: "Entitlements",
    icon: ChartNoAxesColumnIncreasing,
    items: [
      { key: "bonus", label: "Bonus", icon: Gift, section: "benefits", tab: "bonus" },
      { key: "commission", label: "Commission", icon: Coins, section: "benefits", tab: "commission" },
      { key: "overtime", label: "Overtime", icon: Clock, section: "entitlements", tab: "overtime" },
      { key: "leavePay", label: "Leave", tabLabel: "Leave Encashment", icon: CalendarDays, section: "entitlements", tab: "leaveEncashment" },
    ],
  },
  {
    key: "allowances",
    label: "Allowances",
    icon: HandCoins,
    items: [
      { key: "medical", label: "Medical", icon: Stethoscope, tone: "blue", section: "entitlements", tab: "medical" },
      { key: "transport", label: "Transportation", icon: Bus, section: "entitlements", tab: "transport" },
      { key: "travel", label: "Travel", icon: Plane, section: "entitlements", tab: "travel" },
      { key: "airTicket", label: "Air Ticket", icon: Ticket, section: "entitlements", tab: "airTicket" },
    ],
  },
  {
    key: "endOfService",
    label: "End-of-Service Entitlements",
    short: "End of Service",
    icon: FileUser,
    items: [
      { key: "notice", label: "Notice Pay", icon: FileClock, section: "entitlements", tab: "notice" },
      { key: "gratuity", label: "End-of-Service Gratuity", icon: HandCoins, section: "entitlements", tab: "endOfService" },
    ],
  },
  {
    key: "administrative",
    label: "Administrative Requests",
    short: "Administrative",
    icon: FilePenLine,
    items: [
      // Leave is counted in days left rather than requests made: what a
      // person wants to know before asking for leave is how much they have.
      // No description under these four: the name says what each is.
      { key: "leave", label: "Leave", icon: CalendarDays, tone: "blue", stat: "leaveDays", section: "leaves" },
      { key: "general", label: "General", icon: FilePenLine, section: "generalRequest" },
      { key: "grievance", label: "Grievance", icon: MessageCircleWarning, section: "generalRequest", kind: "grievance" },
      { key: "complaint", label: "Complaint", icon: TriangleAlert, section: "generalRequest", kind: "complaint" },
    ],
  },
];

const REQUEST_ITEMS = REQUEST_CATEGORIES.flatMap((category) =>
  category.items.map((item) => ({ ...item, category: category.key }))
);

/**
 * Adding an employee, one step at a time.
 *
 * An employee is built in order - who they are, then the job they are taking,
 * then the papers - and each step is saved before the next opens, so nothing
 * is filed against somebody the system has not got yet. Every step is on the
 * bar from the start, so how far there is to go is plain before anybody
 * begins; the ones not reached yet are shown but cannot be opened.
 */
const ADD_STEPS = [
  // First the papers: what is read from them fills in the steps after, which
  // are then mostly checking. They are filed with the record when it is made.
  { key: "intake", label: "Document Intake" },
  { key: "personal", label: "Personal Information" },
  // The job, then the terms it is held on, each saved before the next.
  { key: "employment", label: "Employment Information" },
  { key: "contract", label: "Contract Information" },
  // After the job, because which papers apply follows from it: a lawyer's
  // card only for a lawyer, a passport and visa only for a foreigner.
  { key: "identity", label: "Identity & Immigration" },
  // Pay once the person and the job are settled, then where it is paid to.
  { key: "payroll", label: "Payroll Information" },
  { key: "banking", label: "Banking Information" },
  // Walked through only by somebody the firm registers with the Fund, which
  // Contract Information has already asked; everybody else goes straight on
  // to Documents.
  {
    key: "socialProtection",
    label: "Social Protection Information",
    when: (values) => values.socialProtection === "Yes",
  },
  // Saving the last of these creates the record, with the papers from
  // Document Intake filed on it, and opens it.
];

/**
 * Employee Information's tabs on a record: the same steps, under the same
 * names, that Add Employee walks through - one part of the file each - so a
 * record reads back in the order it was built.
 */
// The record's tabs are the steps it was added in, in the same order: where
// adding opens on Document Intake, the record's papers are its first tab.
const PROFILE_TABS = ADD_STEPS.map((step) =>
  step.key === "intake" ? { key: "documents", label: step.label } : step
).map((step) => ({ ...step, parts: [step.key] }));

/** The steps a record with these values is added through, in order. */
const flowFor = (values) => ADD_STEPS.filter((s) => !s.when || s.when(values));

/** Said under the tabs while the draft is being built, where no step says more. */
const DRAFT_NOTE = "Draft employee · sections are saved one at a time";

/**
 * Social Protection Fund contributions, as a share of basic pay.
 *
 * The employee's 7% is what payroll already holds back as the social
 * insurance contribution on every record; the employer's share is the Fund's
 * published rate. Both are the firm's to confirm - they are here, once, so
 * changing a rate changes it everywhere it is worked out.
 */
const SPF_EMPLOYEE_RATE = 0.07;
const SPF_EMPLOYER_RATE = 0.115;

/** The pay a new employee is taken on at, in the order it is asked for. */
const PAY_FIELDS = [
  { key: "salary", label: "Basic Salary", required: true },
  { key: "special", label: "Special Allowance" },
  { key: "housing", label: "Housing Allowance" },
  // Not `phone`: that is the employee's own number.
  { key: "phoneAllowance", label: "Phone Allowance" },
  { key: "electricity", label: "Electricity Allowance" },
  { key: "transport", label: "Transport Allowance" },
];

/** What comes off each month's pay. */
/**
 * What comes off the pay every month.
 *
 * Three of the four are counted off records the firm already holds - the
 * loans, the advances, the disciplinary decisions - so they are shown rather
 * than asked for. Typing over a figure that is worked out elsewhere only
 * creates a second answer to the same question. The fourth is for whatever
 * those three do not cover, and that one is typed.
 */
const DEDUCTION_FIELDS = [
  {
    key: "loan",
    label: "Loan Installment",
    note: "Auto-calculated from active loan(s)",
  },
  {
    key: "salaryAdvance",
    label: "Salary Advance Deduction",
    note: "Auto-calculated from active salary advance(s)",
  },
  {
    key: "disciplinary",
    label: "Disciplinary Deduction",
    note: "Auto-calculated from active disciplinary record(s)",
  },
  { key: "otherDeduction", label: "Other Deduction" },
];

/** Today as a date field holds it, in local time rather than UTC's. */
const todayIso = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
};

const sumOf = (fields, values) =>
  fields.reduce((total, field) => total + Number(values[field.key] || 0), 0);

/**
 * Add Employee's steps as a numbered track: each step a circle on one line,
 * green with a check once saved, navy with its number while being filled in,
 * grey until reached; the line between two steps turns green once the first is
 * done. The step being filled in is named in bold with a bar under it.
 */
function NumberedSteps({
  steps,
  active,
  done = [],
  canOpen = () => true,
  onSelect,
  label = "Add employee steps",
  // Steps still holding a missing field ("missing") or a value to review
  // ("review"): a red or amber dot on the step's circle.
  flags = {},
}) {
  return (
    <nav
      aria-label={label}
      className="overflow-x-auto rounded-xl border border-container-border bg-card px-4 py-4"
    >
      <ol className="flex min-w-max">
        {steps.map((step, index) => {
          const isDone = done.includes(step.key);
          const isActive = step.key === active;
          const reachable = canOpen(step.key);
          const last = index === steps.length - 1;
          return (
            <li key={step.key} className="relative flex min-w-28 flex-1 flex-col items-center">
              {/* The line on to the next step, from this circle's edge to
                  the next one's. */}
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-[18px] h-0.5 start-[calc(50%+24px)] end-[calc(-50%+24px)]",
                    isDone ? "bg-green-600" : "bg-slate-200"
                  )}
                />
              )}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(step.key)}
                aria-current={isActive ? "step" : undefined}
                className="flex flex-col items-center gap-2 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-full text-sm font-semibold",
                    isDone && !isActive && "bg-green-600 text-white",
                    isActive && "bg-primary text-primary-foreground",
                    !isDone && !isActive && "bg-slate-200 text-slate-600"
                  )}
                >
                  {isDone && !isActive ? (
                    <Check className="size-5" strokeWidth={3} aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                  {flags[step.key] && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute -end-0.5 -top-0.5 size-3 rounded-full ring-2 ring-white",
                        flags[step.key] === "missing" ? "bg-red-600" : "bg-amber-500"
                      )}
                    />
                  )}
                </span>
                {flags[step.key] && (
                  <span className="sr-only">
                    {flags[step.key] === "missing" ? "(required information missing)" : "(review required)"}
                  </span>
                )}
                <span
                  className={cn(
                    "max-w-32 text-center text-sm leading-tight",
                    isActive ? "font-bold text-primary" : reachable ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                {/* No bar under the open step: its circle and bold name say it. */}
                {isDone && <span className="sr-only">(completed)</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * What each field may hold, checked as it is typed.
 *
 * A wrong character - Arabic in the English name, a letter in a phone number -
 * is wrong the moment it is typed, so it is said at once, under the field,
 * rather than on Save. Whole-value checks that are only wrong once finished,
 * like an email address, wait until the field is left. Keyed by the field's
 * name, or its id where a field has no name.
 */
const FIELD_RULES = {
  arabicName: { allowed: /^[؀-ۿ\s]*$/, message: "Arabic letters only." },
  employeeName: { allowed: /^[A-Za-z\s.'-]*$/, message: "English letters only." },
  emergencyName: { allowed: /^[A-Za-z؀-ۿ\s.'-]*$/, message: "Letters only." },
  phone: { allowed: /^[0-9\s-]*$/, message: "Numbers only." },
  emergencyPhone: { allowed: /^[0-9\s-]*$/, message: "Numbers only." },
  workPhone: { allowed: /^[0-9\s-]*$/, message: "Numbers only." },
  civilId: { allowed: /^[0-9]*$/, message: "Numbers only." },
  passportNumber: { allowed: /^[A-Za-z0-9]*$/, message: "English letters and numbers only." },
  visaNo: { allowed: /^[A-Za-z0-9-]*$/, message: "English letters and numbers only." },
  workPermitNo: { allowed: /^[A-Za-z0-9-]*$/, message: "English letters and numbers only." },
  lawyerCardNo: { allowed: /^[A-Za-z0-9-]*$/, message: "English letters and numbers only." },
  spRegistrationNo: { allowed: /^[A-Za-z0-9-]*$/, message: "English letters and numbers only." },
  // The bank's numbers have a whole shape as well, checked when the step is
  // saved (not while typing, when every number is still too short): the same
  // shape the server checks, so a wrong one is caught here, on its own step.
  accountNumber: {
    allowed: /^[0-9\s]*$/,
    message: "Numbers only.",
    shape: /^[0-9 ]{6,40}$/,
    shapeMessage: "Enter a valid account number: digits only, at least 6.",
  },
  iban: {
    allowed: /^[A-Za-z0-9\s]*$/,
    message: "English letters and numbers only.",
    shape: /^[A-Za-z]{2}[0-9A-Za-z ]{10,32}$/,
    shapeMessage: "Enter a valid IBAN: two letters, then 10 to 32 letters or digits.",
  },
  swiftCode: {
    allowed: /^[A-Za-z0-9]*$/,
    message: "English letters and numbers only.",
    shape: /^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/,
    shapeMessage: "Enter a valid SWIFT code: 8 or 11 letters or digits.",
  },
};

/**
 * Whether a field holds something its rule does not allow - or, once the
 * step has been saved (`whole`), a value in the wrong overall shape.
 */
const shapeBroken = (name, value) => {
  const rule = FIELD_RULES[name];
  return Boolean(rule?.shape && value && !rule.shape.test(value.trim()));
};

const ruleBroken = (name, value, whole = false) => {
  const rule = FIELD_RULES[name];
  if (!rule || !value) return false;
  return !rule.allowed.test(value) || (whole && shapeBroken(name, value));
};

/** What is wrong with a field, said under it the moment it is wrong. */
function RuleNote({ name, value, whole = false }) {
  if (!ruleBroken(name, value, whole)) return null;
  const rule = FIELD_RULES[name];
  return (
    <p role="alert" className="field-error">
      {rule.allowed.test(value) ? rule.shapeMessage : rule.message}
    </p>
  );
}

/**
 * A phone number and the country it belongs to.
 *
 * The dial code is a field of its own rather than something typed into the
 * number, so a number can be dialled without guessing which country it is
 * from - and so two people cannot write the same number two ways.
 */
function PhoneField({ id, label, placeholder, dialCode, onDialCode, value, onChange, required }) {
  return (
    <div className="form-field space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <PhoneInput
        id={id}
        dialCode={dialCode}
        onDialCode={onDialCode}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        invalid={ruleBroken(id, value)}
      />
      <RuleNote name={id} value={value} />
    </div>
  );
}

/**
 * A labelled choice from a fixed list.
 *
 * `required` marks the cell for the save check, which reads an unchosen select
 * by the placeholder its trigger is still showing.
 */
function ChoiceField({
  id,
  label,
  placeholder,
  value,
  onChange,
  options,
  required,
  // A field whose choices depend on another is shut until that one is
  // answered: an empty list of options says nothing about why it is empty.
  disabled,
  // Given a mark for an option, the list is scanned rather than read: the eye
  // finds the right line without working through the ones above it.
  iconFor,
  // A mark before the label, and a word of explanation behind an (i) after it.
  icon: LabelIcon,
  info,
  // How an option reads in the list, where that is more than the value kept.
  optionLabel,
}) {
  const item = (option) => {
    const Icon = iconFor && iconFor(option);
    return (
      <SelectItem key={option} value={option}>
        <span className="flex items-center gap-2.5">
          {Icon && (
            <Icon
              strokeWidth={1.5}
              aria-hidden="true"
              className="size-[18px] shrink-0 text-primary"
            />
          )}
          {optionLabel ? optionLabel(option) : option}
        </span>
      </SelectItem>
    );
  };
  return (
    <div className="form-field space-y-2" data-required={required || undefined}>
      <Label htmlFor={id} className={cn(LabelIcon && "flex items-center gap-2 font-semibold")}>
        {LabelIcon && <LabelIcon strokeWidth={1.5} aria-hidden="true" className="size-5 shrink-0" />}
        {label}
        {info && (
          <span title={info} className="inline-flex text-primary/70">
            <Info className="size-4" aria-hidden="true" />
            <span className="sr-only">{info}</span>
          </span>
        )}
      </Label>
      <Select
        value={value}
        onValueChange={(next) => next && onChange(next)}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {/* An option is a word, or a group of them under a heading. */}
          {options.map((option) =>
            typeof option === "object" && option.group ? (
              <SelectGroup key={option.group}>
                <SelectLabel className="bg-muted/50 px-2 py-1 text-xs font-bold text-primary">
                  {option.group}
                </SelectLabel>
                {option.options.map(item)}
              </SelectGroup>
            ) : (
              item(option)
            )
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * An amount in Rials, the currency written inside the box after the figure.
 *
 * Put to three places once the person leaves it, because a Baisa is a
 * thousandth and "19" and "19.000" should not both be on one payslip.
 * `locked` shows a figure the page works out rather than asks for.
 */
function MoneyField({ id, label, value, onChange, required, locked, note }) {
  return (
    <div className="form-field space-y-2">
      <Label htmlFor={id}>
        {label}
        <Required show={required} />
      </Label>
      <div className="relative">
        {locked ? (
          <Input
            id={id}
            value={amountValue(value)}
            readOnly
            tabIndex={-1}
            className="bg-locked pe-14"
          />
        ) : (
          <Input
            id={id}
            name={id}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            placeholder="0.000"
            value={value}
            onChange={onChange}
            onBlur={(e) =>
              e.target.value !== "" &&
              onChange({
                target: { name: id, value: Number(e.target.value).toFixed(3) },
              })
            }
            required={required}
            className="pe-14"
          />
        )}
        <Rial className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
      </div>
      {/* Where a figure is worked out rather than asked for, the box says so
          under itself - a greyed field with no reason given reads as broken. */}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** What holding access is called once it has happened. */
const HELD_AS = { "Restrict access": "restricted", "Suspend access": "suspended" };

/**
 * Said at the head of a record whose critical paper has lapsed: amber while
 * the grace period runs, with the day it runs out; red once access is held.
 */
function AccessNotice({ hold, graceDays }) {
  const held = hold.state === "held";
  const outcome = HELD_AS[hold.action] || "held";
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        held
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">
          {held ? "Access " + outcome : "Grace period"}
        </span>
        {" - "}
        {held
          ? `${hold.type} expired on ${formatDate(hold.expiry)} and was not renewed within the ${graceDays}-day grace period.`
          : `${hold.type} expired on ${formatDate(hold.expiry)}. Renew it by ${formatDate(hold.until)} or access will be ${outcome}.`}
      </p>
    </div>
  );
}

/** How each figure of the coming payroll is coloured, by what it is. */
const PAY_TILE_TONES = {
  earnings: { box: "bg-blue-50", badge: "bg-blue-100 text-blue-700", value: "text-primary" },
  deductions: { box: "bg-red-50", badge: "bg-red-100 text-red-600", value: "text-red-700" },
  net: { box: "bg-violet-50", badge: "bg-violet-100 text-violet-700", value: "text-primary" },
  payable: { box: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700", value: "text-emerald-700" },
};

/** One figure of the coming payroll: its icon, what it is, then the amount. */
function PayTile({ label, value, icon, tone }) {
  const Icon = icon;
  const colors = PAY_TILE_TONES[tone];
  return (
    <div className={cn("flex items-center gap-4 rounded-lg px-5 py-4", colors.box)}>
      <span
        aria-hidden="true"
        className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", colors.badge)}
      >
        <Icon className="size-7" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", colors.value)}>{label}</p>
        <p className={cn("text-2xl font-bold", value < 0 ? "text-destructive" : colors.value)}>
          {amountValue(value)}{" "}
          <Rial className="text-sm font-medium text-muted-foreground" />
        </p>
      </div>
    </div>
  );
}

/** A paper's number and the day it runs out, side by side on the grid. */
function PaperFields({ label, numberName, expiryName, values, onChange, required = true }) {
  // A paper that must be on the record is marked so; one that may be left out
  // - a passport, a visa, a work permit - carries no mark and is not demanded.
  return (
    <>
      <div className="form-field space-y-2">
        <Label htmlFor={numberName}>
          {label} No.
          <Required show={required} />
        </Label>
        <Input
          id={numberName}
          name={numberName}
          value={values[numberName]}
          onChange={onChange}
          placeholder="Enter number"
          aria-invalid={ruleBroken(numberName, values[numberName]) || undefined}
          required={required}
        />
        <RuleNote name={numberName} value={values[numberName]} />
      </div>
      <div className="form-field space-y-2">
        <Label htmlFor={expiryName}>
          {label} Expiry Date
          <Required show={required} />
        </Label>
        <DateField
          id={expiryName}
          name={expiryName}
          value={values[expiryName]}
          onChange={onChange}
          required={required}
        />
      </div>
    </>
  );
}

/** A labelled field with its own icon sitting inside the box. */
function IconField({ icon, id, label, ...props }) {
  const Icon = icon;
  return (
    <div className="form-field space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input id={id} className="ps-9" {...props} />
      </div>
    </div>
  );
}


/** How much of a note the field will take, shown as a count while typing. */
const NOTES_LIMIT = 500;

/** A blank paper: what is asked for before one is filed. */
const emptyDocument = { category: "", type: "", number: "", expiry: "", notes: "" };


/** The first field of the form a section's header button jumps to. */
/** Sections where the header button opens a form instead of scrolling to one. */

/**
 * One titled box on the Employee Information page.
 *
 * The boxes are separated by space rather than by a divider, so the page
 * reads as three things about one person rather than one long form.
 */
/** Every field in a box that is only being read wears the one locked look. */
const LOCKED_FIELDS =
  "[&_input:disabled]:bg-locked [&_input:disabled]:opacity-100 [&_textarea:disabled]:bg-locked [&_textarea:disabled]:opacity-100 [&_button:disabled]:bg-locked [&_button:disabled]:opacity-100 [&_button:disabled]:text-foreground";

function SectionCard({ title, icon: Icon, note, aside, footer, locked, children }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {Icon ? (
          // A step of Add Employee: the rule, the icon, then the name and
          // what the step asks for - the page title's heading, one size down.
          <div className="mb-6 flex items-center gap-3 border-b pb-4">
            <span aria-hidden="true" className="w-1 self-stretch rounded-full bg-primary" />
            <Icon strokeWidth={1.5} aria-hidden="true" className="size-8 shrink-0 text-primary" />
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-primary">{title}</h2>
              {note && <p className="text-sm text-primary/75">{note}</p>}
            </div>
            {aside && <div className="ms-auto shrink-0">{aside}</div>}
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-3 border-b pb-3">
            <h2 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">{title}</h2>
            {aside}
          </div>
        )}
        {/* Only the fields are locked, not the heading: the button there is
            how the box is unlocked. */}
        <fieldset
          disabled={locked}
          className={cn("min-w-0 border-0 p-0", locked && LOCKED_FIELDS)}
        >
          {children}
        </fieldset>
        {/* The step's own Cancel and Save, inside the box they act on, under
            a rule where the last field leaves off. */}
        {footer && <div className="mt-6 border-t pt-4">{footer}</div>}
      </CardContent>
    </Card>
  );
}

/**
 * How each standing of a paper is marked: green while it holds, amber as it
 * runs out, red once it has, and grey once a newer version has been filed.
 */
const DOCUMENT_STATUS_PILL = {
  Active: "border-green-200 bg-green-50 text-green-700",
  "Expiring Soon": "border-amber-200 bg-amber-50 text-amber-700",
  Expired: "border-red-200 bg-red-50 text-red-700",
  Archived: "border-slate-200 bg-slate-100 text-slate-600",
};

/** Somebody who has left, and so owes the record a reason and a last day. */
const HAS_LEFT = ["Inactive"];

const emptyFormData = {
  arabicName: "",
  employeeName: "",
  nationality: "",
  gender: "",
  dateOfBirth: "",
  dateOfJoining: "",
  status: "Active",
  reasonForLeaving: "",
  lastWorkingDate: "",

  category: "",
  jobLevel: "",
  department: "",
  occupation: "",
  // Where the person works, how they are engaged, and - where the engagement
  // runs out - the day it does.
  branch: "",
  employmentType: "",
  employmentEndDate: "",

  // The card a person is identified by in Oman: a citizen's civil ID, or a
  // resident's card. One field, because a person carries one or the other.
  civilId: "",
  idExpiry: "",
  // Asked of a foreign employee only; an Omani is identified by the ID card.
  passportNumber: "",
  passportExpiry: "",
  visaNo: "",
  visaExpiry: "",
  workPermitNo: "",
  workPermitExpiry: "",
  // The card that admits a lawyer to plead; nobody else carries one.
  lawyerCardNo: "",
  lawyerCardExpiry: "",

  dialCode: DEFAULT_DIAL_CODE,
  phone: "",
  // Which address is which matters when somebody has to be reached: the work
  // one is the firm's, the personal one is theirs.
  workEmail: "",
  personalEmail: "",
  email: "",
  address: "",
  emergencyName: "",
  emergencyRelationship: "",
  emergencyDialCode: DEFAULT_DIAL_CODE,
  emergencyPhone: "",

  // Only a lawyer is admitted to a court, so only a lawyer has a level.
  practiceLevel: "",
  // Where they stand in the firm, and their grade - a lawyer's grade being
  // their practice level, which it sets.
  position: "",
  grade: "",
  // The terms the contract is held on.
  probationPeriod: DEFAULT_PROBATION,
  noticePeriod: "",
  decisionMaker: "",
  managementReason: "",
  workDialCode: DEFAULT_DIAL_CODE,
  workPhone: "",
  // The contract: its kind, and the days it runs from and - if fixed - to.
  contractType: "",
  contractStartDate: "",
  // The one leave figure kept on the record; leave taken is recorded on the
  // leave page, not here. Thirty days is the statutory annual entitlement.
  annualLeaveDays: "30",
  // Registered with the Social Protection Fund unless somebody says not.
  socialProtection: "Yes",

  // Pay, from the day it takes effect. Basic pay is `salary`, as on every
  // record; the allowances and deductions use the keys the net is worked from.
  salary: "",
  special: "",
  housing: "",
  phoneAllowance: "",
  electricity: "",
  transport: "",
  loan: "",
  salaryAdvance: "",
  disciplinary: "",
  otherDeduction: "",
  salaryEffectiveDate: "",
  // Where it is paid to.
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  iban: "",
  swiftCode: "",

  // The Fund's own number for the employee, and when they were registered.
  spRegistrationNo: "",
  spRegistrationDate: "",
};

/**
 * An employee record as the form reads it.
 *
 * The record calls the two names `name` and `nameAr`, because that is what
 * a list of employees needs; the form calls them English and Arabic full
 * names, because that is what somebody filling it in is being asked for.
 * The two are mapped here rather than renamed on either side.
 */
const toFormData = (record) =>
  record
    ? {
        ...emptyFormData,
        ...record,
        employeeName: record.name || "",
        arabicName: record.nameAr || "",
        // Records written before the two addresses were told apart hold one
        // `email`, which was always the work one.
        workEmail: record.workEmail || record.email || "",
        // Older records say what the person does in `designation`; the form
        // calls it the profession, and the papers they can file follow it.
        occupation: record.occupation || record.designation || record.role || "",
      }
    : emptyFormData;

/**
 * One employee, however they were reached.
 *
 * `self` opens the record of whoever is signed in, so My Profile is this
 * page rather than a second one built beside it: the same sections, the
 * same sidebar, the same code - only the record differs.
 */
export default function EmployeeForm({ self }) {
  const navigate = useNavigate();
  const { id } = useParams();

  // My Profile is the record the signed-in account belongs to.
  const record = self
    ? employeeRecords.find((e) => e.id === CURRENT_USER.employeeId) ||
      employeeRecords.find((e) => e.name === CURRENT_USER.name) ||
      null
    : id
      ? employeeRecords.find((e) => e.id === Number(id)) || null
      : null;

  // A record on screen is one being edited; only Add starts an empty one.
  const isEditMode = Boolean(record);
  // A new employee is added step by step rather than on the record's pages:
  // there is no record yet for those pages to belong to.
  const isAdding = !isEditMode && !self;
  const [step, setStep] = useState(ADD_STEPS[0].key);
  const [savedSteps, setSavedSteps] = useState([]);
  // The record as it stood at its last save. Whose it is and which papers it
  // calls for are read from here, not from a step gone back to and being
  // retyped: a nationality changed but not saved has not changed yet.
  const [saved, setSaved] = useState({});
  // The salary statement, opened over the pay step to read before saving.
  const formRef = useRef(null);

  // A page that sends somebody here can say which section to open - a newly
  // added employee opens on Documents, the next thing they need.
  const location = useLocation();
  // A record opens on Employee Information; My Profile on its own first page.
  const opensOn = (state) =>
    state?.section || (record && !self ? "profile" : "information");
  const [activeSection, setActiveSection] = useState(() => opensOn(location.state));
  // A link that names a section (Activity Review in the account menu) opens
  // it even when this page is already showing.
  const [seenState, setSeenState] = useState(location.state);
  if (location.state !== seenState) {
    setSeenState(location.state);
    if (location.state?.section) setActiveSection(location.state.section);
  }
  // Which tab of Employee Information, and of Requests, is open.
  const [profileTab, setProfileTab] = useState(() => location.state?.tab || "personal");
  // On the Requests page: the kind whose cards are showing, and the request
  // opened below them, if one has been.
  // Requests opens on its first category and that category's first kind
  // (Financing, Salary Advance), so there is something to read straight away.
  const [requestCategory, setRequestCategory] = useState(REQUEST_CATEGORIES[0].key);
  const [requestsTab, setRequestsTab] = useState(REQUEST_CATEGORIES[0].items[0].key);
  // What is open under Employee Management: nothing until a card is chosen.
  const [managementTab, setManagementTab] = useState(null);
  // Said once Employee Information has been saved, until the person moves on.
  const [profileSaved, setProfileSaved] = useState(false);
  // Which side of Financial Benefits is open. Held here because the tabs
  // that choose it sit in the section's heading, which this page draws.
  const [benefitsTab, setBenefitsTab] = useState("salaries");
  // The section whose add form is open, if any. Held here because the button
  // that opens it lives in the page header, above the section itself.
  // A new employee's pay takes effect from today unless somebody says when.
  // Once a step's Save has found a value in the wrong shape, the banking
  // fields say so under them until it is put right.
  const [shapeChecked, setShapeChecked] = useState(false);
  // What the server refused when the record was made: each field with its
  // message and the value it refused, so the mark goes once it is changed.
  const [serverErrors, setServerErrors] = useState({});
  const [formData, setFormData] = useState(() =>
    record ? toFormData(record) : { ...emptyFormData, salaryEffectiveDate: todayIso() }
  );

  // Papers are a list of their own, kept beside the fields rather than in them.
  // This person's papers, not every paper in the firm.
  const [documents, setDocuments] = useState(() => documentsFor(record?.id));
  const [docDraft, setDocDraft] = useState(emptyDocument);
  // The papers uploaded on Document Intake while a new employee is added, and
  // every value they filled with its source, confidence and review status.
  const intake = useDocumentIntake(formData, setFormData);
  // Set once the last step's Save has been tried with fields still missing:
  // from then on the gaps are marked even without papers to read.
  const [finalTried, setFinalTried] = useState(false);
  const [docFile, setDocFile] = useState(null);
  // The page is the list of documents until someone asks to add to it.
  const [addingDoc, setAddingDoc] = useState(false);
  // Whether Save has been tried without a copy attached, so it can say so.
  const [docTried, setDocTried] = useState(false);
  const docFormRef = useRef(null);

  /** Back to the list, with nothing half-written left behind. */
  const closeDocForm = () => {
    setAddingDoc(false);
    setDocDraft(emptyDocument);
    setDocFile(null);
    setDocTried(false);
  };

  /** A new choice clears what depended on the old one. */
  const chooseCategory = (category) => {
    setDocDraft({ ...emptyDocument, category });
    setDocFile(null);
  };
  const chooseType = (type) => {
    setDocDraft((prev) => ({
      ...prev,
      type,
      number: relatedNumber(type, filedDetails),
      expiry: relatedExpiry(type, filedDetails),
    }));
    setDocFile(null);
  };

  // Reload when the route moves to a different employee without unmounting.
  const [loadedId, setLoadedId] = useState(id);
  if (id !== loadedId) {
    setLoadedId(id);
    // The same fresh start the page gives when it first opens: a record's own
    // details, or a blank employee whose pay starts today.
    setFormData(
      record ? toFormData(record) : { ...emptyFormData, salaryEffectiveDate: todayIso() }
    );
    setDocuments(documentsFor(record?.id));
    setActiveSection(opensOn(location.state));
    setProfileTab(location.state?.tab || "personal");
    setProfileSaved(false);
    // Nothing of an earlier employee being added carries over to the next.
    setStep(ADD_STEPS[0].key);
    setSavedSteps([]);
    setSaved({});
    intake.reset();
    setFinalTried(false);
    closeDocForm();
  }

  // Leaving a section closes what was open in it. A form left open would
  // still be open on the way back - over another employee's papers, if the
  // list was visited in between.
  const [openSection, setOpenSection] = useState(activeSection);
  if (openSection !== activeSection) {
    setOpenSection(activeSection);
    closeDocForm();
  }

  // A paper is filed with its copy, and with its expiry if it is a kind that
  // runs out. It is never corrected in place: a newer one of the same kind is
  // added and the old one becomes Replaced.
  const canSaveDocument =
    docDraft.type && docFile && (!documentExpires(docDraft.type) || docDraft.expiry);

  // Set while a save is with the server, so a second press sends nothing.
  const [saving, setSaving] = useState(false);

  /**
   * Files the paper on the API with its copy. The server stamps when it was
   * filed; a refusal (a passport filed before its number is on the record)
   * is shown and the form stays as it was.
   */
  const addDocument = async () => {
    setDocTried(true);
    if (!checkRequired(docFormRef.current) || !canSaveDocument || saving || !record) return;
    setSaving(true);
    const filed = await attempt(() =>
      documentsApi.upload(record.id, {
        type: docDraft.type,
        file: docFile,
        number: docDraft.number,
        expiry: docDraft.expiry,
        notes: docDraft.notes,
      })
    );
    setSaving(false);
    if (!filed) return;
    setDocuments(documentsFor(record.id));
    closeDocForm();
  };

  const openDocument = (doc) => {
    if (doc.fileUrl || doc.downloadPath) viewDocument(doc);
  };

  /**
   * Files the papers read on Document Intake against a saved record, each
   * under what its kind is kept as. One refused is reported and the rest
   * still go.
   */
  const fileIntakePapers = async (employeeId, papers) => {
    for (const doc of papers) {
      if (!doc.file) continue;
      await attempt(() =>
        documentsApi.upload(employeeId, {
          type: intakeType(doc.typeKey)?.fileAs || "Other",
          file: doc.file,
          number: doc.number,
          expiry: doc.expiry,
        })
      );
    }
  };

  // Newest paper first.
  const orderedDocuments = [...documents].sort(
    (a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)) || b.id - a.id
  );

  // Whether this person's access is held for a lapsed critical paper, under
  // the grace period and action set on System Settings.
  const documentControl = readDocumentControl();
  const hold = isEditMode ? accessHold(documents, documentControl) : null;

  // The papers whose earlier versions are open under them.
  const [openHistory, setOpenHistory] = useState([]);
  const toggleHistory = (type) =>
    setOpenHistory((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );

  /**
   * One paper on the list. A versioned paper says which version it is; the
   * current one also offers the versions before it, which open underneath,
   * set in and greyed, as the archived record they are.
   */
  const documentRow = (document, status, { version, older = 0, historyOpen, archivedRow } = {}) => (
    <Row key={document.id} className={cn(archivedRow && "bg-muted/40")}>
      <Td className={cn(archivedRow && "ps-8 text-muted-foreground")}>
        {archivedRow ? "" : documentCategory(document.type)}
      </Td>
      <Td>
        <span className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => openDocument(document)}
            title={"View " + (document.fileName || document.type)}
            className="shrink-0 rounded text-primary transition-colors hover:text-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Eye className="size-[18px]" aria-hidden="true" />
            <span className="sr-only">View {document.fileName || document.type}</span>
          </button>
          <span className="min-w-0">
            <span className={cn("font-medium", archivedRow ? "text-muted-foreground" : "text-primary")}>
              {document.type}
            </span>
        {version && (
          <span className="block text-xs text-muted-foreground">
            Version {version}
            {!archivedRow && " · Current"}
          </span>
        )}
        {older > 0 && (
          <button
            type="button"
            onClick={() => toggleHistory(document.type)}
            aria-expanded={historyOpen}
            className="mt-1 inline-flex items-center gap-1 rounded text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {historyOpen ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
            Version history ({older})
          </button>
        )}
          </span>
        </span>
      </Td>
      <Td className="whitespace-nowrap">{formatDate(document.uploadedAt)}</Td>
      <Td className="whitespace-nowrap">
        {document.expiry ? (
          <>
            {formatDate(document.expiry)}
            <span
              className={cn(
                "mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-0.5 text-xs font-semibold",
                DOCUMENT_STATUS_PILL[status]
              )}
            >
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
              {status}
            </span>
          </>
        ) : (
          // A paper that does not run out has no standing to report: it is
          // simply on file, which the row already says.
          <span className="text-muted-foreground">&ndash;</span>
        )}
      </Td>
      <Td className="text-muted-foreground">
        {document.notes || <span className="text-muted-foreground">&ndash;</span>}
      </Td>
    </Row>
  );

  // Which papers this employee can file at all, and what decides it.
  const isOmani =
    String(formData.nationality || "").trim().toLowerCase() === "omani";
  const docTypes = documentTypesFor(formData);
  // The details a paper stands for, as saved: on a record, the record; while
  // adding, Identity & Immigration once that step has been saved.
  const filedDetails = isAdding
    ? savedSteps.includes("identity")
      ? saved
      : {}
    : record || {};
  const docCategories = [...new Set(docTypes.map(documentCategory))];
  const typesInCategory = docTypes.filter(
    (type) => documentCategory(type) === docDraft.category
  );
  // Papers are uploaded whenever they are to hand - before the details they
  // carry are on the record, which is what Document Intake is for.

  const set = (name, value) => setFormData((prev) => ({ ...prev, [name]: value }));
  const onChange = (e) => set(e.target.name, e.target.value);

  // A new employee has one side to it: the basic information. Everything
  // else - documents, salary, loans - is filed against an employee, and there
  // is no employee to file it against until this form is saved.
  const sections = (isEditMode ? SECTIONS : SECTIONS.slice(0, 1)).filter(
    (section) =>
      !(self && section.notOnOwnProfile) && !(section.recordOnly && (self || !isEditMode))
  );

  const current = SECTIONS.find((s) => s.key === activeSection) || SECTIONS[0];
  // The employee file's own title and note - Employee Data's - kept at the
  // head of the pages that carry a heading of their own further in.
  const fileHeading = SECTIONS.find((s) => s.key === "information");
  // Employee Information shows the record in the same tabs it was added in.
  const isProfile = isEditMode && !self && activeSection === "profile";
  const isRequests = isEditMode && !self && activeSection === "requests";
  // Adding and reading the record both go tab by tab; `tab` is the one open.
  const isTabbed = isAdding || isProfile;
  const tab = isAdding ? step : profileTab;
  // While tabbed, the tab decides what is on screen rather than the sidebar.
  const isInfo = isTabbed ? tab !== "documents" : activeSection === "information";
  // Both of these draw their own boxes, so the page's card steps out of the
  // way rather than drawing a border around borders.
  const isDocuments = isTabbed ? tab === "documents" : activeSection === "documents";
  // The parts a record's tab shows: Employment & Contract shows both halves of
  // the job, Salary & Banking both pay and bank; adding shows one part a step.
  const profileParts = PROFILE_TABS.find((t) => t.key === profileTab)?.parts || [];
  /** Whether a part of the file is on screen while going tab by tab. */
  const shows = (part) =>
    isAdding ? step === part : isProfile ? profileParts.includes(part) : false;
  /** Whether a box belongs on screen: all of them on Employee Data, one tab's otherwise. */
  const onStep = (key) => !isTabbed || shows(key);
  // The request chosen on Requests, and the section on screen: the sidebar's
  // own, or the one that request is kept on.
  const requestItem = REQUEST_ITEMS.find((item) => item.key === requestsTab) || null;
  const isManagement = isEditMode && !self && activeSection === "management";
  const shownSection = isRequests
    ? requestItem?.section
    : isManagement
      ? managementTab
      : activeSection;
  // The side of the file whose Save is at the foot of the page: under
  // Employee Management, the one opened there.
  const savesFor = SECTIONS.find((s) => s.key === shownSection) || current;
  // Where a record has Employee Management, what it opens is left out of
  // the sidebar's other sections.
  const hasManagement = sections.some((s) => s.key === "management");
  // Which papers apply: while adding, from what was saved on the steps before;
  // on a record, from the record. Older records say a lawyer by role.
  const paperFacts = isProfile ? formData : saved;
  const paperOmani = String(paperFacts.nationality || "").trim().toLowerCase() === "omani";
  const paperLawyer = paperFacts.occupation === "Lawyer" || paperFacts.role === "Lawyer";

  /**
   * Whether the record can be changed on this page.
   *
   * A person reads their own record here; the firm changes it on the
   * Employees page. Two places to edit one record is two records waiting
   * to disagree - and nobody amends their own job title or joining date.
   */
  const readOnly = Boolean(self);
  // Nothing is being asked for on a page that only shows the record.
  const asksFor = !readOnly;
  // While adding, the number the server will give - a preview only; the
  // record carries the one it was actually given once saved.
  const [serverNextNo, setServerNextNo] = useState("");
  useEffect(() => {
    if (!isAdding) return;
    let live = true;
    employeesApi.nextNumber().then(
      (empNo) => live && setServerNextNo(empNo),
      () => {}
    );
    return () => {
      live = false;
    };
  }, [isAdding]);
  const employeeNo = record?.empNo || serverNextNo || nextEmployeeNo(employeeRecords);
  const hasLeft = HAS_LEFT.includes(formData.status);

  // The section saves itself lower down, so the header brings the form to the
  // top of the screen rather than pretending to save from up here.

  /**
   * The finished employee, created on the API and opened as a record.
   *
   * The server numbers it (EMP-xxxx) and checks every field; a refusal is
   * shown and the last step stays open as it was. Once the record exists,
   * the papers read on Document Intake are filed on it.
   */
  const finishEmployee = async () => {
    let created;
    try {
      created = await employeesApi.create(formData);
    } catch (error) {
      const fields = Object.keys(error?.errors || {});
      // Each refused field named with the step it is on, so it can be found.
      const labels = Object.fromEntries(
        fields.map((key) => [
          key,
          (INTAKE_FIELDS[key]?.label || fieldLabel(key)) +
            " (" + (ADD_STEPS.find((s) => s.key === fieldStep(key))?.label || "") + ")",
        ])
      );
      notifyError(error, labels);
      if (fields.length) {
        setServerErrors(
          Object.fromEntries(
            fields.map((key) => [key, { message: [].concat(error.errors[key])[0], value: formData[key] }])
          )
        );
        setStep(fieldStep(fields[0]));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    setServerErrors({});
    upsert(employeeRecords, created);
    await fileIntakePapers(
      created.id,
      intake.docs.filter((doc) => doc.status !== "failed")
    );
    // Opened on Documents: the details are in, and the papers are next.
    navigate("/employees/" + created.id, { state: { section: "profile", tab: "documents" } });
  };

  /**
   * Saves the step on screen and opens the next one.
   *
   * Nothing moves on while a required field is empty: the check marks the
   * gaps and takes the cursor to the first, and the step stays where it is.
   * Which step is next is read from what is being saved now - Social
   * Protection only follows for somebody registered - and the last one
   * hands over to Documents, where the record is finished.
   */
  /**
   * Whether the fields on screen can be sent: nothing required left empty,
   * and nothing in the wrong shape - an email with no @, or a character the
   * field does not allow. Otherwise the cursor is taken to the first problem,
   * and the field already says what is wrong with it.
   */
  const fieldsOnScreenValid = ({ requireAll = true } = {}) => {
    if (requireAll && !checkRequired(formRef.current)) return false;
    const misshapen = [...formRef.current.querySelectorAll("input")].find(
      (input) =>
        !input.disabled &&
        input.value &&
        (!input.checkValidity() || ruleBroken(input.name || input.id, input.value, true))
    );
    if (misshapen) {
      setShapeChecked(true);
      misshapen.scrollIntoView({ block: "center", behavior: "smooth" });
      misshapen.focus({ preventScroll: true });
      return false;
    }
    return true;
  };

  /**
   * Saves the step on screen and opens the next one.
   *
   * While the employee is a draft, a missing field does not hold anybody on a
   * step - only a value in the wrong shape does. Every required field is
   * demanded once, on the last step's Save, which completes the profile; if
   * any is missing it opens the first step with a gap, and every step with
   * one is marked on the bar.
   */
  const saveStep = async () => {
    if (saving || !fieldsOnScreenValid({ requireAll: false })) return;
    setSavedSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
    setSaved(formData);

    const flow = flowFor(formData);
    const next = flow[flow.findIndex((s) => s.key === step) + 1];
    if (!next) {
      if (intake.missingKeys.length) {
        setFinalTried(true);
        setStep(fieldStep(intake.missingKeys[0]));
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // Complete: the record is made, with its papers, and opened.
      setSaving(true);
      await finishEmployee();
      setSaving(false);
      return;
    }
    setStep(next.key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Document Intake asks nothing that must be filled: it moves straight on. */
  const continueFromIntake = () => {
    setSavedSteps((prev) => (prev.includes("intake") ? prev : [...prev, "intake"]));
    setStep("personal");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // The steps on the bar: every one that applies to what has been saved.
  // Until Contract Information is saved, the form's own answer decides - so
  // Social Protection is on the track from the start for a registered
  // employee, as it is by default - and the saved answer after that.
  const stepFacts = savedSteps.includes("contract") ? saved : formData;
  const shownSteps = ADD_STEPS.filter((s) => !s.when || s.when(stepFacts));
  const savedFlow = flowFor(saved);
  // The section before this one, to go back to without losing anything.
  const previousStep = savedFlow[savedFlow.findIndex((s) => s.key === step) - 1];
  // A draft can be moved through freely: every step opens at any time.
  const canOpen = () => true;

  // What the papers left to do, marked once there is something to mark: after
  // the papers are read, or once completing has been tried.
  const marking = isAdding && (intake.settled || finalTried);
  const missingMarks = marking ? intake.missingKeys : [];
  const reviewMarks = marking ? intake.reviewKeys.filter((key) => !missingMarks.includes(key)) : [];
  // Which steps still hold a gap, or a value to review - shown on the bar.
  const stepFlags = {};
  reviewMarks.forEach((key) => (stepFlags[fieldStep(key)] = "review"));
  missingMarks.forEach((key) => (stepFlags[fieldStep(key)] = "missing"));
  // The fields themselves: a red border and "Required information missing",
  // or an amber one and "Review required". A stylesheet keyed to the fields'
  // ids, so every kind of control on every step is marked the same way.
  const markRule = (keys, colour, words) =>
    keys
      .map((key) => {
        const field = `#employee-form .form-field:has(#${fieldElementId(key)})`;
        return (
          `${field} :is(input, textarea, button[role="combobox"], .rounded-field){border-color:${colour}}` +
          `${field}::after{content:"${words}";display:block;margin-top:4px;font-size:12px;color:${colour}}`
        );
      })
      .join("");
  // Refused by the server and not changed since.
  const refusedKeys = Object.keys(serverErrors).filter(
    (key) => formData[key] === serverErrors[key].value
  );
  refusedKeys.forEach((key) => (stepFlags[fieldStep(key)] = "missing"));
  const fieldMarkCss =
    markRule(missingMarks, "#dc2626", "Required information missing") +
    markRule(reviewMarks, "#d97706", "Review required") +
    refusedKeys
      .map((key) => markRule([key], "#dc2626", serverErrors[key].message.replace(/["\\]/g, "")))
      .join("");
  // The values on the open step that still wait on a person.
  const reviewHere = marking
    ? reviewMarks
        .filter((key) => fieldStep(key) === step)
        .map((key) => ({ key, label: INTAKE_FIELDS[key]?.label || key, entry: intake.meta[key] }))
    : [];

  // The month's pay, worked out from its parts rather than typed, so the
  // totals can never disagree with the lines they add up.
  const gross = sumOf(PAY_FIELDS, formData);
  const held = sumOf(DEDUCTION_FIELDS, formData);
  const net = gross - held;
  // What can actually be sent to the bank: nothing, if deductions outrun pay.
  const payable = Math.max(net, 0);
  const today = todayIso();
  const effective = formData.salaryEffectiveDate;
  // A salary starting later is scheduled; it is paid from the first payroll
  // on or after the day it starts.
  const scheduled = Boolean(effective) && effective > today;
  const payrollMonth = new Date((scheduled ? effective : today) + "T00:00").toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric" }
  );
  const currentStep = ADD_STEPS.find((s) => s.key === step) || ADD_STEPS[0];
  // What goes to the Social Protection Fund each month, on the basic pay.
  const spEmployee = Number(formData.salary || 0) * SPF_EMPLOYEE_RATE;
  const spEmployer = Number(formData.salary || 0) * SPF_EMPLOYER_RATE;

  /* ------------------------------------------- editing Employee Information */

  /**
   * Sends the record as it is on screen to the API (PATCH) and puts the
   * server's copy in its place - on the list, and back into the form. A
   * refusal (an IBAN in the wrong shape) is shown, and what was typed stays.
   */
  const saveRecord = async () => {
    const updated = await attempt(() => employeesApi.update(record.id, formData));
    if (!updated) return null;
    upsert(employeeRecords, updated);
    setFormData(toFormData(updated));
    return updated;
  };

  /** Puts every field back as the record last saved it. */
  const cancelProfileEdit = () => {
    setFormData(toFormData(record));
    setProfileSaved(false);
    // Papers uploaded but not saved go too.
    intake.reset();
    clearRequiredCheck();
  };

  /**
   * Saves the record as it is now on screen.
   *
   * What was typed has to be in the right shape; what was left empty is not
   * demanded - many records predate fields the form now asks for, and a change
   * to one of them should not have to complete all the others.
   */
  const saveProfile = async () => {
    if (saving || !fieldsOnScreenValid({ requireAll: false })) return;
    setSaving(true);
    const updated = await saveRecord();
    if (updated) {
      // Papers uploaded on Document Intake are filed on the record.
      await fileIntakePapers(
        updated.id,
        intake.docs.filter((doc) => doc.status !== "failed" && doc.status !== "processing")
      );
      setDocuments(documentsFor(updated.id));
      intake.reset();
      setProfileSaved(true);
    }
    setSaving(false);
  };

  /** Moving to another tab keeps what was typed; the save note goes. */
  const openProfileTab = (key) => {
    setProfileSaved(false);
    setProfileTab(key);
  };

  /**
   * Opens a request on the page it is kept on, at its own tab.
   *
   * Its kind is looked up by its key rather than taken from what was clicked:
   * the strip hands over the request alone, and a kind left undefined would
   * leave the cards with nothing to draw.
   */
  const chooseRequest = (item) => {
    const found = REQUEST_ITEMS.find((one) => one.key === item.key);
    if (!found) return;
    setRequestCategory(found.category);
    setRequestsTab(found.key);
    if (found.section === "benefits") setBenefitsTab(found.tab);
  };

  /** Shows one kind's cards, its first request chosen and open below. */
  const openRequestCategory = (key) => {
    const first = REQUEST_CATEGORIES.find((category) => category.key === key)?.items[0];
    if (first) chooseRequest(first);
    else {
      setRequestCategory(key);
      setRequestsTab(null);
    }
  };

  /** Moving to another side of the file. */
  const selectSection = (key) => {
    setProfileSaved(false);
    // Requests opens on the request last chosen there, at its own tab - or,
    // the first time, on the first request of the kind showing.
    if (key === "requests") {
      // Requests opens on the first category every time, its first kind shown.
      openRequestCategory(REQUEST_CATEGORIES[0].key);
    }
    setActiveSection(key);
  };

  // Employee Information's tabs: the ones that apply to this record, as when
  // it was added - Social Protection only for somebody registered.
  const profileSteps = PROFILE_TABS.filter((s) => !s.when || s.when(formData));

  // The fields of Employee Information are open to change; Cancel and Save
  // at the foot of each tab.
  const profileActions = isProfile && (
    <div className="flex items-center justify-end gap-3">
      <Button type="button" variant="ghost" onClick={cancelProfileEdit}>
        Cancel
      </Button>
      <Button type="button" onClick={saveProfile} disabled={saving}>
        <Save className="me-2 h-4 w-4" />
        Save
      </Button>
    </div>
  );

  // The step's way back, and Cancel and Save, at the end of what they act on.
  // Documents is filed paper by paper, so it has nothing to save here.
  const stepActions = isAdding && (
    <div className="flex flex-wrap items-center gap-3">
      {previousStep && (
        <Button type="button" variant="ghost" onClick={() => setStep(previousStep.key)}>
          Back to previous saved section
        </Button>
      )}
      <div className="ms-auto flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={() => navigate("/employees")}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          <Save className="me-2 h-4 w-4" />
          Save
        </Button>
      </div>
    </div>
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    // The documents page saves each paper with its own button; Enter in one
    // of its fields must not save, or leave, the record around it. Nor may it
    // on Employee Information or Requests, where nothing is saved this way -
    // a correction is sent with its own button.
    if (isDocuments || isProfile || isRequests) return;
    if (isAdding) {
      // Document Intake moves on with its own button; Enter there saves nothing.
      if (step !== "intake") saveStep();
      return;
    }
    // Saved onto the record itself, the one My Profile reads, so a change
    // made here shows there too.
    if (isEditMode && record && !readOnly) {
      if (saving || !fieldsOnScreenValid({ requireAll: false })) return;
      setSaving(true);
      saveRecord().then((updated) => {
        setSaving(false);
        if (!updated) return;
        setSaved(toFormData(updated));
        setProfileSaved(true);
      });
      return;
    }
    navigate("/employees");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Adding has no sidebar, so the way back to the list sits beside the
          title instead. */}
      {isAdding ? (
        <PageHeader
          icon={UserPlus}
          title="Add Employee"
          note="Create a new employee profile"
          crumb="Add Employee"
          backTo="/employees"
          className="px-0 sm:px-0"
          // Whose record this is, from the moment there is somebody: shown
          // once Personal Details is saved, with the number they will carry.
          action={
            saved.employeeName && (
              <div className="text-end">
                <p className="text-lg font-bold text-primary">{saved.employeeName}</p>
                <p className="text-sm text-primary/75">Employee No. {employeeNo}</p>
              </div>
            )
          }
        />
      ) : (
      /* Page Header.

          No back control here: the sidebar's own "All employees" link leads
          to the same place, and two ways back from one page is one way too
          many. The one that stayed says where it goes. */
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Employee Information and Requests head their own pages
                  further in; above them the page keeps the employee file's
                  own title, as it always had. */}
              <h1 className="text-xl font-bold text-primary sm:text-2xl">
                {isProfile || isRequests || isManagement
                  ? fileHeading.title
                  : current.title || current.label}
              </h1>
              {/* No standing beside the title: it is already on the row this
                  record was opened from, and the title says which record is
                  open, not how it stands. */}
            </div>
            <p className="text-xs text-primary/75 sm:text-sm">
              {isProfile || isRequests || isManagement ? fileHeading.note : current.note}
            </p>
          </div>
        </div>
        {/* No Save up here: it sits at the end of the form it saves, where
            the last field leaves off. */}
      </div>
      )}

      <div className="flex flex-col items-start gap-4 sm:gap-6 lg:flex-row">
        {/* Standard 07: the sides of this file, grouped, and belonging to
            this employee alone - the name at its head says whose file is
            open, and the list under it goes nowhere else. */}
        {!isAdding && (
        <RecordSidebar
          // Standard 07 #04: moving to another employee replaces the name,
          // the number, the links and which group is open - all together.
          // The key does that in one stroke, and stops one employee's
          // opened groups from being remembered as another's.
          key={record?.id || "new"}
          id={"employee-" + (record?.id || "new")}
          backTo="/employees"
          backLabel="All employees"
          title={formData.employeeName || "New employee"}
          subtitle={isEditMode ? employeeNo + " · " + formData.status : "New record"}
          active={activeSection}
          onSelect={selectSection}
          groups={SECTION_GROUPS.map((group) => {
            // A section of its own, shown only where the record has it.
            if (group.link) {
              const section = sections.find((s) => s.key === group.key);
              return section && { key: section.key, link: true, label: section.label, icon: section.icon };
            }
            return {
              key: group.key,
              label: group.label,
              icon: group.icon,
              items: group.items
                .map((key) => sections.find((section) => section.key === key))
                .filter(Boolean)
                .filter(
                  (section) =>
                    !(hasManagement && MANAGEMENT_ITEMS.some((item) => item.key === section.key))
                )
                .map((section) => ({ key: section.key, label: section.label })),
            };
          }).filter((group) => group && (group.link || group.items.length > 0))}
        />
        )}

        {/* min-w-0 or the column will not shrink: a flex child sizes itself to
            its widest content by default, so one wide table in here would
            stretch the whole page and push the sidebar off screen. */}
        <div className="w-full min-w-0 flex-1 space-y-4 sm:space-y-6">
          {hold && <AccessNotice hold={hold} graceDays={documentControl.graceDays} />}

          {/* Whose file this is, at the head of the page: where it sits, the
              person's mark and their name - or, on Requests, its own name. */}
          {isProfile && (
            <div className="space-y-3">
              <nav aria-label="Breadcrumb" className="text-sm">
                <span className="text-primary/60">Administration</span>
                <span aria-hidden="true" className="px-2 text-primary/40">/</span>
                <span className="text-primary/60">Employees</span>
                <span aria-hidden="true" className="px-2 text-primary/40">/</span>
                <span className="font-semibold text-primary" aria-current="page">{record.name}</span>
              </nav>
              <div className="flex items-center gap-4">
                <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-menu-selected">
                  <UserCog strokeWidth={1.5} aria-hidden="true" className="size-8 text-primary" />
                </span>
                <span aria-hidden="true" className="h-12 w-px bg-container-border" />
                {/* The name on record, not one being retyped in a correction. */}
                <h1 className="text-2xl font-bold text-primary">{record.name}</h1>
              </div>
            </div>
          )}

          {/* Requests heads its own page: the way back to the employee's
              information, then its mark and its name. */}
          {isRequests && (
            <div className="space-y-3">
            <nav aria-label="Breadcrumb" className="text-sm">
              <span className="text-primary/60">Administration</span>
              <span aria-hidden="true" className="px-2 text-primary/40">/</span>
              <span className="font-semibold text-primary" aria-current="page">Requests</span>
            </nav>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => selectSection("profile")}
                title="Back to Employee Information"
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
                <span className="sr-only">Back to Employee Information</span>
              </button>
              <span aria-hidden="true" className="h-9 w-px bg-container-border" />
              <LayoutGrid strokeWidth={1.5} aria-hidden="true" className="size-8 shrink-0 text-primary" />
              <h1 className="text-2xl font-bold text-primary">Requests</h1>
            </div>
            </div>
          )}

          {isProfile && (
            <div className="space-y-3">
              {/* The record's sections as a numbered track: the ones before
                  the open section are ticked off, the rest still ahead. */}
              <NumberedSteps
                label="Employee information"
                steps={profileSteps}
                active={profileTab}
                done={profileSteps
                  .slice(0, profileSteps.findIndex((s) => s.key === profileTab))
                  .map((s) => s.key)}
                onSelect={openProfileTab}
              />
              {profileSaved && (
                <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  Changes saved.
                </p>
              )}
            </div>
          )}

          {/* Every kind of request in one row, each its mark in a box and its
              name under it, joined like steps. The chosen kind's box is lit
              and the line either side of it is drawn in navy. */}
          {isRequests && (() => {
            const chosenIndex = REQUEST_CATEGORIES.findIndex((c) => c.key === requestCategory);
            return (
            <nav
              aria-label="Request types"
              className="overflow-x-auto rounded-xl border border-container-border bg-card px-4 py-4"
            >
              <ol className="flex min-w-max">
                {REQUEST_CATEGORIES.map((category, index) => {
                  const Icon = category.icon;
                  const lit = index === chosenIndex;
                  const last = index === REQUEST_CATEGORIES.length - 1;
                  return (
                    <li key={category.key} className="relative flex min-w-36 flex-1 flex-col items-center">
                      {!last && (
                        <span
                          aria-hidden="true"
                          className="absolute start-[calc(50%+40px)] end-[calc(-50%+40px)] top-7 flex h-0.5 overflow-hidden rounded-full bg-slate-200"
                        >
                          <span className={cn("h-full w-1/2", lit && "bg-primary")} />
                          <span className={cn("h-full w-1/2", index + 1 === chosenIndex && "bg-primary")} />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openRequestCategory(category.key)}
                        aria-current={lit ? "true" : undefined}
                        className="group flex flex-col items-center gap-2 rounded-md px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className={cn(
                            "flex size-14 items-center justify-center rounded-xl border transition-colors",
                            lit
                              ? "border-blue-200 bg-blue-50 text-primary"
                              : "border-container-border bg-card text-primary/60 group-hover:text-primary"
                          )}
                        >
                          <Icon strokeWidth={1.5} aria-hidden="true" className="size-7" />
                        </span>
                        <span
                          className={cn(
                            "whitespace-nowrap text-sm",
                            lit ? "font-bold text-primary" : "font-medium text-primary/60 group-hover:text-primary"
                          )}
                        >
                          {category.short || category.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
            );
          })()}

          {/* The chosen category's kinds, as tabs. Each kind opens on an
              overview of its own - its counts and the AI's reading are in
              it - so nothing here says them a second time. */}
          {isRequests && (() => {
            const category = REQUEST_CATEGORIES.find((c) => c.key === requestCategory);
            if (!category) return null;
            return (
              <div role="tablist" aria-label={category.label} className="flex flex-wrap gap-2">
                {category.items.map((item) => {
                  const opened = item.key === requestsTab;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={opened}
                      onClick={() => chooseRequest({ ...item, category: category.key })}
                      className={cn(
                        "min-w-36 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        opened
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-white text-primary hover:bg-menu-hover"
                      )}
                    >
                      {item.tabLabel || item.label}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Employee Management heads its own page as Requests does, then
              lists what it opens: each its mark, its name and what it holds,
              side by side. The one opened is lit; it is shown below. */}
          {isManagement && (
            <div className="space-y-6">
              <div className="space-y-3">
                <nav aria-label="Breadcrumb" className="text-sm">
                  <span className="text-primary/60">Employee</span>
                  <span aria-hidden="true" className="px-2 text-primary/40">/</span>
                  <span className="font-semibold text-primary" aria-current="page">
                    Employee Management
                  </span>
                </nav>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => selectSection("profile")}
                    title="Back to Employee Information"
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
                    <span className="sr-only">Back to Employee Information</span>
                  </button>
                  <span aria-hidden="true" className="h-9 w-px bg-container-border" />
                  <LayoutGrid strokeWidth={1.5} aria-hidden="true" className="size-8 shrink-0 text-primary" />
                  <h1 className="text-2xl font-bold text-primary">Employee Management</h1>
                </div>
              </div>
              <nav
                aria-label="Employee management"
                className="grid gap-4 border-b border-container-border pb-6 md:grid-cols-3 md:gap-0"
              >
                {MANAGEMENT_ITEMS.map((item, index) => {
                  const Icon = item.icon;
                  const lit = managementTab === item.key;
                  return (
                    <div
                      key={item.key}
                      className={cn("flex", index > 0 && "md:border-s md:border-container-border md:ps-4", index < MANAGEMENT_ITEMS.length - 1 && "md:pe-4")}
                    >
                      <button
                        type="button"
                        onClick={() => setManagementTab(item.key)}
                        aria-current={lit ? "true" : undefined}
                        className={cn(
                          "flex w-full items-start gap-5 rounded-lg p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          lit ? "bg-blue-50" : "hover:bg-menu-hover"
                        )}
                      >
                        <Icon strokeWidth={1.25} aria-hidden="true" className="size-14 shrink-0 text-foreground" />
                        <span className="min-w-0">
                          <span className="block text-lg font-bold text-primary">{item.label}</span>
                          <span className="mt-2 block text-sm leading-relaxed text-primary/75">
                            {item.note}
                          </span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </nav>
            </div>
          )}

          {isAdding && (
            <div className="space-y-2">
              <NumberedSteps
                steps={shownSteps}
                active={step}
                done={savedSteps.filter((key) => !stepFlags[key])}
                canOpen={canOpen}
                onSelect={setStep}
                flags={stepFlags}
              />
              {/* What the step asks for, where the step says it; otherwise,
                  once there is a draft, that it is saved a section at a time. */}
              {(currentStep.hint || savedSteps.length > 0) && (
                <p className="text-sm text-primary/75">
                  {currentStep.hint || DRAFT_NOTE}
                </p>
              )}
              {/* Completing was tried with gaps: said once, over the bar
                  that shows where they are. */}
              {finalTried && missingMarks.length > 0 && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {missingMarks.length} required field{missingMarks.length === 1 ? " is" : "s are"} still
                  missing. Complete the steps marked in red to save the employee.
                </p>
              )}
              {fieldMarkCss && <style>{fieldMarkCss}</style>}
              <IntakeReview items={reviewHere} onConfirm={intake.confirm} />
            </div>
          )}
          {/* On the merged page the three boxes are the frame, so the
              page's own card steps out of the way rather than drawing a
              border around three borders. */}
          {/* On Requests, nothing is drawn below the cards until one is opened. */}
          <Card
            className={cn(
              (isInfo || isDocuments || isRequests) && "border-0 bg-transparent shadow-none",
              isRequests && !requestItem && "hidden",
              isManagement && !managementTab && "hidden"
            )}
          >
            <CardContent
              className={cn(
                "p-4 sm:p-6",
                (isInfo || isDocuments || isRequests) && "space-y-4 p-0 sm:space-y-6 sm:p-0"
              )}
            >
              <form
                id="employee-form"
                ref={formRef}
                onSubmit={handleSubmit}
                // While adding, the step's own check says what is missing,
                // in the page's own marking rather than the browser's bubble.
                noValidate={isAdding}
                className={cn(isInfo && "space-y-4 sm:space-y-6")}
              >
                {isInfo && (
                  <fieldset
                    disabled={readOnly}
                    className={cn(
                      "space-y-4 border-0 p-0 sm:space-y-6",
                      // One background for everything that cannot be changed,
                      // so the page reads as a record rather than as a form
                      // somebody has greyed out field by field.
                      readOnly &&
                        "[&_input:disabled]:bg-locked [&_input:disabled]:opacity-100 [&_textarea:disabled]:bg-locked [&_textarea:disabled]:opacity-100 [&_button:disabled]:bg-locked [&_button:disabled]:opacity-100 [&_button:disabled]:text-foreground"
                    )}
                  >
                {/* A record that cannot be edited says so by being locked:
                    every field wears the one locked background, and nothing
                    explains that in words. */}
                {/* Standing travels with the record - but only once there
                    is one. A new employee has not been created yet, so
                    there is nothing to be Active. */}
                {/* No standing beside the heading: it is already on the row
                    this record was opened from, and it is a field below. */}
                {/* Step one of adding: the papers, read into the profile. */}
                {shows("intake") && (
                  <DocumentIntake
                    intake={intake}
                    onContinue={continueFromIntake}
                    onCancel={() => navigate("/employees")}
                  />
                )}

                {onStep("personal") && (
                <SectionCard
                  title={isAdding ? "Personal Information" : "Personal Details"}
                  icon={isAdding ? User : isProfile ? UserCog : undefined}
                  note={
                    isAdding
                      ? "Complete personal details and save to continue."
                      : isProfile
                        ? "View the employee's personal information."
                        : undefined
                  }
                  footer={isAdding ? stepActions : profileActions}
                >
                  {/* Four to a row, in the order the person is described:
                      name, birth and sex; then nationality and the papers it
                      decides; then how to reach them. Adding sets the rows
                      closer than the standard 44px, as its design does. */}
                  <div className={cn("form-grid", isTabbed && "gap-y-6")}>
                    <div className="form-field space-y-2">
                      <Label htmlFor="arabicName">
                        Full Name (Arabic)
                        <Required show={asksFor} />
                      </Label>
                      <Input
                        id="arabicName"
                        name="arabicName"
                        value={formData.arabicName}
                        onChange={onChange}
                        placeholder="أدخل الاسم الكامل بالعربية"
                        dir="rtl"
                        aria-invalid={ruleBroken("arabicName", formData.arabicName) || undefined}
                        required
                      />
                      <RuleNote name="arabicName" value={formData.arabicName} />
                    </div>

                    <div className="form-field space-y-2">
                      <Label htmlFor="employeeName">
                        Full Name (English)
                        <Required show={asksFor} />
                      </Label>
                      <Input
                        id="employeeName"
                        name="employeeName"
                        value={formData.employeeName}
                        onChange={onChange}
                        placeholder="Enter full name in English"
                        aria-invalid={ruleBroken("employeeName", formData.employeeName) || undefined}
                        required
                      />
                      <RuleNote name="employeeName" value={formData.employeeName} />
                    </div>

                    <div className="form-field space-y-2">
                      <Label htmlFor="dateOfBirth">
                        Date of Birth
                        <Required show={asksFor} />
                      </Label>
                      <DateField
                        id="dateOfBirth"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={onChange}
                        required
                      />
                    </div>

                    <div className="form-field space-y-2" data-required={isTabbed || undefined}>
                      <Label htmlFor="gender">
                        Gender
                        <Required show={asksFor} />
                      </Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(value) => set("gender", value)}
                      >
                        <SelectTrigger id="gender">
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDERS.map((gender) => (
                            <SelectItem key={gender} value={gender}>
                              {gender}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Omani first in the list: most of the firm is. */}
                    <div className="form-field space-y-2" data-required={isTabbed || undefined}>
                      <Label htmlFor="nationality">
                        Nationality
                        <Required show={asksFor} />
                      </Label>
                      <Select
                        value={formData.nationality}
                        onValueChange={(value) => set("nationality", value)}
                      >
                        <SelectTrigger id="nationality">
                          <SelectValue placeholder="Select Nationality" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {NATIONALITIES.map((nationality) => (
                            <SelectItem key={nationality} value={nationality}>
                              {nationality}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* The card the person is identified by: a citizen's ID or
                        a resident's card. Adding asks for it, and every other
                        paper's number, on Identity & Immigration instead. */}
                    {!isTabbed && (
                    <>
                    <div className="form-field space-y-2">
                      <Label htmlFor="civilId">
                        ID Number
                        <Required show={asksFor} />
                      </Label>
                      <Input
                        id="civilId"
                        name="civilId"
                        value={formData.civilId}
                        onChange={onChange}
                        placeholder="Enter ID number"
                        aria-invalid={ruleBroken("civilId", formData.civilId) || undefined}
                        required={isTabbed}
                      />
                      <RuleNote name="civilId" value={formData.civilId} />
                    </div>

                    <div className="form-field space-y-2">
                      <Label htmlFor="idExpiry">
                        ID Expiry Date
                        <Required show={asksFor} />
                      </Label>
                      <DateField
                        id="idExpiry"
                        name="idExpiry"
                        value={formData.idExpiry}
                        onChange={onChange}
                      />
                    </div>
                    </>
                    )}

                    {/* A foreign employee is also identified by a passport; an
                        Omani is not asked for one, and the row closes up. */}
                    {!isTabbed && formData.nationality && !isOmani && (
                      <>
                        <div className="form-field space-y-2">
                          <Label htmlFor="passportNumber">
                            Passport Number
                            <Required show={asksFor} />
                          </Label>
                          <Input
                            id="passportNumber"
                            name="passportNumber"
                            value={formData.passportNumber}
                            onChange={onChange}
                            placeholder="Enter passport number"
                            required={isTabbed}
                          />
                        </div>

                        <div className="form-field space-y-2">
                          <Label htmlFor="passportExpiry">
                            Passport Expiry Date
                            <Required show={asksFor} />
                          </Label>
                          <DateField
                            id="passportExpiry"
                            name="passportExpiry"
                            value={formData.passportExpiry}
                            onChange={onChange}
                            required={isTabbed}
                          />
                        </div>
                      </>
                    )}

                    {/* Two addresses, said apart: the firm writes to the work
                        one, and reaches a person on this one. Optional, so
                        only its form is checked, once it has been typed in. */}
                    <div className="form-field space-y-2">
                      <Label htmlFor="personalEmail">Personal Email</Label>
                      <Input
                        id="personalEmail"
                        name="personalEmail"
                        type="email"
                        value={formData.personalEmail}
                        onChange={onChange}
                        placeholder="Enter email address"
                      />
                    </div>

                    <PhoneField
                      id="phone"
                      label={<>Phone Number<Required show={asksFor} /></>}
                      placeholder="Enter phone number"
                      dialCode={formData.dialCode}
                      onDialCode={(value) => set("dialCode", value)}
                      value={formData.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      required={isTabbed}
                    />

                    <div className="form-field space-y-2">
                      <Label htmlFor="address">
                        Address
                        <Required show={asksFor} />
                      </Label>
                      <Input
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={onChange}
                        placeholder="Enter full address"
                        required={isTabbed}
                      />
                    </div>

                    {/* Who to call, and on what number, if something happens */}
                    <div className="form-field space-y-2">
                      <Label htmlFor="emergencyName">
                        Emergency Contact Name
                        <Required show={asksFor} />
                      </Label>
                      <Input
                        id="emergencyName"
                        name="emergencyName"
                        value={formData.emergencyName}
                        onChange={onChange}
                        placeholder="Enter contact name"
                        aria-invalid={ruleBroken("emergencyName", formData.emergencyName) || undefined}
                        required={isTabbed}
                      />
                      <RuleNote name="emergencyName" value={formData.emergencyName} />
                    </div>

                    {/* Who they are to the employee, kept on the record. Not
                        asked for when the employee is added. */}
                    {!isTabbed && (
                    <div className="form-field space-y-2">
                      <Label htmlFor="emergencyRelationship">
                        Relationship to Employee
                        <Required show={asksFor} />
                      </Label>
                      <Select
                        value={formData.emergencyRelationship}
                        onValueChange={(value) =>
                          value && set("emergencyRelationship", value)
                        }
                      >
                        <SelectTrigger id="emergencyRelationship">
                          <SelectValue placeholder="Select Relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          {EMERGENCY_RELATIONSHIPS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    )}

                    <PhoneField
                      id="emergencyPhone"
                      label={<>Emergency Contact Phone<Required show={asksFor} /></>}
                      placeholder="Enter phone number"
                      dialCode={formData.emergencyDialCode}
                      onDialCode={(value) => set("emergencyDialCode", value)}
                      value={formData.emergencyPhone}
                      onChange={(e) => set("emergencyPhone", e.target.value)}
                      required={isTabbed}
                    />

                  </div>
                </SectionCard>
                )}

                {/* On Employee Data. The tabbed pages ask for the job in its
                    own shape, further down. */}
                {!isTabbed && (
                <SectionCard title="Employment Details">
                  <div className="space-y-6">
                    <div className="form-grid">
                      {/* Where the employee stands comes first: it decides
                          what else the record has to say. It is the firm's
                          business, so My Profile does not show it. */}
                      {!self && (
                        <div className="space-y-2">
                          <Label htmlFor="status">
                            Status
                            <Required show={asksFor} />
                          </Label>
                          <Select
                            value={formData.status}
                            onValueChange={(value) => set("status", value)}
                          >
                            <SelectTrigger id="status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EMPLOYEE_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Given by the system, so it is shown and not asked for */}
                      <div className="space-y-2">
                        <Label htmlFor="employeeNo">
                          Employee No.
                          <Required show={asksFor} />
                        </Label>
                        <Input
                          id="employeeNo"
                          value={employeeNo}
                          readOnly
                          disabled
                          className="bg-locked"
                        />
                      </div>

                      <div className="form-field space-y-2" data-required={isAdding || undefined}>
                        <Label htmlFor="branch">
                          Branch / Work Location
                          <Required show={asksFor} />
                        </Label>
                        <Select
                          value={formData.branch}
                          onValueChange={(value) => value && set("branch", value)}
                        >
                          <SelectTrigger id="branch">
                            <SelectValue placeholder="Select Branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {initialBranches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.name}>
                                {branch.name} Branch
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="form-field space-y-2">
                        <Label htmlFor="dateOfJoining">
                          Date of Joining
                          <Required show={asksFor} />
                        </Label>
                        <DateField
                          id="dateOfJoining"
                          name="dateOfJoining"
                          value={formData.dateOfJoining}
                          onChange={onChange}
                          required
                        />
                      </div>

                      {/* How the person is engaged, and - where the engagement
                          runs out - the day it does. */}
                      <div className="form-field space-y-2" data-required={isAdding || undefined}>
                        <Label htmlFor="employmentType">
                          Employment Type
                          <Required show={asksFor} />
                        </Label>
                        <Select
                          value={formData.employmentType}
                          onValueChange={(value) =>
                            value && set("employmentType", value)
                          }
                        >
                          <SelectTrigger id="employmentType">
                            <SelectValue placeholder="Select Employment Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {EMPLOYMENT_TYPES.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="employmentEndDate">
                          Employment End Date
                        </Label>
                        <DateField
                          id="employmentEndDate"
                          name="employmentEndDate"
                          value={formData.employmentEndDate}
                          onChange={onChange}
                        />
                      </div>

                      <div className="form-field space-y-2" data-required={isAdding || undefined}>
                        <Label htmlFor="category">
                          Category / Role
                          <Required show={asksFor} />
                        </Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => set("category", value)}
                        >
                          <SelectTrigger id="category">
                            <SelectValue placeholder="Select Category / Role" />
                          </SelectTrigger>
                          <SelectContent>
                            {EMPLOYEE_CATEGORIES.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="form-field space-y-2" data-required={isAdding || undefined}>
                        <Label htmlFor="jobLevel">
                          Job Level
                          <Required show={asksFor} />
                        </Label>
                        <Select
                          value={formData.jobLevel}
                          onValueChange={(value) => set("jobLevel", value)}
                        >
                          <SelectTrigger id="jobLevel">
                            <SelectValue placeholder="Select Job Level" />
                          </SelectTrigger>
                          <SelectContent>
                            {JOB_LEVELS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* The department is chosen first and decides which
                          titles there are. Changing it clears the title and
                          any lawyer grade under it, so a record cannot keep a
                          title its department does not have. */}
                      <div className="form-field space-y-2" data-required={isAdding || undefined}>
                        <Label htmlFor="department">
                          Department
                          <Required show={asksFor} />
                        </Label>
                        <Select
                          value={formData.department}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              department: value,
                              occupation: "",
                              practiceLevel: "",
                            }))
                          }
                        >
                          <SelectTrigger id="department">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="form-field space-y-2" data-required={isAdding || undefined}>
                        <Label htmlFor="occupation">
                          Job Title
                          <Required show={asksFor} />
                        </Label>
                        <Select
                          value={formData.occupation}
                          disabled={!formData.department}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              occupation: value,
                              practiceLevel:
                                value === "Lawyer" ? prev.practiceLevel : "",
                            }))
                          }
                        >
                          <SelectTrigger id="occupation">
                            <SelectValue
                              placeholder={
                                formData.department
                                  ? "Select job title"
                                  : "Select a department first"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(JOB_TITLES[formData.department] || []).map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Only a lawyer holds a grade, so only a lawyer is
                          asked for one. */}
                      {formData.occupation === "Lawyer" && (
                        <div className="form-field space-y-2">
                          <Label htmlFor="practiceLevelRecord">Lawyer Grade</Label>
                          <Select
                            value={formData.practiceLevel}
                            onValueChange={(value) => set("practiceLevel", value)}
                          >
                            <SelectTrigger id="practiceLevelRecord">
                              <SelectValue placeholder="Select lawyer grade" />
                            </SelectTrigger>
                            <SelectContent>
                              {PRACTICE_LEVELS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Asked for only once the status says somebody has left */}
                    {!self && hasLeft && (
                      <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                        <div className="form-grid form-grid-2">
                          <div className="space-y-2">
                            <Label htmlFor="reasonForLeaving">
                              Reason for Leaving
                            </Label>
                            <Select
                              value={formData.reasonForLeaving}
                              onValueChange={(value) =>
                                set("reasonForLeaving", value)
                              }
                            >
                              <SelectTrigger id="reasonForLeaving">
                                <SelectValue placeholder="Select Reason" />
                              </SelectTrigger>
                              <SelectContent>
                                {LEAVING_REASONS.map((reason) => (
                                  <SelectItem key={reason} value={reason}>
                                    {reason}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="lastWorkingDate">
                              Last Working Date
                            </Label>
                            <DateField
                              id="lastWorkingDate"
                              name="lastWorkingDate"
                              value={formData.lastWorkingDate}
                              onChange={onChange}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>
                )}

                {/* The job and the contract it is held on, as a new employee
                    is taken on: where they work and what as, then the terms. */}
                {(shows("employment") || shows("contract")) && (
                  <>
                  <SectionCard
                    // The job and the contract are a step each, on a record
                    // as when it is added.
                    title={
                      tab === "contract"
                        ? "Contract Details"
                        : ADD_STEPS.find((s) => s.key === tab)?.label
                    }
                    footer={profileActions}
                  >
                    <div className="space-y-6">
                      {shows("employment") && (
                      <section>
                        {/* Named only where it shares the box with the contract. */}
                        {shows("contract") && (
                          <h3 className="mb-4 text-base font-bold text-primary">
                            Organizational Information
                          </h3>
                        )}
                        <div className="form-grid gap-y-6">
                          {/* Inactive asks for the last day, who decided it,
                              and - unless it was the employee's own decision -
                              the firm's decision, on the row under this one.
                              Each answer is dropped when the one above it
                              changes, so a record cannot keep a reason for an
                              ending that is no longer there. */}
                          <ChoiceField
                            id="status"
                            label="Employee Status"
                            icon={User}
                            value={formData.status}
                            onChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                status: value,
                                lastWorkingDate:
                                  value === "Inactive" ? prev.lastWorkingDate : "",
                                decisionMaker:
                                  value === "Inactive" ? prev.decisionMaker : "",
                                managementReason:
                                  value === "Inactive" ? prev.managementReason : "",
                              }))
                            }
                            options={["Active", "Inactive"]}
                            required
                          />
                          {/* Inactive asks only what the leaving needs - the
                              last day, who decided it and the firm's decision -
                              beside the status, and nothing else on the step. */}
                          {formData.status === "Inactive" ? (
                            <>
                            <div className="form-field space-y-2">
                              <Label htmlFor="lastWorkingDate">
                                Last Working Day
                                <Required show />
                              </Label>
                              <DateField
                                id="lastWorkingDate"
                                name="lastWorkingDate"
                                value={formData.lastWorkingDate}
                                onChange={onChange}
                                required
                              />
                            </div>
                            <ChoiceField
                              id="decisionMaker"
                              label="Decision Maker"
                              placeholder="Select decision maker"
                              value={formData.decisionMaker}
                              onChange={(value) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  decisionMaker: value,
                                  managementReason:
                                    value === "Employee Decision"
                                      ? ""
                                      : prev.managementReason,
                                }))
                              }
                              options={DECISION_MAKERS}
                              required
                            />
                            {formData.decisionMaker !== "Employee Decision" && (
                              <ChoiceField
                                id="managementReason"
                                label="Management Decision"
                                placeholder="Select management decision"
                                value={formData.managementReason}
                                onChange={(value) => set("managementReason", value)}
                                options={MANAGEMENT_DECISION_REASONS}
                                required
                              />
                            )}
                            </>
                          ) : (
                            <>
                              <ChoiceField
                                id="branch"
                                label="Branch / Work Location"
                                icon={MapPin}
                                placeholder="Select Branch"
                                value={formData.branch}
                                onChange={(value) => set("branch", value)}
                                // Sohar is not a place employees are posted to.
                                options={initialBranches
                                  .map((branch) => branch.name)
                                  .filter((name) => name !== "Sohar")}
                                required
                              />
                              <ChoiceField
                                id="position"
                                label="Position"
                                icon={Briefcase}
                                placeholder="Select position"
                                value={formData.position}
                                onChange={(value) => set("position", value)}
                                options={EMPLOYEE_POSITIONS}
                                required
                              />
                              <ChoiceField
                                id="department"
                                label="Department"
                                icon={Network}
                                placeholder="Select department"
                                value={formData.department}
                                onChange={(value) => set("department", value)}
                                options={DEPARTMENT_GROUPS}
                                required
                              />
                            </>
                          )}
                        </div>

                        {formData.status !== "Inactive" && (
                          <>
                            {/* The grade, on a row of its own. A lawyer's grade is
                                their practice level, so it is asked once: choosing
                                one makes the employee a lawyer for everything that
                                follows - the lawyer's card among their papers, the
                                level on the employees list. */}
                            <div className="form-grid mt-6 gap-y-6 border-t pt-6">
                              <ChoiceField
                                id="grade"
                                label="Select Grade"
                                icon={Scale}
                                info="A consultant's grade, or a lawyer's practice level."
                                placeholder="Select grade"
                                value={formData.grade}
                                onChange={(value) => {
                                  const lawyer = LAWYER_GRADES.includes(value);
                                  setFormData((prev) => ({
                                    ...prev,
                                    grade: value,
                                    practiceLevel: lawyer ? value : "",
                                    occupation: lawyer ? "Lawyer" : value,
                                  }));
                                }}
                                options={GRADE_GROUPS}
                                required
                              />

                            {/* How the firm reaches them at work, beside the
                                grade once one is chosen. */}
                            {formData.grade && (
                              <>
                                <PhoneField
                                  id="workPhone"
                                  label="Work Phone Number"
                                  placeholder="Enter work phone number"
                                  dialCode={formData.workDialCode}
                                  onDialCode={(value) => set("workDialCode", value)}
                                  value={formData.workPhone}
                                  onChange={(e) => set("workPhone", e.target.value)}
                                />
                                <IconField
                                  icon={Mail}
                                  id="workEmail"
                                  name="workEmail"
                                  type="email"
                                  label={<>Work Email<Required show={asksFor} /></>}
                                  placeholder="name@firm.com"
                                  value={formData.workEmail}
                                  onChange={onChange}
                                  required={isAdding}
                                />
                              </>
                            )}
                            </div>

                          </>
                        )}
                      </section>
                      )}

                      {shows("contract") && (
                      <section className={cn(shows("employment") && "border-t pt-6")}>
                        {/* Named only where it shares the box with the job. */}
                        {shows("employment") && (
                          <h3 className="mb-4 text-base font-bold text-primary">
                            Contract &amp; Timeline
                          </h3>
                        )}
                        <div className="form-grid gap-y-6">
                          {/* How they are engaged and on what term, chosen
                              together and kept as the two answers it is. A term
                              without an end drops the end date it no longer has. */}
                          <ChoiceField
                            id="employmentContract"
                            label={<>Employment Type &amp; Contract Type<Required show={asksFor} /></>}
                            placeholder="Select"
                            value={
                              formData.employmentType && formData.contractType
                                ? formData.employmentType +
                                  " - " +
                                  (Object.keys(CONTRACT_TERMS).find(
                                    (term) => CONTRACT_TERMS[term] === formData.contractType
                                  ) || "")
                                : ""
                            }
                            onChange={(value) => {
                              const [type, term] = value.split(" - ");
                              const contractType = CONTRACT_TERMS[term];
                              setFormData((prev) => ({
                                ...prev,
                                employmentType: type,
                                contractType,
                                employmentEndDate:
                                  contractType === "Fixed-term" ? prev.employmentEndDate : "",
                              }));
                            }}
                            options={EMPLOYMENT_CONTRACT_GROUPS}
                            required
                          />
                          <div className="form-field space-y-2">
                            <Label htmlFor="dateOfJoining">Date of Joining<Required show={asksFor} /></Label>
                            <DateField
                              id="dateOfJoining"
                              name="dateOfJoining"
                              value={formData.dateOfJoining}
                              onChange={onChange}
                              required
                            />
                          </div>
                          <div className="form-field space-y-2">
                            <Label htmlFor="contractStartDate">Contract Start Date<Required show={asksFor} /></Label>
                            <DateField
                              id="contractStartDate"
                              name="contractStartDate"
                              value={formData.contractStartDate}
                              onChange={onChange}
                              required
                            />
                          </div>
                          {/* A fixed-term contract is one with an end, so it
                              is asked for, and only then; an open-ended one
                              has none. */}
                          {formData.contractType === "Fixed-term" && (
                            <div className="form-field space-y-2">
                              <Label htmlFor="employmentEndDate">Contract End Date</Label>
                              <DateField
                                id="employmentEndDate"
                                name="employmentEndDate"
                                value={formData.employmentEndDate}
                                onChange={onChange}
                                required
                              />
                            </div>
                          )}
                        </div>

                        {/* The terms, on a row of their own. */}
                        <div className="form-grid mt-6 gap-y-6">
                          <ChoiceField
                            id="probationPeriod"
                            label={<>Probation Period<Required show={asksFor} /></>}
                            placeholder="Select"
                            value={formData.probationPeriod}
                            onChange={(value) => set("probationPeriod", value)}
                            options={PROBATION_PERIODS}
                            optionLabel={(option) =>
                              option === DEFAULT_PROBATION ? option + " (Default)" : option
                            }
                            required
                          />
                          <ChoiceField
                            id="noticePeriod"
                            label={<>Notice Period<Required show={asksFor} /></>}
                            placeholder="Select"
                            value={formData.noticePeriod}
                            onChange={(value) => set("noticePeriod", value)}
                            options={NOTICE_PERIODS}
                            required
                          />
                          {/* The one leave figure on the record. Leave taken
                              is recorded on the leave page, not here. */}
                          <div className="form-field space-y-2">
                            <Label htmlFor="annualLeaveDays">
                              Number of Vacation Days<Required show={asksFor} />
                            </Label>
                            <Input
                              id="annualLeaveDays"
                              name="annualLeaveDays"
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              placeholder="Enter number of days"
                              value={formData.annualLeaveDays}
                              onChange={onChange}
                              required
                            />
                          </div>
                          <ChoiceField
                            id="socialProtection"
                            label={<>Registration in Social Protection<Required show={asksFor} /></>}
                            placeholder="Select"
                            value={formData.socialProtection}
                            onChange={(value) => set("socialProtection", value)}
                            options={["Yes", "No"]}
                            required
                          />
                        </div>
                      </section>
                      )}
                    </div>
                  </SectionCard>
                  {stepActions}
                  </>
                )}

                {/* The numbers and expiry dates of the papers that apply to
                    this person, decided by what was saved on the steps before:
                    the ID card for everybody, the lawyer's card for a lawyer,
                    passport and visa for a foreigner. Numbers only - the
                    papers themselves are filed on Documents. */}
                {shows("identity") && (
                  <SectionCard
                    title="Identity & Immigration"
                    footer={isAdding ? stepActions : profileActions}
                  >
                    <div className="form-grid gap-y-6">
                      <PaperFields
                        label={paperOmani ? "Civil ID" : "Resident Card"}
                        numberName="civilId"
                        expiryName="idExpiry"
                        values={formData}
                        onChange={onChange}
                      />
                      {paperLawyer && (
                        <PaperFields
                          label="Lawyer Card"
                          numberName="lawyerCardNo"
                          expiryName="lawyerCardExpiry"
                          values={formData}
                          onChange={onChange}
                        />
                      )}
                      {!paperOmani && (
                        <>
                          {/* Asked of a foreign employee but not demanded: the
                              resident card above is what the record cannot be
                              without. */}
                          <PaperFields
                            label="Passport"
                            numberName="passportNumber"
                            expiryName="passportExpiry"
                            values={formData}
                            onChange={onChange}
                            required={false}
                          />
                          <PaperFields
                            label="Visa"
                            numberName="visaNo"
                            expiryName="visaExpiry"
                            values={formData}
                            onChange={onChange}
                            required={false}
                          />
                          <PaperFields
                            label="Work Permit"
                            numberName="workPermitNo"
                            expiryName="workPermitExpiry"
                            values={formData}
                            onChange={onChange}
                            required={false}
                          />
                        </>
                      )}
                    </div>
                  </SectionCard>
                )}

                {/* What the employee is paid, what comes off it, where it is
                    sent, and what the first payroll will come to. */}
                {(shows("payroll") || shows("banking")) && (
                  <>
                    {/* Pay and what comes off it: Payroll Information. */}
                    {shows("payroll") && (
                    <SectionCard
                      title={isAdding ? "Payroll Information" : "Salary Information"}
                      icon={Wallet}
                      footer={isAdding ? stepActions : profileActions}
                    >
                      {/* The first payroll this pay goes into, worked out from
                          the lines below as they are typed. An estimate: the
                          month's own absences and changes settle the final
                          figure when payroll is run. */}
                      <div className="mb-6 space-y-4">
                        <div className="flex items-center gap-4 rounded-lg bg-blue-50/60 px-5 py-4">
                          <span
                            aria-hidden="true"
                            className="flex size-14 shrink-0 items-center justify-center rounded-full border bg-white text-primary"
                          >
                            <CalendarDays className="size-7" strokeWidth={1.5} />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-xl font-bold text-primary">
                              Next Payroll <span aria-hidden="true">•</span>{" "}
                              <span className="text-blue-700">{payrollMonth}</span>
                            </h3>
                            <p className="text-sm text-primary/75">
                              This is the employee's salary for the next month that
                              will be deposited into their bank account.
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <PayTile label="Total Earnings" value={gross} icon={Coins} tone="earnings" />
                          <PayTile label="Total Deductions" value={held} icon={Wallet} tone="deductions" />
                          <PayTile label="Net Salary" value={net} icon={Calculator} tone="net" />
                          <PayTile label="Amount Payable" value={payable} icon={HandCoins} tone="payable" />
                        </div>
                      </div>
                      <div className="form-grid gap-y-6">
                        <div className="form-field space-y-2" data-required="true">
                          <Label htmlFor="salaryEffectiveDate">
                            Effective Date
                            <Required show />
                          </Label>
                          <div className="flex items-center gap-2">
                            <DateField
                              id="salaryEffectiveDate"
                              name="salaryEffectiveDate"
                              value={formData.salaryEffectiveDate}
                              onChange={onChange}
                              required
                              className="min-w-0 flex-1"
                            />
                            {scheduled && (
                              <span className="shrink-0 rounded-md border border-primary px-2.5 py-1.5 text-xs font-semibold text-primary">
                                Scheduled
                              </span>
                            )}
                          </div>
                        </div>
                        {PAY_FIELDS.map((field) => (
                          <MoneyField
                            key={field.key}
                            id={field.key}
                            label={field.label}
                            value={formData[field.key]}
                            onChange={onChange}
                            required={field.required}
                          />
                        ))}
                        <MoneyField
                          id="grossSalary"
                          label="Gross Salary"
                          value={gross}
                          locked
                          required
                          note="Auto-calculated from salary components"
                        />
                        {DEDUCTION_FIELDS.map((field) => (
                          <MoneyField
                            key={field.key}
                            id={field.key}
                            label={field.label}
                            value={formData[field.key]}
                            onChange={onChange}
                            note={field.note}
                            locked={Boolean(field.note)}
                          />
                        ))}
                      </div>
                      {scheduled && (
                        <p className="mt-4 text-sm text-primary/75">
                          Effective {formatDate(effective)}. Current salary remains in
                          force until that date.
                        </p>
                      )}
                    </SectionCard>
                    )}

                    {/* Where it is paid to: Banking Information. */}
                    {shows("banking") && (
                    <SectionCard
                      title="Bank Information"
                      icon={Landmark}
                      footer={isAdding ? stepActions : profileActions}
                    >
                      {/* Four to a row, all asked for. No account holder's
                          name: the account is the employee's own. */}
                      <div className="form-grid gap-y-6">
                        <ChoiceField
                          id="bankName"
                          label="Bank Name"
                          placeholder="Select Bank"
                          value={formData.bankName}
                          onChange={(value) => set("bankName", value)}
                          options={RECEIVING_BANKS}
                          required
                        />
                        <div className="form-field space-y-2">
                          <Label htmlFor="accountNumber">
                            Account Number
                            <Required show={asksFor} />
                          </Label>
                          <Input
                            id="accountNumber"
                            name="accountNumber"
                            value={formData.accountNumber}
                            onChange={onChange}
                            placeholder="Enter account number"
                            inputMode="numeric"
                            aria-invalid={ruleBroken("accountNumber", formData.accountNumber, shapeChecked) || undefined}
                            required
                          />
                          <RuleNote name="accountNumber" value={formData.accountNumber} whole={shapeChecked} />
                        </div>
                        <div className="form-field space-y-2">
                          <Label htmlFor="iban">
                            IBAN
                            <Required show={asksFor} />
                          </Label>
                          <Input
                            id="iban"
                            name="iban"
                            value={formData.iban}
                            onChange={onChange}
                            placeholder="Enter IBAN"
                            aria-invalid={ruleBroken("iban", formData.iban, shapeChecked) || undefined}
                            required
                          />
                          <RuleNote name="iban" value={formData.iban} whole={shapeChecked} />
                        </div>
                        <div className="form-field space-y-2">
                          <Label htmlFor="swiftCode">
                            SWIFT Code
                            <Required show={asksFor} />
                          </Label>
                          <Input
                            id="swiftCode"
                            name="swiftCode"
                            value={formData.swiftCode}
                            onChange={onChange}
                            placeholder="Enter SWIFT code"
                            aria-invalid={ruleBroken("swiftCode", formData.swiftCode, shapeChecked) || undefined}
                            required
                          />
                          <RuleNote name="swiftCode" value={formData.swiftCode} whole={shapeChecked} />
                        </div>
                      </div>
                    </SectionCard>
                    )}
                  </>
                )}

                {/* The Fund's number and date are asked for; what is paid into
                    it is worked out from the basic pay saved on Salary &
                    Banking, and payroll is where those figures come from. */}
                {shows("socialProtection") && (
                  <SectionCard
                    title={isAdding ? "Social Protection Information" : "Social Protection Registration"}
                    icon={ShieldCheck}
                    footer={isAdding ? stepActions : profileActions}
                  >
                    <div className="form-grid gap-y-6">
                      <div className="form-field space-y-2">
                        <Label htmlFor="spRegistrationNo">Registration No.</Label>
                        <Input
                          id="spRegistrationNo"
                          name="spRegistrationNo"
                          value={formData.spRegistrationNo}
                          onChange={onChange}
                          placeholder="Enter registration number"
                          aria-invalid={ruleBroken("spRegistrationNo", formData.spRegistrationNo) || undefined}
                          required
                        />
                        <RuleNote name="spRegistrationNo" value={formData.spRegistrationNo} />
                      </div>
                      <div className="form-field space-y-2">
                        <Label htmlFor="spRegistrationDate">Registration Date</Label>
                        <DateField
                          id="spRegistrationDate"
                          name="spRegistrationDate"
                          value={formData.spRegistrationDate}
                          onChange={onChange}
                          required
                        />
                      </div>
                      <MoneyField
                        id="spEmployee"
                        label="Employee Contribution"
                        value={spEmployee}
                        locked
                      />
                      <MoneyField
                        id="spEmployer"
                        label="Employer Contribution"
                        value={spEmployer}
                        locked
                      />
                      <MoneyField
                        id="spTotal"
                        label="Total Contribution"
                        value={spEmployee + spEmployer}
                        locked
                      />
                      <div className="form-field space-y-2">
                        <Label htmlFor="spSource">Data Source</Label>
                        <Input id="spSource" value="Payroll" readOnly tabIndex={-1} className="bg-locked" />
                      </div>
                      <div className="form-field space-y-2">
                        <Label htmlFor="spUpdated">Last Updated</Label>
                        <Input
                          id="spUpdated"
                          value={formatDate(today)}
                          readOnly
                          tabIndex={-1}
                          className="bg-locked"
                        />
                      </div>
                    </div>
                  </SectionCard>
                )}

                  </fieldset>
                )}

                {/* The employee's papers, in a section of their own. Only once
                    the employee exists - there is nobody to file a paper
                    against before, which is why adding reaches them last. */}
                {/* On a record's Employee Information, the papers are Document
                    Intake as when the employee was added: what is filed is
                    listed, and new papers are read into the record and filed
                    on Save. */}
                {isProfile && tab === "documents" && (
                  <DocumentIntake
                    intake={intake}
                    filed={documents.map((paper) => ({
                      id: "filed-" + paper.id,
                      fileName: paper.fileName || paper.type,
                      typeLabel: paper.type,
                      number: paper.number,
                      expiry: paper.expiry,
                      fileUrl: paper.fileUrl,
                      onView: paper.downloadPath ? () => viewDocument(paper) : undefined,
                    }))}
                    footer={profileActions}
                  />
                )}

                {isDocuments && !isProfile && (isEditMode || isAdding) && (
                  <Card>
                  <CardContent className="p-4 sm:p-6">
                  <div className="space-y-6">
                    {/* What is on file. A paper is never corrected or taken
                        off: a new one of the same kind is added, and the old
                        one stays on the list as Replaced - so the file shows
                        what was held and when, not only what is held now. */}
                    <div className="space-y-4">
                      {/* The list's name, and the way to add to it, on one row. */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="h-8 w-1 rounded-full bg-primary" />
                          <FileText
                            strokeWidth={1.5}
                            aria-hidden="true"
                            className="size-7 shrink-0 text-primary"
                          />
                          <div>
                            <h2 className="text-xl font-bold text-primary">Employee Documents</h2>
                            {addingDoc && (
                              <p className="text-sm text-primary/75">Add Document</p>
                            )}
                          </div>
                        </div>
                        {/* Gone while the form is open: it is the form. */}
                        {!readOnly && !addingDoc && (
                          <Button type="button" variant="add" onClick={() => setAddingDoc(true)}>
                            <Plus className="me-2 h-4 w-4" />
                            Add Document
                          </Button>
                        )}
                      </div>

                      {/* Asked for a step at a time: the category, then the
                          type and its copy, then - once the copy is attached -
                          when it runs out and anything to note. A paper that
                          stands for details not yet saved on the record cannot
                          be uploaded until they are. */}
                      {addingDoc ? (
                        <div ref={docFormRef} className="space-y-6">
                          <div className="form-grid gap-y-6">
                            <ChoiceField
                              id="docCategory"
                              label="Document Category"
                              placeholder="Select category"
                              value={docDraft.category}
                              onChange={chooseCategory}
                              options={docCategories}
                              iconFor={documentCategoryIcon}
                              required
                            />

                            {docDraft.category && (
                              <div
                                className="form-field space-y-2"
                                data-required="true"
                              >
                                <Label htmlFor="docType">Document Type</Label>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={docDraft.type}
                                    onValueChange={(value) => value && chooseType(value)}
                                  >
                                    <SelectTrigger id="docType" className="min-w-0 flex-1">
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {typesInCategory.map((type) => {
                                        const TypeIcon = documentTypeIcon(type);
                                        return (
                                          <SelectItem key={type} value={type}>
                                            <span className="flex items-center gap-2.5">
                                              <TypeIcon
                                                strokeWidth={1.5}
                                                aria-hidden="true"
                                                className="size-[18px] shrink-0 text-primary"
                                              />
                                              {documentTypeLabel(type)}
                                            </span>
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                  {/* Open only once there is a type, and only
                                      when its details are on file. */}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 text-primary [&_svg]:size-6"
                                    disabled={!docDraft.type}
                                    title="Upload document"
                                    asChild={Boolean(docDraft.type)}
                                  >
                                    {docDraft.type ? (
                                      <label className="cursor-pointer">
                                        <CloudUpload aria-hidden="true" />
                                        <span className="sr-only">Upload document</span>
                                        <input
                                          type="file"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;
                                            setDocFile(file);
                                            // Started from the expiry the record
                                            // already holds for this paper.
                                            setDocDraft((prev) => ({
                                              ...prev,
                                              expiry:
                                                prev.expiry ||
                                                relatedExpiry(prev.type, filedDetails),
                                            }));
                                          }}
                                        />
                                      </label>
                                    ) : (
                                      <span>
                                        <CloudUpload aria-hidden="true" />
                                        <span className="sr-only">Upload document</span>
                                      </span>
                                    )}
                                  </Button>
                                </div>
                                {docFile && (
                                  <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-sm text-primary">
                                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{docFile.name}</span>
                                    <CircleCheck
                                      aria-hidden="true"
                                      className="size-4 shrink-0 fill-green-600 text-white"
                                    />
                                  </span>
                                )}

                            {docTried && docDraft.type && !docFile && (
                                  <p className="text-xs text-destructive">
                                    Upload the document to save it.
                                  </p>
                                )}
                              </div>
                            )}

                              {docDraft.type && (
                            <>
                              <div className="form-field space-y-2">
                                <Label htmlFor="docNumber">Document Number</Label>
                                <Input
                              id="docNumber"
                              value={docDraft.number}
                              onChange={(e) =>
                                setDocDraft((prev) => ({ ...prev, number: e.target.value }))
                              }
                              placeholder="Enter document number"
                                />
                                <p className="flex items-start gap-2 rounded-md bg-menu-hover p-2.5 text-xs text-primary">
                              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                              If this document number has been added previously,
                              it will appear here automatically.
                                </p>
                              </div>

                              {documentExpires(docDraft.type) && (
                                <div className="form-field space-y-2">
                              <Label htmlFor="docExpiry">Expiry Date</Label>
                              <DateField
                                id="docExpiry"
                                value={docDraft.expiry}
                                onChange={(e) =>
                                  setDocDraft((prev) => ({ ...prev, expiry: e.target.value }))
                                }
                                required
                              />
                              <p className="flex items-start gap-2 rounded-md bg-menu-hover p-2.5 text-xs text-primary">
                                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                If this document has been added previously, the
                                date will appear here automatically.
                              </p>
                                </div>
                              )}
                            </>
                            )}



                            {docDraft.type && (
                              <div className="form-field span-12 space-y-2">
                                <Label htmlFor="docNotes">Notes</Label>
                                <Textarea
                                  id="docNotes"
                                  rows={3}
                                  maxLength={NOTES_LIMIT}
                                  placeholder="Enter any additional notes"
                                  value={docDraft.notes}
                                  onChange={(e) =>
                                    setDocDraft((prev) => ({ ...prev, notes: e.target.value }))
                                  }
                                />
                                <p className="text-end text-xs text-muted-foreground">
                                  {docDraft.notes.length}/{NOTES_LIMIT}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={closeDocForm}>
                              Cancel
                            </Button>
                            <Button type="button" onClick={addDocument} disabled={saving}>
                              <Save className="me-2 h-4 w-4" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : orderedDocuments.length === 0 ? (
                        <EmptyState>No documents uploaded yet.</EmptyState>
                      ) : (
                        <RecordTable minWidth={860}>
                          <HeadRow>
                            <Th width="20%">Document Category</Th>
                            <Th width="26%">Document Type</Th>
                            <Th width="14%">Upload Date</Th>
                            <Th width="18%">Expiry</Th>
                            <Th width="22%">Notes</Th>
                          </HeadRow>
                          <tbody>
                            {/* One row for each paper held now - the current
                                version of a versioned paper stands for all of
                                its versions, and the older ones open under it. */}
                            {orderedDocuments
                              .filter((document) => documentStatus(document, documents) !== "Archived")
                              .map((document) => {
                                const versions = isVersioned(document.type)
                                  ? documentVersions(document.type, documents)
                                  : [];
                                const older = versions.slice(0, -1).reverse();
                                const historyOpen = openHistory.includes(document.type);
                                return (
                                  <Fragment key={document.id}>
                                    {documentRow(document, documentStatus(document, documents), {
                                      version: versions.length || null,
                                      older: older.length,
                                      historyOpen,
                                    })}
                                    {historyOpen &&
                                      older.map((version) =>
                                        documentRow(version, "Archived", {
                                          version: version.version,
                                          archivedRow: true,
                                        })
                                      )}
                                  </Fragment>
                                );
                              })}
                          </tbody>
                        </RecordTable>
                      )}
                    </div>
                  </div>
                  {stepActions && (
                    <div className="mt-6 border-t pt-4">{stepActions}</div>
                  )}
                  </CardContent>
                  </Card>
                )}

                {shownSection === "benefits" && (
                  <FinancialBenefitsSection
                    employee={formData}
                    tab={benefitsTab}
                    onTabChange={setBenefitsTab}
                    canEdit={!readOnly}
                    onSaveSalary={(payslip) =>
                      setFormData((prev) => ({ ...prev, ...payslip }))
                    }
                    // From Requests: the chosen request's list alone.
                    listOnly={isRequests}
                  />
                )}

                {shownSection === "entitlements" && (
                  <EntitlementsSection
                    // From Requests it opens on the entitlement chosen there,
                    // and opens afresh when another is chosen.
                    key={isRequests ? requestItem.key : "entitlements"}
                    listOnly={isRequests}
                    tab={isRequests ? requestItem.tab : undefined}
                    employee={formData}
                    canEdit={!readOnly}
                  />
                )}

                {/* A request with no page of its own yet says so, rather
                    than having one made up for it. */}
                {isRequests && requestItem && !requestItem.section && (
                  <EmptyState>{requestItem.label} requests are not set up yet.</EmptyState>
                )}

                {shownSection === "daily" && (
                  <DailyActivitiesSection employee={formData} />
                )}

                {activeSection === "circulars" && (
                  <EmployeeCircularsSection employee={formData} self={self} />
                )}

                {shownSection === "performance" && <PerformanceSection />}

                {shownSection === "violations" && (
                  <ViolationsSection employee={formData} canEdit={!readOnly} />
                )}

                {shownSection === "leaves" && (
                  <LeavesSection employee={formData} canReview={!readOnly} />
                )}

                {shownSection === "generalRequest" && (
                  <GeneralRequestSection
                    // From Requests it opens on the kind chosen there - a
                    // general request, a grievance or a complaint.
                    key={isRequests ? requestItem.key : "general"}
                    kind={(isRequests && requestItem.kind) || "general"}
                    employee={formData}
                    canDecide={!readOnly}
                  />
                )}

                {/* Not yet specified, so nothing is invented for it */}
                {activeSection === "permissions" && (
                  <EmptyState>{current.label} is not set up yet.</EmptyState>
                )}

                {/* Save at the end of what it saves, where the last field
                    leaves off. A section that saves its own records has
                    nothing here: there is no draft on the page to save. */}
                {!isAdding && !savesFor.noSave && !readOnly && (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {profileSaved && (
                      <p role="status" className="text-sm font-semibold text-green-700">
                        Changes saved.
                      </p>
                    )}
                    <Button type="submit" disabled={saving}>
                      <Save className="me-2 h-4 w-4" />
                      {savesFor.save || "Save"}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
