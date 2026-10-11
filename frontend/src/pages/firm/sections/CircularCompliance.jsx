import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { Loader } from "@/components/shared/Loader";
import { RecordTable, HeadRow, Th, Row, Td } from "@/components/shared/RecordTable";
import { cn } from "@/lib/utils";
import { circularInsightsApi } from "@/lib/api/modules/circularInsights";
import { formatDate } from "@/lib/circulars/context";

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

function Figure({ label, value, note }) {
  return (
    <div className="rounded-lg border border-container-border p-4">
      <p className="text-xs text-primary/70">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
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
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState("");
  const [opened, setOpened] = useState(null);

  useEffect(() => {
    let cancelled = false;
    circularInsightsApi.compliance().then(
      (next) => !cancelled && setData(next),
      (error) => !cancelled && setFailed(error?.message || "Compliance could not be loaded.")
    );
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (failed) return null;
  if (!data) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-primary">
        <Loader size={16} />
        Counting acknowledgements…
      </p>
    );
  }

  const { overall } = data;

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
        <Figure label="Acknowledgement Rate" value={overall.rate + "%"} note={overall.acknowledged + " of " + overall.targeted + " across " + overall.circulars + " active circulars"} />
        <Figure label="Still to Acknowledge" value={overall.targeted - overall.acknowledged} />
        <Figure label="Opened, Not Acknowledged" value={overall.readNotAcknowledged} note="May need explaining" />
        <Figure label="Not Opened" value={overall.unopened} note="Need a reminder" />
      </div>

      <ul className="space-y-1.5 rounded-lg bg-blue-50/60 px-4 py-3 text-sm text-primary">
        {data.insights.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {data.circulars.length > 0 && (
        <RecordTable minWidth={900}>
          <HeadRow>
            <Th width="13%">Circular No.</Th>
            <Th>Target Group</Th>
            <Th>Issued</Th>
            <Th>Acknowledged</Th>
            <Th>Rate</Th>
            <Th>Opened, Not Acknowledged</Th>
            <Th>Not Opened</Th>
            <Th className="text-end">Pending</Th>
          </HeadRow>
          <tbody>
            {data.circulars.map((one) => (
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
      )}

      {data.circulars
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
              <Th>Department</Th>
              <Th>Acknowledged</Th>
              <Th>Rate</Th>
            </HeadRow>
            <tbody>
              {data.departments.map((one) => (
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
          {data.outstanding.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody has a circular outstanding.</p>
          ) : (
            <RecordTable minWidth={360}>
              <HeadRow>
                <Th>Employee</Th>
                <Th>Outstanding</Th>
                <Th>Oldest</Th>
              </HeadRow>
              <tbody>
                {data.outstanding.slice(0, 8).map((one) => (
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
          )}
        </div>
      </div>
    </section>
  );
}
