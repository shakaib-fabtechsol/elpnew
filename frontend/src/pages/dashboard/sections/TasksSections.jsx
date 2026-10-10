import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks, AlarmClock } from "lucide-react";
import { SectionCard, Row, PriorityDot, EmptyState } from "@/components/shared/panels";
import { tasks, overdueTasks, teamWorkload, formatDate, daysUntil } from "../dashboardData";
import { scopedToOwnWork } from "@/lib/permissions";

const TASK_STATUS_VARIANT = {
  Pending: "secondary",
  "In Progress": "warning",
  Completed: "success",
  Overdue: "destructive",
};

// A task's displayed status accounts for the date, so an untouched task that
// has slipped past its due date reads as Overdue rather than Pending.
const displayStatus = (task) =>
  task.status !== "Completed" && daysUntil(task.dueDate) < 0
    ? "Overdue"
    : task.status;

export function MyTasks({ role, currentUser }) {
  const ownOnly = scopedToOwnWork(role);
  const [assignee, setAssignee] = useState(currentUser);

  // A lawyer only ever sees their own list; everyone else can pick a colleague.
  const effectiveAssignee = ownOnly ? currentUser : assignee;
  const visible = tasks
    .filter((t) => effectiveAssignee === "all" || t.assignee === effectiveAssignee)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <SectionCard
      title="My Tasks"
      icon={ListChecks}
      action={
        ownOnly ? null : (
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={currentUser}>My tasks</SelectItem>
              <SelectItem value="all">All employees</SelectItem>
              {teamWorkload
                .filter((member) => member.name !== currentUser)
                .map((member) => (
                  <SelectItem key={member.name} value={member.name}>
                    {member.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )
      }
    >
      <div className="space-y-3">
        {visible.length === 0 && <EmptyState>No tasks assigned.</EmptyState>}
        {visible.map((task) => {
          const status = displayStatus(task);
          return (
            <Row key={task.id} to="/profile/tasks">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{task.task}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {task.caseNo} &middot; due {formatDate(task.dueDate)}
                  {effectiveAssignee === "all" && " · " + task.assignee}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <PriorityDot level={task.priority} />
                <Badge variant={TASK_STATUS_VARIANT[status]}>{status}</Badge>
              </div>
            </Row>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function OverdueTasks() {
  return (
    <SectionCard
      title="Overdue Tasks"
      icon={AlarmClock}
      action={
        <Badge variant="destructive">{overdueTasks.length} overdue</Badge>
      }
    >
      <div className="space-y-3">
        {overdueTasks.length === 0 && (
          <EmptyState>Nothing overdue. All tasks are on schedule.</EmptyState>
        )}
        {overdueTasks.map((task) => (
          <Row
            key={task.id}
            to="/profile/tasks?overdue=1"
            className="border-s-4 border-s-red-500 bg-red-50 hover:bg-red-100"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-red-800">
                {task.task}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {task.caseNo} &middot; {task.assignee} &middot; was due{" "}
                {formatDate(task.dueDate)}
              </p>
            </div>
            <span className="w-20 shrink-0 text-end text-xs font-semibold text-red-700">
              {task.daysOverdue} {task.daysOverdue === 1 ? "day" : "days"} late
            </span>
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}
