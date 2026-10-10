import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bordered } from "@/components/shared/panels";

/**
 * The two stages a financial request goes through, as one bar of headers.
 *
 * The employee writes the request; management decides it. Each header opens
 * its own stage below it, for whoever is looking - the employee to see what
 * was decided, the office to decide it. The open stage is filled in; a stage
 * that is done carries a tick instead of its number.
 *
 * `steps` is [{ key, title, note, done, disabled }]. A disabled stage cannot
 * be opened yet - there is nothing in it until an earlier stage is saved.
 */
export function RequestSteps({ steps, active, onChange, compact = false }) {
  // Many stages to a row leave no room for a numbered circle beside each
  // title, so the number goes in front of the title instead.
  if (compact) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
        {steps.map((step, index) => {
          const open = step.key === active;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onChange(step.key)}
              disabled={step.disabled}
              aria-current={open ? "step" : undefined}
              className={cn(
                "rounded-md px-3 py-2.5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                open
                  ? "bg-primary text-primary-foreground"
                  : "border border-primary/15 bg-secondary text-primary hover:bg-secondary/70",
                step.disabled && "cursor-not-allowed opacity-60 hover:bg-secondary"
              )}
            >
              <span className="flex items-center justify-center gap-1.5 font-semibold">
                {step.done && !open && (
                  <Check className="h-4 w-4 shrink-0 text-green-600" aria-label="Done" />
                )}
                {index + 1}. {step.title}
              </span>
              <span
                className={cn(
                  "block text-xs",
                  open ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                {step.note}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-0">
      {steps.map((step, index) => {
        const open = step.key === active;
        const first = index === 0;
        const last = index === steps.length - 1;

        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onChange(step.key)}
            disabled={step.disabled}
            aria-current={open ? "step" : undefined}
            // Side by side, each header points into the next: every one but
            // the last ends in an arrow, and every one but the first takes the
            // notch that arrow sits in. Stacked on a phone they are plain bars.
            className={cn(
              "flex flex-1 items-center gap-4 rounded-md px-5 py-3 text-start transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !last && "sm:pe-10",
              !first && "sm:-ms-3.5 sm:ps-10",
              first && !last && "sm:[clip-path:polygon(0_0,calc(100%_-_20px)_0,100%_50%,calc(100%_-_20px)_100%,0_100%)]",
              !first && !last && "sm:[clip-path:polygon(0_0,calc(100%_-_20px)_0,100%_50%,calc(100%_-_20px)_100%,0_100%,20px_50%)]",
              last && !first && "sm:[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,20px_50%)]",
              open
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-primary hover:bg-secondary/70",
              step.disabled && "cursor-not-allowed opacity-60 hover:bg-secondary"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                step.done && !open
                  ? "bg-green-600 text-white"
                  : open
                    ? "border-2 border-primary-foreground"
                    : "border-2 border-primary/40"
              )}
            >
              {step.done && !open ? <Check className="h-5 w-5" /> : index + 1}
            </span>

            <span
              aria-hidden="true"
              className={cn(
                "h-8 w-px shrink-0",
                open ? "bg-primary-foreground/40" : "bg-primary/20"
              )}
            />

            <span className="min-w-0">
              <span className="block font-semibold">{step.title}</span>
              <span
                className={cn(
                  "block text-xs",
                  open ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                {step.note}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * What management can decide about a request.
 *
 * Each answer wears its own colour whether or not it is the one chosen, so
 * approving and declining are never a click apart in identical cards. Which
 * one was chosen is said by the mark on the left, the way a radio says it.
 */
const DECISIONS = [
  {
    key: "full",
    title: "Full Approval",
    tone: "border-green-600 bg-decision-full",
    mark: "border-green-600 text-green-600",
  },
  {
    key: "partial",
    title: "Partial Approval",
    tone: "border-decision-partial-ink bg-decision-partial text-decision-partial-ink",
    mark: "border-decision-partial-ink text-decision-partial-ink",
  },
  {
    /**
     * Not an answer to the request so much as a question back: something is
     * missing, and the request is handed back to be sent again. Nothing is
     * granted and nothing is refused, so like a refusal it pays nothing - but
     * unlike one it leaves the request alive.
     */
    key: "completion",
    title: "Resubmit Request",
    tone: "border-frame-alt bg-decision-partial/40 text-frame-alt",
    mark: "border-frame-alt text-frame-alt",
  },
  {
    key: "rejected",
    title: "Reject Request",
    tone: "border-red-600 bg-decision-rejected",
    mark: "border-red-600 text-red-600",
  },
];

/**
 * Management's answer to a request, as cards to choose between.
 *
 * Only the office decides: where `disabled` is set the cards show the decision
 * and cannot change it.
 */
export function DecisionChoice({
  value,
  onChange,
  disabled,
  // No heading by default: four answers in a row say plainly enough what is
  // being asked, and a title over them only repeats the step above them.
  title = "",
  // What each card says under its name, where the answer needs saying in
  // the request's own words: a loan is granted on terms, not only on an
  // amount. A request that needs none leaves the cards as plain names.
  notes = {},
  /**
   * Which answers this kind of request can be given.
   *
   * All four by default - granted, granted in part, handed back to be sent
   * again, refused. A screen that has nothing to hand back names the three
   * it wants instead.
   */
  offers = ["full", "partial", "completion", "rejected"],
  // Whatever belongs to the decision itself - its date, what it grants -
  // where a form draws that inside the same box as the choice.
  children,
}) {
  const shown = DECISIONS.filter((option) => offers.includes(option.key));
  return (
    <Bordered title={title}>
      <div
        role="radiogroup"
        aria-label={title || "Management decision"}
        className={cn(
          "grid grid-cols-1 gap-3",
          shown.length > 3 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"
        )}
      >
        {shown.map((decision) => {
          const chosen = value === decision.key;
          return (
            <button
              key={decision.key}
              type="button"
              role="radio"
              aria-checked={chosen}
              disabled={disabled}
              onClick={() => onChange(decision.key)}
              className={cn(
                "flex items-center gap-4 rounded-md border-2 px-5 py-3 text-start transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                decision.tone,
                chosen && decision.chosen,
                !chosen && !disabled && "hover:brightness-95",
                disabled && !chosen && "opacity-70"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                  decision.mark,
                  chosen && "bg-current"
                )}
              >
                {chosen && <Check className="h-3.5 w-3.5 text-white" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-primary">
                  {decision.title}
                </span>
                {notes[decision.key] && (
                  <span className="block text-xs text-muted-foreground">
                    {notes[decision.key]}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {children}
    </Bordered>
  );
}
