import { useState } from "react";
import DataTable from "@/components/shared/DataTable";
import { withRial } from "@/lib/money";
import {
  commissionRecords,
  feesFor,
  commissionOn,
  monthAndYear,
  INVOICE_LINKED_COMMISSION,
} from "../commissionData";

const moneyValue = (amount) =>
  Number(amount || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const money = (amount) => withRial(moneyValue(amount));

/**
 * Commission on referred work, as the company reads it.
 *
 * Only the list, and nothing to add from here: a commission is agreed with a
 * person, so it is raised on that person's record under Financial Benefits.
 * This page is where the firm sees every arrangement together. The money
 * follows on its own - nothing is worked out until the client actually pays,
 * so a commission can never be owed on money that never arrived.
 */
export default function CommissionSection() {
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const columns = [
    {
      key: "commissionNo",
      header: "Commission No.",
      width: "13%",
      cellClassName: "font-medium",
    },
    { key: "clientName", header: "Client", width: "17%" },
    {
      key: "paidTo",
      header: "Beneficiary",
      width: "16%",
      exportValue: (row) => row.paidTo + " (" + row.classification + ")",
      render: (value, row) => (
        <div>
          <p>{value}</p>
          <p className="text-xs text-muted-foreground">{row.classification}</p>
        </div>
      ),
    },
    {
      // The month it started, read off the date it takes effect.
      key: "monthYear",
      header: "Month & Year",
      width: "10%",
      exportValue: monthAndYear,
      render: (value, row) => monthAndYear(row),
    },
    {
      key: "type",
      header: "Commission Type",
      width: "15%",
      exportValue: (row) =>
        [
          row.type,
          row.caseFileNo ? "File No. " + row.caseFileNo : "",
          row.invoiceNo ? "Invoice No. " + row.invoiceNo : "",
        ]
          .filter(Boolean)
          .join(" - "),
      // An invoice-linked commission is worked out from one paid invoice, so
      // both are named under it and the figure can be traced. A fixed one runs
      // over a period - which the Period column already shows - and has no file
      // or invoice to name.
      render: (value, row) => (
        <div>
          <p>{value}</p>
          {row.type === INVOICE_LINKED_COMMISSION && (
            <>
              <p className="text-xs text-muted-foreground">
                File No.: {row.caseFileNo || "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                Invoice No.: {row.invoiceNo || "-"}
              </p>
            </>
          )}
        </div>
      ),
    },
    {
      // The fees collected, the rate, and what the two come to - kept together
      // because the last one is only meaningful beside the two it came from.
      key: "rate",
      header: "Legal Fees (Before VAT) & Commission",
      width: "22%",
      exportValue: (row) =>
        moneyValue(feesFor(row)) +
        " at " +
        row.rate +
        "% = " +
        moneyValue(commissionOn(row)),
      render: (value, row) => (
        <div className="space-y-0.5">
          <p className="font-medium">{money(feesFor(row))}</p>
          <p className="text-xs text-muted-foreground">{value}%</p>
          <p className="text-xs font-medium text-green-700">
            Commission: {money(commissionOn(row))}
          </p>
        </div>
      ),
    },
    {
      key: "periodFrom",
      header: "Period",
      width: "17%",
      exportValue: (row) =>
        row.periodFrom + (row.periodTo ? " to " + row.periodTo : ""),
      render: (value, row) => (
        <div>
          <p>{value}</p>
          <p className="text-xs text-muted-foreground">
            {row.periodTo ? "to " + row.periodTo : "Open ended"}
          </p>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={commissionRecords}
      searchPlaceholder="Search commissions..."
      exportFileName="commission-records.csv"
      enableColumnSearch={false}
      currentPage={currentPage}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
      onPageSizeChange={setPageSize}
    />
  );
}
