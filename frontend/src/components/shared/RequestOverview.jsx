import { useState } from "react";
import {
  BarChart3,
  ChevronRight,
  CircleCheck,
  CircleMinus,
  CircleX,
  ClipboardList,
  Clock,
  FileText,
  Info,
  Lightbulb,
  Percent,
  Plus,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { money } from "@/lib/money";
import { longDate } from "@/pages/employees/sections/AdvanceSalarySection";
import { Tile, Ring, TILE_TINT, chanceOf } from "@/pages/employees/sections/AdvanceOverview";

/** Today where the user is, not in UTC. */
const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Where a request stands, in the four words every overview counts by. */
const bucketOf = (status) => {
  if (status === "Returned") return "returned";
  if (status === "Rejected" || status === "Cancelled") return "rejected";
  if (status === "Pending") return "pending";
  return "approved";
};

/** A sum the office would actually suggest: rounded down to the nearest 50. */
const roundDown = (value) => Math.max(0, Math.floor(value / 50) * 50);

const dateText = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || "")) ? longDate(String(iso).slice(0, 10)) : "-");

/**
 * What the overview reads off one employee's requests of one kind.
 *
 * Nothing here is stored or guessed: every figure is counted off the same rows
 * the table lists, so it can always be traced back to them. The "AI" figures
 * are a reading of that history, worked out the same way each time.
 */
function readRequests(rows, { money: inMoney, unit }) {
  const counts = { total: rows.length, approved: 0, pending: 0, returned: 0, rejected: 0 };
  rows.forEach((row) => {
    counts[bucketOf(row.status)] += 1;
  });
  const approved = rows.filter((row) => bucketOf(row.status) === "approved");
  const pending = rows.filter((row) => bucketOf(row.status) === "pending");
  const rejected = rows.filter((row) => bucketOf(row.status) === "rejected");

  const approvedTotal = approved.reduce((total, row) => total + Number(row.amount || 0), 0);
  const typical = approved.length ? approvedTotal / approved.length : 0;
  const recommended = inMoney ? roundDown(typical) : 0;

  const answered = counts.approved + counts.rejected + counts.returned;
  const rate = answered ? Math.round((counts.approved / answered) * 100) : 0;
  const probability = Math.round(55 + 40 * (answered ? counts.approved / answered : 0.75));

  const tally = rows.reduce((all, row) => {
    if (row.type) all[row.type] = (all[row.type] || 0) + 1;
    return all;
  }, {});
  const common = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  const now = new Date();
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const rejectedLately = rejected.filter((row) => row.date && new Date(row.date) >= yearAgo).length;

  const insights = rows.length
    ? [
        common ? "Most of the past requests are for " + common + "." : null,
        approved.length
          ? inMoney
            ? "Approved requests average " + money(typical) + "."
            : unit
              ? "Approved requests average " + Math.round(typical * 10) / 10 + " " + unit.toLowerCase() + "."
              : rate + "% of decided requests were approved."
          : "No request has been approved yet.",
        rejectedLately
          ? rejectedLately + " rejected request" + (rejectedLately === 1 ? "" : "s") + " in the last 12 months."
          : "No rejected requests in the last 12 months.",
      ].filter(Boolean)
    : ["No requests have been made yet."];

  // Newest first by date, then by the order the page gave them.
  const last = [...rows].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || null;

  return { counts, pending, approvedTotal, recommended, rate, probability, common, insights, last };
}

/**
 * A request kind's overview, as Salary Advance, Loans and Financial Assistance
 * draw theirs: what it is and the way to ask, what is waiting, a reading of
 * the past requests, where they stand, and what they are usually for - over
 * the list of them.
 *
 * `rows` are the page's own requests, each as { id, no, date, amount, status,
 * type, record }. `money` says the amount is a sum of money; otherwise `unit`
 * names what it counts (Days, Hours), or the requests are counted alone.
 */
export default function RequestOverview({
  icon,
  title,
  subtitle,
  noun = "request",
  newLabel,
  onNew,
  rows,
  money: inMoney = false,
  unit,
  typeLabel = "Request Type",
  onOpen,
  // Opens a new request already set to the suggested sum.
  onApply,
  // Every request, for the View All window.
  renderAll,
}) {
  const [showAll, setShowAll] = useState(false);
  const Icon = icon;
  const read = readRequests(rows, { money: inMoney, unit });
  const chance = chanceOf(read.probability);
  const today = todayIso();
  const figure = (value) => (inMoney ? money(value) : unit ? value + " " + unit : value);

  const stats = [
    { label: "Approved", value: read.counts.approved, icon: CircleCheck, tone: "fill-green-600 text-white" },
    { label: "Pending", value: read.counts.pending, icon: Clock, tone: "fill-amber-400 text-white" },
    { label: "Returned", value: read.counts.returned, icon: CircleX, tone: "fill-red-600 text-white" },
    { label: "Rejected", value: read.counts.rejected, icon: CircleMinus, tone: "fill-slate-600 text-white" },
  ];
  const lastBucket = read.last ? bucketOf(read.last.status) : "";
  const lastChip = {
    approved: "bg-green-100 text-green-800",
    pending: "bg-amber-100 text-amber-800",
    returned: "bg-orange-100 text-orange-800",
    rejected: "bg-red-100 text-red-800",
  }[lastBucket];

  return (
    <div className="space-y-5">
      {/* One line on a wide screen: the name, what is waiting, and the way to ask. */}
      <div className="grid items-center gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary"
          >
            <Icon className="size-6" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-primary">{title}</h2>
            <p className="text-xs text-primary/75">{subtitle}</p>
          </div>
        </div>
        {read.pending.length > 0 ? (
          <button
            type="button"
            onClick={() => onOpen?.(read.pending[0].record)}
            disabled={!onOpen}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-start transition-colors hover:bg-amber-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
          >
            <TriangleAlert className="size-5 shrink-0 fill-amber-500 text-white" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-amber-800">
                You have {read.pending.length} pending {noun}
                {read.pending.length === 1 ? "" : "s"}.
              </span>
              <span className="block text-xs text-primary/75">Awaiting a management decision.</span>
            </span>
            {onOpen && <ChevronRight className="size-4 shrink-0 text-amber-800" aria-hidden="true" />}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        {onNew && (
          <Button type="button" variant="outline" className="justify-self-start lg:justify-self-end" onClick={onNew}>
            <Plus className="me-2 size-4" aria-hidden="true" />
            {newLabel}
          </Button>
        )}
      </div>

      <section className="space-y-4 rounded-xl border bg-blue-50/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <Sparkles className="mt-0.5 size-7 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-primary">AI Overview</h3>
            <p className="text-sm text-primary/75">Based on the request history and company policy.</p>
          </div>
          <p className="ms-auto flex items-center gap-2 text-sm text-primary/70">
            Last updated today, {longDate(today)}
            <Info className="size-4 shrink-0" aria-label="Worked out from this employee's past requests of this kind.">
              <title>Worked out from this employee&apos;s past requests of this kind.</title>
            </Info>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {inMoney ? (
            <div className={cn("flex min-w-0 flex-col rounded-xl border p-3", TILE_TINT.plain.box)}>
              <div className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", TILE_TINT.plain.mark)}
                >
                  <Lightbulb className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">AI Recommendation</p>
                  <p className="mt-1 text-base font-bold leading-tight text-primary">{money(read.recommended)}</p>
                  <p className="mt-1 text-[11px] leading-snug text-primary/70">Based on past approved requests.</p>
                </div>
              </div>
              {onApply && (
                <div className="mt-auto pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-8 w-full whitespace-normal px-3 py-1.5 text-center text-xs leading-tight"
                    disabled={read.recommended <= 0}
                    onClick={() => onApply(read.recommended)}
                  >
                    Apply Recommended Amount
                  </Button>
                  {read.recommended <= 0 && (
                    <p className="mt-1 text-[11px] leading-snug text-amber-700">
                      Available once a request has been approved.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Tile
              dense
              icon={Percent}
              label="Approval Rate"
              value={read.rate + "%"}
              note="Of the requests already decided."
            />
          )}
          <div className={cn("min-w-0 rounded-xl border p-3", TILE_TINT.good.box)}>
            <p className="text-xs font-semibold text-primary">Approval Probability</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="shrink-0 [&>svg]:size-14">
                <Ring percent={read.probability} tone={chance.ring} />
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-bold leading-tight", chance.ink)}>{chance.word}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-primary/70">Based on how earlier requests were decided.</p>
              </div>
            </div>
          </div>
          <Tile
            dense
            icon={Wallet}
            label={inMoney ? "Total Approved Amount" : unit ? "Total Approved " + unit : "Approved Requests"}
            value={inMoney || unit ? figure(read.approvedTotal) : read.counts.approved}
            tone="text-green-700"
            tint="good"
            note="Across all approved requests."
          />
          <Tile
            dense
            icon={ClipboardList}
            label="Pending Requests"
            value={read.counts.pending}
            tone={read.counts.pending ? "text-amber-700" : "text-primary"}
            tint={read.counts.pending ? "wait" : "plain"}
            note="Awaiting a decision."
          />
        </div>

        {/* Where this person's requests stand, and the latest of them. */}
        <div className="grid items-center gap-4 rounded-xl border bg-white px-4 py-3 sm:grid-cols-[auto_repeat(4,minmax(0,1fr))] lg:grid-cols-[auto_repeat(4,minmax(0,1fr))_minmax(0,2fr)] lg:divide-x lg:divide-container-border">
          <div className="flex items-center gap-3 pe-4">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary"
            >
              <Icon className="size-5" strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-xl font-bold text-primary">{read.counts.total}</p>
              <p className="text-xs text-primary/75">Total Requests</p>
            </div>
          </div>
          {stats.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} className="flex flex-col items-center gap-0.5 px-2">
                <span className="flex items-center gap-1.5 text-lg font-semibold text-primary">
                  <StatIcon className={cn("size-5", stat.tone)} aria-hidden="true" />
                  {stat.value}
                </span>
                <span className="text-xs text-primary/75">{stat.label}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-3 ps-4 sm:col-span-full lg:col-span-1">
            <Clock className="size-7 shrink-0 text-primary" aria-hidden="true" />
            {read.last ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-primary/75">Last Request</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-primary">
                    {inMoney || unit ? figure(Number(read.last.amount || 0)) : read.last.no}
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", lastChip)}>
                      {read.last.status}
                    </span>
                  </p>
                  <p className="text-xs text-primary/75">{dateText(read.last.date)}</p>
                </div>
                {onOpen && (
                  <button
                    type="button"
                    onClick={() => onOpen(read.last.record)}
                    className="rounded-md p-1 text-primary hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight className="size-5" aria-hidden="true" />
                    <span className="sr-only">Open the last request</span>
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-primary/75">No requests yet.</p>
            )}
          </div>
        </div>

        {/* What this person usually asks for, and what their history says. */}
        <div className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:divide-x md:divide-container-border">
          <div className="flex items-center gap-3 md:pe-4">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary"
            >
              <BarChart3 className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">Most Common {typeLabel}</p>
              <p className="text-base font-bold text-primary">{read.common || "-"}</p>
              <p className="text-xs text-primary/70">
                {read.common ? "Based on the past requests." : "No past requests yet."}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 md:ps-4">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary"
            >
              <FileText className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">Key Insights</p>
              <ul className="mt-1 space-y-1">
                {read.insights.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-primary/80">
                    <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-green-600" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-primary">Recent Requests</h3>
          <p className="text-sm text-primary/75">View the latest {noun}s.</p>
        </div>
        {renderAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded font-semibold text-primary hover:text-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View All
          </button>
        )}
      </div>

      {renderAll && (
        <Dialog open={showAll} onOpenChange={setShowAll}>
          <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{title} History</DialogTitle>
              <DialogDescription>{"Every " + noun + " on record."}</DialogDescription>
            </DialogHeader>
            {showAll && renderAll()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
