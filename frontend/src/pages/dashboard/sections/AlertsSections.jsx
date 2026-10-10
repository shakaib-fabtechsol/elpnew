import { Zap, AlertCircle, FileWarning } from "lucide-react";
import { SectionCard, Row, PriorityDot, EmptyState } from "@/components/shared/panels";
import {
  urgentActions,
  casesRequiringAttention,
  missingDocuments,
  formatDate,
  daysUntil,
} from "../dashboardData";

export function UrgentActions() {
  const sorted = [...urgentActions].sort((a, b) => a.due.localeCompare(b.due));

  return (
    <SectionCard title="Urgent Actions" icon={Zap}>
      <div className="space-y-3">
        {sorted.length === 0 && <EmptyState>Nothing needs immediate action.</EmptyState>}
        {sorted.map((item) => {
          const days = daysUntil(item.due);
          return (
            <Row key={item.id} to="/litigation">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.action}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.caseNo} &middot; {item.client} &middot;{" "}
                  {days < 0
                    ? Math.abs(days) + " days overdue"
                    : days === 0
                    ? "due today"
                    : "due " + formatDate(item.due)}
                </p>
              </div>
              <PriorityDot level={days < 0 ? "Overdue" : item.priority} />
            </Row>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function CasesRequiringAttention() {
  return (
    <SectionCard title="Cases Requiring Attention" icon={AlertCircle}>
      <div className="space-y-3">
        {casesRequiringAttention.length === 0 && (
          <EmptyState>Every case has had recent activity.</EmptyState>
        )}
        {casesRequiringAttention.map((item) => (
          <Row key={item.id} to="/litigation">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {item.caseNo} &middot; {item.client}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.reason}
              </p>
            </div>
            <PriorityDot level={item.severity} />
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}

export function MissingDocuments() {
  return (
    <SectionCard title="Missing Documents" icon={FileWarning}>
      <div className="space-y-3">
        {missingDocuments.length === 0 && (
          <EmptyState>No required documents are outstanding.</EmptyState>
        )}
        {missingDocuments.map((item) => (
          <Row key={item.id} to="/litigation">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.document}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.caseNo} &middot; {item.client} &middot; {item.responsible}
              </p>
            </div>
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}
