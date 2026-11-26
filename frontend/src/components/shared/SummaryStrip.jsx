import { StatCard, StatCards } from "./StatCard";

/**
 * The figures above a table, drawn as SADEED's Standard Cards (StatCard).
 *
 * Kept as its own component so the pages that already describe their figures
 * as `items` need no change: each item becomes one card.
 *
 *   label     what the figure is; `count` is added to it in brackets
 *   value     the figure
 *   note      a line under it, shown in the card's foot strip
 *   tone      a text colour class ("text-red-700") - the card takes the
 *             matching colour family
 *   mark      a logo or icon node; `icon` a lucide icon
 *   trailing  a figure that belongs to the name, shown after it
 *   onClick   makes the card the filter for the table below it; `selected`
 *             marks the chosen one
 *
 * `status` is the state of the data the figures are counted from (useDataset):
 * placeholders while it loads, a dash if it failed.
 */

/** The card colour that matches a text colour class. */
function toneFromClass(tone = "") {
  if (/red|rose/.test(tone)) return "red";
  if (/emerald|green/.test(tone)) return "green";
  if (/amber|yellow/.test(tone)) return "amber";
  if (/orange/.test(tone)) return "orange";
  if (/violet|purple/.test(tone)) return "purple";
  if (/blue|sky/.test(tone)) return "blue";
  return "slate";
}

export default function SummaryStrip({ items, className, status }) {
  return (
    <StatCards count={items.length} className={className}>
      {items.map((item) => {
        const label =
          String(item.label) +
          (item.count !== undefined ? " (" + item.count + ")" : "") +
          (item.trailing !== undefined ? " · " + item.trailing : "");
        const tone = item.cardTone || toneFromClass(item.tone);

        return (
          <StatCard
            key={item.key ?? item.label}
            icon={item.icon}
            mark={item.mark}
            tone={tone}
            label={label}
            value={item.value}
            note={item.note ? { text: item.note, tone } : undefined}
            tiles={item.tiles}
            onClick={item.onClick}
            active={item.selected}
            status={status}
          />
        );
      })}
    </StatCards>
  );
}
