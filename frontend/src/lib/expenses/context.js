import { createContext, useContext } from "react";

export const ExpensesContext = createContext(null);

/** Recorded expenses, shared between the list page and the add form. */
export function useExpenses() {
  const value = useContext(ExpensesContext);
  if (!value) {
    throw new Error("useExpenses must be used inside ExpensesProvider");
  }
  return value;
}
