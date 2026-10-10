import { createContext, useContext } from "react";

export const TaxesContext = createContext(null);

export function useTaxes() {
  const context = useContext(TaxesContext);
  if (!context) {
    throw new Error("useTaxes must be used inside TaxesProvider");
  }
  return context;
}
