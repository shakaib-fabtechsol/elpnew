import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import RecordDialog from "@/components/shared/RecordDialog";
import { Briefcase, Eye, Edit } from "lucide-react";

const corporateMatters = [];

const buildColumns = (openRecord) => [
  { key: "ref_no", header: "Reference No.", width: "15%", cellClassName: "text-start font-medium" },
  { key: "client", header: "Client", width: "20%" },
  { key: "matter_type", header: "Matter Type", width: "18%" },
  { key: "created_date", header: "Created Date", width: "12%" },
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
    )
  },
  {
    key: "actions",
    header: "Actions",
    width: "13%",
    disableFilter: true,
    render: (_, row) => (
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="View matter"
          onClick={() => openRecord(row, true)}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Edit matter"
          onClick={() => openRecord(row, false)}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </div>
    )
  },
];

const MATTER_FIELDS = [
  { key: "ref_no", label: "Reference No.", readOnly: true },
  { key: "client", label: "Client" },
  { key: "matter_type", label: "Matter Type" },
  { key: "status", label: "Status" },
  { key: "created_date", label: "Created Date" },
];

export default function CorporateList() {
  const [matters, setMatters] = useState(corporateMatters);
  const [selected, setSelected] = useState(null);
  const [readOnly, setReadOnly] = useState(true);

  const openRecord = (row, viewOnly) => {
    setSelected(row);
    setReadOnly(viewOnly);
  };

  const columns = buildColumns(openRecord);
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Briefcase}
        title="Corporate Matters"
        note="Manage corporate legal matters"
        onAdd={() => navigate("/corporate/create")}
        addLabel="New Matter"
      />

      <RecordDialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title={readOnly ? "Corporate Matter" : "Edit Corporate Matter"}
        description={selected ? selected.ref_no : ""}
        record={selected}
        fields={MATTER_FIELDS}
        readOnly={readOnly}
        onSave={(updated) =>
          setMatters((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          )
        }
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            itemLabel="matters"
            data={matters}
            searchPlaceholder="Search corporate matters..."
            currentPage={currentPage}
            totalPages={Math.ceil(matters.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
