import { useMemo, useState } from "react";
import { SuppliersContext } from "./context";
import { initialSuppliers } from "@/pages/suppliers/supplierData";
import { loadSuppliers, suppliersApi } from "@/lib/api/modules/suppliers";
import { attempt } from "@/lib/api/notice";
import { upserted } from "@/lib/api/store";

/**
 * The supplier directory, loaded from the API at sign-in.
 *
 * Adding and editing are saved on the server, which numbers a new supplier;
 * each returns the saved supplier, or null when the server refused (the
 * refusal is shown), so a form can stay open on what was typed. The server
 * also registers a supplier when an invoice claim names a new one, so after
 * such a claim the directory is read again rather than added to here.
 */
export default function SuppliersProvider({ children }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);

  const value = useMemo(() => {
    const keep = (row) => {
      if (row) setSuppliers((prev) => upserted(prev, row));
      return row;
    };

    return {
      suppliers,
      addSupplier: async (supplier) => keep(await attempt(() => suppliersApi.create(supplier))),
      updateSupplier: async (id, changes) =>
        keep(await attempt(() => suppliersApi.update(id, changes))),
      removeSupplier: (id) =>
        setSuppliers((prev) => prev.filter((s) => s.id !== id)),
      /** The directory read back from the server. */
      refreshSuppliers: async () => {
        const rows = await attempt(() => loadSuppliers());
        if (rows) setSuppliers(rows);
        return rows;
      },
    };
  }, [suppliers]);

  return (
    <SuppliersContext.Provider value={value}>
      {children}
    </SuppliersContext.Provider>
  );
}
