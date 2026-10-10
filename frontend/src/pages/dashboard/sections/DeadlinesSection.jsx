import { Timer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { urgencyOf } from "@/lib/deadlines";
import { SectionCard, Row, PriorityDot, EmptyState } from "@/components/shared/panels";
import { deadlines, appealDeadlines, daysUntil, formatDate } from "../dashboardData";

const BORDER = {
  High: "border-s-4 border-s-red-500",
  Medium: "border-s-4 border-s-amber-500",
  Information: "border-s-4 border-s-blue-500",
};

export function Deadlines() {
  const sorted = [...deadlines].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <SectionCard title="Deadlines" icon={Timer}>
      <div className="space-y-3">
        {sorted.length === 0 && <EmptyState>No deadlines recorded.</EmptyState>}
        {sorted.map((deadline) => {
          const days = daysUntil(deadline.dueDate);
          const urgency = urgencyOf(days);
          return (
            <Row
              key={deadline.id}
              to="/litigation"
              className={BORDER[urgency]}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {deadline.type} &ndash; {days} {days === 1 ? "day" : "days"}{" "}
                  remaining
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {deadline.caseNo} &middot; {deadline.client} &middot;{" "}
                  {formatDate(deadline.dueDate)}
                </p>
              </div>
              <PriorityDot level={urgency} />
            </Row>
          );
        })}
      </div>
    </SectionCard>
  );
}

/**
 * Appeal deadlines are called out separately because missing one is final.
 * The nearest deadline is rendered loudest.
 */
export function AppealDeadlineAlerts() {
  if (appealDeadlines.length === 0) return null;

  return (
    <SectionCard title="Appeal Deadline Alerts" icon={AlertTriangle}>
      <div className="space-y-3">
        {appealDeadlines.map((deadline) => {
          const days = daysUntil(deadline.dueDate);
          const urgency = urgencyOf(days);
          return (
            <Row
              key={deadline.id}
              to="/litigation"
              className={cn(
                BORDER[urgency],
                urgency === "High" && "bg-red-50 hover:bg-red-100"
              )}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-sm",
                    urgency === "High" ? "font-bold text-red-700" : "font-medium"
                  )}
                >
                  Case {deadline.caseNo} &ndash; Appeal Deadline &ndash; {days}{" "}
                  {days === 1 ? "Day" : "Days"} Remaining
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {deadline.client} &middot; {deadline.lawyer} &middot; due{" "}
                  {formatDate(deadline.dueDate)}
                </p>
              </div>
              <PriorityDot level={urgency} />
            </Row>
          );
        })}
      </div>
    </SectionCard>
  );
}
