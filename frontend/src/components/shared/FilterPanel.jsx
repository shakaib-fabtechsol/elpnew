import { useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { filterChips, withoutChip } from "@/lib/filterChips";
import { cn } from "@/lib/utils";

/**
 * The filters that narrow a list, gathered into one panel.
 *
 * Nothing chosen in here touches the list until Apply is pressed, and closing
 * the panel any other way throws the pending choices away. A filter that took
 * effect the moment it was clicked would re-sort the list under the hand of
 * somebody still deciding, and a list that moves while it is being set up is
 * a list nobody trusts.
 *
 * The chips along the top are the committed filters, not the pending ones -
 * they say what the list behind the panel is actually showing. Removing one
 * takes effect at once, because a chip is a thing already in force.
 *
 * Search and sorting are not filters and are not touched by Clear.
 */

/** One choice in a group, drawn as a radio rather than merely named one. */
function Choice({ name, value, checked, onSelect, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-primary">
      <span className="relative flex size-4 shrink-0 items-center justify-center">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onSelect(value)}
          className="peer absolute inset-0 cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className={cn(
            "size-4 rounded-full border transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
            checked ? "border-[5px] border-primary" : "border-field-border"
          )}
        />
      </span>
      {children}
    </label>
  );
}

/** One of a group where any number may be chosen, including none. */
function Tick({ id, checked, onToggle, children }) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-primary"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      {children}
    </label>
  );
}


export default function FilterPanel({
  fields = [],
  value = {},
  onChange,
  label = "Filters",
  title = "Filters",
  className,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const set = (key, next) => setDraft((prev) => ({ ...prev, [key]: next }));

  const toggle = (key, option) =>
    setDraft((prev) => {
      const held = prev[key] || [];
      return {
        ...prev,
        [key]: held.includes(option)
          ? held.filter((one) => one !== option)
          : [...held, option],
      };
    });

  /** The committed filters, said in the words their own group used. */
  const chips = filterChips(fields, value);

  /** Dropping a tag drops that one choice, at once, from what is in force. */
  const drop = (chip) => {
    const next = withoutChip(value, chip);
    onChange?.(next);
    setDraft(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Opening shows what is in force; closing without Apply leaves it so.
        if (next) setDraft(value);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="cancel"
          className={cn("group h-[42px] gap-2", chips.length > 0 && "border-primary", className)}
        >
          <SlidersHorizontal strokeWidth={1.5} />
          {label}
          {chips.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
              {chips.length}
            </span>
          )}
          <ChevronDown
            strokeWidth={1.5}
            aria-hidden="true"
            className="size-3 transition-transform duration-[160ms] ease-out group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] w-[min(1080px,95vw)] max-w-none overflow-y-auto p-0">
        <DialogHeader className="border-b border-container-border px-6 py-4 text-start">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-primary">
            {title}
            {chips.length > 0 && (
              <span className="rounded-full border border-primary px-2 text-sm font-semibold text-primary">
                {chips.length}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* What the list is showing now - committed, not pending. */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-container-border px-6 py-3">
            <span className="text-sm text-primary/70">Applied filters:</span>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => drop(chip)}
                className="inline-flex items-center gap-1.5 rounded-[6px] border border-primary bg-card px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {chip.label}: {chip.value}
                <X className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only">Remove this filter</span>
              </button>
            ))}
            {/* Not underlined: nothing clickable in this system is. */}
            <button
              type="button"
              onClick={() => {
                onChange?.({});
                setDraft({});
              }}
              className="rounded-[6px] px-1.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Ruled into cells rather than merely spaced apart: nine groups set
            loose on one sheet read as one long list of choices, and a person
            loses which heading the radio under their cursor belongs to.

            The grid is pulled a pixel past its own frame and the frame clips
            it, so the rules between cells are drawn but the ones around the
            outside are not - no counting of rows or columns, and it holds at
            every width. */}
        <div className="overflow-hidden">
          <div className="-mb-px -me-px grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => {
              const Icon = field.icon;
              return (
                <div
                  key={field.key}
                  className="flex gap-3 border-b border-e border-container-border px-6 py-5"
                >
                {Icon && (
                  <Icon
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-primary"
                  />
                )}
                <div className="min-w-0 flex-1">
                  {/* Who may use this group, said above its name where it is
                      not open to everybody. */}
                  {field.note && (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {field.note}
                    </p>
                  )}
                  <p className="mb-1.5 font-semibold text-primary">{field.label}</p>

                  {field.placeholder ? (
                    <p className="text-sm text-muted-foreground">{field.placeholder}</p>
                  ) : (
                    // Along the line and wrapping, not stacked: three short
                    // words set one under the other make a column of nine
                    // lines out of a group that reads in one.
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                      {field.type === "checkbox"
                        ? field.options.map((option) => (
                            <Tick
                              key={option.value}
                              id={field.key + "-" + option.value}
                              checked={(draft[field.key] || []).includes(option.value)}
                              onToggle={() => toggle(field.key, option.value)}
                            >
                              {option.label}
                            </Tick>
                          ))
                        : field.options.map((option) => (
                            <Choice
                              key={option.value}
                              name={field.key}
                              value={option.value}
                              checked={(draft[field.key] || "all") === option.value}
                              onSelect={(next) => set(field.key, next)}
                            >
                              {option.label}
                            </Choice>
                          ))}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-container-border px-6 py-4">
          <Button type="button" variant="cancel" onClick={() => setDraft({})}>
            Clear
          </Button>
          <Button
            type="button"
            onClick={() => {
              onChange?.(draft);
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
