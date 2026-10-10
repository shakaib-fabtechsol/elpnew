import { createContext, useContext } from "react";

export const LeasesContext = createContext(null);

/** The firm's leases, shared by the leases table and each lease's own page. */
export function useLeases() {
  const value = useContext(LeasesContext);
  if (!value) {
    throw new Error("useLeases must be used inside LeasesProvider");
  }
  return value;
}
