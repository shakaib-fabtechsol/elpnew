import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Plus,
  UserPlus,
  ListPlus,
  CalendarPlus,
  BellPlus,
  Gavel,
  ListChecks,
  Timer,
  Bell,
  AlarmClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  searchIndex,
  QUICK_SEARCH_FIELDS,
  todaysHearings,
  tasks,
  deadlines,
  courtNotifications,
  overdueTasks,
  daysUntil,
  dayOffset,
} from "../dashboardData";

/** Requirement 28 - one field that reaches any record. */
export function QuickSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const term = query.trim().toLowerCase();
  const matches = term
    ? searchIndex
        .filter(
          (entry) =>
            entry.label.toLowerCase().includes(term) ||
            entry.detail.toLowerCase().includes(term)
        )
        .slice(0, 8)
    : [];

  return (
    <div className="relative">
      <Sparkles className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
      <Input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search case no., execution no., client, phone, civil ID, CR, opponent, court or lawyer"
        className="ps-9"
      />

      {open && term.length > 0 && (
        <Card className="absolute start-0 end-0 top-full z-50 mt-1 max-h-80 overflow-y-auto">
          <CardContent className="p-1">
            {matches.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Nothing matched &ldquo;{query}&rdquo;. Searchable fields:{" "}
                {QUICK_SEARCH_FIELDS.join(", ")}.
              </p>
            ) : (
              matches.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  onMouseDown={() => navigate(entry.to)}
                  className="flex w-full flex-col items-start rounded-md px-3 py-2 text-start transition-colors hover:bg-muted focus:outline-none focus:bg-muted"
                >
                  <span className="text-sm font-medium">{entry.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.detail}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Requirement 29 */
export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: "New Case", icon: Plus, to: "/litigation/register" },
    { label: "New Client", icon: UserPlus, to: "/clients/create" },
    { label: "New Task", icon: ListPlus, to: "/profile/tasks" },
    { label: "Add Hearing", icon: CalendarPlus, to: "/litigation" },
    { label: "Add Court Update", icon: BellPlus, to: "/litigation" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          onClick={() => navigate(action.to)}
        >
          <action.icon className="me-1.5 h-4 w-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}

/** Requirement 2 - the whole day in one line, every figure derived from data. */
export function TodaysBrief({ currentUser }) {
  const navigate = useNavigate();

  const myOpenTasks = tasks.filter(
    (t) => t.assignee === currentUser && t.status !== "Completed"
  ).length;
  const nearDeadlines = deadlines.filter((d) => daysUntil(d.dueDate) <= 7).length;
  const todaysNotifications = courtNotifications.filter(
    (n) => n.date === dayOffset(0)
  ).length;

  const items = [
    { count: todaysHearings.length, label: "Hearings", icon: Gavel, to: "/litigation" },
    { count: myOpenTasks, label: "Tasks", icon: ListChecks, to: "/profile/tasks" },
    { count: nearDeadlines, label: "Deadlines", icon: Timer, to: "/litigation" },
    { count: todaysNotifications, label: "Court Updates", icon: Bell, to: "/litigation" },
    { count: overdueTasks.length, label: "Overdue", icon: AlarmClock, to: "/profile/tasks?overdue=1", alert: true },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-3 text-sm font-semibold text-primary">Today&apos;s Brief</p>
        <div className="flex flex-wrap items-stretch gap-2">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.to)}
              className={cn(
                "flex flex-1 min-w-[120px] items-center gap-3 rounded-lg border p-3 text-start transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring",
                item.alert && item.count > 0 && "border-red-200 bg-red-50 hover:bg-red-100"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  item.alert && item.count > 0
                    ? "text-red-600"
                    : "text-muted-foreground"
                )}
              />
              <div>
                <p
                  className={cn(
                    "text-lg font-bold leading-none",
                    item.alert && item.count > 0 && "text-red-700"
                  )}
                >
                  {item.count}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
