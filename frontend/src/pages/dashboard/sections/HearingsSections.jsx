import { Badge } from "@/components/ui/badge";
import { Gavel, CalendarClock } from "lucide-react";
import { SectionCard, Row, EmptyState } from "@/components/shared/panels";
import { todaysHearings, upcomingHearings, formatDate, daysUntil } from "../dashboardData";

const HEARING_STATUS_VARIANT = {
  Scheduled: "secondary",
  Attended: "success",
  Postponed: "warning",
  Cancelled: "outline",
};

export function TodaysHearings() {
  return (
    <SectionCard title="Today's Hearings" icon={Gavel}>
      <div className="space-y-3">
        {todaysHearings.length === 0 && (
          <EmptyState>No hearings scheduled for today.</EmptyState>
        )}
        {todaysHearings.map((hearing) => (
          <Row key={hearing.id} to="/litigation">
            <div className="flex min-w-0 items-start gap-3">
              <span className="w-14 shrink-0 text-sm font-bold text-primary">
                {hearing.time}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {hearing.caseNo} &middot; {hearing.client}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {hearing.court} &middot; {hearing.caseType} &middot;{" "}
                  {hearing.lawyer}
                </p>
              </div>
            </div>
            <Badge
              variant={HEARING_STATUS_VARIANT[hearing.status]}
              className="shrink-0"
            >
              {hearing.status}
            </Badge>
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}

export function UpcomingHearings() {
  return (
    <SectionCard
      title="Upcoming Hearings"
      icon={CalendarClock}
      action={
        <span className="text-xs text-muted-foreground">Next 14 days</span>
      }
    >
      <div className="space-y-3">
        {upcomingHearings.length === 0 && (
          <EmptyState>Nothing scheduled in the next 14 days.</EmptyState>
        )}
        {upcomingHearings.map((hearing) => {
          const days = daysUntil(hearing.date);
          return (
            <Row key={hearing.id} to="/litigation">
              <div className="flex min-w-0 items-start gap-3">
                <div className="w-20 shrink-0">
                  <p className="text-xs font-semibold">
                    {formatDate(hearing.date).slice(0, 6)}
                  </p>
                  <p className="text-xs text-muted-foreground">{hearing.time}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {hearing.caseNo} &middot; {hearing.client}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {hearing.court} &middot; {hearing.lawyer}
                  </p>
                </div>
              </div>
              <span className="w-20 shrink-0 text-end text-xs text-muted-foreground">
                {days === 0 ? "Today" : "in " + days + (days === 1 ? " day" : " days")}
              </span>
            </Row>
          );
        })}
      </div>
    </SectionCard>
  );
}
