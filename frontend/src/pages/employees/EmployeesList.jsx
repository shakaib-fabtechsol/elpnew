import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { useLeaves } from "@/lib/leaves/context";
import { onLeaveToday, annualLeaveLeft } from "./leaveData";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import FilterPanel from "@/components/shared/FilterPanel";
import { filterChips, withoutChip } from "@/lib/filterChips";
import { StatCard, StatCards } from "@/components/shared/StatCard";
import {
  Users,
  UserCheck,
  UserX,
  FileText,
  Eye,
  AlertCircle,
  AlertTriangle,
  Briefcase,
  MapPin,
  Building2,
  Globe,
  CalendarDays,
  UserRoundCog,
  Scale,
  KeyRound,
  Network,
  ChevronRight,
  Coins,
  CheckCircle2,
  Clock3,
  BarChart3,
  Gavel,
  ClipboardList,
} from "lucide-react";
import { SalaryView, LeaveView, DocumentsView } from "./EmployeeQuickViews";
import { mayView } from "./viewAccess";
import { managementApi } from "@/lib/api/modules/management";
import { initialViolations } from "./violationData";
import { initialAdvances } from "./advanceSalaryData";
import { initialBonuses } from "./bonusData";
import { loanRecords } from "./loanData";
import { assistanceRecords } from "./assistanceData";
import { initialEntitlements } from "./entitlementData";
import { initialGeneralRequests } from "./generalRequestData";
import { cn } from "@/lib/utils";
import { IdStatusDot, isEndedStatus } from "@/components/shared/panels";
import {
  employeeRecords,
  netSalary,
  amount,
  documentsFor,
  documentStatus,
  employeeDocuments,
  accessHold,
  documentStanding,
} from "./employeeData";
import { readDocumentControl } from "@/lib/settings/documentControl";
import { can } from "@/lib/access";
import useDataset from "@/lib/api/useDataset";

/** A fact with its heading beside it, where the pair fits on one line. */
/**
 * A label and its value, side by side on one line.
 *
 * Laid out rather than run together as text: a value set with a space after
 * the label can be pushed onto a line of its own when the column narrows, and
 * a date sitting under "Date of Joining:" reads as two facts rather than one.
 * The value keeps to one line for the same reason.
 */
function Inline({ label, children, strong }) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-baseline gap-x-1 leading-tight",
        strong && "text-primary"
      )}
    >
      <span className="font-semibold">{label}</span>
      <span className={cn("whitespace-nowrap", strong && "font-semibold")}>
        {children || "-"}
      </span>
    </p>
  );
}

/** An amount as it is written everywhere: the figure, then the currency. */
const money = (value) => amount(value);

/** A label and its value on one line, for the stacked cells. */
const Fact = ({ label, children }) => (
  <p className="text-xs text-primary/75">
    <span className="font-semibold">{label}:</span> {children}
  </p>
);

/**
 * How each standing is marked.
 *
 * Two, because there are two: away on approved leave is said by the Leave
 * column beside this one, out of the leave book, and no longer a standing a
 * record carries about itself.
 */
const STATUS_TONE = {
  Active: "bg-status-active",
  Inactive: "bg-status-inactive",
};


/**
 * The one document worth showing in a row, and how many others are waiting.
 *
 * Expired before expiring soon, because a paper that has run out stops work
 * while one about to run out only threatens to. Papers in order are not
 * mentioned at all: a column that lists every document is a column nobody
 * reads, and the point of this one is to be scanned.
 */
const RANK = { Expired: 0, "Expiring Soon": 1 };

function criticalDocument(employeeId) {
  const flagged = documentsFor(employeeId)
    .map((doc) => ({ ...doc, status: documentStatus(doc) }))
    .filter((doc) => doc.status in RANK)
    .sort((a, b) => RANK[a.status] - RANK[b.status]);

  if (!flagged.length) return null;
  return { document: flagged[0], more: flagged.length - 1 };
}

/** Rows with a paper that has run out are read first, before anything else. */
const byUrgency = (a, b) => {
  const rank = (row) => {
    const alert = criticalDocument(row.id);
    return alert ? RANK[alert.document.status] : 2;
  };
  return rank(a) - rank(b);
};

const employees = employeeRecords;

/** Every value a column actually holds, in the order they were first met. */
const valuesOf = (key) =>
  employees.map((row) => row[key]).filter((v, i, all) => v && all.indexOf(v) === i);

/** "All", then whatever the records hold, as the panel wants its options. */
const optionsOf = (key) => [
  { value: "all", label: "All" },
  ...valuesOf(key).map((one) => ({ value: one, label: one })),
];

/**
 * The questions this list can be narrowed by.
 *
 * Branch and Department read their choices from the records themselves, so a
 * new one appears here without an edit. The last group is the General
 * Manager's alone: it is left out of the array entirely rather than merely
 * greyed, because a filter nobody may use is still a filter that says what
 * the system holds.
 */
const filterFields = (canSeeDocuments) =>
  [
    {
      key: "status",
      label: "Employment Status",
      icon: Briefcase,
      type: "radio",
      options: [
        { value: "all", label: "All" },
        { value: "Active", label: "Active" },
        { value: "Inactive", label: "Inactive" },
      ],
    },
    { key: "branch", label: "Branch", icon: MapPin, type: "radio", options: optionsOf("branch") },
    {
      key: "department",
      label: "Department",
      icon: Building2,
      type: "radio",
      options: optionsOf("department"),
    },
    {
      key: "gender",
      label: "Gender",
      icon: Users,
      type: "radio",
      options: [
        { value: "all", label: "All" },
        { value: "Male", label: "Male" },
        { value: "Female", label: "Female" },
      ],
    },
    {
      key: "nationality",
      label: "Nationality",
      icon: Globe,
      type: "radio",
      options: [
        { value: "all", label: "All" },
        { value: "Omani", label: "Omani" },
        { value: "Non-Omani", label: "Non-Omani" },
      ],
    },
    {
      key: "leave",
      label: "Leave Status",
      icon: CalendarDays,
      type: "radio",
      options: [
        { value: "all", label: "All" },
        { value: "on", label: "On Leave" },
        { value: "off", label: "Not on Leave" },
      ],
    },
    canSeeDocuments && {
      key: "documentStatus",
      label: "Document Status",
      note: "General manager only",
      icon: UserRoundCog,
      type: "checkbox",
      // Either, both, or neither: neither is no document filter at all.
      options: [
        { value: "Missing", label: "Missing" },
        { value: "Expired", label: "Expired" },
        { value: "Expiring Soon", label: "Expiring Soon" },
      ],
    },
    {
      key: "practiceLevel",
      label: "Legal Practice Level",
      icon: Scale,
      type: "radio",
      // Only lawyers are admitted to a court, so choosing a level narrows the
      // list to lawyers by the same stroke.
      options: [
        { value: "all", label: "All" },
        { value: "Trainee", label: "Trainee" },
        { value: "Primary", label: "Primary" },
        { value: "Appeal", label: "Appeal" },
        { value: "Supreme", label: "Supreme" },
      ],
    },
    {
      key: "access",
      label: "Access Level",
      icon: KeyRound,
      placeholder: "Under construction",
    },
  ].filter(Boolean);

/** A record kept only if it answers to every filter in force. */
const matches = (row, filters, leaves) =>
  Object.entries(filters).every(([key, value]) => {
    if (!value || value === "all" || (Array.isArray(value) && !value.length)) return true;

    switch (key) {
      // Inactive covers everyone no longer working, however they left.
      case "status":
        return value === "Inactive" ? isEndedStatus(row.status) : row.status === value;
      case "nationality":
        return value === "Omani"
          ? row.nationality === "Omani"
          : row.nationality !== "Omani";
      // Approved leave covering today, which the record carries as a standing.
      case "leave":
        return onLeaveToday(leaves, row.name) === (value === "on");
      // Either mark, or both; a paper only has to be in one of them.
      case "documentStatus":
        return (
          (value.includes("Missing") && documentStanding(row).missing.length > 0) ||
          documentsFor(row.id).some((doc) => value.includes(documentStatus(doc)))
        );
      case "practiceLevel":
        return levelOf(row) === value;
      default:
        return row[key] === value;
    }
  });


/**
 * The court a lawyer is admitted to, read off whichever way the record says
 * it - the old practice levels or the newer grades.
 */
const levelOf = (row) => {
  const said = String(row.practiceLevel || row.grade || "");
  if (/trainee/i.test(said)) return "Trainee";
  if (/primary/i.test(said)) return "Primary";
  if (/appeal/i.test(said)) return "Appeal";
  if (/supreme/i.test(said)) return "Supreme";
  return "";
};

/** How somebody no longer here left, where the record says. */
const leftAs = (row) => {
  const why = [row.managementReason, row.reasonForLeaving].join(" ");
  if (/termination|dismiss/i.test(why)) return "Termination";
  if (row.decisionMaker === "Employee Decision" || /resign/i.test(why)) return "Resignation";
  if (/contract|retire|end of/i.test(why)) return "End of Service";
  return "";
};

/** "Mohammed Al Yahyaei" -> "MY": the mark where a photo would be. */
const initials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter((_, index, all) => index === 0 || index === all.length - 1)
    .join("")
    .toUpperCase();

/** Whether an ISO date falls in the current calendar month. */
const inThisMonth = (iso) =>
  Boolean(iso) && String(iso).slice(0, 7) === new Date().toISOString().slice(0, 7);

/** A small "View More >" link under a figure, opening one of the windows. */
/*
 * Defined out here, not inside the page: a component made afresh on every
 * render is a new component to React, so the button that opened a window
 * would be torn down and rebuilt - and the page would lose its place.
 */
const More = ({ children = "View More", onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-0.5 rounded text-sm font-medium text-record-link hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {children}
    <ChevronRight className="size-3.5" aria-hidden="true" />
  </button>
);

const DOCUMENT_TONE = {
  Complete: "bg-emerald-50 text-emerald-700",
  "Expiring Soon": "bg-amber-50 text-amber-700",
  Incomplete: "bg-red-50 text-red-700",
  Expired: "bg-red-50 text-red-700",
};
const DocumentMark = ({ status }) =>
  status === "Complete" ? (
    <CheckCircle2 className="size-4" aria-hidden="true" />
  ) : status === "Expiring Soon" ? (
    <Clock3 className="size-4" aria-hidden="true" />
  ) : (
    <AlertCircle className="size-4" aria-hidden="true" />
  );

export default function EmployeesList() {
  const navigate = useNavigate();
  const { leaves } = useLeaves();
  // Every column here is read off these three: the records, their papers and
  // the leave book. Followed here, so the page re-renders with fresh records
  // after a Retry; the table shows skeletons while any is loading and
  // "Unable to load employees" with Retry if any failed.
  const dataset = useDataset(["employees", "employee documents", "leaves"]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({});
  // The window open on one employee - { kind: "salary" | "leave" |
  // "documents", id } - or null. A window over the table, never a page of
  // its own, so closing it leaves the table exactly where it was.
  const [openView, setOpenView] = useState(null);
  // Re-read after a paper is filed from the documents window.
  const [, setChanged] = useState(0);

  // Each employee's latest evaluation score and standing, for the
  // Performance Evaluation column. Fetched once; somebody not allowed to read
  // evaluations simply sees dashes.
  const [standings, setStandings] = useState({});
  useEffect(() => {
    let cancelled = false;
    managementApi
      .standing()
      .then((rows) => {
        if (cancelled) return;
        const all = rows?.employees || [];
        setStandings(Object.fromEntries(all.map((one) => [one.id, one])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Standard: the document group is the general manager's. Left out of the
  // list entirely for anybody else - the server enforces the same rule, this
  // only keeps the panel honest about it.
  // Access level, document alerts and practice level are the general
  // manager's to read. The server enforces the same rule; this only keeps the
  // page from printing what it should not.
  const canSeeRestricted = CURRENT_USER.role === "admin";
  // The grace period and action set on System Settings.
  const documentControl = readDocumentControl();
  const fields = filterFields(canSeeRestricted);
  const chips = filterChips(fields, filters);

  /** Narrowing the list always starts it again at its first page. */
  const narrow = (next) => {
    setFilters(next);
    setCurrentPage(1);
  };

  /** Investigations still open against somebody - those without a penalty decided. */
  const openInvestigations = (row) =>
    initialViolations.filter(
      (one) => one.employeeId === row.id && one.investigationStatus === "Under Investigation"
    ).length;

  /** Requests of every kind still waiting on a decision. */
  const pendingRequests = (row) =>
    [
      ...leaves,
      ...initialAdvances,
      ...loanRecords,
      ...assistanceRecords,
      ...initialBonuses,
      ...initialEntitlements,
      ...initialGeneralRequests,
    ].filter(
      (one) =>
        (one.employeeId === row.id || (!one.employeeId && one.employee === row.name)) &&
        /pending|awaiting|returned|under review/i.test(String(one.status))
    ).length;

  const viewing = openView && employees.find((row) => row.id === openView.id);
  const closeView = (open) => !open && setOpenView(null);

  const shown = employees
    .filter((row) => matches(row, filters, leaves))
    .sort(byUrgency);

  // The figures across the top, counted off the same records the table
  // shows, so the two can never disagree.
  const active =employees.filter((row) => !isEndedStatus(row.status));
  const onLeave = employees.filter((row) => onLeaveToday(leaves, row.name));
  const leaveStartedThisMonth = new Set(
    leaves
      .filter((leave) => leave.status === "Approved" && inThisMonth(leave.from))
      .map((leave) => leave.employee)
  );
  const expiredDocuments = employeeDocuments.filter(
    (doc) => documentStatus(doc) === "Expired"
  );
  const expiringDocuments = employeeDocuments.filter(
    (doc) => documentStatus(doc) === "Expiring Soon"
  );
  // Required papers not on file, across everybody (requiredDocumentTypes).
  const missingDocuments = employees.reduce(
    (total, row) => total + documentStanding(row).missing.length,
    0
  );

  /** A card toggles its own filter on and off, and leaves the rest alone. */
  const toggle = (key, value) =>
    narrow(
      filters[key] === value || (Array.isArray(filters[key]) && filters[key].includes(value))
        ? { ...filters, [key]: undefined }
        : { ...filters, [key]: key === "documentStatus" ? [value] : value }
    );

  // The breakdowns under the figures, counted off the same records.
  const omani = active.filter((row) => row.nationality === "Omani").length;
  const share = (n) => (active.length ? Math.round((n / active.length) * 100) : 0);
  const lawyers = employees.filter((row) => levelOf(row) || row.role === "Lawyer");
  const atLevel = (level) => lawyers.filter((row) => levelOf(row) === level).length;
  const inactive = employees.filter((row) => isEndedStatus(row.status));
  const leftBy = (how) => inactive.filter((row) => leftAs(row) === how).length;
  const joinedThisMonth = employees.filter((row) => inThisMonth(row.dateOfJoining)).length;
  // The document breakdown narrows the list only for the general manager,
  // whose filter it is; for anybody else it reports the figures.
  const documentTile = (label, status, tone) => ({
    label,
    tone,
    value:
      status === "Expired"
        ? expiredDocuments.length
        : status === "Missing"
          ? missingDocuments
          : expiringDocuments.length,
    active: Array.isArray(filters.documentStatus) && filters.documentStatus.includes(status),
    onClick: canSeeRestricted ? () => toggle("documentStatus", status) : undefined,
  });
  const levelTile = (label, level) => ({
    label,
    value: atLevel(level),
    active: filters.practiceLevel === level,
    onClick: () => toggle("practiceLevel", level),
  });

  const summary = [
    {
      key: "total",
      icon: Users,
      tone: "blue",
      value: employees.length,
      label: "Total Employees",
      note: { icon: "trend", text: "+" + joinedThisMonth + " this month" },
      // Nothing is marked chosen while the whole list shows: the cards are
      // alike until one narrows it.
      onClick: () => narrow({}),
    },
    {
      key: "active",
      icon: UserCheck,
      tone: "green",
      value: active.length,
      label: "Active Employees",
      tiles: [
        {
          label: "Omani",
          tone: "green",
          dot: "green",
          value: omani + " (" + share(omani) + "%)",
          active: filters.nationality === "Omani",
          onClick: () => toggle("nationality", "Omani"),
        },
        {
          label: "Non-Omani",
          dot: "slate",
          value: active.length - omani + " (" + share(active.length - omani) + "%)",
          active: filters.nationality === "Non-Omani",
          onClick: () => toggle("nationality", "Non-Omani"),
        },
      ],
      active: filters.status === "Active",
      onClick: () => toggle("status", "Active"),
    },
    {
      // A lawyer's court: Trial is the courts of first instance, Initial the
      // trainee's register.
      key: "lawyers",
      icon: Scale,
      tone: "purple",
      value: lawyers.length,
      label: "Lawyers",
      tiles: [
        levelTile("Trial", "Primary"),
        levelTile("Appellate", "Appeal"),
        levelTile("Supreme", "Supreme"),
        levelTile("Initial", "Trainee"),
      ],
    },
    {
      key: "leave",
      icon: CalendarDays,
      tone: "orange",
      value: onLeave.length,
      label: "On Leave",
      note: { icon: "dot", text: leaveStartedThisMonth.size + " this month" },
      active: filters.leave === "on",
      onClick: () => toggle("leave", "on"),
    },
    {
      key: "documents",
      icon: FileText,
      tone: "amber",
      // Papers that need somebody to act: missing, run out, or about to.
      value: missingDocuments + expiredDocuments.length + expiringDocuments.length,
      label: "Documents",
      tiles: [
        documentTile("Missing", "Missing"),
        documentTile("Expiring Soon", "Expiring Soon", "orange"),
        documentTile("Expired", "Expired", "red"),
      ],
    },
    {
      key: "inactive",
      icon: UserX,
      tone: "red",
      value: inactive.length,
      label: "Inactive Employees",
      tiles: [
        { label: "Termination", value: leftBy("Termination") },
        { label: "Resignation", value: leftBy("Resignation") },
        { label: "End of Service", value: leftBy("End of Service") },
      ],
      active: filters.status === "Inactive",
      onClick: () => toggle("status", "Inactive"),
    },
  ];
  const columns = [
    {
      key: "empNo",
      header: "Employee No.",
      width: "9%",
      // A reference: sorted as text, which puts the digits in numeric order
      // ("EMP-0009" before "EMP-0010"), like every ID in the system.
      sort: "text",
      render: (value, row) => (
        <button
          type="button"
          onClick={() => navigate("/employees/" + row.id)}
          className="numeric-value font-semibold text-record-link transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {value}
        </button>
      ),
    },
    {
      key: "name",
      header: "Employee",
      width: "18%",
      sort: "text",
      skeleton: "avatar",
      // The name opens the full profile: employment, personal, contract and
      // administrative information.
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-primary"
          >
            {initials(value)}
          </span>
          <div className="min-w-0 space-y-0.5">
            <button
              type="button"
              onClick={() => navigate("/employees/" + row.id)}
              className="text-start font-semibold text-primary hover:text-record-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {value}
            </button>
            <p className="text-xs text-muted-foreground">
              {row.empNo} <span className="px-1">|</span> {row.nationality}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "designation",
      header: "Employment Details",
      width: "24%",
      // Combined information: nothing single to put it in order by.
      sort: false,
      skeleton: "lines",
      render: (value, row) => (
        <div className="space-y-1.5">
          <span className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-primary">
            {value || "\u2013"}
          </span>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-primary/80">
            <span className="inline-flex items-center gap-1">
              <Network className="size-3.5" aria-hidden="true" />
              {row.department || "\u2013"}
            </span>
            <span aria-hidden="true">|</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {row.branch || "\u2013"}
            </span>
            <span aria-hidden="true">|</span>
            <span className="inline-flex items-center gap-1">
              <FileText className="size-3.5" aria-hidden="true" />
              {row.contractType || "\u2013"}
            </span>
          </p>
          {/* Only lawyers hold one, and only the general manager may read it. */}
          {canSeeRestricted && row.practiceLevel && (
            <p className="text-xs text-muted-foreground">Practice level: {row.practiceLevel}</p>
          )}
        </div>
      ),
    },
    {
      key: "salary",
      header: "Net Salary",
      width: "12%",
      sort: "money",
      skeleton: "lines",
      sortValue: (row) => (mayView.salary() ? netSalary(row) : null),
      exportValue: (row) => (mayView.salary() ? netSalary(row) : ""),
      // Salary is shown only to somebody allowed to read payroll.
      render: (value, row) =>
        mayView.salary() ? (
          <div className="flex gap-2">
            <Coins className="mt-0.5 size-[18px] shrink-0 text-primary/60" strokeWidth={1.5} aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="numeric-value font-semibold text-emerald-700">{money(netSalary(row))}</p>
              <More onClick={() => setOpenView({ kind: "salary", id: row.id })} />
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Restricted</span>
        ),
    },
    {
      key: "leave",
      header: "Leave",
      width: "11%",
      // By the remaining balance; an employee with no balance sorts last.
      sort: "balance",
      skeleton: "lines",
      sortValue: (row) => annualLeaveLeft(leaves, row.name),
      exportValue: (row) => annualLeaveLeft(leaves, row.name) ?? "",
      render: (value, row) => {
        const left = annualLeaveLeft(leaves, row.name);
        return (
          <div className="flex gap-2">
            <CalendarDays className="mt-0.5 size-[18px] shrink-0 text-primary/60" strokeWidth={1.5} aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-semibold text-primary">
                {left === null ? "\u2013" : left + " days"}
              </p>
              <p className="text-xs text-muted-foreground">remaining</p>
              {/* Approved leave covering today, worked out from the requests
                  themselves rather than read off a standing on the record. */}
              {onLeaveToday(leaves, row.name) && (
                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  On leave
                </span>
              )}
              {mayView.leave() && <More onClick={() => setOpenView({ kind: "leave", id: row.id })} />}
            </div>
          </div>
        );
      },
    },
    {
      key: "documents",
      header: "Documents",
      width: "14%",
      // By how urgent the papers are: expired, missing, expiring, in order.
      sort: "status",
      sortOrder: ["Expired", "Incomplete", "Expiring Soon", "Complete"],
      sortValue: (row) => documentStanding(row).status,
      exportValue: (row) => documentStanding(row).status,
      skeleton: "lines",
      render: (value, row) => {
        const standing = documentStanding(row);
        const count =
          standing.status === "Expired"
            ? standing.expired.length
            : standing.status === "Incomplete"
              ? standing.missing.length
              : standing.status === "Expiring Soon"
                ? standing.expiring.length
                : 0;
        return (
          <div className="space-y-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                DOCUMENT_TONE[standing.status]
              )}
            >
              <DocumentMark status={standing.status} />
              {standing.status}
              {count > 0 && " (" + count + ")"}
            </span>
            {mayView.documents() && (
              <div>
                <More onClick={() => setOpenView({ kind: "documents", id: row.id })}>View Documents</More>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "9%",
      sort: "status",
      sortOrder: ["Active", "Inactive"],
      // Its own column rather than a line under the name: standing is the one
      // thing on this row that changes, and a column can be scanned down and
      // sorted where a line buried in a cell cannot.
      render: (value, row) => {
        // A lapsed critical paper holds access after its grace period, and
        // that is said here, under the standing it qualifies.
        const hold = accessHold(documentsFor(row.id), documentControl);
        return (
          <div className="space-y-1">
            <span className="inline-flex items-center gap-2 text-primary">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  STATUS_TONE[value] || "bg-muted-foreground"
                )}
              />
              {value}
            </span>
            {hold && (
              <p
                className={cn(
                  "text-xs font-medium",
                  hold.state === "held" ? "text-red-700" : "text-amber-700"
                )}
              >
                {hold.state === "held"
                  ? hold.action === "Restrict access"
                    ? "Access restricted"
                    : "Access suspended"
                  : "Grace period: " + hold.daysLeft + " day" + (hold.daysLeft === 1 ? "" : "s") + " left"}
              </p>
            )}
          </div>
        );
      },
    },
    /* Additional columns - hidden by default, turned on from Columns. */
    {
      key: "access",
      header: "Access Level",
      width: "9%",
      hidden: true,
      sort: false,
      render: () => <span className="text-doc-absent">&ndash;</span>,
    },
    {
      key: "evaluation",
      optional: true,
      icon: BarChart3,
      header: "Performance Evaluation",
      width: "11%",
      hidden: true,
      sort: "number",
      sortValue: (row) => standings[row.id]?.lastScore ?? null,
      exportValue: (row) => standings[row.id]?.lastScore ?? "",
      render: (value, row) => {
        const one = standings[row.id];
        if (!one || one.lastScore == null) return <span className="text-muted-foreground">&ndash;</span>;
        return (
          <div className="space-y-0.5">
            <p className="numeric-value font-semibold text-primary">{one.lastScore}</p>
            {one.standing && <p className="text-xs text-muted-foreground">{one.standing}</p>}
          </div>
        );
      },
    },
    {
      key: "investigations",
      optional: true,
      icon: Gavel,
      header: "Investigation Committees",
      width: "10%",
      hidden: true,
      sort: "number",
      sortValue: (row) => openInvestigations(row),
      exportValue: (row) => openInvestigations(row),
      render: (value, row) => {
        const open = openInvestigations(row);
        return open ? (
          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {open} under investigation
          </span>
        ) : (
          <span className="text-muted-foreground">None</span>
        );
      },
    },
    {
      key: "pendingRequests",
      optional: true,
      icon: ClipboardList,
      header: "Pending Requests",
      width: "9%",
      hidden: true,
      sort: "number",
      sortValue: (row) => pendingRequests(row),
      exportValue: (row) => pendingRequests(row),
      render: (value, row) => {
        const count = pendingRequests(row);
        return count ? (
          <span className="numeric-value font-semibold text-primary">{count}</span>
        ) : (
          <span className="text-muted-foreground">None</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Users}
        title="Employees"
        note="Manage employee information"
        // Offered only to somebody who may add an employee.
        onAdd={can("employees.create") ? () => navigate("/employees/create") : undefined}
        addLabel="Add Employee"
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
          {/* Inside the same box as the table, so the row of cards starts and
              ends where the table does. Five equal columns on a wide screen;
              fewer, still equal, as it narrows. */}
          <StatCards count={summary.length}>
            {summary.map(({ key, ...card }) => (
              <StatCard key={key} {...card} status={dataset.status} />
            ))}
          </StatCards>
          <DataTable
            columns={columns}
            itemLabel="employees"
            dataset={dataset}
            data={shown}
            keepOrder
            appliedFilters={chips}
            onRemoveFilter={(chip) => narrow(withoutChip(filters, chip))}
            onClearFilters={() => narrow({})}
            // Anyone who has left is kept, at the foot of the list.
            endedRow={(row) => isEndedStatus(row.status)}
            searchPlaceholder="Search employees by name, ID, department..."
            enableColumnSearch={false}
            currentPage={currentPage}
            totalPages={Math.ceil(shown.length / pageSize)}
            filters={
              <FilterPanel
                fields={fields}
                value={filters}
                onChange={narrow}
              />
            }
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      <SalaryView employee={viewing} open={openView?.kind === "salary"} onOpenChange={closeView} />
      <LeaveView employee={viewing} open={openView?.kind === "leave"} onOpenChange={closeView} />
      <DocumentsView
        employee={viewing}
        open={openView?.kind === "documents"}
        onOpenChange={closeView}
        onChanged={() => setChanged((n) => n + 1)}
      />
    </div>
  );
}
