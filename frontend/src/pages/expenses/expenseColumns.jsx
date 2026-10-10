import { Badge } from "@/components/ui/badge";
// Amounts here are read against invoices, so they carry the currency and fils.
import { money as omr } from "@/lib/money";
import { findType, linkLabel } from "./links";
import { settlement, formatDate } from "./expenseData";

/** One field inside a stacked column. */
function Line({ label, children }) {
  return (
    <p className="leading-tight">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span className="block">{children}</span>
    </p>
  );
}

/** A step in the trail, blank when nobody took it. */
function Step({ label, by, at }) {
  if (!by) return null;
  return (
    <Line label={label}>
      {by}
      <span className="block text-muted-foreground">{formatDate(at)}</span>
    </Line>
  );
}

/**
 * The columns an expense is read through, defined once.
 *
 * The Expenses page and a supplier's own payments show the same records, so
 * they show them the same way. `accountFor` looks a supplier up by name;
 * `includeSupplier` drops that column where the page is already about one
 * supplier and repeating it on every row would say nothing.
 */
export function expenseColumns({ accountFor, includeSupplier = true }) {
  const columns = [
  {
      key: "expenseNo",
      header: "Expense ID",
      width: "6%",
      render: (value) => (
        <span className="font-medium text-primary">{value}</span>
      ),
    },
    {
      key: "supplier",
      header: "Supplier Details",
      subHeader: "(Supplier Information)",
      width: "16%",
      exportValue: (row) =>
        row.supplier || linkLabel(row.linkKind, row.linkId) || "Recorded directly",
      render: (value, row) => {
        if (!value) {
          const link = linkLabel(row.linkKind, row.linkId);
          return link ? (
            <Badge variant="secondary">{link}</Badge>
          ) : (
            <span className="text-muted-foreground">Recorded directly</span>
          );
        }
        const account = accountFor(value);
        return (
          <div className="space-y-1.5 text-xs">
            <Line label="Supplier ID:">
              <span className="text-primary">{account?.supplierId || "-"}</span>
            </Line>
            <p className="font-semibold text-primary">{value}</p>
            <Line label="Bank:">{account?.bank || "-"}</Line>
            <Line label="Account No.:">{account?.accountNumber || "-"}</Line>
            <Line label="Income Tax No.:">
              {account?.taxIdentificationNumber || "-"}
            </Line>
            <Line label="VAT No.:">{account?.vatNumber || "-"}</Line>
            <Line label="Commercial Registration:">
              {account?.commercialRegistration || "-"}
            </Line>
          </div>
        );
      },
    },
    {
      key: "lines",
      header: "Expense Details",
      subHeader: "(Expense Information)",
      width: "16%",
      exportValue: (row) =>
        row.lines
          .map(
            (l) => findType(l.typeKey)?.name + " · " + l.path.join(" / ")
          )
          .join(" | "),
      render: (value) => (
        <div className="space-y-2 text-xs">
          {value.map((line) => (
            <div key={line.id} className="space-y-1.5">
              <Line label="Expense Type:">
                <span className="font-medium">
                  {findType(line.typeKey)?.name}
                </span>
              </Line>
              <Line label="Category:">{line.path[0] || "-"}</Line>
              <Line label="Sub Category:">{line.path[1] || "-"}</Line>
              {line.description && (
                <Line label="Note:">{line.description}</Line>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "date",
      header: "Invoice Details",
      subHeader: "(Invoice Date · Number · View Invoice)",
      width: "13%",
      exportValue: (row) =>
        formatDate(row.date) + (row.invoiceNumber ? " · " + row.invoiceNumber : ""),
      render: (value, row) => (
        <div className="space-y-1.5 text-xs">
          <Line label="Invoice Date:">{formatDate(value)}</Line>
          <Line label="Invoice Number:">
            <span className="text-primary">{row.invoiceNumber || "-"}</span>
          </Line>
          {row.source === "request" && (
            <Line label="View Invoice:">
              {row.invoiceFile ? (
                <a
                  href={row.invoiceFile}
                  onClick={(event) => event.preventDefault()}
                  title={row.invoiceFile}
                  className="text-primary"
                >
                  Click to view invoice
                </a>
              ) : (
                <span className="text-muted-foreground">No invoice copy</span>
              )}
            </Line>
          )}
        </div>
      ),
    },
    {
      key: "total",
      header: "Invoice Amount",
      subHeader: "(Invoice Information)",
      width: "14%",
      render: (value, row) => {
        const state = settlement(row.paid, row.total);
        const rate = row.net ? Math.round((row.tax / row.net) * 100) : 0;
        return (
          <div className="space-y-1.5 text-xs">
            <p className="text-base font-bold text-primary">{omr(value)}</p>
            <Line label="Total Amount (Incl. VAT):">{omr(value)}</Line>
            <Line label="Amount Before VAT:">{omr(row.net)}</Line>
            <Line label={"VAT Amount (" + rate + "%):"}>{omr(row.tax)}</Line>
            <Badge variant={state.variant}>{state.label}</Badge>
          </div>
        );
      },
    },
    {
      key: "payments",
      header: "Payment Details",
      subHeader: "(Payment Information)",
      width: "17%",
      exportValue: (row) =>
        row.payments.map((p) => formatDate(p.date) + " " + p.amount).join(" | "),
      render: (value, row) =>
        value.length === 0 ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <div className="space-y-2 text-xs">
            {value.map((payment) => (
              <div key={payment.id} className="space-y-1.5">
                <Line label="Payment Date:">{formatDate(payment.date)}</Line>
                <Line label="Amount Paid:">{omr(payment.amount)}</Line>
                {payment.method && (
                  <Line label="Payment Method:">{payment.method}</Line>
                )}
                {payment.fromAccount && (
                  <Line label="Transferred From:">{payment.fromAccount}</Line>
                )}
                {row.supplier && (
                  <Line label="Transferred To:">{row.supplier}</Line>
                )}
                {payment.document && (
                  <Line label="Payment Proof:">
                    <a
                      href={payment.document}
                      onClick={(event) => event.preventDefault()}
                      title={payment.document}
                      className="text-primary"
                    >
                      Click to view proof
                    </a>
                  </Line>
                )}
              </div>
            ))}
          </div>
        ),
    },
    {
      key: "createdBy",
      header: "Request Tracking",
      subHeader: "(Request · Approval · Authorization · Payment)",
      width: "18%",
      exportValue: (row) =>
        row.tracking
          ? [
              row.tracking.requested.by,
              row.tracking.accountant.by,
              row.tracking.finance.by,
              row.tracking.paid.by,
            ]
              .filter(Boolean)
              .join(" · ")
          : "Recorded directly",
      render: (_, row) => {
        if (!row.tracking) {
          return (
            <span className="text-xs text-muted-foreground">
              Recorded directly on {formatDate(row.date)}
            </span>
          );
        }
        return (
          <div className="space-y-1.5 text-xs">
            <Step
              label="Requested By:"
              by={row.tracking.requested.by}
              at={row.tracking.requested.at}
            />
            <Step
              label="Approved By Accountant:"
              by={row.tracking.accountant.by}
              at={row.tracking.accountant.at}
            />
            <Step
              label="Approved By Finance Manager:"
              by={row.tracking.finance.by}
              at={row.tracking.finance.at}
            />
            <Step
              label="Paid By:"
              by={row.tracking.paid.by}
              at={row.tracking.paid.at}
            />
          </div>
        );
      },
    },
  ];

  return includeSupplier
    ? columns
    : columns.filter((column) => column.key !== "supplier");
}
