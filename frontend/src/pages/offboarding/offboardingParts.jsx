import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** How each case status is marked: a soft pill with a dot. */
const STATUS_LOOK = {
  "Pending Approval": ["bg-amber-50 text-amber-700", "bg-amber-500"],
  "In Progress": ["bg-blue-50 text-blue-700", "bg-blue-600"],
  Completed: ["bg-emerald-50 text-emerald-700", "bg-emerald-600"],
  Rejected: ["bg-red-50 text-red-700", "bg-red-600"],
  Cancelled: ["bg-slate-100 text-slate-600", "bg-slate-400"],
};

export function OffboardingStatus({ status }) {
  const [pill, dot] = STATUS_LOOK[status] || STATUS_LOOK.Cancelled;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold",
        pill
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", dot)} />
      {status}
    </span>
  );
}

/**
 * The stages of an End of Service case, as a row of numbered steps - the
 * same look as Add Employee's tracker: a filled navy circle for the step
 * being worked on, a green tick for the ones behind, grey for the ones ahead,
 * and a red cross where the case stopped.
 *
 * `steps` is [{ key, label, note, state: "done" | "current" | "upcoming" | "failed" }].
 */
export function StageTracker({ steps }) {
  return (
    <ol className="flex w-full items-start overflow-x-auto pb-1">
      {steps.map((step, index) => (
        <li key={step.key} className="relative flex min-w-[96px] flex-1 flex-col items-center text-center">
          {/* The line to the next step, drawn from this circle's centre. */}
          {index < steps.length - 1 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute start-1/2 top-[15px] h-0.5 w-full",
                step.state === "done" ? "bg-emerald-500" : "bg-slate-200"
              )}
            />
          )}
          <span
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn(
              "relative z-[1] flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
              step.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
              step.state === "current" && "border-[#0b2447] bg-[#0b2447] text-white",
              step.state === "upcoming" && "border-slate-200 bg-white text-slate-500",
              step.state === "failed" && "border-red-500 bg-red-500 text-white"
            )}
          >
            {step.state === "done" ? (
              <Check className="size-4" strokeWidth={3} aria-hidden="true" />
            ) : step.state === "failed" ? (
              <X className="size-4" strokeWidth={3} aria-hidden="true" />
            ) : (
              index + 1
            )}
          </span>
          <span
            className={cn(
              "mt-2 px-1 text-xs leading-tight sm:text-[13px]",
              step.state === "current" ? "font-bold text-primary" : "font-medium text-primary/80"
            )}
          >
            {step.label}
          </span>
          {step.note && <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">{step.note}</span>}
        </li>
      ))}
    </ol>
  );
}
