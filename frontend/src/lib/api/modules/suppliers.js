import { fetchAll } from "../client";
import { registerLoader } from "../session";
import { replaceAll } from "../store";
import { initialSuppliers } from "@/pages/suppliers/supplierData";

/**
 * Suppliers (GET /suppliers) - read-only on the server for now: an invoice
 * claim registers a new supplier there, and the directory is read back after.
 *
 * The API does not hold a supplier's TIN, bank or account yet. Those are kept
 * from the record the app already had under the same name, so nothing the
 * Suppliers page shows is lost.
 */

export function supplierFromApi(s, known = []) {
  const before = known.find((row) => row.name.toLowerCase() === String(s.name).toLowerCase());
  return {
    taxIdentificationNumber: "",
    bank: "",
    accountNumber: "",
    ...before,
    id: s.id,
    supplierId: s.supplierNo,
    name: s.name,
    category: s.category || "",
    // The directory writes "-" where a supplier has no tax number.
    commercialRegistration: s.commercialRegistration || "-",
    vatNumber: s.vatNumber || "-",
    phone: s.phone || before?.phone || "",
    email: s.email || before?.email || "",
    status: s.status || "Active",
    ...(s.autoRegistered ? { source: "AI invoice analysis" } : {}),
  };
}

/**
 * The directory as the server has it now, over `known`. A supplier added on
 * the Suppliers page is not on the server yet (there is no endpoint to save
 * one), so it stays on the list.
 */
export async function loadSuppliers(known = initialSuppliers) {
  const rows = (await fetchAll("suppliers", {}, 200)).map((row) => supplierFromApi(row, known));
  const onServer = new Set(rows.map((row) => row.name.toLowerCase()));
  let next = rows.reduce((max, row) => Math.max(max, row.id), 0);
  const ids = new Set(rows.map((row) => row.id));
  // Kept under an id of their own, should the server have handed theirs out.
  const local = known
    .filter((row) => !onServer.has(row.name.toLowerCase()))
    .map((row) => (ids.has(row.id) ? { ...row, id: ++next } : row));
  return [...rows, ...local];
}

registerLoader("suppliers", async () => {
  replaceAll(initialSuppliers, await loadSuppliers([...initialSuppliers]));
});
