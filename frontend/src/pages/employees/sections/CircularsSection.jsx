import { Fragment, useState } from "react";
import ExcelIcon from "@/components/shared/ExcelIcon";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  RecordTable,
  HeadRow,
  Th,
  EmptyRow,
  SkeletonRows,
  ErrorRow,
  RecordLink,
} from "@/components/shared/RecordTable";
import { StatCard, StatCards } from "@/components/shared/StatCard";
import FilterPanel from "@/components/shared/FilterPanel";
import { filterChips, withoutChip } from "@/lib/filterChips";
import useDataset from "@/lib/api/useDataset";
import AiSearch from "@/components/shared/AiSearch";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  Eye,
  FileText,
  Info,
  Megaphone,
  Target,
  Users,
  X,
} from "lucide-react";
import CircularBrief from "@/components/shared/CircularBrief";
import { cn } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useTableSort } from "@/lib/sorting";
import {
  useCirculars,
  circularsFor,
  acknowledgementBy,
  groupOf,
  ACTIVE,
  CANCELLED,
  TARGET_GROUPS,
  ALL_EMPLOYEES,
  formatDate,
  today,
} from "@/lib/circulars/context";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { shortName } from "@/lib/shortName";

/**
 * Employees 4 #2 - the circulars one employee is addressed by.
 *
 * Only their own acknowledgement is shown. How many other people have read a
 * circular is the firm's business and not a colleague's, so the counts and
 * the read list on the Company Profile page are deliberately absent here.
 *
 * Every circular wears this employee's standing on it:
 *   Unread        in force, and not yet acknowledged by them
 *   Acknowledged  acknowledged by them (whatever happened to it since)
 *   Completed     superseded by a later version before they acknowledged it
 *   Cancelled     withdrawn before they acknowledged it
 *
 * The list opens with the unread ones on top - from every department, since
 * an unread circular is the one that asks something of the reader - and the
 * rest under them, newest first - always, as the design's note says. Sorting
 * a column sorts the rows inside each of the two groups.
 */

const UNREAD = "Unread";
const ACKNOWLEDGED = "Acknowledged";
const COMPLETED_MINE = "Completed";
const CANCELLED_MINE = "Cancelled";

const STANDINGS = [UNREAD, ACKNOWLEDGED, COMPLETED_MINE, CANCELLED_MINE];

/** How each standing is drawn: a soft pill with a dot or a tick. */
const STANDING_PILL = {
  [UNREAD]: { pill: "bg-blue-50 text-blue-700", mark: "dot", dot: "bg-blue-600" },
  [ACKNOWLEDGED]: { pill: "bg-emerald-50 text-emerald-700", mark: "tick" },
  [COMPLETED_MINE]: { pill: "bg-slate-100 text-slate-600", mark: "tick" },
  [CANCELLED_MINE]: { pill: "bg-red-50 text-red-700", mark: "dot", dot: "bg-red-600" },
};

function StandingPill({ standing }) {
  const look = STANDING_PILL[standing];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold",
        look.pill
      )}
    >
      {look.mark === "dot" ? (
        <span aria-hidden="true" className={cn("size-2 rounded-full", look.dot)} />
      ) : (
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
      )}
      {standing}
    </span>
  );
}

/**
 * A circular's subject and the rest of it.
 *
 * Circulars are issued as one body of text, so the subject is its first
 * sentence and the excerpt what follows - or, for a one-sentence circular,
 * the sentence itself.
 */
function splitContent(content) {
  const text = String(content || "").trim();
  const match = text.match(/^(.+?[.!?])\s+(.+)$/s);
  if (!match) return { subject: text, excerpt: "" };
  return { subject: match[1].replace(/[.]$/, ""), excerpt: match[2] };
}

/** "2026-11" for a "2026-11-27". */
const monthOf = (date) => String(date || "").slice(0, 7);

/** Whole percentages of a total, never a division by nothing. */
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/** The date filter's windows, counted back from today. */
const DATE_WINDOWS = {
  month: (date) => monthOf(date) === monthOf(today()),
  quarter: (date) => {
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    return date >= from.toISOString().slice(0, 10);
  },
  year: (date) => String(date).slice(0, 4) === today().slice(0, 4),
};

const FILTER_FIELDS = [
  {
    key: "targetGroup",
    label: "Target Group",
    icon: Target,
    type: "checkbox",
    options: TARGET_GROUPS.map((group) => ({ value: group, label: group })),
  },
  {
    key: "standing",
    label: "Status",
    icon: CheckCircle2,
    type: "checkbox",
    options: STANDINGS.map((one) => ({ value: one, label: one })),
  },
  {
    key: "date",
    label: "Date",
    icon: CalendarDays,
    options: [
      { value: "all", label: "Any date" },
      { value: "month", label: "This month" },
      { value: "quarter", label: "Last 3 months" },
      { value: "year", label: "This year" },
    ],
  },
];

/** The columns, as the table, the Columns menu, sorting and Excel read them. */
const COLUMNS = [
  { key: "circularNo", header: "Circular No.", hideable: false, sort: "text" },
  {
    key: "subject",
    header: "Subject / Content",
    hideable: false,
    sort: "text",
    exportValue: (row) => row.content,
  },
  { key: "date", header: "Date", sort: "date", exportValue: (row) => formatDate(row.date) },
  { key: "targetGroup", header: "Target Group", sort: "text" },
  {
    key: "standing",
    header: "Status",
    sort: "status",
    sortOrder: STANDINGS.map((one) => one.toLowerCase()),
  },
];

const SORTING = Object.fromEntries(COLUMNS.map((column) => [column.key, column]));

export default function EmployeeCircularsSection({ employee }) {
  const { circulars, acknowledge } = useCirculars();
  // The circulars are loaded at sign-in; read here, where the rows are drawn,
  // so the table shows them coming, or that they could not be fetched.
  const dataset = useDataset(["circulars"]);

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hidden, setHidden] = useState(
    () => new Set(COLUMNS.filter((column) => column.hidden).map((column) => column.key))
  );
  // The circular open in front of the list, if one is.
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);

  // An acknowledgement is recorded against whoever is signed in, so it can
  // only be given from their own record.
  const own = employee?.id != null && employee.id === CURRENT_USER.employeeId;

  const group = groupOf(employee);

  /** Every circular addressed to this employee, with their standing on it. */
  const mine = circularsFor(circulars, group).map((circular) => {
    const ack = acknowledgementBy(circular, employee.name);
    const standing = ack
      ? ACKNOWLEDGED
      : circular.status === ACTIVE
        ? UNREAD
        : circular.status === CANCELLED
          ? CANCELLED_MINE
          : COMPLETED_MINE;
    return { ...circular, ...splitContent(circular.content), ack, standing };
  });

  // The figures across the top, counted off the same rows the table shows.
  const total = mine.length;
  const thisMonth = mine.filter((c) => monthOf(c.date) === monthOf(today())).length;
  const unread = mine.filter((c) => c.standing === UNREAD).length;
  const department = mine.filter((c) => c.targetGroup !== ALL_EMPLOYEES).length;
  const acknowledged = mine.filter((c) => c.standing === ACKNOWLEDGED).length;

  const search = query.trim().toLowerCase();
  const found = mine.filter((c) => {
    if (
      search &&
      ![c.circularNo, c.content, c.targetGroup, c.issuedBy]
        .join(" ")
        .toLowerCase()
        .includes(search)
    )
      return false;
    if (filters.targetGroup?.length && !filters.targetGroup.includes(c.targetGroup)) return false;
    if (filters.standing?.length && !filters.standing.includes(c.standing)) return false;
    if (filters.date && filters.date !== "all" && !DATE_WINDOWS[filters.date](c.date)) return false;
    return true;
  });

  const { rows: sorted, sort, sortProps } = useTableSort(found, SORTING);

  // Unread from every department first, then the rest - always. Within each
  // group the rows are newest first, or in the order of the column sorted.
  const grouped = true;
  const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.id - a.id;
  const ordered = sort ? sorted : [...found].sort(byDateDesc);
  const listed = [
    ...ordered.filter((c) => c.standing === UNREAD),
    ...ordered.filter((c) => c.standing !== UNREAD),
  ];

  const totalPages = Math.max(1, Math.ceil(listed.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const shown = listed.slice(start, start + pageSize);

  const shownColumns = COLUMNS.filter((column) => !hidden.has(column.key));
  const colSpan = shownColumns.length + 1;
  const showing = (key) => !hidden.has(key);

  const chips = filterChips(FILTER_FIELDS, filters);
  const narrow = (next) => {
    setFilters(next);
    setPage(1);
  };

  const exportRows = (rows) =>
    downloadCsv(
      toCsv(
        [
          ...shownColumns,
          // Only this employee's own acknowledgement goes into the file, for
          // the same reason only theirs is on screen.
          {
            key: "acknowledgedAt",
            header: "Acknowledged At",
            exportValue: (row) => row.ack?.at || "",
          },
        ],
        rows
      ),
      "my-circulars.csv"
    );

  const opened = mine.find((c) => c.id === openId) || null;
  const confirm = async () => {
    if (!opened || busy) return;
    setBusy(true);
    try {
      await acknowledge(opened.id);
    } finally {
      setBusy(false);
    }
  };

  const status = dataset.status;
  const pct = (n) => (status === "ready" ? percent(n, total) + "% of total" : "");

  /** A group's heading row, where the grouped order starts a group on this page. */
  const groupHeading = (row, index) => {
    if (!grouped) return null;
    const previous = index === 0 ? null : shown[index - 1];
    const isUnread = row.standing === UNREAD;
    if (previous && (previous.standing === UNREAD) === isUnread) return null;
    const Icon = isUnread ? Eye : Clock3;
    return (
      <tr className="border-b border-container-border bg-blue-50/70">
        <td colSpan={colSpan} className="px-4 py-2">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-blue-700">
            <Icon className="size-4" aria-hidden="true" />
            {isUnread ? "Unread Circulars (All Departments)" : "Other Circulars (Latest First)"}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <StatCards count={5}>
        <StatCard
          icon={FileText}
          tone="blue"
          label="Total Circulars"
          value={total}
          status={status}
          note={{ text: "+" + thisMonth + " this month", icon: "trend" }}
        />
        <StatCard
          icon={Eye}
          tone="green"
          label="Unread Circulars"
          value={unread}
          status={status}
          note={{ text: pct(unread), icon: "dot", tone: "orange" }}
          onClick={() =>
            narrow(
              filters.standing?.length === 1 && filters.standing[0] === UNREAD
                ? withoutChip(filters, { field: "standing", option: UNREAD })
                : { ...filters, standing: [UNREAD] }
            )
          }
          active={filters.standing?.length === 1 && filters.standing[0] === UNREAD}
        />
        <StatCard
          icon={Users}
          tone="purple"
          label="For My Department"
          value={department}
          status={status}
          note={{ text: pct(department), icon: "dot" }}
        />
        <StatCard
          icon={CalendarDays}
          tone="orange"
          label="This Month"
          value={thisMonth}
          status={status}
          note={{ text: pct(thisMonth), icon: "dot" }}
        />
        <StatCard
          icon={CheckCircle2}
          tone="green"
          label="Acknowledged"
          value={acknowledged}
          status={status}
          note={{ text: pct(acknowledged), icon: "dot" }}
        />
      </StatCards>

      <p className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">Note:</span> Unread circulars from all
          departments are always displayed at the top of the list. The list is
          then sorted by the latest date, with the most recent circulars
          appearing first.
        </span>
      </p>

      <div className="overflow-hidden rounded-[8px] border border-container-border bg-card">
        {/* The approved toolbar: search, Filters, Columns, rows per page, Excel. */}
        <div className="flex flex-col flex-wrap items-stretch gap-3 border-b border-container-border p-3 sm:flex-row sm:items-center">
          <AiSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Search by circular no., subject or content..."
          />
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <FilterPanel fields={FILTER_FIELDS} value={filters} onChange={narrow} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "group h-[42px] gap-2 border-primary/30 bg-blue-50/60 font-semibold text-primary hover:bg-blue-50",
                    hidden.size > 0 && "border-primary"
                  )}
                >
                  <Columns3 className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                  Columns
                  <ChevronDown
                    className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUMNS.filter((column) => column.hideable !== false).map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={!hidden.has(column.key)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() =>
                      setHidden((prev) => {
                        const next = new Set(prev);
                        if (next.has(column.key)) next.delete(column.key);
                        else next.add(column.key);
                        return next;
                      })
                    }
                  >
                    {column.header}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-[42px] w-24" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="group h-[42px] gap-2 font-semibold text-primary">
                  <ExcelIcon className="size-6" />
                  Excel
                  <ChevronDown
                    className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onSelect={() => exportRows(listed)}>
                  Export current view ({listed.length})
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportRows(mine)}>
                  Export all circulars ({mine.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-container-border px-3 py-2.5">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => narrow(withoutChip(filters, chip))}
                className="inline-flex items-center gap-1.5 rounded-[6px] border border-primary bg-card px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {chip.label}: {chip.value}
                <X className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only">Remove this filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => narrow({})}
              className="rounded-[6px] px-1.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="p-0 [&>div]:rounded-none [&>div]:border-0">
          <RecordTable minWidth={900}>
            <HeadRow>
              <Th width="48px">#</Th>
              <Th width="14%" {...sortProps("circularNo")}>Circular No.</Th>
              <Th {...sortProps("subject")}>Subject / Content</Th>
              {showing("date") && <Th width="12%" {...sortProps("date")}>Date</Th>}
              {showing("targetGroup") && (
                <Th width="15%" {...sortProps("targetGroup")}>Target Group</Th>
              )}
              {showing("standing") && <Th width="14%" {...sortProps("standing")}>Status</Th>}
            </HeadRow>
            <tbody>
              {status === "loading" && (
                <SkeletonRows columns={colSpan} rows={5} shapes={[null, null, "lines"]} />
              )}
              {status === "failed" && (
                <ErrorRow colSpan={colSpan} label="circulars" onRetry={dataset.retry} />
              )}
              {status === "ready" && listed.length === 0 && (
                <EmptyRow
                  colSpan={colSpan}
                  label="circulars"
                  searching={search !== ""}
                  filtering={chips.length > 0}
                  onClearSearch={() => {
                    setQuery("");
                    setPage(1);
                  }}
                  onClearFilters={() => narrow({})}
                />
              )}
              {status === "ready" &&
                shown.map((circular, index) => (
                  <Fragment key={circular.id}>
                    {groupHeading(circular, index)}
                    <tr
                      onClick={() => setOpenId(circular.id)}
                      className={cn(
                        "cursor-pointer border-b border-container-border align-top last:border-0",
                        circular.standing === UNREAD && "bg-blue-50/30"
                      )}
                    >
                      <td className="px-4 py-3 text-muted-foreground numeric-value">
                        {start + index + 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <RecordLink
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenId(circular.id);
                          }}
                        >
                          {circular.circularNo}
                        </RecordLink>
                      </td>
                      <td className="max-w-0 px-4 py-3">
                        <p
                          className={cn(
                            "truncate text-primary",
                            circular.standing === UNREAD ? "font-bold" : "font-semibold"
                          )}
                        >
                          {circular.subject}
                        </p>
                        {circular.excerpt && (
                          <p className="truncate text-xs text-muted-foreground">
                            {circular.excerpt}
                          </p>
                        )}
                      </td>
                      {showing("date") && (
                        <td className="whitespace-nowrap px-4 py-3 numeric-value">
                          {formatDate(circular.date)}
                        </td>
                      )}
                      {showing("targetGroup") && (
                        <td className="px-4 py-3">{circular.targetGroup}</td>
                      )}
                      {showing("standing") && (
                        <td className="px-4 py-3">
                          <StandingPill standing={circular.standing} />
                        </td>
                      )}
                    </tr>
                  </Fragment>
                ))}
            </tbody>
          </RecordTable>
        </div>

        {status === "ready" && listed.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-container-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Showing {start + 1} to {Math.min(start + pageSize, listed.length)} of{" "}
              {listed.length} circulars
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft className="size-4 rtl:rotate-180" />
                <span className="sr-only">Previous page</span>
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={n === currentPage ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(n)}
                >
                  {n}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight className="size-4 rtl:rotate-180" />
                <span className="sr-only">Next page</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* The circular itself: all of it, its AI brief, and - on the
          employee's own record - the acknowledgement. */}
      <Dialog open={Boolean(opened)} onOpenChange={(open) => !open && setOpenId(null)}>
        {opened && (
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="rounded-lg bg-primary p-2 text-primary-foreground">
                  <Megaphone className="h-4 w-4" />
                </span>
                Circular {opened.circularNo}
              </DialogTitle>
              <DialogDescription>
                {formatDate(opened.date)} &middot; {opened.targetGroup}
                {opened.issuedBy && <> &middot; Issued by {shortName(opened.issuedBy)}</>}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <StandingPill standing={opened.standing} />
              {opened.ack && (
                <span className="text-xs text-muted-foreground">
                  Acknowledged {opened.ack.at}
                </span>
              )}
            </div>
            <p className="whitespace-pre-line rounded-lg border bg-secondary p-4 text-sm text-primary">
              {opened.content}
            </p>
            <CircularBrief
              circular={opened}
              own={own}
              canRefresh={Boolean(CURRENT_USER.permissions?.manage)}
            />
            <DialogFooter>
              <Button type="button" variant="cancel" onClick={() => setOpenId(null)}>
                Close
              </Button>
              {own && opened.standing === UNREAD && (
                <Button type="button" onClick={confirm} disabled={busy}>
                  I acknowledge this circular
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
