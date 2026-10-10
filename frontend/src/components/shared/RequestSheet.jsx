import { useState } from "react";
import { Check, ChevronRight, CloudUpload, Copy, History, X } from "lucide-react";
import {
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { longDate } from "@/pages/employees/sections/AdvanceSalarySection";

/**
 * The pieces every request sheet is built from, so a request reads the same
 * whichever list it was raised on: its head, and the way to what came before.
 */

/**
 * "GR-2026-004" or "MAR-006" raised in 2026, as the head of the request reads
 * it: "GR 04/2026", "MAR 06/2026". The letters say which list; the count and
 * the year say which one on it.
 */
export function shortRequestNo(requestNo, on) {
  const parts = String(requestNo || "").split("-");
  const count = parts[parts.length - 1];
  if (parts.length < 2 || !/^\d+$/.test(count)) return requestNo;
  return parts[0] + " " + String(Number(count)).padStart(2, "0") + "/" + String(on).slice(0, 4);
}

/**
 * The request's head: what it is, then whose it is, when it was raised and
 * its number - the close button beyond them. It titles the dialog it sits in,
 * so the dialog needs no header of its own.
 */
export function SheetHead({ icon, title, intro, employee, date, requestNo, paying }) {
  const Icon = icon;
  return (
    <div className="flex flex-wrap items-start gap-4 pe-16">
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary"
      >
        <Icon className="size-7" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <DialogTitle className="text-2xl font-bold text-primary">{title}</DialogTitle>
        <DialogDescription className="text-sm text-primary/75">{intro}</DialogDescription>
      </div>
      <div className="ms-auto flex flex-wrap items-center gap-3 pt-2 text-sm text-primary">
        <span>{employee?.empNo || ""}</span>
        <span aria-hidden="true" className="h-5 w-px bg-container-border" />
        <span>{employee?.name || ""}</span>
        <span aria-hidden="true" className="h-5 w-px bg-container-border" />
        {paying ? (
          <PayeeFacts employee={employee} />
        ) : (
          <>
            <span>{longDate(date)}</span>
            <span aria-hidden="true" className="h-5 w-px bg-container-border" />
            <span className="rounded-md bg-primary/10 px-3 py-1.5 text-base font-bold text-primary">
              {shortRequestNo(requestNo, date)}
            </span>
          </>
        )}
      </div>
      <DialogClose className="absolute end-5 top-5 rounded-md p-1 text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <X className="size-7" aria-hidden="true" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </div>
  );
}

/**
 * Where the money goes, as the head of a payment step reads it: "Bank: Bank
 * Muscat | Account No: 0312…". Read off the employee's record so the
 * accountant never has to look it up, and the account can be copied straight
 * into the bank's own screen.
 */
export function PayeeFacts({ employee }) {
  const [copied, setCopied] = useState(false);
  const account = employee?.accountNumber || "";
  return (
    <>
      <span>
        Bank: <span className="font-bold">{employee?.bankName || "-"}</span>
      </span>
      <span aria-hidden="true" className="h-5 w-px bg-container-border" />
      <span className="flex items-center gap-1.5">
        Account No: <span className="font-bold">{account || "-"}</span>
        {account && (
          <button
            type="button"
            onClick={() =>
              navigator.clipboard?.writeText(account.replace(/\s/g, "")).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                },
                () => {}
              )
            }
            className="rounded p-0.5 text-primary/60 hover:bg-menu-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={copied ? "Copied" : "Copy account number"}
          >
            {copied ? (
              <Check className="size-3.5 text-green-600" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            <span className="sr-only">{copied ? "Copied" : "Copy account number"}</span>
          </button>
        )}
      </span>
    </>
  );
}

/** Everything asked for before, opened over the sheet. */
export function HistoryCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl border bg-blue-50/40 px-4 py-3 text-start transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-md"
    >
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white"
      >
        <History className="size-6" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold text-primary">History</span>
        <span className="block text-sm text-primary/75">
          View this request timeline and employee&apos;s previous requests
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
    </button>
  );
}

/** The card a sheet's fields sit in, under a heading with a rule beside it. */
export function SheetCard({ title, children }) {
  return (
    <section className="space-y-4 rounded-xl border p-4 sm:p-5">
      <h3 className="border-s-4 border-primary ps-3 text-base font-bold text-primary">{title}</h3>
      {children}
    </section>
  );
}

/** The supporting document, as a button beside the field it supports. */
export function UploadButton({ file, onPick, label = "Upload supporting document" }) {
  return (
    <label
      className="flex size-[42px] shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-blue-50/60 text-primary transition-colors hover:bg-blue-50 focus-within:ring-2 focus-within:ring-ring"
      title={file ? file.name : label}
    >
      <CloudUpload className="size-6" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) onPick(picked);
        }}
      />
    </label>
  );
}
