import { useState } from "react";
import { Filter } from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import FilterPanel from "@/components/shared/FilterPanel";
import { filterChips, withoutChip } from "@/lib/filterChips";

/**
 * A list of requests in the system's one table: search, Filters, rows per
 * page and the Excel download on the left, the way to add one on the right,
 * and the rows under them.
 *
 * Every list of requests on an employee's file draws through here, so they
 * all search, narrow, page and export alike. The page says what the columns
 * are and, with `filterBy`, which of a row's fields it can be narrowed by -
 * each offered with the values the rows actually hold.
 */
export default function RequestTable({
  rows,
  columns,
  // Still passed by the pages, but every list now reads "Smart Search".
  // eslint-disable-next-line no-unused-vars
  searchPlaceholder,
  itemLabel = "requests",
  exportFileName = "requests.csv",
  // [{ key, label }]: the fields the Filters panel offers, by row field.
  filterBy = [{ key: "status", label: "Status" }],
  onAdd,
  addLabel,
  // Further ways to add, as [{ label, onClick }], beside the main one.
  moreAdds = [],
  endedRow,
}) {
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Each filter offers what is there to choose: the values on the rows. The
  // Filters button is there on every list, as on every table in the system.
  const fields = filterBy.map((field) => {
    const values = [...new Set(rows.map((row) => row[field.key]).filter(Boolean))];
    return {
      key: field.key,
      label: field.label,
      icon: Filter,
      type: "radio",
      options: [
        { value: "all", label: "All" },
        ...values.map((value) => ({ value, label: String(value) })),
      ],
    };
  });

  const narrow = (next) => {
    setFilters(next);
    setPage(1);
  };

  const shown = rows.filter((row) =>
    Object.entries(filters).every(
      ([key, value]) => !value || value === "all" || String(row[key]) === String(value)
    )
  );

  return (
    <DataTable
      columns={columns}
      data={shown}
      itemLabel={itemLabel}
      // Every list of requests searches the same way and says so the same
      // way: one smart search across the row, as the Requests page draws it.
      searchPlaceholder="Smart Search"
      exportFileName={exportFileName}
      enableColumnSearch={false}
      keepOrder
      currentPage={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
      filters={<FilterPanel fields={fields} value={filters} onChange={narrow} />}
      appliedFilters={filterChips(fields, filters)}
      onRemoveFilter={(chip) => narrow(withoutChip(filters, chip))}
      onClearFilters={() => narrow({})}
      onAdd={onAdd || undefined}
      addLabel={addLabel}
      moreAdds={moreAdds}
      // Narrower than a page's own list, so the Add buttons keep one row.
      searchClassName="sm:w-72 lg:w-88"
      endedRow={endedRow}
    />
  );
}
