import { useMemo, useState } from "react";
import { SuppliersContext } from "./context";
import { initialSuppliers } from "@/pages/suppliers/supplierData";
import { loadSuppliers } from "@/lib/api/modules/suppliers";
import { attempt } from "@/lib/api/notice";

/**
 * The supplier directory, loaded from the API at sign-in.
 *
 * The server registers a supplier when an invoice claim names a new one, so
 * after such a claim the directory is read again rather than added to here.
 * Adding and editing on the Suppliers page stay on this screen until the API
 * takes them.
 */
export default function SuppliersProvider({ children }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);

  const value = useMemo(
    () => ({
      suppliers,
      addSupplier: (supplier) =>
        setSuppliers((prev) => {
          const id = prev.reduce((max, s) => Math.max(max, s.id), 0) + 1;
          return [
            ...prev,
            { ...supplier, id, supplierId: "SUP-" + String(id).padStart(3, "0") },
          ];
        }),
      updateSupplier: (id, changes) =>
        setSuppliers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...changes } : s))
        ),
      removeSupplier: (id) =>
        setSuppliers((prev) => prev.filter((s) => s.id !== id)),
      /** The directory read back from the server, keeping what only this screen holds. */
      refreshSuppliers: async () => {
        const rows = await attempt(() => loadSuppliers(suppliers));
        if (rows) setSuppliers(rows);
        return rows;
      },
    }),
    [suppliers]
  );

  return (
    <SuppliersContext.Provider value={value}>
      {children}
    </SuppliersContext.Provider>
  );
}
