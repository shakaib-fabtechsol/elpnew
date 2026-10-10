import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/shared/DataTable";
import ActiveFilters from "@/components/shared/ActiveFilters";
import { IdStatusDot, isEndedStatus } from "@/components/shared/panels";
import { Scale, Plus, Eye, Edit } from "lucide-react";
import { useListFilter } from "@/lib/useListFilter";
import { daysUntil } from "@/pages/dashboard/dashboardData";

const FILTERS = {
  status: { label: "Status", match: (row, value) => row.status === value },
  stage: { label: "Stage", match: (row, value) => row.stage === value },
  branch: { label: "Branch", match: (row, value) => row.branch === value },
  type: { label: "Type", match: (row, value) => row.case_type === value },
  client: { label: "Client", match: (row, value) => row.client === value },
  // Cases opened within the given number of days.
  newWithin: {
    label: "Opened",
    display: (value) => "last " + value + " days",
    match: (row, value) => Math.abs(daysUntil(row.opened_at)) <= Number(value),
  },
};

const cases = [];

// The eight stages the client specified, in order.
const STAGE_VARIANT = {
  Registration: "secondary",
  "Under Litigation": "brand",
  "Reserved for Judgment": "warning",
  "Judgment Issued": "warning",
  Appeal: "default",
  "Supreme Court": "default",
  Execution: "default",
  Closed: "outline",
};

const columns = [
  {
    // A case still running says nothing beside its number; a closed one says
    // so, which is why there is no status column of its own.
    key: "case_no",
    header: "Case No.",
    width: "12%",
    cellClassName: "text-start font-medium",
    exportValue: (row) => row.case_no + " (" + row.status + ")",
    render: (value, row) => (
      <span className="flex flex-wrap items-center gap-2">
        {value}
        <IdStatusDot status={row.status} />
      </span>
    ),
  },
  { key: "client", header: "Client", width: "18%" },
  {
    key: "case_type",
    header: "Type",
    width: "10%",
    render: (value) => (
      <Badge variant="outline">{value}</Badge>
    )
  },
  { key: "court", header: "Court", width: "18%" },
  {
    key: "stage",
    header: "Stage",
    width: "12%",
    render: (value) => (
      <Badge
        variant={STAGE_VARIANT[value] || "outline"}
      >
        {value}
      </Badge>
    )
  },
  {
    key: "actions",
    header: "Actions",
    width: "12%",
    disableFilter: true,
    render: (_, row) => (
      <div className="flex items-center justify-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Open hearing">
          <Link to={"/litigation/" + row.id + "/hearing"}>
            <Eye className="h-4 w-4" />
            <span className="sr-only">Open case {row.case_no}</span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Post judgement">
          <Link to={"/litigation/" + row.id + "/judgement"}>
            <Edit className="h-4 w-4" />
            <span className="sr-only">Edit case {row.case_no}</span>
          </Link>
        </Button>
      </div>
    )
  },
];

export default function LitigationList() {
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const { active, apply, clear } = useListFilter(FILTERS);

  // Newest case first, read off the case number itself ("2024/015" is year
  // then sequence) - a case entered late for an old year stays with its year.
  const visibleCases = [...apply(cases)].sort((a, b) =>
    String(b.case_no).localeCompare(String(a.case_no), undefined, { numeric: true })
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-3 rounded-xl bg-primary">
            <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-primary">
              Running Cases
            </h1>
            <p className="text-xs sm:text-sm text-primary/75">
              Manage litigation cases
            </p>
          </div>
        </div>
        <Button onClick={() => navigate('/litigation/register')}>
          <Plus className="me-2 h-4 w-4" />
          Register Case
        </Button>
      </div>

      <ActiveFilters
        filters={active}
        onClear={clear}
        resultCount={visibleCases.length}
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            data={visibleCases}
            keepOrder
            // A closed case is kept, under the ones still running.
            endedRow={(row) => isEndedStatus(row.status)}
            searchPlaceholder="Search cases..."
            enableColumnSearch={false}
            currentPage={currentPage}
            totalPages={Math.ceil(visibleCases.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
