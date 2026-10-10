import { api } from "../client";
import { registerLoader } from "../session";

/**
 * The firm's own bank accounts (/bank-accounts) - where every payment form
 * says the money left from. The API's fields are the ones the screens
 * already use; only empty values need turning from null into "".
 */

const accountFromApi = (a) =>
  Object.fromEntries(Object.entries(a).map(([key, value]) => [key, value ?? (key === "branchId" ? null : "")]));

/** What the API keeps of an account, from the form's fields. */
const FIELDS = [
  "bankName", "logo", "bankBranch", "branchArea", "location", "accountName", "accountType",
  "accountNumber", "iban", "swift", "branchId", "openingBalance", "active",
];

const body = (account) =>
  Object.fromEntries(
    FIELDS.filter((key) => key in account).map((key) => [
      key,
      account[key] === "" ? null : key === "openingBalance" ? Number(account[key]) || 0 : account[key],
    ])
  );

export const firmApi = {
  async bankAccounts() {
    const json = await api("bank-accounts");
    return json.data.map(accountFromApi);
  },

  async addBankAccount(account) {
    const json = await api("bank-accounts", { method: "POST", body: body(account) });
    return accountFromApi(json.data);
  },

  async updateBankAccount(id, changes) {
    const json = await api(`bank-accounts/${id}`, { method: "PATCH", body: body(changes) });
    return accountFromApi(json.data);
  },
};

// FirmProvider is mounted before sign-in (the sign-in page shows the firm's
// name), so it cannot simply start from the loaded list: it is told when the
// accounts arrive.
registerLoader("firm bank accounts", async () => {
  const accounts = await firmApi.bankAccounts();
  window.dispatchEvent(new CustomEvent("sadeed:bank-accounts", { detail: accounts }));
});
