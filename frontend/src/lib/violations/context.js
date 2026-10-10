import { createContext, useContext } from "react";

export const ViolationsContext = createContext(null);

export function useViolations() {
  const context = useContext(ViolationsContext);
  if (!context) {
    throw new Error("useViolations must be used inside ViolationsProvider");
  }
  return context;
}
