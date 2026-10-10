import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The one search box in the system.
 *
 * Every list is searched the same way and in the same place - the left of the
 * row above the table - so finding something is never a matter of working out
 * how this particular page does it. The mark is a spark rather than a
 * magnifying glass because the query is read for meaning, not matched
 * literally: see `smartSearch`.
 */
export default function AiSearch({
  value,
  onChange,
  placeholder = "Ask anything...",
  className,
}) {
  return (
    <div className={cn("relative w-full sm:w-80 lg:w-96", className)}>
      <Sparkles className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ps-9"
      />
    </div>
  );
}
