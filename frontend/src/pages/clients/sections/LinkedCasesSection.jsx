import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "@/components/shared/DataTable";
import { IdStatusDot } from "@/components/shared/panels";

import { cn } from "@/lib/utils";
import { clientLinkedCases } from "../clientMockData";

const ALL_STAGES = "all";
const ACTIVE = "active";
const CLOSED = "closed";

/** A file that has finished is closed, wherever it got to. */
const isClosed = (row) => row.caseStatus === "Closed";

/**
 * The tabs above the table, in the order a case moves through them.
 *
 * `matches` is what each tab counts and filters by. Closed is last and is a
 * level in its own right rather than a state a file can be in while it sits
 * somewhere else: a closed file is no longer under Execution, so it is
 * counted once, under Closed.
 *
 * All Cases is everything the client has ever had, finished or not, so
 * Active Cases sits beside it for the work actually in hand.
 */
const STAGES = [
  { key: ALL_STAGES, label: "All Cases", matches: () => true },
  { key: ACTIVE, label: "Active", matches: (c) => !isClosed(c) },
  { key: "Primary", label: "Primary" },
  { key: "Appeal", label: "Appeal" },
  { key: "Supreme", label: "Supreme" },
  { key: "Execution", label: "Execution" },
  { key: CLOSED, label: "Closed", matches: isClosed },
];

const matcher = (stage) =>
  stage.matches ||
  ((c) => !isClosed(c) && c.litigationLevel === stage.key);

/** Where the file stands: the level it is at, or Closed once it is done. */
const levelOf = (row) => (isClosed(row) ? "Closed" : row.litigationLevel);

/**
 * The levels a file collects a number at, in the order it collects them.
 *
 * Read off the tabs rather than written out again, so the two can never
 * fall out of step.
 */
const LEVELS = STAGES.filter(
  (s) => s.key !== ALL_STAGES && s.key !== ACTIVE && s.key !== CLOSED
).map((s) => s.key);

/** The numbers a file carries, oldest level first. */
const numbersOf = (row) =>
  LEVELS.filter((level) => row.caseNumbers?.[level]).map((level) => [
    level,
    row.caseNumbers[level],
  ]);

/** A labelled line inside a cell: what it is, then what it says. */
function DetailLine({ label, children }) {
  return (
    <p className="text-xs">
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">{children}</span>
    </p>
  );
}

/**
 * The cases a client has running, counted by the stage they have reached.
 *
 * The tabs are the filter as well as the summary - the same strip Company
 * Profile uses for Bank Accounts - so the count and the list it stands for
 * can never disagree.
 */
export default function LinkedCasesSection() {
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [stage, setStage] = useState(ALL_STAGES);

  const choose = (key) => {
    setStage(key);
    setCurrentPage(1);
  };

  const selected = STAGES.find((s) => s.key === stage) || STAGES[0];
  const shown = clientLinkedCases.filter(matcher(selected));

  // No Client column here - every row already belongs to the client on
  // screen. One row is one file: everything the file has been through is in
  // the row, so its history reads without opening it.
  const columns = [
    {
      key: "fileNo",
      header: "File No.",
      width: "8%",
      exportValue: (row) => row.fileNo + " (" + row.caseStatus + ")",
      render: (value, row) => (
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/litigation")}
            className="numeric-value font-medium text-record-link hover:opacity-80"
          >
            {value}
          </button>
          {/* A finished file says so; a running one is simply running. */}
          <IdStatusDot status={row.caseStatus} />
        </span>
      ),
    },
    { key: "opponent", header: "Opponent", width: "14%" },
    {
      // Every number the same file has been given as it moved up. One file
      // is registered afresh at each level, so the numbers belong together.
      key: "caseNumbers",
      header: "Case Numbers",
      width: "16%",
      exportValue: (row) =>
        numbersOf(row)
          .map(([level, no]) => level + ": " + no)
          .join(" | "),
      render: (_, row) => (
        <div className="space-y-0.5">
          {numbersOf(row).map(([level, no]) => (
            <DetailLine key={level} label={level}>
              {no}
            </DetailLine>
          ))}
        </div>
      ),
    },
    {
      // Where the file stands now, and what is happening at that level. A
      // closed file reads as Closed, with the level it ended at underneath:
      // it is not still under Execution once it is done.
      key: "litigationLevel",
      header: "Case Level",
      width: "12%",
      exportValue: (row) =>
        isClosed(row)
          ? "Closed - ended at " + row.litigationLevel + " - " + row.caseStage
          : [row.litigationLevel, row.caseStage].join(" - "),
      // A file still running says only where it is and what is happening
      // there; saying "Active" as well adds nothing to a row that is plainly
      // running. A closed one says where it ended.
      render: (_, row) => (
        <div className="space-y-1">
          <p className="font-semibold">{levelOf(row)}</p>
          <p className="text-xs text-muted-foreground">
            {isClosed(row) && "Ended at " + row.litigationLevel + " • "}
            {row.caseStage}
          </p>
        </div>
      ),
    },
    {
      key: "court",
      header: "Court Details",
      width: "22%",
      exportValue: (row) =>
        [row.court, row.governorate, row.location].join(" - "),
      render: (_, row) => (
        <div className="space-y-0.5">
          <DetailLine label="Court">{row.court}</DetailLine>
          <DetailLine label="Governorate">{row.governorate}</DetailLine>
          <DetailLine label="Location">{row.location}</DetailLine>
        </div>
      ),
    },
    {
      // The widest column in the table: it carries the most detail and it
      // is the part anyone opening this page came to read.
      key: "update",
      header: "Latest Update",
      width: "28%",
      exportValue: (row) => row.updateDate + " - " + (row.update || "-"),
      render: (value, row) => (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{row.updateDate}</p>
          <p>{value || "-"}</p>
        </div>
      ),
    },
  ];


  return (
    <div className="space-y-4">
      {/* One compact strip rather than six large boxes: the stages are a
          choice of what to list, and each carries its own count. */}
      <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border p-1">
        {STAGES.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => choose(option.key)}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              stage === option.key
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {option.label}
            {/* Dimmed rather than a second colour, so it reads as part of
                the label on both the selected tab and the rest. */}
            <span className="ms-1.5 opacity-70">
              ({clientLinkedCases.filter(matcher(option)).length})
            </span>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={shown}
        // A closed file is kept, under the ones still running.
        endedRow={isClosed}
        searchPlaceholder="Search cases..."
        enableColumnSearch={false}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
