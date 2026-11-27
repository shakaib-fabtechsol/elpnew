import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reloadDataset } from "@/lib/api/session";
import { employeeRecords } from "../employeeData";
import { REQUEST_TYPES } from "../requestsHub";
import { StatusPill } from "./RequestsHub";
import FinancialBenefitsSection from "./FinancialBenefitsSection";
import EntitlementsSection from "./EntitlementsSection";
import LeavesSection from "./LeavesSection";
import GeneralRequestSection from "./GeneralRequestSection";

/** Which tab of Financial Benefits keeps each kind. */
const BENEFIT_TAB = { advance: "salaries", loan: "loans", assistance: "assistance", bonus: "bonus", commission: "commission" };

/** The employee a request belongs to, as the per-kind screens read one. */
function employeeFor(request) {
  const record =
    (request.employeeId != null && employeeRecords.find((one) => one.id === request.employeeId)) ||
    employeeRecords.find((one) => one.name === request.employee) ||
    null;
  if (!record) return { id: request.employeeId, name: request.employee, employeeName: request.employee };
  return { ...record, employeeName: record.name };
}

/** The kind's own detailed screen, opened on the one request. */
function RequestWorkflow({ request }) {
  const employee = employeeFor(request);
  const focusId = request.recordId;

  if (BENEFIT_TAB[request.source]) {
    return (
      <FinancialBenefitsSection
        employee={employee}
        tab={BENEFIT_TAB[request.source]}
        onTabChange={() => {}}
        onSaveSalary={() => {}}
        canEdit
        listOnly
        focusId={focusId}
      />
    );
  }
  if (request.source === "entitlement") {
    return <EntitlementsSection employee={employee} tab={request.record.kind} listOnly canEdit focusId={focusId} />;
  }
  if (request.source === "leave") {
    return <LeavesSection employee={employee} canReview focusId={focusId} />;
  }
  return <GeneralRequestSection employee={employee} kind={request.record.kind || "general"} canDecide focusId={focusId} />;
}

/**
 * A request opened from a Requests list, in the detailed screen its kind has
 * always had - its decision, payment and history - for management to act on.
 * Whatever was done in there is loaded again on closing, so the list and its
 * figures show it.
 */
export default function RequestWorkflowDialog({ request: open, onClose }) {
  const opener = useRef(null);
  const close = () => {
    if (open?.dataset) reloadDataset(open.dataset);
    onClose();
  };
  return (
    <Dialog open={Boolean(open)} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className="max-h-[92vh] w-[min(1280px,96vw)] max-w-none overflow-y-auto"
        // The request's own windows open over this one; a click on them
        // must not close it underneath.
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          opener.current = document.activeElement;
          event.currentTarget.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus?.({ preventScroll: true });
        }}
      >
        {open && (
          <>
            <DialogHeader className="text-start">
              <DialogTitle className="flex flex-wrap items-center gap-3 text-xl font-bold text-primary">
                {open.typeLabel}
                {open.number && <span className="numeric-value text-base font-semibold text-primary/70">{open.number}</span>}
                <StatusPill status={open.status} label={open.statusLabel} />
              </DialogTitle>
              <DialogDescription>
                {open.employee} · {open.category} · {REQUEST_TYPES[open.type]?.label} requests on this employee's record
              </DialogDescription>
            </DialogHeader>
            <RequestWorkflow request={open} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
