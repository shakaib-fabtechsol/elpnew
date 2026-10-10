import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  HandHeart,
  Info,
  Lightbulb,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { amount, netSalary } from "../employeeData";
import { statusOf } from "../assistanceData";
import { longDate } from "./AdvanceSalarySection";
import { Tile, Ring, TILE_TINT, chanceOf } from "./AdvanceOverview";

/**
 * The most a person may be given in assistance in one calendar year, in
 * months of net salary.
 *
 * The firm has not set this down anywhere yet, so it is one figure here,
 * where it can be changed, rather than a rule the page invents.
 */
export const ASSISTANCE_LIMIT_MONTHS = 2;

/** Today where the user is, not in UTC. */
const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** A sum the office would actually suggest: rounded down to the nearest 50. */
const roundDown = (value) => Math.max(0, Math.floor(value / 50) * 50);

/**
 * What the overview reads off one employee's assistance requests and salary.
 *
 * Nothing here is stored or guessed: every figure is counted off the same
 * requests the table lists, so a figure can always be traced back to them.
 */
function readAssistance(rows, employee) {
  const today = todayIso();
  const year = today.slice(0, 4);
  const net = employee ? netSalary(employee) : 0;
  const given = rows.filter((row) => {
    const status = statusOf(row);
    return status === "Approved" || status === "Paid";
  });
  const pending = rows.filter((row) => statusOf(row) === "Pending");

  const givenThisYear = given
    .filter((row) => String(row.requestDate).startsWith(year))
    .reduce((total, row) => total + Number(row.amount || 0), 0);
  const waiting = pending.reduce((total, row) => total + Number(row.amount || 0), 0);
  const limit = net * ASSISTANCE_LIMIT_MONTHS;
  const remaining = Math.max(0, Number((limit - givenThisYear - waiting).toFixed(3)));

  // Granted and not yet paid out, or not yet decided.
  const outstanding = rows.filter((row) => {
    const status = statusOf(row);
    return status === "Pending" || status === "Approved";
  }).length;

  // A new request waits on the pending one; the first of next month is the
  // soonest it would be looked at.
  const now = new Date();
  const nextDate = pending.length
    ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
    : null;
  const nextIso = nextDate
    ? nextDate.getFullYear() +
      "-" +
      String(nextDate.getMonth() + 1).padStart(2, "0") +
      "-01"
    : today;

  // What is usually granted, held to what is left.
  const usual = given.length
    ? given.reduce((total, row) => total + Number(row.amount || 0), 0) / given.length
    : net / 2;
  const recommended = roundDown(Math.min(usual, remaining));

  const rejected = rows.filter((row) => statusOf(row) === "Rejected");
  const answered = given.length + rejected.length;
  const record = answered ? given.length / answered : 0.75;
  const probability = remaining > 0 ? Math.round(55 + 40 * record) : 15;

  // What this person asks for most.
  const tally = rows.reduce((counts, row) => {
    counts[row.subcategory] = (counts[row.subcategory] || 0) + 1;
    return counts;
  }, {});
  const common = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const rejectedLately = rejected.filter((row) => new Date(row.requestDate) >= yearAgo).length;
  const overLimit = rows.some((row) => Number(row.amount || 0) > limit);
  const insights = rows.length
    ? [
        "Most of your past requests are for " + common + ".",
        overLimit
          ? "Some of your past requests were above the policy limit."
          : "Your requests are usually within policy limits.",
        rejectedLately
          ? rejectedLately + " rejected request" + (rejectedLately === 1 ? "" : "s") + " in the last 12 months."
          : "No rejected requests in the last 12 months.",
      ]
    : ["No assistance has been requested yet."];

  return { pending, outstanding, remaining, nextIso, recommended, probability, common, insights, today };
}

/**
 * The Financial Assistance view: who may ask for how much, a reading of
 * their past requests, and the way to ask - over the list of them.
 *
 * One request at a time: while one is still pending, the way to ask for
 * another is closed and says why.
 */
export default function AssistanceOverview({ rows, employee, onNew, onApply, onOpen, onViewAll }) {
  const read = readAssistance(rows, employee);
  const blocked = read.pending.length > 0;
  const chance = chanceOf(read.probability);

  return (
    <div className="space-y-5">
      {/* What this is, what is holding a new request up, and the way to ask. */}
      {/* One line on a wide screen: the name, what is holding a new request
          up, and the way to ask. */}
      <div className="grid items-center gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary"
          >
            <HandHeart className="size-6" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-primary">Financial Assistance</h2>
            <p className="text-xs text-primary/75">Request financial assistance and track your requests.</p>
          </div>
        </div>
        {blocked ? (
          <button
            type="button"
            onClick={() => onOpen?.(read.pending[0])}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-start transition-colors hover:bg-amber-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <TriangleAlert className="size-5 shrink-0 fill-amber-500 text-white" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-amber-800">
                You have {read.pending.length} pending financial assistance request
                {read.pending.length === 1 ? "" : "s"}.
              </span>
              <span className="block text-xs text-primary/75">
                You can submit a new request after the pending request is completed.
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-amber-800" aria-hidden="true" />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <Button
          type="button"
          variant="outline"
          className="justify-self-start lg:justify-self-end"
          onClick={onNew}
          disabled={!onNew || blocked}
        >
          <Plus className="me-2 size-4" aria-hidden="true" />
          New Financial Assistance Request
        </Button>
      </div>

      <section className="space-y-4 rounded-xl border bg-blue-50/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <Sparkles className="mt-0.5 size-7 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-primary">AI Overview</h3>
            <p className="text-sm text-primary/75">Based on your salary, existing requests and company policy.</p>
          </div>
          <p className="ms-auto flex items-center gap-2 text-sm text-primary/70">
            Last updated today, {longDate(read.today)}
            <Info className="size-4 shrink-0" aria-label="Worked out from the salary, past requests and the yearly limit.">
              <title>Worked out from the salary, past requests and the yearly limit.</title>
            </Info>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                <p className="mt-1 text-base font-bold leading-tight text-primary">
                  {amount(read.recommended)}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-primary/70">Based on your salary and past requests.</p>
              </div>
            </div>
            {/* Across the whole tile, under the figure it applies, and at the
                foot of the tile so it lines up with the tiles beside it. */}
            <div className="mt-auto pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                // Room either side of the words; on a narrow tile they wrap
                // inside the button rather than running into its edges.
                className="h-auto min-h-8 w-full whitespace-normal px-3 py-1.5 text-center text-xs leading-tight"
                disabled={!onApply || blocked || read.recommended <= 0}
                onClick={() => onApply?.(read.recommended)}
              >
                Apply Recommended Amount
              </Button>
              {blocked && (
                <p className="mt-1 text-[11px] leading-snug text-amber-700">
                  Available once the pending request is completed.
                </p>
              )}
            </div>
          </div>
          <div className={cn("min-w-0 rounded-xl border p-3", TILE_TINT.good.box)}>
            <p className="text-xs font-semibold text-primary">Approval Probability</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="shrink-0 [&>svg]:size-14">
                <Ring percent={read.probability} tone={chance.ring} />
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-bold leading-tight", chance.ink)}>{chance.word}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-primary/70">
                  Based on how earlier requests were decided.
                </p>
              </div>
            </div>
          </div>
          <Tile dense
            icon={Database}
            label="Remaining Eligible Amount"
            value={amount(read.remaining)}
            tone={read.remaining > 0 ? "text-green-700" : "text-red-700"}
            tint={read.remaining > 0 ? "good" : "bad"}
            note="Available amount based on current policy limits."
          />
          <Tile dense
            icon={CalendarDays}
            label="Next Eligible Date"
            value={longDate(read.nextIso)}
            note="Next date you can submit a new request."
          />
          <Tile dense
            icon={ClipboardList}
            label="Outstanding Requests"
            value={read.outstanding}
            tone={read.outstanding ? "text-amber-700" : "text-primary"}
            tint={read.outstanding ? "wait" : "plain"}
            note="Requests not yet disbursed."
          />
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
              <p className="text-sm font-semibold text-primary">Most Common Assistance Type</p>
              <p className="text-lg font-bold text-primary">{read.common || "-"}</p>
              <p className="text-xs text-primary/70">
                {read.common ? "Based on your past requests." : "No past requests yet."}
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
          <p className="text-sm text-primary/75">View your latest financial assistance requests.</p>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="rounded font-semibold text-primary hover:text-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View All
          </button>
        )}
      </div>
    </div>
  );
}
