import { createContext, useContext } from "react";

export const LeavesContext = createContext(null);

export function useLeaves() {
  const context = useContext(LeavesContext);
  if (!context) {
    throw new Error("useLeaves must be used inside LeavesProvider");
  }
  return context;
}
