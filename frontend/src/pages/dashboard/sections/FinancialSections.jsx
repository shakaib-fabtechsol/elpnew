import { Wallet, ReceiptText } from "lucide-react";
import { SectionCard, Tile, Row, EmptyState } from "@/components/shared/panels";
import {
  financialSnapshot,
  unbilledCases,
  money,
  formatDate,
  daysUntil,
} from "../dashboardData";

export function FinancialSnapshot() {
  const f = financialSnapshot;

  return (
    <SectionCard title="Financial Snapshot" icon={Wallet}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Total Invoices" value={f.totalInvoices} to="/finance" />
        <Tile label="Paid Invoices" value={f.paidInvoices} tone="good" to="/finance?status=Paid" />
        <Tile label="Pending Invoices" value={f.pendingInvoices} tone="warning" to="/finance?status=Pending" />
        <Tile label="Collected This Month" value={money(f.collectedThisMonth)} tone="good" to="/finance" />
        <Tile label="Outstanding Amount" value={money(f.outstandingAmount)} tone="high" to="/finance?status=Overdue" />
        <Tile label="Unbilled Legal Work" value={money(f.unbilledWork)} tone="warning" to="/finance" />
        <Tile label="Expenses" value={money(f.expenses)} to="/finance" />
      </div>
    </SectionCard>
  );
}

export function UnbilledCases() {
  const total = unbilledCases.reduce((sum, c) => sum + c.estimate, 0);

  return (
    <SectionCard
      title="Unbilled Cases / Pending Billing"
      icon={ReceiptText}
      action={
        <span className="text-xs text-muted-foreground">{money(total)} unbilled</span>
      }
    >
      <div className="space-y-3">
        {unbilledCases.length === 0 && (
          <EmptyState>Every completed service has been invoiced.</EmptyState>
        )}
        {unbilledCases.map((item) => (
          <Row key={item.id} to="/finance">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.service}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.caseNo} &middot; {item.client} &middot; completed{" "}
                {formatDate(item.completed)} (
                {Math.abs(daysUntil(item.completed))} days ago)
              </p>
            </div>
            <span className="w-24 shrink-0 text-end text-sm font-semibold">
              {money(item.estimate)}
            </span>
          </Row>
        ))}
      </div>
    </SectionCard>
  );
}
