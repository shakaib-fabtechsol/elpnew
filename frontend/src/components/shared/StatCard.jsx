import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bone } from "./TableStates";

/**
 * SADEED's Standard Card - the approved card design, and the only one.
 *
 * Every figure card in the system is this component: a tinted icon tile, the
 * title beside it, the figure under the title, and a tinted strip at the foot
 * holding either a short note ("+1 this month") or a breakdown of the figure
 * into tiles with thin dividers between them.
 *
 * Reference images may draw cards differently; they are not to be followed.
 * Spacing, borders, colours, type and behaviour live here, so they cannot
 * drift apart from page to page.
 */

/** The colour families a card can wear: icon tile, foot strip, note text. */
const TONES = {
  blue: { tile: "bg-blue-50 text-blue-600", strip: "bg-blue-50/70", ink: "text-blue-700", dot: "bg-blue-600" },
  green: { tile: "bg-emerald-50 text-emerald-600", strip: "bg-emerald-50/70", ink: "text-emerald-700", dot: "bg-emerald-600" },
  purple: { tile: "bg-violet-50 text-violet-600", strip: "bg-violet-50/70", ink: "text-violet-700", dot: "bg-violet-600" },
  orange: { tile: "bg-orange-50 text-orange-600", strip: "bg-orange-50/70", ink: "text-orange-700", dot: "bg-orange-500" },
  amber: { tile: "bg-amber-50 text-amber-600", strip: "bg-amber-50/70", ink: "text-amber-700", dot: "bg-amber-500" },
  red: { tile: "bg-red-50 text-red-600", strip: "bg-red-50/70", ink: "text-red-700", dot: "bg-red-600" },
  slate: { tile: "bg-slate-100 text-slate-600", strip: "bg-slate-50", ink: "text-slate-700", dot: "bg-slate-400" },
};

const toneOf =(tone) => TONES[tone] || TONES.slate;

/** The dot a breakdown tile can carry before its figure. */
const DOT = { green: "bg-emerald-600", slate: "bg-slate-400", orange: "bg-orange-500", red: "bg-red-600", blue: "bg-blue-600" };

/** Ink for a breakdown tile whose figure is a warning, a fault or good news. */
const TILE_INK = {
  orange: "text-orange-600",
  amber: "text-amber-600",
  red: "text-red-600",
  green: "text-emerald-700",
  blue: "text-blue-700",
};

/**
 * One card.
 *
 *   icon     a lucide icon (or `mark`, any node, for a logo)
 *   tone     blue | green | purple | orange | amber | red | slate
 *   label    what the figure counts
 *   value    the figure
 *   note     { text, icon: "trend" | "dot", tone } - the foot strip's message
 *   tiles    [{ label, value, tone, onClick, active }] - the foot strip's breakdown
 *   onClick  pressing the card (a filter, usually); `active` marks it chosen
 *   status   the state of the data the figure is counted from (useDataset's
 *            status): "loading" draws placeholders where the figures go,
 *            "failed" a dash - never a 0 that is not true
 */
export function StatCard({
  icon: Icon,
  mark,
  tone = "slate",
  label,
  value,
  note,
  tiles,
  onClick,
  active,
  status,
  className,
}) {
  const colours = toneOf(tone);
  const loading = status === "loading";
  const failed = status === "failed";
  const Head = onClick ? "button" : "div";
  const noteColours = toneOf(note?.tone || tone);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-3 rounded-xl border border-container-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow",
        onClick && "hover:shadow-md",
        active && "ring-2 ring-primary/40",
        className
      )}
    >
      <Head
        {...(onClick
          ? { type: "button", onClick, "aria-pressed": Boolean(active) }
          : {})}
        className={cn(
          "grid items-center gap-x-3 rounded-lg text-start",
          Icon || mark ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1",
          onClick && "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {(Icon || mark) && (
          <span
            className={cn(
              "row-span-2 flex size-12 shrink-0 items-center justify-center rounded-xl",
              colours.tile
            )}
          >
            {mark || <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />}
          </span>
        )}
        <span className="min-w-0 truncate text-[15px] font-semibold text-primary">
          {label}
        </span>
        {loading ? (
          <Bone className="mt-1 h-[30px] w-14" />
        ) : (
          <span className="numeric-value mt-1 block truncate text-3xl font-bold leading-none text-primary">
            {failed ? "\u2013" : typeof value === "number" ? value.toLocaleString("en-US") : value}
          </span>
        )}
      </Head>

      {/* The foot strip is counted from the same data: a placeholder while it
          loads, and left out when it could not be loaded. */}
      {loading && (note || tiles) && <Bone className="mt-auto h-9 w-full rounded-lg" />}

      {note && !loading && !failed && (
        <p
          className={cn(
            "mt-auto flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            noteColours.strip,
            noteColours.ink
          )}
        >
          {note.icon === "trend" && <TrendingUp className="size-4 shrink-0" aria-hidden="true" />}
          {note.icon === "dot" && (
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", noteColours.dot)} />
          )}
          <span className="truncate">{note.text}</span>
        </p>
      )}

      {tiles && tiles.length > 0 && !loading && !failed && (
        <div
          className={cn(
            "mt-auto grid divide-x divide-container-border rounded-lg py-1.5 rtl:divide-x-reverse",
            colours.strip
          )}
          style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
        >
          {tiles.map((tile) => {
            const Tile = tile.onClick ? "button" : "div";
            return (
              <Tile
                key={tile.label}
                {...(tile.onClick
                  ? { type: "button", onClick: tile.onClick, "aria-pressed": Boolean(tile.active) }
                  : {})}
                className={cn(
                  "min-w-0 px-0.5 text-center",
                  tile.onClick &&
                    "rounded-md transition-colors hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tile.active && "bg-white ring-1 ring-primary/30"
                )}
              >
                <span
                  className={cn(
                    "numeric-value flex items-center justify-center gap-1.5 text-base font-bold leading-tight",
                    TILE_INK[tile.tone] || "text-primary"
                  )}
                >
                  {/* A coloured dot before the figure, where the design keys a
                      breakdown by colour (Omani green, Non-Omani grey). */}
                  {tile.dot && (
                    <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", DOT[tile.dot] || DOT.slate)} />
                  )}
                  {tile.value}
                </span>
                <span
                  className={cn(
                    // Whole words, never cut off: tighter type rather than "Appell...".
                    "block whitespace-nowrap text-[10px] leading-tight tracking-tight",
                    TILE_INK[tile.tone] || "text-muted-foreground"
                  )}
                >
                  {tile.label}
                </span>
              </Tile>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** How many columns a row of cards takes, by how many cards it holds. */
const COLUMNS = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

/** A row of Standard Cards, equal widths, wrapping as the screen narrows. */
export function StatCards({ count, className, children }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        COLUMNS[Math.min(count || 4, 6)] || COLUMNS[4],
        count > 6 && "xl:grid-cols-4 2xl:grid-cols-8",
        className
      )}
    >
      {children}
    </div>
  );
}
