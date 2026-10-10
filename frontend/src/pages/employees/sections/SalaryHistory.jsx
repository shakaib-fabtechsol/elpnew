import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AiSearch from "@/components/shared/AiSearch";
import { EmptyState } from "@/components/shared/panels";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
} from "@/components/shared/RecordTable";
import { cn } from "@/lib/utils";
import { money, amountValue } from "@/lib/money";
import { smartSearch } from "@/lib/search/smartSearch";
import {
  SALARY_STATUS_TONE,
  salaryHistory,
  salaryHistoryRows,
  salaryPeriod,
  salaryRef,
  isSalaryRequest,
} from "../payrollData";

/** One figure of the summary: what it is, then how much it was. */
function Part({ label, value }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="font-medium text-primary">{value}</span>
    </span>
  );
}

/**
 * What has been paid, month by month.
 *
 * One row to a salary: what the month came to, what was transferred, and how.
 * The net is not stored - it is the three figures beside it, and a stored total
 * could disagree with them.
 */
export default function SalaryHistory({
  history = salaryHistory,
  // What to do when a request's temporary number is clicked.
  onOpenRequest = null,
  // The way to add, on the row above the list it adds to.
  onAdd = null,
  addLabel = "Add Salary",
}) {
  const [query, setQuery] = useState("");

  // Newest first, and each row carrying the period it is for so the search
  // finds "September 2026" the way the table writes it.
  const rows = salaryHistoryRows(history).map((row) => ({
    ...row,
    period: salaryPeriod(row),
  }));

  const shown = smartSearch(rows, query);

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        {/* The search on the left, where every list in the system has it, and
            the name of what is being searched on the right. */}
        {/* The search on the left, where every list in the system has it,
            and the way to add on the right. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AiSearch
            value={query}
            onChange={setQuery}
            placeholder="Ask about salaries..."
          />
          {onAdd && (
            <Button variant="outline" type="button" className="ms-auto" onClick={onAdd}>
              <Plus className="me-2 h-4 w-4" />
              {addLabel}
            </Button>
          )}
        </div>

        {shown.length === 0 ? (
          <EmptyState>No salary matches that search.</EmptyState>
        ) : (
          <RecordTable minWidth={1040}>
            <HeadRow>
              <Th width="10%">Salary No.</Th>
              <Th width="16%">Salary Period</Th>
              <Th width="36%">Salary Summary</Th>
              <Th width="16%">Net Salary</Th>
              <Th width="22%">Transfer Details</Th>
            </HeadRow>
            <tbody>
              {shown.map((row) => (
                <Row key={row.id}>
                  {/* A request that has not been approved opens back into
                      the form: to be followed, corrected, or decided. Where
                      it stands is said under its own number rather than in a
                      column of its own. */}
                  <Td className="whitespace-nowrap font-bold text-primary">
                    {isSalaryRequest(row) && onOpenRequest ? (
                      <button
                        type="button"
                        onClick={() => onOpenRequest(row)}
                        className="rounded font-bold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {salaryRef(row)}
                      </button>
                    ) : (
                      salaryRef(row)
                    )}
                    <span
                      className={cn(
                        "mt-1 flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        SALARY_STATUS_TONE[row.status] ||
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                      />
                      {row.status}
                    </span>
                  </Td>

                  <Td className="whitespace-nowrap">{row.period}</Td>

                  {/* What the month was made of, read left to right: the pay,
                      what was added to it, and what came off. */}
                  <Td>
                    <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                      {/* Three figures in one cell: the currency is said once,
                          on the net beside them. */}
                      <Part label="Basic" value={amountValue(row.basic)} />
                      <span className="text-muted-foreground">/</span>
                      <Part label="Allowances" value={amountValue(row.allowances)} />
                      <span className="text-muted-foreground">/</span>
                      <Part label="Deductions" value={amountValue(row.deductions)} />
                    </span>
                  </Td>

                  {/* What actually reached the account, which is what the row
                      is for. */}
                  <Td className="whitespace-nowrap font-bold text-green-700">
                    {money(row.net)}
                  </Td>

                  <Td>
                    {row.method}
                    {row.reference && (
                      <>
                        <span className="px-1.5 text-muted-foreground">/</span>
                        {row.reference}
                      </>
                    )}
                  </Td>
                </Row>
              ))}
            </tbody>
          </RecordTable>
        )}
      </CardContent>
    </Card>
  );
}
