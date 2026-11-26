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
import { shortName } from "@/lib/shortName";
import useDataset from "@/lib/api/useDataset";

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
  // The commissions are loaded at sign-in into commissionRecords. Followed
  // here so the table re-renders when they land, with skeleton rows until
  // then and "Unable to load commissions" with Retry if they could not be read.
  const dataset = useDataset(["commissions"]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const columns = [
    {
      key: "commissionNo",
      header: "Commission No.",
      width: "13%",
      cellClassName: "font-medium",
      // An ID in natural order: each run of digits compares as a number, so
      // COM-2024-011 follows COM-2024-002.
      sort: "text",
    },
    { key: "clientName", header: "Client", width: "17%", sort: "text" },
    {
      key: "paidTo",
      header: "Beneficiary",
      width: "16%",
      skeleton: "lines",
      exportValue: (row) => row.paidTo + " (" + row.classification + ")",
      // By the name, not the export's "name (classification)".
      sort: "text",
      sortValue: (row) => row.paidTo,
      render: (value, row) => (
        <div>
          <p>{shortName(value)}</p>
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
      // By the date itself: as text, "01/2026" would come before "03/2025".
      sort: "date",
      sortValue: (row) => row.periodFrom || null,
      render: (value, row) => monthAndYear(row),
    },
    {
      key: "type",
      header: "Commission Type",
      width: "15%",
      skeleton: "lines",
      exportValue: (row) =>
        [
          row.type,
          row.caseFileNo ? "File No. " + row.caseFileNo : "",
          row.invoiceNo ? "Invoice No. " + row.invoiceNo : "",
        ]
          .filter(Boolean)
          .join(" - "),
      sort: "text",
      sortValue: (row) => row.type,
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
      skeleton: "lines",
      exportValue: (row) =>
        moneyValue(feesFor(row)) +
        " at " +
        row.rate +
        "% = " +
        moneyValue(commissionOn(row)),
      // By the commission, the figure the other two lines come to.
      sort: "money",
      sortValue: (row) => commissionOn(row),
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
      skeleton: "lines",
      // Combined information: start and end; Month & Year already orders by
      // the start.
      sort: false,
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
      itemLabel="commissions"
      dataset={dataset}
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
