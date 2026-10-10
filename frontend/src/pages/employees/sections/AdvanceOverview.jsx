import { useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CircleMinus,
  CircleX,
  Clock,
  Database,
  Info,
  Lightbulb,
  Plus,
  Sparkles,
  UserRound,
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
import { amount } from "../employeeData";
import {
  ADVANCE_STATUS_CHIP,
  MONTHS,
  advanceStatusOf,
  advancesFor,
  outstandingAdvance,
} from "../advanceSalaryData";
import { longDate } from "./AdvanceSalarySection";
import SalaryLedger from "./SalaryLedger";

const isoOf = (date) =>
  date.getFullYear() +
  "-" +
  String(date.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(date.getDate()).padStart(2, "0");

/** A sum the office would actually suggest: rounded down to the nearest 50. */
const roundDown = (value) => Math.max(0, Math.floor(value / 50) * 50);

/**
 * What the overview reads off one employee's advances and salary.
 *
 * Nothing here is stored or guessed: the limit is the one the request form
 * holds a request to - the net salary less what earlier advances still owe -
 * and every other figure is counted off the same requests the table lists.
 * The "AI" figures are a reading of that history, worked out the same way
 * each time, so a figure can always be traced back to the rows below it.
 */
function readAdvances(advances, employee, net, today = new Date()) {
  const requests = advancesFor(advances, employee?.name);
  const statusOf = advanceStatusOf;
  const count = (status) => requests.filter((r) => statusOf(r) === status).length;
  const counts = {
    total: requests.length,
    approved: count("Approved"),
    pending: count("Pending"),
    returned: count("Returned"),
    rejected: count("Rejected"),
  };

  const outstanding = outstandingAdvance(advances, employee?.name, today);
  const limit = Math.max(0, Number((net - outstanding).toFixed(3)));
  // Asked for and not yet answered: it would come out of the same salary.
  const waiting = requests
    .filter((r) => r.status === "Pending")
    .reduce((total, r) => total + Number(r.amount || 0), 0);
  const remaining = Math.max(0, Number((limit - waiting).toFixed(3)));

  // The month after the last one an advance is still due out of - or today,
  // when nothing is owed or waiting.
  const tied = requests.filter(
    (r) => (r.status === "Approved" && outstanding > 0) || r.status === "Pending"
  );
  const lastTied = tied.reduce(
    (latest, r) => Math.max(latest, Number(r.deductYear) * 12 + MONTHS.indexOf(r.deductMonth)),
    -1
  );
  const nextDate =
    remaining > 0 || lastTied < 0
      ? isoOf(today)
      : isoOf(new Date(Math.floor((lastTied + 1) / 12), (lastTied + 1) % 12, 1));

  // What is usually granted, held to what is left; a first request is
  // suggested at a third of the net salary.
  const granted = requests.filter((r) => r.status === "Approved");
  const usual = granted.length
    ? granted.reduce((t, r) => t + Number(r.approvedAmount ?? r.amount ?? 0), 0) / granted.length
    : net / 3;
  const recommended = roundDown(Math.min(usual, remaining));

  // How often a request like this has been granted, leaning on whether the
  // suggested sum still fits what is left.
  const answered = counts.approved + counts.rejected + counts.returned;
  const record = answered ? counts.approved / answered : 0.75;
  const probability = remaining > 0 ? Math.round(55 + 40 * record) : 15;

  const last = requests[0] || null;
  return { counts, outstanding, limit, remaining, nextDate, recommended, probability, last };
}

/**
 * The tint of each kind of reading - the system's own colours, used the way
 * it uses them everywhere else: green for what is in the employee's favour,
 * amber for a date to wait for, the primary blue for a plain figure.
 */
export const TILE_TINT = {
  good: { box: "border-green-200 bg-green-50/60", mark: "bg-green-100 text-green-700" },
  wait: { box: "border-amber-200 bg-amber-50/70", mark: "bg-amber-100 text-amber-700" },
  bad: { box: "border-red-200 bg-red-50/70", mark: "bg-red-100 text-red-700" },
  plain: { box: "border-blue-100 bg-white", mark: "bg-blue-50 text-primary" },
};

/**
 * One reading in the overview: what it is, the figure, and why.
 *
 * `compact` is for a row of many narrow tiles: the mark and the name share
 * the top line, so the figure below has the tile's whole width and never
 * runs out of it.
 */
export function Tile({ icon, label, value, note, tone = "text-primary", tint = "plain", compact, dense, children }) {
  const Icon = icon;
  const look = TILE_TINT[tint];
  if (compact) {
    return (
      <div className={cn("min-w-0 rounded-xl border p-3", look.box)}>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", look.mark)}
          >
            <Icon className="size-4" />
          </span>
          <p className="min-w-0 text-xs font-semibold leading-tight text-primary">{label}</p>
        </div>
        <p className={cn("mt-2 text-sm font-bold leading-tight wrap-anywhere 2xl:text-base", tone)}>
          {value}
        </p>
        {note && <p className="mt-1 text-xs leading-snug text-primary/70">{note}</p>}
      </div>
    );
  }
  return (
    <div className={cn("flex min-w-0 gap-2.5 rounded-xl border p-3", look.box)}>
      <span
        aria-hidden="true"
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", look.mark)}
      >
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary">{label}</p>
        {/* `dense`: a row of five or more, where the figure stays one size. */}
        <p className={cn("mt-1 text-base font-bold leading-tight", !dense && "xl:text-lg", tone)}>{value}</p>
        {children}
        {note && (
          <p className={cn("mt-1 leading-snug text-primary/70", dense ? "text-[11px]" : "text-xs")}>{note}</p>
        )}
      </div>
    </div>
  );
}

/** How a probability reads, and the colour it is shown in. */
export const chanceOf = (percent) =>
  percent >= 75
    ? { word: "High chance", ink: "text-green-700", ring: "stroke-green-600" }
    : percent >= 50
      ? { word: "Medium chance", ink: "text-amber-700", ring: "stroke-amber-500" }
      : { word: "Low chance", ink: "text-red-700", ring: "stroke-red-600" };

/** The chance a request is granted, as a ring filled that far round. */
export function Ring({ percent, tone }) {
  const radius = 26;
  const round = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0" role="img" aria-label={percent + "% approval probability"}>
      <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="7" className="stroke-slate-200" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={round}
        strokeDashoffset={round * (1 - percent / 100)}
        transform="rotate(-90 32 32)"
        className={tone}
      />
      <text x="32" y="37" textAnchor="middle" className="fill-primary text-[15px] font-bold">
        {percent}%
      </text>
    </svg>
  );
}

/**
 * The Salary Advance view on the Requests page: who may ask for how much, a
 * reading of their past requests, and where those requests stand - over the
 * list of them.
 */
export default function AdvanceOverview({
  employee,
  advances,
  net,
  history,
  // Opens a new request; left out where the viewer cannot make one.
  onNew,
  // Opens one request off the list.
  onOpen,
}) {
  const [showAll, setShowAll] = useState(false);
  const read = readAdvances(advances, employee, net);
  const eligible = read.remaining > 0;
  const chance = chanceOf(read.probability);
  const lastStatus = read.last ? advanceStatusOf(read.last) : "";

  const stats = [
    { label: "Approved", value: read.counts.approved, icon: CircleCheck, tone: "fill-green-600 text-white" },
    { label: "Pending", value: read.counts.pending, icon: Clock, tone: "fill-amber-400 text-white" },
    { label: "Returned", value: read.counts.returned, icon: CircleX, tone: "fill-red-600 text-white" },
    { label: "Rejected", value: read.counts.rejected, icon: CircleMinus, tone: "fill-slate-600 text-white" },
  ];

  return (
    <div className="space-y-5">
      {/* What this is, and the way to ask for one, on the one row. */}
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary"
        >
          <Wallet className="size-7" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-primary">Salary Advance</h2>
          <p className="text-sm text-primary/75">Request a salary advance and track your requests.</p>
        </div>
        {onNew && (
          <Button type="button" variant="outline" className="ms-auto" onClick={onNew}>
            <Plus className="me-2 size-4" aria-hidden="true" />
            New Salary Advance Request
          </Button>
        )}
      </div>

      <section className="space-y-4 rounded-xl border bg-blue-50/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <Sparkles className="mt-0.5 size-7 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-primary">AI Overview</h3>
            <p className="text-sm text-primary/75">Based on payroll history and company policy.</p>
          </div>
          <p className="ms-auto flex items-center gap-2 text-sm text-primary/70">
            Last updated today, {longDate(isoOf(new Date()))}
            <Info
              className="size-4 shrink-0"
              aria-label="Worked out from the salary, current deductions and past advance requests."
            >
              <title>Worked out from the salary, current deductions and past advance requests.</title>
            </Info>
          </p>
        </div>

        {/* The six readings on one line wherever there is room for them. */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Tile
            icon={UserRound}
            label="Eligibility"
            value={eligible ? "Eligible" : "Not Eligible"}
            tone={eligible ? "text-green-700" : "text-red-700"}
            tint={eligible ? "good" : "plain"}
          >
            {eligible ? (
              <>
                <p className="mt-1 text-xs text-primary/70">You can request up to</p>
                <p className="text-sm font-bold text-primary">{amount(read.remaining)}</p>
                <p className="text-xs leading-snug text-primary/70">Based on salary and active deductions.</p>
              </>
            ) : (
              <p className="mt-1 text-xs text-primary/70">
                This salary is already committed to earlier advances.
              </p>
            )}
          </Tile>
          <Tile
            icon={Database}
            label="Outstanding Balance"
            value={amount(read.outstanding)}
            note={
              read.outstanding > 0
                ? "Still to be deducted from coming salaries."
                : "No outstanding salary advances found."
            }
          />
          <Tile
            icon={CalendarDays}
            label="Next Eligible Date"
            value={longDate(read.nextDate)}
            tone="text-amber-700"
            tint="wait"
            note="Based on company policy."
          />
          <Tile
            icon={Lightbulb}
            label="AI Recommendation"
            value={amount(read.recommended)}
            note="Based on your salary, deductions and past requests."
          />
          <Tile
            icon={BadgeCheck}
            label="Remaining Eligible Amount"
            value={amount(read.remaining)}
            tone="text-green-700"
            tint="good"
            note="Available amount based on current policy limits."
          />
          <div className={cn("min-w-0 rounded-xl border p-3", TILE_TINT.good.box)}>
            <p className="text-xs font-semibold text-primary">Approval Probability</p>
            <div className="mt-1 flex items-center gap-2">
              <Ring percent={read.probability} tone={chance.ring} />
              <div className="min-w-0">
                <p className={cn("text-sm font-bold leading-tight", chance.ink)}>{chance.word}</p>
                <p className="mt-0.5 text-xs leading-snug text-primary/70">Based on how earlier requests were decided.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Where this person's requests stand, and the latest of them. */}
        <div className="grid items-center gap-4 rounded-xl border bg-white px-4 py-3 sm:grid-cols-[auto_repeat(4,minmax(0,1fr))] lg:grid-cols-[auto_repeat(4,minmax(0,1fr))_minmax(0,2fr)] lg:divide-x lg:divide-container-border">
          <div className="flex items-center gap-3 pe-4">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary"
            >
              <Wallet className="size-6" strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-2xl font-bold text-primary">{read.counts.total}</p>
              <p className="text-sm text-primary/75">Total Requests</p>
            </div>
          </div>
          {stats.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} className="flex flex-col items-center gap-0.5 px-2">
                <span className="flex items-center gap-1.5 text-xl font-semibold text-primary">
                  <StatIcon className={cn("size-6", stat.tone)} aria-hidden="true" />
                  {stat.value}
                </span>
                <span className="text-sm text-primary/75">{stat.label}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-3 ps-4 sm:col-span-full lg:col-span-1">
            <Clock className="size-8 shrink-0 text-primary" aria-hidden="true" />
            {read.last ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-primary/75">Last Request</p>
                  <p className="flex flex-wrap items-center gap-2 font-bold text-primary">
                    {amount(read.last.amount)}
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-semibold",
                        ADVANCE_STATUS_CHIP[lastStatus]
                      )}
                    >
                      {lastStatus}
                    </span>
                  </p>
                  <p className="text-sm text-primary/75">{longDate(read.last.requestedOn)}</p>
                </div>
                {onOpen && (
                  <button
                    type="button"
                    onClick={() => onOpen(read.last)}
                    className="rounded-md p-1 text-primary hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight className="size-6" aria-hidden="true" />
                    <span className="sr-only">Open the last request</span>
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-primary/75">No requests yet.</p>
            )}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-primary">Recent Requests</h3>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="rounded font-semibold text-primary hover:text-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View All
        </button>
      </div>

      {/* Every salary and advance on record, over the page. */}
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Salary &amp; Advance History · {employee?.name}</DialogTitle>
            <DialogDescription>Every salary and salary advance on record.</DialogDescription>
          </DialogHeader>
          <SalaryLedger employee={employee} history={history} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
