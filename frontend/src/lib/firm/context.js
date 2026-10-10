import { createContext, useContext } from "react";

export const FirmContext = createContext(null);

/**
 * Access to the law firm record.
 *
 * Section 1 of the specification requires the firm name to be stored once and
 * used everywhere it appears, so the header and every other consumer read it
 * from here rather than holding their own copy.
 */
export function useFirm() {
  const value = useContext(FirmContext);
  if (!value) {
    throw new Error("useFirm must be used inside FirmProvider");
  }
  return value;
}
