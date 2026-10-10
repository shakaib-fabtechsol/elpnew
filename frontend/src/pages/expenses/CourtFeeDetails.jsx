import {
  useParams } from "react-router-dom";
import { useGoBack } from "@/lib/useGoBack";
import { Card,
  CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/shared/BackButton";
import { EmptyState } from "@/components/shared/panels";
import { cn } from "@/lib/utils";
import { ArrowLeft,
  FileText,
  Briefcase,
  Users,
  Scale,
  Receipt,
  CreditCard,
  Activity,
} from "lucide-react";
import { useExpenses } from "@/lib/expenses/context";
import { formatDate, money } from "./expenseData";

/** One labelled fact. */
function Fact({ label, children }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{children || "-"}</p>
    </div>
  );
}

/** A titled panel, so each side of the request reads on its own. */
function Panel({ title, children, className }) {
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <p className="mb-3 border-b pb-2 text-sm font-semibold text-primary">
        {title}
      </p>
      {children}
    </div>
  );
}

/** A document the request carries. Nothing is uploaded yet, so it is held. */
function DocumentLink({ file, children }) {
  if (!file) return <span className="text-muted-foreground">Not attached</span>;
  return (
    <a
      href={file}
      onClick={(event) => event.preventDefault()}
      title={file}
      className="inline-flex items-center gap-1.5 rounded text-sm text-primary focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      {children}
    </a>
  );
}

/** Who did a thing, and when. */
function Stamp({ label, name, date, time }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{name || "-"}</p>
      <p className="text-xs text-muted-foreground">
        {formatDate(date)} - {time}
      </p>
    </div>
  );
}

/**
 * One judicial expense, opened from its number on the list.
 *
 * The list has to fit two dozen rows on a screen, so it compresses; this page
 * has one request to show and spreads the same facts out rather than adding
 * new ones.
 */
export default function CourtFeeDetails() {
  const goBack = useGoBack("/court-fee-payments");
  const { id } = useParams();
  const { judicialExpenses } = useExpenses();

  const expense = judicialExpenses.find((e) => e.id === Number(id));

  if (!expense) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState>That expense is no longer on file.</EmptyState>
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={goBack}>
              Back to Judicial Authority Expenses
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/court-fee-payments" />
        <div className="rounded-xl bg-primary p-2 sm:p-3">
          <Briefcase className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">
            {expense.expenseNo}
          </h1>
          <p className="text-xs text-primary/75 sm:text-sm">
            {expense.branch} Branch &middot; {money(expense.amount)}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="form-grid form-grid-2">
            <Panel title="Case Parties" icon={Users}>
              <div className="grid grid-cols-2 gap-4">
                <Fact label="Client">{expense.client}</Fact>
                <Fact label="Opponent">{expense.opponent}</Fact>
              </div>
            </Panel>

            <Panel title="Case Details" icon={Scale}>
              <div className="grid grid-cols-2 gap-4">
                <Fact label="Court">{expense.court}</Fact>
                <Fact label="Level">{expense.level}</Fact>
                <Fact label="Case No.">{expense.caseNo}</Fact>
                <Fact label="Location">{expense.location}</Fact>
              </div>
            </Panel>

            <Panel title="Expense Details" icon={Receipt}>
              <div className="grid grid-cols-2 gap-4">
                <Fact label="Court Expense Type">{expense.expenseType}</Fact>
                <Fact label="Category">{expense.category}</Fact>
                <Fact label="Subcategory">{expense.subcategory}</Fact>
              </div>
              <div className="mt-4 flex flex-col gap-1 border-t pt-3">
                <DocumentLink file={expense.registrationReceipt}>
                  View Registration Receipt
                </DocumentLink>
                <DocumentLink file={expense.caseRecord}>
                  View Case Registration Record
                </DocumentLink>
              </div>
            </Panel>

            <Panel title="Payment Details" icon={CreditCard}>
              <p className="mb-3 text-2xl font-bold text-primary">
                {money(expense.amount)}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Fact label="Payment Method">{expense.paymentMethod}</Fact>
                <Fact label="Bank Name">{expense.bank}</Fact>
                <Fact label="Account No.">{expense.accountNo}</Fact>
              </div>
              <div className="mt-4 border-t pt-3">
                <DocumentLink file={expense.receipt}>
                  View Payment Receipt
                </DocumentLink>
              </div>
            </Panel>
          </div>

          <Panel title="Transaction Tracking" icon={Activity}>
            <div className="form-grid">
              <Stamp
                label="Submitted By:"
                name={expense.submittedBy}
                date={expense.submittedAt}
                time={expense.submittedTime}
              />
              <Stamp
                label="Accountant Approved By:"
                name={expense.accountantApprovedBy}
                date={expense.accountantApprovedAt}
                time={expense.accountantApprovedTime}
              />
              <Stamp
                label="Finance Manager Approved By:"
                name={expense.financeApprovedBy}
                date={expense.approvedAt}
                time={expense.approvedTime}
              />
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    expense.status === "Approved"
                      ? "text-green-600"
                      : "text-amber-600"
                  )}
                >
                  {expense.status}
                </p>
              </div>
            </div>
          </Panel>
        </CardContent>
      </Card>
    </div>
  );
}
