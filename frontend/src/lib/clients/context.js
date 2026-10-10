import { createContext, useContext } from "react";

export const ClientsContext = createContext(null);

/** The client directory, shared by the list, the profile and the merge screen. */
export function useClients() {
  const value = useContext(ClientsContext);
  if (!value) {
    throw new Error("useClients must be used inside ClientsProvider");
  }
  return value;
}
