import { useRef, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  Layers,
  LayoutGrid,
  Pause,
  Tags,
  UserRound,
} from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import FilterPanel from "@/components/shared/FilterPanel";
import { StatCard, StatCards } from "@/components/shared/StatCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { filterChips, withoutChip } from "@/lib/filterChips";
import useDataset from "@/lib/api/useDataset";
import { useAdvances } from "@/lib/advances/context";
import { useBonuses } from "@/lib/bonuses/context";
import { useLeaves } from "@/lib/leaves/context";
import { cn } from "@/lib/utils";
import {
  REQUEST_DATASETS,
  REQUEST_GROUPS,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  STATUS_DOT,
  STATUS_PILL,
  collectRequests,
  detailsOf,
  longDate,
  omr,
  timelineOf,
} from "../requestsHub";

/**
 * Requests, as one list: every kind an employee can ask for, read off the
 * records each module already keeps, with the five figures over it counted
 * off the same rows.
 *
 * On My Profile it is the employee's own requests, and View Details opens a
 * plain read-only window on one of them. In the firm's Requests (Company
 * Profile) it is everybody's, with the employee named on each row, and the
 * page decides what View Details opens - there, the request's full workflow.
 */

/** Reads every request store, so the list follows them as they change. */
export function useRequestRows(employee) {
  const { advances } = useAdvances();
  const { bonuses } = useBonuses();
  const { leaves } = useLeaves();
  const dataset = useDataset(REQUEST_DATASETS);
  // The stores without a provider are read as they stand; the dataset's
  // version moves whenever one of them is loaded afresh, and re-renders this.
  const rows = collectRequests({ advances, bonuses, leaves }, employee);
  return { rows, dataset };
}

/** The status pill, with the module's own word beside it where it says more. */
export function StatusPill({ status }) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
          STATUS_PILL[status]
        )}
      >
        <span aria-hidden="true" className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
        {status}
      </span>
      {/* The design shows the pill alone; the module's own word is kept
          for the details window and the export. */}
    </span>
  );
}

const PERIODS = [
  { value: "all", label: "Any time" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "Last 3 months" },
  { value: "year", label: "This year" },
];

/** Whether a request date falls in the chosen period. */
function inPeriod(date, period) {
  if (!period || period === "all") return true;
  if (!date) return false;
  const day = new Date(String(date).slice(0, 10) + "T00:00:00");
  const now = new Date();
  if (period === "month") return day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth();
  if (period === "year") return day.getFullYear() === now.getFullYear();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return day >= from;
}

const filterFieldsFor = (rows) => [
  {
    key: "group",
    label: "Category",
    icon: LayoutGrid,
    type: "radio",
    options: [{ value: "all", label: "All" }, ...REQUEST_GROUPS.map((group) => ({ value: group.key, label: group.label }))],
  },
  {
    key: "type",
    label: "Request Type",
    icon: Tags,
    type: "checkbox",
    // Only the kinds there are requests of, so no choice leads to nothing.
    options: Object.entries(REQUEST_TYPES)
      .filter(([key]) => rows.some((row) => row.type === key))
      .map(([key, type]) => ({ value: key, label: type.label })),
  },
  {
    key: "status",
    label: "Status",
    icon: Layers,
    type: "checkbox",
    options: REQUEST_STATUSES.map((status) => ({ value: status, label: status })),
  },
  { key: "period", label: "Request Date", icon: CalendarDays, type: "radio", options: PERIODS },
];

const matches = (row, filters) =>
  (!filters.group || filters.group === "all" || row.group === filters.group) &&
  (!filters.type?.length || filters.type.includes(row.type)) &&
  (!filters.status?.length || filters.status.includes(row.status)) &&
  inPeriod(row.date, filters.period);

export default function RequestsHub({
  // One employee's requests; everybody's (that the user may see) without.
  employee,
  // The firm's list names whose request each row is.
  showEmployee = false,
  // What View Details opens. Without it, the read-only details window.
  onView,
  itemLabel = "requests",
}) {
  const { rows, dataset } = useRequestRows(employee);
  const [filters, setFilters] = useState({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewing, setViewing] = useState(null);

  const fields = filterFieldsFor(rows);
  const chips = filterChips(fields, filters);
  const narrow = (next) => {
    setFilters(next);
    setCurrentPage(1);
  };
  const shown = rows.filter((row) => matches(row, filters));

  const view = (row) => (onView ? onView(row) : setViewing(row));

  // The five figures, off the same rows as the table.
  const count = (status) => rows.filter((row) => row.status === status).length;
  const thisMonth = rows.filter((row) => inPeriod(row.date, "month")).length;
  const statusFilter = filters.status || [];
  const toggleStatus = (status) =>
    narrow({
      ...filters,
      status: statusFilter.length === 1 && statusFilter[0] === status ? [] : [status],
    });
  const cards = [
    {
      key: "total",
      icon: Layers,
      tone: "blue",
      label: "Total Requests",
      value: rows.length,
      note: { text: "+" + thisMonth + " this month", icon: "trend" },
      onClick: () => narrow({ ...filters, status: [] }),
      active: false,
    },
    { key: "Pending", icon: Clock3, tone: "amber", label: "Pending", note: { text: "Awaiting review" } },
    { key: "Approved", icon: CircleCheck, tone: "green", label: "Approved", note: { text: "Completed" } },
    { key: "Rejected", icon: CircleX, tone: "red", label: "Rejected", note: { text: "Decision made" } },
    { key: "On Hold", icon: Pause, tone: "orange", label: "On Hold", note: { text: "Action required" } },
  ].map((card) =>
    card.key === "total"
      ? card
      : {
          ...card,
          value: count(card.key),
          onClick: () => toggleStatus(card.key),
          active: statusFilter.length === 1 && statusFilter[0] === card.key,
        }
  );

  const columns = [
    {
      key: "seq",
      header: "#",
      width: "4%",
      sort: "number",
      hideable: false,
      render: (value) => <span className="numeric-value text-primary/80">{value}</span>,
    },
    showEmployee && {
      key: "employee",
      header: "Employee",
      width: "14%",
      sort: "text",
      render: (value) => (
        <span className="flex items-center gap-2 font-medium text-primary">
          <UserRound className="size-4 shrink-0 text-primary/50" strokeWidth={1.75} aria-hidden="true" />
          {value || "–"}
        </span>
      ),
    },
    {
      key: "typeLabel",
      header: "Request Type",
      width: showEmployee ? "16%" : "18%",
      sort: "text",
      exportValue: (row) => row.typeLabel + (row.number ? " (" + row.number + ")" : ""),
      render: (value, row) => {
        const Icon = REQUEST_TYPES[row.type]?.icon || Layers;
        return (
          <div className="flex items-start gap-2.5">
            <Icon className="mt-0.5 size-[18px] shrink-0 text-primary/80" strokeWidth={1.6} aria-hidden="true" />
            <div className="min-w-0">
              {/* The name and the number open the request, as everywhere. */}
              <button
                type="button"
                onClick={() => view(row)}
                className="text-start font-semibold text-primary hover:text-record-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {value}
              </button>
            </div>
          </div>
        );
      },
    },
    { key: "category", header: "Category", width: "10%", sort: "text" },
    {
      key: "summary",
      header: "Request Summary",
      width: "22%",
      sort: false,
      render: (value) => <span className="line-clamp-2 text-primary/90">{value || "–"}</span>,
    },
    {
      key: "date",
      header: "Request Date",
      width: "11%",
      sort: "date",
      exportValue: (row) => longDate(row.date),
      render: (value) => <span className="whitespace-nowrap">{longDate(value) || "–"}</span>,
    },
    {
      key: "amount",
      header: "Amount (OMR)",
      width: "10%",
      sort: "money",
      exportValue: (row) => omr(row.amount),
      cellClassName: "text-end",
      render: (value) =>
        value != null ? (
          <span className="numeric-value font-bold text-emerald-700">{omr(value)}</span>
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "11%",
      sort: "status",
      sortOrder: ["On Hold", "Pending", "Approved", "Rejected"],
      exportValue: (row) => row.statusLabel,
      render: (value, row) => <StatusPill status={value} label={row.statusLabel} />,
    },
    {
      key: "details",
      header: "Details",
      width: "10%",
      sort: false,
      exportValue: () => "",
      render: (value, row) => (
        <button
          type="button"
          onClick={() => view(row)}
          className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-record-link hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View Details
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          <span className="sr-only">of {row.typeLabel} {row.number}</span>
        </button>
      ),
    },
  ].filter(Boolean);

  return (
    <div className="space-y-4 sm:space-y-6">
      <StatCards count={cards.length}>
        {cards.map(({ key, ...card }) => (
          <StatCard key={key} {...card} status={dataset.status} />
        ))}
      </StatCards>

      <DataTable
        columns={columns}
        data={shown}
        dataset={dataset}
        itemLabel={itemLabel}
        keepOrder
        enableColumnSearch={false}
        searchPlaceholder={showEmployee ? "Search requests by employee, type, number..." : "Search your requests..."}
        exportFileName="requests.csv"
        appliedFilters={chips}
        onRemoveFilter={(chip) => narrow(withoutChip(filters, chip))}
        onClearFilters={() => narrow({})}
        filters={<FilterPanel fields={fields} value={filters} onChange={narrow} />}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

      {!onView && (
        <RequestDetailsDialog request={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

/**
 * One request, read only: what it is, its facts, where it stands and what
 * has happened to it. Closing it returns focus to the link that opened it,
 * without moving the page.
 */
export function RequestDetailsDialog({ request, onClose }) {
  const opener = useRef(null);
  const Icon = (request && REQUEST_TYPES[request.type]?.icon) || Layers;
  const facts = request ? detailsOf(request) : [];
  const events = request ? timelineOf(request) : [];

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] w-[min(760px,95vw)] max-w-none gap-0 overflow-y-auto p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          opener.current = document.activeElement;
          event.currentTarget.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus?.({ preventScroll: true });
        }}
      >
        {request && (
          <>
            <DialogHeader className="rounded-t-lg bg-primary px-6 py-4 text-start text-primary-foreground">
              <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                {request.typeLabel}
                {request.number && <span className="numeric-value font-semibold opacity-80">· {request.number}</span>}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/80">
                {request.category} request{request.employee ? " · " + request.employee : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 p-6">
              <dl className="grid gap-x-6 gap-y-4 rounded-xl border border-container-border bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Fact label="Request No.">{request.number || "–"}</Fact>
                <Fact label="Request Date">{longDate(request.date) || "–"}</Fact>
                <Fact label="Amount (OMR)">{request.amount != null ? omr(request.amount) : "–"}</Fact>
                <Fact label="Status">
                  <StatusPill status={request.status} label={request.statusLabel} />
                </Fact>
              </dl>

              {request.summary && (
                <p className="text-sm text-primary">
                  <span className="font-semibold">Summary: </span>
                  {request.summary}
                </p>
              )}

              {facts.length > 0 && (
                <section aria-label="Request details">
                  <h3 className="mb-3 text-sm font-bold text-primary">Request Details</h3>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {facts.map(([label, value]) => (
                      <Fact key={label} label={label} wide={String(value).length > 60}>
                        {value}
                      </Fact>
                    ))}
                  </dl>
                </section>
              )}

              {events.length > 0 && (
                <section aria-label="Timeline">
                  <h3 className="mb-3 text-sm font-bold text-primary">Timeline</h3>
                  <ol className="space-y-0">
                    {events.map((event, index) => (
                      <li key={index} className="relative flex gap-3 pb-4 last:pb-0">
                        {index < events.length - 1 && (
                          <span aria-hidden="true" className="absolute start-[7px] top-4 h-full w-px bg-container-border" />
                        )}
                        <span aria-hidden="true" className="relative mt-1 size-[15px] shrink-0 rounded-full border-2 border-primary bg-card" />
                        <div className="min-w-0 text-sm">
                          <p className="font-semibold text-primary">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {[longDate(event.at), event.by].filter(Boolean).join(" · ")}
                          </p>
                          {event.note && <p className="mt-1 text-primary/80">{event.note}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, wide, children }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-primary">{children}</dd>
    </div>
  );
}
