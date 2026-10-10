import { useEffect, useRef, useState } from "react";
import ExcelIcon from "./ExcelIcon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import AiSearch from "./AiSearch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronRight,  Loader2,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import { smartSearch } from "@/lib/search/smartSearch";

/**
 * Which way a column is sorted.
 *
 * An unsorted column still shows a faint pair of arrows, so a sortable
 * heading looks sortable before anybody clicks it.
 */
function SortMark({ direction }) {
  if (!direction) {
    // Standard 06: an idle arrow on every heading is a row of arrows, and a
    // row of arrows reads as decoration. It appears when the heading is
    // pointed at or focused, which is when it means something.
    return (
      <ChevronsUpDown className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/sort:opacity-40 group-focus-visible/sort:opacity-40" />
    );
  }
  const Icon = direction === "asc" ? ChevronUp : ChevronDown;
  return <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />;
}

/**
 * A column's heading: the title and nothing else.
 *
 * What a column is made of is plain from the cells under it, so the bracketed
 * explanation that used to follow the title only lengthened the header row.
 * Columns may still carry a `subHeader` - it is simply not shown.
 */
function ColumnHeading({ header }) {
  return header;
}

/**
 * The fixed app header - 72px and its 1px rule - that a frozen toolbar holds
 * under. The column headings hold under the toolbar, whose height is measured
 * rather than counted, because it wraps and grows a row of filter chips.
 */
const APP_HEADER = 73;

export default function DataTable({
  columns,
  data,
  searchPlaceholder = "Search...",
  onSearch,
  onPageChange,
  onPageSizeChange,
  currentPage = 1,
  pageSize = 100,
  isLoading = false,
  showExport = true,
  itemLabel,
  exportFileName = "export.csv",
  onAdd,
  addLabel = "Add",
  // Further ways to add, as [{ label, onClick }], before the main one.
  moreAdds = [],
  // The search box's width, where a list needs room for more on its row.
  searchClassName,
  /**
   * Standard 08: a short Add or Edit form, opened inside this container
   * rather than in a card above it or a window over it.
   *
   * `addPanel` is what the form draws, `addPanelTitle` names the action and
   * `addPanelNote` carries whatever context the person needs while filling
   * it in. While it is open the Add button is hidden, so the same form
   * cannot be opened twice, and the table stays where it was - same search,
   * same filters, same page, same scroll.
   *
   * For short forms only. Anything longer than two rows belongs on a page of
   * its own with a way back.
   */
  addPanel,
  addPanelTitle,
  addPanelNote,
  onAddPanelClose,
  filters,
  /**
   * What the list is narrowed by, as [{ key, label, value }] - and the two
   * ways out of it. Supplied by the page rather than worked out here, because
   * only the page knows what its own filters mean.
   */
  appliedFilters = [],
  onRemoveFilter,
  onClearFilters,
  onRowClick,
  enableColumnSearch = true,
  enableSorting = false,
  // Says whether a row's record has ended - cancelled, inactive, expired.
  // Those are kept, but they belong under the live ones.
  endedRow,
  // The data already arrives in the order it should be read in (a schedule,
  // or a list sorted by its own date), so the table leaves it alone.
  keepOrder = false,
  /**
   * Excel's Freeze Panes, on every list. As the page scrolls, the toolbar
   * holds under the app header and the column headings under the toolbar, so
   * search, filters, export and the headings stay in sight whichever record
   * is being read - with one scrollbar, the page's own. Turned off only for a
   * table that sits inside a box of its own that scrolls.
   */
  freezeHeader = true,
}) {
  const [searchValue, setSearchValue] = useState("");
  const toolbarRef = useRef(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  // The styled scroll area scrolls both ways, which would hold a frozen
  // heading inside it instead of against the page.
  const Scroller = freezeHeader ? "div" : ScrollArea;

  // The toolbar's height changes as it wraps on a narrow screen and as filter
  // chips come and go, and the table's box has to shrink or grow with it.
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!freezeHeader || !toolbar) return;
    const observer = new ResizeObserver(() => setToolbarHeight(toolbar.offsetHeight));
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [freezeHeader]);
  const [columnFilters, setColumnFilters] = useState({});
  // Column key and direction, or null while the table is in its natural order.
  const [sort, setSort] = useState(null);

  // Off, then ascending, then descending, then back to the order the data came
  // in - so a sort can always be taken back off.
  const toggleSort = (columnKey) =>
    setSort((prev) => {
      if (prev?.key !== columnKey) return { key: columnKey, direction: "asc" };
      return prev.direction === "asc"
        ? { key: columnKey, direction: "desc" }
        : null;
    });

  const handleSearch = (value) => {
    setSearchValue(value);
    if (onSearch) {
      onSearch(value);
    }
    // Standard 06: a narrowed list is read from its first page. Staying on
    // page four of a list that now holds two is an empty table with no
    // reason given for it.
    if (onPageChange && currentPage !== 1) onPageChange(1);
  };

  const handleColumnFilterChange = (columnKey, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  };

  // Contextual search over every value on the row. Skipped when the parent
  // handles searching itself via onSearch.
  const searchedData = onSearch ? data : smartSearch(data, searchValue);

  // Filter data based on column filters
  const filteredData = enableColumnSearch ? searchedData.filter(row => {
    return Object.entries(columnFilters).every(([columnKey, filterValue]) => {
      if (!filterValue) return true;
      const cellValue = row[columnKey];
      if (cellValue === null || cellValue === undefined) return false;
      return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
    });
  }) : searchedData;

  /**
   * What a column sorts on.
   *
   * A rendered cell can hold anything, so the column says what its value is:
   * its own sortValue where it needs one, the export value where that already
   * flattens the row, and the raw field otherwise.
   */
  const sortValueOf = (column, row) => {
    if (column.sortValue) return column.sortValue(row);
    if (column.exportValue) return column.exportValue(row);
    return row[column.key];
  };

  /**
   * Newest first, until somebody sorts a column.
   *
   * Every record is numbered as it is created, so the highest id is the most
   * recent - and the most recent is what a list is opened to find. Rows
   * without a numeric id keep the order they came in.
   */
  const newestFirst =
    keepOrder || !filteredData.every((row) => typeof row.id === "number")
      ? filteredData
      : [...filteredData].sort((a, b) => b.id - a.id);

  const sortedData = (() => {
    if (!sort) return newestFirst;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return filteredData;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filteredData].sort((a, b) => {
      const left = sortValueOf(column, a);
      const right = sortValueOf(column, b);
      if (left === right) return 0;
      // Blanks sort last whichever way the column is pointing.
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * direction;
      }
      return (
        String(left).localeCompare(String(right), undefined, { numeric: true }) *
        direction
      );
    });
  })();

  /**
   * The rows that have ended, under the rows that have not.
   *
   * Whatever order the table is in otherwise is kept inside each of the two
   * groups, so sorting a column still sorts - it simply sorts the live records
   * and the finished ones separately.
   */
  const orderedData = endedRow
    ? [
        ...sortedData.filter((row) => !endedRow(row)),
        ...sortedData.filter((row) => endedRow(row)),
      ]
    : sortedData;

  // Calculate total pages based on filtered data
  const calculatedTotalPages = Math.ceil(orderedData.length / pageSize) || 1;

  // The same rule for whatever narrows the list from outside this component:
  // a filter applied or cleared, a smaller page size. The page that no longer
  // exists is left rather than shown empty.
  useEffect(() => {
    if (currentPage > calculatedTotalPages && onPageChange) {
      onPageChange(calculatedTotalPages);
    }
  }, [currentPage, calculatedTotalPages, onPageChange]);

  /**
   * Which page buttons to draw: always the first and the last, the three
   * around the one being read, and `null` wherever a run was left out.
   */
  const pageNumbers = (() => {
    const total = calculatedTotalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    // At either end the reader is already beside the edge, so two numbers
    // are enough there; in the middle it takes three to show which way the
    // list runs. Anything wider only pushes the last page further off.
    const around =
      currentPage <= 2
        ? [2, 3]
        : currentPage >= total - 1
          ? [total - 2, total - 1]
          : [currentPage - 1, currentPage, currentPage + 1];

    const shown = [1, ...around, total];

    const out = [];
    let last = 0;
    for (const n of shown) {
      if (n - last > 1) out.push(null);
      out.push(n);
      last = n;
    }
    return out;
  })();

  // Paginate filtered data
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = orderedData.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/*
        Standard 07: the toolbar and the table are one container. Searching,
        filtering and adding all act on the list below, so they sit inside its
        frame with a rule under them, not on a separate bar floating above it.
        Search takes the logical start of the row and the actions the logical
        end, which swap sides with the language.
      */}
      {/* Clipped rather than hidden when frozen: both keep the corners
          round, but hidden makes the card a scroll box of its own, and a
          sticky toolbar inside one never meets the page's scroll. */}
      <Card
        className={cn(
          "rounded-[8px] border border-container-border bg-card",
          freezeHeader ? "overflow-clip" : "overflow-hidden"
        )}
      >
      <div
        ref={toolbarRef}
        className={cn(freezeHeader && "sticky z-20 bg-card")}
        style={freezeHeader ? { top: APP_HEADER } : undefined}
      >
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 border-b border-container-border p-3">

        {/* Global Search, first on the row wherever it appears */}
        <AiSearch
          value={searchValue}
          onChange={handleSearch}
          placeholder={searchPlaceholder}
          className={searchClassName}
        />

        {/* Custom Filters */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {filters}
        </div>

        {/* Everything that acts on this list, gathered on one side of the row.
            Splitting the controls between the two ends made the eye cross the
            whole table to set a page size, and left the middle saying nothing.
            The far end is kept clear for whatever acts on a record. */}
        <div className="flex flex-1 items-center gap-2">
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              onPageSizeChange && onPageSizeChange(parseInt(value));
              // Changing how many rows a page holds changes which page each
              // record is on, so the numbering starts again from the first.
              // Page three of ten pages is not page three of two.
              if (onPageChange) onPageChange(1);
            }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>

          {/* Square, and the same 42px every other control on this row stands
              at, so the mark inside has room to be recognised rather than
              guessed at. */}
          {showExport && (
            <Button
              variant="outline"
              size="icon"
              className="h-[42px] w-[42px] shrink-0 [&_svg]:size-6"
              title="Export to Excel"
              onClick={() =>
                downloadCsv(toCsv(columns, filteredData), exportFileName)
              }
            >
              <ExcelIcon className="size-6" />
              <span className="sr-only">Export to Excel</span>
            </Button>
          )}

          {/* The way to add, at the logical end of the toolbar. It goes
              while the panel is open: two of the same form on one page is
              two records nobody meant to make.

              Standard 06: an outline, not a filled button - white, a 1px navy
              edge and navy text. Adding is one thing a list offers, not the
              thing the list is for. */}
          {/* Pushed to the far end: these are the controls that act on a
              record rather than on the view of the list, and a list inside a
              record has no page title for them to sit beside. A list that can
              be added to in more than one way shows each, side by side. */}
          {(onAdd || moreAdds.length > 0) && !addPanel && (
            <div className="ms-auto flex shrink-0 items-center gap-2">
              {moreAdds.map((action) => (
                <Button key={action.label} type="button" variant="add" onClick={action.onClick}>
                  <Plus className="me-2 h-4 w-4" />
                  {action.label}
                </Button>
              ))}
              {onAdd && (
                <Button type="button" variant="add" onClick={onAdd}>
                  <Plus className="me-2 h-4 w-4" />
                  {addLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* What the list is currently narrowed by, said under the row that
          narrowed it. Each one can go on its own, because undoing four
          choices to revisit one is how people give up on filtering. */}
      {appliedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-container-border px-3 py-2.5">
          {appliedFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => onRemoveFilter && onRemoveFilter(filter)}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-primary bg-card px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span>
                {filter.label}: {filter.value}
              </span>
              <X className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">
                Remove the {filter.label} filter
              </span>
            </button>
          ))}

          {/* Not underlined: nothing that can be clicked in this system is. */}
          <button
            type="button"
            onClick={() => onClearFilters && onClearFilters()}
            className="rounded-[6px] px-1.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Clear all
          </button>
        </div>
      )}
      </div>

      {/* The panel sits between the toolbar and the table, inside the same
          frame, with a rule under it and the accent that marks a section
          heading beside its title. */}
      {addPanel && (
        <div className="animate-in slide-in-from-top-2 border-b border-container-border p-4 duration-200">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="border-s-[3px] border-primary ps-3">
              <p className="text-[15px] font-semibold text-primary">
                {addPanelTitle}
              </p>
              {addPanelNote && (
                <p className="text-xs text-muted-foreground">{addPanelNote}</p>
              )}
            </div>
            {onAddPanelClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={onAddPanelClose}
                title="Close"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            )}
          </div>
          {addPanel}
        </div>
      )}

      <div className="block">
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* Frozen, the table has no scroll box of its own: the page is the
                one thing that scrolls, and the headings hold against it. A box
                that scrolls - even only sideways - is what a sticky heading
                sticks to, so on a wide screen the table is left unboxed. On a
                narrow one it still scrolls sideways, and the headings go with
                the page there rather than cut the table off. */}
            <Scroller className="w-full">
              {/* The frame every table in the system is drawn in: a rule under
                  each row and none between columns, a tinted single-line
                  header, figures to the right. It lives here so the pages that
                  use this table cannot drift apart. The outer edge is the
                  card's own rounded border - a second, square one inside it
                  shows through at the corners. */}
              <Table
                className="table-hover-lines"
                wrapperClassName={
                  freezeHeader ? "lg:overflow-visible" : "max-h-[min(70vh,720px)]"
                }
              >
                <TableHeader>
                  <TableRow
                    className="sticky top-0 z-10 bg-table-head shadow-[0_1px_0_0_var(--container-border)] hover:bg-table-head"
                    style={
                      freezeHeader ? { top: APP_HEADER + toolbarHeight } : undefined
                    }
                  >
                    {columns.map((column) => (
                      <TableHead
                        key={column.key}
                        className={cn(
                          // Top, not middle: where one heading wraps, the
                          // short ones beside it still start on its first line.
                          "px-4 py-3 text-start align-top text-[13px] font-semibold text-table-head-ink",
                          column.className
                        )}
                        style={{ width: column.width }}
                      >
                        {enableSorting && !column.disableSort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column.key)}
                            className="group/sort inline-flex items-start gap-1 rounded text-start hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span>
                              <ColumnHeading
                                header={column.header}
                                subHeader={column.subHeader}
                              />
                            </span>
                            <SortMark
                              direction={
                                sort?.key === column.key ? sort.direction : null
                              }
                            />
                          </button>
                        ) : (
                          <ColumnHeading
                            header={column.header}
                            subHeader={column.subHeader}
                          />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                  {enableColumnSearch && (
                    <TableRow className="sticky top-0 z-10 bg-table-head shadow-[0_1px_0_0_var(--container-border)] hover:bg-table-head">
                      {columns.map((column) => (
                        <TableHead
                          key={`filter-${column.key}`}
                          className="px-4 py-2"
                          style={{ width: column.width }}
                        >
                          {column.filterComponent ? (
                            column.filterComponent
                          ) : column.key !== 'actions' && !column.disableFilter ? (
                            <Input
                              type="text"
                              value={columnFilters[column.key] || ""}
                              onChange={(e) => handleColumnFilterChange(column.key, e.target.value)}
                              className="h-8 text-xs"
                            />
                          ) : null}
                        </TableHead>
                      ))}
                    </TableRow>
                  )}
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((row, rowIndex) => (
                      <TableRow
                        key={row.id || rowIndex}
                        className={cn(
                          // 52px of row, striped on the evens and lit on
                          // hover; hover is written last so it wins.
                          "h-[56px] border-b border-container-border align-top last:border-0",
                          // The first row starts a little further from the
                          // headings than the rows below start from each
                          // other, so it does not read as part of them.
                          "[&:first-child>td]:pt-5",
                          "even:bg-table-zebra hover:bg-table-row-hover",
                          onRowClick && "cursor-pointer"
                        )}
                        onClick={() => onRowClick && onRowClick(row)}
                      >
                        {columns.map((column) => (
                          <TableCell
                            key={column.key}
                            className={cn(
                              "px-4 py-4 align-top text-start text-sm",
                              column.cellClassName
                            )}
                          >
                            {column.render
                              ? column.render(row[column.key], row)
                              : row[column.key]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {!freezeHeader && <ScrollBar orientation="horizontal" />}
            </Scroller>
          </div>
      </div>
      </Card>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground order-2 sm:order-1">
          {/* What is on screen out of what there is. Said whether or not
              the page named what it holds: "Page 1 of 3" answers a
              question nobody asked, while the count answers the one they
              did. */}
          {filteredData.length > 0
            ? "Showing " +
              ((currentPage - 1) * pageSize + 1) +
              "–" +
              Math.min(currentPage * pageSize, filteredData.length) +
              " of " +
              filteredData.length +
              (itemLabel ? " " + itemLabel : "")
            : "Nothing to show"}
        </p>
        <div className="flex items-center gap-2 order-1 sm:order-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange && onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="h-9"
          >
            <ChevronLeft className="h-4 w-4 me-1" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {/* The first page, the last, and the three around whichever is
              being read - with an ellipsis standing for whatever run was
              skipped. A row of twenty-five numbers is not a control anybody
              uses; it is a wall they read past. */}
          <div className="hidden items-center gap-1 sm:flex">
            {pageNumbers.map((pageNum, i) =>
              pageNum === null ? (
                <span
                  key={"gap" + i}
                  aria-hidden="true"
                  className="px-1 text-sm text-muted-foreground"
                >
                  &hellip;
                </span>
              ) : (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "ghost"}
                  size="sm"
                  aria-current={currentPage === pageNum ? "page" : undefined}
                  onClick={() => onPageChange && onPageChange(pageNum)}
                  className="h-9 w-9"
                >
                  {pageNum}
                </Button>
              )
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange && onPageChange(currentPage + 1)}
            disabled={currentPage >= calculatedTotalPages}
            className="h-9"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4 ms-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
