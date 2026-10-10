import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A date, written the one way the firm writes dates: DD/MM/YYYY.
 *
 * A native date input is not used for the visible field because it prints
 * whatever order and numerals the reader's browser is set to - a record that
 * says 03/04 means two different days to two people, which is not something a
 * legal file can carry. The typed field is ours and always reads DD/MM/YYYY
 * in Latin digits, in both languages; `lang` and `dir` on the input are what
 * hold the digits and the order still when the page turns to Arabic.
 *
 * What it *stores* is unchanged: an ISO date, the same YYYY-MM-DD a native
 * date input gives, so this drops in beside one without touching anything
 * that compares, sorts or files by date. Display and storage are different
 * questions and only the display was ever wrong.
 *
 * The calendar sits inside the field at its trailing edge and opens the
 * browser's own picker, so a date can still be chosen rather than typed.
 */

/** DD/MM/YYYY for reading, out of the YYYY-MM-DD that is stored. */
const toTyped = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
};

/** YYYY-MM-DD to store, out of a complete DD/MM/YYYY. */
const toISO = (text) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text || "");
  return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
};

/** Digits only, with the slashes put in as they are typed. */
const format = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  return parts.filter(Boolean).join("/");
};

export default function DateField({
  id,
  name,
  value = "",
  onChange,
  className,
  min,
  max,
  disabled,
  readOnly,
  ...props
}) {
  const pickerRef = useRef(null);

  // What is being typed, while it is still too short to be a date. Held apart
  // from the stored value so a half-typed "05/1" is not thrown away on every
  // keystroke for failing to parse.
  const [typing, setTyping] = useState(null);
  const shown = typing ?? toTyped(value);

  /** Reported the way a native date input reports: an event with a value. */
  const report = (iso) =>
    onChange?.({ target: { name, id, value: iso, type: "date" } });

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        name={name}
        // Latin digits and day-month-year order, whichever way the page runs.
        lang="en"
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        value={shown}
        onChange={(e) => {
          const next = format(e.target.value);
          setTyping(next);
          const iso = toISO(next);
          if (iso || next === "") report(iso);
        }}
        onBlur={() => setTyping(null)}
        disabled={disabled}
        readOnly={readOnly}
        className="pe-10"
        {...props}
      />
      {/* Inside the border, at the end of the field, whichever end that is. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || readOnly}
        onClick={() => pickerRef.current?.showPicker?.()}
        className="absolute end-3 top-1/2 -translate-y-1/2 text-menu-icon transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarDays strokeWidth={1.5} className="size-[18px]" />
      </button>
      {/* Never seen; it exists so the browser's own picker can be opened. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
        // The limits live on the picker: a typed text field has none.
        min={min}
        max={max}
        value={value || ""}
        onChange={(e) => {
          setTyping(null);
          report(e.target.value);
        }}
      />
    </div>
  );
}
