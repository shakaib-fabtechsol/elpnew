import { useMemo, useState } from "react";
import { TaxesContext } from "./context";
import { initialIncomeTaxReturns, initialVatFilings } from "@/pages/taxes/taxData";

/**
 * What happened at the tax office: VAT returns filed, keyed by quarter, and
 * income tax returns, one a year. The amounts on a VAT return are not kept
 * here - they are worked out from the invoices each time.
 */
export default function TaxesProvider({ children }) {
  const [vatFilings, setVatFilings] = useState(initialVatFilings);
  const [incomeTaxReturns, setIncomeTaxReturns] = useState(initialIncomeTaxReturns);

  // Editing the seed data while the app is open hot-reloads this provider
  // with its old state kept. Start again from the new seed whenever it changes.
  const [seed, setSeed] = useState(initialIncomeTaxReturns);
  if (seed !== initialIncomeTaxReturns) {
    setSeed(initialIncomeTaxReturns);
    setVatFilings(initialVatFilings);
    setIncomeTaxReturns(initialIncomeTaxReturns);
  }

  const value = useMemo(
    () => ({
      vatFilings,

      /** The filing of one quarter's return, by its key ("2026-Q2"). */
      recordVatFiling: (key, filing) =>
        setVatFilings((prev) => ({ ...prev, [key]: filing })),

      incomeTaxReturns,

      addIncomeTaxReturn: (record) =>
        setIncomeTaxReturns((prev) => [
          ...prev,
          { ...record, id: prev.reduce((max, r) => Math.max(max, r.id), 0) + 1 },
        ]),

      updateIncomeTaxReturn: (id, changes) =>
        setIncomeTaxReturns((prev) =>
          prev.map((record) => (record.id === id ? { ...record, ...changes } : record))
        ),
    }),
    [vatFilings, incomeTaxReturns]
  );

  return <TaxesContext.Provider value={value}>{children}</TaxesContext.Provider>;
}
