import { useEffect, useMemo, useState } from "react";
import { Clock, History, KeyRound, Loader2, Plus, ShieldAlert, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { permissionsApi } from "@/lib/api/modules/permissions";
import { notify, notifyError } from "@/lib/api/notice";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";
import { employeeRecords } from "../employeeData";
import { formatDate } from "../loanData";

const LEVEL_TONE = {
  high: "border-red-200 bg-red-50 text-red-800",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  low: "border-container-border bg-muted/40 text-primary",
};
const LEVEL_LABEL = { high: "High", medium: "Medium", low: "Low" };
const STATE_TONE = {
  Active: "bg-green-50 text-green-800",
  Scheduled: "bg-blue-50 text-primary",
  Expired: "bg-muted text-muted-foreground",
  Revoked: "bg-red-50 text-red-800",
};

const today = () => {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
};
const addDays = (iso, days) => {
  const date = new Date(iso + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
};
const stamp = (iso) => {
  if (!iso) return "";
  const at = new Date(iso);
  const two = (n) => String(n).padStart(2, "0");
  return two(at.getDate()) + "/" + two(at.getMonth() + 1) + "/" + at.getFullYear() + " " + two(at.getHours()) + ":" + two(at.getMinutes());
};
const draftOf = (settings) => ({
  template: settings.template,
  grants: settings.grants,
  scope: settings.scope,
  departments: settings.departments || [],
  approvalLimit: settings.approvalLimit ?? "",
  paymentLimit: settings.paymentLimit ?? "",
});
const sameDraft = (a, b) => JSON.stringify({ ...a, grants: [...a.grants].sort() }) === JSON.stringify({ ...b, grants: [...b.grants].sort() });
const amountOnly = (value) => value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

/**
 * What one employee may see and do in SADEED.
 *
 * The page is a draft until it is saved: a starting point for the job is
 * chosen and adjusted, record access and financial authority are set, and
 * the access review says what in the result deserves a second look. Access
 * needed only for a time is given below with an end date, and everything
 * that was ever changed is in the history.
 *
 * The assistant takes an instruction in plain words and proposes the change.
 * It never saves: what it proposes is put into the draft to be checked.
 */
export default function SystemPermissionsSection({ employee }) {
  const employeeId = employee?.id;
  const [page, setPage] = useState(null);
  const [failed, setFailed] = useState("");
  const [draft, setDraft] = useState(null);
  const [risks, setRisks] = useState([]);
  const [busy, setBusy] = useState(""); // "saving" | "asking" | "delegating" | "revoking"

  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState(null);
  const [lending, setLending] = useState(null); // the temporary-access form, when open
  // The login account: what is being typed to create one, and the password
  // just made - shown once, here, and nowhere afterwards.
  const [account, setAccount] = useState({ email: "", role: "" });
  const [password, setPassword] = useState("");

  const take = (data) => {
    setPage(data);
    setDraft(draftOf(data.settings));
    setRisks(data.risks);
  };

  useEffect(() => {
    let cancelled = false;
    permissionsApi.load(employeeId).then(
      (data) => !cancelled && take(data),
      (error) => !cancelled && setFailed(error?.message || "The permissions could not be loaded.")
    );
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const saved = useMemo(() => (page ? draftOf(page.settings) : null), [page]);
  const dirty = Boolean(draft && saved && !sameDraft(draft, saved));
  const own = CURRENT_USER.employeeId === employeeId;
  const canEdit = !own && (CURRENT_USER.permissions?.granted || []).includes("permissions.edit");
  const locked = !canEdit || Boolean(busy);

  // The review follows the draft, a moment behind the last change.
  const draftKey = draft ? JSON.stringify(draft) : "";
  useEffect(() => {
    if (!draft || !dirty) {
      if (page) setRisks(page.risks);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      permissionsApi.review(employeeId, draft).then(
        (next) => !cancelled && setRisks(next),
        () => {}
      );
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, dirty]);

  if (failed) return <EmptyState>{failed}</EmptyState>;
  if (!page || !draft) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-primary">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading permissions…
      </p>
    );
  }

  const held = new Set(draft.grants);
  const delegated = new Set(page.delegated);
  const change = (patch) => setDraft((prev) => ({ ...prev, ...patch }));
  const setKeys = (keys, on) => {
    const next = new Set(draft.grants);
    keys.forEach((key) => (on ? next.add(key) : next.delete(key)));
    change({ grants: [...next] });
  };
  const applyTemplate = (value) => {
    const template = page.templates.find((one) => one.value === value);
    if (template) change({ template: value, grants: template.grants, scope: template.scope, departments: [] });
  };

  const save = async () => {
    setBusy("saving");
    try {
      take(await permissionsApi.save(employeeId, draft));
      notify("Permissions saved.", "success");
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  const ask = async (words) => {
    setBusy("asking");
    setProposal(null);
    try {
      setProposal(await permissionsApi.assist(employeeId, draft, words));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  /** Puts what the assistant proposed into the draft, to be checked and saved. */
  const applyProposal = () => {
    const next = new Set(draft.grants);
    proposal.grant.forEach((key) => next.add(key));
    proposal.revoke.forEach((key) => next.delete(key));
    change({
      grants: [...next],
      ...(proposal.scope ? { scope: proposal.scope } : {}),
      ...(proposal.departments ? { departments: proposal.departments } : {}),
      ...(proposal.setLimits.includes("approvalLimit") ? { approvalLimit: proposal.approvalLimit ?? "" } : {}),
      ...(proposal.setLimits.includes("paymentLimit") ? { paymentLimit: proposal.paymentLimit ?? "" } : {}),
    });
    setProposal(null);
    setInstruction("");
  };

  /** Access meant for a time goes below with an end date, not into the draft. */
  const lendProposal = () => {
    setLending({ permissions: proposal.grant, fromEmployeeId: "", startsOn: today(), endsOn: addDays(today(), proposal.temporaryDays - 1), reason: instruction.trim() });
    setProposal(null);
  };

  const lend = async () => {
    setBusy("delegating");
    try {
      take(await permissionsApi.delegate(employeeId, lending));
      setLending(null);
      setInstruction("");
      notify("Temporary access granted.", "success");
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  /** Creates the account, changes its role or resets its password. */
  const onAccount = async (call, done) => {
    setBusy("account");
    setPassword("");
    try {
      const data = await call();
      take(data);
      if (data.temporaryPassword) setPassword(data.temporaryPassword);
      notify(done, "success");
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  const revoke = async (id) => {
    setBusy("revoking");
    try {
      take(await permissionsApi.revoke(employeeId, id));
      notify("Temporary access revoked.", "success");
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy("");
    }
  };

  const actionKeys = Object.keys(page.actions);
  const labelOf = (key) => {
    const [moduleKey, action] = key.split(".");
    const found = page.catalog.flatMap((group) => group.modules).find((one) => one.key === moduleKey);
    return (found?.label || moduleKey) + ": " + (page.actions[action] || action);
  };
  const proposes =
    proposal &&
    (proposal.grant.length || proposal.revoke.length || proposal.scope || proposal.departments || proposal.setLimits.length);

  return (
    <div className="space-y-6">
      {page.fullAccess && (
        <Banner icon={ShieldCheck}>
          This is a management account. It has full access to the system whatever is selected below, so that the firm
          can never be locked out of its own settings.
        </Banner>
      )}
      {own && <Banner icon={ShieldAlert}>Nobody sets their own permissions. Another administrator changes these for you.</Banner>}

      {/* ------------------------------------------------- login account */}
      <Panel
        title="Login Account"
        icon={KeyRound}
        note={
          page.hasAccount
            ? "How this employee signs in. Their permissions apply to this account."
            : "This employee cannot sign in yet. The permissions below take effect once an account is created."
        }
      >
        {page.hasAccount ? (
          <div className="grid items-end gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
            <div className="form-field space-y-2">
              <Label htmlFor="account-email">Sign-In Email</Label>
              <Input id="account-email" value={page.account.email} readOnly disabled />
            </div>
            <div className="form-field space-y-2">
              <Label htmlFor="account-role">Account Role</Label>
              <Select
                value={page.account.role}
                onValueChange={(role) => role !== page.account.role && onAccount(() => permissionsApi.changeRole(employeeId, role), "Account role changed.")}
                disabled={locked}
              >
                <SelectTrigger id="account-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {page.roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canEdit && (
              <div>
                <Button type="button" variant="outline" onClick={() => onAccount(() => permissionsApi.resetPassword(employeeId), "Password reset.")} disabled={Boolean(busy)}>
                  {busy === "account" && <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />}
                  Reset Password
                </Button>
              </div>
            )}
          </div>
        ) : canEdit ? (
          <div className="grid items-end gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
            <div className="form-field space-y-2 lg:col-span-2">
              <Label htmlFor="account-email">
                Sign-In Email<span className="ms-0.5 text-destructive">*</span>
              </Label>
              <Input
                id="account-email"
                type="email"
                value={account.email || (account.touched ? "" : page.suggestedEmail || "")}
                maxLength={255}
                onChange={(e) => setAccount((prev) => ({ ...prev, email: e.target.value, touched: true }))}
                disabled={Boolean(busy)}
              />
            </div>
            <div className="form-field space-y-2">
              <Label htmlFor="account-role">
                Account Role<span className="ms-0.5 text-destructive">*</span>
              </Label>
              <Select value={account.role} onValueChange={(role) => setAccount((prev) => ({ ...prev, role }))} disabled={Boolean(busy)}>
                <SelectTrigger id="account-role">
                  <SelectValue placeholder="Please Select" />
                </SelectTrigger>
                <SelectContent>
                  {page.roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={!account.role || !(account.email || (!account.touched && page.suggestedEmail)) || Boolean(busy)}
                onClick={() =>
                  onAccount(
                    () => permissionsApi.createAccount(employeeId, { email: (account.email || page.suggestedEmail || "").trim(), role: account.role }),
                    "Login account created."
                  )
                }
              >
                {busy === "account" ? <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" /> : <Plus className="me-2 h-4 w-4" aria-hidden="true" />}
                Create Account
              </Button>
            </div>
          </div>
        ) : null}

        {password && (
          <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            <p className="font-semibold">
              Temporary password: <span className="select-all font-mono text-base">{password}</span>
            </p>
            <p className="mt-0.5">It is shown this once and cannot be read again. Give it to the employee; a new one can be made with Reset Password.</p>
          </div>
        )}
      </Panel>

      {/* ------------------------------------------------ access profile */}
      <Panel title="Access Profile" note="Where this employee starts from, how far their access reaches and how much they may sign off">
        <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          <div className="form-field space-y-2">
            <Label htmlFor="perm-template">Starting Point</Label>
            <Select value={draft.template} onValueChange={applyTemplate} disabled={locked}>
              <SelectTrigger id="perm-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {page.templates.map((template) => (
                  <SelectItem key={template.value} value={template.value}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="form-field space-y-2">
            <Label htmlFor="perm-scope">Record Access</Label>
            <Select value={draft.scope} onValueChange={(scope) => change({ scope })} disabled={locked}>
              <SelectTrigger id="perm-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {page.scopes.map((scope) => (
                  <SelectItem key={scope.value} value={scope.value}>
                    {scope.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="form-field space-y-2">
            <Label htmlFor="perm-approval">Approval Limit (OMR)</Label>
            <Input
              id="perm-approval"
              inputMode="decimal"
              placeholder="No limit"
              value={draft.approvalLimit}
              onChange={(e) => change({ approvalLimit: amountOnly(e.target.value) })}
              disabled={locked}
            />
          </div>
          <div className="form-field space-y-2">
            <Label htmlFor="perm-payment">Payment Limit (OMR)</Label>
            <Input
              id="perm-payment"
              inputMode="decimal"
              placeholder="No limit"
              value={draft.paymentLimit}
              onChange={(e) => change({ paymentLimit: amountOnly(e.target.value) })}
              disabled={locked}
            />
          </div>
        </div>

        {draft.scope === "department" && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-primary">Departments</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {page.departmentOptions.map((department) => (
                <label key={department} className="flex items-center gap-2 text-sm text-primary">
                  <Checkbox
                    checked={draft.departments.includes(department)}
                    onCheckedChange={(on) =>
                      change({
                        departments: on
                          ? [...draft.departments, department]
                          : draft.departments.filter((one) => one !== department),
                      })
                    }
                    disabled={locked}
                  />
                  {department}
                </label>
              ))}
            </div>
            {!draft.departments.length && (
              <p role="alert" className="text-xs text-destructive">
                Choose at least one department.
              </p>
            )}
          </fieldset>
        )}
      </Panel>

      {/* -------------------------------------------------- AI assistant */}
      {canEdit && (
        <Panel
          title="AI Permission Assistant"
          icon={Sparkles}
          note="Say what this employee should be able to do. The change is proposed for you to check - nothing is saved until you save it."
        >
          <div className="flex flex-wrap gap-3">
            <Input
              id="perm-instruction"
              aria-label="Instruction for the assistant"
              className="min-w-0 flex-1"
              value={instruction}
              maxLength={1000}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && instruction.trim()) {
                  e.preventDefault();
                  ask(instruction.trim());
                }
              }}
              placeholder='For example: "let her approve leave for her department" or "read-only access to payroll for 2 weeks"'
              disabled={Boolean(busy)}
            />
            <Button type="button" onClick={() => ask(instruction.trim())} disabled={!instruction.trim() || Boolean(busy)}>
              {busy === "asking" ? (
                <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="me-2 size-4" aria-hidden="true" />
              )}
              Ask AI
            </Button>
            <Button type="button" variant="outline" onClick={() => ask("")} disabled={Boolean(busy)}>
              Recommend for This Job
            </Button>
          </div>

          {proposal && (
            <div className="space-y-3 rounded-lg border border-container-border bg-muted/40 p-4 text-sm text-primary">
              {proposal.explanation && <p>{proposal.explanation}</p>}
              {proposal.notes.map((note) => (
                <p key={note} className="text-xs text-amber-800">
                  {note}
                </p>
              ))}
              <Changes title="Add" tone="text-green-800" items={proposal.grantLabels} />
              <Changes title="Remove" tone="text-red-800" items={proposal.revokeLabels} />
              {proposal.scope && (
                <p>
                  <span className="font-semibold">Record access: </span>
                  {page.scopes.find((scope) => scope.value === proposal.scope)?.label}
                  {proposal.departments ? " (" + proposal.departments.join(", ") + ")" : ""}
                </p>
              )}
              {proposal.setLimits.map((key) => (
                <p key={key}>
                  <span className="font-semibold">{key === "approvalLimit" ? "Approval limit: " : "Payment limit: "}</span>
                  {proposal[key] == null ? "No limit" : Number(proposal[key]).toFixed(3) + " OMR"}
                </p>
              ))}
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setProposal(null)}>
                  Dismiss
                </Button>
                {proposal.temporaryDays && proposal.grant.length > 0 && (
                  <Button type="button" variant="outline" onClick={lendProposal}>
                    <Clock className="me-2 size-4" aria-hidden="true" />
                    Give for {proposal.temporaryDays} Days
                  </Button>
                )}
                {proposes && (
                  <Button type="button" onClick={applyProposal}>
                    Apply to Draft
                  </Button>
                )}
              </div>
            </div>
          )}
        </Panel>
      )}

      {/* ------------------------------------------------- access review */}
      <Panel title="Access Review" icon={ShieldAlert} note="What in these permissions deserves a second look">
        {risks.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-green-800">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Nothing stands out. Duties are separated and access matches the starting point.
          </p>
        ) : (
          <ul className="space-y-2">
            {risks.map((risk) => (
              <li key={risk.title} className={cn("rounded-lg border px-4 py-3 text-sm", LEVEL_TONE[risk.level])}>
                <p className="font-semibold">
                  {risk.title}
                  <span className="ms-2 text-xs font-medium opacity-80">{LEVEL_LABEL[risk.level]}</span>
                </p>
                <p className="mt-0.5">{risk.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ------------------------------------------------ the permissions */}
      {page.catalog.map((group) => {
        const groupKeys = group.modules.flatMap((one) => one.actions.map((action) => one.key + "." + action));
        const allOn = groupKeys.every((key) => held.has(key));
        return (
          <Panel
            key={group.key}
            title={group.label}
            note={group.note}
            action={
              canEdit && (
                <Button type="button" variant="outline" size="sm" onClick={() => setKeys(groupKeys, !allOn)} disabled={locked}>
                  {allOn ? "Clear All" : "Select All"}
                </Button>
              )
            }
          >
            <RecordTable minWidth={860}>
              <HeadRow>
                <Th width="34%">Module</Th>
                {actionKeys.map((action) => (
                  <Th key={action} className="text-center">
                    {page.actions[action]}
                  </Th>
                ))}
              </HeadRow>
              <tbody>
                {group.modules.map((one) => (
                  <Row key={one.key}>
                    <Td>
                      <p className="font-medium text-primary">{one.label}</p>
                      <p className="text-xs text-muted-foreground">{one.note}</p>
                    </Td>
                    {actionKeys.map((action) => {
                      const key = one.key + "." + action;
                      if (!one.actions.includes(action)) {
                        return (
                          <Td key={action} className="text-center text-muted-foreground">
                            <span aria-hidden="true">–</span>
                          </Td>
                        );
                      }
                      return (
                        <Td key={action} className="text-center">
                          <span className="inline-flex items-center gap-1">
                            <Checkbox
                              aria-label={one.label + ": " + page.actions[action]}
                              checked={held.has(key)}
                              onCheckedChange={(on) => setKeys([key], Boolean(on))}
                              disabled={locked}
                            />
                            {delegated.has(key) && !held.has(key) && (
                              <Clock className="size-3.5 text-amber-700" aria-label="Held temporarily" />
                            )}
                          </span>
                        </Td>
                      );
                    })}
                  </Row>
                ))}
              </tbody>
            </RecordTable>
          </Panel>
        );
      })}

      {canEdit && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-lg border border-container-border bg-card px-4 py-3">
          <p className="me-auto text-sm text-primary/75">{dirty ? "You have unsaved changes." : "All changes are saved."}</p>
          <Button type="button" variant="outline" onClick={() => setDraft(saved)} disabled={!dirty || Boolean(busy)}>
            Discard
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={(!dirty && page.settings.custom) || Boolean(busy) || (draft.scope === "department" && !draft.departments.length)}
          >
            {busy === "saving" && <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />}
            Save Permissions
          </Button>
        </div>
      )}

      {/* ---------------------------------- temporary & delegated access */}
      <Panel
        title="Temporary & Delegated Access"
        icon={Clock}
        note="Access held for a time: covering for a colleague, a project, an audit. It ends on its date by itself."
        action={
          canEdit &&
          !lending && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLending({ permissions: [], fromEmployeeId: "", startsOn: today(), endsOn: addDays(today(), 13), reason: "" })}
              disabled={Boolean(busy)}
            >
              <Plus className="me-2 h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          )
        }
      >
        {lending && (
          <LendForm
            page={page}
            value={lending}
            onChange={setLending}
            onCancel={() => setLending(null)}
            onSave={lend}
            busy={busy === "delegating"}
            labelOf={labelOf}
            employeeId={employeeId}
          />
        )}

        {page.delegations.length === 0 ? (
          !lending && <EmptyState>No temporary or delegated access.</EmptyState>
        ) : (
          <RecordTable minWidth={900}>
            <HeadRow>
              <Th width="30%">Permissions</Th>
              <Th>From</Th>
              <Th>Period</Th>
              <Th width="22%">Reason</Th>
              <Th>Status</Th>
              <Th className="text-end">Action</Th>
            </HeadRow>
            <tbody>
              {page.delegations.map((one) => (
                <Row key={one.id}>
                  <Td>{one.labels.join(", ")}</Td>
                  <Td>{one.from ? one.from.name : "Management"}</Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(one.startsOn)} – {formatDate(one.endsOn)}
                  </Td>
                  <Td>{one.reason}</Td>
                  <Td>
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", STATE_TONE[one.state])}>{one.state}</span>
                  </Td>
                  <Td className="text-end">
                    {canEdit && (one.state === "Active" || one.state === "Scheduled") ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => revoke(one.id)} disabled={Boolean(busy)}>
                        Revoke
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </Td>
                </Row>
              ))}
            </tbody>
          </RecordTable>
        )}
      </Panel>

      {/* ------------------------------------------------------- history */}
      <Panel title="Permission History" icon={History} note="Every change to this employee's access, who made it and when">
        {page.history.length === 0 ? (
          <EmptyState>No changes yet. The permissions are those of the starting point.</EmptyState>
        ) : (
          <RecordTable minWidth={860}>
            <HeadRow>
              <Th width="16%">Date</Th>
              <Th width="34%">Change</Th>
              <Th>Details</Th>
              <Th width="16%">Changed By</Th>
            </HeadRow>
            <tbody>
              {page.history.map((event) => (
                <Row key={event.id}>
                  <Td className="whitespace-nowrap">{stamp(event.at)}</Td>
                  <Td>{event.summary}</Td>
                  <Td>
                    {event.granted.length > 0 && <p className="text-green-800">+ {event.granted.join(", ")}</p>}
                    {event.revoked.length > 0 && <p className="text-red-800">− {event.revoked.join(", ")}</p>}
                    {event.reason && <p className="text-muted-foreground">{event.reason}</p>}
                    {!event.granted.length && !event.revoked.length && !event.reason && (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </Td>
                  <Td>{shortName(event.by)}</Td>
                </Row>
              ))}
            </tbody>
          </RecordTable>
        )}
      </Panel>
    </div>
  );
}

/** One titled block of the page, its action on the heading row. */
function Panel({ title, note, icon: Icon, action, children }) {
  return (
    <section className="space-y-4 rounded-xl border border-container-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            {Icon && <Icon className="size-5" aria-hidden="true" />}
            {title}
          </h2>
          {note && <p className="text-sm text-primary/75">{note}</p>}
        </div>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Banner({ icon, children }) {
  const Icon = icon;
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function Changes({ title, tone, items }) {
  if (!items.length) return null;
  return (
    <p>
      <span className={cn("font-semibold", tone)}>{title}: </span>
      {items.join(", ")}
    </p>
  );
}

/** Access for a time: which permissions, whose authority, from when to when, and why. */
function LendForm({ page, value, onChange, onCancel, onSave, busy, labelOf, employeeId }) {
  const [moduleKey, setModuleKey] = useState("");
  const modules = page.catalog.flatMap((group) => group.modules);
  const chosen = modules.find((one) => one.key === moduleKey);
  const set = (patch) => onChange({ ...value, ...patch });
  const toggle = (key, on) =>
    set({ permissions: on ? [...new Set([...value.permissions, key])] : value.permissions.filter((one) => one !== key) });
  const colleagues = employeeRecords.filter((person) => person.id !== employeeId && person.status !== "Inactive");
  const ready = value.permissions.length > 0 && value.startsOn && value.endsOn && value.endsOn >= value.startsOn && value.reason.trim();

  return (
    <div className="space-y-5 rounded-lg border border-container-border p-4">
      <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
        <div className="form-field space-y-2">
          <Label htmlFor="lend-from">Delegated From</Label>
          <Select value={value.fromEmployeeId ? String(value.fromEmployeeId) : "none"} onValueChange={(id) => set({ fromEmployeeId: id === "none" ? "" : Number(id) })}>
            <SelectTrigger id="lend-from">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none">Management (temporary grant)</SelectItem>
              {colleagues.map((person) => (
                <SelectItem key={person.id} value={String(person.id)}>
                  {person.shortName || person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="form-field space-y-2">
          <Label htmlFor="lend-start">
            Start Date<span className="ms-0.5 text-destructive">*</span>
          </Label>
          <DateField id="lend-start" value={value.startsOn} onChange={(e) => set({ startsOn: e.target.value })} />
        </div>
        <div className="form-field space-y-2">
          <Label htmlFor="lend-end">
            End Date<span className="ms-0.5 text-destructive">*</span>
          </Label>
          <DateField id="lend-end" value={value.endsOn} onChange={(e) => set({ endsOn: e.target.value })} />
          {value.endsOn && value.startsOn && value.endsOn < value.startsOn && (
            <p role="alert" className="field-error">
              After the start date.
            </p>
          )}
        </div>
        <div className="form-field space-y-2">
          <Label htmlFor="lend-module">Module</Label>
          <Select value={moduleKey} onValueChange={setModuleKey}>
            <SelectTrigger id="lend-module">
              <SelectValue placeholder="Choose a module" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {modules.map((one) => (
                <SelectItem key={one.key} value={one.key}>
                  {one.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {chosen && (
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {chosen.actions.map((action) => {
            const key = chosen.key + "." + action;
            return (
              <label key={key} className="flex items-center gap-2 text-sm text-primary">
                <Checkbox checked={value.permissions.includes(key)} onCheckedChange={(on) => toggle(key, Boolean(on))} />
                {page.actions[action]}
              </label>
            );
          })}
        </div>
      )}

      {value.permissions.length > 0 && (
        <ul aria-label="Permissions to give" className="flex flex-wrap gap-2">
          {value.permissions.map((key) => (
            <li key={key} className="flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-sm text-primary">
              {labelOf(key)}
              <button
                type="button"
                onClick={() => toggle(key, false)}
                className="rounded p-0.5 text-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Remove {labelOf(key)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="form-field space-y-2">
        <Label htmlFor="lend-reason">
          Reason<span className="ms-0.5 text-destructive">*</span>
        </Label>
        <Textarea id="lend-reason" value={value.reason} maxLength={300} onChange={(e) => set({ reason: e.target.value })} />
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave} disabled={!ready || busy}>
          {busy && <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />}
          Give Access
        </Button>
      </div>
    </div>
  );
}
