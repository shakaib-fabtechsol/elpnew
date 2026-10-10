import { Users, PhoneCall } from "lucide-react";
import { SectionCard, Row, PriorityDot, EmptyState } from "@/components/shared/panels";
import { teamWorkload, clientFollowUp } from "../dashboardData";

/** Requirement 27 - who is carrying how much. */
export function TeamWorkload() {
  return (
    <SectionCard title="Team Workload" icon={Users}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border text-sm">
          <thead>
            <tr className="border-b bg-secondary/60 text-start text-primary">
              <th className="p-3 font-semibold">Employee</th>
              <th className="p-3 text-end font-semibold">Active Cases</th>
              <th className="p-3 text-end font-semibold">Pending Tasks</th>
              <th className="p-3 text-end font-semibold">Overdue</th>
              <th className="p-3 text-end font-semibold">Hearings This Week</th>
              <th className="p-3 text-end font-semibold">Deadlines</th>
            </tr>
          </thead>
          <tbody>
            {teamWorkload.map((member) => (
              <tr key={member.name} className="border-b transition-colors last:border-0 hover:bg-primary/10">
                <td className="p-3">
                  <p className="font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                </td>
                <td className="p-3 text-end font-semibold">
                  {member.activeCases}
                </td>
                <td className="p-3 text-end">{member.pendingTasks}</td>
                <td className="p-3 text-end">
                  <span
                    className={
                      member.overdueTasks > 0
                        ? "font-semibold text-red-600"
                        : "text-muted-foreground"
                    }
                  >
                    {member.overdueTasks}
                  </span>
                </td>
                <td className="p-3 text-end">{member.hearingsThisWeek}</td>
                <td className="p-3 text-end">{member.upcomingDeadlines}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/** Requirement 17 */
export function ClientFollowUp() {
  return (
    <SectionCard title="Client Follow-up" icon={PhoneCall}>
      <div className="space-y-3">
        {clientFollowUp.length === 0 && (
          <EmptyState>No client action outstanding.</EmptyState>
        )}
        {clientFollowUp.map((item) => (
          <Row key={item.id} to="/clients">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.client}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.reason}
                {item.caseNo && " · " + item.caseNo}
              </p>
            </div>
            <PriorityDot level={item.priority} />
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}
