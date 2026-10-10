import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import FormHeading from "@/components/shared/FormHeading";
import SummaryStrip from "@/components/shared/SummaryStrip";
import { FileCheck2, FileText, Landmark, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaxes } from "@/lib/taxes/context";
import { Choice, TextField, Worked, Attach } from "@/pages/leases/fields";
import { omr, shortDate, todayIso } from "@/pages/leases/leaseData";
import {
  INCOME_TAX_RATE,
  INCOME_TAX_STATUS,
  incomeTaxDueDate,
  taxableIncomeOf,
  incomeTaxOf,
  incomeTaxBalance,
  incomeTaxStatus,
} from "./taxData";

const FIRST_TAX_YEAR = 2020;
const RATE_LABEL = INCOME_TAX_RATE * 100 + "%";

const emptyReturn = {
  year: "",
  revenue: "",
  expenses: "",
  filedOn: "",
  returnNo: "",
  paidAmount: "",
  paidOn: "",
  file: "",
};

/** Only digits and one decimal point, for amounts. */
const decimal = (value) => value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

/**
 * One year's return: the revenue and deductible expenses it declares, and what
 * happened to it - filed when, under what reference, and how much was paid.
 * The taxable income and the tax are worked out as the figures are typed.
 */
function IncomeTaxForm({ record, takenYears, onCancel, onSave }) {
  const [draft, setDraft] = useState(() =>
    record
      ? {
          ...emptyReturn,
          ...record,
          year: String(record.year),
          revenue: String(record.revenue ?? ""),
          expenses: String(record.expenses ?? ""),
          paidAmount: record.paidAmount ? String(record.paidAmount) : "",
        }
      : emptyReturn
  );
  const [error, setError] = useState("");

  const set = (name, value) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const currentYear = Number(todayIso().slice(0, 4));
  // Each year has one return, so years already on record are not offered again.
  const yearOptions = Array.from({ length: currentYear - FIRST_TAX_YEAR + 1 }, (_, i) => String(currentYear - i))
    .filter((option) => option === draft.year || !takenYears.includes(Number(option)))
    .map((option) => ({ value: option, label: option }));

  const figures = { revenue: Number(draft.revenue || 0), expenses: Number(draft.expenses || 0) };
  const hasFigures = draft.revenue !== "" && draft.expenses !== "";

  const save = () => {
    if (!draft.year || draft.revenue === "" || draft.expenses === "") {
      setError("Enter the tax year, the revenue and the deductible expenses.");
      return;
    }
    if (draft.filedOn && !draft.returnNo.trim()) {
      setError("A filed return needs its reference number.");
      return;
    }
    if (Number(draft.paidAmount) > 0 && !draft.paidOn) {
      setError("Enter the date the tax was paid.");
      return;
    }
    onSave({
      year: Number(draft.year),
      revenue: figures.revenue,
      expenses: figures.expenses,
      filedOn: draft.filedOn,
      returnNo: draft.returnNo.trim(),
      paidAmount: Number(draft.paidAmount || 0),
      paidOn: Number(draft.paidAmount) > 0 ? draft.paidOn : "",
      paymentRef: record?.paymentRef || "",
      file: draft.file,
    });
  };

  return (
    <Card>
      <CardContent className="space-y-6 p-4 sm:p-6">
        <FormHeading
          icon={FileCheck2}
          title={record ? "Update Tax Return - " + record.year : "Add Tax Return"}
          note={
            draft.year
              ? "Due by " + shortDate(incomeTaxDueDate(draft.year))
              : "A return a year, due by the end of April the year after"
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 sm:gap-6">
          <Choice
            id="taxYear"
            label="Tax Year"
            required
            value={draft.year}
            onChange={(value) => set("year", value)}
            options={yearOptions}
            disabled={Boolean(record)}
          />
          <TextField
            id="taxRevenue"
            label="Revenue (OMR)"
            required
            inputMode="decimal"
            value={draft.revenue}
            onChange={(value) => set("revenue", decimal(value))}
            placeholder="0.000"
          />
          <TextField
            id="taxExpenses"
            label="Deductible Expenses (OMR)"
            required
            inputMode="decimal"
            value={draft.expenses}
            onChange={(value) => set("expenses", decimal(value))}
            placeholder="0.000"
          />
          <Worked
            id="taxTaxableIncome"
            label="Taxable Income"
            value={hasFigures ? omr(taxableIncomeOf(figures)) : ""}
          />
          <Worked
            id="taxIncomeTax"
            label={"Income Tax " + RATE_LABEL}
            value={hasFigures ? omr(incomeTaxOf(figures)) : ""}
          />
        </div>

        <div className="form-grid">
          <TextField
            id="taxFiledOn"
            label="Filed On"
            type="date"
            max={todayIso()}
            value={draft.filedOn}
            onChange={(value) => set("filedOn", value)}
          />
          <TextField
            id="taxReturnNo"
            label="Return Reference No."
            required={Boolean(draft.filedOn)}
            value={draft.returnNo}
            onChange={(value) => set("returnNo", value)}
            placeholder={"e.g. CIT-" + (draft.year || currentYear) + "-0001"}
          >
            <Attach id="taxReturnFile" file={draft.file} onFile={(name) => set("file", name)} what="return copy" />
          </TextField>
          <TextField
            id="taxPaidAmount"
            label="Amount Paid (OMR)"
            inputMode="decimal"
            value={draft.paidAmount}
            onChange={(value) => set("paidAmount", decimal(value))}
            placeholder="0.000"
          />
          <TextField
            id="taxPaidOn"
            label="Payment Date"
            required={Number(draft.paidAmount) > 0}
            type="date"
            max={todayIso()}
            value={draft.paidOn}
            onChange={(value) => set("paidOn", value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="me-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            <Save className="me-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Corporate income tax, a return a year.
 *
 * Each return declares the year's revenue and deductible expenses; the taxable
 * income, the tax at the corporate rate, what is still owed and where the
 * return stands are all worked out from those and from what has been paid.
 */
export default function IncomeTaxPage() {
  const { incomeTaxReturns, addIncomeTaxReturn, updateIncomeTaxReturn } = useTaxes();
  const today = todayIso();
  // "new" for a new return, or the id of the one being updated.
  const [editing, setEditing] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const rows = [...incomeTaxReturns]
    .sort((a, b) => b.year - a.year)
    .map((record) => ({
      ...record,
      taxable: taxableIncomeOf(record),
      tax: incomeTaxOf(record),
      balance: incomeTaxBalance(record),
      status: incomeTaxStatus(record, today),
    }));

  const totalTax = rows.reduce((total, r) => total + r.tax, 0);
  const totalPaid = rows.reduce((total, r) => total + Number(r.paidAmount || 0), 0);
  const totalBalance = rows.reduce((total, r) => total + Math.max(r.balance, 0), 0);
  const overdue = rows.filter((r) => r.status === "overdue").length;
  const record = typeof editing === "number" ? incomeTaxReturns.find((r) => r.id === editing) : null;

  const columns = [
    {
      key: "year",
      header: "Tax Year",
      width: "9%",
      sortValue: (row) => row.year,
      render: (value) => <span className="text-base font-semibold text-primary">{value}</span>,
    },
    {
      key: "revenue",
      header: "Revenue & Deductible Expenses",
      width: "14%",
      exportValue: (row) => omr(row.revenue) + " - " + omr(row.expenses),
      sortValue: (row) => row.revenue,
      render: (value, row) => (
        <div className="whitespace-nowrap">
          <p>{omr(value)}</p>
          <p className="text-muted-foreground">{omr(row.expenses)}</p>
        </div>
      ),
    },
    {
      key: "taxable",
      header: "Taxable Income",
      width: "12%",
      exportValue: (row) => omr(row.taxable),
      sortValue: (row) => row.taxable,
      render: (value) => <span className="whitespace-nowrap">{omr(value)}</span>,
    },
    {
      key: "tax",
      header: "Income Tax at " + RATE_LABEL,
      width: "12%",
      exportValue: (row) => omr(row.tax),
      sortValue: (row) => row.tax,
      render: (value) => <span className="whitespace-nowrap font-semibold text-primary">{omr(value)}</span>,
    },
    {
      key: "due",
      header: "Due Date",
      width: "9%",
      exportValue: (row) => shortDate(incomeTaxDueDate(row.year)),
      sortValue: (row) => row.year,
      render: (_, row) => <span className="whitespace-nowrap">{shortDate(incomeTaxDueDate(row.year))}</span>,
    },
    {
      key: "filedOn",
      header: "Filing",
      subHeader: "Filed On / Reference",
      width: "13%",
      exportValue: (row) => (row.filedOn ? shortDate(row.filedOn) + " - " + row.returnNo : "-"),
      render: (value, row) =>
        value ? (
          <div>
            <p className="whitespace-nowrap">{shortDate(value)}</p>
            <p className="text-muted-foreground">{row.returnNo}</p>
            {row.file && (
              <p title={row.file} className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                Return
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "paidAmount",
      header: "Paid & Balance",
      width: "12%",
      exportValue: (row) => omr(row.paidAmount) + " - balance " + omr(row.balance),
      sortValue: (row) => row.balance,
      render: (value, row) => (
        <div className="whitespace-nowrap">
          <p>{omr(value)}</p>
          {row.paidOn && <p className="text-xs text-muted-foreground">on {shortDate(row.paidOn)}</p>}
          <p className={cn("font-semibold", row.balance > 0 ? "text-red-600" : "text-green-700")}>
            {row.balance > 0 ? omr(row.balance) + " due" : "Nothing due"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      exportValue: (row) => INCOME_TAX_STATUS[row.status].label,
      render: (value) => (
        <span className={cn("inline-flex items-center gap-2 whitespace-nowrap font-medium", INCOME_TAX_STATUS[value].text)}>
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", INCOME_TAX_STATUS[value].dot)} />
          {INCOME_TAX_STATUS[value].label}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      width: "7%",
      disableSort: true,
      exportValue: () => "",
      render: (_, row) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={editing !== null}
          onClick={() => setEditing(row.id)}
        >
          Update
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Landmark}
        title="Income Tax"
        note="Corporate income tax returns and payments"
        onAdd={editing === null ? () => setEditing("new") : null}
        addLabel="Add Tax Return"
      />

      <SummaryStrip
        items={[
          { key: "tax", label: "Income Tax", value: omr(totalTax), note: "On every year on record" },
          { key: "paid", label: "Paid", value: omr(totalPaid), tone: "text-green-700", note: "Paid to the tax authority" },
          {
            key: "balance",
            label: "Balance Due",
            value: omr(totalBalance),
            tone: totalBalance > 0 ? "text-red-600" : "text-green-700",
            note: "Tax not yet paid",
          },
          {
            key: "overdue",
            label: "Returns Overdue",
            value: overdue,
            tone: overdue ? "text-red-600" : "text-green-700",
            note: overdue ? "Past the end of April" : "None overdue",
          },
        ]}
      />

      {editing !== null && (
        <IncomeTaxForm
          key={String(editing)}
          record={record}
          takenYears={incomeTaxReturns.map((r) => r.year)}
          onCancel={() => setEditing(null)}
          onSave={(values) => {
            if (record) updateIncomeTaxReturn(record.id, values);
            else addIncomeTaxReturn(values);
            setEditing(null);
            setCurrentPage(1);
          }}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <FormHeading icon={FileText} title="Income Tax Returns" note="One return a year, the latest first" />
          <DataTable
            columns={columns}
            itemLabel="tax returns"
            data={rows}
            searchPlaceholder="Ask about income tax..."
            exportFileName="income-tax-returns.csv"
            enableColumnSearch={false}
            enableSorting
            currentPage={currentPage}
            totalPages={Math.ceil(rows.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
