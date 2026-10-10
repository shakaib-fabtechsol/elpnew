import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BarTrendChart from "@/components/shared/BarTrendChart";
import { TrendingUp, TrendingDown, Activity, UserMinus, Trophy, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard, Row, EmptyState } from "@/components/shared/panels";
import {
  clientCaseFlow,
  CASE_FLOW_PERIODS,
  caseFlowTrend,
  caseFlowTrendWeekly,
  newClients,
  changePercent,
  formatDate,
  daysUntil,
  dayOffset,
} from "../dashboardData";

import DateField from "@/components/shared/DateField";
const MONTH_LABEL = (month) => {
  const [year, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[Number(m) - 1] + " " + year.slice(2);
};

function ChangeBadge({ change }) {
  if (change.isNew) return <Badge variant="secondary">New Flow</Badge>;
  if (change.value === null) {
    return <span className="text-xs text-muted-foreground">&ndash;</span>;
  }
  const up = change.value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        change.value === 0
          ? "text-muted-foreground"
          : up
          ? "text-green-600"
          : "text-red-600"
      )}
    >
      {change.value !== 0 && <Icon className="h-3 w-3" />}
      {change.value > 0 ? "+" : ""}
      {change.value}%
    </span>
  );
}

/**
 * Cases received per client for a chosen period, with the movement against the
 * comparable previous period. Requirements 20, 21 and 23.
 */
export function CasesReceivedByClient() {
  const navigate = useNavigate();
  const [periodKey, setPeriodKey] = useState("thisMonth");
  const [customFrom, setCustomFrom] = useState(dayOffset(-30));
  const [customTo, setCustomTo] = useState(dayOffset(0));

  const period = CASE_FLOW_PERIODS.find((p) => p.key === periodKey);

  const rows = useMemo(
    () =>
      clientCaseFlow
        .map((client) => {
          const current = client[period.field];
          const previous = period.previousField
            ? client[period.previousField]
            : undefined;
          return {
            ...client,
            current,
            previous,
            change:
              previous === undefined
                ? { isNew: false, value: null }
                : changePercent(current, previous),
          };
        })
        .sort((a, b) => b.current - a.current),
    [period]
  );

  // Flow alerts: a sharp move either way, or a client that has gone quiet.
  const alerts = rows.flatMap((row) => {
    const list = [];
    const daysSinceLastCase = Math.abs(daysUntil(row.lastCaseAt));
    if (daysSinceLastCase >= 30) {
      list.push({
        client: row.client,
        tone: "high",
        message:
          "No new cases received from this client during the last " +
          daysSinceLastCase +
          " days",
      });
    }
    if (row.change.value !== null && row.change.value <= -30) {
      list.push({
        client: row.client,
        tone: "high",
        message:
          "Case flow decreased by " +
          Math.abs(row.change.value) +
          "% compared with the previous period",
      });
    }
    if (row.change.value !== null && row.change.value >= 40) {
      list.push({
        client: row.client,
        tone: "good",
        message: "Case flow increased by " + row.change.value + "%",
      });
    }
    return list;
  });

  return (
    <SectionCard
      title="Cases Received by Client"
      icon={Activity}
      action={
        <Select value={periodKey} onValueChange={setPeriodKey}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CASE_FLOW_PERIODS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {periodKey === "custom" && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="flowFrom" className="text-xs">From</Label>
            <DateField
              id="flowFrom"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 w-full sm:w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="flowTo" className="text-xs">To</Label>
            <DateField
              id="flowTo"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 w-full sm:w-40"
            />
          </div>
        </div>
      )}

      {/* Flow alerts, above the table so a drop is not missed */}
      {alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={alert.client + i}
              className={cn(
                "rounded-md border-s-4 px-3 py-2 text-xs",
                alert.tone === "high"
                  ? "border-s-red-500 bg-red-50 text-red-800"
                  : "border-s-green-600 bg-green-50 text-green-800"
              )}
            >
              <span className="font-semibold">{alert.client}:</span>{" "}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border text-sm">
          <thead>
            <tr className="border-b bg-secondary/60 text-start text-primary">
              <th className="p-3 font-semibold">Client</th>
              <th className="p-3 text-end font-semibold">Selected Period</th>
              <th className="p-3 text-end font-semibold">This Month</th>
              <th className="p-3 text-end font-semibold">Last Month</th>
              <th className="p-3 text-end font-semibold">This Year</th>
              <th className="p-3 text-end font-semibold">Change</th>
              <th className="p-3 text-end font-semibold">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.client}
                onClick={() => navigate("/litigation")}
                className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
              >
                <td className="p-3 font-medium">{row.client}</td>
                <td className="p-3 text-end font-semibold">{row.current}</td>
                <td className="p-3 text-end text-muted-foreground">{row.thisMonth}</td>
                <td className="p-3 text-end text-muted-foreground">{row.lastMonth}</td>
                <td className="p-3 text-end text-muted-foreground">{row.thisYear}</td>
                <td className="p-3 text-end">
                  <ChangeBadge change={row.change} />
                </td>
                <td className="p-3 text-end">{row.activeCases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/** Requirement 22 - is the office's case flow rising or falling? */
export function CaseFlowTrend() {
  const [view, setView] = useState("monthly");

  const rows =
    view === "weekly"
      ? caseFlowTrendWeekly.map((r) => ({ label: r.month, value: r.received }))
      : caseFlowTrend.map((r) => ({ label: MONTH_LABEL(r.month), value: r.received }));

  return (
    <SectionCard
      title="Case Flow Trend"
      icon={TrendingUp}
      action={
        <Select value={view} onValueChange={setView}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <BarTrendChart rows={rows} unit="case" />
    </SectionCard>
  );
}

/** Requirement 24 - clients who used to send work and have gone quiet. */
export function StoppedClients() {
  const [threshold, setThreshold] = useState("30");

  const rows = clientCaseFlow
    .map((client) => ({
      ...client,
      daysSince: Math.abs(daysUntil(client.lastCaseAt)),
    }))
    .filter((client) => client.daysSince >= Number(threshold))
    .sort((a, b) => b.daysSince - a.daysSince);

  return (
    <SectionCard
      title="Clients Who Stopped Sending Cases"
      icon={UserMinus}
      action={
        <Select value={threshold} onValueChange={setThreshold}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-3">
        {rows.length === 0 && (
          <EmptyState>
            Every client has sent work within the last {threshold} days.
          </EmptyState>
        )}
        {rows.map((client) => (
          <Row key={client.client} to="/clients">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{client.client}</p>
              <p className="truncate text-xs text-muted-foreground">
                Last case {formatDate(client.lastCaseAt)} &middot;{" "}
                {client.thisYear} cases this year &middot; {client.activeCases}{" "}
                active
              </p>
            </div>
            <span className="w-20 shrink-0 text-end text-xs font-semibold text-red-600">
              {client.daysSince} days
            </span>
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}

/** Requirement 25 */
export function TopClients() {
  const [rank, setRank] = useState("thisMonth");

  const options = [
    { key: "thisMonth", label: "This Month" },
    { key: "last3Months", label: "Last 3 Months" },
    { key: "last6Months", label: "Last 6 Months" },
    { key: "thisYear", label: "This Year" },
  ];

  const rows = [...clientCaseFlow]
    .sort((a, b) => b[rank] - a[rank])
    .filter((c) => c[rank] > 0)
    .slice(0, 5);

  return (
    <SectionCard
      title="Top Clients by Case Volume"
      icon={Trophy}
      action={
        <Select value={rank} onValueChange={setRank}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-3">
        {rows.length === 0 && <EmptyState>No cases in this period.</EmptyState>}
        {rows.map((client, i) => (
          <Row key={client.client} to="/clients">
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-5 shrink-0 text-sm font-bold text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{client.client}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {client.activeCases} active cases
                </p>
              </div>
            </div>
            <span className="w-20 shrink-0 text-end text-sm font-semibold">
              {client[rank]} cases
            </span>
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}

/** Requirement 26 */
export function NewClients() {
  return (
    <SectionCard
      title="New Clients"
      icon={UserPlus}
      action={<Badge variant="secondary">{newClients.length} this period</Badge>}
    >
      <div className="space-y-3">
        {newClients.length === 0 && (
          <EmptyState>No first-time clients in this period.</EmptyState>
        )}
        {newClients.map((client) => (
          <Row key={client.client} to="/clients">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{client.client}</p>
              <p className="truncate text-xs text-muted-foreground">
                First case {formatDate(client.firstCaseAt)}
              </p>
            </div>
            <span className="w-20 shrink-0 text-end text-sm font-semibold">
              {client.cases} cases
            </span>
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}
