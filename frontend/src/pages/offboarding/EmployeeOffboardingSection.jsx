import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, ChevronRight, UserMinus } from "lucide-react";
import { RecordTable, HeadRow, Th, EmptyRow, SkeletonRows, ErrorRow, RecordLink } from "@/components/shared/RecordTable";
import { can } from "@/lib/access";
import { offboardingApi, OPEN_STATUSES } from "@/lib/api/modules/offboarding";
import { formatDate } from "@/lib/circulars/context";
import StartOffboardingDialog from "./StartOffboardingDialog";
import { OffboardingStatus } from "./offboardingParts";

/**
 * End of Service on an employee's own file: the cases opened for them, and
 * the way to start one - "Start Offboarding" for management, "Submit
 * Resignation" for the employee on their own profile.
 */
export default function EmployeeOffboardingSection({ employee, self = false }) {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [state, setState] = useState("loading");
  const [starting, setStarting] = useState(false);

  // Loading is the state the page opens in; a retry says so again.
  const load = useCallback(async (retrying) => {
    if (retrying === true) setState("loading");
    try {
      setCases(await offboardingApi.list({ employeeId: employee.id }));
      setState("ready");
    } catch {
      setState("failed");
    }
  }, [employee.id]);

  useEffect(() => {
    let live = true;
    offboardingApi.list({ employeeId: employee.id }).then(
      (rows) => {
        if (!live) return;
        setCases(rows);
        setState("ready");
      },
      () => live && setState("failed")
    );
    return () => {
      live = false;
    };
  }, [employee.id]);

  const openCase = cases.find((c) => OPEN_STATUSES.includes(c.status));
  const inactive = employee.status === "Inactive";
  const mayStart = !inactive && !openCase && (self || can("offboarding.create"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-container-border bg-secondary/40 p-4">
        <span className="flex size-10 items-center justify-center rounded-lg bg-[#0b2447] text-white">
          <LogOut className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-primary">
            {openCase
              ? "Offboarding " + openCase.caseNo + " is " + openCase.status.toLowerCase()
              : inactive
                ? "This employee has left the firm"
                : "No offboarding in progress"}
          </p>
          <p className="text-sm text-muted-foreground">
            {self
              ? "A resignation goes to management for approval, then through your notice period and clearance."
              : "Resignation, termination, end of contract or retirement - with approval, notice, clearance of assets and access, and the final settlement."}
          </p>
        </div>
        {openCase && (
          <Button type="button" variant="add" onClick={() => navigate("/offboarding/" + openCase.id)}>
            Open Case
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        )}
        {mayStart && (
          <Button type="button" onClick={() => setStarting(true)}>
            <UserMinus className="size-4" aria-hidden="true" />
            {self ? "Submit Resignation" : "Start Offboarding"}
          </Button>
        )}
      </div>

      <RecordTable minWidth={720}>
        <HeadRow>
          <Th width="16%">Case No.</Th>
          <Th width="18%">Type</Th>
          <Th>Reason</Th>
          <Th width="16%">Last Working Day</Th>
          <Th width="18%">Status</Th>
        </HeadRow>
        <tbody>
          {state === "loading" && <SkeletonRows columns={5} rows={2} />}
          {state === "failed" && <ErrorRow colSpan={5} label="offboarding cases" onRetry={() => load(true)} />}
          {state === "ready" && cases.length === 0 && <EmptyRow colSpan={5} label="offboarding cases" />}
          {state === "ready" &&
            cases.map((c) => (
              <tr key={c.id} className="border-b border-container-border last:border-0">
                <td className="px-4 py-3">
                  <RecordLink onClick={() => navigate("/offboarding/" + c.id)}>{c.caseNo}</RecordLink>
                </td>
                <td className="px-4 py-3">{c.type}</td>
                <td className="px-4 py-3">{c.reason || "-"}</td>
                <td className="px-4 py-3 numeric-value">{formatDate(c.lastWorkingDate)}</td>
                <td className="px-4 py-3">
                  <OffboardingStatus status={c.status} />
                </td>
              </tr>
            ))}
        </tbody>
      </RecordTable>

      <StartOffboardingDialog
        open={starting}
        onOpenChange={setStarting}
        employee={employee}
        resign={self}
        onStarted={(made) => navigate("/offboarding/" + made.id)}
      />
    </div>
  );
}
