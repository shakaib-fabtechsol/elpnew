import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import SummaryStrip from "@/components/shared/SummaryStrip";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";
import { Briefcase, FileText } from "lucide-react";
import { useExpenses } from "@/lib/expenses/context";
import { judicialTotals } from "./judicialData";
import { formatDate, money } from "./expenseData";

/** A fact with its heading above it, for a column read down rather than across. */
function Line({ label, children }) {
  return (
    <p className="leading-tight">
      <span className="block font-semibold">{label}</span>
      <span className="block">{children || "-"}</span>
    </p>
  );
}

/** A fact with its heading beside it, where the pair fits on one line. */
function Pair({ label, children }) {
  return (
    <p className="leading-tight">
      <span className="text-muted-foreground">{label} </span>
      <span>{children || "-"}</span>
    </p>
  );
}

/** Who did a thing, and when they did it. */
function Stamp({ label, name, date, time }) {
  return (
    <p className="leading-tight">
      <span className="block text-muted-foreground">{label}</span>
      <span className="block font-semibold">{name || "-"}</span>
      <span className="block text-muted-foreground">
        {formatDate(date)} - {time}
      </span>
    </p>
  );
}

/**
 * A document the row carries.
 *
 * Nothing is uploaded yet, so the link is held rather than followed - the
 * name is in the tooltip so it is still possible to tell which file is meant.
 */
function DocumentLink({ file, children }) {
  if (!file) {
    return <span className="block text-muted-foreground">Not attached</span>;
  }
  return (
    <a
      href={file}
      onClick={(event) => event.preventDefault()}
      title={file}
      className="inline-flex items-center gap-1.5 rounded text-primary focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      {children}
    </a>
  );
}

/**
 * Judicial authority expenses.
 *
 * Every row is one payment made to a court on a case's behalf, so the table
 * reads across the case it belongs to, what the money was for, and the transfer
 * it went out on - each of those kept together in its own column rather than
 * spread over a dozen narrow ones.
 */
export default function CourtFeePayments() {
  const navigate = useNavigate();
  const { judicialExpenses } = useExpenses();

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const tiles = judicialTotals(judicialExpenses);
  const all = tiles[0];

  const columns = [
    {
      key: "expenseNo",
      header: "Expense No.",
      subHeader: "(Branch)",
      width: "12%",
      // The number opens the request it belongs to.
      render: (value, row) => (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigate("/court-fee-payments/" + row.id)}
            className="rounded text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {value}
          </button>
          <p className="text-xs text-muted-foreground">{row.branch} Branch</p>
        </div>
      ),
    },
    {
      key: "client",
      header: "Case Parties",
      subHeader: "(Client / Opponent)",
      width: "14%",
      exportValue: (row) => row.client + " / " + row.opponent,
      render: (_, row) => (
        <div className="space-y-2 text-xs">
          <Line label="Client">
            <span className="font-medium">{row.client}</span>
          </Line>
          <Line label="Opponent">{row.opponent}</Line>
        </div>
      ),
    },
    {
      key: "court",
      header: "Case Details",
      subHeader: "(Court - Level)",
      width: "13%",
      exportValue: (row) => row.court + " - " + row.level,
      render: (_, row) => (
        <div className="text-xs">
          <p className="font-medium">{row.court}</p>
          <p className="text-muted-foreground">{row.level}</p>
        </div>
      ),
    },
    {
      key: "expenseType",
      header: "Expense Details",
      subHeader: "(Court Expense Type)",
      width: "17%",
      exportValue: (row) =>
        [row.expenseType, row.category, row.subcategory].join(" - "),
      render: (_, row) => (
        <div className="space-y-3 text-xs">
          <div>
            <p className="font-semibold">{row.expenseType}</p>
            <p className="text-muted-foreground">{row.category}</p>
            <p className="text-muted-foreground">{row.subcategory}</p>
          </div>
          {/* What the court gave back, kept with what it was given for */}
          <div className="space-y-1 pt-2">
            <DocumentLink file={row.registrationReceipt}>
              View Registration Receipt
            </DocumentLink>
            <DocumentLink file={row.caseRecord}>
              View Case Registration Record
            </DocumentLink>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Payment Details",
      subHeader: "(Amount & Payment Method)",
      width: "18%",
      exportValue: (row) =>
        [row.amount, row.paymentMethod, row.bank, row.accountNo].join(" - "),
      // Sorted on the figure, which is the only part of this column anybody
      // orders by.
      sortValue: (row) => row.amount,
      render: (_, row) => (
        <div className="space-y-3">
          <p className="text-center text-lg font-bold text-primary">
            {money(row.amount)}
          </p>
          <div className="space-y-1 pt-2 text-xs">
            <Pair label="Payment Method:">{row.paymentMethod}</Pair>
            <Pair label="Bank Name:">{row.bank}</Pair>
            <Pair label="Account No.:">{row.accountNo}</Pair>
          </div>
          <div className="space-y-1 pt-2 text-xs">
            <p className="text-muted-foreground">Payment Receipt:</p>
            <DocumentLink file={row.receipt}>View Payment Receipt</DocumentLink>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Transaction Tracking",
      subHeader: "(Submitted - Approved - Status)",
      width: "20%",
      exportValue: (row) =>
        [
          row.submittedBy,
          row.accountantApprovedBy,
          row.financeApprovedBy,
          row.status,
        ].join(" - "),
      render: (_, row) => (
        <div className="space-y-2 text-xs">
          <Stamp
            label="Submitted By:"
            name={row.submittedBy}
            date={row.submittedAt}
            time={row.submittedTime}
          />
          <Stamp
            label="Accountant Approved By:"
            name={row.accountantApprovedBy}
            date={row.accountantApprovedAt}
            time={row.accountantApprovedTime}
          />
          <Stamp
            label="Finance Manager Approved By:"
            name={row.financeApprovedBy}
            date={row.approvedAt}
            time={row.approvedTime}
          />
          <p className="pt-2">
            <span className="text-muted-foreground">Status: </span>
            <span
              className={cn(
                "font-semibold",
                row.status === "Approved" ? "text-green-600" : "text-amber-600"
              )}
            >
              {row.status}
            </span>
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Briefcase}
        title="Judicial Authority Expenses"
        note={
          <>
            {all.count} expenses &middot; {money(all.amount)}
          </>
        }
        onAdd={() => navigate("/court-fee-payments/create")}
        addLabel="Add Expense"
      />

      {/* What the firm has paid the courts, by what it was paid for */}
      <SummaryStrip
        items={tiles.map((tile) => ({
          key: tile.label,
          label: tile.label,
          count: tile.count,
          value: money(tile.amount),
        }))}
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            data={judicialExpenses}
            searchPlaceholder="Ask anything..."
            exportFileName="judicial-authority-expenses.csv"
            enableColumnSearch={false}
            enableSorting
            itemLabel="expenses"
            currentPage={currentPage}
            totalPages={Math.ceil(judicialExpenses.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
