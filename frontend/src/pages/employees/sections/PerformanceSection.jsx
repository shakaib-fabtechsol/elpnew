import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tile } from "@/components/shared/panels";
import BarTrendChart from "@/components/shared/BarTrendChart";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  PERIODS,
  recordedDays,
  windowsFor,
  between,
  summarise,
  change,
  formatDuration,
  hours,
  monthLabel,
  isoDate,
  today,
} from "../activityData";

/** What the trend chart can be pointed at, and how each reads. */
const TREND_METRICS = [
  { key: "hours", label: "Working Hours", unit: "hour", of: (t) => Number(hours(t.officeMinutes)) },
  { key: "memos", label: "Memos & Pleadings", unit: "document", of: (t) => t.memos },
  { key: "court", label: "Court Sessions", unit: "session", of: (t) => t.court },
  { key: "client", label: "Client Meetings", unit: "meeting", of: (t) => t.client },
  { key: "expert", label: "Expert Meetings", unit: "meeting", of: (t) => t.expert },
  { key: "score", label: "Performance Score", unit: "point", of: (t) => t.score },
];

/**
 * The rows of the summary table.
 *
 * `format` decides how the figure reads, because a count and a length of time
 * cannot be printed the same way, and `describe` says what the number is for -
 * a metric nobody can explain is not worth reporting.
 */
const METRICS = [
  {
    label: "Average Daily Working Hours",
    of: (t) => t.avgDailyMinutes,
    format: (v) => hours(v) + " h",
    describe: "Office time divided by the days worked",
  },
  {
    label: "Total Office Working Hours",
    of: (t) => t.officeMinutes,
    format: formatDuration,
    describe: "Time between check-in and check-out",
  },
  {
    label: "System Active Time",
    of: (t) => t.activeMinutes,
    format: formatDuration,
    describe: "Time actually working in YANDS, idle time excluded",
  },
  {
    label: "Memos & Pleadings Written",
    of: (t) => t.memos,
    format: (v) => v,
    describe: "Legal documents completed",
  },
  {
    label: "Court Sessions Attended",
    of: (t) => t.court,
    format: (v) => v,
    describe: "Hearings attended in person",
  },
  {
    label: "Client Meetings",
    of: (t) => t.client,
    format: (v) => v,
    describe: "Meetings held with clients",
  },
  {
    label: "Expert Meetings",
    of: (t) => t.expert,
    format: (v) => v,
    describe: "Meetings held with experts",
  },
  {
    label: "Time in Court Sessions",
    of: (t) => t.courtMinutes,
    format: formatDuration,
    describe: "Time booked against hearings",
  },
  {
    label: "Time in Client Meetings",
    of: (t) => t.clientMinutes,
    format: formatDuration,
    describe: "Time booked against client meetings",
  },
  {
    label: "Time in Expert Meetings",
    of: (t) => t.expertMinutes,
    format: formatDuration,
    describe: "Time booked against expert meetings",
  },
  {
    label: "Time on Other Work",
    of: (t) => t.otherMinutes,
    format: formatDuration,
    describe: "Recorded work outside the named categories",
  },
  {
    label: "Performance Score",
    of: (t) => t.score,
    format: (v) => v + " / 100",
    describe: "Engagement, output, hearings and meetings combined",
  },
];

/** How the working time divided up, and the colour each part is drawn in. */
const DISTRIBUTION = [
  { label: "Active in YANDS", of: (t) => t.activeMinutes, colour: "bg-primary" },
  { label: "Court Sessions", of: (t) => t.courtMinutes, colour: "bg-blue-500" },
  { label: "Client Meetings", of: (t) => t.clientMinutes, colour: "bg-green-600" },
  { label: "Expert Meetings", of: (t) => t.expertMinutes, colour: "bg-amber-500" },
  { label: "Other Work", of: (t) => t.otherMinutes, colour: "bg-slate-400" },
];

/** A change, drawn so its direction is read before its size. */
function Change({ difference, format }) {
  if (!difference) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3.5 w-3.5" />
        No change
      </span>
    );
  }
  const up = difference > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        up ? "text-green-600" : "text-red-600"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {up ? "+" : "-"}
      {format(Math.abs(difference))}
    </span>
  );
}

/** The same movement as a proportion, for metrics of different sizes. */
function Percent({ difference, percent }) {
  if (percent === null) {
    return <span className="text-muted-foreground">-</span>;
  }
  if (!difference) return <span className="text-muted-foreground">0.0%</span>;
  const up = difference > 0;
  return (
    <span className={cn("font-medium", up ? "text-green-600" : "text-red-600")}>
      {up ? "+" : "-"}
      {Math.abs(percent).toFixed(1)}%
    </span>
  );
}

/**
 * What the firm can tell about one employee's work.
 *
 * Nothing on this page is entered by hand - every figure is read off the days
 * already recorded. It reports on the employee whose file is open and on nobody
 * else: the only comparison drawn is against that same employee's own earlier
 * work, which is what makes it a measure of progress rather than a ranking.
 */
export default function PerformanceSection() {
  const [periodKey, setPeriodKey] = useState("month");
  const [metricKey, setMetricKey] = useState("hours");

  const period = PERIODS.find((p) => p.key === periodKey) || PERIODS[0];
  const days = recordedDays();
  const end = today();
  const { currentFrom, previousFrom } = windowsFor(period.months);

  const current = summarise(between(days, currentFrom, end));
  const previous = summarise(between(days, previousFrom, currentFrom));

  const metric = TREND_METRICS.find((m) => m.key === metricKey) || TREND_METRICS[0];

  // Twelve months of the chosen measure, whatever window the table is showing -
  // a trend needs more than the two periods being compared.
  const trend = Array.from({ length: 12 }, (_, i) => {
    const from = new Date();
    from.setMonth(from.getMonth() - (11 - i), 1);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    const month = between(days, isoDate(from), isoDate(to));
    return {
      label: monthLabel(isoDate(from)),
      value: month.length ? Math.round(metric.of(summarise(month))) : 0,
    };
  });

  const distributionTotal =
    DISTRIBUTION.reduce((total, part) => total + part.of(current), 0) || 1;

  return (
    <div className="space-y-6">
      {/* What is being reported on */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <p className="font-semibold text-primary">Performance Statistics</p>
        <Select value={periodKey} onValueChange={setPeriodKey}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* The headline figures */}
      <div className="form-grid">
        <Tile
          label="Average Daily Working Hours"
          value={hours(current.avgDailyMinutes) + " h"}
        />
        <Tile
          label="Total Office Working Hours"
          value={formatDuration(current.officeMinutes)}
        />
        <Tile
          label="System Active Time"
          value={formatDuration(current.activeMinutes)}
          tone="info"
        />
        <Tile label="Performance Score" value={current.score + " / 100"} tone="good" />
        <Tile label="Memos & Pleadings Written" value={current.memos} />
        <Tile label="Court Sessions Attended" value={current.court} />
        <Tile label="Client Meetings" value={current.client} />
        <Tile label="Expert Meetings" value={current.expert} />
      </div>

      {/* How it moved */}
      <div className="rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-primary">Performance Trend</p>
          <Select value={metricKey} onValueChange={setMetricKey}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TREND_METRICS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <BarTrendChart rows={trend} unit={metric.unit} />
      </div>

      {/* Where the time went */}
      <div className="rounded-lg border p-4">
        <p className="mb-4 font-semibold text-primary">Work Time Distribution</p>

        <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
          {DISTRIBUTION.map((part) => (
            <div
              key={part.label}
              className={part.colour}
              style={{ width: (part.of(current) / distributionTotal) * 100 + "%" }}
              title={part.label + " - " + formatDuration(part.of(current))}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {DISTRIBUTION.map((part) => (
            <div key={part.label} className="flex items-start gap-2 text-sm">
              <span
                aria-hidden="true"
                className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", part.colour)}
              />
              <span>
                <span className="block">{part.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDuration(part.of(current))} (
                  {Math.round((part.of(current) / distributionTotal) * 100)}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* The whole picture, side by side */}
      <div className="rounded-lg border">
        <p className="border-b p-4 font-semibold text-primary">
          Performance Summary
        </p>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[860px] border text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-start text-xs text-muted-foreground">
                <th className="p-3 font-semibold">Metric</th>
                <th className="p-3 font-semibold">Current Period</th>
                <th className="p-3 font-semibold">Previous Period</th>
                <th className="p-3 font-semibold">Change</th>
                <th className="p-3 font-semibold">Change %</th>
                <th className="p-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((row) => {
                const now = row.of(current);
                const before = row.of(previous);
                const moved = change(now, before);
                return (
                  <tr
                    key={row.label}
                    className="border-b transition-colors last:border-0 hover:bg-primary/10"
                  >
                    <td className="p-3 font-medium">{row.label}</td>
                    <td className="whitespace-nowrap p-3">{row.format(now)}</td>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {row.format(before)}
                    </td>
                    <td className="whitespace-nowrap p-3">
                      <Change
                        difference={moved.difference}
                        format={row.format}
                      />
                    </td>
                    <td className="whitespace-nowrap p-3">
                      <Percent difference={moved.difference} percent={moved.percent} />
                    </td>
                    <td className="p-3 text-muted-foreground">{row.describe}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
