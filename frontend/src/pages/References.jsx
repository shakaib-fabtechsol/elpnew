import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import RecordDialog from "@/components/shared/RecordDialog";
import { IdStatusDot, isEndedStatus } from "@/components/shared/panels";
import { BookOpen, Eye, Edit, Trash2 } from "lucide-react";

const references = [
  { id: 1, category: "Courts", name: "Primary Court - Muscat", code: "PC-MUS", status: "Active" },
  { id: 2, category: "Courts", name: "Primary Court - Salalah", code: "PC-SAL", status: "Active" },
  { id: 3, category: "Courts", name: "Commercial Court", code: "COMM", status: "Active" },
  { id: 4, category: "Courts", name: "Appeal Court", code: "APP", status: "Active" },
  { id: 5, category: "Courts", name: "Supreme Court", code: "SUP", status: "Active" },
  { id: 6, category: "Case Types", name: "Civil", code: "CIV", status: "Active" },
  { id: 7, category: "Case Types", name: "Commercial", code: "COM", status: "Active" },
  { id: 8, category: "Case Types", name: "Labor", code: "LAB", status: "Active" },
  { id: 9, category: "Case Types", name: "Criminal", code: "CRM", status: "Active" },
  { id: 10, category: "Case Types", name: "Family", code: "FAM", status: "Active" },
  { id: 11, category: "Departments", name: "Litigation", code: "LIT", status: "Active" },
  { id: 12, category: "Departments", name: "Corporate", code: "CORP", status: "Active" },
  { id: 13, category: "Departments", name: "Administration", code: "ADM", status: "Active" },
  { id: 14, category: "Branches", name: "Muscat", code: "MUS", status: "Active" },
  { id: 15, category: "Branches", name: "Salalah", code: "SAL", status: "Active" },
  { id: 16, category: "Branches", name: "Sohar", code: "SOH", status: "Inactive" },
];

const buildColumns = (onEdit, onDelete) => [
  {
    key: "category",
    header: "Category",
    width: "18%",
    render: (value) => (
      <Badge variant="outline">{value}</Badge>
    )
  },
  {
    // One no longer in use says so beside its name; one in use says nothing,
    // so the table needs no status column.
    key: "name",
    header: "Name",
    width: "36%",
    cellClassName: "text-start font-medium",
    exportValue: (row) => row.name + " (" + row.status + ")",
    render: (value, row) => (
      <span className="flex flex-wrap items-center gap-2">
        {value}
        <IdStatusDot status={row.status} />
      </span>
    ),
  },
  { key: "code", header: "Code", width: "14%", cellClassName: "font-mono" },
  {
    key: "actions",
    header: "Actions",
    width: "18%",
    disableFilter: true,
    render: (_, row) => (
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Edit reference"
          onClick={() => onEdit(row)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          title="Delete reference"
          onClick={() => onDelete(row)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    )
  },
];

const categories = ["All", "Courts", "Case Types", "Departments", "Branches"];

const REFERENCE_FIELDS = [
  { key: "category", label: "Category" },
  { key: "name", label: "Name" },
  { key: "code", label: "Code" },
  { key: "status", label: "Status" },
];

const blankReference = {
  id: null,
  category: "Courts",
  name: "",
  code: "",
  status: "Active",
};

export default function References() {
  const [rows, setRows] = useState(references);
  const [selected, setSelected] = useState(null);

  const columns = buildColumns(
    (row) => setSelected(row),
    (row) => setRows((prev) => prev.filter((r) => r.id !== row.id))
  );

  const saveReference = (record) => {
    setRows((prev) =>
      record.id
        ? prev.map((r) => (r.id === record.id ? record : r))
        : [
            ...prev,
            {
              ...record,
              id: prev.reduce((max, r) => Math.max(max, r.id), 0) + 1,
            },
          ]
    );
  };
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredData = selectedCategory === "All"
    ? rows
    : rows.filter(r => r.category === selectedCategory);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={BookOpen}
        title="References"
        note="Manage system reference data"
        onAdd={() => setSelected({ ...blankReference, id: 0 })}
        addLabel="Add Reference"
      />

      {/* Category Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <RecordDialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected && selected.id ? "Edit Reference" : "Add Reference"}
        record={selected}
        fields={REFERENCE_FIELDS}
        onSave={(record) =>
          saveReference(record.id ? record : { ...record, id: null })
        }
      />

      {/* Data Table */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            itemLabel="references"
            data={filteredData}
            // One no longer in use is kept, at the foot of its list.
            endedRow={(row) => isEndedStatus(row.status)}
            searchPlaceholder="Search references..."
            currentPage={currentPage}
            totalPages={Math.ceil(filteredData.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
