import { Briefcase, Users, Wallet, Landmark, FileText, Scale } from "lucide-react";
import { Fragment } from "react";
import { SectionCard, Tile } from "@/components/shared/panels";
import { useFirm } from "@/lib/firm/context";
import {
  overviewFigures,
  money,
  clients,
  cases,
  invoices,
  clientTotals,
  caseTotals,
} from "../firmData";

/**
 * Section 9 of the specification. Every figure here is computed from the same
 * records the other sections manage, so the overview cannot drift out of step
 * with them, and each one links through to where the detail lives.
 */
export default function OverviewSection({ onNavigateSection }) {
  const firm = useFirm();
  const figures = overviewFigures(firm);

  return (
    <div className="space-y-6">
      <SectionCard title="Cases" icon={Briefcase}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Total Cases" value={figures.cases.total} to="/litigation" />
          <Tile label="Active Cases" value={figures.cases.active} tone="good" to="/litigation?status=Active" />
          <Tile label="Closed Cases" value={figures.cases.closed} to="/litigation?status=Closed" />
          <Tile label="New Cases" value={figures.cases.newCases} tone="info" to="/litigation?newWithin=30" />
        </div>

        <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">
          Cases by Branch
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {figures.cases.byBranch.map(({ branch, count }) => (
            <Tile
              key={branch.id}
              label={branch.name + " (" + branch.branchNumber + ")"}
              value={count}
              to={"/litigation?branch=" + encodeURIComponent(branch.name)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Clients" icon={Users}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Total Clients" value={figures.clients.total} to="/clients" />
          <Tile label="Active Clients" value={figures.clients.active} tone="good" to="/clients?status=Active" />
          <Tile label="Clients with Open Cases" value={figures.clients.withOpenCases} to="/clients?status=Active" />
          <Tile label="Clients with Outstanding Payments" value={figures.clients.withOutstanding} tone="warning" to="/finance?status=Pending" />
        </div>
      </SectionCard>

      <SectionCard title="Financial" icon={Wallet}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Total Invoiced" value={money(figures.financial.totalInvoiced)} to="/finance" />
          <Tile label="Total Paid" value={money(figures.financial.totalPaid)} tone="good" to="/finance?status=Paid" />
          <Tile label="Total Outstanding" value={money(figures.financial.totalOutstanding)} tone="high" to="/finance?status=Pending" />
          <Tile label="Total Expenses" value={money(figures.financial.totalExpenses)} tone="warning" onClick={() => onNavigateSection("transactions")} />
        </div>
      </SectionCard>

      {/* Section 8: what each client and case has been invoiced, paid and owes */}
      <SectionCard title="Client and Case Balances" icon={Scale}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border text-sm">
            <thead>
              <tr className="border-b text-start text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Client / Case</th>
                <th className="pb-2 text-end font-medium">Total Invoiced</th>
                <th className="pb-2 text-end font-medium">Total Paid</th>
                <th className="pb-2 text-end font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const totals = clientTotals(client.id, firm);
                if (!totals.invoiced) return null;
                const clientCases = cases.filter(
                  (c) =>
                    c.clientId === client.id &&
                    invoices.some((i) => i.caseId === c.id)
                );
                return (
                  <Fragment key={client.id}>
                    <tr className="border-b">
                      <td className="py-2 font-medium">{client.name}</td>
                      <td className="py-2 text-end font-semibold">
                        {money(totals.invoiced)}
                      </td>
                      <td className="py-2 text-end text-green-600">
                        {money(totals.paid)}
                      </td>
                      <td className="py-2 text-end text-red-600">
                        {money(totals.outstanding)}
                      </td>
                    </tr>
                    {clientCases.map((legalCase) => {
                      const perCase = caseTotals(legalCase.id, firm);
                      return (
                        <tr key={legalCase.id} className="border-b transition-colors last:border-0 hover:bg-primary/10">
                          <td className="py-2 ps-6 text-muted-foreground">
                            Case {legalCase.caseNo}
                          </td>
                          <td className="py-2 text-end text-muted-foreground">
                            {money(perCase.invoiced)}
                          </td>
                          <td className="py-2 text-end text-muted-foreground">
                            {money(perCase.paid)}
                          </td>
                          <td className="py-2 text-end text-muted-foreground">
                            {money(perCase.outstanding)}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Bank Accounts" icon={Landmark}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            label="Total Bank Balance"
            value={money(figures.bank.total)}
            tone="good"
            onClick={() => onNavigateSection("bank")}
          />
          {figures.bank.byAccount.map(({ account, balance }) => (
            <Tile
              key={account.id}
              label={account.bankName + (account.active ? "" : " (disabled)")}
              value={money(balance)}
              onClick={() => onNavigateSection("bank")}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Documents" icon={FileText}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile
            label="Active Documents"
            value={figures.documents.active}
            tone="good"
            onClick={() => onNavigateSection("documents", { status: "Active" })}
          />
          <Tile
            label="Documents Expiring Soon"
            value={figures.documents.expiringSoon}
            tone="warning"
            onClick={() => onNavigateSection("documents", { status: "Expiring Soon" })}
          />
          <Tile
            label="Expired Documents"
            value={figures.documents.expired}
            tone="high"
            onClick={() => onNavigateSection("documents", { status: "Expired" })}
          />
        </div>
      </SectionCard>
    </div>
  );
}
