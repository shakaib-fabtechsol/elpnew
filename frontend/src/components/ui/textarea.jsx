import * as React from "react";
import { cn } from "@/lib/utils";

// Forwards its ref, the way Input beside it does: a box that grows to fit
// what is typed has to be able to measure itself.
//
// One line high, the height of the input beside it, wherever it is used:
// a comment box no taller than the fields around it keeps a form's rows
// even. What is typed scrolls inside it, and the corner still drags it
// taller for whoever wants to read more at once. Its scrollbar is hidden:
// one line high, the browser's arrows would fill the box and read as broken,
// and the text still scrolls with the wheel, the keys or the drag handle.
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-field border border-field-border bg-field px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-[var(--focus-navy)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-text aria-invalid:border-[var(--error-border)] aria-invalid:focus-visible:shadow-[var(--error-ring)]",
        className,
        // Last, so no page's own height can undo it.
        "h-[42px] min-h-[42px] resize-y py-2.5 leading-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
      ref={ref}
      {...props}
      rows={1}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
