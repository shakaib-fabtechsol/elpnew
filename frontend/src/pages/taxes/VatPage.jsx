import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import FormHeading from "@/components/shared/FormHeading";
import SummaryStrip from "@/components/shared/SummaryStrip";
import { FileCheck2, FileText, ListChecks, Percent, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients } from "@/lib/clients/context";
import { useExpenses } from "@/lib/expenses/context";
import { useLeases } from "@/lib/leases/context";
import { useAssets } from "@/lib/assets/context";
import { useTaxes } from "@/lib/taxes/context";
import { clientInvoices } from "@/pages/clients/clientMockData";
import { TextField, Worked, Attach } from "@/pages/leases/fields";
import { omr, shortDate, todayIso } from "@/pages/leases/leaseData";
import {
  VAT_QUARTERS,
  VAT_RETURN_STATUS,
  periodKey,
  periodLabel,
  periodRange,
  vatDueDate,
  vatRecords,
  recordsIn,
  vatReturnOf,
  vatReturnStatus,
} from "./taxData";

const emptyFiling = { filedOn: "", returnNo: "", paidOn: "", paymentRef: "", file: "" };

/** "Payable" or "Refundable", for a net figure. */
const netWord = (net) => (net > 0 ? "Payable" : net < 0 ? "Refundable" : "Nothing due");

/** The filing of one quarter's return: when, its reference, and when the VAT was paid. */
function VatFilingForm({ vatReturn, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...emptyFiling, ...(vatReturn.filing || {}) }));
  const [error, setError] = useState("");
  const { year, quarter } = vatReturn;

  const set = (name, value) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const save = () => {
    if (!draft.filedOn || !draft.returnNo.trim()) {
      setError("Enter the filing date and the return reference number.");
      return;
    }
    onSave({ ...draft, returnNo: draft.returnNo.trim(), paymentRef: draft.paymentRef.trim() });
  };

  return (
    <Card>
      <CardContent className="space-y-6 p-4 sm:p-6">
        <FormHeading
          icon={FileCheck2}
          title={"Record VAT Return - " + periodLabel(year, quarter)}
          note={periodRange(year, quarter) + " · due by " + shortDate(vatDueDate(year, quarter))}
        />

        {/* The return's figures, from the invoices - shown, not typed. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {/* No unit in the labels: each figure arrives with the currency. */}
          <Worked id="vatFilingOutput" label="Output VAT" value={omr(vatReturn.output)} />
          <Worked id="vatFilingInput" label="Input VAT" value={omr(vatReturn.input)} />
          <Worked
            id="vatFilingNet"
            label={"Net VAT " + netWord(vatReturn.net)}
            value={omr(Math.abs(vatReturn.net))}
          />
        </div>

        <div className="form-grid">
          <TextField
            id="vatFiledOn"
            label="Filed On"
            required
            type="date"
            max={todayIso()}
            value={draft.filedOn}
            onChange={(value) => set("filedOn", value)}
          />
          <TextField
            id="vatReturnNo"
            label="Return Reference No."
            required
            value={draft.returnNo}
            onChange={(value) => set("returnNo", value)}
            placeholder={"e.g. VAT-" + year + "-Q" + quarter}
          >
            <Attach id="vatReturnFile" file={draft.file} onFile={(name) => set("file", name)} what="return copy" />
          </TextField>
          <TextField
            id="vatPaidOn"
            label="Payment Date"
            type="date"
            max={todayIso()}
            value={draft.paidOn}
            onChange={(value) => set("paidOn", value)}
          />
          <TextField
            id="vatPaymentRef"
            label="Payment Reference"
            value={draft.paymentRef}
            onChange={(value) => set("paymentRef", value)}
            placeholder="e.g. TRF-10021"
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
 * Value Added Tax, one year at a time.
 *
 * The four returns of the year come first - what each owes or reclaims, when
 * it is due and whether it has been filed - and under them every invoice that
 * carries VAT, so any figure on a return can be traced to the invoices behind
 * it. The figures are worked out from those invoices every time; only the
 * filing itself is recorded.
 */
export default function VatPage() {
  const { clients } = useClients();
  const { invoices } = useExpenses();
  const { leases } = useLeases();
  const { assets } = useAssets();
  const { vatFilings, recordVatFiling } = useTaxes();

  const today = todayIso();
  const [year, setYear] = useState(today.slice(0, 4));
  const [quarter, setQuarter] = useState("all");
  const [filingFor, setFilingFor] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const records = vatRecords({ clientInvoices, clients, invoices, leases, assets, today });
  const years = [...new Set([today.slice(0, 4), ...records.map((r) => r.date.slice(0, 4))])].sort(
    (a, b) => b.localeCompare(a)
  );

  const returns = VAT_QUARTERS.map((q) => {
    const filing = vatFilings[periodKey(year, q)];
    return {
      ...vatReturnOf(records, year, q),
      filing,
      status: vatReturnStatus(year, q, filing, today),
    };
  });
  const yearOutput = returns.reduce((total, r) => total + r.output, 0);
  const yearInput = returns.reduce((total, r) => total + r.input, 0);
  const yearNet = yearOutput - yearInput;
  const toFile = returns.filter((r) => r.status === "due" || r.status === "overdue");
  const overdue = toFile.filter((r) => r.status === "overdue").length;
  const openFiling = returns.find((r) => r.quarter === filingFor) || null;

  const chooseYear = (value) => {
    if (!value) return;
    setYear(value);
    setFilingFor(null);
    setCurrentPage(1);
  };

  const shown = recordsIn(records, year, quarter === "all" ? null : Number(quarter));

  const money = (value) => <span className="whitespace-nowrap">{omr(value)}</span>;

  const columns = [
    {
      key: "date",
      header: "Date",
      width: "10%",
      exportValue: (row) => shortDate(row.date),
      sortValue: (row) => row.date,
      render: (value) => <span className="whitespace-nowrap">{shortDate(value)}</span>,
    },
    {
      key: "direction",
      header: "Type",
      width: "11%",
      exportValue: (row) => row.direction + " VAT",
      render: (value) => (
        <span
          className={cn(
            "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
            value === "Output" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
          )}
        >
          {value} VAT
        </span>
      ),
    },
    { key: "source", header: "Source", width: "13%" },
    {
      key: "reference",
      header: "Reference",
      subHeader: "Party",
      width: "26%",
      exportValue: (row) => row.reference + " - " + row.party,
      render: (value, row) => (
        <div>
          <p className="font-semibold text-primary">{value}</p>
          <p className="text-muted-foreground">{row.party}</p>
        </div>
      ),
    },
    {
      key: "net",
      header: "Before VAT",
      width: "13%",
      className: "text-end",
      cellClassName: "text-end",
      exportValue: (row) => omr(row.net),
      sortValue: (row) => row.net,
      render: money,
    },
    {
      key: "vat",
      header: "VAT",
      width: "12%",
      className: "text-end",
      cellClassName: "text-end font-semibold text-primary",
      exportValue: (row) => omr(row.vat),
      sortValue: (row) => row.vat,
      render: money,
    },
    {
      key: "total",
      header: "Total",
      width: "13%",
      className: "text-end",
      cellClassName: "text-end",
      exportValue: (row) => omr(row.total),
      sortValue: (row) => row.total,
      render: money,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary p-2 sm:p-3">
            <Percent className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">Value Added Tax (VAT)</h1>
            <p className="text-xs text-primary/75 sm:text-sm">
              VAT returns, and the VAT on every invoice behind them
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Year</span>
          <Select value={year} onValueChange={chooseYear}>
            <SelectTrigger id="vatYear" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SummaryStrip
        items={[
          { key: "output", label: "Output VAT", value: omr(yearOutput), note: "Charged on client invoices in " + year },
          { key: "input", label: "Input VAT", value: omr(yearInput), note: "Paid on purchases, rent and assets" },
          {
            key: "net",
            label: "Net VAT " + netWord(yearNet),
            value: omr(Math.abs(yearNet)),
            tone: yearNet > 0 ? "text-red-600" : "text-green-700",
            note: "Output VAT less input VAT",
          },
          {
            key: "toFile",
            label: "Returns to File",
            value: toFile.length,
            tone: overdue ? "text-red-600" : toFile.length ? "text-amber-600" : "text-green-700",
            note: overdue ? overdue + " overdue" : "None overdue",
          },
        ]}
      />

      {openFiling && (
        <VatFilingForm
          key={periodKey(year, openFiling.quarter)}
          vatReturn={openFiling}
          onCancel={() => setFilingFor(null)}
          onSave={(filing) => {
            recordVatFiling(periodKey(year, openFiling.quarter), filing);
            setFilingFor(null);
          }}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <FormHeading
            icon={FileText}
            title="VAT Returns"
            note="One return a quarter, due by the end of the month after it"
          />
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-240 border text-sm">
              <thead>
                <tr className="border-b bg-secondary/60 text-start text-primary">
                  <th className="p-3 font-semibold">Period</th>
                  <th className="p-3 text-end font-semibold">Output VAT</th>
                  <th className="p-3 text-end font-semibold">Input VAT</th>
                  <th className="p-3 text-end font-semibold">Net VAT</th>
                  <th className="p-3 font-semibold">Due Date</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Filing Details</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {returns.map((row) => {
                  const status = VAT_RETURN_STATUS[row.status];
                  return (
                    <tr
                      key={row.quarter}
                      data-quarter={row.quarter}
                      className={cn(
                        "border-b align-top transition-colors last:border-0 hover:bg-primary/5",
                        filingFor === row.quarter && "bg-primary/5"
                      )}
                    >
                      <td className="p-3">
                        <p className="font-semibold text-primary">{periodLabel(year, row.quarter)}</p>
                        <p className="whitespace-nowrap text-xs text-muted-foreground">{periodRange(year, row.quarter)}</p>
                      </td>
                      <td className="whitespace-nowrap p-3 text-end">{omr(row.output)}</td>
                      <td className="whitespace-nowrap p-3 text-end">{omr(row.input)}</td>
                      <td className="whitespace-nowrap p-3 text-end">
                        <p className="font-semibold text-primary">{omr(Math.abs(row.net))}</p>
                        <p className="text-xs text-muted-foreground">{netWord(row.net)}</p>
                      </td>
                      <td className="whitespace-nowrap p-3">{shortDate(vatDueDate(year, row.quarter))}</td>
                      <td className="p-3">
                        <span className={cn("inline-flex items-center gap-2 whitespace-nowrap font-medium", status.text)}>
                          <span className={cn("h-2.5 w-2.5 rounded-full", status.dot)} />
                          {status.label}
                        </span>
                      </td>
                      <td className="p-3">
                        {row.filing?.filedOn ? (
                          <div className="text-xs">
                            <p>
                              <span className="text-muted-foreground">Filed On: </span>
                              {shortDate(row.filing.filedOn)}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Ref: </span>
                              {row.filing.returnNo}
                            </p>
                            {row.filing.paidOn && (
                              <p>
                                <span className="text-muted-foreground">Paid On: </span>
                                {shortDate(row.filing.paidOn)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-end">
                        {(row.status === "due" || row.status === "overdue" || row.status === "filed") && (
                          <Button
                            type="button"
                            size="sm"
                            variant={row.status === "filed" ? "outline" : "default"}
                            disabled={filingFor !== null}
                            onClick={() => setFilingFor(row.quarter)}
                            className="whitespace-nowrap"
                          >
                            {row.status === "filed" ? "Update" : "Record Filing"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/40 font-semibold text-primary">
                  <td className="p-3">{year}</td>
                  <td className="whitespace-nowrap p-3 text-end">{omr(yearOutput)}</td>
                  <td className="whitespace-nowrap p-3 text-end">{omr(yearInput)}</td>
                  <td className="whitespace-nowrap p-3 text-end">
                    {omr(Math.abs(yearNet))}
                    <span className="block text-xs font-normal text-muted-foreground">{netWord(yearNet)}</span>
                  </td>
                  <td className="p-3" colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <FormHeading
            icon={ListChecks}
            title="VAT Records"
            note="Every invoice that carries VAT - charged to clients, or paid to suppliers, landlords and on assets"
          />
          <DataTable
            columns={columns}
            data={shown}
            searchPlaceholder="Ask about VAT records..."
            exportFileName={"vat-records-" + year + ".csv"}
            enableColumnSearch={false}
            enableSorting
            currentPage={currentPage}
            totalPages={Math.ceil(shown.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            filters={
              <Select
                value={quarter}
                onValueChange={(value) => {
                  if (!value) return;
                  setQuarter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger id="vatQuarter" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quarters</SelectItem>
                  {VAT_QUARTERS.map((q) => (
                    <SelectItem key={q} value={String(q)}>
                      {periodLabel(year, q)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
