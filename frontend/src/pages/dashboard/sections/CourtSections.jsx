import { Badge } from "@/components/ui/badge";
import { Bell, History, Scale } from "lucide-react";
import { SectionCard, Row, EmptyState } from "@/components/shared/panels";
import {
  courtNotifications,
  recentCaseUpdates,
  recentJudgments,
  formatDate,
  daysUntil,
} from "../dashboardData";
import { urgencyOf } from "@/lib/deadlines";

export function CourtNotifications() {
  return (
    <SectionCard title="New Court Notifications" icon={Bell}>
      <div className="space-y-3">
        {courtNotifications.length === 0 && (
          <EmptyState>No new notifications from the courts.</EmptyState>
        )}
        {courtNotifications.map((item) => (
          <Row key={item.id} to="/litigation">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.summary}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatDate(item.date)} &middot; {item.caseNo} &middot;{" "}
                {item.court}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Action: {item.requiredAction} &middot; {item.assignee}
              </p>
            </div>
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}

export function RecentCaseUpdates() {
  return (
    <SectionCard title="Recent Case Updates" icon={History}>
      <div className="space-y-3">
        {recentCaseUpdates.length === 0 && (
          <EmptyState>No case activity recorded yet.</EmptyState>
        )}
        {recentCaseUpdates.map((item) => (
          <Row key={item.id} to="/litigation">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.update}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.caseNo} &middot; {item.client} &middot; {item.by}
              </p>
            </div>
            <span className="w-24 shrink-0 text-end text-xs text-muted-foreground">
              {item.at}
            </span>
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}

export function RecentJudgments() {
  return (
    <SectionCard title="Recent Judgments" icon={Scale}>
      <div className="space-y-3">
        {recentJudgments.length === 0 && (
          <EmptyState>No judgments issued recently.</EmptyState>
        )}
        {recentJudgments.map((item) => {
          const days = item.appealDeadline ? daysUntil(item.appealDeadline) : null;
          return (
            <Row key={item.id} to="/litigation">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.caseNo} &middot; {item.client}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(item.date)} &middot; {item.result} &middot;{" "}
                  {item.lawyer}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Next: {item.nextAction}
                </p>
              </div>
              {days !== null && (
                <Badge
                  variant={
                    urgencyOf(days) === "High"
                      ? "destructive"
                      : urgencyOf(days) === "Medium"
                      ? "warning"
                      : "secondary"
                  }
                  className="shrink-0"
                >
                  Appeal: {days}d
                </Badge>
              )}
            </Row>
          );
        })}
      </div>
    </SectionCard>
  );
}
