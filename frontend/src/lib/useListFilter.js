import { useSearchParams } from "react-router-dom";

/**
 * Filters a list from the URL query string.
 *
 * Dashboard tiles link with a query - `/litigation?status=Closed` - so the
 * destination opens already narrowed to what was clicked. Keeping the filter in
 * the URL means the view is shareable, survives a refresh, and the browser back
 * button returns to the unfiltered list.
 *
 * `config` maps a query parameter to how it reads and how it matches:
 *
 *   { status: { label: "Status", match: (row, value) => row.status === value } }
 */
export function useListFilter(config) {
  const [params, setParams] = useSearchParams();

  const active = Object.entries(config)
    .map(([key, spec]) => ({
      key,
      value: params.get(key),
      label: spec.label,
      display: spec.display,
    }))
    .filter((filter) => filter.value !== null && filter.value !== "");

  const apply = (rows) =>
    active.reduce(
      (remaining, filter) =>
        remaining.filter((row) => config[filter.key].match(row, filter.value)),
      rows
    );

  const clear = (key) => {
    const next = new URLSearchParams(params);
    if (key) next.delete(key);
    else active.forEach((filter) => next.delete(filter.key));
    setParams(next, { replace: true });
  };

  return { active, apply, clear, isFiltered: active.length > 0 };
}
