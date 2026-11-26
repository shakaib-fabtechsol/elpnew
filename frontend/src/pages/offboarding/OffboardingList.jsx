import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import FilterPanel from "@/components/shared/FilterPanel";
import { filterChips, withoutChip } from "@/lib/filterChips";
import { StatCard, StatCards } from "@/components/shared/StatCard";
import { RecordLink } from "@/components/shared/RecordTable";
import { CheckCircle2, Clock3, Hourglass, LogOut, ListChecks, Tag, UserX } from "lucide-react";
import { can } from "@/lib/access";
import { offboardingApi, OFFBOARDING_STATUSES, OFFBOARDING_TYPES } from "@/lib/api/modules/offboarding";
import { formatDate } from "@/lib/circulars/context";
import StartOffboardingDialog from "./StartOffboardingDialog";
import { OffboardingStatus } from "./offboardingParts";

/**
 * Employee Offboarding - every End of Service case, open ones first.
 *
 * The cards count the cases that need someone: the ones under way, the ones
 * waiting for a decision, the people still serving their notice, and the
 * cases closed this month. Pressing a card narrows the list to it.
 */

const FILTER_FIELDS = [
  {
    key: "status",
    label: "Status",
    icon: ListChecks,
    type: "checkbox",
    options: OFFBOARDING_STATUSES.map((s) => ({ value: s, label: s })),
  },
  {
    key: "type",
    label: "Type",
    icon: Tag,
    type: "checkbox",
    options: OFFBOARDING_TYPES.map((s) => ({ value: s, label: s })),
  },
];

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function OffboardingList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [state, setState] = useState("loading");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [starting, setStarting] = useState(false);

  // Loading is the state the page opens in; a retry says so again.
  const load = useCallback(async (retrying) => {
    if (retrying === true) setState("loading");
    try {
      setCases(await offboardingApi.list());
      setState("ready");
    } catch {
      setState("failed");
    }
  }, []);

  useEffect(() => {
    let live = true;
    offboardingApi.list().then(
      (rows) => {
        if (!live) return;
        setCases(rows);
        setState("ready");
      },
      () => live && setState("failed")
    );
    return () => {
      live = false;
    };
  }, []);

  const narrow = (next) => {
    setFilters(next);
    setPage(1);
  };

  const inProgress = cases.filter((c) => c.status === "In Progress");
  const pending = cases.filter((c) => c.status === "Pending Approval");
  const onNotice = inProgress.filter((c) => c.noticeDaysRemaining > 0);
  const completedThisMonth = cases.filter(
    (c) => c.status === "Completed" && String(c.completedAt).slice(0, 7) === thisMonth()
  );
  const active = [...pending, ...inProgress];

  const only = (statuses) =>
    narrow(
      JSON.stringify(filters.status) === JSON.stringify(statuses) ? {} : { status: statuses }
    );
  const isOnly = (statuses) => JSON.stringify(filters.status) === JSON.stringify(statuses);

  const shown = cases.filter(
    (c) =>
      (!filters.status?.length || filters.status.includes(c.status)) &&
      (!filters.type?.length || filters.type.includes(c.type)) &&
      (!filters.notice || c.noticeDaysRemaining > 0)
  );

  const columns = [
    {
      key: "caseNo",
      header: "Case No.",
      width: "11%",
      hideable: false,
      sort: "text",
      render: (value, row) => (
        <RecordLink onClick={() => navigate("/offboarding/" + row.id)}>{value}</RecordLink>
      ),
    },
    {
      key: "employeeName",
      header: "Employee",
      width: "20%",
      sort: "text",
      exportValue: (row) => row.employee?.name || row.employeeName,
      render: (value, row) => (
        <div className="min-w-0">
          <p className="font-semibold text-primary">{value}</p>
          <p className="text-xs text-muted-foreground">
            {[row.employee?.empNo, row.employee?.occupation].filter(Boolean).join(" · ")}
          </p>
        </div>
      ),
    },
    { key: "type", header: "Type", width: "12%", sort: "text" },
    { key: "reason", header: "Reason", width: "14%", sort: "text", hidden: true },
    {
      key: "lastWorkingDate",
      header: "Last Working Day",
      width: "13%",
      sort: "date",
      exportValue: (row) => formatDate(row.lastWorkingDate),
      render: (value, row) => (
        <div>
          <p className="numeric-value">{formatDate(value)}</p>
          {row.status === "In Progress" && (
            <p className="text-xs text-muted-foreground">
              {row.noticeDaysRemaining > 0 ? row.noticeDaysRemaining + " days of notice left" : "Notice ended"}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "progress",
      header: "Clearance",
      width: "16%",
      sort: "number",
      sortValue: (row) => (row.progress.total ? row.progress.cleared / row.progress.total : 0),
      exportValue: (row) => row.progress.cleared + " / " + row.progress.total,
      render: (value) => {
        const pct = value.total ? Math.round((value.cleared / value.total) * 100) : 0;
        return (
          <div className="min-w-[120px] space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {value.cleared} / {value.total} items
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: pct + "%" }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "14%",
      sort: "status",
      render: (value) => <OffboardingStatus status={value} />,
    },
  ];

  const chips = filterChips(FILTER_FIELDS, filters);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={LogOut}
        title="Employee Offboarding"
        note="End of service: resignations, terminations, clearance and final settlement"
        onAdd={can("offboarding.create") ? () => setStarting(true) : undefined}
        addLabel="Start Offboarding"
      />

      <StatCards count={4}>
        <StatCard
          icon={UserX}
          tone="blue"
          label="Active Cases"
          value={active.length}
          status={state}
          note={{ text: inProgress.length + " in clearance", icon: "dot" }}
          onClick={() => only(["Pending Approval", "In Progress"])}
          active={isOnly(["Pending Approval", "In Progress"])}
        />
        <StatCard
          icon={Hourglass}
          tone="amber"
          label="Pending Approval"
          value={pending.length}
          status={state}
          note={{ text: pending.length ? "Waiting for a decision" : "Nothing waiting", icon: "dot" }}
          onClick={() => only(["Pending Approval"])}
          active={isOnly(["Pending Approval"])}
        />
        <StatCard
          icon={Clock3}
          tone="purple"
          label="Notice Period"
          value={onNotice.length}
          status={state}
          note={{ text: "Still serving notice", icon: "dot" }}
          onClick={() => narrow(filters.notice ? withoutChip(filters, { field: "notice" }) : { status: ["In Progress"], notice: true })}
          active={Boolean(filters.notice)}
        />
        <StatCard
          icon={CheckCircle2}
          tone="green"
          label="Completed This Month"
          value={completedThisMonth.length}
          status={state}
          note={{ text: cases.filter((c) => c.status === "Completed").length + " completed in all", icon: "trend" }}
          onClick={() => only(["Completed"])}
          active={isOnly(["Completed"])}
        />
      </StatCards>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={shown}
            keepOrder
            isLoading={state === "loading"}
            loadError={state === "failed"}
            onRetry={() => load(true)}
            itemLabel="offboarding cases"
            exportFileName="offboarding-cases.csv"
            searchPlaceholder="Search by case no., employee, type or reason..."
            enableColumnSearch={false}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            appliedFilters={[
              ...chips,
              ...(filters.notice ? [{ key: "notice", field: "notice", label: "Notice", value: "Still serving" }] : []),
            ]}
            onRemoveFilter={(chip) => narrow(withoutChip(filters, chip))}
            onClearFilters={() => narrow({})}
            filters={<FilterPanel fields={FILTER_FIELDS} value={filters} onChange={narrow} />}
            onRowClick={(row) => navigate("/offboarding/" + row.id)}
          />
        </CardContent>
      </Card>

      <StartOffboardingDialog
        open={starting}
        onOpenChange={setStarting}
        onStarted={(made) => navigate("/offboarding/" + made.id)}
      />
    </div>
  );
}
