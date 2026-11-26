import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecordTable, HeadRow, Th, Row, Td, SkeletonRows, ErrorRow } from "@/components/shared/RecordTable";
import { permissionsApi } from "@/lib/api/modules/permissions";
import { cn } from "@/lib/utils";

/**
 * Add Employee's System Permissions step.
 *
 * The person's access is decided while they are added, so nobody has to ask
 * for it afterwards: an access profile to start from, how far their access
 * reaches, and module by module what they may do. It is held as a draft with
 * the rest of the new employee and saved once the record is made
 * (savePermissionsDraft). Management access is not offered here - it is given
 * separately, with approval - and permissions can be changed on the record's
 * own System Permissions page at any time.
 */

/** How each starting point reads on its card. */
const PROFILE_TEXT = {
  lawyer: ["Legal Practice", "Matter and document access"],
  accounting: ["Finance", "Billing and payment access"],
  execution: ["Operations", "Execution and court work"],
  staff: ["Self-Service", "Own requests only"],
};

/** The action columns, in the order the design reads them. */
const COLUMNS = ["view", "create", "edit", "delete", "approve"];

/** The draft a new employee starts with: self-service, own records. */
export const emptyPermissionsDraft = { template: "staff", custom: false, grants: null, scope: "own", departments: [] };

/** Saves the step's draft against the employee just created. */
export async function savePermissionsDraft(employeeId, draft) {
  if (!draft || !draft.grants) return null;
  return permissionsApi.save(employeeId, {
    template: draft.template,
    grants: draft.grants,
    scope: draft.scope,
    departments: draft.departments || [],
    approvalLimit: null,
    paymentLimit: null,
  });
}

/** One access profile, as a radio card. */
function ProfileCard({ title, note, on, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "border-blue-500 bg-blue-50/60" : "border-container-border bg-card hover:bg-slate-50"
      )}
    >
      <span>
        <span className={cn("block font-semibold", on ? "text-blue-700" : "text-primary")}>{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{note}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-blue-600" : "border-slate-300")}
      >
        {on && <span className="size-2.5 rounded-full bg-blue-600" />}
      </span>
    </button>
  );
}

export default function PermissionsStep({ value, onChange }) {
  const [page, setPage] = useState(null);
  const [failed, setFailed] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    permissionsApi.catalog().then(
      (data) => live && setPage(data),
      (error) => live && setFailed(error?.message || "The permissions could not be loaded.")
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const draft = value || emptyPermissionsDraft;
  const templates = page?.templates || [];
  // The grants the draft holds: the chosen profile's until something is ticked.
  const grants = draft.grants || templates.find((one) => one.value === draft.template)?.grants || [];

  // Once the catalogue is in, the draft holds the profile's own grants, so
  // what is saved is exactly what is ticked on screen.
  useEffect(() => {
    if (page && !draft.grants) {
      const start = page.templates.find((one) => one.value === draft.template) || page.templates[0];
      if (start) onChange({ ...draft, template: start.value, grants: start.grants, scope: start.scope });
    }
    // Only when the catalogue arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const choose = (template) =>
    onChange({ template: template.value, custom: false, grants: template.grants, scope: template.scope, departments: [] });
  const toggle = (key) =>
    onChange({
      ...draft,
      custom: true,
      grants: grants.includes(key) ? grants.filter((one) => one !== key) : [...grants, key],
    });

  const modules = (page?.catalog || []).flatMap((group) => group.modules.map((module) => ({ ...module, group: group.label })));
  const scopeOf = (module) =>
    !COLUMNS.some((action) => grants.includes(module.key + "." + action))
      ? "No access"
      : draft.scope === "own"
        ? "Own records"
        : draft.scope === "department"
          ? "Selected departments"
          : "All records";

  return (
    <div className="space-y-6">
      <section aria-label="Access Profile">
        <h3 className="text-lg font-bold text-primary">Access Profile</h3>
        <p className="text-sm text-muted-foreground">Start with a profile, then adjust permissions below when needed.</p>
        <div role="radiogroup" aria-label="Access profile" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {templates.map((template) => (
            <ProfileCard
              key={template.value}
              title={(PROFILE_TEXT[template.value] || [template.label])[0]}
              note={PROFILE_TEXT[template.value]?.[1] || template.label}
              on={!draft.custom && draft.template === template.value}
              onClick={() => choose(template)}
            />
          ))}
          <ProfileCard
            title="Custom"
            note="Set access one module at a time"
            on={Boolean(draft.custom)}
            onClick={() => onChange({ ...draft, grants, custom: true })}
          />
        </div>
      </section>

      <section aria-label="Access Scope" className="grid gap-4 rounded-xl border border-container-border bg-slate-50/60 p-4 md:grid-cols-[1fr_1fr_1fr]">
        <div>
          <h3 className="font-semibold text-primary">Access Scope</h3>
          <p className="text-sm text-muted-foreground">Limit which records the employee can access.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="perm-scope">Record access</Label>
          <Select value={draft.scope} onValueChange={(scope) => onChange({ ...draft, scope, departments: scope === "department" ? draft.departments : [] })}>
            <SelectTrigger id="perm-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(page?.scopes || []).map((scope) => (
                <SelectItem key={scope.value} value={scope.value}>
                  {scope.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {draft.scope === "department" && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-primary">Departments</legend>
            <div className="flex flex-wrap gap-3">
              {(page?.departmentOptions || []).map((department) => (
                <label key={department} className="flex items-center gap-2 text-sm text-primary">
                  <Checkbox
                    checked={draft.departments.includes(department)}
                    onCheckedChange={() =>
                      onChange({
                        ...draft,
                        departments: draft.departments.includes(department)
                          ? draft.departments.filter((one) => one !== department)
                          : [...draft.departments, department],
                      })
                    }
                  />
                  {department}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </section>

      <section aria-label="Module Permissions">
        <h3 className="text-lg font-bold text-primary">Module Permissions</h3>
        <p className="mb-3 text-sm text-muted-foreground">Select only the actions required for this employee&apos;s role.</p>
        <RecordTable minWidth={820}>
          <HeadRow>
            <Th>System Area</Th>
            <Th>Scope</Th>
            {COLUMNS.map((action) => (
              <Th key={action} className="text-center">
                {(page?.actions || {})[action] || action}
              </Th>
            ))}
          </HeadRow>
          <tbody>
            {!page && !failed ? (
              <SkeletonRows columns={2 + COLUMNS.length} rows={6} />
            ) : failed ? (
              <ErrorRow
                colSpan={2 + COLUMNS.length}
                label="permissions"
                onRetry={() => {
                  setFailed("");
                  setAttempt((n) => n + 1);
                }}
              />
            ) : (
              modules.map((module) => (
                <Row key={module.key}>
                  <Td className="font-semibold text-primary">{module.label}</Td>
                  <Td className="text-muted-foreground">{scopeOf(module)}</Td>
                  {COLUMNS.map((action) => {
                    const key = module.key + "." + action;
                    return (
                      <Td key={action} className="text-center">
                        {module.actions.includes(action) ? (
                          <Checkbox
                            aria-label={module.label + ": " + action}
                            checked={grants.includes(key)}
                            onCheckedChange={() => toggle(key)}
                          />
                        ) : (
                          <span aria-hidden="true" className="text-muted-foreground">&ndash;</span>
                        )}
                      </Td>
                    );
                  })}
                </Row>
              ))
            )}
          </tbody>
        </RecordTable>
      </section>

      <p className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-primary">
        <Info className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
        <span>
          <strong>Administrator access is restricted and should be assigned separately with approval.</strong>
          <br />
          <span className="text-muted-foreground">
            New modules remain unavailable until access is explicitly granted. Permissions can be reviewed and updated
            after the employee profile is created.
          </span>
        </span>
      </p>
    </div>
  );
}
