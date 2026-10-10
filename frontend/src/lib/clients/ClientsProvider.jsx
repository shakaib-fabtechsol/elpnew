import { useMemo, useState } from "react";
import { ClientsContext } from "./context";
import { clientRecords } from "@/pages/clients/clientRecords";

export default function ClientsProvider({ children }) {
  const [clients, setClients] = useState(clientRecords);

  const value = useMemo(
    () => ({
      clients,

      findClient: (id) => clients.find((c) => c.id === Number(id)) || null,

      findByNo: (clientNo) =>
        clients.find((c) => c.clientNo === clientNo) || null,

      /**
       * Merge one client into another.
       *
       * The merged client is not deleted and keeps its own name: everything it
       * brought in now reads under the main client, but the trail back to where
       * those records came from has to survive, so the record stays and simply
       * points at its new home.
       *
       * `on` is the day the merge is booked for, and `name` / `arabicName` the
       * name the two are to carry from now on - which may be either of their
       * own names or a new one. Both are written onto the merged record too, so
       * the history can say what each merge produced rather than only what the
       * client is called today.
       */
      mergeClients: (fromNo, intoNo, { on, name, arabicName } = {}) =>
        setClients((prev) =>
          prev.map((client) => {
            if (client.clientNo === fromNo) {
              return {
                ...client,
                mergedIntoClientNo: intoNo,
                mergedOn: on || new Date().toISOString().slice(0, 10),
                mergeResultName: name || "",
                mergeResultArabic: arabicName || "",
              };
            }
            // The main client takes the name the merge settled on.
            if (client.clientNo === intoNo && name) {
              return {
                ...client,
                clientName: name,
                arabicName: arabicName || client.arabicName,
              };
            }
            return client;
          })
        ),
    }),
    [clients]
  );

  return (
    <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>
  );
}
