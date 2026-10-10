import { useNavigate } from "react-router-dom";
import { useGoBack } from "@/lib/useGoBack";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/shared/BackButton";
import { ReceiptText, ArrowLeft } from "lucide-react";
import { useExpenses } from "@/lib/expenses/context";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import InvoiceForm from "./InvoiceForm";
import { submittedRequest } from "./expenseData";

export default function NewInvoice() {
  const navigate = useNavigate();
  const goBack = useGoBack("/expense-requests");
  const { addInvoice } = useExpenses();

  const handleSubmit = (invoice) => {
    addInvoice(submittedRequest(invoice, CURRENT_USER));
    navigate("/expense-requests");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <BackButton fallback="/expense-requests" />
        <div className="rounded-xl bg-primary p-2 sm:p-3">
          <ReceiptText className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">
            New Payment Request
          </h1>
          <p className="text-xs text-primary/75 sm:text-sm">
            Raise a general company expense for approval
          </p>
        </div>
      </div>

      <InvoiceForm
        onCancel={goBack}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
