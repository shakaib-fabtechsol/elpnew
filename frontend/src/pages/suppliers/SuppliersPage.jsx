import { useState } from "react";
import ExcelIcon from "@/components/shared/ExcelIcon";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import { Truck } from "lucide-react";
import { IdStatusDot, isEndedStatus } from "@/components/shared/panels";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useSuppliers } from "@/lib/suppliers/context";
import useDataset from "@/lib/api/useDataset";

export default function SuppliersPage() {
  const navigate = useNavigate();
  const { suppliers } = useSuppliers();
  // The directory is loaded at sign-in: skeleton rows until it lands, and
  // "Unable to load suppliers" with Retry if it could not be read.
  const dataset = useDataset(["suppliers"]);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const columns = [
    {
      // A supplier that has stopped says so beside its number; a live one
      // says nothing, so the table needs no status column either way.
      key: "supplierId",
      header: "Supplier ID",
      width: "14%",
      // An ID in natural order: each run of digits compares as a number.
      sort: "text",
      render: (value, row) => (
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/suppliers/" + row.id)}
            className="numeric-value font-medium text-record-link hover:opacity-80"
          >
            {value}
          </button>
          <IdStatusDot status={row.status} />
        </span>
      ),
    },
    {
      key: "name",
      header: "Supplier Name",
      width: "24%",
      skeleton: "lines",
      exportValue: (row) => row.name + " | " + row.category,
      // By the name, not the export's "name | category".
      sort: "text",
      sortValue: (row) => row.name,
      render: (value, row) => (
        <div className="space-y-0.5">
          <p className="font-medium">{value}</p>
          <p className="text-xs text-muted-foreground">{row.category}</p>
        </div>
      ),
    },
    // A contact detail: nothing is learnt by putting phone numbers in order.
    { key: "phone", header: "Phone", width: "16%", sort: false },
    {
      key: "bank",
      header: "Supplier Account",
      width: "22%",
      skeleton: "lines",
      // Combined information: bank and account number.
      sort: false,
      exportValue: (row) =>
        (row.bank || "-") + " | " + (row.accountNumber || "-"),
      render: (_, row) => (
        <div className="space-y-0.5 text-xs">
          <p className="font-medium">{row.bank || "-"}</p>
          <p className="text-muted-foreground">{row.accountNumber || "-"}</p>
        </div>
      ),
    },
    {
      // CR, TIN and VAT belong together - they are all the supplier's numbers.
      key: "taxIdentificationNumber",
      header: "Tax Details",
      width: "24%",
      skeleton: "lines",
      // Combined information: CR, TIN and VAT numbers.
      sort: false,
      exportValue: (row) =>
        "CR " +
        (row.commercialRegistration || "-") +
        " | TIN " +
        (row.taxIdentificationNumber || "-") +
        " | VAT " +
        (row.vatNumber || "-"),
      render: (_, row) => (
        <div className="space-y-0.5 text-xs">
          <p>
            <span className="text-muted-foreground">CR </span>
            {row.commercialRegistration || "-"}
          </p>
          <p>
            <span className="text-muted-foreground">TIN </span>
            {row.taxIdentificationNumber || "-"}
          </p>
          <p>
            <span className="text-muted-foreground">VAT </span>
            {row.vatNumber || "-"}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Truck}
        title="Suppliers"
        note="Manage your suppliers"
        action={
          <Button
            variant="outline"
            onClick={() => downloadCsv(toCsv(columns, suppliers), "suppliers.csv")}
          >
            <ExcelIcon className="me-2 size-[18px]" />
            Export
          </Button>
        }
        onAdd={() => navigate("/suppliers/create")}
        addLabel="Add Supplier"
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            itemLabel="suppliers"
            dataset={dataset}
            data={suppliers}
            // A supplier no longer dealt with is kept, at the foot of the list.
            endedRow={(row) => isEndedStatus(row.status)}
            searchPlaceholder="Ask anything..."
            showExport={false}
            enableColumnSearch={false}
            currentPage={currentPage}
            totalPages={Math.ceil(suppliers.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
