import { cn } from "@/lib/utils";
import { CURRENCY } from "@/lib/money";

/**
 * The currency mark, written the way the active locale writes it.
 *
 * In English that is the ISO code - OMR - which every font carries and every
 * reader recognises; the Arabic side of the system writes the same amount as
 * ر.ع. The mark is a component rather than a literal so the two never have to
 * be spelled out side by side at each amount: one place decides, and the whole
 * application follows.
 *
 * It takes the colour and size of the text it sits in, because amounts are
 * printed in red, green and grey around the application and a mark that keeps
 * its own colour beside them reads as a mistake.
 */
export function Rial({ className }) {
  return (
    <span className={cn("whitespace-nowrap", className)}>{CURRENCY}</span>
  );
}
