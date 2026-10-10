import { Card, CardContent } from "@/components/ui/card";
import RequestTable from "@/components/shared/RequestTable";
import { RecordLink } from "@/components/shared/RecordTable";
import { amountValue, money } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useAdvances } from "@/lib/advances/context";
import {
  SALARY_STATUS_TONE,
  isSalaryRequest,
  salaryHistoryRows,
  salaryPeriod,
  salaryRef,
} from "../payrollData";
import { ADVANCE_STATUS_CHIP, advanceStatusOf, advancesFor } from "../advanceSalaryData";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A month as one number, so two months subtract to the months between. */
const monthIndex = (year, month) => Number(year) * 12 + Number(month);

/** How each transfer status is marked. */
const STATUS_CHIP = {
  ...SALARY_STATUS_TONE,
  ...ADVANCE_STATUS_CHIP,
  Transferred: "bg-green-100 text-green-800",
};

/**
 * The salary and the advances against it, in one table.
 *
 * An advance is on it from the moment it is asked for, under its request
 * number, while it waits on a decision - and keeps that number if it is
 * refused. Once approved it is a payment out of that month's salary, so it
 * takes the month's salary payment number with a sequence after it: the
 * first advance in October is SAL-007/1, a second SAL-007/2, and the rest of
 * October's salary, paid later, the next in turn.
 */
export default function SalaryLedger({
  employee,
  history,
  onOpenAdvance,
  onOpenSalary,
  onAdd,
  addLabel,
  moreAdds = [],
}) {
  const { advances } = useAdvances();
  const salaries = salaryHistoryRows(history);

  // The salary payment number of a month: the one it was paid under, or - for
  // a month not paid yet - counted on from the last one paid.
  const numbered = salaries.filter((row) => row.salaryNo);
  const last = numbered.reduce(
    (best, row) => (!best || monthIndex(row.year, row.month) > monthIndex(best.year, best.month) ? row : best),
    null
  );
  const salaryNoFor = (year, month) => {
    const paid = numbered.find((row) => row.year === Number(year) && row.month === Number(month));
    if (paid) return paid.salaryNo;
    const base = last ? Number(String(last.salaryNo).replace(/\D/g, "")) : 0;
    const ahead = last ? monthIndex(year, month) - monthIndex(last.year, last.month) : 1;
    return "SAL-" + String(base + ahead).padStart(3, "0");
  };

  // The approved advances, in the order they were approved, month by month:
  // their place in the month's run is their sequence.
  const approved = advancesFor(advances, employee?.name)
    .filter((advance) => advanceStatusOf(advance) === "Approved")
    .sort((a, b) =>
      String(a.decidedOn || a.requestedOn).localeCompare(String(b.decidedOn || b.requestedOn))
    );
  const sequence = {};
  const advanceNo = {};
  approved.forEach((advance) => {
    const month = MONTH_NAMES.indexOf(advance.deductMonth) + 1;
    const key = advance.deductYear + "-" + month;
    sequence[key] = (sequence[key] || 0) + 1;
    advanceNo[advance.id] = salaryNoFor(advance.deductYear, month) + "/" + sequence[key];
  });

  const advanceRows = advancesFor(advances, employee?.name).map((advance) => {
    const status = advanceStatusOf(advance);
    const granted = status === "Approved";
    return {
      id: "advance-" + advance.id,
      kind: "advance",
      record: advance,
      no: granted ? advanceNo[advance.id] : advance.requestNo,
      period: advance.deductMonth + " " + advance.deductYear,
      summary: "Salary Advance" + (advance.purpose ? " · " + advance.purpose : ""),
      net: granted ? Number(advance.approvedAmount ?? advance.amount) : Number(advance.amount),
      status: granted ? (advance.paidOn ? "Transferred" : "Approved") : status,
      transfer: advance.paidOn ? [advance.method, advance.reference].filter(Boolean).join(" / ") : "",
      date: advance.requestedOn,
    };
  });

  // A month's own salary comes after any advance already paid out of it.
  const salaryRows = salaries.map((row) => {
    const taken = sequence[row.year + "-" + row.month] || 0;
    return {
      id: "salary-" + row.id,
      kind: "salary",
      record: row,
      no: row.salaryNo && taken ? row.salaryNo + "/" + (taken + 1) : salaryRef(row),
      period: salaryPeriod(row),
      summary: "Salary",
      parts: row,
      net: row.net,
      status: row.status,
      transfer: [row.method, row.reference].filter(Boolean).join(" / "),
      date: row.paymentDate || row.year + "-" + String(row.month).padStart(2, "0") + "-28",
    };
  });

  // Newest first: a request just made is the first row.
  const rows = [...advanceRows, ...salaryRows].sort((a, b) =>
    String(b.date).localeCompare(String(a.date))
  );

  const columns = [
    {
      key: "no",
      header: "Salary No.",
      width: "13%",
      render: (value, row) => {
        const opens =
          row.kind === "advance" ? onOpenAdvance : isSalaryRequest(row.record) ? onOpenSalary : null;
        return opens ? (
          <RecordLink onClick={() => opens(row.record)}>{value}</RecordLink>
        ) : (
          <span className="font-semibold text-primary">{value}</span>
        );
      },
    },
    { key: "period", header: "Salary Period", width: "14%" },
    {
      key: "summary",
      header: "Salary Summary",
      width: "30%",
      render: (value, row) =>
        row.kind === "salary" ? (
          <span className="text-muted-foreground">
            Basic <span className="font-semibold text-primary">{amountValue(row.parts.basic)}</span>
            <span className="px-1.5">/</span>
            Allowances <span className="font-semibold text-primary">{amountValue(row.parts.allowances)}</span>
            <span className="px-1.5">/</span>
            Deductions <span className="font-semibold text-primary">{amountValue(row.parts.deductions)}</span>
          </span>
        ) : (
          <span className="font-medium text-primary">{value}</span>
        ),
    },
    {
      key: "net",
      header: "Net Salary",
      width: "13%",
      render: (value) => <span className="whitespace-nowrap font-bold text-green-700">{money(value)}</span>,
      exportValue: (row) => row.net,
    },
    {
      key: "status",
      header: "Transfer Status",
      width: "13%",
      render: (value) => (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_CHIP[value] || "bg-muted text-muted-foreground"
          )}
        >
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
          {value}
        </span>
      ),
    },
    {
      key: "transfer",
      header: "Transfer Details",
      width: "17%",
      render: (value) => <span className="text-primary">{value || "-"}</span>,
    },
  ];

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <RequestTable
          rows={rows}
          columns={columns}
          searchPlaceholder="Search by salary no., period, or transfer details..."
          itemLabel="salary payments"
          exportFileName="salary-payments.csv"
          filterBy={[
            { key: "status", label: "Transfer Status" },
            { key: "period", label: "Salary Period" },
          ]}
          onAdd={onAdd}
          addLabel={addLabel}
          moreAdds={moreAdds}
        />
      </CardContent>
    </Card>
  );
}
