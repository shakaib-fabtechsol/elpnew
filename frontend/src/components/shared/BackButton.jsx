import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGoBack } from "@/lib/useGoBack";

/**
 * The way out of a page that was opened on top of another one.
 *
 * Every Add, Insert and detail page carries one, in the same place and with the
 * same behaviour, so leaving a page is never something that has to be worked
 * out afresh. See `useGoBack` for what "back" means.
 */
export default function BackButton({
  fallback = "/dashboard",
  onBack,
  label,
  className,
}) {
  const goBackInHistory = useGoBack(fallback);
  // A form that opened in place has no history entry of its own, so it says
  // what going back means; everything else steps back through the browser.
  const goBack = onBack || goBackInHistory;

  if (label) {
    return (
      <Button variant="outline" onClick={goBack} className={className}>
        <ArrowLeft className="me-2 h-4 w-4" />
        {label}
      </Button>
    );
  }

  // The arrow alone. The word is still carried in the tooltip and read out to
  // screen readers, so nothing is lost for anyone who needs it spelled out.
  return (
    <Button
      variant="ghost"
      size="icon"
      title="Back"
      onClick={goBack}
      className={cn(
        "rounded-full bg-secondary text-primary hover:bg-accent",
        className
      )}
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="sr-only">Back</span>
    </Button>
  );
}
