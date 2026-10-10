import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  Scale,
  Users,
  Inbox,
  FilePlus,
  Receipt,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canView, ROLES, SECTION_KEYS as K } from "@/lib/permissions";

import { StatCard } from "@/components/shared/panels";
import {
  summaryStats,
  bottomSummary,
  money,
  CURRENT_USER,
} from "./dashboard/dashboardData";
import { DASHBOARD_VIEWS } from "./dashboard/dashboardViews";

import { QuickSearch, QuickActions, TodaysBrief } from "./dashboard/sections/TopSections";
import { TodaysHearings, UpcomingHearings } from "./dashboard/sections/HearingsSections";
import { Deadlines, AppealDeadlineAlerts } from "./dashboard/sections/DeadlinesSection";
import { MyTasks, OverdueTasks } from "./dashboard/sections/TasksSections";
import {
  UrgentActions,
  CasesRequiringAttention,
  MissingDocuments,
} from "./dashboard/sections/AlertsSections";
import {
  CourtNotifications,
  RecentCaseUpdates,
  RecentJudgments,
} from "./dashboard/sections/CourtSections";
import { CasesByStage } from "./dashboard/sections/CasesByStageSection";
import { ExecutionFollowUp } from "./dashboard/sections/ExecutionSection";
import { FinancialSnapshot, UnbilledCases } from "./dashboard/sections/FinancialSections";
import {
  CasesReceivedByClient,
  CaseFlowTrend,
  StoppedClients,
  TopClients,
  NewClients,
} from "./dashboard/sections/CaseFlowSections";
import { TeamWorkload, ClientFollowUp } from "./dashboard/sections/TeamAndClientSections";

/** Two-column row that collapses to one column, skipping any hidden child. */
function Pair({ children }) {
  const visible = children.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <div className="form-grid form-grid-2">{visible}</div>
  );
}

export default function Dashboard() {
  // Auth is not wired up yet, so the role is switchable here to make the
  // permission rules visible. It becomes the signed-in user's role later.
  const [role, setRole] = useState(CURRENT_USER.role);
  const [view, setView] = useState("general");

  const can = (key) => canView(role, key);

  // A panel the role may not see is not offered in the menu either, and the
  // menu falls back to General rather than showing an empty page.
  const views = DASHBOARD_VIEWS.filter(
    (option) => !option.permission || can(option.permission)
  );
  const current = views.find((option) => option.key === view) || views[0];

  /** One subject on its own, for every entry in the menu but General. */
  const only = {
    todaysHearings: <TodaysHearings />,
    upcomingHearings: <UpcomingHearings />,
    deadlines: <Deadlines />,
    appealAlerts: <AppealDeadlineAlerts />,
    tasks: <MyTasks role={role} currentUser={CURRENT_USER.name} />,
    overdueTasks: <OverdueTasks />,
    urgentActions: <UrgentActions />,
    casesAttention: <CasesRequiringAttention />,
    missingDocuments: <MissingDocuments />,
    recentUpdates: <RecentCaseUpdates />,
    casesByStage: <CasesByStage />,
    clientFollowUp: <ClientFollowUp />,
    execution: <ExecutionFollowUp />,
    financial: <FinancialSnapshot />,
    unbilled: <UnbilledCases />,
    casesReceived: <CasesReceivedByClient />,
    caseFlowTrend: <CaseFlowTrend />,
    topClients: <TopClients />,
    stoppedClients: <StoppedClients />,
    newClients: <NewClients />,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary p-2 sm:p-3">
            <LayoutDashboard className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">Dashboard</h1>
            <p className="text-xs text-primary/75 sm:text-sm">
              Welcome back, {CURRENT_USER.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Viewing as</span>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-9 w-48 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col items-start gap-4 sm:gap-6 lg:flex-row">
        {/* Which part of the dashboard is being looked at */}
        <Card className="w-full lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto">
          <CardContent className="p-3">
            <p className="mb-2 border-b px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dashboard Options
            </p>
            <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
              {views.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setView(option.key)}
                    className={cn(
                      "flex items-center gap-2.5 text-nowrap rounded-md px-3 py-2 text-start text-sm font-medium transition-colors lg:text-wrap",
                      current.key === option.key
                        ? "bg-primary text-primary-foreground"
                        : "text-primary hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {option.label}
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* min-w-0 or the column will not shrink: a flex child sizes itself to
            its widest content by default, so one wide chart in here would
            stretch the whole page and push the menu off screen. */}
        <div className="w-full min-w-0 flex-1 space-y-4 sm:space-y-6">
          {current.key === "general" ? (
            <>
              {/* Quick search and quick actions */}
              <div className="space-y-3">
                <QuickSearch />
                {can(K.quickActions) && <QuickActions />}
              </div>

              {can(K.brief) && <TodaysBrief currentUser={CURRENT_USER.name} />}

              {/* Top summary cards */}
              {can(K.summary) && (
                <div className="form-grid form-grid-3">
                  <StatCard label="Active Cases" value={summaryStats.activeCases.value} previous={summaryStats.activeCases.previous} to={summaryStats.activeCases.to} icon={Scale} />
                  <StatCard label="Total Clients" value={summaryStats.totalClients.value} previous={summaryStats.totalClients.previous} to={summaryStats.totalClients.to} icon={Users} />
                  <StatCard label="Cases Received This Month" value={summaryStats.casesReceivedThisMonth.value} previous={summaryStats.casesReceivedThisMonth.previous} to={summaryStats.casesReceivedThisMonth.to} icon={Inbox} />
                  <StatCard label="New Cases This Month" value={summaryStats.newCasesThisMonth.value} previous={summaryStats.newCasesThisMonth.previous} to={summaryStats.newCasesThisMonth.to} icon={FilePlus} />
                  <StatCard label="Pending Invoices" value={summaryStats.pendingInvoices.value} previous={summaryStats.pendingInvoices.previous} to={summaryStats.pendingInvoices.to} icon={Receipt} />
                  <StatCard label="Outstanding Amount" value={summaryStats.outstandingAmount.value} previous={summaryStats.outstandingAmount.previous} to={summaryStats.outstandingAmount.to} icon={Wallet} format={money} />
                </div>
              )}

              <Pair>
                {can(K.todaysHearings) && <TodaysHearings key="today" />}
                {can(K.upcomingHearings) && <UpcomingHearings key="upcoming" />}
              </Pair>

              <Pair>
                {can(K.deadlines) && <Deadlines key="deadlines" />}
                {can(K.deadlines) && <AppealDeadlineAlerts key="appeals" />}
              </Pair>

              <Pair>
                {can(K.myTasks) && <MyTasks key="tasks" role={role} currentUser={CURRENT_USER.name} />}
                {can(K.overdueTasks) && <OverdueTasks key="overdue" />}
              </Pair>

              <Pair>
                {can(K.urgentActions) && <UrgentActions key="urgent" />}
                {can(K.casesAttention) && <CasesRequiringAttention key="attention" />}
              </Pair>

              <Pair>
                {can(K.missingDocuments) && <MissingDocuments key="docs" />}
                {can(K.courtNotifications) && <CourtNotifications key="notifications" />}
              </Pair>

              <Pair>
                {can(K.recentUpdates) && <RecentCaseUpdates key="updates" />}
                {can(K.recentJudgments) && <RecentJudgments key="judgments" />}
              </Pair>

              <Pair>
                {can(K.casesByStage) && <CasesByStage key="stages" />}
                {can(K.clientFollowUp) && <ClientFollowUp key="clientFollowUp" />}
              </Pair>

              {can(K.execution) && <ExecutionFollowUp />}

              {can(K.financial) && <FinancialSnapshot />}
              {can(K.unbilled) && <UnbilledCases />}

              {/* Case flow - management view of where the work is coming from */}
              {can(K.caseFlow) && (
                <>
                  <CasesReceivedByClient />
                  <Pair>
                    <CaseFlowTrend key="trend" />
                    <TopClients key="top" />
                  </Pair>
                  <Pair>
                    <StoppedClients key="stopped" />
                    <NewClients key="new" />
                  </Pair>
                </>
              )}

              {can(K.teamWorkload) && <TeamWorkload />}

              {/* Bottom summary */}
              {can(K.bottomSummary) && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard label="Hearings This Month" value={bottomSummary.hearingsThisMonth.value} to={bottomSummary.hearingsThisMonth.to} />
                  <StatCard label="Judgments Issued" value={bottomSummary.judgmentsIssued.value} to={bottomSummary.judgmentsIssued.to} />
                  <StatCard label="Open Execution Files" value={bottomSummary.openExecutionFiles.value} to={bottomSummary.openExecutionFiles.to} />
                  <StatCard label="Overdue Tasks" value={bottomSummary.overdueTasks.value} to={bottomSummary.overdueTasks.to} />
                </div>
              )}
            </>
          ) : (
            only[current.key]
          )}
        </div>
      </div>
    </div>
  );
}
