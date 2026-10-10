import { useMemo, useState } from "react";
import { ExpensesContext } from "./context";
import {
  initialExpenses,
  initialInvoices,
  nextRequestNo,
  requestClosed,
} from "@/pages/expenses/expenseData";
import { initialJudicialExpenses } from "@/pages/expenses/judicialData";

const nextId = (rows) => rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;

/**
 * Holds both halves of the expenses module: the expenses recorded directly,
 * and the general invoices that travel through the approval workflow. Keeping
 * them here lets the list pages and their add forms live on separate routes.
 */
export default function ExpensesProvider({ children }) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [judicialExpenses, setJudicialExpenses] = useState(
    initialJudicialExpenses
  );

  const value = useMemo(
    () => ({
      expenses,
      addExpense: (expense) =>
        setExpenses((prev) => [{ ...expense, id: nextId(prev) }, ...prev]),
      removeExpense: (id) =>
        setExpenses((prev) => prev.filter((e) => e.id !== id)),

      // Court fees, paid on a case's behalf.
      judicialExpenses,
      addJudicialExpense: (expense) =>
        setJudicialExpenses((prev) => [
          { ...expense, id: nextId(prev) },
          ...prev,
        ]),

      invoices,
      addInvoice: (invoice) =>
        setInvoices((prev) => [
          {
            ...invoice,
            id: nextId(prev),
            reference: "GIN-2026-" + String(prev.length + 1).padStart(3, "0"),
            requestNo: nextRequestNo(prev),
          },
          ...prev,
        ]),
      // A request that has been paid has nothing left to chase, so it gives up
      // its request number here rather than at each of the call sites.
      updateInvoice: (id, changes) =>
        setInvoices((prev) =>
          prev.map((i) => {
            if (i.id !== id) return i;
            const next = { ...i, ...changes };
            return requestClosed(next.status)
              ? { ...next, requestNo: null }
              : next;
          })
        ),
    }),
    [expenses, invoices, judicialExpenses]
  );

  return (
    <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>
  );
}
