import { cn } from "@/lib/utils";

/**
 * The tabs of a section: one row of them, always.
 *
 * They say which side of the section is open, and a set broken across two
 * lines stops reading as one set - the tabs on the second line look like a
 * different kind of thing from the tabs on the first. So they never wrap.
 *
 * `fit` is for a set long enough that it would not otherwise fit the width it
 * is given. The tabs then share that width between them: each one still asks
 * for as much room as its own label needs, so while there is room to spare
 * nothing is shortened, and when there is not they give way together rather
 * than the last few dropping off the end. Sideways scrolling is what this
 * avoids - a tab you cannot see is a tab you will not find.
 *
 * A short set still sits in the corner of the section's heading. A long one
 * wants a line of its own, which is the caller's business and not the bar's.
 */
export default function TabBar({ options, value, onChange, fit, className }) {
  return (
    <div
      className={cn(
        "flex max-w-full flex-nowrap rounded-lg border p-1",
        fit ? "w-full gap-0.5" : "w-fit gap-1 overflow-x-auto",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          // The whole label on hover, for the narrow screen where the last
          // few characters of the longest one have had to give way.
          title={option.label}
          className={cn(
            "rounded-md font-medium transition-colors",
            fit
              ? // `flex-auto` grows each tab from the width of its own label
                // rather than from nothing, so they are not all forced to the
                // same size and the short ones do not steal room from the long.
                "min-w-0 flex-auto truncate px-2 py-1.5 text-xs"
              : "shrink-0 whitespace-nowrap px-3 py-1.5 text-sm",
            value === option.key
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-muted/50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
