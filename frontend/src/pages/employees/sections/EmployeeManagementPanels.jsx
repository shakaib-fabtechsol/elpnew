import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Loader } from "@/components/shared/Loader";
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
import DateField from "@/components/shared/DateField";
import { EmptyState } from "@/components/shared/panels";
import { RecordTable, HeadRow, Th, Row, Td } from "@/components/shared/RecordTable";
import { cn } from "@/lib/utils";
import { shortName } from "@/lib/shortName";
import { managementApi } from "@/lib/api/modules/management";
import { notify, notifyError } from "@/lib/api/notice";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { formatDate } from "../loanData";

/*
 * Employee Management beyond the day's log: where an employee stands, what
 * their records show, how their evaluations are moving, what is planned for
 * their development - and, across the firm, who is doing well and who needs
 * attention. Every figure is read off the records by the server; the AI
 * writes its insight from those figures and nothing else.
 */

const STANDING_TONE = {
  "High Performer": "border-green-200 bg-green-50 text-green-800",
  "On Track": "border-blue-200 bg-blue-50 text-primary",
  "Needs Attention": "border-red-200 bg-red-50 text-red-800",
  "Not Yet Evaluated": "border-container-border bg-muted text-muted-foreground",
};
const SIGNAL_TONE = {
  positive: "border-green-200 bg-green-50 text-green-800",
  attention: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-container-border bg-muted/40 text-primary",
};
const STATUS_TONE = {
  Planned: "bg-blue-50 text-primary",
  "In Progress": "bg-amber-50 text-amber-900",
  Completed: "bg-green-50 text-green-800",
  Cancelled: "bg-muted text-muted-foreground",
};

const canEditRecords = () => (CURRENT_USER.permissions?.granted || []).includes("employees.edit");
const stamp = (iso) => {
  if (!iso) return "";
  const at = new Date(iso);
  const two = (n) => String(n).padStart(2, "0");
  return two(at.getDate()) + "/" + two(at.getMonth() + 1) + "/" + at.getFullYear() + " " + two(at.getHours()) + ":" + two(at.getMinutes());
};

/** Loads the employee's management page once, and hands back how to replace it. */
function useManagement(employeeId) {
  const [page, setPage] = useState(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let cancelled = false;
    managementApi.load(employeeId).then(
      (data) => !cancelled && setPage(data),
      (error) => !cancelled && setFailed(error?.message || "This could not be loaded.")
    );
    return () => {
      cancelled = true;
    };
  }, [employeeId]);
  return { page, setPage, failed };
}

function Loading() {
  return (
    <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-primary">
      <Loader size={16} />
      Loading…
    </p>
  );
}

function Heading({ title, note, action }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        {note && <p className="text-sm text-primary/75">{note}</p>}
      </div>
      {action && <div className="ms-auto">{action}</div>}
    </div>
  );
}

function Standing({ value, className }) {
  return (
    <span className={cn("inline-block rounded-md border px-2.5 py-1 text-sm font-semibold", STANDING_TONE[value], className)}>
      {value}
    </span>
  );
}

function Figure({ label, value, note }) {
  return (
    <div className="rounded-lg border border-container-border p-4">
      <p className="text-xs text-primary/70">{label}</p>
      <p className="mt-1 text-xl font-bold text-primary">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function Trend({ value }) {
  if (value == null) return null;
  const Icon = value > 0.05 ? TrendingUp : value < -0.05 ? TrendingDown : Minus;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", value > 0.05 ? "text-green-700" : value < -0.05 ? "text-red-700" : "text-muted-foreground")}>
      <Icon className="size-3.5" aria-hidden="true" />
      {(value > 0 ? "+" : "") + value.toFixed(2)}
    </span>
  );
}

function Lines({ title, items, tone }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className={cn("text-sm font-semibold", tone)}>{title}</h4>
      <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-primary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ overview */

/** Where the employee stands, what the records show, and the AI's insight on it. */
export function ManagementOverview({ employee, onOpen }) {
  const { page, setPage, failed } = useManagement(employee.id);
  const [busy, setBusy] = useState("");
  if (failed) return <EmptyState>{failed}</EmptyState>;
  if (!page) return <Loading />;

  const { facts, insight } = page;
  const planned = new Set(page.development.map((one) => one.title.toLowerCase()));

  const write = async () => {
    setBusy("insight");
    try {
      setPage(await managementApi.writeInsight(employee.id));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  const plan = async (recommendation) => {
    setBusy(recommendation.title);
    try {
      setPage(await managementApi.addAction(employee.id, { ...recommendation, source: insight.engine !== "rules" ? "ai" : "manual" }));
      notify("Added to the development plan.", "success");
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-6">
      <Heading
        title="Overview"
        note="Read off this employee's evaluations, violations, leave and development plan"
        action={<Standing value={page.standing} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Last Evaluation"
          value={facts.lastScore != null ? facts.lastScore.toFixed(2) + " / 5" : "-"}
          note={facts.lastScore != null ? facts.lastRating + " · " + facts.lastPeriod : "None on record"}
        />
        <Figure label="Violations (12 Months)" value={facts.violations12m} note={facts.attendanceViolations12m ? facts.attendanceViolations12m + " about attendance" : "Upheld violations"} />
        <Figure label="Sick Leave (12 Months)" value={facts.sickDays12m + " days"} note={facts.sickLeaves12m + (facts.sickLeaves12m === 1 ? " sick leave taken" : " separate sick leaves")} />
        <Figure label="Development Actions" value={facts.openActions + " open"} note={facts.overdueActions ? facts.overdueActions + " overdue" : facts.completedActions12m + " completed this year"} />
      </div>

      <section className="space-y-3">
        <h3 className="text-base font-bold text-primary">What the Records Show</h3>
        {page.signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing stands out in the records.</p>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {page.signals.map((signal) => (
              <li key={signal.title + signal.detail} className={cn("rounded-lg border px-4 py-3 text-sm", SIGNAL_TONE[signal.level])}>
                <p className="font-semibold">
                  {signal.title}
                  <span className="ms-2 text-xs font-medium opacity-75">{signal.area}</span>
                </p>
                <p className="mt-0.5">{signal.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-container-border p-4 sm:p-5">
        <Heading
          title={
            <span className="flex items-center gap-2">
              <Sparkles className="size-5" aria-hidden="true" />
              AI Management Insight
            </span>
          }
          note={
            insight
              ? "Written " + stamp(insight.generatedAt) + " from the records above. It adds no facts of its own."
              : "An executive summary, the patterns in the records and what to do about them."
          }
          action={
            <Button type="button" variant={insight ? "outline" : "default"} onClick={write} disabled={Boolean(busy)}>
              {busy === "insight" ? (
                <Loader size={16} className="me-2" />
              ) : (
                <Sparkles className="me-2 size-4" aria-hidden="true" />
              )}
              {insight ? "Refresh Insight" : "Generate Insight"}
            </Button>
          }
        />

        {insight && (
          <div className="space-y-4">
            {insight.notes?.map((note) => (
              <p key={note} className="text-xs text-amber-800">
                {note}
              </p>
            ))}
            <p className="rounded-lg bg-blue-50/60 px-4 py-3 text-sm leading-relaxed text-primary">{insight.summary}</p>
            <div className="grid gap-4 lg:grid-cols-3">
              <Lines title="Achievements" tone="text-green-800" items={insight.achievements} />
              <Lines title="Concerns" tone="text-red-800" items={insight.concerns} />
              <Lines title="Patterns" tone="text-primary" items={insight.patterns} />
            </div>

            {insight.recommendations?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Recommended Actions</h4>
                <ul className="space-y-2">
                  {insight.recommendations.map((one) => {
                    const added = planned.has(one.title.toLowerCase());
                    return (
                      <li key={one.title} className="flex flex-wrap items-center gap-3 rounded-lg border border-container-border px-4 py-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-primary">
                            {one.title}
                            <span className="ms-2 text-xs font-medium text-primary/70">{one.kind}</span>
                          </p>
                          <p className="text-primary/80">{one.reason}</p>
                        </div>
                        {added ? (
                          <span className="text-xs font-semibold text-green-800">In the plan</span>
                        ) : (
                          canEditRecords() && (
                            <Button type="button" variant="outline" size="sm" onClick={() => plan(one)} disabled={Boolean(busy)}>
                              <Plus className="me-1.5 h-4 w-4" aria-hidden="true" />
                              Add to Plan
                            </Button>
                          )
                        )}
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() => onOpen?.("development")}
                  className="rounded text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Open the development plan
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* --------------------------------------------------------- evaluations */

const emptyEvaluation = (criteria) => ({
  period: "",
  periodStart: "",
  periodEnd: "",
  scores: Object.fromEntries(criteria.map((one) => [one.key, ""])),
  strengths: "",
  improvements: "",
  goals: "",
});

/** The periodic evaluations: each scored on the firm's criteria, and how the scores move. */
export function EvaluationsPanel({ employee }) {
  const { page, setPage, failed } = useManagement(employee.id);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  if (failed) return <EmptyState>{failed}</EmptyState>;
  if (!page) return <Loading />;

  const { criteria, evaluations } = page;
  const oldestFirst = [...evaluations].filter((one) => one.status === "Final").reverse();
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const scored = form && criteria.every((one) => form.scores[one.key] !== "");
  const ready = form && form.period.trim() && form.periodStart && form.periodEnd && scored;
  const average = scored ? criteria.reduce((sum, one) => sum + Number(form.scores[one.key]), 0) / criteria.length : null;

  const save = async () => {
    setBusy(true);
    try {
      setPage(
        await managementApi.saveEvaluation(employee.id, {
          ...form,
          scores: Object.fromEntries(Object.entries(form.scores).map(([key, value]) => [key, Number(value)])),
        })
      );
      setForm(null);
      setErrors({});
      notify("Evaluation recorded.", "success");
    } catch (error) {
      setErrors(Object.fromEntries(Object.entries(error?.errors || {}).map(([key, messages]) => [key, [].concat(messages)[0]])));
      if (!error?.errors?.period && !error?.errors?.periodEnd) notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Heading
        title="Performance Evaluations"
        note="Each period scored from 1 to 5 on the firm's criteria"
        action={
          canEditRecords() &&
          !form && (
            <Button type="button" variant="outline" onClick={() => setForm(emptyEvaluation(criteria))}>
              <Plus className="me-2 h-4 w-4" aria-hidden="true" />
              Add Evaluation
            </Button>
          )
        }
      />

      {form && (
        <div className="space-y-5 rounded-lg border border-container-border p-4">
          <div className="grid gap-x-4 gap-y-7 sm:grid-cols-3">
            <div className="form-field space-y-2">
              <Label htmlFor="eval-period">
                Period<span className="ms-0.5 text-destructive">*</span>
              </Label>
              <Input id="eval-period" value={form.period} maxLength={20} placeholder="2026 H1" onChange={(e) => set({ period: e.target.value })} aria-invalid={Boolean(errors.period) || undefined} />
              {errors.period && (
                <p role="alert" className="field-error">
                  {errors.period}
                </p>
              )}
            </div>
            <div className="form-field space-y-2">
              <Label htmlFor="eval-start">
                From<span className="ms-0.5 text-destructive">*</span>
              </Label>
              <DateField id="eval-start" value={form.periodStart} onChange={(e) => set({ periodStart: e.target.value })} />
            </div>
            <div className="form-field space-y-2">
              <Label htmlFor="eval-end">
                To<span className="ms-0.5 text-destructive">*</span>
              </Label>
              <DateField id="eval-end" value={form.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} />
              {errors.periodEnd && (
                <p role="alert" className="field-error">
                  {errors.periodEnd}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
            {criteria.map((one) => (
              <div key={one.key} className="form-field space-y-2">
                <Label htmlFor={"eval-" + one.key}>
                  {one.label}
                  <span className="ms-0.5 text-destructive">*</span>
                </Label>
                <Select value={String(form.scores[one.key])} onValueChange={(value) => set({ scores: { ...form.scores, [one.key]: value } })}>
                  <SelectTrigger id={"eval-" + one.key}>
                    <SelectValue placeholder="Score" />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 4, 3, 2, 1].map((score) => (
                      <SelectItem key={score} value={String(score)}>
                        {score + " - " + ["Unsatisfactory", "Needs Improvement", "Meets Expectations", "Exceeds Expectations", "Outstanding"][score - 1]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="rounded-lg border border-container-border p-3 text-sm text-primary">
              <p className="text-xs text-primary/70">Overall</p>
              <p className="text-xl font-bold">{average != null ? average.toFixed(2) + " / 5" : "-"}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              ["strengths", "Strengths"],
              ["improvements", "Areas to Improve"],
              ["goals", "Goals for Next Period"],
            ].map(([key, label]) => (
              <div key={key} className="form-field space-y-2">
                <Label htmlFor={"eval-" + key}>{label}</Label>
                <Textarea id={"eval-" + key} value={form[key]} maxLength={1000} onChange={(e) => set({ [key]: e.target.value })} />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={!ready || busy}>
              {busy && <Loader size={16} className="me-2" />}
              Save Evaluation
            </Button>
          </div>
        </div>
      )}

      {evaluations.length === 0 ? (
        !form && <EmptyState>No evaluation has been recorded for this employee yet.</EmptyState>
      ) : (
        <>
          {/* How the overall score has moved, one bar a period. */}
          {oldestFirst.length > 1 && (
            <div className="rounded-lg border border-container-border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                Overall Score by Period <Trend value={page.facts.scoreTrend} />
              </p>
              <ol className="mt-4 flex h-36 items-end gap-4" aria-label="Overall score by period">
                {oldestFirst.map((one) => (
                  <li key={one.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs font-semibold text-primary">{one.overall.toFixed(2)}</span>
                    <span aria-hidden="true" className="w-full max-w-16 rounded-t bg-primary" style={{ height: (one.overall / 5) * 100 + "%" }} />
                    <span className="truncate text-xs text-muted-foreground">{one.period}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <RecordTable minWidth={900}>
            <HeadRow>
              <Th>Period</Th>
              <Th>Overall</Th>
              <Th>Rating</Th>
              {criteria.map((one) => (
                <Th key={one.key} className="text-center">
                  {one.label}
                </Th>
              ))}
              <Th>Evaluator</Th>
            </HeadRow>
            <tbody>
              {evaluations.map((one) => (
                <Row key={one.id}>
                  <Td className="whitespace-nowrap font-medium text-primary">
                    {one.period}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatDate(one.periodStart)} – {formatDate(one.periodEnd)}
                    </span>
                  </Td>
                  <Td className="font-semibold text-primary">{one.overall.toFixed(2)}</Td>
                  <Td>{one.rating}</Td>
                  {criteria.map((criterion) => (
                    <Td key={criterion.key} className={cn("text-center", one.scores[criterion.key] <= 2 && "font-semibold text-red-700")}>
                      {one.scores[criterion.key] ?? "-"}
                    </Td>
                  ))}
                  <Td>{shortName(one.evaluator) || "-"}</Td>
                </Row>
              ))}
            </tbody>
          </RecordTable>

          {evaluations[0] && (evaluations[0].strengths || evaluations[0].improvements || evaluations[0].goals) && (
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                ["Strengths", evaluations[0].strengths],
                ["Areas to Improve", evaluations[0].improvements],
                ["Goals for Next Period", evaluations[0].goals],
              ].map(([label, words]) => (
                <div key={label} className="rounded-lg border border-container-border p-4 text-sm">
                  <p className="text-xs text-primary/70">
                    {label} · {evaluations[0].period}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-primary">{words || "-"}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------- development plan */

/** Training, coaching, corrective actions and recognition: planned, followed up, closed. */
export function DevelopmentPlan({ employee }) {
  const { page, setPage, failed } = useManagement(employee.id);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  if (failed) return <EmptyState>{failed}</EmptyState>;
  if (!page) return <Loading />;

  const editable = canEditRecords();
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const run = async (call, done) => {
    setBusy(true);
    try {
      setPage(await call());
      if (done) notify(done, "success");
      return true;
    } catch (error) {
      notifyError(error);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Heading
        title="Development Plan"
        note="What is being done for this employee's development, and how each action ended"
        action={
          editable &&
          !form && (
            <Button type="button" variant="outline" onClick={() => setForm({ title: "", kind: "", reason: "", dueOn: "" })}>
              <Plus className="me-2 h-4 w-4" aria-hidden="true" />
              Add Action
            </Button>
          )
        }
      />

      {form && (
        <div className="space-y-5 rounded-lg border border-container-border p-4">
          <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
            <div className="form-field space-y-2 lg:col-span-2">
              <Label htmlFor="action-title">
                Action<span className="ms-0.5 text-destructive">*</span>
              </Label>
              <Input id="action-title" value={form.title} maxLength={160} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="form-field space-y-2">
              <Label htmlFor="action-kind">
                Type<span className="ms-0.5 text-destructive">*</span>
              </Label>
              <Select value={form.kind} onValueChange={(kind) => set({ kind })}>
                <SelectTrigger id="action-kind">
                  <SelectValue placeholder="Please Select" />
                </SelectTrigger>
                <SelectContent>
                  {page.actionKinds.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="form-field space-y-2">
              <Label htmlFor="action-due">Due Date</Label>
              <DateField id="action-due" value={form.dueOn} onChange={(e) => set({ dueOn: e.target.value })} />
            </div>
          </div>
          <div className="form-field space-y-2">
            <Label htmlFor="action-reason">Reason</Label>
            <Textarea id="action-reason" value={form.reason} maxLength={500} onChange={(e) => set({ reason: e.target.value })} />
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!form.title.trim() || !form.kind || busy}
              onClick={async () => {
                const ok = await run(
                  () => managementApi.addAction(employee.id, { ...form, dueOn: form.dueOn || null, reason: form.reason || null }),
                  "Added to the development plan."
                );
                if (ok) setForm(null);
              }}
            >
              {busy && <Loader size={16} className="me-2" />}
              Save Action
            </Button>
          </div>
        </div>
      )}

      {page.development.length === 0 ? (
        !form && <EmptyState>Nothing is planned yet. The AI insight on the overview recommends where to start.</EmptyState>
      ) : (
        <RecordTable minWidth={900}>
          <HeadRow>
            <Th width="28%">Action</Th>
            <Th>Type</Th>
            <Th width="26%">Reason</Th>
            <Th>Due Date</Th>
            <Th>Source</Th>
            <Th width="16%">Status</Th>
          </HeadRow>
          <tbody>
            {page.development.map((one) => (
              <Row key={one.id}>
                <Td className="font-medium text-primary">{one.title}</Td>
                <Td>{one.kind}</Td>
                <Td>{one.reason || "-"}</Td>
                <Td className={cn("whitespace-nowrap", one.overdue && "font-semibold text-red-700")}>
                  {one.dueOn ? formatDate(one.dueOn) : "-"}
                  {one.overdue && <span className="block text-xs">Overdue</span>}
                </Td>
                <Td>{one.source === "ai" ? "AI recommendation" : shortName(one.createdBy) || "Management"}</Td>
                <Td>
                  {editable ? (
                    <Select
                      value={one.status}
                      onValueChange={(status) => status !== one.status && run(() => managementApi.updateAction(employee.id, one.id, { status }), "Status updated.")}
                      disabled={busy}
                    >
                      <SelectTrigger aria-label={"Status of " + one.title}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {page.actionStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", STATUS_TONE[one.status])}>{one.status}</span>
                  )}
                </Td>
              </Row>
            ))}
          </tbody>
        </RecordTable>
      )}
    </div>
  );
}

/* -------------------------------------------------------- team insights */

/** Across the firm: who to recognise, and who needs a manager's attention. */
export function TeamInsights({ employee }) {
  const [team, setTeam] = useState(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let cancelled = false;
    managementApi.standing().then(
      (data) => !cancelled && setTeam(data),
      (error) => !cancelled && setFailed(error?.message || "This could not be loaded.")
    );
    return () => {
      cancelled = true;
    };
  }, []);
  if (failed) return <EmptyState>{failed}</EmptyState>;
  if (!team) return <Loading />;

  const list = (title, note, rows, empty) => (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-primary">{title}</h3>
        <p className="text-sm text-primary/75">{note}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <RecordTable minWidth={760}>
          <HeadRow>
            <Th width="26%">Employee</Th>
            <Th>Department</Th>
            <Th>Last Score</Th>
            <Th>Violations (12 Months)</Th>
            <Th width="34%">Why</Th>
          </HeadRow>
          <tbody>
            {rows.map((one) => (
              <Row key={one.id} className={one.id === employee.id ? "bg-blue-50/60" : undefined}>
                <Td>
                  <Link to={"/employees/" + one.id} state={{ section: "management" }} className="font-semibold text-primary">
                    {one.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {one.empNo} · {one.occupation || "-"}
                  </span>
                </Td>
                <Td>{one.department || "-"}</Td>
                <Td>
                  {one.lastScore != null ? one.lastScore.toFixed(2) : "-"} <Trend value={one.scoreTrend} />
                </Td>
                <Td>{one.violations12m}</Td>
                <Td>{one.reasons.join(" · ") || "-"}</Td>
              </Row>
            ))}
          </tbody>
        </RecordTable>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <Heading title="Team Insights" note={"Every active employee your access reaches (" + team.total + "), by what their records show"} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["High Performer", "On Track", "Needs Attention", "Not Yet Evaluated"].map((standing) => (
          <div key={standing} className={cn("rounded-lg border p-4", STANDING_TONE[standing])}>
            <p className="text-xs font-medium opacity-80">{standing}</p>
            <p className="mt-1 text-2xl font-bold">{team.counts[standing] || 0}</p>
          </div>
        ))}
      </div>
      {list("Employees Requiring Attention", "A weak or falling evaluation, recurring violations or an attendance pattern", team.needsAttention, "Nobody needs attention on what is recorded.")}
      {list("High Performers", "A strong last evaluation and a clean record: recognise and retain", team.highPerformers, "No employee has an evaluation of 4.2 or above with a clean record yet.")}
    </div>
  );
}
