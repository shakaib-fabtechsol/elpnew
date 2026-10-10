import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdvanceSteps } from "./AdvanceSalarySection";
import { SheetHead, SheetCard, HistoryCard } from "@/components/shared/RequestSheet";
import { cn } from "@/lib/utils";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { formatDate as shortDate } from "@/pages/firm/firmData";
import { employeeRecords } from "../employeeData";
import {
  ABSENCE_CATEGORIES,
  LEAVE_STAGES,
  LEAVE_DECISIONS,
  decisionTaken,
  typesIn,
  leaveDays,
  remainingBalance,
  nextLeaveNo,
} from "../leaveData";
import { checkRequired } from "@/components/shared/formFields";

import DateField from "@/components/shared/DateField";
/** Today, as the head of a new request is dated. */
const todayIso = () => new Date().toISOString().slice(0, 10);

/** A reason has to fit on the request, so the form says how much room. */
const NOTES_LIMIT = 500;

/** A field's label. */
function FieldLabel({ htmlFor, children }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
    </Label>
  );
}

/** A figure worked out from the rest of the form: shown, never asked for. */
function Worked({ id, label, value }) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        readOnly
        tabIndex={-1}
        value={value}
        className="cursor-default bg-locked text-muted-foreground"
      />
    </div>
  );
}

/** "5 Days", "1 Day", or nothing at all until there is something to count. */
const days = (count) => (count > 0 ? count + (count === 1 ? " Day" : " Days") : "");

/**
 * A new leave request.
 *
 * The three stages of the request are along the top: the employee fills in the
 * first, and the two approvals that follow are not theirs to fill in. The
 * balance is worked out as the dates are typed, because how much is left is
 * what decides whether the request can be made at all.
 */
export default function LeaveForm({
  employee,
  leaves,
  draft,
  onChange,
  onCategory,
  onSubmit,
  onCancel,
  years,
  // The year an advance would be charged to, offered only when this year's
  // annual leave is gone.
  advanceYear,
  // An existing request being reviewed, the stage of it that is open, and the
  // way to move between the stages. A new request has none of these.
  record = null,
  stage = "submit",
  onStage = () => {},
  onDecide = () => {},
  // Whoever is looking at somebody else's request answers it; on their own
  // page the answer is only read, so there is nothing here to press.
  canReview = true,
  // Opens what this employee has asked for before.
  onHistory = () => {},
}) {
  // Days taken now against next year: the kind of leave is settled by that
  // choice, so neither the category nor the type is asked for again.
  const advance = Boolean(advanceYear) && draft.year === advanceYear;
  const asked = leaveDays(draft.from, draft.to);
  const balance = remainingBalance(leaves, employee.name, draft.type, draft.year);
  // What would be left of it once this request is taken - 14 left less 5
  // asked for is 9. Below zero says the request is more than is left.
  const afterRequest = balance ? balance.remaining - Math.max(asked, 0) : null;
  // A type counted in days cannot be asked for beyond what is left. One whose
  // length depends on the case (Sick, Bereavement, Widowhood) has no count to
  // exceed, so nothing is flagged there. The figure here is a warning; the
  // server holds the balance and refuses the request itself, saying why.
  const exceeded = afterRequest !== null && afterRequest < 0;

  const canSave =
    draft.category &&
    draft.type &&
    draft.from &&
    draft.to &&
    draft.year &&
    draft.reason.trim() &&
    asked > 0;

  const colleagues = employeeRecords
    .filter((person) => person.name !== employee.name)
    .map((person) => person.name);

  // A request that exists has been submitted; the two approvals follow it.
  const done = {
    submit: Boolean(record),
    department: Boolean(record?.departmentDecision),
    management: record?.status === "Approved" || record?.status === "Rejected",
  };

  // The last stage answers the department rather than the employee, so it
  // reads back what the department said and closes the request either way.
  const finalising = stage === "management";
  const stageTitle = LEAVE_STAGES.find((step) => step.key === stage)?.title || "";

  const period =
    record && record.from && record.to
      ? shortDate(record.from) + " – " + shortDate(record.to)
      : "";

  return (
    <div className="space-y-6">
      <SheetHead
        icon={CalendarDays}
        title="Leave Request"
        intro={
          stage === "submit"
            ? "Submit a new leave request with the required details."
            : "Review the leave request and record the decision."
        }
        employee={employee}
        date={record?.requestedOn || todayIso()}
        requestNo={record?.leaveNo || nextLeaveNo(leaves)}
      />

        {/* Where the request stands. The first stage is the employee's; the
            two approvals are filled in by whoever gives them. */}
        <AdvanceSteps
          active={stage}
          onChange={onStage}
          steps={LEAVE_STAGES.map((step) => ({
            ...step,
            done: done[step.key],
            // Nothing can be reviewed until the request has been made.
            disabled: step.key !== "submit" && !record,
          }))}
        />

        {stage !== "submit" ? (
          <>
            {/* The stage being filled in, named above the fields that belong
                to it. */}
            <SheetCard title={stageTitle}>

            {/* What is being decided, read off the request rather than asked
                for again. */}
            <div className="form-grid">
              <Worked id="leave-review-no" label="Leave No." value={record?.leaveNo || ""} />
              <Worked id="leave-review-employee" label="Employee Name" value={employee.name} />
              <Worked id="leave-review-period" label="Leave Period" value={period} />
              <Worked
                id="leave-review-days"
                label="Number of Days"
                value={days(leaveDays(record?.from, record?.to))}
              />

              {/* The department reviews on behalf of a department; management
                  reviews what the department already answered. */}
              {finalising ? (
                <>
                  <Worked
                    id="leave-review-department-decision"
                    label="Department Decision"
                    value={decisionTaken(record?.departmentDecision)}
                  />
                  <Worked
                    id="leave-review-department-reviewer"
                    label="Department Reviewer"
                    value={record?.reviewedBy || ""}
                  />
                  <Worked
                    id="leave-review-by"
                    label="Approved By"
                    value={CURRENT_USER.name}
                  />
                </>
              ) : (
                <>
                  <Worked
                    id="leave-review-department"
                    label="Relevant Department"
                    value={employee.department || ""}
                  />
                  <Worked
                    id="leave-review-by"
                    label="Reviewed By"
                    value={CURRENT_USER.name}
                  />
                </>
              )}

              {/* Management's answer sits next to the department's, where the
                  two can be read together. */}
              {finalising && (
                <div className="space-y-2">
                  <FieldLabel htmlFor="leave-review-decision" required>
                    Management Decision
                  </FieldLabel>
                  <Select
                    value={draft.decision}
                    onValueChange={(value) => value && onChange("decision", value)}
                    disabled={!canReview}
                  >
                    <SelectTrigger id="leave-review-decision">
                      <SelectValue placeholder="Select decision" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAVE_DECISIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <FieldLabel htmlFor="leave-review-date" required>
                  {finalising ? "Decision Date" : "Review Date"}
                </FieldLabel>
                <DateField
                  id="leave-review-date"
                  value={draft.reviewDate}
                  onChange={(e) => onChange("reviewDate", e.target.value)}
                />
              </div>

              {!finalising && (
              <div className="space-y-2">
                <FieldLabel htmlFor="leave-review-decision" required>
                  Department Decision
                </FieldLabel>
                <Select
                  value={draft.decision}
                  onValueChange={(value) => value && onChange("decision", value)}
                  disabled={!canReview}
                >
                  <SelectTrigger id="leave-review-decision">
                    <SelectValue placeholder="Select decision" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_DECISIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}

              <div
                className={cn(
                  "space-y-2 sm:col-span-2",
                  finalising ? "lg:col-span-3" : "lg:col-span-4"
                )}
              >
                <FieldLabel htmlFor="leave-review-comments">
                  {finalising ? "Management Comments" : "Department Comments"}
                </FieldLabel>
                <Textarea
                  id="leave-review-comments"
                  rows={3}
                  maxLength={NOTES_LIMIT}
                  value={draft.comments}
                  onChange={(e) => onChange("comments", e.target.value)}
                  placeholder={
                    finalising
                      ? "Enter management comments on the leave request"
                      : "Enter the department's comments on the leave request"
                  }
                />
              </div>
            </div>
            </SheetCard>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <HistoryCard onClick={onHistory} />
              <div className="ms-auto flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="min-w-36" onClick={onCancel}>
                Cancel
              </Button>
              {canReview && (
                <Button
                  type="button"
                  className="min-w-48"
                  onClick={onDecide}
                  disabled={!draft.decision || !draft.reviewDate}
                >
                  {finalising
                    ? "Save & Finalize Decision"
                    : "Save & Submit Decision"}
                </Button>
              )}
              </div>
            </div>
          </>
        ) : (
        <>
        <SheetCard title="Leave Request Details">
        <div className="form-grid">
          {/* The year first: a balance belongs to a year, and asking for next
              year's days is what makes a request an advance. */}
          <div className="space-y-2">
            <FieldLabel htmlFor="leave-year" required>
              Year
            </FieldLabel>
            <Select
              value={draft.year}
              onValueChange={(value) => value && onChange("year", value)}
            >
              <SelectTrigger id="leave-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* An advance is annual leave by definition, so neither of these is
              a choice once next year is picked. */}
          <div className="space-y-2">
            <FieldLabel htmlFor="leave-category" required>
              Leave Category
            </FieldLabel>
            <Select
              value={draft.category}
              onValueChange={(value) => value && onCategory(value)}
              disabled={advance}
            >
              <SelectTrigger id="leave-category">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {ABSENCE_CATEGORIES.map((category) => (
                  <SelectItem key={category.name} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="leave-type" required>
              Leave Type
            </FieldLabel>
            <Select
              value={draft.type}
              onValueChange={(value) => value && onChange("type", value)}
              disabled={advance || !draft.category}
            >
              <SelectTrigger id="leave-type">
                <SelectValue
                  placeholder={
                    draft.category ? "Select Type" : "Select a category first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {typesIn(draft.category).map((type) => (
                  <SelectItem key={type.name} value={type.name}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Worked off the approved requests every time, never stored: a
              balance that disagrees with the leave behind it is worthless. */}
          <Worked
            id="leave-balance"
            label="Remaining Leave Balance"
            value={
              !balance
                ? ""
                : balance.expired
                  ? "Expired"
                  : days(balance.remaining) || "0 Days"
            }
          />

          <div className="space-y-2">
            <FieldLabel htmlFor="leave-from" required>
              From Date
            </FieldLabel>
            <DateField
              id="leave-from"
              value={draft.from}
              onChange={(e) => onChange("from", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="leave-to" required>
              To Date
            </FieldLabel>
            <DateField
              id="leave-to"
              min={draft.from || undefined}
              value={draft.to}
              onChange={(e) => onChange("to", e.target.value)}
            />
          </div>

          <Worked id="leave-days" label="Number of Days" value={days(asked)} />

          <div className="space-y-2">
            <FieldLabel htmlFor="leave-after">Balance After Request</FieldLabel>
            <Input
              id="leave-after"
              readOnly
              tabIndex={-1}
              value={
                afterRequest === null ? "" : days(Math.max(afterRequest, 0)) || "0 Days"
              }
              className={cn(
                "cursor-default text-muted-foreground",
                exceeded ? "border-destructive bg-destructive/5" : "bg-locked"
              )}
            />
            {/* Blocked, and said so where the figure went wrong - a request
                for more days than are left cannot be submitted. */}
            {exceeded && (
              <p
                role="alert"
                className="flex items-center gap-2 text-xs font-semibold text-destructive"
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
                Duration exceeded, please adjust your dates
              </p>
            )}
          </div>

          {/* Who covers the work. Not every absence needs one, so it is asked
              for but not required. */}
          <div className="space-y-2">
            <FieldLabel htmlFor="leave-replacement">
              Replacement Employee{" "}
              <span className="font-normal text-muted-foreground">(Optional)</span>
            </FieldLabel>
            <Select
              value={draft.replacement}
              onValueChange={(value) => value && onChange("replacement", value)}
            >
              <SelectTrigger id="leave-replacement">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {colleagues.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <FieldLabel htmlFor="leave-reason" required>
              Reason / Notes
            </FieldLabel>
            <Textarea
              id="leave-reason"
              rows={3}
              maxLength={NOTES_LIMIT}
              value={draft.reason}
              onChange={(e) => onChange("reason", e.target.value)}
              placeholder="Enter the reason for your leave request"
            />
          </div>
        </div>
        </SheetCard>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <HistoryCard onClick={onHistory} />
          <div className="ms-auto flex flex-wrap gap-3">
          {/* Plain buttons: this form sits inside the employee form. */}
          <Button type="button" variant="outline" className="min-w-36" onClick={onCancel}>
            Cancel
          </Button>
          {/* Submitting is what checks the form: the button is never
              disabled, so an incomplete request is refused here and the
              fields say which ones are missing. */}
          <Button
            type="button"
            className="min-w-48"
            onClick={() => {
              if (!checkRequired() || !canSave) return;
              onSubmit();
            }}
          >
            Submit Request
          </Button>
          </div>
        </div>
        </>
        )}
    </div>
  );
}
