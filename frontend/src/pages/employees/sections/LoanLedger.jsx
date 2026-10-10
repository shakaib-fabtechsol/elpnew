import { Fragment, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Coins,
  Database,
  FileText,
  Info,
  Lightbulb,
  MoreHorizontal,
  PieChart,
  Plus,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilterPanel from "@/components/shared/FilterPanel";
import ExcelIcon from "@/components/shared/ExcelIcon";
import { filterChips, withoutChip } from "@/lib/filterChips";
import { smartSearch } from "@/lib/search/smartSearch";
import { toCsv, downloadCsv } from "@/lib/csv";
import { amountValue } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  INSTALLMENT_STATUS_TONE,
  isApprovedLoan,
  formatDate,
  loanTotal,
  scheduleRows,
} from "../loanData";
import { amount, netSalary } from "../employeeData";
import { longDate } from "./AdvanceSalarySection";
import { Tile, Ring, TILE_TINT, chanceOf } from "./AdvanceOverview";

/** How each standing of a loan is marked. */
const LOAN_CHIP = {
  Active: "bg-green-100 text-green-800",
  Completed: "bg-slate-200 text-slate-700",
  Pending: "bg-amber-100 text-amber-800",
  Rejected: "bg-red-100 text-red-800",
  Cancelled: "bg-slate-100 text-slate-600",
};

const LOAN_DOT = {
  Active: "bg-green-600",
  Completed: "bg-slate-400",
  Pending: "bg-amber-500",
  Rejected: "bg-red-600",
  Cancelled: "bg-slate-400",
};

/**
 * Each loan as the lists show it: its name in the run (Loan 1 is the first
 * taken), its number, what it comes to, what has been paid and is left, when
 * it runs, and how it stands - Active while anything is owed on a granted
 * loan, Completed once nothing is. Read off the schedule, so no two lists
 * can disagree about the same loan.
 */
export function describeLoans(records) {
  // Oldest first is how they are numbered. Only a granted loan takes a place
  // in the run - one still waiting, sent back or refused is a request, and
  // counting it would leave the loans with gaps.
  let grantedSoFar = 0;
  return [...records]
    .sort((a, b) =>
      String(a.disbursementDate || a.firstDue).localeCompare(String(b.disbursementDate || b.firstDue)) ||
      a.id - b.id
    )
    .map((record) => {
      const total = loanTotal(record);
      const rows = scheduleRows(total, record.monthly, record.firstDue, record.payments);
      const paid = rows.reduce((sum, row) => sum + row.paid, 0);
      const granted = isApprovedLoan(record);
      const remaining = Math.max(total - paid, 0);
      if (granted) grantedSoFar += 1;
      return {
        record,
        id: record.id,
        name: granted ? "Loan " + grantedSoFar : "Loan Request",
        number: record.requestNo || "LNR-" + String(record.id).padStart(3, "0"),
        total,
        paid,
        remaining,
        monthly: Number(record.monthly || 0),
        start: record.disbursementDate || record.firstDue || "",
        end: rows.length ? rows[rows.length - 1].due : "",
        status: granted ? (remaining <= 0 ? "Completed" : "Active") : record.status,
        installments: rows,
        granted,
      };
    });
}

/**
 * The most a person may owe on loans at once, in months of net salary.
 *
 * The firm has not set this down anywhere yet, so it is one figure here,
 * where it can be changed, rather than a rule the page invents.
 */
export const LOAN_LIMIT_MONTHS = 10;

/** Rows shown under a loan before the rest is asked for. */
const SCHEDULE_PREVIEW = 5;

// Today where the user is, not in UTC: after midnight here UTC is still on
// the day before, and an installment due today would read as tomorrow's.
const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** A sum the office would actually suggest: rounded down to the nearest 500. */
const roundDown = (value) => Math.max(0, Math.floor(value / 500) * 500);

/**
 * What each loan owes now: the installments already past their day and
 * still unpaid, and the next one to come. Read off the same schedule the
 * rows are drawn from.
 */
function standing(loan, today) {
  const unpaid = loan.installments.filter((row) => row.status !== "Paid");
  const overdue = loan.status === "Active" ? unpaid.filter((row) => row.due < today) : [];
  const next = loan.status === "Active" ? unpaid.find((row) => row.due >= today) || null : null;
  return { overdue, next, left: unpaid.length };
}

/**
 * One employee's loans as the design lays them out: what needs attention,
 * a reading of what more they could borrow, what the loans come to, then
 * every loan with its installments folded under it.
 *
 * A granted loan is Active while anything is still owed on it and Completed
 * once nothing is; a request keeps the standing it was given. Every figure is
 * read off the schedule, so the tiles and the rows cannot disagree.
 */
export default function LoanLedger({
  records,
  employee,
  onOpen,
  // Opens a new request; left out where the viewer cannot make one.
  onAdd,
  addLabel = "New Loan Request",
  // Opens a new request already set to the suggested sum.
  onApply,
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [pageSize, setPageSize] = useState(10);
  // Which loans are unfolded (the first, to begin with), and which show their
  // whole schedule rather than its first rows.
  const [open, setOpen] = useState({});
  const [whole, setWhole] = useState({});

  const today = todayIso();
  const loans = describeLoans(records).map((loan) => ({ ...loan, ...standing(loan, today) }));
  const granted = loans.filter((loan) => loan.granted);
  const active = granted.filter((loan) => loan.status === "Active");
  const sum = (list, key) => list.reduce((total, loan) => total + loan[key], 0);

  const overdueRows = active.flatMap((loan) => loan.overdue);
  const nextRows = active
    .map((loan) => loan.next)
    .filter(Boolean)
    .sort((a, b) => a.due.localeCompare(b.due));
  const nextDue = nextRows[0]?.due || "";
  // Everything that falls due on that day, across the loans.
  const nextAmount = nextRows
    .filter((row) => row.due === nextDue)
    .reduce((total, row) => total + row.installment - row.paid, 0);
  // The active loan closest to its end.
  const ending = [...active].sort((a, b) => a.left - b.left)[0] || null;

  // What more could be borrowed: the limit, less what is still owed and
  // what is already being asked for.
  const net = employee ? netSalary(employee) : 0;
  const owed = sum(granted, "remaining");
  const asked = loans
    .filter((loan) => loan.status === "Pending")
    .reduce((total, loan) => total + loan.total, 0);
  const remaining = Math.max(0, net * LOAN_LIMIT_MONTHS - owed - asked);
  // What is usually borrowed, held to what is left.
  const usual = granted.length ? sum(granted, "total") / granted.length : net * 3;
  const recommended = roundDown(Math.min(usual, remaining));
  // Repaid on time and not over-committed reads as likely; a request already
  // waiting, or nothing left to borrow, does not.
  const probability =
    asked > 0 || remaining <= 0
      ? 20
      : Math.max(40, Math.min(95, 92 - overdueRows.length * 12 - Math.round((owed / Math.max(net * LOAN_LIMIT_MONTHS, 1)) * 20)));
  const chance = chanceOf(probability);

  const unfoldOverdue = () =>
    setOpen((prev) => ({
      ...prev,
      ...Object.fromEntries(active.filter((loan) => loan.overdue.length).map((loan) => [loan.id, true])),
    }));

  const statusField = {
    key: "status",
    label: "Status",
    type: "radio",
    options: [
      { value: "all", label: "All" },
      ...[...new Set(loans.map((loan) => loan.status))].map((value) => ({ value, label: value })),
    ],
  };
  const fields = [statusField];

  // Newest first: the loan being followed is usually the latest.
  const shown = smartSearch(
    [...loans]
      .reverse()
      .filter((loan) => !filters.status || filters.status === "all" || loan.status === filters.status)
      .map((loan) => ({
        ...loan,
        searchText: [loan.name, loan.number, loan.status, amountValue(loan.total)].join(" "),
      })),
    query
  ).slice(0, pageSize);

  const isOpen = (loan, index) => (loan.id in open ? open[loan.id] : index === 0);

  const exportColumns = [
    { key: "name", header: "Loan" },
    { key: "number", header: "Loan No." },
    { key: "total", header: "Loan Amount (OMR)" },
    { key: "paid", header: "Paid Amount (OMR)" },
    { key: "remaining", header: "Remaining Balance (OMR)" },
    { key: "monthly", header: "Monthly Installment (OMR)" },
    { key: "status", header: "Status" },
  ];

  const small = [
    {
      icon: FileText,
      label: "Total Loans",
      value: loans.length,
      note: active.length + " Active · " + (granted.length - active.length) + " Ended",
    },
    { icon: Wallet, label: "Total Loan Amount", value: amount(sum(granted, "total")), note: "Across all loans." },
    { icon: PieChart, label: "Total Paid Amount", value: amount(sum(granted, "paid")) },
    {
      icon: Database,
      label: "Total Remaining Balance",
      value: amount(owed),
      tone: owed > 0 ? "text-amber-700" : "text-primary",
      tint: owed > 0 ? "wait" : "plain",
    },
    { icon: CalendarDays, label: "Next Installment Date", value: nextDue ? longDate(nextDue) : "-" },
    { icon: Coins, label: "Next Installment Amount", value: nextDue ? amount(nextAmount) : "-" },
  ];

  return (
    <div className="space-y-5">
      {/* What this is, and the way to ask for another, on the one row. */}
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary"
        >
          <Database className="size-7" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-primary">Loans</h2>
          <p className="text-sm text-primary/75">View your loans, installments and remaining balances.</p>
        </div>
        {onAdd && (
          <Button type="button" variant="outline" className="ms-auto" onClick={onAdd}>
            <Plus className="me-2 size-4" aria-hidden="true" />
            {addLabel}
          </Button>
        )}
      </div>

      {/* What needs attention first: what is late, and what is nearly done. */}
      {(overdueRows.length > 0 || ending) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {overdueRows.length > 0 && (
            <button
              type="button"
              onClick={unfoldOverdue}
              className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-start transition-colors hover:bg-red-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TriangleAlert className="size-6 shrink-0 fill-red-600 text-white" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-red-700">
                  You have {overdueRows.length} overdue installment{overdueRows.length === 1 ? "" : "s"}.
                </span>
                <span className="block text-sm text-primary/75">
                  Please settle the overdue installments to avoid further deductions.
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-red-700" aria-hidden="true" />
            </button>
          )}
          {ending && (
            <button
              type="button"
              onClick={() => setOpen((prev) => ({ ...prev, [ending.id]: true }))}
              className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-start transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="size-6 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-primary">
                  Loan will be fully repaid in {ending.left} month{ending.left === 1 ? "" : "s"}.
                </span>
                <span className="block text-sm text-primary/75">
                  Your {ending.name} ({ending.number}) has only {ending.left} installment
                  {ending.left === 1 ? "" : "s"} remaining.
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <section className="space-y-4 rounded-xl border bg-blue-50/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <Sparkles className="mt-0.5 size-7 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-primary">AI Overview</h3>
            <p className="text-sm text-primary/75">Based on your loan history and company policy.</p>
          </div>
          <p className="ms-auto flex items-center gap-2 text-sm text-primary/70">
            Last updated today, {longDate(today)}
            <Info className="size-4 shrink-0" aria-label="Worked out from the salary, existing loans and the loan limit.">
              <title>Worked out from the salary, existing loans and the loan limit.</title>
            </Info>
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Tile
            icon={Database}
            label="Remaining Eligible Amount"
            value={amount(remaining)}
            tone={remaining > 0 ? "text-green-700" : "text-red-700"}
            tint={remaining > 0 ? "good" : "bad"}
            note="Available amount for a new loan based on current policy limits and active loans."
          />
          <div className={cn("flex min-w-0 gap-2.5 rounded-xl border p-3", TILE_TINT.plain.box)}>
            <span
              aria-hidden="true"
              className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", TILE_TINT.plain.mark)}
            >
              <Lightbulb className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">AI Recommendation</p>
              <p className="mt-1 text-lg font-bold leading-tight text-primary">{amount(recommended)}</p>
              <p className="mt-1 text-xs leading-snug text-primary/70">
                Based on your salary, existing loans and policy.
              </p>
              {/* Always there, as the design has it. Where it cannot be used
                  yet it is greyed, with the reason under it rather than
                  quietly missing. */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={!onApply || recommended <= 0 || asked > 0}
                onClick={() => onApply?.(recommended)}
              >
                Apply Recommended Loan Amount
              </Button>
              {asked > 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  Available once the pending loan request is decided.
                </p>
              ) : recommended <= 0 ? (
                <p className="mt-1 text-xs text-amber-700">No amount is available to borrow right now.</p>
              ) : null}
            </div>
          </div>
          <div className={cn("min-w-0 rounded-xl border p-3", TILE_TINT.good.box)}>
            <p className="text-xs font-semibold text-primary">Approval Probability</p>
            <div className="mt-1 flex items-center gap-3">
              <Ring percent={probability} tone={chance.ring} />
              <div className="min-w-0">
                <p className={cn("text-base font-bold leading-tight", chance.ink)}>{chance.word}</p>
                <p className="mt-0.5 text-xs leading-snug text-primary/70">
                  {asked > 0
                    ? "A loan request is already awaiting approval."
                    : "Based on your financial profile and repayment history."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What the loans come to, on one line wherever there is room. */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          {small.map((tile) => (
            <Tile key={tile.label} compact {...tile} />
          ))}
          <button
            type="button"
            onClick={unfoldOverdue}
            disabled={overdueRows.length === 0}
            className={cn(
              "min-w-0 rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
              overdueRows.length ? cn(TILE_TINT.bad.box, "hover:bg-red-100/70") : TILE_TINT.plain.box
            )}
          >
            {/* Laid out as the compact tiles beside it. */}
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  overdueRows.length ? TILE_TINT.bad.mark : TILE_TINT.plain.mark
                )}
              >
                <TriangleAlert className="size-4" />
              </span>
              <span className="min-w-0 text-xs font-semibold leading-tight text-primary">Overdue Installments</span>
            </span>
            <span className="mt-2 flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-sm font-bold leading-tight 2xl:text-base",
                  overdueRows.length ? "text-red-700" : "text-primary"
                )}
              >
                {overdueRows.length}
              </span>
              {overdueRows.length > 0 && <ChevronRight className="size-4 shrink-0 text-red-700" aria-hidden="true" />}
            </span>
          </button>
        </div>
      </section>

      <div>
        <h3 className="text-xl font-bold text-primary">Recent &amp; Active Loans</h3>
        <p className="text-sm text-primary/75">View your loans and track their installments.</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {/* What to look for, how it is narrowed, how many to a page, and the
            download - as every request table has them. */}
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <div className="relative w-full sm:w-72 lg:w-88">
            <Sparkles
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-primary"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Smart Search"
              aria-label="Search loans"
              className="ps-9"
            />
          </div>
          <FilterPanel fields={fields} value={filters} onChange={setFilters} />
          <Select value={String(pageSize)} onValueChange={(value) => value && setPageSize(Number(value))}>
            <SelectTrigger className="w-24" aria-label="Loans per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["10", "25", "50"].map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-[42px]"
            onClick={() => downloadCsv(toCsv(exportColumns, shown), "loans.csv")}
          >
            <ExcelIcon className="size-5" />
            <span className="sr-only">Export to Excel</span>
          </Button>
        </div>
        {filterChips(fields, filters).length > 0 && (
          <div className="flex flex-wrap gap-2 border-b px-3 py-2">
            {filterChips(fields, filters).map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilters(withoutChip(filters, chip))}
                className="rounded-full bg-muted px-3 py-1 text-xs text-primary"
              >
                {chip.label}: {chip.value} ✕
              </button>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-table-head text-xs font-semibold text-primary">
              <tr>
                <th className="px-4 py-3 text-start">Loan No.</th>
                <th className="px-4 py-3 text-end">Loan Amount (OMR)</th>
                <th className="px-4 py-3 text-end">Paid Amount (OMR)</th>
                <th className="px-4 py-3 text-end">Remaining Balance (OMR)</th>
                <th className="px-4 py-3 text-end">Monthly Installment (OMR)</th>
                <th className="px-4 py-3 text-start">Next Installment Date</th>
                <th className="px-4 py-3 text-end">Next Installment Amount</th>
                <th className="px-4 py-3 text-center">Overdue Inst.</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    No loans to show.
                  </td>
                </tr>
              )}
              {shown.map((loan, index) => {
                const unfolded = isOpen(loan, index);
                const rows = whole[loan.id] ? loan.installments : loan.installments.slice(0, SCHEDULE_PREVIEW);
                const more = loan.installments.length - SCHEDULE_PREVIEW;
                const paidCount = loan.installments.filter((row) => row.status === "Paid").length;
                return (
                  <Fragment key={loan.id}>
                    {/* The loan itself. */}
                    <tr className="border-t">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setOpen((prev) => ({ ...prev, [loan.id]: !unfolded }))}
                          aria-expanded={unfolded}
                          className="flex items-center gap-2 rounded font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <ChevronDown
                            className={cn("size-4 transition-transform", !unfolded && "-rotate-90")}
                            aria-hidden="true"
                          />
                          {loan.name}
                          <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", LOAN_CHIP[loan.status])}>
                            {loan.status}
                          </span>
                        </button>
                        {/* The number opens the request back up. */}
                        <span className="ms-6 flex items-center gap-2">
                          {onOpen ? (
                            <button
                              type="button"
                              onClick={() => onOpen(loan.record)}
                              className="rounded text-sm text-record-link hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {loan.number}
                            </button>
                          ) : (
                            <span className="text-sm text-primary/70">{loan.number}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end font-semibold text-primary">{amountValue(loan.total)}</td>
                      <td className="px-4 py-3 text-end text-primary">{amountValue(loan.paid)}</td>
                      <td className="px-4 py-3 text-end text-primary">{amountValue(loan.remaining)}</td>
                      <td className="px-4 py-3 text-end text-primary">{amountValue(loan.monthly)}</td>
                      <td className="px-4 py-3 text-primary">{loan.next ? formatDate(loan.next.due) : "-"}</td>
                      <td className="px-4 py-3 text-end text-primary">
                        {loan.next ? amountValue(loan.next.installment - loan.next.paid) : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-block min-w-7 rounded-md px-2 py-0.5 text-xs font-semibold",
                            loan.overdue.length ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {loan.overdue.length}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-md px-2.5 py-0.5 text-xs font-semibold", LOAN_CHIP[loan.status])}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="rounded p-1 text-primary hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <MoreHorizontal className="size-5" aria-hidden="true" />
                              <span className="sr-only">Actions for {loan.name}</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setOpen((prev) => ({ ...prev, [loan.id]: !unfolded }))}>
                              {unfolded ? "Hide installments" : "Show installments"}
                            </DropdownMenuItem>
                            {onOpen && (
                              <DropdownMenuItem onSelect={() => onOpen(loan.record)}>Open request</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>

                    {/* Its installments, folded under it: the first few, and
                        the rest on asking. */}
                    {unfolded && loan.installments.length > 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 pb-3">
                          <div className="rounded-lg border bg-table-head/30 px-3 py-2">
                            <p className="pb-1 text-sm font-semibold text-primary">
                              Installment Schedule ({paidCount} of {loan.installments.length} paid)
                            </p>
                            <table className="w-full text-xs">
                              <thead className="text-primary/70">
                                <tr>
                                  <th className="w-20 px-2 py-1.5 text-start font-medium">Inst. No.</th>
                                  <th className="px-2 py-1.5 text-start font-medium">Due Date</th>
                                  <th className="px-2 py-1.5 text-end font-medium">Installment Amount (OMR)</th>
                                  <th className="px-2 py-1.5 text-end font-medium">Paid Amount (OMR)</th>
                                  <th className="px-2 py-1.5 text-end font-medium">Remaining (OMR)</th>
                                  <th className="px-2 py-1.5 text-start font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row) => {
                                  const late = loan.overdue.includes(row);
                                  return (
                                    <tr key={row.no} className="border-t border-dashed">
                                      <td className="px-2 py-1.5 text-primary/70">{row.no}</td>
                                      <td className="px-2 py-1.5 text-primary">{formatDate(row.due)}</td>
                                      <td className="px-2 py-1.5 text-end text-primary">{amountValue(row.installment)}</td>
                                      <td className="px-2 py-1.5 text-end text-primary">{amountValue(row.paid)}</td>
                                      <td className="px-2 py-1.5 text-end text-primary">{amountValue(row.remaining)}</td>
                                      <td className="px-2 py-1.5">
                                        <span
                                          className={cn(
                                            "rounded px-2 py-0.5 font-semibold",
                                            late ? "bg-red-100 text-red-800" : INSTALLMENT_STATUS_TONE[row.status]
                                          )}
                                        >
                                          {late ? "Overdue" : row.status}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {more > 0 && (
                              <button
                                type="button"
                                onClick={() => setWhole((prev) => ({ ...prev, [loan.id]: !prev[loan.id] }))}
                                aria-expanded={Boolean(whole[loan.id])}
                                className="mt-1 flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-primary hover:text-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {whole[loan.id] ? "Show fewer installments" : "View " + more + " more installments"}
                                <ChevronDown
                                  className={cn("size-3.5 transition-transform", whole[loan.id] && "rotate-180")}
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * The loans already granted, as the loan request shows them before a new one
 * is asked for: what each was, what is left on it and when it ends, with its
 * installments a click away - and what is owed across all of them.
 */
export function ExistingLoans({ records }) {
  const [open, setOpen] = useState({});
  const loans = describeLoans(records).filter((loan) => loan.granted);
  const active = loans.filter((loan) => loan.status === "Active");
  const outstanding = loans.reduce((total, loan) => total + loan.remaining, 0);

  return (
    <section className="space-y-4 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-primary">
          <FileText className="size-6" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-primary">Your Existing Loans ({loans.length})</h3>
          <p className="text-sm text-primary/75">
            You currently have {active.length} active loan{active.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-blue-50/60 px-4 py-2">
          <Database className="size-6 text-primary" aria-hidden="true" />
          <div>
            <p className="text-xs text-primary/75">Total Outstanding Loans</p>
            <p className="text-xl font-bold text-primary">
              {amountValue(outstanding)} <span className="text-sm font-normal text-primary/70">OMR</span>
            </p>
          </div>
        </div>
      </div>

      {loans.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No loans have been granted yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-table-head text-xs font-semibold text-primary">
              <tr>
                <th className="w-8 px-3 py-2.5" />
                <th className="px-3 py-2.5 text-start">Loan No.</th>
                <th className="px-3 py-2.5 text-start">Original Amount (OMR)</th>
                <th className="px-3 py-2.5 text-start">Remaining Balance (OMR)</th>
                <th className="px-3 py-2.5 text-start">Monthly Installment (OMR)</th>
                <th className="px-3 py-2.5 text-start">Start Date</th>
                <th className="px-3 py-2.5 text-start">End Date</th>
                <th className="px-3 py-2.5 text-start">Status</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <Fragment key={loan.id}>
                  <tr className="border-t">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setOpen((prev) => ({ ...prev, [loan.id]: !prev[loan.id] }))}
                        aria-expanded={Boolean(open[loan.id])}
                        className="rounded p-0.5 text-primary hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronRight
                          className={cn("size-4 transition-transform", open[loan.id] && "rotate-90")}
                          aria-hidden="true"
                        />
                        <span className="sr-only">Installments of {loan.name}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-primary">
                      {loan.name}
                      <span className="px-2 font-normal text-primary/40">|</span>
                      <span className="font-normal">{loan.number}</span>
                    </td>
                    <td className="px-3 py-2.5 text-primary">{amountValue(loan.total)}</td>
                    <td className="px-3 py-2.5 text-primary">{amountValue(loan.remaining)}</td>
                    <td className="px-3 py-2.5 text-primary">{amountValue(loan.monthly)}</td>
                    <td className="px-3 py-2.5 text-primary">{loan.start ? formatDate(loan.start) : "-"}</td>
                    <td className="px-3 py-2.5 text-primary">{loan.end ? formatDate(loan.end) : "-"}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("rounded-md px-2.5 py-0.5 text-xs font-semibold", LOAN_CHIP[loan.status])}>
                        {loan.status}
                      </span>
                    </td>
                  </tr>
                  {open[loan.id] &&
                    loan.installments.map((row) => (
                      <tr key={row.no} className="border-t border-dashed bg-table-head/30 text-xs">
                        <td />
                        <td className="px-3 py-1.5 text-primary/70">
                          {loan.name.replace("Loan ", "")}.{row.no} · {formatDate(row.due)}
                        </td>
                        <td className="px-3 py-1.5 text-primary">{amountValue(row.installment)}</td>
                        <td className="px-3 py-1.5 text-primary">{amountValue(row.remaining)}</td>
                        <td className="px-3 py-1.5 text-primary">Paid {amountValue(row.paid)}</td>
                        <td colSpan={2} />
                        <td className="px-3 py-1.5">
                          <span className={cn("rounded px-2 py-0.5 font-semibold", INSTALLMENT_STATUS_TONE[row.status])}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
