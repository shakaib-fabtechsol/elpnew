import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/shared/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Briefcase, ArrowLeft, Save, Paperclip, X } from "lucide-react";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { RECEIVING_BANKS } from "@/lib/constants";
import { initialBranches } from "@/pages/firm/firmData";
import { useExpenses } from "@/lib/expenses/context";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { Rial } from "@/components/shared/Rial";
import { dayOffset, PAYMENT_METHODS } from "./expenseData";
import {
  CASE_KINDS,
  COURT_LEVELS,
  JUDICIAL_CATEGORY,
  JUDICIAL_EXPENSE_TYPES,
} from "./judicialData";

/** A titled block of fields. */
function FormSection({ title, children }) {
  return (
    <Card>
      <div className="border-b px-4 py-3 sm:px-6">
        <h2 className="font-semibold text-primary">{title}</h2>
      </div>
      <CardContent className="p-4 sm:p-6">
        <div className="form-grid">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

const empty = {
  branch: "",
  client: "",
  opponent: "",
  court: "",
  level: "",
  caseNo: "",
  location: "",
  expenseType: "",
  subcategory: "",
  amount: "",
  paymentMethod: "",
  bank: "",
  accountNo: "",
  receipt: "",
};

const options = (values) => values.map((v) => ({ value: v, label: v }));

/** The time of day a record is stamped with, in the format the table reads. */
const nowTime = () =>
  new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

export default function JudicialExpenseForm() {
  const navigate = useNavigate();
  const { addJudicialExpense } = useExpenses();

  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState("");

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));
  const onChange = (e) => set(e.target.name, e.target.value);

  const canSave =
    draft.branch &&
    draft.client.trim() &&
    draft.caseNo.trim() &&
    draft.expenseType &&
    Number(draft.amount) > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!canSave) {
      setError(
        "A court payment needs a branch, the client, the case number, what it was for, and the amount."
      );
      return;
    }
    addJudicialExpense({
      ...draft,
      amount: Number(draft.amount),
      category: JUDICIAL_CATEGORY,
      receipt: draft.receipt || "",
      // Raised now, and waiting on the finance manager until they say otherwise.
      submittedBy: CURRENT_USER.name,
      submittedAt: dayOffset(0),
      submittedTime: nowTime(),
      approvedBy: "",
      approvedAt: "",
      approvedTime: "",
      status: "Pending",
    });
    navigate("/court-fee-payments");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/court-fee-payments" />
          <div className="rounded-xl bg-primary p-2 sm:p-3">
            <Briefcase className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">
              Add Expense
            </h1>
            <p className="text-xs text-primary/75 sm:text-sm">
              A payment made to a judicial authority on a case&apos;s behalf
            </p>
          </div>
        </div>
        <Button type="submit" form="judicial-form">
          <Save className="me-2 h-4 w-4" />
          Save Expense
        </Button>
      </div>

      <form id="judicial-form" onSubmit={submit} className="space-y-4 sm:space-y-6">
        <FormSection title="Case Details">
          <div className="form-field space-y-2">
            <Label htmlFor="branch">Branch</Label>
            <SearchableSelect
              id="branch"
              value={draft.branch}
              onValueChange={(value) => set("branch", value)}
              options={options(initialBranches.map((b) => b.name))}
              searchPlaceholder="Search branch..."
            />
          </div>

          <div className="form-field space-y-2">
            <Label htmlFor="client">Client</Label>
            <Input
              required
              id="client"
              name="client"
              value={draft.client}
              onChange={onChange}
              placeholder="Who the firm acts for"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="opponent">Opponent</Label>
            <Input
              id="opponent"
              name="opponent"
              value={draft.opponent}
              onChange={onChange}
              placeholder="The other side"
            />
          </div>

          <div className="form-field space-y-2">
            <Label htmlFor="caseNo">Case No.</Label>
            <Input
              required
              id="caseNo"
              name="caseNo"
              value={draft.caseNo}
              onChange={onChange}
              placeholder="e.g. 125/2026"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="court">Court</Label>
            <Input
              id="court"
              name="court"
              value={draft.court}
              onChange={onChange}
              placeholder="e.g. Muscat Primary Court"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">Level</Label>
            <SearchableSelect
              id="level"
              value={draft.level}
              onValueChange={(value) => set("level", value)}
              options={options(COURT_LEVELS)}
              searchPlaceholder="Search level..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              value={draft.location}
              onChange={onChange}
              placeholder="Where the court sits"
            />
          </div>
        </FormSection>

        <FormSection title="Expense Details">
          <div className="form-field space-y-2">
            <Label htmlFor="expenseType">Expense Type</Label>
            <SearchableSelect
              id="expenseType"
              value={draft.expenseType}
              onValueChange={(value) => set("expenseType", value)}
              options={options(JUDICIAL_EXPENSE_TYPES)}
              searchPlaceholder="Search expense type..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={JUDICIAL_CATEGORY}
              readOnly
              disabled
              className="bg-locked"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategory</Label>
            <SearchableSelect
              id="subcategory"
              value={draft.subcategory}
              onValueChange={(value) => set("subcategory", value)}
              options={options(CASE_KINDS)}
              searchPlaceholder="Search subcategory..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount Paid to Court (<Rial />) *
            </Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              value={draft.amount}
              onChange={onChange}
              placeholder="0"
            />
          </div>
        </FormSection>

        <FormSection title="Payment Details">
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <SearchableSelect
              id="paymentMethod"
              value={draft.paymentMethod}
              onValueChange={(value) => set("paymentMethod", value)}
              options={options(PAYMENT_METHODS)}
              searchPlaceholder="Search method..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank">Bank</Label>
            <SearchableSelect
              id="bank"
              value={draft.bank}
              onValueChange={(value) => set("bank", value)}
              options={options(RECEIVING_BANKS)}
              searchPlaceholder="Search bank..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNo">Account No.</Label>
            <Input
              id="accountNo"
              name="accountNo"
              value={draft.accountNo}
              onChange={onChange}
              placeholder="Account the payment left"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Receipt</Label>
            {draft.receipt ? (
              <div className="flex h-9 items-center justify-between gap-2 rounded-md bg-muted/40 px-3">
                <span className="truncate text-sm">{draft.receipt}</span>
                <button
                  type="button"
                  onClick={() => set("receipt", "")}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove receipt</span>
                </button>
              </div>
            ) : (
              <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted/50">
                <Paperclip className="h-3.5 w-3.5" />
                Attach receipt
                <Input
                  type="file"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files[0] && set("receipt", e.target.files[0].name)
                  }
                />
              </label>
            )}
          </div>
        </FormSection>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
