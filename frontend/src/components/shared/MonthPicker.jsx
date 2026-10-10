import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A month of a year, picked off a grid of twelve.
 *
 * `months` is the list the form already keeps ({ value, label }), so what is
 * stored stays what it was; only the way of choosing it changes. The trigger
 * wears the combobox role and, while empty, data-placeholder - the marks the
 * required-field check reads off a select - so an empty period is flagged the
 * same way an empty select is.
 *
 * The grid is drawn in place rather than in a portal, so inside a dialog it
 * stays within the dialog's focus and is not closed the moment it opens.
 */
export default function MonthPicker({
  id,
  month,
  year,
  months,
  onChange,
  placeholder = "Select month",
  disabled,
}) {
  const [open, setOpen] = useState(false);
  // The year the grid is showing, which is not yet the one picked.
  const [shown, setShown] = useState(Number(year) || new Date().getFullYear());
  const label = months.find((item) => item.value === month)?.label;

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setShown(Number(year) || new Date().getFullYear());
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          data-placeholder={label ? undefined : ""}
          className="flex h-[42px] w-full items-center gap-2 rounded-field border border-field-border bg-field px-3 text-start text-sm transition-colors focus-visible:border-[var(--focus-navy)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none data-[state=open]:border-[var(--focus-navy)] disabled:cursor-not-allowed disabled:bg-disabled"
        >
          <span className={cn("min-w-0 flex-1 truncate", !label && "text-muted-foreground")}>
            {label ? label + " " + year : placeholder}
          </span>
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <ChevronDown className="size-4 shrink-0 text-primary" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-72 rounded-lg border bg-card p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShown((value) => value - 1)}
              className="rounded-md p-1 text-primary hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
              <span className="sr-only">Previous year</span>
            </button>
            <span className="text-base font-bold text-primary">{shown}</span>
            <button
              type="button"
              onClick={() => setShown((value) => value + 1)}
              className="rounded-md p-1 text-primary hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
              <span className="sr-only">Next year</span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {months.map((item) => {
              const picked = item.value === month && String(shown) === String(year);
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => {
                    onChange({ month: item.value, year: String(shown) });
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-md border px-2 py-2 text-sm text-primary transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    picked && "border-blue-100 bg-blue-100 font-semibold"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}
