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
 * Add Employee's System Permissions step, exactly as the client's sheet
 * draws it: four access profiles, the access scope (matter access and a
 * department or branch), and six system areas with View / Create / Edit /
 * Delete / Approve.
 *
 * It is held as a draft with the rest of the new employee and saved once the
 * record is made (savePermissionsDraft). Management access is not offered
 * here - it is given separately, with approval - and permissions can be
 * changed on the record's own System Permissions page at any time.
 */

/** The four profiles of the sheet, each starting from a catalogue template. */
const PROFILES = [
  { key: "lawyer", title: "Legal Practice", note: "Matter and document access" },
  { key: "accounting", title: "Finance", note: "Billing and payment access" },
  { key: "execution", title: "Operations", note: "Administrative work areas" },
];

/**
 * The sheet's six system areas, each standing for the catalogue modules it
 * covers. Ticking an action on a row grants it on every module of the row
 * that has that action; a row reads as ticked while any of them holds it.
 * `noun` is what the Scope column calls the records ("Assigned matters").
 */
const ROWS = [
  { key: "clients", label: "Clients", noun: "clients", modules: ["clients"] },
  { key: "cases", label: "Cases & Matters", noun: "matters", modules: ["cases", "courtFees"] },
  { key: "documents", label: "Documents", noun: "matters", modules: ["documents"] },
  { key: "billing", label: "Billing & Payments", noun: "matters", modules: ["expenses", "paymentRequests", "suppliers", "taxes"] },
  { key: "reports", label: "Reports", noun: "matters", modules: ["reports"] },
  {
    key: "employees",
    label: "Employee Administration",
    noun: "employees",
    modules: ["employees", "employeeDocuments", "employeeAssets", "offboarding", "violations"],
  },
];

/** The action columns, in the order the sheet reads them. */
const COLUMNS = ["view", "create", "edit", "delete", "approve"];

/** "All departments and branches" on the Department / Branch select. */
const EVERYWHERE = "all";

/**
 * The draft a new employee starts with: Custom on the self-service base, so
 * nothing on the table is ticked until it is chosen.
 *
 * Grants that are not rows of the table - filing and following one's own
 * requests, circulars, the dashboard, and whatever else the chosen profile's
 * template carries (payroll for Finance, for one) - stay granted by the
 * template: the table only adds and removes the modules of its six rows.
 */
export const emptyPermissionsDraft = {
  template: "staff",
  custom: true,
  grants: null,
  scope: "own",
  departments: [],
  reach: EVERYWHERE,
};

/**
 * The backend's record access from the two selects: "Assigned matters only"
 * is `own` (it is narrower than any department, so it wins over one);
 * otherwise a department or branch chosen is `department` on it, and "All
 * departments and branches" is `all`.
 */
function scopeOf(matters, reach) {
  if (matters === "assigned") return { scope: "own", departments: [] };
  if (reach && reach !== EVERYWHERE) return { scope: "department", departments: [reach] };
  return { scope: "all", departments: [] };
}

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
        "flex items-center justify-between gap-3 rounded-xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "border-blue-500 bg-blue-50/60" : "border-container-border bg-card hover:bg-slate-50"
      )}
    >
      <span>
        <span className={cn("block font-semibold", on ? "text-blue-700" : "text-primary")}>{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{note}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-blue-600" : "border-slate-300")}
      >
        {on && <span className="size-2.5 rounded-full bg-blue-600" />}
      </span>
    </button>
  );
}

export default function PermissionsStep({ value, onChange, stepNumber = 5, stepCount = 6 }) {
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

  const draft = { ...emptyPermissionsDraft, ...(value || {}) };
  const templates = page?.templates || [];
  // The grants the draft holds: the chosen base's until something is ticked.
  const grants = draft.grants || templates.find((one) => one.value === draft.template)?.grants || [];

  // Once the catalogue is in, the draft holds the base template's own grants,
  // so what is saved is exactly what is ticked on screen.
  useEffect(() => {
    if (page && !draft.grants) {
      const start = page.templates.find((one) => one.value === draft.template) || page.templates[0];
      if (start) {
        const reach = draft.reach || EVERYWHERE;
        onChange({ ...draft, template: start.value, grants: start.grants, reach, ...scopeOf(start.scope === "own" ? "assigned" : "all", reach) });
      }
    }
    // Only when the catalogue arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Each catalogue module's actions, to know what a row's tick reaches.
  const actionsOf = Object.fromEntries(
    (page?.catalog || []).flatMap((group) => group.modules.map((module) => [module.key, module.actions]))
  );
  const keysOf = (row, action) =>
    row.modules.filter((module) => (actionsOf[module] || []).includes(action)).map((module) => module + "." + action);

  const matters = draft.scope === "own" ? "assigned" : "all";
  const reach = draft.reach || (draft.scope === "department" ? draft.departments[0] : EVERYWHERE) || EVERYWHERE;

  const choose = (template) =>
    onChange({ ...draft, template: template.value, custom: false, grants: template.grants, ...scopeOf(template.scope === "own" ? "assigned" : "all", reach) });

  // Custom keeps the chosen base template and what is ticked.
  const custom = () => onChange({ ...draft, grants, custom: true });

  const toggle = (row, action) => {
    const keys = keysOf(row, action);
    const on = keys.some((key) => grants.includes(key));
    onChange({
      ...draft,
      custom: true,
      grants: on ? grants.filter((key) => !keys.includes(key)) : [...grants, ...keys.filter((key) => !grants.includes(key))],
    });
  };

  const setScope = (nextMatters, nextReach) => onChange({ ...draft, grants, reach: nextReach, ...scopeOf(nextMatters, nextReach) });

  /** The Scope column: how far the row's access reaches, or "No access". */
  const scopeText = (row) => {
    const any = COLUMNS.some((action) => keysOf(row, action).some((key) => grants.includes(key)));
    if (!any) return "No access";
    if (draft.scope === "own") return "Assigned " + row.noun;
    if (draft.scope === "department") {
      const where = draft.departments[0] || "";
      return (page?.branchOptions || []).includes(where) ? `${where} branch ${row.noun}` : `${where} ${row.noun}`;
    }
    return "All " + row.noun;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Choose an access profile, define its scope, and review permissions by system area.
        </p>
        <p className="text-sm font-bold tracking-wide text-primary/80">
          STEP {stepNumber} OF {stepCount}
        </p>
      </div>

      <section aria-label="Access Profile">
        <h3 className="text-lg font-bold text-primary">Access Profile</h3>
        <p className="text-sm text-muted-foreground">Start with a profile, then adjust permissions below when needed.</p>
        <div role="radiogroup" aria-label="Access profile" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PROFILES.map((profile) => {
            const template = templates.find((one) => one.value === profile.key);
            return (
              <ProfileCard
                key={profile.key}
                title={profile.title}
                note={profile.note}
                on={!draft.custom && draft.template === profile.key}
                onClick={() => template && choose(template)}
              />
            );
          })}
          <ProfileCard title="Custom" note="Set access one module at a time" on={Boolean(draft.custom)} onClick={custom} />
        </div>
      </section>

      <section
        aria-label="Access Scope"
        className="grid items-start gap-4 rounded-xl border border-container-border bg-slate-50/60 p-4 md:grid-cols-[1fr_1fr_1fr]"
      >
        <div>
          <h3 className="font-semibold text-primary">Access Scope</h3>
          <p className="text-sm text-muted-foreground">Limit which records the employee can access.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="perm-matters">Matter access</Label>
          <Select value={matters} onValueChange={(next) => next && setScope(next, reach)}>
            <SelectTrigger id="perm-matters">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="assigned">Assigned matters only</SelectItem>
              <SelectItem value="all">All matters</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="perm-reach">Department / Branch</Label>
          <Select value={reach} onValueChange={(next) => next && setScope(matters, next)}>
            <SelectTrigger id="perm-reach">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EVERYWHERE}>All departments and branches</SelectItem>
              {(page?.departmentOptions || []).map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
              {(page?.branchOptions || []).map((branch) => (
                <SelectItem key={branch} value={branch}>
                  {branch} Branch
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section aria-label="Module Permissions">
        <h3 className="text-lg font-bold text-primary">Module Permissions</h3>
        <p className="mb-3 text-sm text-muted-foreground">Select only the actions required for this employee role.</p>
        <RecordTable minWidth={820}>
          <HeadRow>
            {/* Capitals, as the sheet's table heads read. */}
            <Th className="uppercase">System Area</Th>
            <Th className="uppercase">Scope</Th>
            {COLUMNS.map((action) => (
              <Th key={action} className="text-center uppercase">
                {(page?.actions || {})[action] || action}
              </Th>
            ))}
          </HeadRow>
          <tbody>
            {!page && !failed ? (
              <SkeletonRows columns={2 + COLUMNS.length} rows={ROWS.length} />
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
              ROWS.map((row) => (
                <Row key={row.key}>
                  <Td className="font-semibold text-primary">{row.label}</Td>
                  <Td className="text-muted-foreground">{scopeText(row)}</Td>
                  {COLUMNS.map((action) => {
                    const keys = keysOf(row, action);
                    return (
                      <Td key={action} className="text-center">
                        <Checkbox
                          aria-label={row.label + ": " + action}
                          // Blue when ticked, as the client's sheet draws it.
                          className="border-slate-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                          disabled={!keys.length}
                          checked={keys.some((key) => grants.includes(key))}
                          onCheckedChange={() => toggle(row, action)}
                        />
                      </Td>
                    );
                  })}
                </Row>
              ))
            )}
          </tbody>
        </RecordTable>
      </section>

      <p className="flex items-start gap-3 rounded-xl border border-container-border bg-slate-50/60 px-4 py-3 text-sm text-primary">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <Info className="size-4" aria-hidden="true" />
        </span>
        <span>
          <strong>Administrator access is restricted and should be assigned separately with approval.</strong>
          <br />
          <span className="text-muted-foreground">New modules remain unavailable until access is explicitly granted.</span>
        </span>
      </p>

      <p className="border-t border-container-border pt-4 text-xs text-muted-foreground">
        Permissions can be reviewed and updated after the employee profile is created.
      </p>
    </div>
  );
}
