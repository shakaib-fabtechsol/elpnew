import { createContext, useContext } from "react";

export const SuppliersContext = createContext(null);

/** The supplier directory, shared by the suppliers pages and the invoice form. */
export function useSuppliers() {
  const value = useContext(SuppliersContext);
  if (!value) {
    throw new Error("useSuppliers must be used inside SuppliersProvider");
  }
  return value;
}
