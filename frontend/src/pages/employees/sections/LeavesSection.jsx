import { useState } from "react";
import RequestTable from "@/components/shared/RequestTable";
import RequestOverview from "@/components/shared/RequestOverview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/panels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
} from "@/components/shared/RecordTable";
import { Plus, CheckCircle2, Clock, XCircle, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/pages/firm/firmData";
import LeaveForm from "./LeaveForm";
import { useLeaves } from "@/lib/leaves/context";
import {
  LEAVE_STATUS_TONE,
  canTakeAdvance,
  chargedYear,
  leaveTypeLabel,
  leaveYear,
  leavesFor,
  leaveYearsFor,
  remainingBalance,
  stageOf,
  workflowLabel,
  daysOf,
  ENCASHED_PAID,
} from "../leaveData";

/** Today, as the review date starts from. */
const thisDay = () => new Date().toISOString().slice(0, 10);

const STATUS_ICON = {
  Pending: Clock,
  Approved: CheckCircle2,
  Rejected: XCircle,
};

const thisYear = () => String(new Date().getFullYear());

const emptyDraft = () => ({
  category: "",
  type: "",
  from: "",
  to: "",
  year: thisYear(),
  reason: "",
  replacement: "",
});

/**
 * Leave asked for, and what was decided about it.
 *
 * The request is the employee's half - what kind of absence, when, and why.
 * The decision is management's, and stays blank until one is made, so nothing
 * on the row can suggest an answer that has not been given.
 */
export default function LeavesSection({ employee, canReview = true }) {
  // Shared with every other page that reads leave, so a request asked for here
  // is still there after the page moves away and back.
  const { leaves, addLeave, departmentDecision, managementDecision } = useLeaves();
  // While a call to the server is out, its button waits rather than sending twice.
  const [busy, setBusy] = useState(false);
  const send = async (call) => {
    if (busy) return null;
    setBusy(true);
    try {
      return await call();
    } finally {
      setBusy(false);
    }
  };
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  // A request opened from the list to be reviewed, and the stage of it shown.
  const [openId, setOpenId] = useState(null);
  const [stage, setStage] = useState("department");
  // What this employee has asked for before, open over the request.
  const [showHistory, setShowHistory] = useState(false);
  const [review, setReview] = useState({ reviewDate: "", decision: "", comments: "" });

  const open = leaves.find((leave) => leave.id === openId) || null;

  const mine = leavesFor(leaves, employee.name);
  const years = [
    ...new Set([thisYear(), ...leaveYearsFor(leaves, employee.name)]),
  ].sort((a, b) => b.localeCompare(a));

  /**
   * The years a new request can be charged to: this one, and next year only
   * once this year's annual leave is gone - that is what an advance is for.
   */
  const nextYear = String(Number(thisYear()) + 1);
  const advanceOffered = canTakeAdvance(leaves, employee.name, thisYear());
  const requestYears = advanceOffered ? [thisYear(), nextYear] : [thisYear()];

  // Leave is granted a year at a time, so the list is read a year at a time.
  const [year, setYear] = useState(thisYear);

  /**
   * While a request is being written, the list below it narrows to the kind of
   * leave being asked for - what is already on record for that type is what
   * the new request has to be judged against. Closing the form puts the whole
   * year back.
   */
  const shownType = adding ? draft.type : "";
  const shownCategory = adding ? draft.category : "";
  const filteredBy = shownType || shownCategory;

  // Newest first: the latest request is the one most likely being looked for.
  const rows = mine
    .filter(
      (leave) =>
        chargedYear(leave) === year &&
        (!shownCategory || leave.category === shownCategory) &&
        (!shownType || leave.type === shownType)
    )
    // The newest request first: the one just made is the one being looked for.
    .sort((a, b) => b.id - a.id);

  /** A type belongs to one category, so changing the category clears it. */
  const chooseCategory = (value) =>
    setDraft((prev) => ({ ...prev, category: value, type: "" }));

  /**
   * The year follows the start date on its own - except on an advance, where
   * the year is the point: the days are taken now and charged to next year,
   * and the kind of leave is settled by that choice.
   */
  const setField = (name, value) =>
    setDraft((prev) => {
      if (name === "year") {
        return value === nextYear
          ? { ...prev, year: value, category: "Regular Leave", type: "Annual Leave" }
          : { ...prev, year: value };
      }
      const chargedToNextYear = prev.year === nextYear;
      return {
        ...prev,
        [name]: value,
        ...(name === "from" && value && !chargedToNextYear
          ? { year: leaveYear(value) }
          : {}),
      };
    });

  const close = () => {
    setAdding(false);
    setDraft(emptyDraft());
    setOpenId(null);
    setReview({ reviewDate: "", decision: "", comments: "" });
  };

  /** A request opens at the stage it is waiting at. */
  const openReview = (leave) => {
    setAdding(false);
    setOpenId(leave.id);
    setStage(stageOf(leave));
    setReview({
      reviewDate: thisDay(),
      decision: leave.status === "Pending" ? "" : leave.status === "Approved" ? "Approve" : "Reject",
      comments: leave.comments || "",
    });
  };

  const setReviewField = (name, value) =>
    setReview((prev) => ({ ...prev, [name]: value }));

  /**
   * A department that approves passes the request up to management; one that
   * refuses ends it there. Management's answer is the final one either way.
   * The server records who answered and when, and refuses an answer the
   * request is not waiting for.
   */
  const decide = async () => {
    // Nobody approves their own leave: on the employee's own page the
    // decision is read once it has been given, and never written.
    if (!canReview || !open || !review.decision || !review.reviewDate) return;
    const approved = review.decision === "Approve";

    if (stage === "department") {
      const saved = await send(() => departmentDecision(open.id, review));
      if (!saved) return;
      if (approved) {
        setStage("management");
        setReview({ reviewDate: thisDay(), decision: "", comments: "" });
        return;
      }
      close();
      return;
    }

    const saved = await send(() => managementDecision(open.id, review));
    if (!saved) return;
    close();
  };

  const save = async () => {
    // Numbered and checked against the balance by the server; a refusal is
    // shown as a notice and the form stays as it was.
    const saved = await send(() => addLeave(draft, employee.id));
    if (!saved) return;
    setYear(saved.year);
    close();
  };

  // One leave as the list and the history both show it.
  const asRow = (leave) => {
    const days = daysOf(leave);
    const encashed = leave.status === ENCASHED_PAID;
    // What was left before this request, and what it leaves behind -
    // both counted off the record, never stored.
    const balance = remainingBalance(leaves, employee.name, leave.type, chargedYear(leave));
    return {
      ...leave,
      days,
      typeText: leaveTypeLabel(leave),
      // Paid out, not taken: no dates to show.
      period: encashed ? "Encashed" : formatDate(leave.from) + " – " + formatDate(leave.to),
      workflow: workflowLabel(leave),
      // Before this request, and after it. An approved or encashed one is
      // already counted in the balance, so it is added back for "before"
      // rather than taken off a second time for "after".
      balanceText:
        balance && !balance.expired
          ? (leave.status === "Approved" || encashed
              ? balance.remaining + days + " Days / " + balance.remaining + " Days"
              : balance.remaining + " Days / " + Math.max(balance.remaining - days, 0) + " Days")
          : "-",
    };
  };

  const columns = [
    {
      // The number opens the request at the stage it is waiting at,
      // for whoever has to decide it.
      key: "leaveNo",
      header: "Leave No.",
      width: "10%",
      render: (value, leave) =>
        canReview ? (
          <button
            type="button"
            onClick={() => openReview(leave)}
            className="rounded font-bold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {value || "-"}
          </button>
        ) : (
          <span className="font-bold text-primary">{value || "-"}</span>
        ),
    },
    {
      key: "category",
      header: "Leave Details",
      width: "18%",
      render: (value, leave) => (
        <>
          <span className="block font-semibold text-primary">{value}</span>
          <span className="block text-xs text-muted-foreground">{leave.typeText}</span>
        </>
      ),
    },
    {
      key: "period",
      header: "Leave Period",
      width: "22%",
      render: (value, leave) => (
        <span className="whitespace-nowrap">
          {value}
          <span className="px-1.5 text-muted-foreground">/</span>
          {leave.days} {leave.days === 1 ? "Day" : "Days"}
        </span>
      ),
    },
    {
      // Management's note sits with the decision it explains.
      key: "workflow",
      header: "Approval Workflow",
      width: "20%",
      render: (value, leave) => (
        <>
          {value}
          {leave.comments && (
            <span className="mt-1 block text-xs text-muted-foreground">{leave.comments}</span>
          )}
        </>
      ),
    },
    {
      key: "balanceText",
      header: "Balance",
      width: "15%",
      render: (value) => <span className="whitespace-nowrap">{value}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "15%",
      render: (value) => {
        const Icon = STATUS_ICON[value];
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              LEAVE_STATUS_TONE[value]
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            {value}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* What has been asked for, a reading of it, and the way to ask -
          over the year's list. Counted in days, not money. */}
      <RequestOverview
        icon={CalendarDays}
        title="Leave"
        subtitle="Request leave and track your requests."
        noun="leave request"
        newLabel="New Leave Request"
        onNew={!adding && !open ? () => setAdding(true) : null}
        unit="Days"
        typeLabel="Leave Type"
        rows={mine.map((leave) => ({
          id: leave.id,
          no: leave.leaveNo,
          date: leave.requestedOn || leave.from,
          amount: daysOf(leave),
          status: leave.status,
          type: leaveTypeLabel(leave),
          record: leave,
        }))}
        onOpen={canReview && !adding && !open ? openReview : null}
        renderAll={() => (
          <RequestTable
            rows={[...mine].sort((a, b) => b.id - a.id).map(asRow)}
            columns={columns}
            searchPlaceholder="Search by leave no., type or period..."
            itemLabel="leave requests"
            exportFileName="leaves.csv"
          />
        )}
      />

      {/* The year the list is read by, and the way to add to it. Leave is
          granted a year at a time, so the year is a choice rather than a
          column repeated down every row. Empty values are ignored: Radix
          reports "" whenever its list changes. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={year} onValueChange={(value) => value && setYear(value)}>
          <SelectTrigger className="w-28" aria-label="Leave year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>

      {/* Opened over the page, so the list it is filed into stays behind it. */}
      <Dialog open={adding || Boolean(open)} onOpenChange={(o) => !o && close()}>
        <DialogContent hideClose className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
          <LeaveForm
            onHistory={() => setShowHistory(true)}
            employee={employee}
            leaves={leaves}
            draft={open ? review : draft}
            years={requestYears}
            advanceYear={nextYear}
            onChange={open ? setReviewField : setField}
            onCategory={chooseCategory}
            onSubmit={save}
            onCancel={close}
            record={open}
            canReview={canReview}
            stage={open ? stage : "submit"}
            onStage={setStage}
            onDecide={decide}
          />
          {/* Every leave this employee has asked for, over the request. */}
          <Dialog open={showHistory} onOpenChange={setShowHistory}>
            <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Leave History · {employee.name}</DialogTitle>
                <DialogDescription>Every leave request this employee has made.</DialogDescription>
              </DialogHeader>
              <RequestTable
                rows={[...mine].sort((a, b) => b.id - a.id).map(asRow)}
                columns={columns}
                searchPlaceholder="Search by leave no., type or period..."
                itemLabel="leave requests"
                exportFileName="leaves.csv"
              />
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      {filteredBy && (
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-primary">{filteredBy}</span>{" "}
          in {year} only
        </p>
      )}

      <Card>
        <CardContent className="p-4 sm:p-6">
          <RequestTable
            rows={rows.map(asRow)}
            columns={columns}
            searchPlaceholder="Search by leave no., type or period..."
            itemLabel="leave requests"
            exportFileName={"leaves-" + year + ".csv"}
            filterBy={[
              { key: "status", label: "Status" },
              { key: "category", label: "Leave Category" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
