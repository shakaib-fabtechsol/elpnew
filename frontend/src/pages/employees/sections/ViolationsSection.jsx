import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import AiSearch from "@/components/shared/AiSearch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UploadIcon from "@/components/shared/UploadIcon";
import { EmptyState } from "@/components/shared/panels";
import { RequestSteps } from "@/components/shared/RequestSteps";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
} from "@/components/shared/RecordTable";
import { FileCheck, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useViolations } from "@/lib/violations/context";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { formatDate } from "../loanData";
import { Rial } from "@/components/shared/Rial";
import {
  VIOLATION_STAGES,
  VIOLATION_TYPES,
  INVESTIGATION_RESULTS,
  PENALTY_TYPES,
  DEDUCTION_PENALTY,
  NO_PENALTY,
  APPEAL_OUTCOMES,
  VIOLATION_STATUS_TONE,
  stagesDone,
  nextStage,
  violationsFor,
} from "../violationData";
import { checkRequired } from "@/components/shared/formFields";

import DateField from "@/components/shared/DateField";
const DESCRIPTION_LIMIT = 1000;

const today = () => new Date().toISOString().slice(0, 10);

/** What every stage's fields start from, for a record not yet opened. */
const draftFrom = (record) => ({
  date: record?.date || today(),
  type: record?.type || "",
  description: record?.description || "",
  documentName: record?.documentName || "",
  investigationStart: record?.investigationStart || "",
  response: record?.response || "",
  responseDocument: record?.responseDocument || "",
  investigationResult: record?.investigationResult || "",
  penaltyType: record?.penaltyType || "",
  deductionAmount: record?.deductionAmount || "",
  decisionReasons: record?.decisionReasons || "",
  decisionDocument: record?.decisionDocument || "",
  penaltyDate: record?.penaltyDate || "",
  appealDate: record?.appealDate || today(),
  appealGrounds: record?.appealGrounds || "",
  appealDocument: record?.appealDocument || "",
  appealOutcome: record?.appealOutcome || "",
  outcomeReasons: record?.outcomeReasons || "",
  outcomeDate: record?.outcomeDate || today(),
});

/** A field's label. */
function FieldLabel({ htmlFor, children }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
    </Label>
  );
}

function Choice({ id, label, value, onChange, placeholder, options }) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id}>
        {label}
      </FieldLabel>
      <Select value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A fact already settled at an earlier stage: shown, never asked for again. */
function Settled({ id, label, value }) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        readOnly
        tabIndex={-1}
        value={value || ""}
        className="cursor-default bg-locked text-muted-foreground"
      />
    </div>
  );
}

function DateEntry({ id, label, required, value, onChange }) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id}>
        {label}
      </FieldLabel>
      <DateField
        required={required}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** A file picked for a stage: the name is shown, the file itself is sent. */
function FileField({ id, label, value, onChange }) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <label
        htmlFor={id}
        className={cn(
          "flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm",
          value ? "border-green-600 text-green-700" : "text-muted-foreground"
        )}
      >
        {value ? (
          <FileCheck className="h-4 w-4 shrink-0" />
        ) : (
          <UploadIcon className="h-4 w-4 shrink-0 text-primary" />
        )}
        <span className="truncate">{value || "Choose file to upload"}</span>
      </label>
      <Input
        id={id}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files[0] && onChange(e.target.files[0])}
      />
    </div>
  );
}

function LongText({ id, label, required, value, onChange, placeholder, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      <FieldLabel htmlFor={id}>
        {label}
      </FieldLabel>
      <Textarea
        required={required}
        id={id}
        rows={4}
        maxLength={DESCRIPTION_LIMIT}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/** "Attendance  /  16/09/2026" - the two halves of one fact. */
function Pair({ first, second }) {
  if (!first && !second) return <span className="text-muted-foreground">-</span>;
  return (
    <span>
      {first || "-"}
      <span className="px-1.5 text-muted-foreground">/</span>
      {second || "-"}
    </span>
  );
}

/**
 * The violations recorded against one employee, and the penalties that
 * followed.
 *
 * Recording and deciding a violation is the firm's to do, so the process is
 * opened from the Employees page; on My Profile the history is only read.
 */
export default function ViolationsSection({ employee, canEdit = true }) {
  const {
    violations,
    addViolation,
    acknowledgeViolation,
    respondToViolation,
    decideViolation,
    appealViolation,
    settleAppeal,
  } = useViolations();

  // The record being worked on: "new" while it is being added, then its id.
  const [openId, setOpenId] = useState(null);
  const [stage, setStage] = useState("violation");
  const [draft, setDraft] = useState(() => draftFrom(null));
  // The files picked at each stage, sent with it; the draft keeps their names.
  const [files, setFiles] = useState({});
  const [query, setQuery] = useState("");
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

  // The employee's own violations: theirs to read, answer and appeal, though
  // recording and deciding them stays with the firm.
  const own = employee?.id != null && employee.id === CURRENT_USER.employeeId;
  const canOpen = canEdit || own;

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));
  const pickFile = (name) => (file) => {
    set(name, file.name);
    setFiles((prev) => ({ ...prev, [name]: file }));
  };

  const record = typeof openId === "number" ? violations.find((v) => v.id === openId) : null;
  const done = stagesDone(record);

  const mine = violationsFor(violations, employee?.name);
  const search = query.trim().toLowerCase();
  const shown = search
    ? mine.filter((v) =>
        [v.violationNo, v.type, v.investigationStatus, v.investigator, v.penaltyType, v.approvedBy, v.status]
          .join(" ")
          .toLowerCase()
          .includes(search)
      )
    : mine;

  const openNew = () => {
    setOpenId("new");
    setStage("violation");
    setDraft(draftFrom(null));
    setFiles({});
  };

  /**
   * An existing violation opens at the first stage it has not been through.
   * The employee opening their own for the first time has read it, and the
   * firm is told so.
   */
  const openRecord = (violation) => {
    setOpenId(violation.id);
    setStage(nextStage(violation));
    setDraft(draftFrom(violation));
    setFiles({});
    if (own && !violation.acknowledgedAt) acknowledgeViolation(violation.id);
  };

  const close = () => {
    setOpenId(null);
    setStage("violation");
    setDraft(draftFrom(null));
    setFiles({});
  };

  /* ------------------------------------------------ each stage's save */

  const canStart = draft.date && draft.type && draft.description.trim() && draft.investigationStart;

  const saveViolation = async () => {
    if (!checkRequired() || !canStart) return;
    // Once recorded, a violation stands as it was written: the later stages
    // answer it rather than rewrite it.
    if (record) {
      setStage(nextStage(record));
      return;
    }
    // Saving the violation starts the investigation, and the case moves on
    // to the employee's side of it.
    const saved = await send(() => addViolation(employee.id, draft, files.documentName));
    if (!saved) return;
    setOpenId(saved.id);
    setStage("response");
  };

  const saveResponse = async () => {
    if (!record || !draft.response.trim()) return;
    const saved = await send(() => respondToViolation(record.id, draft, files.responseDocument));
    if (!saved) return;
    setStage("decision");
  };

  // A decision needs its result, the penalty, the day it takes effect and the
  // reasons behind it - and an amount where the penalty is a deduction.
  const noPenalty = draft.penaltyType === NO_PENALTY;
  const canDecide =
    draft.investigationResult &&
    draft.penaltyType &&
    draft.penaltyDate &&
    draft.decisionReasons.trim() &&
    (draft.penaltyType !== DEDUCTION_PENALTY || Number(draft.deductionAmount) > 0);

  const saveDecision = async () => {
    if (!record || !canDecide) return;
    // The penalty is issued here, which is when the server numbers the
    // violation - unless the decision was that no penalty follows, which
    // issues nothing.
    const saved = await send(() => decideViolation(record.id, draft, files.decisionDocument));
    if (!saved) return;
    if (noPenalty) close();
    else setStage("appeal");
  };

  const saveAppeal = async () => {
    if (!record || !draft.appealGrounds.trim() || !draft.appealDate) return;
    const saved = await send(() => appealViolation(record.id, draft, files.appealDocument));
    if (!saved) return;
    setStage("outcome");
  };

  const canApproveOutcome = Boolean(
    draft.appealOutcome && draft.outcomeDate && draft.outcomeReasons.trim()
  );

  const saveOutcome = async () => {
    if (!record || !canApproveOutcome) return;
    // Approving the outcome settles the case: the penalty either stands, is
    // modified, or is taken away - and the server sets the status from that.
    const saved = await send(() => settleAppeal(record.id, draft));
    if (!saved) return;
    close();
  };

  /* ------------------------------------------------ the stages */

  const stages = VIOLATION_STAGES.map((s) => ({
    ...s,
    done: done[s.key],
    // Nothing after the violation itself exists until it has been saved.
    disabled: s.key !== "violation" && !record,
  }));

  /**
   * The two buttons under a stage: the way back, and the way on.
   *
   * The first stage has nothing behind it, so its way back leaves the form;
   * every stage after it steps back to the one before.
   */
  // The employee answers and appeals; recording, deciding and settling are
  // the firm's, so on the employee's own page those stages are only read.
  const theirs = { response: true, appeal: true };
  const footer = (label, onSave, enabled, previous) => (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
      {/* Plain buttons: this form sits inside the employee form. */}
      <Button
        type="button"
        variant="outline"
        onClick={previous ? () => setStage(previous) : close}
      >
        {previous ? "Previous" : "Cancel"}
      </Button>
      {(canEdit || theirs[stage]) && (
        <Button type="button" onClick={onSave} disabled={!enabled}>
          {label}
        </Button>
      )}
    </div>
  );

  const stageBody = {
    violation: (
      <>
        <div className="form-grid">
          <div className="space-y-2">
            <FieldLabel htmlFor="violation-no">Violation No.</FieldLabel>
            <Input
              id="violation-no"
              readOnly
              tabIndex={-1}
              value={record?.violationNo || ""}
              placeholder="Generated automatically upon penalty approval"
              className="cursor-default bg-locked text-muted-foreground"
            />
          </div>
          <DateEntry id="violation-date" label="Violation Date" required value={draft.date} onChange={(v) => set("date", v)} />
          <Choice
            id="violation-type"
            label="Violation Type"
            required
            value={draft.type}
            onChange={(v) => set("type", v)}
            placeholder="Select violation type"
            options={VIOLATION_TYPES}
          />
          <FileField id="violation-document" label="Supporting Document" value={draft.documentName} onChange={pickFile("documentName")} />
          <LongText
            id="violation-description"
            label="Violation Description"
            required
            className="sm:col-span-2 lg:col-span-3"
            value={draft.description}
            onChange={(v) => set("description", v)}
            placeholder="Enter a detailed description of the violation"
          />
          <DateEntry
            id="violation-investigation-start"
            label="Investigation Start Date"
            required
            value={draft.investigationStart}
            onChange={(v) => set("investigationStart", v)}
          />
        </div>
        {footer(record ? "Save" : "Start Investigation", saveViolation, canStart)}
      </>
    ),

    response: (
      <>
        <div className="form-grid">
          <LongText
            id="violation-response"
            label="Employee Response"
            required
            className="sm:col-span-2 lg:col-span-3"
            value={draft.response}
            onChange={(v) => set("response", v)}
            placeholder="Enter the employee's response to the violation"
          />
          <FileField id="violation-response-document" label="Supporting Documents" value={draft.responseDocument} onChange={pickFile("responseDocument")} />
        </div>
        {footer("Save", saveResponse, Boolean(draft.response.trim()), "violation")}
      </>
    ),

    decision: (
      <>
        <div className="form-grid">
          <Choice
            id="violation-result"
            label="Investigation Result"
            required
            value={draft.investigationResult}
            onChange={(v) => set("investigationResult", v)}
            placeholder="Select result"
            options={INVESTIGATION_RESULTS}
          />
          <Choice
            id="violation-penalty"
            label="Penalty Type"
            required
            value={draft.penaltyType}
            onChange={(v) => set("penaltyType", v)}
            placeholder="Select penalty type"
            options={PENALTY_TYPES}
          />
          {/* Only a deduction has an amount to it. */}
          {draft.penaltyType === DEDUCTION_PENALTY && (
            <div className="space-y-2">
              <FieldLabel htmlFor="violation-deduction" required>
                Deduction Amount (<Rial />)
              </FieldLabel>
              <Input
                id="violation-deduction"
                inputMode="decimal"
                className="text-end"
                value={draft.deductionAmount}
                onChange={(e) => set("deductionAmount", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0.000"
              />
            </div>
          )}
          <DateEntry
            id="violation-effective-date"
            label="Effective Date"
            required
            value={draft.penaltyDate}
            onChange={(v) => set("penaltyDate", v)}
          />
          <LongText
            id="violation-reasons"
            label="Decision Reasons"
            required
            className="sm:col-span-2 lg:col-span-3"
            value={draft.decisionReasons}
            onChange={(v) => set("decisionReasons", v)}
            placeholder="Enter the reasons for the decision"
          />
          <FileField
            id="violation-decision-document"
            label="Decision Document"
            value={draft.decisionDocument}
            onChange={pickFile("decisionDocument")}
          />
        </div>
        {footer("Save & Send Decision", saveDecision, canDecide, "response")}
      </>
    ),

    appeal: (
      <>
        <div className="form-grid">
          {/* What is being appealed against, read off the decision rather than
              asked for again. */}
          <Settled id="violation-appeal-no" label="Violation No." value={record?.violationNo} />
          <Settled id="violation-appeal-penalty" label="Penalty Type" value={record?.penaltyType} />
          <Settled
            id="violation-appeal-decision-date"
            label="Decision Date"
            value={record?.penaltyDate && formatDate(record.penaltyDate)}
          />
          <DateEntry
            id="violation-appeal-date"
            label="Appeal Date"
            required
            value={draft.appealDate}
            onChange={(v) => set("appealDate", v)}
          />
          <LongText
            id="violation-appeal"
            label="Appeal Grounds"
            required
            className="sm:col-span-2 lg:col-span-3"
            value={draft.appealGrounds}
            onChange={(v) => set("appealGrounds", v)}
            placeholder="Enter the detailed grounds for appealing the decision"
          />
          <FileField
            id="violation-appeal-document"
            label="Supporting Documents"
            value={draft.appealDocument}
            onChange={pickFile("appealDocument")}
          />
        </div>
        {footer(
          "Save & Submit Appeal",
          saveAppeal,
          Boolean(draft.appealGrounds.trim() && draft.appealDate),
          "decision"
        )}
      </>
    ),

    outcome: (
      <>
        <div className="form-grid">
          {/* What is being answered, read off the appeal itself. */}
          <Settled id="violation-outcome-no" label="Violation No." value={record?.violationNo} />
          <Settled
            id="violation-outcome-appeal-date"
            label="Appeal Date"
            value={record?.appealDate && formatDate(record.appealDate)}
          />
          <Choice
            id="violation-outcome"
            label="Appeal Outcome"
            required
            value={draft.appealOutcome}
            onChange={(v) => set("appealOutcome", v)}
            placeholder="Select outcome"
            options={APPEAL_OUTCOMES}
          />
          <DateEntry
            id="violation-outcome-date"
            label="Outcome Date"
            required
            value={draft.outcomeDate}
            onChange={(v) => set("outcomeDate", v)}
          />
          <LongText
            id="violation-outcome-reasons"
            label="Reasons for Appeal Outcome"
            required
            className="sm:col-span-2 lg:col-span-3"
            value={draft.outcomeReasons}
            onChange={(v) => set("outcomeReasons", v)}
            placeholder="Enter the detailed reasons for the appeal outcome"
          />
          {/* Whoever approves it is whoever is signed in. */}
          <Settled
            id="violation-outcome-approver"
            label="Approved By"
            value={CURRENT_USER.name}
          />
        </div>
        {footer("Save & Approve Outcome", saveOutcome, canApproveOutcome, "appeal")}
      </>
    ),
  };

  return (
    <div className="space-y-6">
      {/* Opened over the page, so the list it is filed into stays behind it. */}
      <Dialog open={Boolean(openId)} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {record?.violationNo
                ? "Violation " + record.violationNo
                : "Add Violation or Penalty"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <RequestSteps
              compact
              active={stage}
              onChange={setStage}
              steps={stages}
            />
            {stageBody[stage]}
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {/* The search on the left, and the way to add on the right - the
              one row every list in the system has. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AiSearch value={query} onChange={setQuery} placeholder="Ask AI" />
            {canEdit && !openId && (
              <Button variant="outline" type="button" className="ms-auto" onClick={openNew}>
                <Plus className="me-2 h-4 w-4" />
                Add Violation
              </Button>
            )}
          </div>

          {shown.length === 0 ? (
            <EmptyState>
              {mine.length === 0
                ? "No violation has been recorded for this employee."
                : "No violation matches that search."}
            </EmptyState>
          ) : (
            <RecordTable minWidth={1040}>
              <HeadRow>
                <Th width="10%">Violation No.</Th>
                <Th width="19%">Violation Details</Th>
                <Th width="19%">Investigation</Th>
                <Th width="17%">Penalty Details</Th>
                <Th width="19%">Approval &amp; Notification</Th>
                <Th width="16%">Status</Th>
              </HeadRow>
              <tbody>
                {shown.map((violation) => {
                  const tone =
                    VIOLATION_STATUS_TONE[violation.status] ||
                    VIOLATION_STATUS_TONE["Under Investigation"];
                  return (
                    <Row key={violation.id}>
                      {/* The number opens the case at the stage it has reached. */}
                      <Td className="whitespace-nowrap">
                        {canOpen ? (
                          <button
                            type="button"
                            onClick={() => openRecord(violation)}
                            className="rounded font-bold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {violation.violationNo || "Pending"}
                          </button>
                        ) : (
                          <span className="font-bold text-primary">
                            {violation.violationNo || "Pending"}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <Pair first={violation.type} second={violation.date && formatDate(violation.date)} />
                      </Td>
                      <Td>
                        <Pair first={violation.investigationStatus} second={violation.investigator} />
                      </Td>
                      <Td>
                        <Pair first={violation.penaltyType} second={violation.penaltyDate && formatDate(violation.penaltyDate)} />
                      </Td>
                      <Td>
                        <Pair first={violation.approvedBy} second={violation.approvalDate && formatDate(violation.approvalDate)} />
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden="true" className={cn("h-3 w-3 shrink-0 rounded-full", tone.dot)} />
                          <span className={cn("whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", tone.chip)}>
                            {violation.status}
                          </span>
                        </span>
                      </Td>
                    </Row>
                  );
                })}
              </tbody>
            </RecordTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
