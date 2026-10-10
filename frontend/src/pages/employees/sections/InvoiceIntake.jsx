import { useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CloudUpload,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { amountValue } from "@/lib/money";
import { Rial } from "@/components/shared/Rial";
import { longDate } from "./AdvanceSalarySection";

/** Green when nothing is wrong with the invoice, red when something is. */
export function RiskBadge({ level, className }) {
  const safe = level !== "high";
  const Icon = safe ? ShieldCheck : ShieldAlert;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold",
        safe ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700",
        className
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {safe ? "Low Risk - Invoice appears valid" : "High Risk - Review required"}
    </span>
  );
}

/** One read field, with how sure the reading is of it. */
function Read({ label, value, confidence, children }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-xs text-primary/70">
        {label}
        {confidence ? (
          <span className="rounded bg-blue-50 px-1.5 text-[10px] font-semibold text-primary/80">
            {confidence}%
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 truncate font-semibold text-primary" title={typeof value === "string" ? value : undefined}>
        {value || "-"}
      </p>
      {children}
    </div>
  );
}

/**
 * What the AI read off the invoice and what it found, as one card. Shown to
 * the employee before they submit, and to management when they decide - so
 * a duplicate or a repeated claim is the first thing management sees.
 */
export function InvoiceAnalysis({ invoice, risk, title = "AI Invoice Analysis", onClear }) {
  const supplierKnown = Boolean(risk?.supplier);
  return (
    <section
      className={cn(
        "space-y-4 rounded-xl border p-4 sm:p-5",
        risk?.level === "high" ? "border-red-200 bg-red-50/30" : "border-green-200 bg-green-50/20"
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-primary">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-primary">{title}</h3>
          {invoice.fileName && (
            <p className="flex items-center gap-1.5 text-xs text-primary/70">
              <FileText className="size-3.5" aria-hidden="true" />
              {invoice.fileName}
            </p>
          )}
        </div>
        <RiskBadge level={risk?.level} className="ms-auto" />
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md p-1 text-primary/70 hover:bg-menu-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Remove and upload another invoice"
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">Remove and upload another invoice</span>
          </button>
        )}
      </div>

      {/* What management must see first: why the invoice is not safe. */}
      {risk?.reasons?.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-red-700">
            <TriangleAlert className="size-4" aria-hidden="true" />
            Management alert
          </p>
          <ul className="mt-1 list-disc space-y-0.5 ps-6 text-sm text-red-700">
            {risk.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 rounded-lg bg-white px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <Read label="Invoice No." value={invoice.invoiceNo} confidence={invoice.confidence?.invoiceNo} />
        <Read label="Invoice Date" value={invoice.invoiceDate ? longDate(invoice.invoiceDate) : "-"} confidence={invoice.confidence?.date} />
        <Read label="Supplier" value={invoice.supplierName} confidence={invoice.confidence?.supplier}>
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold",
              supplierKnown ? "bg-green-50 text-green-800" : "bg-blue-50 text-primary"
            )}
          >
            {supplierKnown ? (
              <>
                <BadgeCheck className="size-3" aria-hidden="true" />
                Registered {risk.supplier.supplierId}
              </>
            ) : (
              <>
                <Building2 className="size-3" aria-hidden="true" />
                New supplier
              </>
            )}
          </span>
        </Read>
        <Read label="Supplier VAT No." value={invoice.supplierVat} />
        <div className="sm:col-span-2 lg:col-span-4">
          <Read label="Purpose" value={invoice.purpose} confidence={invoice.confidence?.purpose} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-table-head text-xs font-semibold text-primary">
            <tr>
              <th className="px-3 py-2 text-start">Item</th>
              <th className="px-3 py-2 text-end">Qty</th>
              <th className="px-3 py-2 text-end">Amount (OMR)</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.name} className="border-t">
                <td className="px-3 py-2 text-primary">{item.name}</td>
                <td className="px-3 py-2 text-end text-primary">{item.quantity}</td>
                <td className="px-3 py-2 text-end text-primary">{amountValue(item.amount * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t text-primary">
            <tr>
              <td colSpan={2} className="px-3 py-1.5 text-end text-xs">Subtotal</td>
              <td className="px-3 py-1.5 text-end font-semibold">{amountValue(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="px-3 py-1.5 text-end text-xs">
                VAT ({invoice.subtotal ? Math.round((invoice.vat / invoice.subtotal) * 100) : 0}%)
                {invoice.vat === 0 && " - zero-rated"}
              </td>
              <td className="px-3 py-1.5 text-end font-semibold">{amountValue(invoice.vat)}</td>
            </tr>
            <tr className="bg-blue-50/50">
              <td colSpan={2} className="px-3 py-2 text-end text-sm font-bold">Invoice Total</td>
              <td className="px-3 py-2 text-end text-base font-bold">
                {amountValue(invoice.total)} <Rial className="text-xs font-normal" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {risk?.notes?.length > 0 && (
        <ul className="space-y-1 text-sm text-primary/80">
          {risk.notes.map((note) => (
            <li key={note} className="flex items-start gap-2">
              <Building2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {note}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The first step of a request made on an invoice: the invoice goes in, and
 * the AI reads it before anything else is asked.
 */
export default function InvoiceIntake({ invoice, risk, analyzing, onPick, onClear }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);

  if (analyzing) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-12 text-center">
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
        <p className="text-lg font-bold text-primary">AI is analyzing the invoice...</p>
        <p className="text-sm text-primary/75">
          Reading the invoice number, supplier, purpose, amount and VAT, and checking it against earlier claims.
        </p>
      </section>
    );
  }

  if (invoice) return <InvoiceAnalysis invoice={invoice} risk={risk} onClear={onClear} />;

  const take = (file) => file && onPick(file);
  return (
    <section className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors",
          over ? "border-primary bg-blue-50" : "border-blue-200 bg-blue-50/30"
        )}
      >
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-white text-primary shadow-sm">
          <CloudUpload className="size-7" />
        </span>
        <p className="text-lg font-bold text-primary">Upload the invoice</p>
        <p className="max-w-xl text-sm text-primary/75">
          Drag and drop the invoice here, or browse for it. The AI reads the invoice number, supplier, purpose,
          amount and VAT, and fills in the request for you.
        </p>
        <Button type="button" variant="outline" onClick={() => input.current?.click()}>
          Browse Files
        </Button>
        <p className="text-xs text-primary/60">PDF, JPG or PNG - up to 10 MB</p>
        <input
          ref={input}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            take(file);
          }}
        />
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-blue-50/60 px-4 py-2.5 text-sm text-primary/80">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        The invoice is checked for duplicates and repeated claims, and given a risk rating before the request is
        created. A supplier that is not registered yet is added automatically with its VAT number.
      </p>
    </section>
  );
}
