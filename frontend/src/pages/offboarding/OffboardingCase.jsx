import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BackButton from "@/components/shared/BackButton";
import DateField from "@/components/shared/DateField";
import { CardLoader } from "@/components/shared/Loader";
import { LoadError } from "@/components/shared/TableStates";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Briefcase,
  CalendarClock,
  Car,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  IdCard,
  KeyRound,
  Laptop,
  LogOut,
  MessageSquareText,
  MinusCircle,
  Package,
  RotateCcw,
  ShieldOff,
  Smartphone,
  Undo2,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can } from "@/lib/access";
import { money } from "@/lib/money";
import { formatDate } from "@/lib/circulars/context";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { offboardingApi, REASONS_BY_TYPE } from "@/lib/api/modules/offboarding";
import { employeeAssetsApi } from "@/lib/api/modules/employeeAssets";
import { OffboardingStatus, StageTracker } from "./offboardingParts";

/**
 * One End of Service case, from notice to the day the person leaves.
 *
 * Read top to bottom the way the case is worked: where it stands (the
 * stages), what still stops it closing, the assets to see back, the
 * checklist each owner works through, and - beside them - the settlement,
 * the exit interview and what completing it will do to the person's access.
 */

const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const ASSET_ICON = {
  Car: Car,
  "Computer / Laptop": Laptop,
  "Mobile Phone": Smartphone,
  "Work ID Card": IdCard,
};

const CATEGORY_ICON = {
  handover: Briefcase,
  access: KeyRound,
  finance: Wallet,
  hr: ClipboardCheck,
};

/** Where the case stands, step by step. */
function stagesOf(c) {
  const closed = c.status === "Completed";
  const stopped = c.status === "Rejected" || c.status === "Cancelled";
  const approved = c.status === "In Progress" || closed;
  const workTasks = c.tasks.filter((t) => t.category !== "finance" && t.required);
  const financeTasks = c.tasks.filter((t) => t.category === "finance" && t.required);
  const cleared = (list) => list.every((t) => t.status !== "Pending");
  const clearanceDone = closed || (approved && c.assetsOutstanding === 0 && cleared(workTasks));
  const settlementDone = closed || (approved && cleared(financeTasks));
  const noticeDone = closed || (approved && c.noticeDaysRemaining === 0);
  const state = (done, current) => (done ? "done" : current ? "current" : "upcoming");

  return [
    { key: "initiation", label: "Initiated", note: c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB") : "", state: "done" },
    {
      key: "approval",
      label: "Approval",
      note: c.status === "Rejected" ? "Rejected" : c.decidedBy ? "By " + c.decidedBy.split(" ")[0] : "",
      state: c.status === "Rejected" ? "failed" : state(approved, c.status === "Pending Approval"),
    },
    {
      key: "notice",
      label: "Notice Period",
      note: approved && !closed ? (c.noticeDaysRemaining ? c.noticeDaysRemaining + " days left" : "Ended") : "",
      state: stopped ? "upcoming" : state(noticeDone, approved && !noticeDone),
    },
    {
      key: "clearance",
      label: "Clearance",
      note: approved && !closed ? c.assetsOutstanding + " assets out" : "",
      state: stopped ? "upcoming" : state(clearanceDone, approved && !clearanceDone),
    },
    {
      key: "settlement",
      label: "Final Settlement",
      state: stopped ? "upcoming" : state(settlementDone, approved && clearanceDone && !settlementDone),
    },
    {
      key: "interview",
      label: "Exit Interview",
      note: "Optional",
      state: stopped ? "upcoming" : state(Boolean(c.exitInterview) || closed, approved && clearanceDone && settlementDone && !c.exitInterview),
    },
    {
      key: "completed",
      label: c.status === "Cancelled" ? "Cancelled" : "Completed",
      state: c.status === "Cancelled" ? "failed" : state(closed, false),
    },
  ];
}

/** A titled white box. */
function Box({ icon: Icon, title, note, action, children, className }) {
  return (
    <section className={cn("rounded-xl border border-container-border bg-card", className)}>
      <header className="flex flex-wrap items-start gap-3 border-b border-container-border px-5 py-4">
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-primary">{title}</h2>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-primary">{children || "-"}</p>
    </div>
  );
}

const TASK_LOOK = {
  Pending: { icon: CircleDashed, ink: "text-slate-400" },
  Done: { icon: CheckCircle2, ink: "text-emerald-600" },
  "Not Applicable": { icon: MinusCircle, ink: "text-slate-500" },
};

export default function OffboardingCase() {
  const { id } = useParams();
  const [c, setCase] = useState(null);
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The one small form open over the page, if any.
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    setState((was) => (was === "ready" ? "ready" : "loading"));
    try {
      setCase(await offboardingApi.get(id));
      setState("ready");
    } catch {
      setState("failed");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Runs one change against the server and shows the case it returns. */
  const act = async (run) => {
    setBusy(true);
    setError("");
    try {
      const next = await run();
      if (next && next.caseNo) setCase(next);
      else await load();
      setDialog(null);
      return true;
    } catch (e) {
      const list = Object.values(e.errors || {}).flat();
      setError(list.length ? list.join(" ") : e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return <CardLoader label="Loading the case" className="py-24" />;
  if (state === "failed" || !c)
    return (
      <div className="space-y-4">
        <BackButton fallback="/offboarding" />
        <LoadError label="offboarding case" onRetry={load} />
      </div>
    );

  const own = CURRENT_USER.employeeId === c.employeeId;
  const open = c.status === "Pending Approval" || c.status === "In Progress";
  const mayEdit = can("offboarding.edit") && !own && open;
  const mayApprove = can("offboarding.approve") && !own;
  const working = c.status === "In Progress" && mayEdit;
  const ready = c.status === "In Progress" && c.blockers.length === 0;
  const settlement = c.settlementEstimate || c.settlement;

  const groups = Object.entries(
    c.tasks.reduce((all, task) => {
      (all[task.category] ||= { label: task.categoryLabel, tasks: [] }).tasks.push(task);
      return all;
    }, {})
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Head: whose case, what kind, where it stands, and what can be done now. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <BackButton fallback="/offboarding" />
          <div className="rounded-xl bg-[#0b2447] p-2.5 text-white">
            <LogOut className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              <Link to="/offboarding" className="hover:text-primary">
                Employee Offboarding
              </Link>{" "}
              / {c.caseNo}
            </p>
            <h1 className="flex flex-wrap items-center gap-3 text-xl font-bold text-primary sm:text-2xl">
              {c.employee?.name}
              <OffboardingStatus status={c.status} />
            </h1>
            <p className="text-sm text-primary/75">
              {c.type} · {c.initiatedByParty === "Employee" ? "Employee-initiated" : "Company-initiated"}
              {c.reason && " · " + c.reason}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {open && (mayEdit || (own && c.status === "Pending Approval")) && (
            <Button type="button" variant="cancel" onClick={() => setDialog({ kind: "cancel" })}>
              <Ban className="size-4" aria-hidden="true" />
              Cancel Case
            </Button>
          )}
          {c.status === "Pending Approval" && mayApprove && (
            <>
              <Button type="button" variant="cancel" onClick={() => setDialog({ kind: "reject" })}>
                <XCircle className="size-4" aria-hidden="true" />
                Reject
              </Button>
              <Button type="button" disabled={busy} onClick={() => act(() => offboardingApi.decide(c.id, "approve"))}>
                <BadgeCheck className="size-4" aria-hidden="true" />
                Approve
              </Button>
            </>
          )}
          {c.status === "In Progress" && mayApprove && (
            <Button type="button" disabled={busy} onClick={() => setDialog({ kind: "complete" })}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Complete Offboarding
            </Button>
          )}
        </div>
      </div>

      {error && !dialog && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="rounded-xl border border-container-border bg-card px-4 py-5 sm:px-6">
        <StageTracker steps={stagesOf(c)} />
      </div>

      {/* The facts of the case. */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-container-border bg-card p-5 md:grid-cols-3 xl:grid-cols-6">
        <Fact label="Employee">
          <Link to={"/employees/" + c.employeeId} className="text-record-link hover:opacity-80">
            {c.employee?.empNo} · {c.employee?.shortName}
          </Link>
        </Fact>
        <Fact label="Department">{c.employee?.department}</Fact>
        <Fact label="Notice date">{formatDate(c.noticeDate)}</Fact>
        <Fact label="Notice">
          {c.noticeDays} days · {c.noticeMode}
        </Fact>
        <Fact label="Last working day">
          {formatDate(c.lastWorkingDate)}
          {c.status === "In Progress" && (
            <span className="block text-xs font-medium text-muted-foreground">
              {c.noticeDaysRemaining ? c.noticeDaysRemaining + " days remaining" : "Notice period ended"}
            </span>
          )}
        </Fact>
        <Fact label="Initiated by">{c.initiatedBy}</Fact>
        {c.details && (
          <div className="col-span-full">
            <p className="text-xs font-medium text-muted-foreground">Details</p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-primary">{c.details}</p>
          </div>
        )}
        {c.decisionComment && (
          <div className="col-span-full">
            <p className="text-xs font-medium text-muted-foreground">
              {c.status === "Cancelled" ? "Why it was cancelled" : "Decision comment"}
            </p>
            <p className="mt-0.5 text-sm text-primary">{c.decisionComment}</p>
          </div>
        )}
      </div>

      {/* What still stands between the case and completion. */}
      {c.status === "In Progress" &&
        (ready ? (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            Clearance is complete. The case can be completed: the employee will be set Inactive and their access revoked.
          </p>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              Before this case can be completed
            </p>
            <ul className="mt-1 list-disc space-y-0.5 ps-10">
              {c.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      {c.status === "Completed" && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          Completed {c.completedAt ? "on " + new Date(c.completedAt).toLocaleDateString("en-GB") : ""}
          {c.completedBy && " by " + c.completedBy}. The employee is Inactive and their access has been revoked.
        </p>
      )}

      <div className="grid items-start gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          {/* Assets: read off the register, returned from here. */}
          <Box
            icon={Package}
            title="Company Assets"
            note="From the Assigned Assets register. Every item must be returned or written off before completion."
            action={
              <span
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold",
                  c.assetsOutstanding ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                )}
              >
                {c.assetsOutstanding ? c.assetsOutstanding + " outstanding" : "All returned"}
              </span>
            }
          >
            {c.assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assets have been issued to this employee.</p>
            ) : (
              <ul className="divide-y divide-container-border">
                {c.assets.map((asset) => {
                  const Icon = ASSET_ICON[asset.type] || Package;
                  const out = asset.status === "Assigned";
                  return (
                    <li key={asset.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className={cn("flex size-10 items-center justify-center rounded-lg", out ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500")}>
                        <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary">
                          {asset.type} <span className="font-normal text-muted-foreground">· {asset.assetNumber}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[asset.makeModel, asset.serialNumber && "S/N " + asset.serialNumber, "Issued " + formatDate(asset.issueDate)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {out ? (
                        working && can("employeeAssets.edit") ? (
                          <div className="flex gap-2">
                            <Button type="button" size="sm" variant="cancel" onClick={() => setDialog({ kind: "dispose", asset })}>
                              Write Off
                            </Button>
                            <Button type="button" size="sm" onClick={() => setDialog({ kind: "return", asset })}>
                              <Undo2 className="size-3.5" aria-hidden="true" />
                              Mark Returned
                            </Button>
                          </div>
                        ) : (
                          <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Assigned</span>
                        )
                      ) : (
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {asset.status} {formatDate(asset.returnDate || asset.disposalDate)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Box>

          {/* The checklist, owner by owner. */}
          {groups.map(([category, group]) => {
            const Icon = CATEGORY_ICON[category] || ClipboardCheck;
            const left = group.tasks.filter((t) => t.status === "Pending").length;
            return (
              <Box
                key={category}
                icon={Icon}
                title={group.label}
                action={
                  <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", left ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700")}>
                    {group.tasks.length - left} / {group.tasks.length} cleared
                  </span>
                }
              >
                <ul className="divide-y divide-container-border">
                  {group.tasks.map((task) => {
                    const look = TASK_LOOK[task.status];
                    return (
                      <li key={task.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <look.icon className={cn("mt-0.5 size-5 shrink-0", look.ink)} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-medium text-primary", task.status === "Not Applicable" && "line-through decoration-slate-400")}>
                            {task.title}
                            {!task.required && <span className="ms-2 text-xs font-normal text-muted-foreground">(optional)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Owner: {task.owner}
                            {task.status !== "Pending" && task.completedByName &&
                              " · " + (task.status === "Done" ? "Done" : "Set aside") + " by " + task.completedByName}
                            {task.notes && " · " + task.notes}
                          </p>
                        </div>
                        {working && (
                          <div className="flex shrink-0 gap-2">
                            {task.status === "Pending" ? (
                              <>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setDialog({ kind: "na", task })}>
                                  N/A
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="add"
                                  disabled={busy}
                                  onClick={() => act(() => offboardingApi.setTask(c.id, task.id, "Done"))}
                                >
                                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                  Mark Done
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => act(() => offboardingApi.setTask(c.id, task.id, "Pending"))}
                              >
                                <RotateCcw className="size-3.5" aria-hidden="true" />
                                Reopen
                              </Button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Box>
            );
          })}
        </div>

        <div className="space-y-4 sm:space-y-6">
          {/* The money: worked out from the record, frozen at completion. */}
          <Box
            icon={Wallet}
            title="Final Settlement"
            note={c.status === "Completed" ? "As calculated at completion" : "Estimate - confirmed by Finance"}
          >
            {!settlement ? (
              <p className="text-sm text-muted-foreground">Pay figures are visible to those with payroll access.</p>
            ) : (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Service</dt>
                  <dd className="font-medium text-primary">{settlement.serviceYears} years</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Basic salary</dt>
                  <dd className="font-medium text-primary">{money(settlement.basicSalary)}</dd>
                </div>
                <div className="my-2 border-t border-container-border" />
                <div className="flex justify-between gap-3">
                  <dt className="text-primary">End-of-service gratuity</dt>
                  <dd className="font-semibold text-primary">{money(settlement.gratuity)}</dd>
                </div>
                <p className="text-xs text-muted-foreground">{settlement.gratuityNote}</p>
                <div className="flex justify-between gap-3">
                  <dt className="text-primary">
                    Notice pay
                    {settlement.noticeDaysUnserved > 0 && c.noticeMode === "Paid in lieu" && (
                      <span className="text-xs text-muted-foreground"> ({settlement.noticeDaysUnserved} days)</span>
                    )}
                  </dt>
                  <dd className="font-semibold text-primary">{money(settlement.noticePay)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-primary">
                    Leave encashment <span className="text-xs text-muted-foreground">({settlement.leaveDays} days)</span>
                  </dt>
                  <dd className="font-semibold text-primary">{money(settlement.leaveEncashment)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-primary">Less: loans & advances owed</dt>
                  <dd className="font-semibold text-red-700">- {money(settlement.deductions)}</dd>
                </div>
                {[...settlement.loans, ...settlement.advances].map((d) => (
                  <p key={d.requestNo} className="flex justify-between text-xs text-muted-foreground">
                    <span>{d.requestNo}</span>
                    <span>{money(d.amount)}</span>
                  </p>
                ))}
                <div className="mt-2 flex justify-between gap-3 rounded-lg bg-[#0b2447] px-3 py-2.5 text-white">
                  <dt className="font-semibold">Net settlement</dt>
                  <dd className="font-bold">{money(settlement.net)}</dd>
                </div>
              </dl>
            )}
          </Box>

          {/* Optional, but asked of every leaver where it can be. */}
          <Box
            icon={MessageSquareText}
            title="Exit Interview"
            note="Optional - why people leave, and whether they would come back"
            action={
              mayEdit && (
                <Button type="button" size="sm" variant="add" onClick={() => setDialog({ kind: "interview" })}>
                  {c.exitInterview ? "Edit" : "Record"}
                </Button>
              )
            }
          >
            {c.exitInterview ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Fact label="Date">{formatDate(c.exitInterview.date)}</Fact>
                <Fact label="Main reason">{c.exitInterview.primaryReason}</Fact>
                <Fact label="Satisfaction">{c.exitInterview.satisfaction} / 5</Fact>
                <Fact label="Would recommend">{c.exitInterview.wouldRecommend ? "Yes" : "No"}</Fact>
                <Fact label="Eligible for rehire">{c.exitInterview.eligibleForRehire ? "Yes" : "No"}</Fact>
                <Fact label="Conducted by">{c.exitInterview.conductedBy}</Fact>
                {c.exitInterview.comments && (
                  <div className="col-span-2 text-sm text-primary">{c.exitInterview.comments}</div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Not recorded yet.</p>
            )}
          </Box>

          {/* What completing does to the person's access. */}
          <Box icon={ShieldOff} title="System Access" note="Revoked automatically when the case is completed">
            <ul className="space-y-2 text-sm text-primary">
              {[
                c.hasLogin ? "SADEED sign-in blocked (the account is kept for the record)" : "No SADEED login account",
                "Signed out of every device",
                "Delegated and temporary access ended",
                "Saved permissions cleared",
                "Employee record set Inactive with the last working day and reason",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  {c.status === "Completed" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  )}
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Email, court portals and building access are on the IT & System Access checklist.
            </p>
          </Box>
        </div>
      </div>

      <CaseDialogs
        dialog={dialog}
        onClose={() => {
          setDialog(null);
          setError("");
        }}
        busy={busy}
        error={error}
        c={c}
        act={act}
      />
    </div>
  );
}

/** The small forms that open over the case. */
function CaseDialogs({ dialog, onClose, busy, error, c, act }) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(todayIso());
  const [interview, setInterview] = useState({});
  const [shownFor, setShownFor] = useState(null);

  // Each dialog opens fresh.
  if (dialog !== shownFor) {
    setShownFor(dialog);
    setText("");
    setDate(todayIso());
    setInterview(
      c.exitInterview || {
        date: todayIso(),
        primaryReason: c.reason || "",
        satisfaction: "3",
        wouldRecommend: "true",
        eligibleForRehire: "true",
        comments: "",
      }
    );
  }

  if (!dialog) return null;
  const kind = dialog.kind;
  const titles = {
    reject: ["Reject Offboarding", "Say why the case is rejected. The employee stays Active."],
    cancel: ["Cancel Case", "Say why the case is cancelled. It stays on record as Cancelled."],
    na: ["Mark Not Applicable", dialog.task?.title],
    return: ["Mark Asset Returned", dialog.asset && dialog.asset.type + " · " + dialog.asset.assetNumber],
    dispose: ["Write Off Asset", dialog.asset && dialog.asset.type + " · " + dialog.asset.assetNumber + " - lost, damaged or kept by agreement"],
    interview: ["Exit Interview", "Recorded against the case. Optional, but recommended for every leaver."],
    complete: [
      "Complete Offboarding",
      "This sets " + (c.employee?.name || "the employee") + " Inactive from " + formatDate(c.lastWorkingDate) + " and revokes their access to SADEED. It cannot be undone here.",
    ],
  };
  const [title, description] = titles[kind];

  const save = () => {
    if (kind === "reject") return act(() => offboardingApi.decide(c.id, "reject", text));
    if (kind === "cancel") return act(() => offboardingApi.cancel(c.id, text));
    if (kind === "na") return act(() => offboardingApi.setTask(c.id, dialog.task.id, "Not Applicable", text));
    if (kind === "return")
      return act(async () => {
        await employeeAssetsApi.markReturned(c.employeeId, dialog.asset.id, date, text);
        return null;
      });
    if (kind === "dispose")
      return act(async () => {
        await employeeAssetsApi.markDisposed(c.employeeId, dialog.asset.id, date, text);
        return null;
      });
    if (kind === "interview")
      return act(() =>
        offboardingApi.interview(c.id, {
          ...interview,
          satisfaction: Number(interview.satisfaction),
          wouldRecommend: String(interview.wouldRecommend) === "true",
          eligibleForRehire: String(interview.eligibleForRehire) === "true",
        })
      );
    if (kind === "complete") return act(() => offboardingApi.complete(c.id));
    return null;
  };

  const setI = (key, value) => setInterview((prev) => ({ ...prev, [key]: value }));
  const reasons = [...new Set([...(REASONS_BY_TYPE[c.type] || []), "Compensation", "Management", "Work-life balance"])];

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {(kind === "return" || kind === "dispose") && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="asset-date">{kind === "return" ? "Return date" : "Write-off date"}</Label>
              <DateField id="asset-date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-notes">Condition / notes</Label>
              <Textarea id="asset-notes" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
          </div>
        )}

        {(kind === "reject" || kind === "cancel" || kind === "na") && (
          <div className="space-y-2">
            <Label htmlFor="case-text">{kind === "na" ? "Why it does not apply" : "Reason"}</Label>
            <Textarea id="case-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        )}

        {kind === "interview" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ei-date">Date</Label>
              <DateField id="ei-date" value={interview.date} onChange={(e) => setI("date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei-reason">Main reason for leaving</Label>
              <Select value={interview.primaryReason} onValueChange={(v) => setI("primaryReason", v)}>
                <SelectTrigger id="ei-reason">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei-sat">Overall satisfaction (1-5)</Label>
              <Input id="ei-sat" type="number" min={1} max={5} value={interview.satisfaction} onChange={(e) => setI("satisfaction", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei-rec">Would recommend the firm</Label>
              <Select value={String(interview.wouldRecommend)} onValueChange={(v) => setI("wouldRecommend", v)}>
                <SelectTrigger id="ei-rec">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei-rehire">Eligible for rehire</Label>
              <Select value={String(interview.eligibleForRehire)} onValueChange={(v) => setI("eligibleForRehire", v)}>
                <SelectTrigger id="ei-rehire">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ei-comments">Comments</Label>
              <Textarea id="ei-comments" rows={3} value={interview.comments || ""} onChange={(e) => setI("comments", e.target.value)} />
            </div>
          </div>
        )}

        {kind === "complete" && (
          <ul className="space-y-1.5 rounded-lg border border-container-border bg-secondary/50 p-3 text-sm text-primary">
            <li className="flex gap-2">
              <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Status Inactive · last working day {formatDate(c.lastWorkingDate)} · {c.decisionMaker}
            </li>
            <li className="flex gap-2">
              <ShieldOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Sign-in blocked, every device signed out, permissions cleared
            </li>
          </ul>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="cancel" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant={kind === "reject" || kind === "cancel" ? "destructive" : "default"}
            disabled={busy}
            onClick={save}
          >
            {kind === "complete" ? "Complete Offboarding" : kind === "reject" ? "Reject" : kind === "cancel" ? "Cancel Case" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
