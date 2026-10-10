import { createContext, useContext } from "react";

export const BonusesContext = createContext(null);

export function useBonuses() {
  const context = useContext(BonusesContext);
  if (!context) {
    throw new Error("useBonuses must be used inside BonusesProvider");
  }
  return context;
}
