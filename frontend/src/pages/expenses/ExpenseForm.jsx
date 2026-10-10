import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/shared/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WalletCards, ArrowLeft, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPathComplete } from "@/lib/expenses/taxonomy";
import { useExpenses } from "@/lib/expenses/context";
import ExpenseClassificationPicker from "./ExpenseClassificationPicker";
import { findType } from "./links";
import { dayOffset } from "./expenseData";
import { Rial } from "@/components/shared/Rial";

import DateField from "@/components/shared/DateField";
const emptyDraft = {
  typeKey: "",
  path: [],
  linkKind: null,
  linkId: null,
  date: dayOffset(0),
  amount: "",
  description: "",
};

export default function ExpenseForm() {
  const navigate = useNavigate();
  const { addExpense } = useExpenses();

  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState("");

  const type = findType(draft.typeKey);
  // The rest of the form only appears once the expense has been classified.
  const classified = isPathComplete(type, draft.path);
  const descriptionRequired = Boolean(type?.requiresDescription);
  const linkRequired = Boolean(type?.link);

  const canSave =
    classified &&
    Number(draft.amount) > 0 &&
    draft.date &&
    (!descriptionRequired || draft.description.trim().length > 0) &&
    (!linkRequired || draft.linkId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSave) {
      setError(
        descriptionRequired && !draft.description.trim()
          ? "A description is required for this expense type."
          : linkRequired && !draft.linkId
          ? "Select the record this expense belongs to."
          : "Complete every field before saving."
      );
      return;
    }
    addExpense({ ...draft, amount: Number(draft.amount) });
    navigate("/expenses");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/expenses" />
          <div className="rounded-xl bg-primary p-2 sm:p-3">
            <WalletCards className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">
              Add Expense
            </h1>
            <p className="text-xs text-primary/75 sm:text-sm">
              Record a new expense
            </p>
          </div>
        </div>
        <Button type="submit" form="expense-form">
          <Save className="me-2 h-4 w-4" />
          Save Expense
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <form
            id="expense-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="form-grid">
              <ExpenseClassificationPicker
                value={draft}
                onChange={(next) => {
                  setDraft((prev) => ({ ...prev, ...next }));
                  setError("");
                }}
              />

              {classified && (
                <div className="form-field space-y-2">
                  <Label htmlFor="expenseDate">Date</Label>
                  <DateField
                    required
                    id="expenseDate"
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  />
                </div>
              )}

              {classified && (
                <div className="space-y-2">
                  <Label htmlFor="expenseAmount">Amount (<Rial />)</Label>
                  <Input
                    id="expenseAmount"
                    type="number"
                    min="1"
                    value={draft.amount}
                    onChange={(e) =>
                      setDraft({ ...draft, amount: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
              )}
            </div>

            {classified && (
              <div className="space-y-2">
                <Label htmlFor="expenseDescription">
                  Expense Description {descriptionRequired && "*"}
                </Label>
                <Textarea
                  id="expenseDescription"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  placeholder={
                    descriptionRequired
                      ? "Required - explain what this expense was for"
                      : "Optional"
                  }
                  className={cn(
                    descriptionRequired &&
                      !draft.description.trim() &&
                      "border-amber-400"
                  )}
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
