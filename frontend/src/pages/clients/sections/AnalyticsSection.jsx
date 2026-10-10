import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Layers, Scale, Briefcase, TrendingUp, Inbox } from "lucide-react";
import BarTrendChart from "@/components/shared/BarTrendChart";
import SummaryStrip from "@/components/shared/SummaryStrip";
import CountBars from "@/components/shared/CountBars";
import { SectionCard, Tile } from "@/components/shared/panels";
import {
  clientCases,
  liveCases,
  deletedCases,
  CASE_TYPES,
  CASE_STAGES,
  CASE_LEVELS,
  isOpen,
  isInProgress,
  claimTotal,
  receivedBetween,
  countBy,
  receivedPeriods,
} from "../clientCases";
import { withRial } from "@/lib/money";

import DateField from "@/components/shared/DateField";
const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("en-GB") : "-";

const MONTH_LABEL = (month) => {
  const [year, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[Number(m) - 1] + " " + year.slice(2);
};

const money = (amount) =>
  withRial(Number(amount || 0).toLocaleString("en-GB"));

/** `countBy` answers with an object; the bars want rows. */
const toRows = (counts) =>
  Object.entries(counts).map(([label, count]) => ({ label, count }));

// With no cases yet, the range is today's.
const TODAY = new Date().toISOString().slice(0, 10);
const EARLIEST = clientCases.reduce(
  (min, k) => (k.receivedAt < min ? k.receivedAt : min),
  clientCases[0]?.receivedAt ?? TODAY
);
const LATEST = liveCases.reduce(
  (max, k) => (k.receivedAt > max ? k.receivedAt : max),
  liveCases[0]?.receivedAt ?? TODAY
);

/**
 * One client's dashboard.
 *
 * This and the firm's dashboard were the same idea told twice, so they are told
 * the same way now: the panels, the bars and the tiles are the components the
 * firm's dashboard uses, pointed at one client instead of all of them. Someone
 * who can read one can read the other without learning it again.
 *
 * Every breakdown is a bar against the busiest row rather than a grid of boxes.
 * Boxes make you read each number to find the big one; bars show it.
 */
export default function AnalyticsSection() {
  const [fromDate, setFromDate] = useState(EARLIEST);
  const [toDate, setToDate] = useState(LATEST);

  /* Lifetime, counted from the live cases only */
  const open = liveCases.filter(isOpen);
  const closed = liveCases.filter((k) => !isOpen(k));
  const inProgress = liveCases.filter(isInProgress);

  const typeCounts = countBy(liveCases, CASE_TYPES, (k) => k.type);
  // Counted across every live case, not just the open ones - a closed file
  // has a stage too, and it is the last of them.
  const stageCounts = countBy(liveCases, CASE_STAGES, (k) => k.stage);
  const levelCounts = countBy(open, CASE_LEVELS, (k) => k.level);

  /* Selected period. Left unmemoised on purpose - the compiler does it, and
     doing it by hand here stopped it from optimising the component at all. */
  const inPeriod = receivedBetween(liveCases, fromDate, toDate);
  const closedInPeriod = liveCases.filter(
    (k) => k.closedAt && k.closedAt >= fromDate && k.closedAt <= toDate
  ).length;
  const periodTypeCounts = countBy(inPeriod, CASE_TYPES, (k) => k.type);

  /* Cases received per period, for the cards */
  const periods = receivedPeriods().map((period) => ({
    ...period,
    count: receivedBetween(liveCases, period.from, period.to).length,
  }));

  /* Chart: cases received per month across the selected range */
  const months = {};
  for (const legalCase of inPeriod) {
    const month = legalCase.receivedAt.slice(0, 7);
    months[month] = (months[month] || 0) + 1;
  }
  const trend = Object.keys(months)
    .sort()
    .map((month) => ({ label: MONTH_LABEL(month), value: months[month] }));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Lifetime activity, each figure with what those files claim
          between them: the count says how busy the client is, the total
          says how much is riding on it. */}
      <SummaryStrip
        items={[
          {
            label: "Total Cases Received",
            count: liveCases.length,
            value: money(claimTotal(liveCases)),
          },
          {
            label: "Open Cases",
            count: open.length,
            value: money(claimTotal(open)),
          },
          {
            label: "Closed Cases",
            count: closed.length,
            value: money(claimTotal(closed)),
          },
          {
            label: "Cases in Progress",
            count: inProgress.length,
            value: money(claimTotal(inProgress)),
          },
          {
            // Struck off, so counted apart from everything above
            label: "Deleted from the System",
            tone: "text-muted-foreground",
            count: deletedCases.length,
            value: money(claimTotal(deletedCases)),
          },
        ]}
      />

      {/* Where the files stand: how far through, and before which court. */}
      <div className="form-grid form-grid-2">
        <SectionCard
          title="Cases by Stage"
          icon={Layers}
          action={
            <span className="text-xs text-muted-foreground">
              {liveCases.length} cases
            </span>
          }
        >
          <CountBars rows={toRows(stageCounts)} />
        </SectionCard>

        <SectionCard
          title="Case Level"
          icon={Scale}
          action={
            <span className="text-xs text-muted-foreground">
              {open.length} open
            </span>
          }
        >
          <CountBars rows={toRows(levelCounts)} />
        </SectionCard>
      </div>

      <SectionCard
        title="Cases by Type"
        icon={Briefcase}
        action={
          <span className="text-xs text-muted-foreground">
            {liveCases.length} cases
          </span>
        }
      >
        <CountBars rows={toRows(typeCounts)} />
      </SectionCard>

      {/* What has come in and gone out, over a period the reader chooses.
          The dates, the counts they produce and the shape of them belong in
          one panel: three separate cards made you scroll to see the effect
          of moving a date. */}
      <SectionCard
        title="Case Flow"
        icon={TrendingUp}
        action={
          <span className="text-xs text-muted-foreground">
            Last case received{" "}
            <span className="font-semibold text-primary">
              {formatDate(LATEST)}
            </span>
          </span>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="activityFrom">From</Label>
              <DateField
                id="activityFrom"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full sm:w-44"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activityTo">To</Label>
              <DateField
                id="activityTo"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full sm:w-44"
              />
            </div>
          </div>

          <div className="form-grid">
            <Tile label="Received in Period" value={inPeriod.length} />
            <Tile label="Closed in Period" value={closedInPeriod} />
            <Tile label="Open Cases" value={open.length} />
            <Tile
              label="Claimed in Period"
              value={money(claimTotal(inPeriod))}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">
              Cases by Type in Period
            </p>
            <CountBars rows={toRows(periodTypeCounts)} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">
              Cases Received Over Time
            </p>
            <BarTrendChart rows={trend} unit="case" />
          </div>
        </div>
      </SectionCard>

      {/* The standing periods, so the common questions need no dates typed */}
      <SectionCard title="Cases Received" icon={Inbox}>
        <div className="form-grid form-grid-3">
          {periods.map((period) => (
            <button
              key={period.label}
              type="button"
              onClick={() => {
                setFromDate(period.from);
                setToDate(period.to);
              }}
              className="rounded-lg border p-3 text-start transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <p className="text-sm font-medium">{period.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(period.from)} &ndash; {formatDate(period.to)}
              </p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {period.count}
              </p>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
