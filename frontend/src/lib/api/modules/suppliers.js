import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { replaceAll, upsert } from "../store";
import { initialSuppliers } from "@/pages/suppliers/supplierData";

/**
 * Suppliers (/suppliers). The directory is kept on the server: the Suppliers
 * page adds and edits there (management only), and an invoice claim registers
 * a supplier it does not know - after which the directory is read back.
 */

export function supplierFromApi(s) {
  return {
    id: s.id,
    supplierId: s.supplierNo,
    name: s.name,
    category: s.category || "",
    // The directory writes "-" where a supplier has no tax number.
    commercialRegistration: s.commercialRegistration || "-",
    taxIdentificationNumber: s.taxIdentificationNumber || "",
    vatNumber: s.vatNumber || "-",
    bank: s.bank || "",
    accountNumber: s.accountNumber || "",
    phone: s.phone || "",
    email: s.email || "",
    status: s.status || "Active",
    ...(s.autoRegistered ? { source: "AI invoice analysis" } : {}),
  };
}

/** What was typed, or null: an empty field and the directory's "-" both mean none. */
const filled = (value) => {
  const text = String(value ?? "").trim();
  return text && text !== "-" ? text : null;
};

/** The fields the server keeps, out of the form's record. */
const FIELDS = [
  "name",
  "category",
  "commercialRegistration",
  "taxIdentificationNumber",
  "vatNumber",
  "bank",
  "accountNumber",
  "phone",
  "status",
];

/** A supplier as the API takes it: only the fields the record carries. */
function supplierToApi(record) {
  const body = {};
  FIELDS.forEach((field) => {
    if (field in record) body[field] = filled(record[field]);
  });
  // A supplier is Active unless it says otherwise; an empty status is not sent.
  if (body.status === null) delete body.status;
  return body;
}

/** Every answer replaces the supplier on the list it came from. */
const keep = (json) => upsert(initialSuppliers, supplierFromApi(json.data));

export const suppliersApi = {
  /** Adds a supplier; the server numbers it (SUP-017). */
  async create(record) {
    return keep(await api("suppliers", { method: "POST", body: supplierToApi(record) }));
  },

  /** Changes what `changes` carries and leaves the rest as it is. */
  async update(id, changes) {
    return keep(await api(`suppliers/${id}`, { method: "PATCH", body: supplierToApi(changes) }));
  },
};

/** The directory as the server has it now. */
export async function loadSuppliers() {
  return (await fetchAll("suppliers", {}, 200)).map(supplierFromApi);
}

registerLoader("suppliers", async () => {
  replaceAll(initialSuppliers, await loadSuppliers());
});
