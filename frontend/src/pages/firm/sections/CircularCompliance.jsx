import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { RecordTable, HeadRow, Th, Row, Td, EmptyRow, SkeletonRows, ErrorRow } from "@/components/shared/RecordTable";
import { Bone } from "@/components/shared/TableStates";
import { useTableSort } from "@/lib/sorting";
import { cn } from "@/lib/utils";
import { circularInsightsApi } from "@/lib/api/modules/circularInsights";
import { formatDate } from "@/lib/circulars/context";

const NONE = [];

/**
 * How each table here sorts, by the system's sorting standard. Counts and
 * rates sort by the number itself; the circular's reference reads as text so
 * "CIR-10" still follows "CIR-9".
 */
const CIRCULAR_SORT = {
  circularNo: { sort: "text" },
  targetGroup: { sort: "text" },
  date: { sort: "date" },
  acknowledged: { sort: "number" },
  rate: { sort: "number" },
  readNotAcknowledged: { sort: "number" },
  unopened: { sort: "number" },
  pending: { sort: "number", sortValue: (one) => one.pending.length },
};

const DEPARTMENT_SORT = {
  department: { sort: "text" },
  acknowledged: { sort: "number" },
  rate: { sort: "number" },
};

const OUTSTANDING_SORT = {
  name: { sort: "text" },
  pending: { sort: "number" },
  oldestDays: { sort: "number" },
};

const rateTone = (rate) => (rate >= 90 ? "bg-green-600" : rate >= 60 ? "bg-amber-500" : "bg-red-600");

function Rate({ value }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-2 w-20 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", rateTone(value))} style={{ width: value + "%" }} />
      </span>
      <span className="font-semibold text-primary">{value}%</span>
    </span>
  );
}

/**
 * One figure. While the count is on its way a grey bar holds its place, and
 * a count that could not be made shows a dash - never a 0 that is not true.
 */
function Figure({ label, value, note, status = "ready" }) {
  return (
    <div className="rounded-lg border border-container-border p-4">
      <p className="text-xs text-primary/70">{label}</p>
      {status === "loading" ? (
        <Bone className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-1 text-2xl font-bold text-primary">{status === "failed" ? "-" : value}</p>
      )}
      {note && status === "ready" && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * Where acknowledgement of the firm's circulars stands: how many of the
 * people each was issued to have acknowledged it, who has opened it without
 * acknowledging, who has not opened it at all, which departments lag and who
 * keeps falling behind. Read off the records each time it is opened.
 *
 * `version` changes when a circular is issued or acknowledged, so the
 * figures are counted again.
 */
export default function CircularCompliance({ version }) {
  // What was last counted, and for which request: `key` is the version and
  // the Retry count it was fetched for, so while it differs from the one
  // asked for now, the figures are still on their way.
  const [loaded, setLoaded] = useState({ key: null, data: null, failed: false });
  const [attempt, setAttempt] = useState(0);
  const [opened, setOpened] = useState(null);
  const key = version + ":" + attempt;
  const status = loaded.key !== key ? "loading" : loaded.failed ? "failed" : "ready";
  const data = status === "ready" ? loaded.data : null;
  // Retry counts again without leaving the section, so the tables keep the
  // order they were sorted in.
  const retry = () => setAttempt((n) => n + 1);

  // Sorted before the loading and failure returns below, so the hooks run
  // the same way every render. Only the eight with most outstanding are
  // listed, so it is those eight that are put in order.
  const circulars = useTableSort(data?.circulars ?? NONE, CIRCULAR_SORT);
  const departments = useTableSort(data?.departments ?? NONE, DEPARTMENT_SORT);
  const outstanding = useTableSort(data?.outstanding.slice(0, 8) ?? NONE, OUTSTANDING_SORT);

  useEffect(() => {
    let cancelled = false;
    circularInsightsApi.compliance().then(
      (next) => !cancelled && setLoaded({ key, data: next, failed: false }),
      () => !cancelled && setLoaded({ key, data: null, failed: true })
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  // The section stays in place while it counts or when the count failed: the
  // figures hold their places and each table says so in its own rows.
  const overall = data?.overall || {};
  const tableState = (columns, label) =>
    status === "loading" ? (
      <SkeletonRows columns={columns} rows={5} />
    ) : status === "failed" ? (
      <ErrorRow colSpan={columns} label={label} onRetry={retry} />
    ) : null;

  return (
    <section aria-labelledby="circular-compliance-title" className="space-y-5 rounded-xl border border-container-border bg-card p-4 sm:p-5">
      <div>
        <h3 id="circular-compliance-title" className="flex items-center gap-2 text-lg font-bold text-primary">
          <ShieldCheck className="size-5" aria-hidden="true" />
          Compliance Insights
        </h3>
        <p className="text-sm text-primary/75">Who has read and acknowledged the circulars in force, and where it lags</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure status={status} label="Acknowledgement Rate" value={overall.rate + "%"} note={overall.acknowledged + " of " + overall.targeted + " across " + overall.circulars + " active circulars"} />
        <Figure status={status} label="Still to Acknowledge" value={overall.targeted - overall.acknowledged} />
        <Figure status={status} label="Opened, Not Acknowledged" value={overall.readNotAcknowledged} note="May need explaining" />
        <Figure status={status} label="Not Opened" value={overall.unopened} note="Need a reminder" />
      </div>

      {data && (
        <ul className="space-y-1.5 rounded-lg bg-blue-50/60 px-4 py-3 text-sm text-primary">
          {data.insights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      <RecordTable minWidth={900}>
        <HeadRow>
          <Th width="13%" {...circulars.sortProps("circularNo")}>Circular No.</Th>
          <Th {...circulars.sortProps("targetGroup")}>Target Group</Th>
          <Th {...circulars.sortProps("date")}>Issued</Th>
          <Th {...circulars.sortProps("acknowledged")}>Acknowledged</Th>
          <Th {...circulars.sortProps("rate")}>Rate</Th>
          <Th {...circulars.sortProps("readNotAcknowledged")}>Opened, Not Acknowledged</Th>
          <Th {...circulars.sortProps("unopened")}>Not Opened</Th>
          <Th className="text-end" {...circulars.sortProps("pending")}>Pending</Th>
        </HeadRow>
        <tbody>
          {tableState(8, "circulars")}
          {data && circulars.rows.length === 0 && <EmptyRow colSpan={8} label="circulars" />}
          {circulars.rows.map((one) => (
            <Row key={one.id}>
              <Td className="whitespace-nowrap font-semibold text-primary">{one.circularNo}</Td>
              <Td>{one.targetGroup}</Td>
              <Td className="whitespace-nowrap">
                {formatDate(one.date)}
                <span className="block text-xs text-muted-foreground">{one.daysOpen} days ago</span>
              </Td>
              <Td>
                {one.acknowledged} of {one.targeted}
              </Td>
              <Td>
                <Rate value={one.rate} />
              </Td>
              <Td>{one.readNotAcknowledged}</Td>
              <Td>{one.unopened}</Td>
              <Td className="text-end">
                {one.pending.length > 0 ? (
                  <button
                    type="button"
                    aria-expanded={opened === one.id}
                    onClick={() => setOpened(opened === one.id ? null : one.id)}
                    className="inline-flex items-center gap-1 rounded font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {one.pending.length}
                    <ChevronDown className={cn("size-4 transition-transform", opened === one.id && "rotate-180")} aria-hidden="true" />
                    <span className="sr-only">employees still to acknowledge {one.circularNo}</span>
                  </button>
                ) : (
                  <span className="text-green-700">Complete</span>
                )}
              </Td>
            </Row>
          ))}
        </tbody>
      </RecordTable>

      {(data?.circulars ?? NONE)
        .filter((one) => one.id === opened)
        .map((one) => (
          <div key={one.id} className="space-y-3 rounded-lg border border-container-border p-4 text-sm text-primary">
            <p className="font-semibold">
              {one.circularNo}: still to acknowledge
            </p>
            <p className="text-primary/75">{one.subject}</p>
            <ul className="flex flex-wrap gap-2">
              {one.pending.map((person) => (
                <li key={person.id} className="rounded-md bg-muted px-2.5 py-1">
                  {person.name}
                  <span className="ms-1.5 text-xs text-muted-foreground">{person.read ? "opened" : "not opened"}</span>
                </li>
              ))}
            </ul>
            {one.mostAffected.length > 0 && (
              <p>
                <span className="font-semibold">Most affected by its instructions: </span>
                {one.mostAffected.map((person) => person.name).join(", ")}
              </p>
            )}
          </div>
        ))}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-primary">By Department</h4>
          <RecordTable minWidth={360}>
            <HeadRow>
              <Th {...departments.sortProps("department")}>Department</Th>
              <Th {...departments.sortProps("acknowledged")}>Acknowledged</Th>
              <Th {...departments.sortProps("rate")}>Rate</Th>
            </HeadRow>
            <tbody>
              {tableState(3, "departments")}
              {data && departments.rows.length === 0 && <EmptyRow colSpan={3} label="departments" />}
              {departments.rows.map((one) => (
                <Row key={one.department}>
                  <Td>{one.department}</Td>
                  <Td>
                    {one.acknowledged} of {one.targeted}
                  </Td>
                  <Td>
                    <Rate value={one.rate} />
                  </Td>
                </Row>
              ))}
            </tbody>
          </RecordTable>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-primary">Employees With Most Outstanding</h4>
          <RecordTable minWidth={360}>
            <HeadRow>
              <Th {...outstanding.sortProps("name")}>Employee</Th>
              <Th {...outstanding.sortProps("pending")}>Outstanding</Th>
              <Th {...outstanding.sortProps("oldestDays")}>Oldest</Th>
            </HeadRow>
            <tbody>
              {tableState(3, "outstanding acknowledgements")}
              {data && outstanding.rows.length === 0 && (
                <EmptyRow colSpan={3} label="outstanding acknowledgements" />
              )}
              {outstanding.rows.map((one) => (
                <Row key={one.id}>
                  <Td>
                    <Link to={"/employees/" + one.id} state={{ section: "circulars" }} className="font-semibold text-primary">
                      {one.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{one.department || "-"}</span>
                  </Td>
                  <Td>{one.pending}</Td>
                  <Td>{one.oldestDays} days</Td>
                </Row>
              ))}
            </tbody>
          </RecordTable>
        </div>
      </div>
    </section>
  );
}
