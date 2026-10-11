import { useEffect, useRef, useState } from "react";
import { Check, CircleCheck, FileText, Info, Loader2, Plus, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { notify, notifyError } from "@/lib/api/notice";
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
 * A request made by saying it, in place of choosing a form.
 *
 * The button opens one window that the whole of it happens in. The employee
 * describes what they need, or attaches a document; the AI works out which
 * request it is, fills in its details, and asks only for what is still
 * missing. The finished request is then laid out to be checked - corrected
 * by hand or by telling the AI what to change - and nothing is sent to
 * management until the employee submits it.
 *
 * Once sent it is an ordinary request of its kind: same number, same limits,
 * same approval steps, tracked in the same table as one made on a fixed form.
 */
export default function SmartRequest({ employee }) {
  const employeeId = employee?.id;
  const [open, setOpen] = useState(false);

  // "describe" -> "review" -> "sent". The two stages after those belong to
  // management and finance; the steps name them so the employee sees the road.
  const [stage, setStage] = useState("describe");
  const [thread, setThread] = useState([]); // what was said, by whom
  const [text, setText] = useState("");
  const [file, setFile] = useState(null); // the document that goes with the request
  const [pending, setPending] = useState(null); // a document attached but not yet read
  const fileRef = useRef(null);

  // What was understood: the type, its fields, what is still missing.
  // `values` is what the employee is editing on the review.
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [change, setChange] = useState(""); // a correction, in words
  const [busy, setBusy] = useState(""); // "reading" | "retyping" | "changing" | "sending"
  const [created, setCreated] = useState(null);

  // Back from loading the records again after a request was sent: say so once.
  const [sent] = useState(() => createdRequest.read(employeeId));
  useEffect(() => {
    createdRequest.clear();
    if (!sent) return undefined;
    // A moment later: the page's notice area mounts after this does.
    const timer = setTimeout(
      () =>
        notify(
          sent.typeLabel + " request" + (sent.requestNo ? " " + sent.requestNo : "") + " submitted. It is now waiting for management.",
          "success"
        ),
      300
    );
    return () => clearTimeout(timer);
  }, [sent]);

  const reset = () => {
    setStage("describe");
    setThread([]);
    setText("");
    setFile(null);
    setPending(null);
    setDraft(null);
    setValues({});
    setErrors({});
    setChange("");
    setCreated(null);
  };

  const close = () => {
    setOpen(false);
    // The lists are loaded again so the new request is on its own, and the
    // page comes back on that list.
    if (created) createdRequest.reload(employeeId, created);
    else if (!busy) reset();
  };

  const show = (next) => {
    setDraft(next);
    setValues(next.type ? valuesOf(next.fields) : {});
    setErrors({});
  };

  const said = (from, entry) => setThread((prev) => [...prev, { from, ...entry }]);

  /** What the AI says back: what it understood, then what it still needs. */
  const answerFor = (next) => ({
    text: next.summary || "",
    notes: next.notes || [],
    questions: next.type ? next.questions || [] : [],
    unknown: !next.type,
  });

  // Stage 1: the first description, and every answer after it.
  const send = async () => {
    const message = text.trim();
    if ((!message && !pending) || busy) return;
    const attached = pending || file;
    setBusy("reading");
    said("you", { text: message, fileName: pending?.name });
    try {
      let next;
      if (draft?.type) {
        next = await unifiedApi.revise({ type: draft.type, values, invoice: draft.invoice, message, file: pending, employeeId });
      } else {
        // Not yet a request: read everything said so far together.
        const all = [...thread.filter((entry) => entry.from === "you").map((entry) => entry.text), message].filter(Boolean).join("\n");
        next = await unifiedApi.interpret({ text: all, file: attached, employeeId });
      }
      if (pending) setFile(pending);
      setPending(null);
      setText("");
      show(next);
      said("ai", answerFor(next));
      if (next.type && !(next.missing || []).length) setStage("review");
    } catch (error) {
      setThread((prev) => prev.slice(0, -1));
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  // The employee knows better than the reading which request they meant.
  const changeType = async (type) => {
    if (!type || type === draft?.type || busy) return;
    setBusy("retyping");
    try {
      const next = {
        ...(await unifiedApi.retype({ type, values, invoice: draft?.invoice, employeeId })),
        summary: draft?.type ? draft.summary || "" : "",
        notes: [],
        engine: draft?.engine,
        confidence: null,
      };
      show(next);
      if (stage === "describe") {
        said("ai", { ...answerFor(next), text: "A " + next.typeLabel + " request." });
        if (!(next.missing || []).length) setStage("review");
      }
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  // Stage 2: a correction said rather than typed into the fields.
  const applyChange = async () => {
    const message = change.trim();
    if (!message || !draft?.type || busy) return;
    setBusy("changing");
    try {
      show(await unifiedApi.revise({ type: draft.type, values, invoice: draft.invoice, message, employeeId }));
      setChange("");
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
      setCreated(await unifiedApi.submit({ type: draft.type, values, invoice: draft.invoice, file, employeeId }));
      setStage("sent");
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

  // The road a request travels. The last stop is a payment for a request for
  // money, and an administrative action for the others.
  const lastStep = !draft?.type ? "Disbursement / Completion" : draft.financial ? "Disbursement" : "Completion";
  const steps = ["Smart Request", "Review Request", "Management Comment", lastStep];
  const at = { describe: 0, review: 1, sent: 2 }[stage];
  const person = draft?.employee;
  const typeOptions = draft?.types || [];

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="me-2 h-4 w-4" aria-hidden="true" />
        Smart Request
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent
          className="max-h-[90vh] w-[92vw] max-w-6xl gap-5 overflow-y-auto"
          // A click outside must not throw away a request half written.
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
              Smart Request
            </DialogTitle>
            <DialogDescription>
              Describe what you need in your own words. The AI prepares the request, you check it, and it is sent
              only when you submit it.
            </DialogDescription>
          </DialogHeader>

          <StepTrack steps={steps} at={at} />

          {/* ------------------------------------------ 1. Smart Request */}
          {stage === "describe" && (
            <div className="space-y-4">
              {thread.length > 0 && (
                <ol aria-label="Conversation" className="space-y-3">
                  {thread.map((entry, index) => (
                    <li key={index} className={cn("flex", entry.from === "you" && "justify-end")}>
                      {entry.from === "you" ? (
                        <div className="max-w-[85%] space-y-1 rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                          {entry.text && <p className="whitespace-pre-wrap">{entry.text}</p>}
                          {entry.fileName && (
                            <p className="flex items-center gap-1.5 text-xs opacity-90">
                              <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                              {entry.fileName}
                            </p>
                          )}
                        </div>
                      ) : (
                        <AiReply entry={entry} />
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {/* Only when the AI could not tell: a way out that does not
                  depend on finding the right words. */}
              {draft && !draft.type && (
                <div className="form-field max-w-sm space-y-2">
                  <Label htmlFor="smart-request-type">Or choose the request type</Label>
                  <TypeSelect id="smart-request-type" value="" options={typeOptions} onChange={changeType} disabled={Boolean(busy)} />
                </div>
              )}

              <div className="form-field space-y-2">
                <Label htmlFor="smart-request-text">{thread.length ? "Your answer" : "Your request"}</Label>
                <Textarea
                  id="smart-request-text"
                  value={text}
                  maxLength={TEXT_LIMIT}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    thread.length
                      ? "Answer in your own words"
                      : 'For example: "I need a salary advance of 300 OMR from my November salary for school fees"'
                  }
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
                  onChange={(e) => setPending(e.target.files?.[0] || null)}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
                  <UploadIcon className="me-2 size-4" />
                  Attach Document
                </Button>
                {(pending || file) && (
                  <FileChip
                    name={(pending || file).name}
                    onRemove={() => {
                      if (pending) setPending(null);
                      else setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  />
                )}
                <span className="text-xs text-muted-foreground">PDF or image, up to 10 MB</span>

                <div className="ms-auto flex flex-wrap items-center gap-3">
                  {draft?.type && (
                    <Button type="button" variant="outline" onClick={() => setStage("review")} disabled={Boolean(busy)}>
                      Fill In Myself
                    </Button>
                  )}
                  <Button type="button" onClick={send} disabled={(!text.trim() && !pending) || Boolean(busy)}>
                    {busy === "reading" ? (
                      <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="me-2 size-4" aria-hidden="true" />
                    )}
                    {busy === "reading" ? "Reading…" : thread.length ? "Send Answer" : "Analyze Request"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------- 2. Review Request */}
          {stage === "review" && draft?.type && (
            <div className="space-y-5">
              {person && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-container-border bg-muted/40 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-primary">{person.name}</p>
                    <p className="text-xs text-primary/70">
                      {[person.employeeNo, person.occupation, person.department].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {(person.facts || []).map((fact) => (
                    <div key={fact.label}>
                      <p className="text-xs text-primary/70">{fact.label}</p>
                      <p className="font-semibold text-primary">{fact.value}</p>
                    </div>
                  ))}
                  <p className="ms-auto text-xs text-muted-foreground">From the employee record</p>
                </div>
              )}

              {draft.summary && (
                <p className="rounded-lg bg-blue-50/60 px-4 py-3 text-sm text-primary">
                  <span className="font-semibold">Understood as: </span>
                  {draft.summary}
                </p>
              )}

              {(draft.notes || []).map((note) => (
                <Note key={note}>{note}</Note>
              ))}

              {draft.invoice && <InvoiceAnalysis invoice={draft.invoice} risk={draft.risk} />}

              {/* The type and its fields in one grid, so they fill their rows
                  together. Rows stand further apart than usual: a field's
                  message hangs below it, and here most fields can have one. */}
              <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
                <div className="form-field space-y-2">
                  <Label htmlFor="smart-request-type">Request Type</Label>
                  <TypeSelect id="smart-request-type" value={draft.type} options={typeOptions} onChange={changeType} disabled={Boolean(busy)} />
                </div>
                {fields.map((field) => (
                  <SmartField
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? ""}
                    onChange={(value) => set(field.key, value)}
                    error={errors[field.key] || (field.required && empty(field) ? "Required field" : "")}
                    disabled={Boolean(busy)}
                    className={field.key === lastShort ? lastShortSpan : ""}
                  />
                ))}
              </div>

              {file && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-primary">
                  <span className="font-medium">Supporting document:</span>
                  <FileChip name={file.name} />
                </p>
              )}

              {(errors.invoice || needsInvoice) && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.invoice ||
                    "This request needs its invoice. Go back and attach the invoice (PDF or image) so it can be read."}
                </p>
              )}

              {/* The other way to correct it: said, not typed into a field. */}
              <div className="space-y-2 rounded-lg border border-container-border p-4">
                <Label htmlFor="smart-request-change" className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" aria-hidden="true" />
                  Ask the AI to change something
                </Label>
                <div className="flex flex-wrap gap-3">
                  <Input
                    id="smart-request-change"
                    className="min-w-0 flex-1"
                    value={change}
                    maxLength={500}
                    onChange={(e) => setChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyChange();
                      }
                    }}
                    placeholder='For example: "make it 250" or "start a week later"'
                    disabled={Boolean(busy)}
                  />
                  <Button type="button" variant="outline" onClick={applyChange} disabled={!change.trim() || Boolean(busy)}>
                    {busy === "changing" && <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />}
                    Apply Change
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setStage("describe")} disabled={Boolean(busy)}>
                  Back / Edit
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

          {/* ------------------------- 3. sent: now with management */}
          {stage === "sent" && created && (
            <div className="space-y-5">
              <div role="status" className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-green-800">
                <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">
                    {created.typeLabel} request{created.requestNo ? " " + created.requestNo : ""} submitted.
                  </p>
                  <p>
                    It is now with management for review. You can close this window and follow its status, comments
                    and {draft?.financial ? "payment" : "outcome"} in the Requests table.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={close}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Where the request stands on its road: done, here, still ahead. */
function StepTrack({ steps, at }) {
  return (
    <ol aria-label="Request stages" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {steps.map((label, index) => {
        const done = index < at;
        const here = index === at;
        return (
          <li
            key={index}
            aria-current={here ? "step" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
              here ? "border-primary bg-blue-50/60 font-semibold text-primary" : "border-container-border text-primary/70",
              done && "text-primary"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                done || here ? "border-primary bg-primary text-primary-foreground" : "border-container-border"
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className="min-w-0 leading-tight">{label}</span>
            {done && <span className="sr-only">(done)</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** What the AI understood, and the questions it still has. */
function AiReply({ entry }) {
  return (
    <div className="max-w-[85%] space-y-2 rounded-lg border border-container-border bg-muted/40 px-4 py-3 text-sm text-primary">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary/70">
        <Sparkles className="size-3.5" aria-hidden="true" />
        SADEED AI
      </p>
      {entry.text && <p>{entry.text}</p>}
      {(entry.notes || []).map((note) => (
        <p key={note} className="text-xs text-amber-800">
          {note}
        </p>
      ))}
      {entry.questions?.length > 0 && (
        <>
          <p className="font-medium">To finish it, I still need:</p>
          <ol className="list-decimal space-y-1.5 ps-5">
            {entry.questions.map((question) => (
              <li key={question.key}>
                {question.question}
                {question.options && question.options.length <= 12 && (
                  <span className="block text-xs text-primary/70">{question.options.join(" · ")}</span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      {!entry.unknown && !entry.questions?.length && <p>Everything needed is here. Opening it for you to review.</p>}
    </div>
  );
}

function Note({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function FileChip({ name, onRemove }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-sm text-primary">
      <FileText className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5 text-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Remove {name}</span>
        </button>
      )}
    </span>
  );
}

function TypeSelect({ id, value, options, onChange, disabled }) {
  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Choose the request type" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
