import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import DataTable from "@/components/shared/DataTable";
import ActiveFilters from "@/components/shared/ActiveFilters";
import { useListFilter } from "@/lib/useListFilter";

const isOverdue = (row) =>
  row.status !== "Completed" &&
  Boolean(row.due_date) &&
  new Date(row.due_date) < new Date(new Date().toDateString());

const FILTERS = {
  status: { label: "Status", match: (row, value) => row.status === value },
  priority: { label: "Priority", match: (row, value) => row.priority === value },
  // Anything past its due date and not yet finished.
  overdue: {
    label: "Overdue",
    display: () => "only",
    match: (row) => isOverdue(row),
  },
};
import { Calendar, ListTodo } from "lucide-react";

// Sample data
const tasks = [];

const columns = [
  {
    key: "completed",
    header: "",
    width: "5%",
    render: (value) => (
      <Checkbox checked={value} className="mx-auto" />
    ),
  },
  { key: "task", header: "Task", width: "35%", cellClassName: "text-start" },
  { key: "case_no", header: "Case No.", width: "12%" },
  {
    key: "due_date",
    header: "Due Date",
    width: "12%",
    render: (value) => (
      <span className="flex items-center justify-center gap-1">
        <Calendar className="h-3 w-3" />
        {value}
      </span>
    ),
  },
  {
    key: "priority",
    header: "Priority",
    width: "10%",
    render: (value) => (
      <Badge
        variant={
          value === "High"
            ? "destructive"
            : value === "Medium"
            ? "warning"
            : "secondary"
        }
      >
        {value}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "12%",
    render: (value) => (
      <Badge
        variant={
          value === "Completed"
            ? "success"
            : value === "In Progress"
            ? "brand"
            : "outline"
        }
      >
        {value}
      </Badge>
    ),
  },
];

export default function Tasks() {
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const { active, apply, clear } = useListFilter(FILTERS);

  const visibleTasks = apply(tasks);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-3 rounded-xl bg-primary">
          <ListTodo className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary">
            My Tasks
          </h1>
          <p className="text-xs sm:text-sm text-primary/75">
            Track and manage your assigned tasks
          </p>
        </div>
      </div>

      <ActiveFilters
        filters={active}
        onClear={clear}
        resultCount={visibleTasks.length}
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            data={visibleTasks}
            searchPlaceholder="Search tasks..."
            currentPage={currentPage}
            totalPages={Math.ceil(visibleTasks.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            showExport={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
