import { useState } from "react";

/**
 * A single-series bar chart over time.
 *
 * One series means the heading names it and no legend is needed; the value is
 * read off hover, with the peak labelled by default so the chart is not silent
 * when nothing is hovered. Bars use the theme's primary colour so the chart
 * follows the brand in both light and dark mode.
 *
 * `rows` is [{ label, value }]. `unit` names the thing being counted.
 */
export default function BarTrendChart({ rows, unit = "case", height = "h-52" }) {
  const [hovered, setHovered] = useState(null);

  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No data in the selected period.
      </p>
    );
  }

  const peak = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div>
      <div className={"relative flex items-end gap-[2px] " + height}>
        {rows.map((row) => {
          const isPeak = row.value === peak;
          const isHovered = hovered === row.label;
          return (
            <div
              key={row.label}
              className="group relative flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHovered(row.label)}
              onMouseLeave={() => setHovered(null)}
            >
              {(isHovered || (isPeak && hovered === null)) && (
                <span className="absolute -top-1 z-10 whitespace-nowrap rounded border bg-background px-2 py-1 text-xs font-medium shadow-sm">
                  {row.value} {row.value === 1 ? unit : unit + "s"}
                </span>
              )}
              <div
                className="w-full rounded-t bg-primary transition-opacity"
                style={{
                  height:
                    Math.max((row.value / peak) * 100, row.value ? 3 : 0) + "%",
                  opacity: hovered === null || isHovered ? 1 : 0.45,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Axis - recessive, and thinned out so labels never collide */}
      <div className="mt-2 flex gap-[2px] border-t pt-2">
        {rows.map((row, i) => (
          <div key={row.label} className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground">
              {rows.length <= 8 || i % 2 === 0 ? row.label : ""}
            </span>
          </div>
        ))}
      </div>

      {/* Same numbers in text, for screen readers and for copying out */}
      <table className="sr-only">
        <thead>
          <tr>
            <th>Period</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
