import { createContext, useContext } from "react";

export const AdvancesContext = createContext(null);

export function useAdvances() {
  const context = useContext(AdvancesContext);
  if (!context) {
    throw new Error("useAdvances must be used inside AdvancesProvider");
  }
  return context;
}
