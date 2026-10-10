import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileCheck, Upload as UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The fields a stepped request form is built from.
 *
 * They live here rather than in one of the forms because every request in the
 * system now asks the same way - a request is written, and then decided - and
 * two copies of these would drift apart the first time one was changed.
 *
 * Each one is `flex h-full flex-col justify-end`, so that fields sitting in
 * the same row of a grid line up along the bottom however many lines their
 * labels take. Used on its own, outside a grid, a field wants `space-y-2`
 * instead: stretching to nothing is what leaves a hole under it.
 */

/** A field's label. */
export function FieldLabel({ htmlFor, children }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
    </Label>
  );
}

/**
 * A figure or fact the form shows rather than asks for.
 *
 * `held` marks money coming off the pay, and `payable` the one figure the
 * request is really about, so neither has to be hunted for among the rest.
 */
export function Settled({ id, label, value, held, payable, hint, span }) {
  return (
    <div
      className={cn(
        "form-field relative flex h-full flex-col justify-end gap-2",
        useSpan(span)
      )}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        readOnly
        tabIndex={-1}
        value={value}
        className={cn(
          "cursor-default bg-locked text-muted-foreground",
          held && "font-semibold text-destructive",
          payable && "font-semibold text-green-700"
        )}
      />
      {/* What the figure above means, hung below the box rather than set in
          the column: in the flow it would push this one field's box up out
          of line with the rest of the row. The row it sits in leaves the
          space for it. */}
      {hint && (
        <p className="absolute start-0 top-full mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * One fact of a transfer summary: what it is, then what it says.
 *
 * Not a field: the strip at the foot of a disbursement, read against the
 * transfer above it before that transfer is confirmed.
 */
export function Said({ label, value, settled }) {
  return (
    <div className="px-0 lg:px-4 lg:first:ps-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold",
          settled ? "text-green-700" : "text-primary"
        )}
      >
        {value || "-"}
      </p>
    </div>
  );
}

/** One thing chosen from a list, laid out like every other field. */
export function Choice({
  id,
  label,
  value,
  onChange,
  placeholder,
  options,
  disabled,
  required = true,
  error,
  span,
}) {
  return (
    <div
      className={cn(
        "form-field flex h-full flex-col justify-end gap-2",
        useSpan(span)
      )}
      data-invalid={error ? "true" : undefined}
      data-required={required ? "true" : undefined}
    >
      <FieldLabel htmlFor={id}>
        {label}
      </FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * The paperclip beside a field: one icon whether or not a file is on it.
 *
 * The file name lives in the tooltip rather than on the page, so attaching
 * something never pushes the field it belongs to out of its row.
 */
export function Attach({ file, onPick, label }) {
  if (file) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0 border-green-600 text-green-600 hover:text-destructive"
        title={file.name + " - click to remove"}
        onClick={() => onPick(null)}
      >
        <FileCheck className="h-4 w-4" />
        <span className="sr-only">{file.name} attached. Remove it.</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0"
      title={"Upload " + label}
      asChild
    >
      <label className="cursor-pointer">
        <UploadIcon className="h-4 w-4" />
        <span className="sr-only">Upload {label}</span>
        <Input
          type="file"
          className="hidden"
          onChange={(e) => e.target.files[0] && onPick(e.target.files[0])}
        />
      </label>
    </Button>
  );
}

/* ------------------------------------------- stepped request forms */

/**
 * A named part of the form.
 *
 * The request is long enough that a run of fields tells nobody which question
 * they are answering, so each part says what it is and carries its own rule
 * down the left - the same mark the page's own heading uses, one step quieter.
 */
export function Group({ title, children }) {
  return (
    <section className="space-y-4">
      <p className="border-s-4 border-primary ps-3 text-base font-bold text-primary">
        {title}
      </p>
      {children}
    </section>
  );
}

/**
 * How wide a field is, unless it says otherwise.
 *
 * A row announces how many fields it means to hold, and every field in it
 * takes an equal share of the twelve columns underneath. Passed down rather
 * than repeated on each field, so a row cannot half-change its mind.
 */
const RowWidth = createContext(4);

/** Only the spans Standard 03 approves; anything else is a layout nobody agreed. */
const SPAN = { 12: "span-12", 6: "span-6", 4: "span-4", 3: "span-3" };

/**
 * One row of fields, laid on the twelve-column grid.
 *
 * `cols` is how many fields the row holds, which is the thing anybody writing
 * a form actually knows - four is the system's default, and the grid works
 * out that each of them is three columns wide. A field needing more room says
 * so itself with `span`, and only in the widths the standard allows.
 *
 * Narrower screens drop to two fields a row and then one; nothing else about
 * a field changes with the width of the screen.
 */
export function Row({ cols = 4, children }) {
  return (
    <RowWidth.Provider value={cols}>
      <div className="form-grid">{children}</div>
    </RowWidth.Provider>
  );
}

/** The columns one field takes: what it asked for, or its row's even share. */
function useSpan(span) {
  const cols = useContext(RowWidth);
  return SPAN[span] || SPAN[Math.round(12 / cols)] || SPAN[3];
}

/**
 * A field: its label, its control, and whatever rule governs it underneath.
 *
 * All three are stacked from the top, so every control in a row sits at the
 * same height whether or not the field beside it has a note to carry. Hanging
 * them from the bottom instead would drop any field without a note lower than
 * its neighbours - which is the one thing a row of figures must not do, since
 * it reads as though they belong to different rows.
 *
 * The note is part of the field rather than a thing written after it: one
 * written outside belongs to no cell, and grows over whatever comes next.
 */
export function Field({ id, label, required, note, error, span, children }) {
  return (
    <div
      className={cn("form-field flex h-full flex-col gap-2", useSpan(span))}
      // Read by the stylesheet, which paints whatever control is inside -
      // an input, a textarea, a select, or one wrapped in a div of its own.
      // Marking the control itself would mean knowing how deep it sits.
      data-invalid={error ? "true" : undefined}
      data-required={required ? "true" : undefined}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {/* What is wrong takes the place of what is merely worth knowing: two
          lines under one field is one line too many. */}
      {error ? (
        <FieldError htmlFor={id}>{error}</FieldError>
      ) : (
        note && <Note className="-mt-1">{note}</Note>
      )}
    </div>
  );
}

/** What a field is missing, said under it. */
export function FieldError({ htmlFor, children }) {
  return (
    <p id={htmlFor ? htmlFor + "-error" : undefined} className="field-error" role="alert">
      {children}
    </p>
  );
}

/** The one thing an empty required field is told. */
export const REQUIRED_MESSAGE = "Please fill in this field";

const isBlank = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && !value.trim()) ||
  (Array.isArray(value) && value.length === 0);

/**
 * Required fields, checked when somebody tries to save rather than before.
 *
 * Standard 04: nothing is marked in advance - no asterisk, no red, no notice
 * that a field will be wanted. The form only speaks once the person has said
 * they are finished, and then it says exactly which fields are not.
 *
 * `fields` maps a field's id to its current value, so a field that gets
 * filled in stops complaining the moment it does, without waiting for another
 * attempt. `check()` returns whether the form may be saved, and takes the
 * person to the first field that is not, because a message under a field
 * scrolled off the screen is a message nobody reads.
 */
export function useRequiredFields(fields) {
  const [attempted, setAttempted] = useState(false);

  const missing = useMemo(
    () => Object.keys(fields).filter((id) => isBlank(fields[id])),
    [fields]
  );

  const check = useCallback(() => {
    setAttempted(true);
    if (missing.length === 0) return true;
    const first = document.getElementById(missing[0]);
    if (first) {
      first.scrollIntoView({ block: "center", behavior: "smooth" });
      first.focus({ preventScroll: true });
    }
    return false;
  }, [missing]);

  const errorFor = useCallback(
    (id) => (attempted && missing.includes(id) ? REQUIRED_MESSAGE : ""),
    [attempted, missing]
  );

  /** Back to saying nothing, for a form that has been closed and reopened. */
  const reset = useCallback(() => setAttempted(false), []);

  return { check, errorFor, reset, missing, attempted };
}

/**
 * A form that checks itself when somebody tries to save it.
 *
 * Standard 04, for the forms built from plain labels and inputs rather than
 * the Field components. Spread `guard.props` onto whatever wraps the fields,
 * put `guard.check()` at the top of the save handler, and stop disabling the
 * save button.
 *
 * What is required is read off the controls themselves - a native `required`
 * attribute, or `data-required` on a cell holding a select - so there is no
 * second list of mandatory fields to drift out of step with the first. The
 * stylesheet does the rest: the red border and the message under each empty
 * field appear only once `data-checked` is set, and go the moment the field
 * is filled, because :invalid updates as the person types.
 */
/**
 * Whether the form somebody has just tried to save is complete.
 *
 * Standard 04: nothing is marked in advance, and the form speaks only once
 * the person says they are finished. Calling this is what makes it speak -
 * put it at the top of a save handler and stop disabling the save button.
 *
 * What is required is read off the controls themselves: a native `required`
 * input is :invalid while it is blank, and a cell marked `data-required`
 * holding a Radix select is empty while the trigger still shows its
 * placeholder. So there is no second list of mandatory fields to drift out of
 * step with the markup, and a field stops complaining the moment it is
 * filled, because :invalid updates as the person types.
 *
 * The flag goes on the document rather than on a wrapper each form has to
 * remember to spread, which is what lets every form in the system opt in with
 * one line. Only one form is open at a time here - they are dialogs, panels
 * and pages - so there is nothing else on screen for it to light up.
 */
export function checkRequired(root) {
  const scope = root || openForm();

  const typed = [...scope.querySelectorAll("input, textarea, select")].filter(
    (el) => el.required && !el.disabled && !String(el.value).trim()
  );
  const chosen = [...scope.querySelectorAll('[data-required="true"]')]
    .map((cell) => cell.querySelector("button[role='combobox'][data-placeholder]"))
    .filter(Boolean);
  const gaps = [...typed, ...chosen];

  clearRequiredCheck();
  if (gaps.length === 0) return true;

  // Marked on the form rather than on the document, so the marking goes when
  // the form does. A form abandoned half-filled must not leave the next one
  // showing red before anybody has touched it.
  marked = scope === document ? document.body : scope;
  marked.setAttribute("data-checked", "true");

  // Taken to the first gap rather than left to find it: a message under a
  // field that has scrolled off the screen is a message nobody reads.
  gaps[0].scrollIntoView({ block: "center", behavior: "smooth" });
  gaps[0].focus({ preventScroll: true });
  return false;
}

/**
 * The form the person is actually working in.
 *
 * A dialog is rendered through a portal, at the end of the document rather
 * than inside the page that opened it - so a check run from inside one would
 * otherwise also find the empty fields of the record behind it, refuse to
 * save for a reason that is not on screen, and send the cursor somewhere the
 * person cannot see. The open dialog is the form; the page under it is not.
 */
function openForm() {
  const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
  return dialogs.length ? dialogs[dialogs.length - 1] : document;
}

/** Where the last failed check left its mark, so it can be taken off again. */
let marked = null;

/** Back to saying nothing - for a form that has been closed or saved. */
export function clearRequiredCheck() {
  if (marked) marked.removeAttribute("data-checked");
  document.body.removeAttribute("data-checked");
  marked = null;
}

/** A figure or a fact the form reads back rather than asks for. */
export function Locked({ id, label, value, highlight, note, span }) {
  return (
    <Field id={id} label={label} note={note} span={span}>
      <Input
        id={id}
        readOnly
        tabIndex={-1}
        value={value}
        className={cn(
          "cursor-default bg-locked text-muted-foreground",
          highlight && "border-green-600/40 font-semibold text-green-700"
        )}
      />
    </Field>
  );
}

/** The rule a field is governed by, written under it rather than assumed. */
export function Note({ className, children }) {
  return (
    <p className={cn("text-xs leading-snug text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/**
 * A comment with a limit, and the limit in sight.
 *
 * The count is shown rather than the typing simply stopping: a box that
 * refuses a keystroke without saying why reads as broken.
 */
export function Counted({ id, value, onChange, limit, placeholder }) {
  // A record written before this field existed has nothing under that name,
  // and an empty box is what that should read as - not a crash.
  const text = value || "";

  // The height of an ordinary field, as every comment box is: it does not
  // grow as it fills, so the row it stands in keeps its height.
  return (
    <div className="space-y-1">
      <Textarea
        id={id}
        maxLength={limit}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <p className="text-end text-xs text-muted-foreground">
        {text.length} / {limit}
      </p>
    </div>
  );
}

/**
 * One of the three answers the office can give, as a row that can be picked.
 *
 * Built from a button rather than a native radio so the whole row is the
 * target: the answer to a request for money is not a thing to have to aim at.
 */
export function Decision({ value, chosen, onChoose, tone, disabled }) {
  const picked = chosen === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={picked}
      disabled={disabled}
      onClick={() => onChoose(value)}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-start text-sm transition",
        picked
          ? tone === "bad"
            ? "border-destructive bg-destructive/5 font-medium text-destructive"
            : tone === "part"
              ? "border-decision-partial-ink bg-decision-partial font-medium text-decision-partial-ink"
              : "border-green-600 bg-green-50 font-medium text-green-800"
          : "hover:bg-muted/50",
        // Where the decision is only being read, the card shows it and
        // cannot change it.
        disabled && "cursor-default disabled:hover:bg-transparent",
        disabled && !picked && "opacity-70"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          picked
            ? tone === "bad"
              ? "border-destructive"
              : tone === "part"
                ? "border-decision-partial-ink"
                : "border-green-600"
            : "border-muted-foreground/50"
        )}
      >
        {picked && (
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              tone === "bad"
                ? "bg-destructive"
                : tone === "part"
                  ? "bg-decision-partial-ink"
                  : "bg-green-600"
            )}
          />
        )}
      </span>
      {value}
    </button>
  );
}
