import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DataTable from "@/components/shared/DataTable";
import SummaryStrip from "@/components/shared/SummaryStrip";
import { INVOICE_STATUS_DOT } from "@/lib/constants";
import { withRial } from "@/lib/money";
import { formatDate } from "@/pages/firm/firmData";
import {
  clientInvoices,
  caseByFileNo,
  currentCaseNo,
} from "../clientMockData";

const money = (amount) =>
  withRial(amount.toLocaleString("en-GB", { minimumFractionDigits: 0 }));

/**
 * "15/02/2024" - the way dates are written inside a table here.
 *
 * The strip above the table spells the month out instead, because one date
 * standing on its own is read rather than scanned. Inside a row, where dates
 * are compared down a column, the short form lines up and the long one does
 * not.
 */
const shortDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-GB") : "-";

/** Anything with money still owed against it. */
const isOwed = (invoice) =>
  ["Unpaid", "Overdue", "Partially Paid"].includes(invoice.status);

/** The status as a coloured dot, so the word beside it can stay plain black. */
function StatusDot({ status }) {
  const dot = INVOICE_STATUS_DOT[status] || INVOICE_STATUS_DOT.Cancelled;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
        style={{ backgroundColor: dot.fill, borderColor: dot.ring }}
      />
      {status}
    </span>
  );
}

/**
 * The views of this client's billing.
 *
 * `match` decides both what a box counts and what the table shows when it is
 * selected, so the figure on the box and the rows below can never disagree.
 * Anything not settled counts as unpaid, including the outstanding half of a
 * partly paid invoice - so a part payment is counted in both its own box and
 * that one, on purpose.
 */
const VIEWS = [
  {
    key: "all",
    label: "Total Invoices",
    match: () => true,
    tone: "text-primary",
  },
  {
    key: "paid",
    label: "Paid Invoices",
    match: (invoice) => invoice.status === "Paid",
    tone: "text-green-600",
  },
  {
    key: "partial",
    label: "Partially Paid Invoices",
    match: (invoice) => invoice.status === "Partially Paid",
    tone: "text-amber-600",
  },
  {
    key: "unpaid",
    label: "Unpaid Invoices",
    match: isOwed,
    tone: "text-red-600",
  },
  {
    key: "cancelled",
    label: "Cancelled Invoices",
    match: (invoice) => invoice.status === "Cancelled",
    tone: "text-muted-foreground",
  },
];

/**
 * One labelled line inside a merged cell.
 *
 * Four facts in one column only read as four facts if each says what it is;
 * the label is the quiet half of the pair, so the value carries the weight.
 */
function Line({ label, children }) {
  return (
    <p className="leading-snug">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{children}</span>
    </p>
  );
}

/** One fact about an invoice. */
function Fact({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

export default function InvoicesSection({ clientNo }) {
  // Only this client's invoices - the tiles, the table and the oldest debt
  // are all about the client whose record this is.
  const invoices = clientInvoices.filter((invoice) => !clientNo || invoice.clientNo === String(clientNo));
  const [view, setView] = useState("all");
  // The invoice being read, if any. Opened from its number in the table.
  const [openInvoice, setOpenInvoice] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const active = VIEWS.find((v) => v.key === view);

  let rows = invoices.filter(active.match);
  // Chasing money starts with whatever has been owed the longest.
  if (view === "unpaid") {
    rows = [...rows].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  // How long the oldest debt has been standing, which is what decides whether
  // this client needs chasing at all.
  const oldestDue = invoices
    .filter(isOwed)
    .map((invoice) => invoice.dueDate)
    .sort()[0];

  const columns = [
    {
      // The invoice is the row, so its number leads - and carries its
      // standing with it rather than in a column of its own.
      key: "invoiceNo",
      header: "Invoice No.",
      width: "14%",
      exportValue: (row) => row.invoiceNo + " (" + row.status + ")",
      render: (value, row) => (
        <div>
          <button
            type="button"
            onClick={() => setOpenInvoice(row)}
            className="block rounded font-medium text-primary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {value}
          </button>
          <span className="mt-0.5 block text-xs font-medium">
            <StatusDot status={row.status} />
          </span>
        </div>
      ),
    },
    {
      // Two dates that are only ever read against each other, so they are
      // one column: issued then due, one under the other.
      key: "date",
      header: "Issue & Due Date",
      width: "13%",
      exportValue: (row) => "Issued " + row.date + ", due " + row.dueDate,
      render: (value, row) => (
        <div className="text-xs">
          <Line label="Issue">{shortDate(value)}</Line>
          <Line label="Due">{shortDate(row.dueDate)}</Line>
        </div>
      ),
    },
    {
      // The file the fee was earned on. Everything but the file number is
      // read off the case itself, so an invoice cannot describe a case
      // differently from the Cases tab.
      key: "caseFileNo",
      header: "Case Details",
      width: "22%",
      exportValue: (row) => {
        const file = caseByFileNo(row.caseFileNo);
        if (!file) return "-";
        return [
          "File " + file.fileNo,
          file.opponent,
          file.litigationLevel,
          currentCaseNo(file),
        ].join(" - ");
      },
      render: (value) => {
        const file = caseByFileNo(value);
        if (!file) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="text-xs">
            <Line label="File No.">{file.fileNo}</Line>
            <Line label="Opponent">{file.opponent}</Line>
            <Line label="Level">{file.litigationLevel}</Line>
            <Line label="Case No.">{currentCaseNo(file)}</Line>
          </div>
        );
      },
    },
    {
      // What was charged, and why it was charged - the second answers the
      // first, so they belong in one column rather than two.
      key: "details",
      header: "Invoice Details",
      width: "22%",
      exportValue: (row) =>
        row.details + (row.reason ? " - " + row.reason : ""),
      render: (value, row) => (
        <div className="text-xs">
          <p className="font-medium leading-snug">{value}</p>
          {row.reason && <Line label="Reason">{row.reason}</Line>}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Invoice Amount",
      width: "14%",
      render: (value, row) => (
        <div>
          <p className="font-medium">{money(value)}</p>
          {row.paidAmount > 0 && row.paidAmount < value && (
            <p className="text-xs text-muted-foreground">
              {money(row.paidAmount)} paid
            </p>
          )}
        </div>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      width: "15%",
      render: (value) =>
        value || <span className="text-muted-foreground">-</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Each cell is also the filter for the table below it, so the
          figure and the rows it stands for can never disagree. */}
      <SummaryStrip
        items={[
          ...VIEWS.map((option) => {
            const matching = invoices.filter(option.match);
            return {
              key: option.key,
              label: option.label,
              count: matching.length,
              tone: option.tone,
              value: money(matching.reduce((sum, i) => sum + i.amount, 0)),
              selected: view === option.key,
              onClick: () => {
                setView(option.key);
                setCurrentPage(1);
              },
            };
          }),
          {
            // A date rather than a count, so it opens what is owed
            // instead of filtering to itself.
            key: "oldest",
            label: "Oldest Unpaid Invoice Date",
            tone: "text-muted-foreground",
            value: (
              <span className="text-amber-600">
                {oldestDue ? formatDate(oldestDue) : "-"}
              </span>
            ),
            note: "Earliest due date",
            onClick: () => {
              setView("unpaid");
              setCurrentPage(1);
            },
          },
        ]}
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            data={rows}
            searchPlaceholder="Search invoices..."
            exportFileName="client-invoices.csv"
            enableColumnSearch={false}
            currentPage={currentPage}
            totalPages={Math.ceil(rows.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* What the invoice says. Read only for now: the fields it will be
          edited through have not been designed yet, and inventing them
          would only have to be undone. */}
      <Dialog
        open={Boolean(openInvoice)}
        onOpenChange={(next) => !next && setOpenInvoice(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{openInvoice?.invoiceNo}</DialogTitle>
            <DialogDescription>
              {openInvoice?.details}
              {openInvoice?.reason && " - " + openInvoice.reason}
            </DialogDescription>
          </DialogHeader>

          {openInvoice && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Fact label="Invoice Date">{shortDate(openInvoice.date)}</Fact>
              <Fact label="Due Date">{shortDate(openInvoice.dueDate)}</Fact>
              <Fact label="Status">
                <StatusDot status={openInvoice.status} />
              </Fact>

              <Fact label="Legal Fees">
                {money(openInvoice.legalFees)}
              </Fact>
              <Fact label="VAT">{money(openInvoice.vat)}</Fact>
              <Fact label="Invoice Amount">
                {money(openInvoice.amount)}
              </Fact>

              <Fact label="Paid">{money(openInvoice.paidAmount)}</Fact>
              <Fact label="Paid On">
                {shortDate(openInvoice.paidDate)}
              </Fact>
              {/* Never stored: what is left is the invoice less what has
                  been paid, worked out here. */}
              <Fact label="Outstanding">
                {money(openInvoice.amount - openInvoice.paidAmount)}
              </Fact>

              <div className="sm:col-span-3">
                <Fact label="Notes">
                  <span className="font-normal text-muted-foreground">
                    {openInvoice.notes || "-"}
                  </span>
                </Fact>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenInvoice(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
