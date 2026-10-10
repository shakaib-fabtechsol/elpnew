import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A select with a search box in its list.
 *
 * The Radix select has no search, and its own type-ahead swallows keystrokes
 * from any input placed inside it, so this is built as a plain button and panel
 * instead. Use it wherever the list is long enough that scrolling is a chore.
 *
 * `options` is [{ value, label }].
 */
export default function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Please Select",
  searchPlaceholder = "Search...",
  className,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const selected = options.find((option) => option.value === value);

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
    ? options.filter((option) => option.label.toLowerCase().includes(term))
    : options;

  const choose = (option) => {
    onValueChange(option.value);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        // Dressed exactly as the plain select beside it, so a row mixing the
        // two keeps one height, one border and one focus ring.
        className="flex h-[42px] w-full items-center justify-between whitespace-nowrap rounded-field border border-field-border bg-field px-3 py-2 text-sm transition-colors focus:border-[var(--focus-navy)] focus:shadow-[var(--focus-ring)] focus:outline-none disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-text"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <Card className="absolute start-0 end-0 top-full z-50 mt-1">
          <CardContent className="p-1">
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 ps-8 text-sm"
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {matches.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No results found.
                </p>
              ) : (
                matches.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => choose(option)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start text-sm transition-colors",
                      option.value === value
                        ? "bg-secondary text-secondary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.value === value && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
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
