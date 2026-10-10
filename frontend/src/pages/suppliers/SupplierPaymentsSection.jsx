import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DataTable from "@/components/shared/DataTable";
import { Plus } from "lucide-react";
import { useExpenses } from "@/lib/expenses/context";
import { useSuppliers } from "@/lib/suppliers/context";
import {
  expenseRecords,
  submittedRequest,
} from "@/pages/expenses/expenseData";
import { expenseColumns } from "@/pages/expenses/expenseColumns";
import InvoiceForm from "@/pages/expenses/InvoiceForm";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
// Amounts here are read against invoices, so they carry the currency and fils.
import { money as omr } from "@/lib/money";

/**
 * Everything the firm has spent with one supplier.
 *
 * The rows are the same expense records the Expenses page shows, read through
 * the same columns - narrowed to this supplier and without the Supplier column,
 * which would repeat the page's own subject on every row. Nothing is held here,
 * so a supplier's ledger cannot drift from the firm's.
 */
export default function SupplierPaymentsSection({ supplier }) {
  const { expenses, invoices, addInvoice } = useExpenses();
  const { suppliers } = useSuppliers();

  // The expense is raised here rather than on the Expenses page: the
  // expenses are read and managed here, so sending someone away to add one
  // loses both the supplier and the place they were reading.
  const [adding, setAdding] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const submit = (invoice) => {
    addInvoice(submittedRequest(invoice, CURRENT_USER));
    setAdding(false);
    setCurrentPage(1);
  };

  const accountFor = (name) => suppliers.find((s) => s.name === name) || null;

  const rows = expenseRecords(expenses, invoices)
    .filter((record) => record.supplier === supplier.name)
    // Newest first to read, though the numbers were given oldest first.
    .slice()
    .reverse();

  const total = rows.reduce((sum, row) => sum + row.total, 0);

  const columns = expenseColumns({ accountFor, includeSupplier: false });

  return (
    <div className="space-y-6">
      {/* The count and the total sit with the title: a total on its own cannot
          tell one large expense from twenty small ones. */}
      {/* One heading at a time: this row gives way to the form's own heading
          while a request is being written. */}
      {!adding && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">
              Supplier Payments
            </h2>
            <span className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "expense" : "expenses"}
            </span>
            <span className="text-sm font-bold text-primary">{omr(total)}</span>
          </div>
        </div>
      )}

      {/* No card of the supplier's details here: they are on Supplier
          Information, one click away, and repeating them only pushed the
          payments down the page. What is shown is the payments and the way to
          add one. */}

      {/* Raised above the list rather than on a page of its own: the list is
          what the request is judged against, and the supplier is already
          named by the page, so the form does not ask for them again. */}
      {adding && (
        <InvoiceForm
          forSupplier={supplier}
          onCancel={() => setAdding(false)}
          onSubmit={submit}
        />
      )}

      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            data={rows}
            searchPlaceholder="Ask about this supplier's expenses..."
            exportFileName="supplier-expenses.csv"
            enableColumnSearch={false}
            onAdd={adding ? null : () => setAdding(true)}
            addLabel="Add Expense Request"
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
