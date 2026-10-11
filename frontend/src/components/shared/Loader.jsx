import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ClockLoader } from "react-spinners";
import { cn } from "@/lib/utils";

/**
 * The one loader in the system: a clock, wherever something is waited for.
 *
 * Three sizes of the same thing, so waiting always looks the same:
 *
 *   <Loader />        in a line of text or a button, beside the words
 *   <CardLoader />    over one card that is waiting on its own (an AI
 *                     reading, a table), the rest of the page still usable
 *   <LoadingCard />   in place of a card whose content has not arrived at
 *                     all yet: the same clock, in the middle of the space
 *                     the card will take
 *   <PageLoader />    over the whole screen, in its centre, the page behind
 *                     it blurred - for when the page itself is not ready
 *
 * A page is covered either by rendering <PageLoader /> or, from anywhere
 * (code that is not a component included), with pageLoader.show() and
 * pageLoader.hide(); <GlobalLoader /> is mounted once and draws it.
 */
/**
 * The theme's own primary colour, read from the stylesheet rather than
 * written here - so the clock is navy on the light theme, the lighter blue
 * the dark theme uses, and follows the theme if it is ever changed.
 */
export const LOADER_COLOR = "var(--primary)";

/**
 * The clock itself. `size` is its width in pixels.
 *
 * On its own - over a card or the page - it is the theme's primary colour.
 * Small, beside words or in a button, it takes the colour of the text it
 * sits in: white on a filled button, navy on an outlined one, so it can
 * always be seen against whatever it is on.
 */
export function Loader({ size = 18, color, className, label = "Loading" }) {
  color = color || (size >= 28 ? LOADER_COLOR : "currentColor");
  return (
    <span role="status" className={cn("inline-flex shrink-0 items-center justify-center", className)}>
      <ClockLoader color={color} size={size} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Over one card: its content blurred, the clock in its middle. The card (or
 * any wrapper of it) must be `relative`; the corners follow the card's own.
 */
export function CardLoader({ size = 40, label = "Loading", className }) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/60 backdrop-blur-sm dark:bg-black/40",
        className
      )}
    >
      <Loader size={size} label={label} />
    </div>
  );
}

/**
 * Where a card will be, before any of it has arrived: its outline, with the
 * clock in the middle. `compact` is for one that sits inside another card.
 */
export function LoadingCard({ size = 40, label = "Loading", compact, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-container-border bg-blue-50/40",
        compact ? "min-h-24" : "min-h-40",
        className
      )}
    >
      <Loader size={compact ? 28 : size} label={label} />
    </div>
  );
}

/**
 * Over the whole screen, whatever its size: fixed to the viewport, so the
 * clock sits in the middle of what is visible rather than of the page's
 * length, and everything behind it is blurred and cannot be clicked.
 */
export function PageLoader({ size = 64, label = "Loading" }) {
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/50 backdrop-blur-md">
      <Loader size={size} label={label} />
    </div>,
    document.body
  );
}

// How many things are holding the page loader up; it shows while any is.
let holding = 0;
const listeners = new Set();
const changed = () => listeners.forEach((listener) => listener());

export const pageLoader = {
  show() {
    holding += 1;
    changed();
  },
  hide() {
    holding = Math.max(0, holding - 1);
    changed();
  },
  /** Covers the page for as long as `work` takes, whether it ends well or not. */
  async during(work) {
    pageLoader.show();
    try {
      return await work();
    } finally {
      pageLoader.hide();
    }
  },
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Mounted once, at the root: draws the page loader while anything holds it. */
export function GlobalLoader() {
  const shown = useSyncExternalStore(subscribe, () => holding > 0);
  return shown ? <PageLoader /> : null;
}

export default Loader;
