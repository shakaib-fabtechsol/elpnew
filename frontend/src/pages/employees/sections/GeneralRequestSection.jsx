import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RequestTable from "@/components/shared/RequestTable";
import RequestOverview from "@/components/shared/RequestOverview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdvanceSteps } from "./AdvanceSalarySection";
import {
  SheetHead,
  SheetCard,
  HistoryCard,
  UploadButton,
} from "@/components/shared/RequestSheet";
import {
  Row,
  Field,
  Locked,
  Counted,
  Decision,
  FieldError,
  useRequiredFields,
} from "@/components/shared/formFields";
import { RecordLink } from "@/components/shared/RecordTable";
import {
  FilePenLine,
  MessageCircleWarning,
  Paperclip,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  REQUEST_KINDS,
  COMMENT_LIMIT,
  DECISION_COMMENT_LIMIT,
  APPROVED,
  REJECTED,
  REQUEST_STATUS_TONE,
  initialGeneralRequests,
  requestsFor,
  nextRequestNo,
  shortDate,
  todayIso,
} from "../generalRequestData";
import { generalRequestsApi } from "@/lib/api/modules/generalRequests";
import { attempt } from "@/lib/api/notice";
import { upsert, upserted } from "@/lib/api/store";

const emptyDraft = { requestType: "", comment: "" };
const emptyDecision = { answer: "", comment: "" };


/** The mark at the head of each kind's sheet - the one its card carries. */
const KIND_ICON = {
  general: FilePenLine,
  grievance: MessageCircleWarning,
  complaint: TriangleAlert,
};

/**
 * An administrative request - a general one, a grievance or a complaint - and
 * what became of it.
 *
 * Two halves, like every other request in the system: the employee writes it,
 * and the administration answers. The second half cannot be opened until
 * there is a request to answer, and once answered the first half is only read
 * back - a decision taken on one request must not be able to end up filed
 * against a different one. The three kinds differ only in their name, their
 * numbering and what they can be about.
 *
 * Every button here says type="button": the section sits inside the employee
 * record's own form, and a plain button would submit the whole record.
 */
export default function GeneralRequestSection({
  employee,
  kind = "general",
  canDecide = true,
}) {
  const sort = REQUEST_KINDS[kind] || REQUEST_KINDS.general;
  const [requests, setRequests] = useState(initialGeneralRequests);
  const [draft, setDraft] = useState(emptyDraft);
  const [decision, setDecision] = useState(emptyDecision);
  const [document, setDocument] = useState(null);
  const [stage, setStage] = useState("request");
  // The request on the list the form is open on, if any.
  const [openId, setOpenId] = useState(null);
  // The form is a window over the list rather than the page itself: the list
  // is what this section is, and stays where it was behind the window.
  const [adding, setAdding] = useState(false);
  // What this employee has raised before, open over the request.
  const [showHistory, setShowHistory] = useState(false);
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
  /**
   * The record the server returned, in place of the one on screen - and in
   * the shared list too, so the request counts and the next visit see it.
   */
  const keep = (record) => {
    upsert(initialGeneralRequests, record);
    setRequests((prev) => upserted(prev, record));
  };

  const mine = requestsFor(requests, employee.name, kind).map((request, index) => ({
    ...request,
    no: index + 1,
    dateText: shortDate(request.date),
  }));
  const open = requests.find((request) => request.id === openId) || null;
  const settled = Boolean(open) && open.status !== "Pending";

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));
  const setAnswer = (name, value) =>
    setDecision((prev) => ({ ...prev, [name]: value }));

  const requestNo = open?.requestNo || nextRequestNo(requests, todayIso(), sort.prefix);
  const requestDate = open?.date || todayIso();
  const attachment = open ? open.document : document?.name || "";

  /**
   * The request's own required fields, and the decision's.
   *
   * Nothing here is marked in advance: the form says what is missing only
   * once somebody has tried to save it, and stops saying so the moment the
   * field is filled.
   */
  const asked = useRequiredFields({
    grType: draft.requestType,
    grComment: draft.comment,
  });

  /** Refusing and approving both have to say why, so both need a comment. */
  const answered = useRequiredFields({
    grAnswer: decision.answer,
    grRemarks: decision.comment,
  });

  /** Back to a blank request, with nothing carried over from the last one. */
  const clear = () => {
    asked.reset();
    answered.reset();
    setDraft(emptyDraft);
    setDecision(emptyDecision);
    setDocument(null);
    setOpenId(null);
    setStage("request");
    setShowHistory(false);
    setAdding(false);
  };

  /**
   * The request, on the list straight away under its own number and waiting
   * on the answer. The form moves on to that answer.
   */
  const submit = async () => {
    if (!asked.check()) return;
    // Numbered and dated by the server; a refusal leaves the form as it was.
    const saved = await send(() =>
      attempt(() => generalRequestsApi.submit(kind, draft, employee.id, document))
    );
    if (!saved) return;
    keep(saved);
    setOpenId(saved.id);
    setStage("decision");
  };

  /** The answer, against the request it was given on. */
  const decide = async () => {
    // Nobody answers their own request: on the employee's own page the
    // decision is read once it has been given, and never written.
    if (!open || settled || !canDecide || !answered.check()) return;
    const saved = await send(() => attempt(() => generalRequestsApi.decide(open.id, decision)));
    if (!saved) return;
    keep(saved);
    clear();
  };

  /** A request opened back off the list, to be read or answered. */
  const track = (request) => {
    setOpenId(request.id);
    setDraft({ requestType: request.requestType, comment: request.comment });
    setDecision({
      answer: request.status === "Pending" ? "" : request.status,
      comment: request.remarks || "",
    });
    setDocument(null);
    setStage("decision");
    setShowHistory(false);
    setAdding(true);
  };

  const refusing = decision.answer === REJECTED;

  const columns = [
    { key: "no", header: "#", width: "5%", render: (value) => <span className="font-medium text-primary">{value}</span> },
    {
      // The number is the way back into the request.
      key: "requestNo",
      header: "Request No.",
      width: "13%",
      render: (value, request) => <RecordLink onClick={() => track(request)}>{value}</RecordLink>,
    },
    { key: "requestType", header: sort.typeLabel, width: "15%" },
    {
      key: "comment",
      header: "Employee Comment",
      width: "21%",
      render: (value, request) => (
        <span className="inline-flex items-start gap-1.5">
          {request.document && (
            <Paperclip
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-label="Has a supporting document"
            />
          )}
          {value}
        </span>
      ),
    },
    {
      key: "dateText",
      header: "Request Date",
      width: "10%",
      render: (value) => <span className="whitespace-nowrap">{value}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      render: (value) => (
        <span
          className={cn(
            "inline-block whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold",
            REQUEST_STATUS_TONE[value]
          )}
        >
          {value}
        </span>
      ),
    },
    {
      // Blank until someone has decided.
      key: "remarks",
      header: "Management Comment",
      width: "14%",
      render: (value) => <span className="text-muted-foreground">{value || "-"}</span>,
    },
    {
      key: "reviewedBy",
      header: "Reviewed By",
      width: "12%",
      render: (value) => <span className="text-muted-foreground">{value || "-"}</span>,
    },
  ];

  const tableProps = {
    searchPlaceholder: "Search by request no., type or comment...",
    itemLabel: sort.noun + "s",
    exportFileName: sort.noun.replace(/ /g, "-") + "s.csv",
    filterBy: [
      { key: "status", label: "Status" },
      { key: "requestType", label: sort.typeLabel },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Opened over the page, so the list it is filed into stays behind it. */}
      <Dialog open={adding} onOpenChange={(o) => !o && clear()}>
        <DialogContent hideClose className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
        <div className="space-y-6">
          <SheetHead
            icon={KIND_ICON[kind] || FilePenLine}
            title={sort.title}
            intro={
              stage === "request"
                ? "Submit a new " + sort.noun + " with the required details and supporting documents."
                : "Review the " + sort.noun + " and record the management decision."
            }
            employee={employee}
            date={requestDate}
            requestNo={requestNo}
          />

          {/* The employee writes it; the administration answers. Either
              step opens its own half. */}
          <AdvanceSteps
            active={stage}
            onChange={setStage}
            steps={[
              {
                key: "request",
                title: "Submit Request",
                note: "Enter request details and supporting document",
                done: Boolean(open),
              },
              {
                key: "decision",
                title: "Management Decision",
                note: "Review and record the management decision",
                done: settled,
                // Nothing to decide until there is a request to decide on,
                // and never by the person who made it.
                disabled: !open || (!canDecide && !settled),
              },
            ]}
          />

          {stage === "request" && !open ? (
            <SheetCard title={sort.title + " Details"}>
              <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                {/* What it is about, with the paper that backs it beside it.
                    Each sits in a cell of its own - the form's fields bring
                    their twelve-column spans, which mean nothing here. */}
                <div>
                  <Field
                    id="grType"
                    label={sort.typeLabel}
                    required
                    error={asked.errorFor("grType")}
                  >
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <Select
                          value={draft.requestType}
                          onValueChange={(value) => value && set("requestType", value)}
                        >
                          <SelectTrigger id="grType">
                            <SelectValue placeholder={"Select " + sort.typeLabel.toLowerCase()} />
                          </SelectTrigger>
                          <SelectContent>
                            {sort.types.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <UploadButton file={document} onPick={setDocument} />
                    </div>
                  </Field>
                </div>
                <div>
                  <Field
                    id="grComment"
                    label="Employee Comment"
                    required
                    error={asked.errorFor("grComment")}
                  >
                    <Textarea
                      id="grComment"
                      maxLength={COMMENT_LIMIT}
                      value={draft.comment}
                      onChange={(e) => set("comment", e.target.value)}
                      placeholder={"Describe the " + sort.noun + "..."}
                    />
                    <p className="-mt-1 text-end text-xs text-muted-foreground">
                      {draft.comment.length}/{COMMENT_LIMIT}
                    </p>
                  </Field>
                </div>
              </div>
              {attachment && (
                <p className="flex items-center gap-1.5 text-sm text-primary">
                  <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {attachment}
                </p>
              )}
            </SheetCard>
          ) : (
            <>
              {/* What was raised, read back rather than asked for again. */}
              <SheetCard title={sort.title + " Details"}>
                <Row cols={3}>
                  <Locked
                    id="grType"
                    label={sort.typeLabel}
                    value={open?.requestType || draft.requestType}
                  />
                  <Field id="grCommentSaid" label="Employee Comment" span={6}>
                    <p className="rounded-md bg-locked px-3 py-2 text-sm text-muted-foreground">
                      {open?.comment || draft.comment || "-"}
                    </p>
                  </Field>
                </Row>
                {attachment && (
                  <p className="flex items-center gap-1.5 text-sm text-primary">
                    <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {attachment}
                  </p>
                )}
              </SheetCard>

              {/* A request already answered is read, not answered again: an
                  editable box that quietly refuses what is typed into it
                  reads as broken, so once decided it stops being a box. */}
              <SheetCard title="Management Decision">
                {settled ? (
                  <Row cols={3}>
                    <Locked
                      id="grAnswer"
                      label="Decision"
                      value={open.status}
                      highlight={open.status === APPROVED}
                    />
                    <Locked
                      id="grDecisionDate"
                      label="Decision Date"
                      value={shortDate(open.decisionDate)}
                    />
                    <Field
                      id="grRemarks"
                      label={
                        open.status === REJECTED
                          ? "Reason for Rejection"
                          : "Management Comment"
                      }
                    >
                      <p className="rounded-md bg-locked px-3 py-2 text-sm text-muted-foreground">
                        {open.remarks || "-"}
                      </p>
                    </Field>
                  </Row>
                ) : (
                  <>
                    <div>
                      <div
                        id="grAnswer"
                        role="radiogroup"
                        tabIndex={-1}
                        aria-label="Management decision"
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                      >
                        <Decision
                          value={APPROVED}
                          chosen={decision.answer}
                          onChoose={(v) => canDecide && setAnswer("answer", v)}
                          disabled={!canDecide}
                        />
                        <Decision
                          value={REJECTED}
                          chosen={decision.answer}
                          onChoose={(v) => canDecide && setAnswer("answer", v)}
                          disabled={!canDecide}
                          tone="bad"
                        />
                      </div>
                      {answered.errorFor("grAnswer") && (
                        <FieldError htmlFor="grAnswer">
                          {answered.errorFor("grAnswer")}
                        </FieldError>
                      )}
                    </div>

                    <Row cols={3}>
                      <Locked
                        id="grDecisionDate"
                        label="Decision Date"
                        value={shortDate(todayIso())}
                      />

                      {/* The rest of the row: this grid has twelve columns,
                          so the date's four leave eight. */}
                      <div className="col-span-12 lg:col-span-8">
                        <Field
                          id="grRemarks"
                          label={
                            refusing
                              ? "Reason for Rejection"
                              : "Management Comment"
                          }
                          required
                          error={answered.errorFor("grRemarks")}
                        >
                          <Counted
                            id="grRemarks"
                            limit={DECISION_COMMENT_LIMIT}
                            value={decision.comment}
                            onChange={(value) => setAnswer("comment", value)}
                            placeholder={
                              refusing
                                ? "Say why this request is refused"
                                : "Enter management comment"
                            }
                          />
                        </Field>
                      </div>
                    </Row>
                  </>
                )}
              </SheetCard>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <HistoryCard onClick={() => setShowHistory(true)} />
            <div className="ms-auto flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="min-w-36" onClick={clear}>
                Cancel
              </Button>

              {stage === "request" && !open ? (
                <Button type="button" className="min-w-48" onClick={submit}>
                  Submit Request
                </Button>
              ) : (
                /* The answer is given by the office, never by the person who
                   asked: on their own page there is nothing to press. */
                canDecide &&
                !settled && (
                  <Button
                    type="button"
                    className="min-w-48"
                    variant={refusing ? "destructive" : "default"}
                    onClick={decide}
                  >
                    {refusing ? "Confirm Rejection" : "Save"}
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

          {/* Everything this employee has raised of this kind, over the sheet. */}
          <Dialog open={showHistory} onOpenChange={setShowHistory}>
            <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {sort.title} History · {employee.name}
                </DialogTitle>
                <DialogDescription>
                  {"Every " + sort.noun + " this employee has raised."}
                </DialogDescription>
              </DialogHeader>
              <RequestTable rows={mine} columns={columns} {...tableProps} />
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {/* What has been raised, a reading of it, and the way to raise
              another - over the list itself. */}
          <RequestOverview
            icon={KIND_ICON[kind] || FilePenLine}
            title={sort.title}
            subtitle={"Raise a " + sort.noun + " and track its decision."}
            noun={sort.noun}
            newLabel={"New " + sort.title + (kind === "general" ? "" : " Request")}
            onNew={
              !adding
                ? () => {
                    clear();
                    setAdding(true);
                  }
                : null
            }
            typeLabel={sort.typeLabel}
            rows={mine.map((request) => ({
              id: request.id,
              no: request.requestNo,
              date: request.date,
              status: request.status,
              type: request.requestType,
              record: request,
            }))}
            onOpen={adding ? null : track}
            renderAll={() => <RequestTable rows={mine} columns={columns} {...tableProps} />}
          />
          <RequestTable rows={mine} columns={columns} {...tableProps} />
        </CardContent>
      </Card>
    </div>
  );
}
