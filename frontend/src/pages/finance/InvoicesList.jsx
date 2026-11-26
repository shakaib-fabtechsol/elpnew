import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import ActiveFilters from "@/components/shared/ActiveFilters";
import RecordDialog from "@/components/shared/RecordDialog";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useListFilter } from "@/lib/useListFilter";

const FILTERS = {
  status: { label: "Status", match: (row, value) => row.status === value },
  client: { label: "Client", match: (row, value) => row.client === value },
};
import { Wallet, Eye, Edit, FileText } from "lucide-react";
import { withRial } from "@/lib/money";

const invoices = [];

const buildColumns = (onView, onDownload) => [
  // An ID in natural order: each run of digits compares as a number, so
  // INV-2024-011 follows INV-2024-002.
  { key: "invoice_no", header: "Invoice No.", width: "12%", cellClassName: "text-start font-medium", sort: "text" },
  { key: "client", header: "Client", width: "20%", sort: "text" },
  // The figure carries the currency, so the heading does not repeat it.
  { key: "amount", header: "Amount", width: "12%", className: "text-end", cellClassName: "text-end font-medium", sort: "money", render: (value) => withRial(value) },
  { key: "date", header: "Invoice Date", width: "12%", sort: "date" },
  { key: "due_date", header: "Due Date", width: "12%", sort: "date" },
  {
    key: "status",
    header: "Status",
    width: "10%",
    // What is owed and late first, then what is still waiting, settled last.
    sort: "status",
    sortOrder: ["Overdue", "Unpaid", "Pending", "Partially Paid", "Paid", "Cancelled"],
    render: (value) => (
      <Badge
        variant={
          value === "Paid"
            ? "success"
            : value === "Pending"
            ? "warning"
            : "destructive"
        }
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
    sort: false,
    render: (_, row) => (
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="View invoice"
          onClick={() => onView(row)}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Download invoice"
          onClick={() => onDownload(row)}
        >
          <FileText className="h-4 w-4" />
        </Button>
      </div>
    )
  },
];

const INVOICE_FIELDS = [
  { key: "invoice_no", label: "Invoice No.", readOnly: true },
  { key: "client", label: "Client" },
  { key: "amount", label: "Amount" },
  { key: "date", label: "Invoice Date" },
  { key: "due_date", label: "Due Date" },
  { key: "status", label: "Status" },
];

export default function InvoicesList() {
  const [selected, setSelected] = useState(null);

  const columns = buildColumns(
    (row) => setSelected(row),
    (row) =>
      downloadCsv(
        toCsv(INVOICE_FIELDS.map((f) => ({ key: f.key, header: f.label })), [row]),
        row.invoice_no.replace(/\//g, "-") + ".csv"
      )
  );
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const { active, apply, clear } = useListFilter(FILTERS);

  const visibleInvoices = apply(invoices);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Wallet}
        title="Invoices"
        note="Manage billing and invoices"
        onAdd={() => navigate("/finance/invoices/create")}
        addLabel="Create Invoice"
      />

      <RecordDialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Invoice"
        description={selected ? selected.invoice_no : ""}
        record={selected}
        fields={INVOICE_FIELDS}
        readOnly
      />

      <ActiveFilters
        filters={active}
        onClear={clear}
        resultCount={visibleInvoices.length}
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            itemLabel="invoices"
            data={visibleInvoices}
            searchPlaceholder="Search invoices..."
            currentPage={currentPage}
            totalPages={Math.ceil(visibleInvoices.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
