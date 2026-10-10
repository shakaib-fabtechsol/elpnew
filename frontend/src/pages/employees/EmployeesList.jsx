import { useState } from "react";
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
import {
  Users,
  User,
  UserX,
  FileWarning,
  ArrowUp,
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
} from "lucide-react";
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
} from "./employeeData";
import { readDocumentControl } from "@/lib/settings/documentControl";

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

/** A date as the firm writes them. */
const formatDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? d + "/" + m + "/" + y : iso;
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
        return documentsFor(row.id).some((doc) => value.includes(documentStatus(doc)));
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

/** The tint of a chip under a figure. */
const CHIP_TONE = {
  blue: "bg-blue-50 text-blue-700",
  orange: "bg-orange-50 text-orange-600",
  red: "bg-red-50 text-red-700",
};

/** The tint of a breakdown tile under a figure. */
const TILE_TONE = {
  green: "bg-emerald-50",
  blue: "bg-blue-50",
  plain: "bg-slate-50",
};

/**
 * One figure across the top of the list, in the one style every card wears:
 * a navy rule along the top, the mark, the figure and what it counts. Under
 * it, either a chip - this month's movement, or what needs doing - or a row
 * of tiles that break the figure down. Pressing the card, or a tile that can
 * narrow the list, narrows it.
 */
function SummaryCard({ icon, value, label, chip, tiles, active, onClick }) {
  const Icon = icon;
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-3 rounded-container border border-t-4 border-container-border border-t-primary bg-card p-4",
        active && "ring-2 ring-primary/40"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        aria-pressed={active}
        className="flex items-center gap-3 rounded-lg text-start transition-colors enabled:hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-primary">
          <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-3xl font-bold leading-none text-primary">
            {value.toLocaleString("en-US")}
          </span>
          <span className="mt-1.5 block whitespace-nowrap text-sm text-primary/80">{label}</span>
        </span>
      </button>

      {chip && (
        <span
          className={cn(
            "mx-auto inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold",
            CHIP_TONE[chip.tone]
          )}
        >
          {chip.icon === "alert" ? (
            <AlertCircle className="size-4 fill-red-600 text-white" aria-hidden="true" />
          ) : (
            <ArrowUp className="size-4" aria-hidden="true" />
          )}
          {chip.text}
        </span>
      )}

      {tiles && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
          {tiles.map((tile) => (
            <button
              key={tile.label}
              type="button"
              onClick={tile.onClick}
              disabled={!tile.onClick}
              aria-pressed={tile.active}
              className={cn(
                "min-w-0 rounded-lg px-0.5 py-1.5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                TILE_TONE[tile.tone || "plain"],
                tile.onClick && "hover:brightness-95",
                tile.active && "ring-2 ring-primary/40"
              )}
            >
              <span className="block text-sm font-bold text-primary">{tile.value}</span>
              <span className="block whitespace-nowrap text-[10px] leading-tight tracking-tight text-primary/75">{tile.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Whether an ISO date falls in the current calendar month. */
const inThisMonth = (iso) =>
  Boolean(iso) && String(iso).slice(0, 7) === new Date().toISOString().slice(0, 7);

export default function EmployeesList() {
  const navigate = useNavigate();
  const { leaves } = useLeaves();
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({});

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
      value: employees.length,
      label: "Total Employees",
      chip: { tone: "blue", text: "+" + joinedThisMonth + " this month" },
      // Nothing is marked chosen while the whole list shows: the cards are
      // alike until one narrows it.
      onClick: () => narrow({}),
    },
    {
      key: "active",
      icon: User,
      value: active.length,
      label: "Active Employees",
      tiles: [
        {
          label: "Omani",
          tone: "green",
          value: omani + " (" + share(omani) + "%)",
          active: filters.nationality === "Omani",
          onClick: () => toggle("nationality", "Omani"),
        },
        {
          label: "Non-Omani",
          tone: "blue",
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
      icon: Briefcase,
      value: onLeave.length,
      label: "On Leave",
      chip: {
        tone: "orange",
        text: leaveStartedThisMonth.size + " this month",
      },
      active: filters.leave === "on",
      onClick: () => toggle("leave", "on"),
    },
    {
      key: "expired",
      icon: FileWarning,
      value: expiredDocuments.length,
      label: "Expired Documents",
      chip: expiredDocuments.length > 0 && { tone: "red", icon: "alert", text: "Requires Action" },
      active: Array.isArray(filters.documentStatus) && filters.documentStatus.includes("Expired"),
      // The document filter is the general manager's; for anybody else the
      // card reports the figure and goes nowhere.
      onClick: canSeeRestricted ? () => toggle("documentStatus", "Expired") : undefined,
    },
    {
      key: "inactive",
      icon: UserX,
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
      width: "10%",
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
      width: "17%",
      render: (value, row) => (
        <div className="space-y-0.5">
          <p className="font-semibold text-primary">{value}</p>
          <p className="text-xs text-muted-foreground">
            {row.nationality} <span className="px-1">|</span> {row.gender}
          </p>
        </div>
      ),
    },
    {
      key: "designation",
      header: "Employment Details",
      width: "21%",
      render: (value, row) => (
        <div className="space-y-0.5">
          <p className="font-semibold text-primary">{value}</p>
          <Fact label="Department">{row.department}</Fact>
          <Fact label="Branch">{row.branch} Branch</Fact>
          <Fact label="Contract">{row.contractType}</Fact>
          {/* Only lawyers hold one, and only the general manager may read it. */}
          {canSeeRestricted && row.practiceLevel && (
            <Fact label="Practice level">{row.practiceLevel}</Fact>
          )}
        </div>
      ),
    },
    {
      key: "salary",
      header: "Net Salary",
      width: "11%",
      sortValue: (row) => netSalary(row),
      render: (value, row) => (
        <span className="font-semibold text-emerald-700">{money(netSalary(row))}</span>
      ),
    },
    {
      key: "leave",
      header: "Leave",
      width: "9%",
      sortValue: (row) => annualLeaveLeft(leaves, row.name) ?? -1,
      render: (value, row) => {
        const left = annualLeaveLeft(leaves, row.name);
        return (
          <div className="space-y-1">
            <p className="text-primary">
              {left === null ? "\u2013" : left + " days"}
            </p>
            {/* Approved leave covering today, worked out from the requests
                themselves rather than read off a standing on the record. */}
            {onLeaveToday(leaves, row.name) && (
              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                On leave
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "access",
      header: "Access Level",
      width: "9%",
      render: () => <span className="text-doc-absent">&ndash;</span>,
    },
    {
      key: "documents",
      header: "Documents",
      width: "14%",
      // One paper only: the one nearest to costing the firm something.
      // Everything else is counted, not listed, because a column that lists
      // six documents is a column nobody reads.
      render: (value, row) => {
        const alert = criticalDocument(row.id);
        if (!alert) return <span className="text-muted-foreground">&ndash;</span>;

        const expired = alert.document.status === "Expired";
        return (
          <div className="flex gap-2">
            <Eye
              strokeWidth={1.5}
              aria-hidden="true"
              className="mt-0.5 size-[18px] shrink-0 text-doc-present"
            />
            <div className="min-w-0 space-y-1">
              <p className="truncate font-medium text-primary">
                {alert.document.type}
              </p>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  expired
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
                )}
              >
                {expired ? (
                  <AlertCircle className="size-3" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="size-3" aria-hidden="true" />
                )}
                {alert.document.status}
              </span>
              <p className="text-xs text-muted-foreground">
                {expired ? "Expired" : "Expires"} {formatDate(alert.document.expiry)}
              </p>
              {alert.more > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  +{alert.more} more document{alert.more === 1 ? "" : "s"} needs action
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "9%",
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
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Users}
        title="Employees"
        note="Manage employee information"
        onAdd={() => navigate("/employees/create")}
        addLabel="Add Employee"
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
          {/* Inside the same box as the table, so the row of cards starts and
              ends where the table does. Five equal columns on a wide screen;
              fewer, still equal, as it narrows. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {summary.map(({ key, ...card }) => (
              <SummaryCard key={key} {...card} />
            ))}
          </div>
          <DataTable
            columns={columns}
            itemLabel="employees"
            data={shown}
            keepOrder
            appliedFilters={chips}
            onRemoveFilter={(chip) => narrow(withoutChip(filters, chip))}
            onClearFilters={() => narrow({})}
            // Anyone who has left is kept, at the foot of the list.
            endedRow={(row) => isEndedStatus(row.status)}
            searchPlaceholder="Search employee by name, ID, department..."
            enableColumnSearch={false}
            enableSorting
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
    </div>
  );
}
