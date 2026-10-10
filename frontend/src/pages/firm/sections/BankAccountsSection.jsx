import { useState } from "react";
import ExcelIcon from "@/components/shared/ExcelIcon";
import UploadIcon from "@/components/shared/UploadIcon";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import FormHeading from "@/components/shared/FormHeading";
import { Card, CardContent } from "@/components/ui/card";
import SummaryStrip from "@/components/shared/SummaryStrip";
import AiSearch from "@/components/shared/AiSearch";
import TransactionsSection from "./TransactionsSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Paperclip,
  FileCheck,
  Plus,
  Search,
  Landmark,  Info,
} from "lucide-react";
import { EmptyState } from "@/components/shared/panels";
import { cn } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import { amountInWords } from "@/lib/amountInWords";
import { Rial } from "@/components/shared/Rial";
import { RECEIVING_BANKS, BANK_BRANCHES, ACCOUNT_TYPES } from "@/lib/constants";
import { useFirm } from "@/lib/firm/context";
import {
  accountBalance,
  branchLabel,
  bankInitials,
  maskAccountNumber,
  formatDate,
  invoices,
  money,
} from "../firmData";
import { checkRequired } from "@/components/shared/formFields";

import DateField from "@/components/shared/DateField";
const ALL_BANKS = "all";

const emptyAccount = {
  bankName: "",
  bankBranch: "",
  accountName: "",
  accountNumber: "",
  iban: "",
  openingBalance: "",
  accountType: "",
  logo: "",
  active: true,
};

const emptyTransfer = {
  fromAccountId: "",
  toAccountId: "",
  date: "",
  amount: "",
  reference: "",
};

/** Every field on the bank form is required, so the mark is part of the label. */
function FieldLabel({ htmlFor, children }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      
    </Label>
  );
}

/** A fact with its heading beside it, for the account and balance columns. */
function Pair({ label, children, strong }) {
  return (
    <p className="leading-relaxed">
      <span className="font-semibold text-muted-foreground">{label} </span>
      <span className={cn(strong && "font-bold text-primary")}>
        {children || "-"}
      </span>
    </p>
  );
}

/**
 * A bank's mark.
 *
 * Real artwork is used where the file exists; where it does not, the bank's
 * initials stand in. The fallback is drawn the same size and shape as the
 * artwork it replaces, so a row of cards stays a row of cards either way.
 */
function BankMark({ bank, className }) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-xs font-bold text-primary",
        className
      )}
    >
      {bank.logo ? (
        <img src={bank.logo} alt="" className="h-full w-full object-contain" />
      ) : (
        bankInitials(bank.bankName)
      )}
    </span>
  );
}

/** How an account is named wherever it has to be picked from a list. */
const accountLabel = (account, branches) =>
  account.accountNumber + " - " + branchLabel(branches, account.branchId);

/**
 * Reads a picked logo into the record itself.
 *
 * The file travels with the account rather than as a reference to somebody's
 * disk, so the mark does not go blank the moment the page is reloaded.
 */
function readLogo(file, set) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => set("logo", String(reader.result));
  reader.readAsDataURL(file);
}

/** The fields a bank account is made of. */
function BankFields({ draft, set }) {
  return (
    <div className="form-grid">
      <div className="space-y-2">
        <FieldLabel htmlFor="bankName">Bank Name</FieldLabel>
        <div className="flex gap-2">
          <Select
            value={draft.bankName}
            onValueChange={(value) => set("bankName", value)}
          >
            <SelectTrigger id="bankName">
              <SelectValue placeholder="Select Bank" />
            </SelectTrigger>
            <SelectContent>
              {RECEIVING_BANKS.map((bank) => (
                <SelectItem key={bank} value={bank}>
                  {bank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Beside the bank it belongs to, not in a field of its own: the
              logo describes the bank name, so it sits with it. */}
          {draft.logo ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 overflow-hidden border-green-600 p-1 hover:border-destructive"
              title="Bank logo attached - click to remove"
              onClick={() => set("logo", "")}
            >
              <img
                src={draft.logo}
                alt=""
                className="h-full w-full object-contain"
              />
              <span className="sr-only">Logo attached. Remove it.</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              title="Upload bank logo"
              asChild
            >
              <label className="cursor-pointer">
                <UploadIcon className="h-4 w-4" />
                <span className="sr-only">Upload bank logo</span>
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => readLogo(e.target.files[0], set)}
                />
              </label>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="bankBranch">Bank Branch</FieldLabel>
        <Select
          value={draft.bankBranch}
          onValueChange={(value) => set("bankBranch", value)}
        >
          <SelectTrigger id="bankBranch">
            <SelectValue placeholder="Enter Bank Branch" />
          </SelectTrigger>
          <SelectContent>
            {BANK_BRANCHES.map((branch) => (
              <SelectItem key={branch} value={branch}>
                {branch}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="accountName">Account Name</FieldLabel>
        <Input
          id="accountName"
          value={draft.accountName}
          onChange={(e) => set("accountName", e.target.value)}
          placeholder="Enter Account Name"
        />
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="accountNumber">Account Number</FieldLabel>
        <Input
          id="accountNumber"
          value={draft.accountNumber}
          onChange={(e) => set("accountNumber", e.target.value)}
          placeholder="Enter Account Number"
        />
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="iban">IBAN</FieldLabel>
        <Input
          id="iban"
          value={draft.iban}
          onChange={(e) => set("iban", e.target.value)}
          placeholder="Enter IBAN"
        />
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="openingBalance">Opening Balance</FieldLabel>
        <Input
          id="openingBalance"
          type="number"
          min="0"
          step="0.001"
          value={draft.openingBalance}
          onChange={(e) => set("openingBalance", e.target.value)}
          placeholder="Enter Opening Balance"
        />
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="accountType">Account Type</FieldLabel>
        <Select
          value={draft.accountType}
          onValueChange={(value) => set("accountType", value)}
        >
          <SelectTrigger id="accountType">
            <SelectValue placeholder="Select Account Type" />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="accountStatus">Account Status</FieldLabel>
        <Select
          value={draft.active ? "Active" : "Inactive"}
          onValueChange={(value) => set("active", value === "Active")}
        >
          <SelectTrigger id="accountStatus">
            <SelectValue placeholder="Select Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** The two lists this section holds, one at a time. */
const TABS = [
  {
    key: "accounts",
    label: "Bank Accounts",
    note: "Every account the firm holds, and what is in it",
  },
  {
    key: "transfer",
    label: "Account Transfers",
    note: "Money moved between the firm's own accounts",
  },
];

const tabOf = (key) => TABS.find((option) => option.key === key) || TABS[0];

const PAGE_SIZES = [10, 25, 50];

/**
 * The company's bank accounts, and money moved between them.
 *
 * A balance is never a stored, editable number - it is the running total of
 * everything recorded against the account, so nobody can type a balance the
 * transaction history does not support.
 *
 * The cards above the table are a filter as well as a summary: each bank has
 * one, and choosing it narrows the table to that bank's accounts.
 */
export default function BankAccountsSection({ canEdit, canRecord }) {
  const navigate = useNavigate();
  const firm = useFirm();
  const { bankAccounts, branches, transfers, addBankAccount, addTransfer } =
    firm;

  const ledgers = {
    payments: firm.payments,
    expenses: firm.expenses,
    transfers: firm.transfers,
    invoices,
  };

  const [tab, setTab] = useState("accounts");
  // The form is opened deliberately rather than sitting open under the list.
  const [adding, setAdding] = useState(false);
  const [selectedBank, setSelectedBank] = useState(ALL_BANKS);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [draft, setDraft] = useState(emptyAccount);
  const [transfer, setTransfer] = useState(emptyTransfer);
  const [receipt, setReceipt] = useState(null);

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));
  const setMove = (name, value) =>
    setTransfer((prev) => ({ ...prev, [name]: value }));

  const openAddBank = () => {
    setDraft(emptyAccount);
    setTab("accounts");
    setAdding(true);
  };

  const closeAddBank = () => {
    setDraft(emptyAccount);
    setAdding(false);
  };

  const balanceOf = (account) => accountBalance(account, ledgers);
  const accountById = (id) => bankAccounts.find((a) => a.id === Number(id));

  /** How an account reads inside a transfer row. */
  const accountLine = (account) =>
    account
      ? account.bankName + " (" + branchLabel(branches, account.branchId) + ")"
      : "-";

  const totalBalance = bankAccounts.reduce(
    (sum, account) => sum + balanceOf(account),
    0,
  );

  // One card per account. Two accounts at the same bank get a card each, so
  // the card names the account as well as the bank - otherwise the two would
  // be indistinguishable.
  const bankNames = [...new Set(bankAccounts.map((a) => a.bankName))];

  const choose = (value) => {
    setSelectedBank(value);
    setPage(1);
  };

  const search = query.trim().toLowerCase();
  const listed = bankAccounts
    .filter((account) => {
      if (selectedBank !== ALL_BANKS && String(account.id) !== selectedBank) {
        return false;
      }
      if (!search) return true;
      return [
        account.bankName,
        account.accountName,
        account.accountNumber,
        account.iban,
        account.swift,
        account.bankBranch,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    })
    // The account added most recently at the top.
    .sort((a, b) => b.id - a.id);

  const totalPages = Math.max(1, Math.ceil(listed.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const shown = listed.slice(start, start + pageSize);

  const exportAccounts = () =>
    downloadCsv(
      toCsv(
        [
          { key: "bankName", header: "Bank Name" },
          { key: "bankBranch", header: "Branch" },
          { key: "accountName", header: "Account Name" },
          { key: "accountNumber", header: "Account No." },
          { key: "iban", header: "IBAN" },
          { key: "swift", header: "SWIFT Code" },
          { key: "openingBalance", header: "Opening Balance" },
          { key: "currentBalance", header: "Current Balance" },
        ],
        listed.map((account) => ({
          ...account,
          currentBalance: balanceOf(account),
        })),
      ),
      "bank-accounts.csv",
    );

  // Every field on the form is required, so every field is checked.
  const canSaveAccount =
    canEdit &&
    draft.bankName &&
    draft.bankBranch &&
    draft.accountName.trim() &&
    draft.accountNumber.trim() &&
    draft.iban.trim() &&
    draft.openingBalance !== "" &&
    draft.accountType;

  const saveAccount = async () => {
    if (!checkRequired() || !canSaveAccount) return;
    // Saved on the server; a refusal (a number already on the list) is
    // shown and the form stays open as it was.
    const saved = await addBankAccount({
      bankName: draft.bankName,
      bankBranch: draft.bankBranch,
      accountName: draft.accountName,
      accountNumber: draft.accountNumber,
      iban: draft.iban,
      accountType: draft.accountType,
      logo: draft.logo,
      // An account opened here serves the whole company until it is said to
      // belong to one office.
      branchId: null,
      openingBalance: Number(draft.openingBalance) || 0,
      active: draft.active,
    });
    if (saved) closeAddBank();
  };

  // Money cannot be moved to the account it came from, and there has to be
  // some of it.
  const canTransfer =
    canEdit &&
    transfer.fromAccountId &&
    transfer.toAccountId &&
    transfer.fromAccountId !== transfer.toAccountId &&
    transfer.date &&
    Number(transfer.amount) > 0;

  const saveTransfer = () => {
    if (!checkRequired() || !canTransfer) return;
    addTransfer({
      fromAccountId: Number(transfer.fromAccountId),
      toAccountId: Number(transfer.toAccountId),
      amount: Number(transfer.amount),
      date: transfer.date,
      reference: transfer.reference,
      description: "Internal transfer",
      receipt: receipt?.name || "",
    });
    setTransfer(emptyTransfer);
    setReceipt(null);
  };

  /** Move money out of one named account, from the row it sits on. */
  const transferFrom = (account) => {
    setTab("transfer");
    setMove("fromAccountId", String(account.id));
  };

  // Adding a bank takes over the section. Cards, tables and tabs all describe
  // banks that already exist, and none of that helps while a new one is being
  // entered - it only invites the form to be mistaken for part of the list.
  if (adding && canEdit) {
    return (
      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          {/* The rule beside the heading marks where the form starts, and
              the arrow is the way back out of it. */}
          <FormHeading
            icon={Landmark}
            title="Add New Bank"
            onBack={closeAddBank}
          />

          <BankFields draft={draft} set={set} />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeAddBank}>
              Cancel
            </Button>
            <Button onClick={saveAccount}>
              Save Bank Account
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* The two lists and the way to add to them sit together on the right,
          so every control on this row is in one place. */}
      {/* One row for the section: the open list's name on the left, and on the
          right the tabs and the button that acts on it. A heading above the
          tabs would only name the tab that is already highlighted. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormHeading icon={Landmark} title={tabOf(tab).label} note={tabOf(tab).note} />

        <div className="flex flex-wrap items-center gap-3">
          <div className="grid grid-cols-2 gap-2 rounded-lg border p-1 sm:max-w-xs">
            {TABS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setTab(option.key)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  tab === option.key
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {tab === "accounts" && (
        <>
          {/* Every bank in one strip, with all of them together first.
              Choosing one is choosing what the page is about: the list of
              accounts, or that account's history. */}
          <SummaryStrip
            items={[
              {
                key: ALL_BANKS,
                mark: (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Landmark className="h-4 w-4" />
                  </span>
                ),
                label: "Total Bank",
                trailing: bankNames.length,
                value: money(totalBalance),
                selected: selectedBank === ALL_BANKS,
                onClick: () => choose(ALL_BANKS),
              },
              ...bankAccounts.map((account) => ({
                key: account.id,
                mark: <BankMark bank={account} className="h-7 w-7" />,
                // Name and balance only. An account name on every
                // cell pushes the banks off one row, and the row is what
                // makes them comparable.
                label: account.bankName,
                value: money(balanceOf(account)),
                selected: selectedBank === String(account.id),
                onClick: () => choose(String(account.id)),
              })),
            ]}
          />

          {/* All Banks is the list of accounts; one bank is that account's
              history. The strip above is not a filter on one table - it
              chooses which question the page is answering. */}
          {selectedBank === ALL_BANKS ? (
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <p className="font-semibold text-primary">All Bank Accounts</p>

              {/* Search on the left, as on every other list */}
              <div className="flex flex-wrap items-center gap-3">
                <AiSearch
                  value={query}
                  onChange={(value) => {
                    setQuery(value);
                    setPage(1);
                  }}
                  placeholder="Ask about bank accounts..."
                />
                <div className="hidden flex-1 sm:block" />
                <Button variant="outline" onClick={exportAccounts}>
                  <ExcelIcon className="me-2 size-[18px]" />
                  Export to Excel
                </Button>
                {/* The way to add, at the end of the row above the list. */}
                {canEdit && (
                  <Button variant="outline" type="button" onClick={openAddBank}>
                    <Plus className="me-1.5 h-4 w-4" />
                    Add New Bank
                  </Button>
                )}
              </div>

              {listed.length === 0 ? (
                <EmptyState>No accounts match that search.</EmptyState>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] border text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-start text-xs text-muted-foreground">
                          <th className="p-3 font-semibold">Bank Name</th>
                          <th className="p-3 font-semibold">Branch Details</th>
                          <th className="p-3 font-semibold">
                            Bank Account Details
                          </th>
                          <th className="p-3 font-semibold">Balance</th>
                          <th className="p-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((account) => (
                          <tr
                            key={account.id}
                            className="border-b align-top transition-colors last:border-0 hover:bg-primary/10"
                          >
                            {/* The name opens the bank for editing */}
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate("/settings/bank/" + account.id)
                                }
                                className="rounded font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                              >
                                {account.bankName}
                              </button>
                            </td>
                            <td className="p-3">
                              <p className="font-semibold">
                                {account.bankBranch || "-"}
                              </p>
                              {account.branchArea && (
                                <p className="text-muted-foreground">
                                  {account.branchArea}
                                </p>
                              )}
                              {account.location && (
                                <p className="text-muted-foreground">
                                  {account.location}
                                </p>
                              )}
                            </td>
                            <td className="p-3">
                              {/* Enough of the number to tell accounts apart */}
                              <Pair label="Account No.:">
                                {maskAccountNumber(account.accountNumber)}
                              </Pair>
                              <Pair label="IBAN:">{account.iban}</Pair>
                              <Pair label="SWIFT Code:">{account.swift}</Pair>
                            </td>
                            <td className="p-3">
                              <Pair label="Opening Balance:">
                                {money(account.openingBalance)}
                              </Pair>
                              <Pair label="Current Balance:" strong>
                                {money(balanceOf(account))}
                              </Pair>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <button
                                  type="button"
                                  onClick={() => choose(String(account.id))}
                                  className="rounded text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                  Account Activity
                                </button>
                                {canEdit && (
                                  <>
                                    <span className="text-muted-foreground">
                                      |
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => transferFrom(account)}
                                      className="rounded text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                      Transfer
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
                    <span>
                      Showing {start + 1} to{" "}
                      {Math.min(start + pageSize, listed.length)} of{" "}
                      {listed.length} entries
                    </span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(pageSize)}
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZES.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span>per page</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage <= 1}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        ‹<span className="sr-only">Previous page</span>
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (n) => (
                          <Button
                            key={n}
                            variant={n === currentPage ? "default" : "ghost"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setPage(n)}
                          >
                            {n}
                          </Button>
                        ),
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage >= totalPages}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        ›<span className="sr-only">Next page</span>
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          ) : (
            // Keyed on the account so picking another bank starts its
            // history afresh rather than leaving the last one on screen.
            <TransactionsSection
              key={selectedBank}
              initialAccountId={selectedBank}
              showAccountPicker={false}
              canRecord={canRecord}
            />
          )}
        </>
      )}

      {tab === "transfer" && (
        <>
          {canEdit && (
            <Card>
              <CardContent className="space-y-5 p-4 sm:p-6">
                {/* The rule beside the heading marks where the form starts */}
                <p className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">
                  Transfer Between Accounts
                </p>

                <div className="form-grid form-grid-3">
                  <div className="space-y-2">
                    <Label htmlFor="transferDate">Transfer Date</Label>
                    <DateField
                      id="transferDate"
                      value={transfer.date}
                      onChange={(e) => setMove("date", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transferFrom">Transfer From</Label>
                    <Select
                      value={transfer.fromAccountId}
                      onValueChange={(value) => setMove("fromAccountId", value)}
                    >
                      <SelectTrigger id="transferFrom">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((account) => (
                          <SelectItem
                            key={account.id}
                            value={String(account.id)}
                          >
                            {accountLabel(account, branches)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transferTo">Transfer To</Label>
                    <Select
                      value={transfer.toAccountId}
                      onValueChange={(value) => setMove("toAccountId", value)}
                    >
                      <SelectTrigger id="transferTo">
                        <SelectValue placeholder="Select destination account" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Money cannot be sent to the account it came from */}
                        {bankAccounts
                          .filter(
                            (account) =>
                              String(account.id) !== transfer.fromAccountId,
                          )
                          .map((account) => (
                            <SelectItem
                              key={account.id}
                              value={String(account.id)}
                            >
                              {accountLabel(account, branches)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transferAmount">Transfer Amount</Label>
                    <div className="relative">
                      <Input
                        id="transferAmount"
                        type="number"
                        min="0"
                        step="0.001"
                        value={transfer.amount}
                        onChange={(e) => setMove("amount", e.target.value)}
                        placeholder="Enter amount"
                        className="pe-10"
                      />
                      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Rial />
                      </span>
                    </div>
                  </div>

                  {/* Written out from the figure, so the two can never disagree */}
                  <div className="space-y-2">
                    <Label htmlFor="transferWords">
                      Amount in Words (Auto-generated)
                    </Label>
                    <Input
                      id="transferWords"
                      readOnly
                      tabIndex={-1}
                      className="bg-locked text-muted-foreground"
                      value={amountInWords(transfer.amount) || "-"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transferReference">Reference Number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="transferReference"
                        value={transfer.reference}
                        onChange={(e) => setMove("reference", e.target.value)}
                        placeholder="Enter reference number"
                        className="flex-1"
                      />
                      {/* The file name lives in the tooltip, so the control
                          stays icon-sized either way. */}
                      {receipt ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0 border-green-600 text-green-600 hover:text-destructive"
                          title={receipt.name + " - click to remove"}
                          onClick={() => setReceipt(null)}
                        >
                          <FileCheck className="h-4 w-4" />
                          <span className="sr-only">
                            {receipt.name} attached. Remove it.
                          </span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          title="Upload transfer receipt"
                          asChild
                        >
                          <label className="cursor-pointer">
                            <UploadIcon className="h-4 w-4" />
                            <span className="sr-only">
                              Upload transfer receipt
                            </span>
                            <Input
                              type="file"
                              className="hidden"
                              onChange={(e) =>
                                e.target.files[0] &&
                                setReceipt(e.target.files[0])
                              }
                            />
                          </label>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveTransfer}>
                    Save Transfer
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <p className="mb-2 font-semibold text-primary">Account Transfers</p>
            <Card>
              <CardContent className="overflow-x-auto p-0">
                {transfers.length === 0 ? (
                  <div className="p-6">
                    <EmptyState>No transfers recorded yet.</EmptyState>
                  </div>
                ) : (
                  <table className="w-full min-w-[860px] border text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-start text-xs text-muted-foreground">
                        <th className="p-3 font-semibold">Transfer No.</th>
                        <th className="p-3 font-semibold">Date</th>
                        <th className="p-3 font-semibold">From</th>
                        <th className="p-3 font-semibold">To</th>
                        <th className="p-3 font-semibold">Amount</th>
                        <th className="p-3 font-semibold">Reference</th>
                        <th className="p-3 font-semibold">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map((move) => (
                        <tr
                          key={move.id}
                          className="border-b align-top transition-colors last:border-0 hover:bg-primary/10"
                        >
                          <td className="p-3 font-medium text-primary">
                            {move.transferNo || "-"}
                          </td>
                          <td className="p-3">
                            {formatDate(move.date)}
                            {move.time && (
                              <span className="block text-xs text-muted-foreground">
                                {move.time}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {accountLine(accountById(move.fromAccountId))}
                          </td>
                          <td className="p-3">
                            {accountLine(accountById(move.toAccountId))}
                          </td>
                          <td className="p-3 font-semibold">
                            {money(move.amount)}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {move.reference || "-"}
                            {move.receipt && (
                              <span className="mt-1 flex items-center gap-1.5 text-primary">
                                <Paperclip className="h-3 w-3 shrink-0" />
                                {move.receipt}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {move.byName || "-"}
                            {move.byRole && (
                              <span className="block text-xs text-muted-foreground">
                                {move.byRole}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
