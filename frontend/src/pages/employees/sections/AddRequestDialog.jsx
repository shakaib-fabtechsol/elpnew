import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CloudUpload,
  FileText,
  History,
  Info,
  LayoutGrid,
  ListChecks,
  Plus,
  Send,
  Sparkles,
  Type,
  WandSparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DateField from "@/components/shared/DateField";
import { Loader } from "@/components/shared/Loader";
import { unifiedApi, valuesOf } from "@/lib/api/modules/unified";
import { cn } from "@/lib/utils";
import { startMonths } from "../loanData";
import { InvoiceAnalysis } from "./InvoiceIntake";
import { StatusPill } from "./RequestsHub";
import { REQUEST_GROUPS, REQUEST_TYPES, groupOf, longDate, omr, typesIn } from "../requestsHub";

/**
 * Add Request: one window for every kind of request.
 *
 * Smart Request - the employee says what they need in their own words, and
 * may attach a document; the server (the AI, or plain rules when no AI is
 * connected) works out which request it is and fills in its details. The
 * employee then reviews the draft, changes whatever is wrong - the type, any
 * field - and submits it. Nothing reaches management before Submit.
 *
 * Browse Request Types - the same form, reached by picking the category and
 * the type by hand.
 *
 * Either way the request is created by its own module on the server
 * (requests/submit), so its limits, numbering and approval workflow apply as
 * they always did. A draft can be kept in this browser and picked up again.
 */

const TEXT_LIMIT = 1000;
const MAX_FILE = 10 * 1024 * 1024;
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The last twelve months, newest first (overtime is claimed for a month worked). */
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

/** The next twelve months an advance can come off: "December|2026" -> "Dec 2026". */
const deductionMonths = () => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, ahead) => {
    const month = new Date(now.getFullYear(), now.getMonth() + ahead, 1);
    return {
      value: MONTH_NAMES[month.getMonth()] + "|" + month.getFullYear(),
      label: MONTH_NAMES[month.getMonth()].slice(0, 3) + " " + month.getFullYear(),
    };
  });
};

/** Where a draft is kept in this browser: one per employee. */
const draftKey = (employeeId) => "sadeed.requestDraft." + (employeeId ?? "me");

const readDraft = (employeeId) => {
  try {
    return JSON.parse(localStorage.getItem(draftKey(employeeId)) || "null");
  } catch {
    return null;
  }
};
const writeDraft = (employeeId, draft) => {
  try {
    localStorage.setItem(draftKey(employeeId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
};
const dropDraft = (employeeId) => {
  try {
    localStorage.removeItem(draftKey(employeeId));
  } catch {
    // Storage switched off: nothing was kept.
  }
};

/**
 * The fields of a type as the form draws them. A salary advance is asked
 * for one month - "Dec 2026" - where the server keeps the month and the
 * year apart; the two are shown as one choice and filled in together.
 */
function formFields(draft) {
  const fields = draft?.fields || [];
  if (draft?.type !== "salaryAdvance") return fields;
  const rest = fields.filter((field) => field.key !== "deductMonth" && field.key !== "deductYear");
  return [{ key: "__deduction", label: "Deduction Month", kind: "deduction", required: true }, ...rest];
}

const isEmpty = (value) => value === "" || value === null || value === undefined;

/** The required fields still empty, as the form names them. */
function missingFields(draft, values) {
  return formFields(draft).filter((field) =>
    field.required &&
    (field.kind === "deduction" ? isEmpty(values.deductMonth) || isEmpty(values.deductYear) : isEmpty(values[field.key]))
  );
}

const moneyIn = (text) => Number(String(text || "").replace(/[^\d.]/g, "")) || 0;

/** What the record already says bears on this request: the limit it is held to. */
const LIMIT_FACT = {
  salaryAdvance: "Advance Available",
  loan: "Loan Limit Available",
  assistance: "Assistance Left This Year",
};

function factsOf(draft) {
  return Object.fromEntries((draft?.employee?.facts || []).map((fact) => [fact.label, fact.value]));
}

/** Days from one date to another, both counted. */
const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  return Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
};

/**
 * Whether the employee may ask for this, where the record says: "Eligible"
 * while there is room under the limit, "Limit reached" when there is none.
 */
function eligibilityOf(draft) {
  const facts = factsOf(draft);
  const limitFact = LIMIT_FACT[draft?.type];
  if (facts["Open Loan Request"]) return { ok: false, label: "Open request" };
  if (limitFact && facts[limitFact] != null) {
    return moneyIn(facts[limitFact]) > 0 ? { ok: true, label: "Eligible" } : { ok: false, label: "Limit reached" };
  }
  const leaveLeft = Object.keys(facts).find((label) => label.startsWith("Annual Leave Left"));
  if (leaveLeft && (draft.type === "leave" || draft.type === "leaveEncashment")) {
    return moneyIn(facts[leaveLeft]) > 0 ? { ok: true, label: "Eligible" } : { ok: false, label: "No days left" };
  }
  return null;
}

/** The AI's word on the draft: the limits, what follows from it, what is missing. */
function recommendationsFor(draft, values) {
  const out = [];
  const facts = factsOf(draft);
  const amount = Number(values.amount) || 0;
  const limitFact = LIMIT_FACT[draft.type];

  if (limitFact && facts[limitFact] != null) {
    const limit = moneyIn(facts[limitFact]);
    if (!amount) out.push({ tone: "info", text: `You can ask for up to OMR ${omr(limit)}.` });
    else if (amount <= limit) out.push({ tone: "ok", text: `Amount is within your eligible limit (OMR ${omr(limit)}).` });
    else out.push({ tone: "warn", text: `Amount is above your eligible limit (OMR ${omr(limit)}). Reduce it, or it will be refused.` });
  }
  if (facts["Open Loan Request"]) {
    out.push({ tone: "warn", text: `You already have an open loan request (${facts["Open Loan Request"]}).` });
  }
  if (draft.type === "salaryAdvance" && values.deductMonth && values.deductYear) {
    out.push({ tone: "ok", text: `The amount will be deducted from your salary of ${values.deductMonth} ${values.deductYear}.` });
  }
  if (draft.type === "loan" && amount && Number(values.monthly) > 0) {
    const months = Math.ceil(amount / Number(values.monthly));
    out.push({
      tone: "ok",
      text: `Repaid in about ${months} monthly installment${months === 1 ? "" : "s"} of OMR ${omr(values.monthly)}${values.startMonth ? ", starting " + values.startMonth : ""}.`,
    });
  }
  const leaveLeft = Object.keys(facts).find((label) => label.startsWith("Annual Leave Left"));
  if (leaveLeft) {
    const left = moneyIn(facts[leaveLeft]);
    const asked =
      draft.type === "leave" ? (values.leaveType === "Annual Leave" ? daysBetween(values.fromDate, values.toDate) : 0) : Number(values.days) || 0;
    if (asked > left) out.push({ tone: "warn", text: `You asked for ${asked} days; ${left} annual leave days are left.` });
    else out.push({ tone: "info", text: `You have ${facts[leaveLeft]} of annual leave left.` });
  }
  if (draft.type && (draft.missing || []).includes("invoice") && !draft.invoice) {
    out.push({ tone: "warn", text: "This claim is made on its invoice. Upload the invoice and it will be read for you." });
  }
  const missing = missingFields(draft, values);
  if (missing.length) out.push({ tone: "warn", text: "Still needed: " + missing.map((field) => field.label).join(", ") + "." });
  (draft.notes || [])
    .filter((note) => !/made on an invoice/i.test(note))
    .forEach((note) => out.push({ tone: "info", text: note }));
  if (!out.length) out.push({ tone: "ok", text: "Everything needed is filled in. Review the details and submit." });
  return out;
}

/** The reading's confidence, as the badge says it. */
function confidenceBadge(confidence) {
  if (confidence == null) return null;
  if (confidence >= 0.8) return { label: "High Confidence", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (confidence >= 0.5) return { label: "Medium Confidence", tone: "bg-amber-50 text-amber-700 ring-amber-200" };
  return { label: "Low Confidence", tone: "bg-red-50 text-red-700 ring-red-200" };
}

const EMPTY = {
  mode: "smart",
  stage: "describe",
  text: "",
  group: REQUEST_GROUPS[0].key,
  draft: null,
  values: {},
};

export default function AddRequestDialog({ open, onOpenChange, employee, history = [], onCreated }) {
  const employeeId = employee?.id ?? null;
  const [mode, setMode] = useState(EMPTY.mode); // "smart" | "browse"
  const [stage, setStage] = useState(EMPTY.stage); // smart: "describe" | "review"
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [group, setGroup] = useState(EMPTY.group);
  // What the server proposed: the type, its fields, notes and the employee's facts.
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(""); // "reading" | "retyping" | "sending"
  const [created, setCreated] = useState(null);
  const [notice, setNotice] = useState(""); // "restored" | "saved"
  const [showHistory, setShowHistory] = useState(true);
  const fileRef = useRef(null);
  const opener = useRef(null);

  const restore = (kept) => {
    setMode(kept.mode || EMPTY.mode);
    setStage(kept.stage || EMPTY.stage);
    setText(kept.text || "");
    setGroup(kept.group || EMPTY.group);
    setDraft(kept.draft || null);
    setValues(kept.values || {});
  };

  const reset = () => {
    restore(EMPTY);
    setFile(null);
    setErrors({});
    setFormError("");
    setTried(false);
    setBusy("");
    setCreated(null);
    setNotice("");
  };

  // Opening the window picks up the draft kept for this employee, if any.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const kept = readDraft(employeeId);
      if (kept) {
        restore(kept);
        setNotice("restored");
      }
    }
  }

  const close = () => {
    onOpenChange(false);
    reset();
  };

  /** Takes in a proposal from the server. */
  const show = (next, { keepConfidence = true } = {}) => {
    setDraft({ ...next, confidence: keepConfidence ? next.confidence : null });
    setValues(next.type ? valuesOf(next.fields) : {});
    setErrors({});
    setFormError("");
    setTried(false);
    if (next.type) setGroup(groupOf(next.type));
  };

  const fail = (error) => setFormError(error?.message || "Something went wrong. Please try again.");

  const pickFile = (picked) => {
    if (!picked) return null;
    if (!FILE_TYPES.includes(picked.type) && !/\.(pdf|jpe?g|png)$/i.test(picked.name)) {
      setFormError("Upload a PDF, JPG or PNG file.");
      return null;
    }
    if (picked.size > MAX_FILE) {
      setFormError("The file is larger than 10 MB.");
      return null;
    }
    setFormError("");
    return picked;
  };

  // Smart Request, step 1 -> 2: read what was written (and attached).
  const readRequest = async () => {
    if ((!text.trim() && !file) || busy) return;
    setBusy("reading");
    try {
      const next = await unifiedApi.interpret({ text: text.trim(), file, employeeId });
      show(next);
      setStage("review");
    } catch (error) {
      fail(error);
    } finally {
      setBusy("");
    }
  };

  // A type picked by hand: the same form for that type, keeping what carries over.
  const chooseType = async (type) => {
    if (!type || busy || type === draft?.type) return;
    setBusy("retyping");
    try {
      const next = await unifiedApi.retype({
        type,
        values: draft?.type ? values : {},
        invoice: draft?.invoice,
        employeeId,
      });
      show({ ...next, summary: draft?.summary || "" }, { keepConfidence: false });
    } catch (error) {
      fail(error);
    } finally {
      setBusy("");
    }
  };

  // A document added on the review: read into the draft (an invoice, chiefly).
  const attachOnReview = async (picked) => {
    const accepted = pickFile(picked);
    if (!accepted) return;
    setFile(accepted);
    if (!draft?.type || busy) return;
    setBusy("reading");
    try {
      const next = await unifiedApi.revise({ type: draft.type, values, invoice: draft.invoice, file: accepted, employeeId });
      setDraft({ ...next, confidence: draft.confidence, summary: draft.summary });
      setValues((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(valuesOf(next.fields)).filter(([, v]) => !isEmpty(v))) }));
    } catch (error) {
      fail(error);
    } finally {
      setBusy("");
    }
  };

  const goBrowse = () => {
    setMode("browse");
    setFormError("");
    // The design opens on the first kind of the first category.
    if (!draft?.type) chooseType(typesIn(group)[0]?.key);
  };

  const set = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const saveDraft = () => {
    const saved = writeDraft(employeeId, { mode, stage, text, group, draft, values, savedAt: new Date().toISOString() });
    setNotice(saved ? "saved" : "");
    if (!saved) setFormError("This browser does not allow saving a draft.");
  };

  const discardDraft = () => {
    dropDraft(employeeId);
    reset();
  };

  const submit = async () => {
    if (!draft?.type || busy) return;
    setTried(true);
    if (missingFields(draft, values).length) {
      setFormError("Fill in the required fields marked in red.");
      return;
    }
    if ((draft.missing || []).includes("invoice") && !draft.invoice) {
      setFormError("Upload the invoice this claim is for, so it can be read.");
      return;
    }
    setBusy("sending");
    setFormError("");
    try {
      const result = await unifiedApi.submit({ type: draft.type, values, invoice: draft.invoice, file, employeeId });
      dropDraft(employeeId);
      setCreated(result);
      onCreated?.(result);
    } catch (error) {
      // The module's own refusal, under the field it is about where there is one.
      const byField = Object.fromEntries(
        Object.entries(error?.errors || {}).map(([key, messages]) => [key, [].concat(messages)[0]])
      );
      if (byField.deductMonth || byField.deductYear) byField.__deduction = byField.deductMonth || byField.deductYear;
      setErrors(byField);
      const shown = formFields(draft).some((field) => byField[field.key]);
      if (!shown) fail(error);
      else setFormError(error?.message || "");
    } finally {
      setBusy("");
    }
  };

  const reviewing = mode === "browse" || stage === "review";
  const typeShown = draft?.type && groupOf(draft.type) === group ? draft.type : null;
  const typeMeta = typeShown ? REQUEST_TYPES[typeShown] : null;
  const myHistory = typeShown ? history.filter((row) => row.type === typeShown) : [];
  const badge = mode === "smart" ? confidenceBadge(draft?.confidence) : null;
  const eligible = mode === "browse" && draft?.type ? eligibilityOf(draft) : null;
  const groupMeta = REQUEST_GROUPS.find((one) => one.key === group) || REQUEST_GROUPS[0];

  return (
    <>
      <Dialog open={open && !created} onOpenChange={(next) => !next && close()}>
        <DialogContent
          hideClose
          className="max-h-[94vh] w-[min(1120px,96vw)] max-w-none gap-0 overflow-y-auto p-0"
          // A click outside must not throw away a request half written.
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            opener.current = opener.current || document.activeElement;
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus?.({ preventScroll: true });
            opener.current = null;
          }}
        >
          {/* The navy bar: what this is, and the way out. */}
          <div className="sticky top-0 z-10 flex items-center gap-3 bg-[#0b2447] px-6 py-4 text-white sm:rounded-t-lg">
            <Plus className="size-5" aria-hidden="true" />
            <DialogTitle className="text-xl font-bold">Add Request</DialogTitle>
            <DialogDescription className="sr-only">
              Describe your request or choose its type, review the details, and submit it.
            </DialogDescription>
            <DialogClose className="ms-auto rounded-md p-1 text-primary-foreground/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>

          <div className="space-y-5 px-6 py-5">
            {/* Smart Request | Browse Request Types - except on the smart
                review, where the steps say where the request stands. */}
            {mode === "smart" && stage === "review" ? (
              <StepBar />
            ) : (
              <ModeTabs mode={mode} onSmart={() => setMode("smart")} onBrowse={goBrowse} />
            )}

            {notice && (
              <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
                {notice === "restored"
                  ? "Your saved draft was restored. Attached documents are not kept in a draft - attach them again if needed."
                  : "Draft saved. It will be here the next time you open Add Request."}
                {notice === "restored" && (
                  <button type="button" onClick={discardDraft} className="font-semibold text-record-link hover:text-primary">
                    Discard draft
                  </button>
                )}
              </p>
            )}

            {/* ------------------------------------------- Smart Request */}
            {mode === "smart" && stage === "describe" && (
              <SmartDescribe
                text={text}
                onText={setText}
                file={file}
                onFile={(picked) => {
                  const accepted = pickFile(picked);
                  if (accepted) setFile(accepted);
                }}
                onClearFile={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                fileRef={fileRef}
                busy={busy}
              />
            )}

            {/* ------------------------------------ category, type, form */}
            {reviewing && (
              <div className="space-y-5">
                {mode === "smart" && draft && !draft.type && (
                  <Note tone="warn">
                    {draft.summary || "The request could not be recognised."} Choose the category and the request type below.
                  </Note>
                )}

                <GroupTabs value={group} onChange={setGroup} />

                <section aria-label={groupMeta.label + " requests"} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <groupMeta.icon className="mt-0.5 size-7 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
                    <div>
                      <h3 className="text-lg font-bold text-primary">{groupMeta.label} Requests</h3>
                      <p className="text-sm text-primary/75">{groupMeta.note}</p>
                    </div>
                  </div>
                  <div role="radiogroup" aria-label="Request type" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {typesIn(group).map((type) => {
                      const Icon = type.icon;
                      const on = typeShown === type.key;
                      return (
                        <button
                          key={type.key}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={Boolean(busy)}
                          onClick={() => chooseType(type.key)}
                          className={cn(
                            "relative flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                            on ? "border-blue-400 bg-blue-50 shadow-sm" : "border-container-border bg-card hover:bg-slate-50"
                          )}
                        >
                          {on && (
                            <span className="absolute end-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-blue-600 text-white">
                              <Check className="size-3.5" aria-hidden="true" />
                            </span>
                          )}
                          <Icon className="size-7 text-primary" strokeWidth={1.5} aria-hidden="true" />
                          <span className="text-sm font-bold text-primary">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {busy === "retyping" && <Working>Preparing the request form…</Working>}
                {busy === "reading" && <Working>Reading your document…</Working>}

                {typeShown && busy !== "retyping" && (
                  <div className="space-y-4">
                    {/* The type, how sure the reading was (or whether the
                        employee may ask), and a document to go with it. */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-container-border bg-slate-50/70 px-4 py-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                        <typeMeta.icon className="size-5" strokeWidth={1.6} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs text-primary/70">Request Type</p>
                        <p className="font-bold text-primary">{typeMeta.full || typeMeta.label}</p>
                      </div>
                      {badge && (
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", badge.tone)}>
                          <Check className="size-3.5" aria-hidden="true" />
                          {badge.label}
                        </span>
                      )}
                      {eligible && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                            eligible.ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"
                          )}
                        >
                          {eligible.ok ? <Check className="size-3.5" aria-hidden="true" /> : <AlertTriangle className="size-3.5" aria-hidden="true" />}
                          {eligible.label}
                        </span>
                      )}
                      <label className="ms-auto inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-white focus-within:ring-2 focus-within:ring-ring">
                        <CloudUpload className="size-5" aria-hidden="true" />
                        Upload Document(s)
                        <span className="font-normal text-muted-foreground">
                          {(draft.missing || []).includes("invoice") ? "(Invoice required)" : "(Optional)"}
                        </span>
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.jpg,.jpeg,.png"
                          disabled={Boolean(busy)}
                          onChange={(event) => {
                            attachOnReview(event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      {file && (
                        <FileChip name={file.name} onRemove={() => setFile(null)} />
                      )}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                      <div className="min-w-0 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          {formFields(draft).map((field) => (
                            <FormField
                              key={field.key}
                              field={field}
                              values={values}
                              onChange={set}
                              error={
                                errors[field.key] ||
                                (tried && missingFields(draft, values).some((one) => one.key === field.key) ? "Required field" : "")
                              }
                              disabled={busy === "sending"}
                            />
                          ))}
                        </div>

                        {draft.invoice && <InvoiceAnalysis invoice={draft.invoice} risk={draft.risk} />}

                        <TypeHistory
                          label={typeMeta.label}
                          rows={myHistory}
                          open={showHistory}
                          onToggle={() => setShowHistory((now) => !now)}
                        />
                      </div>

                      <Recommendations items={recommendationsFor(draft, values)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {formError && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {formError}
              </p>
            )}
          </div>

          {/* The ways on, at the foot. */}
          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-container-border bg-card px-6 py-4 sm:rounded-b-lg">
            {mode === "smart" && stage === "describe" ? (
              <>
                <button
                  type="button"
                  onClick={goBrowse}
                  className="inline-flex items-center gap-2 rounded-md px-1 text-sm font-semibold text-record-link hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LayoutGrid className="size-4" aria-hidden="true" />
                  Browse Request Types
                  <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                </button>
                <div className="ms-auto flex items-center gap-3">
                  <Button type="button" variant="cancel" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={readRequest} disabled={(!text.trim() && !file) || Boolean(busy)}>
                    {busy === "reading" ? <Loader size={16} label="Reading" /> : null}
                    {busy === "reading" ? "Reading…" : "Continue"}
                    {busy !== "reading" && <ChevronRight className="rtl:rotate-180" aria-hidden="true" />}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="cancel"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setMode("smart");
                    setStage("describe");
                    setFormError("");
                  }}
                >
                  <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
                  Back
                </Button>
                <div className="ms-auto flex items-center gap-3">
                  <Button type="button" variant="add" onClick={saveDraft} disabled={Boolean(busy)}>
                    Save as Draft
                  </Button>
                  <Button type="button" onClick={submit} disabled={!typeShown || Boolean(busy)}>
                    {busy === "sending" ? <Loader size={16} label="Sending" /> : <Send aria-hidden="true" />}
                    Submit Request
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SubmittedDialog created={created} onClose={close} />
    </>
  );
}

/* -------------------------------------------------------------- the parts */

function ModeTabs({ mode, onSmart, onBrowse }) {
  const tab = (on) =>
    cn(
      "flex flex-1 items-center justify-center gap-2.5 rounded-lg px-4 py-2.5 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      on ? "bg-primary text-primary-foreground shadow-sm" : "text-primary hover:bg-white"
    );
  return (
    <div role="tablist" aria-label="How to add the request" className="mx-auto flex max-w-3xl gap-1 rounded-xl border border-container-border bg-blue-50/60 p-1">
      <button type="button" role="tab" aria-selected={mode === "smart"} onClick={onSmart} className={tab(mode === "smart")}>
        <Sparkles className="size-5" aria-hidden="true" />
        Smart Request
      </button>
      <button type="button" role="tab" aria-selected={mode === "browse"} onClick={onBrowse} className={tab(mode === "browse")}>
        <LayoutGrid className="size-5" aria-hidden="true" />
        Browse Request Types
      </button>
    </div>
  );
}

/** The three steps of a smart request, on the review: the first done, the second here. */
function StepBar() {
  const steps = [
    { title: "1. Smart Request", note: "Request details & documents", state: "done" },
    { title: "Review & Complete", note: "Verify the extracted details", state: "here" },
    { title: "Submit", note: "Send your request", state: "ahead" },
  ];
  return (
    <ol aria-label="Request steps" className="flex flex-wrap items-center gap-3">
      {steps.map((step, index) => (
        <li key={step.title} className="flex flex-1 items-center gap-3" aria-current={step.state === "here" ? "step" : undefined}>
          <span
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-lg px-3 py-2",
              step.state === "here" && "bg-blue-50"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                step.state === "done" ? "bg-blue-600 text-white" : step.state === "here" ? "bg-blue-600 text-white" : "bg-slate-100 text-primary"
              )}
            >
              {step.state === "done" ? <Check className="size-5" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-sm font-bold", step.state === "ahead" ? "text-primary" : "text-blue-700")}>{step.title}</span>
              <span className="block text-xs text-primary/70">{step.note}</span>
            </span>
            {step.state === "done" && <span className="sr-only">(done)</span>}
          </span>
          {index < steps.length - 1 && <span aria-hidden="true" className="hidden h-px flex-1 bg-container-border sm:block" />}
        </li>
      ))}
    </ol>
  );
}

function SmartDescribe({ text, onText, file, onFile, onClearFile, fileRef, busy }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="space-y-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-white p-5">
      <div className="flex items-start gap-3">
        <WandSparkles className="mt-1 size-8 shrink-0 text-blue-600" strokeWidth={1.5} aria-hidden="true" />
        <div>
          <h3 className="text-2xl font-bold text-primary">Smart Request</h3>
          <p className="text-sm text-primary/80">
            Describe your request in your own words, and AI will identify the request type, extract the details, and
            create a draft for your review.
          </p>
        </div>
      </div>

      <div className="relative">
        <label htmlFor="smart-request-text" className="sr-only">
          What would you like to request?
        </label>
        {/* The one box here that is written in at length: several lines
            high, unlike the one-line Textarea the forms use. */}
        <textarea
          id="smart-request-text"
          value={text}
          maxLength={TEXT_LIMIT}
          onChange={(event) => onText(event.target.value)}
          placeholder={'What would you like to request?\nFor example: "I need a salary advance of 300 OMR deducted from December"'}
          disabled={Boolean(busy)}
          rows={4}
          className="block h-32 w-full resize-y rounded-field border border-field-border bg-card px-4 py-3 pb-7 text-base text-primary placeholder:text-muted-foreground focus-visible:border-[var(--focus-navy)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-disabled"
        />
        <span aria-live="polite" className="pointer-events-none absolute bottom-2 end-3 text-xs text-muted-foreground">
          {text.length} / {TEXT_LIMIT.toLocaleString("en-US")}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            onFile(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center",
            dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-card"
          )}
        >
          <CloudUpload className="size-8 text-blue-600" strokeWidth={1.5} aria-hidden="true" />
          <p className="font-bold text-primary">Upload Document(s)</p>
          <p className="text-sm text-primary/75">
            Drag &amp; drop files here or{" "}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={Boolean(busy)}
              className="font-semibold text-record-link hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              click to browse
            </button>
          </p>
          <p className="text-xs text-muted-foreground">PDF, JPG, PNG (Max 10 MB each)</p>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png"
            aria-label="Upload a document"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          {file && <FileChip name={file.name} onRemove={onClearFile} />}
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="mb-3 flex items-center gap-2 font-bold text-primary">
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground">AI</span>
            How it works?
          </p>
          <ol className="space-y-2.5 text-sm text-primary/90">
            {[
              "Describe your request and attach documents (optional).",
              "AI will identify the request type and fill in the details.",
              "Review the draft, make any changes, and submit.",
            ].map((line, index) => (
              <li key={line} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary ring-1 ring-container-border">
                  {index + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
        </div>
      </div>
      {busy === "reading" && <Working>Reading your request…</Working>}
    </div>
  );
}

function GroupTabs({ value, onChange }) {
  return (
    <div role="tablist" aria-label="Request category" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {REQUEST_GROUPS.map((group) => {
        const Icon = group.icon;
        const on = group.key === value;
        return (
          <button
            key={group.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(group.key)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "border-primary bg-primary text-primary-foreground" : "border-container-border bg-card text-primary hover:bg-slate-50"
            )}
          >
            <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
            {group.label}
          </button>
        );
      })}
    </div>
  );
}

/** The mark beside a field, by what it holds. */
const KIND_ICON = {
  number: Banknote,
  deduction: CalendarDays,
  month: CalendarDays,
  monthName: CalendarDays,
  date: CalendarDays,
  select: ListChecks,
  text: Type,
  longText: FileText,
};

/** One field of the request, drawn by its kind. */
function FormField({ field, values, onChange, error, disabled }) {
  const id = "add-request-" + field.key;
  const Icon = KIND_ICON[field.kind] || Type;
  const wide = field.kind === "longText";
  const value = values[field.key] ?? "";

  const options =
    field.kind === "select"
      ? field.options.map((option) => ({ value: option, label: option }))
      : field.kind === "monthName"
        ? startMonths(12).map((month) => ({ value: month, label: month }))
        : field.kind === "month"
          ? recentMonths()
          : field.kind === "deduction"
            ? deductionMonths()
            : null;

  const selectValue =
    field.kind === "deduction"
      ? values.deductMonth && values.deductYear
        ? values.deductMonth + "|" + values.deductYear
        : ""
      : String(value || "");
  const choose = (next) => {
    if (field.kind === "deduction") {
      const [month, year] = next.split("|");
      onChange("deductMonth", month);
      onChange("deductYear", year);
    } else onChange(field.key, next);
  };
  // A restored or read value not among this month's choices is still shown.
  const shownOptions =
    options && selectValue && !options.some((option) => option.value === selectValue)
      ? [...options, { value: selectValue, label: selectValue.replace("|", " ") }]
      : options;

  return (
    <div className={cn("flex gap-3 rounded-xl border border-container-border bg-card p-3", wide && "sm:col-span-2")}>
      {!wide && (
        <span aria-hidden="true" className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
          <Icon className="size-5" strokeWidth={1.6} />
        </span>
      )}
      <div className="form-field min-w-0 flex-1 space-y-1.5">
        <label htmlFor={id} className="block text-sm font-semibold text-primary">
          {field.label}
          {field.required && <span className="ms-0.5 text-red-600">*</span>}
        </label>
        {shownOptions ? (
          <Select value={selectValue} onValueChange={choose} disabled={disabled}>
            <SelectTrigger id={id} aria-invalid={Boolean(error) || undefined}>
              <SelectValue placeholder="Please select" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {shownOptions.map((option) => (
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
            onChange={(event) => onChange(field.key, event.target.value)}
            aria-invalid={Boolean(error) || undefined}
            disabled={disabled}
          />
        ) : field.kind === "longText" ? (
          <Textarea
            id={id}
            value={value || ""}
            maxLength={500}
            onChange={(event) => onChange(field.key, event.target.value)}
            aria-invalid={Boolean(error) || undefined}
            disabled={disabled}
            className="min-h-20"
          />
        ) : (
          <Input
            id={id}
            value={value ?? ""}
            inputMode={field.kind === "number" ? "decimal" : undefined}
            onChange={(event) =>
              onChange(
                field.key,
                field.kind === "number"
                  ? event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
                  : event.target.value
              )
            }
            aria-invalid={Boolean(error) || undefined}
            disabled={disabled}
            className="numeric-value"
          />
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** The employee's earlier requests of this kind, folded away on request. */
function TypeHistory({ label, rows, open, onToggle }) {
  const detailLabel = rows[0]?.detailLabel || "Details";
  return (
    <section className="rounded-xl border border-container-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <History className="size-5 text-blue-600" aria-hidden="true" />
        <span className="font-bold text-primary">{label} History</span>
        <span className="text-sm text-muted-foreground">({rows.length})</span>
        <ChevronDown className={cn("ms-auto size-5 text-primary transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open &&
        (rows.length ? (
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-table-head text-start text-xs font-semibold text-table-head-ink">
                  <th className="px-3 py-2 text-start">#</th>
                  <th className="px-3 py-2 text-start">Requested Date</th>
                  <th className="px-3 py-2 text-end">Amount (OMR)</th>
                  <th className="px-3 py-2 text-start">{detailLabel}</th>
                  <th className="px-3 py-2 text-start">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-b border-container-border last:border-0">
                    <td className="px-3 py-2 text-primary/80">{index + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-record-link">{longDate(row.date) || "–"}</td>
                    <td className="numeric-value px-3 py-2 text-end text-primary">{row.amount != null ? omr(row.amount) : "–"}</td>
                    <td className="px-3 py-2 text-primary">{row.detail || "–"}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No earlier {label.toLowerCase()} requests.</p>
        ))}
    </section>
  );
}

function Recommendations({ items }) {
  return (
    <aside aria-label="AI recommendations" className="h-fit rounded-xl border border-blue-100 bg-blue-50/60 p-4">
      <p className="mb-3 flex items-center gap-2 font-bold text-blue-800">
        <WandSparkles className="size-5" aria-hidden="true" />
        AI Recommendations
      </p>
      <ul className="space-y-3 text-sm text-primary">
        {items.map((item) => (
          <li key={item.text} className="flex items-start gap-2.5">
            {item.tone === "ok" ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0 fill-emerald-500 text-white" aria-hidden="true" />
            ) : item.tone === "warn" ? (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 size-5 shrink-0 text-blue-600" aria-hidden="true" />
            )}
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Note({ tone, children }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
        tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function Working({ children }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-container-border bg-muted/40 px-4 py-3 text-sm text-primary">
      <Loader size={18} label="" />
      <span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary/70">
          <Sparkles className="size-3.5" aria-hidden="true" />
          SADEED AI
        </span>
        {children}
      </span>
    </div>
  );
}

function FileChip({ name, onRemove }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-sm text-primary">
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

/** The request is in: its number, as the server gave it. */
function SubmittedDialog({ created, onClose }) {
  return (
    <Dialog open={Boolean(created)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-[min(560px,94vw)] max-w-none gap-0 overflow-hidden p-0 text-center">
        <div className="bg-gradient-to-b from-emerald-50 to-white px-8 pb-2 pt-10">
          <span className="mx-auto flex size-24 items-center justify-center rounded-full bg-emerald-100">
            <Check className="size-14 text-emerald-600" strokeWidth={3} aria-hidden="true" />
          </span>
        </div>
        <div className="space-y-5 px-8 pb-8 pt-4">
          <DialogTitle className="text-2xl font-extrabold text-primary">Request Submitted Successfully</DialogTitle>
          <DialogDescription className="sr-only">
            Your {created?.typeLabel} request has been sent to management for review.
          </DialogDescription>
          {created?.requestNo && (
            <p className="mx-auto inline-flex items-baseline gap-2 rounded-xl bg-slate-100 px-6 py-3 text-lg text-primary">
              Request No.: <span className="numeric-value text-xl font-extrabold">{created.requestNo}</span>
            </p>
          )}
          <p className="text-sm text-primary/75">
            Your {created?.typeLabel?.toLowerCase()} request is now with management. Follow its status in the Requests list.
          </p>
          <Button type="button" onClick={onClose} className="min-w-32">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
