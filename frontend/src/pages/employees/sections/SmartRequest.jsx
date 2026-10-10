import { useEffect, useRef, useState } from "react";
import { CircleCheck, FileText, Info, Loader2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DateField from "@/components/shared/DateField";
import UploadIcon from "@/components/shared/UploadIcon";
import { cn } from "@/lib/utils";
import { createdRequest, unifiedApi, valuesOf } from "@/lib/api/modules/unified";
import { notifyError } from "@/lib/api/notice";
import { startMonths } from "../loanData";
import { InvoiceAnalysis } from "./InvoiceIntake";

const TEXT_LIMIT = 2000;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The last twelve months, newest first: { value: "2026-09", label: "September 2026" }. */
const recentMonths = () => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, back) => {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return {
      value: month.getFullYear() + "-" + String(month.getMonth() + 1).padStart(2, "0"),
      label: MONTH_NAMES[month.getMonth()] + " " + month.getFullYear(),
    };
  });
};

/**
 * One box in place of choosing a form: the employee writes what they need in
 * their own words, or attaches a document, and SADEED works out which
 * request it is and fills in its details.
 *
 * Nothing is sent on the reading alone. What was understood is shown as the
 * request's own fields - each one open to be corrected, the missing ones
 * marked - and the request is created only when the employee submits it. It
 * is then an ordinary request of its kind: same number, same limits, same
 * approval steps as one made on the fixed form.
 */
export default function SmartRequest({ employee, onCreated }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);

  // What was understood, once the text has been read: the type, its fields
  // and what is still missing. `values` is what the employee is editing.
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(""); // "reading" | "retyping" | "sending"
  // Said once the request is sent - also when the page has just come back
  // from loading the records again after one.
  const employeeId = employee?.id;
  const [created, setCreated] = useState(() => createdRequest.read(employeeId));
  useEffect(() => createdRequest.clear(), []);

  const canRead = (text.trim().length > 0 || file) && !busy;

  const show = (next) => {
    setDraft(next);
    setValues(next.type ? valuesOf(next.fields) : {});
    setErrors({});
  };

  const read = async () => {
    if (!canRead) return;
    setBusy("reading");
    setCreated(null);
    try {
      show(await unifiedApi.interpret({ text: text.trim(), file, employeeId }));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  // The employee knows better than the reading which request they meant.
  const changeType = async (type) => {
    if (!type || type === draft?.type) return;
    setBusy("retyping");
    try {
      show({
        ...(await unifiedApi.retype({ type, values, invoice: draft?.invoice, employeeId })),
        summary: draft?.summary || "",
        notes: draft?.notes || [],
        engine: draft?.engine,
        confidence: null,
      });
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  const set = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const fields = draft?.fields || [];
  const empty = (field) => values[field.key] === "" || values[field.key] == null;
  const missing = fields.filter((field) => field.required && empty(field)).map((field) => field.key);
  const needsInvoice = (draft?.missing || []).includes("invoice");
  const canSubmit = draft?.type && !missing.length && !needsInvoice && !busy;

  // The last short field takes whatever is left of its row, so no row ends
  // on a single box with empty space beside it. The type's own box counts.
  const short = fields.filter((field) => field.kind !== "longText");
  const lastShort = short.at(-1)?.key;
  const boxes = short.length + 1;
  const lastShortSpan = cn(boxes % 2 === 1 && "sm:col-span-2", ["lg:col-span-1", "lg:col-span-3", "lg:col-span-2"][boxes % 3]);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy("sending");
    try {
      const result = await unifiedApi.submit({ type: draft.type, values, invoice: draft.invoice, file, employeeId });
      setCreated(result);
      setDraft(null);
      setText("");
      setFile(null);
      onCreated?.(result);
    } catch (error) {
      // The server's refusal, under the field it is about where there is one.
      const byField = Object.fromEntries(
        Object.entries(error?.errors || {}).map(([key, messages]) => [key, [].concat(messages)[0]])
      );
      setErrors(byField);
      const shown = fields.some((field) => byField[field.key]);
      if (!shown) notifyError(error);
    } finally {
      setBusy("");
    }
  };

  const startAgain = () => {
    setDraft(null);
    setErrors({});
  };

  return (
    <section
      aria-labelledby="smart-request-title"
      className="space-y-4 rounded-xl border border-container-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary"
        >
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="smart-request-title" className="text-lg font-bold text-primary">
            Smart Request
          </h2>
          <p className="text-sm text-primary/75">
            Write what you need in your own words, or attach a document. SADEED works out the
            request and fills in its details for you to check before it is sent.
          </p>
        </div>
      </div>

      {created && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {created.typeLabel} request{created.requestNo ? " " + created.requestNo : ""} submitted. It is
            now waiting for approval, and is on its list below.
          </span>
        </p>
      )}

      {/* ---------------------------------------------- the box itself */}
      {!draft && (
        <div className="space-y-3">
          <div className="form-field space-y-2">
            <Label htmlFor="smart-request-text">Your request</Label>
            <Textarea
              id="smart-request-text"
              value={text}
              maxLength={TEXT_LIMIT}
              onChange={(e) => setText(e.target.value)}
              placeholder='For example: "I need a salary advance of 300 OMR from my November salary for school fees"'
              disabled={Boolean(busy)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png"
              aria-label="Attach a document"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
              <UploadIcon className="me-2 size-4" />
              Attach Document
            </Button>
            {file && (
              <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-sm text-primary">
                <FileText className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="rounded p-0.5 text-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" aria-hidden="true" />
                  <span className="sr-only">Remove {file.name}</span>
                </button>
              </span>
            )}
            <span className="text-xs text-muted-foreground">PDF or image, up to 10 MB</span>

            <Button type="button" className="ms-auto" onClick={read} disabled={!canRead}>
              {busy === "reading" ? (
                <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="me-2 size-4" aria-hidden="true" />
              )}
              {busy === "reading" ? "Reading your request…" : "Analyze Request"}
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------- what was understood */}
      {draft && (
        <div className="space-y-4">
          {draft.summary && (
            <p className="rounded-lg bg-blue-50/60 px-4 py-3 text-sm text-primary">
              <span className="font-semibold">Understood as: </span>
              {draft.summary}
            </p>
          )}

          {(draft.notes || []).map((note) => (
            <p
              key={note}
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {note}
            </p>
          ))}

          {draft.invoice && <InvoiceAnalysis invoice={draft.invoice} risk={draft.risk} />}

          {/* The type and its fields in one grid, so they fill their rows
              together. Rows stand further apart than usual: a field's message
              hangs below it, and here most fields can have one to say. */}
          <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            <div className="form-field space-y-2">
              <Label htmlFor="smart-request-type">Request Type</Label>
              <Select value={draft.type || ""} onValueChange={changeType} disabled={Boolean(busy)}>
                <SelectTrigger id="smart-request-type">
                  <SelectValue placeholder="Choose the request type" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(draft.types || []).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draft.type && draft.engine === "gemini" && draft.confidence != null && (
                <p className="text-xs text-muted-foreground">
                  Read by AI · {Math.round(draft.confidence * 100)}% sure of the type
                </p>
              )}
            </div>

            {draft.type &&
              fields.map((field) => (
                <SmartField
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ""}
                  onChange={(value) => set(field.key, value)}
                  error={errors[field.key] || (field.required && empty(field) ? "Required - not found in your request" : "")}
                  disabled={Boolean(busy)}
                  className={field.key === lastShort ? lastShortSpan : ""}
                />
              ))}
          </div>

          {!draft.type && (
            <p role="alert" className="text-sm text-destructive">
              The request type could not be worked out. Choose it above, or go back and say more.
            </p>
          )}

          {(errors.invoice || needsInvoice) && (
            <p role="alert" className="text-sm text-destructive">
              {errors.invoice ||
                "This request needs its invoice. Go back and attach the invoice (PDF or image) so it can be read."}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={startAgain} disabled={Boolean(busy)}>
              Back
            </Button>
            <Button type="button" onClick={submit} disabled={!canSubmit}>
              {busy === "sending" ? (
                <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="me-2 size-4" aria-hidden="true" />
              )}
              Submit Request
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** One field of the understood request, drawn by its kind. */
function SmartField({ field, value, onChange, error, disabled, className }) {
  const id = "smart-" + field.key;
  const wide = field.kind === "longText";

  const options =
    field.kind === "select"
      ? field.options.map((option) => ({ value: option, label: option }))
      : field.kind === "monthName"
        ? startMonths().map((month) => ({ value: month, label: month }))
        : field.kind === "month"
          ? recentMonths()
          : null;

  return (
    <div className={cn("form-field space-y-2", wide && "sm:col-span-2 lg:col-span-3", className)}>
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="ms-0.5 text-destructive">*</span>}
      </Label>

      {options ? (
        <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id} aria-invalid={Boolean(error) || undefined}>
            <SelectValue placeholder="Please Select" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.kind === "date" ? (
        <DateField
          id={id}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          disabled={disabled}
        />
      ) : field.kind === "longText" ? (
        <Textarea
          id={id}
          value={value || ""}
          maxLength={500}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          disabled={disabled}
        />
      ) : (
        <Input
          id={id}
          value={value ?? ""}
          inputMode={field.kind === "number" ? "decimal" : undefined}
          onChange={(e) =>
            onChange(field.kind === "number" ? e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1") : e.target.value)
          }
          aria-invalid={Boolean(error) || undefined}
          disabled={disabled}
        />
      )}

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
