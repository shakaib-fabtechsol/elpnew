import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRY_DIAL_CODES, DEFAULT_DIAL_CODE } from "@/lib/constants";

/**
 * A phone number and the code it is dialled with, as one field.
 *
 * The code and the number are one answer, so they are drawn as one box: a
 * single border round the pair and a plain rule between them, rather than two
 * controls that happen to sit side by side.
 *
 * The list of codes is searchable - by the code itself or by country - because
 * there are far too many to find by scrolling, and because the person filling
 * the form usually knows the code they want (+968, +965) rather than where it
 * sits in the list.
 */
export default function PhoneInput({
  id,
  name,
  dialCode,
  onDialCode,
  value,
  onChange,
  placeholder = "Enter phone number",
  disabled,
  required,
  // Marks the number as wrong, the way an Input with aria-invalid is marked.
  invalid,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const code = dialCode || DEFAULT_DIAL_CODE;

  // Close on a click elsewhere or on Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    searchRef.current?.focus();

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const term = query.trim().toLowerCase();
  const matches = term
    ? COUNTRY_DIAL_CODES.filter(
        (country) =>
          country.dial.includes(term) ||
          country.name.toLowerCase().includes(term) ||
          country.code.toLowerCase().includes(term)
      )
    : COUNTRY_DIAL_CODES;

  const choose = (country) => {
    onDialCode(country.dial);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* One border, one set of rounded corners - the parts inside have none
          of their own. Drawn with the same height, border, fill, focus and
          error marks as every other field, so a phone number does not stand
          out from the fields beside it. */}
      <div
        className={cn(
          "flex h-[42px] w-full items-center overflow-hidden rounded-field border border-field-border bg-field transition-colors focus-within:border-[var(--focus-navy)] focus-within:shadow-[var(--focus-ring)]",
          invalid &&
            "border-[var(--error-border)] focus-within:border-[var(--error-border)] focus-within:shadow-[var(--error-ring)]",
          disabled && "cursor-not-allowed border-disabled-border bg-disabled text-disabled-text"
        )}
      >
        {/* The code reads at the weight of the number beside it: it is part
            of the same value, not a label for it. */}
        <button
          type="button"
          disabled={disabled}
          aria-label="Country dialling code"
          aria-expanded={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
          className="flex h-full shrink-0 items-center gap-1 px-3 text-sm focus:outline-none focus-visible:bg-muted disabled:cursor-not-allowed"
        >
          {code}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>

        {/* A plain rule, not a gap: the two parts are one field. */}
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />

        <input
          id={id}
          name={name}
          type="tel"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          inputMode="tel"
          aria-invalid={invalid || undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {open && (
        <Card className="absolute start-0 end-0 top-full z-50 mt-1">
          <CardContent className="p-1">
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search +968, Oman..."
                className="h-8 ps-8 text-sm"
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {matches.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No dialling code found.
                </p>
              ) : (
                matches.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => choose(country)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm transition-colors",
                      country.dial === code
                        ? "bg-secondary text-secondary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="shrink-0">{country.flag}</span>
                    <span className="w-14 shrink-0 font-medium">{country.dial}</span>
                    <span className="truncate opacity-70">{country.name}</span>
                    {country.dial === code && <Check className="ms-auto h-4 w-4 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
