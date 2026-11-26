import { useCallback, useEffect, useState } from "react";
import { Car, IdCard, Laptop, Package, Plus, Smartphone } from "lucide-react";
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
import DateField from "@/components/shared/DateField";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
  EmptyRow,
  SkeletonRows,
  ErrorRow,
} from "@/components/shared/RecordTable";
import { useTableSort } from "@/lib/sorting";
import { can } from "@/lib/access";
import { notify, notifyError } from "@/lib/api/notice";
import { ASSET_STATUSES, employeeAssetsApi } from "@/lib/api/modules/employeeAssets";
import { cn } from "@/lib/utils";

/**
 * Assigned Assets: the equipment issued to an employee - a car, a laptop, a
 * phone, a work ID - and whether each has come back.
 *
 * Two ways of working, one screen:
 *  - With an `employeeId`, the employee exists, so the register is read from
 *    the server and every issue, return or disposal is saved there at once.
 *  - Without one, the employee is still being added. Items are kept in the
 *    caller's `draft` array (through `onDraftChange`) and filed with
 *    `fileDraftAssets` once the employee has been created.
 *
 * Nothing is ever deleted from a saved register: returning or disposing of an
 * item records the date and changes its status, so the history stays - and
 * End of Service can see whether anything is still out with the person. A
 * draft item, not yet filed anywhere, can simply be taken off the list.
 */

const TYPES = [
  { value: "Car", icon: Car },
  { value: "Computer / Laptop", icon: Laptop },
  { value: "Mobile Phone", icon: Smartphone },
  { value: "Work ID Card", icon: IdCard },
];

const EMPTY_FORM = { assetNumber: "", makeModel: "", serialNumber: "", issueDate: "" };

/** Today as YYYY-MM-DD in the reader's own day, not UTC's. */
const today = () => new Date().toLocaleDateString("en-CA");

/** "2026-05-01" -> "01/05/2026", the way the firm writes dates; a dash for nothing. */
const shortDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

const STATUS_TONE = {
  Assigned: "bg-emerald-50 text-emerald-700",
  Returned: "bg-blue-50 text-blue-700",
  Disposed: "bg-slate-100 text-slate-600",
};

function StatusPill({ status }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE[status] || "bg-slate-100 text-slate-700")}>
      {status}
    </span>
  );
}

// Assigned first - what is still out is what somebody needs to act on.
const SORT_COLUMNS = {
  type: { sort: "text" },
  makeModel: { sort: "text" },
  assetNumber: { sort: "text" },
  issueDate: { sort: "date" },
  returnDate: { sort: "date" },
  disposalDate: { sort: "date" },
  status: { sort: "status", sortOrder: ASSET_STATUSES },
};

const COLUMNS = 8;

/** A local id for an item not yet filed, so React and the draft can tell items apart. */
let draftSeq = 0;
const draftId = () => "draft-" + Date.now().toString(36) + "-" + (draftSeq += 1);

/**
 * Files a new employee's draft items, one after another so they reach the
 * register in the order they were added. Returns what was filed and what was
 * refused (each with the server's reason), so the caller can say which items
 * still need entering by hand.
 */
export async function fileDraftAssets(employeeId, draft = []) {
  const filed = [];
  const failed = [];
  for (const item of draft) {
    try {
      filed.push(await employeeAssetsApi.issue(employeeId, item));
    } catch (error) {
      failed.push({ item, message: error?.field?.("assetNumber") || error?.message || "Could not be saved." });
    }
  }
  return { filed, failed };
}

/** One of the four kinds, as a card with a radio dot. */
function TypeCard({ type, selected, disabled, onSelect }) {
  const Icon = type.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "border-blue-300 bg-blue-50" : "border-container-border bg-card hover:bg-slate-50"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex-1 font-semibold text-primary">{type.value}</span>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-blue-600" : "border-slate-300"
        )}
      >
        {selected && <span className="size-2.5 rounded-full bg-blue-600" />}
      </span>
    </button>
  );
}

function Field({ id, label, required, error, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ms-0.5 text-red-600">*</span>}
      </Label>
      {children}
      {error && (
        <p id={id + "-error"} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** "<Type> Details": the four fields and Add to Register. */
function DetailsForm({ type, form, errors, saving, onChange, onSubmit }) {
  const examples = {
    Car: ["AST-CAR-0012", "Toyota Land Cruiser", "Chassis number"],
    "Computer / Laptop": ["AST-IT-00428", "Dell Latitude 5450", "Enter serial number"],
    "Mobile Phone": ["AST-MOB-00116", "iPhone 15", "IMEI or serial number"],
    "Work ID Card": ["AST-ID-00041", "Staff ID Card", "Card number"],
  }[type];
  const field = (key) => ({
    id: "asset-" + key,
    value: form[key],
    "aria-invalid": Boolean(errors[key]) || undefined,
    "aria-describedby": errors[key] ? "asset-" + key + "-error" : undefined,
    onChange: (e) => onChange(key, e.target.value),
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="rounded-xl border border-container-border bg-slate-50/60 p-5"
    >
      <h4 className="text-base font-bold text-primary">{type} Details</h4>
      <p className="mt-0.5 text-sm text-muted-foreground">Enter the asset information before adding it to the asset register.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field id="asset-assetNumber" label="Asset Number" required error={errors.assetNumber}>
          <Input {...field("assetNumber")} maxLength={40} placeholder={examples[0]} autoComplete="off" />
        </Field>
        <Field id="asset-makeModel" label="Make / Model" error={errors.makeModel}>
          <Input {...field("makeModel")} maxLength={120} placeholder={examples[1]} />
        </Field>
        <Field id="asset-serialNumber" label="Serial Number" error={errors.serialNumber}>
          <Input {...field("serialNumber")} maxLength={80} placeholder={examples[2]} autoComplete="off" />
        </Field>
        <Field id="asset-issueDate" label="Issue Date" required error={errors.issueDate}>
          <DateField {...field("issueDate")} max={today()} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={saving}>
          <Plus className="me-1 size-4" aria-hidden="true" />
          {saving ? "Adding…" : "Add to Register"}
        </Button>
      </div>
    </form>
  );
}

/** Asks for the date an item came back or was disposed of; today unless said otherwise. */
function CloseDialog({ closing, saving, onCancel, onConfirm }) {
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const returning = closing?.action === "return";
  const asset = closing?.asset;

  return (
    <Dialog open={Boolean(closing)} onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle className="text-primary">{returning ? "Record Return" : "Record Disposal"}</DialogTitle>
          <DialogDescription>
            {asset?.type} {asset?.assetNumber}
            {asset?.makeModel ? " – " + asset.makeModel : ""}. The item stays in the register as{" "}
            {returning ? "Returned" : "Disposed"}.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!date) return setError("Enter the date.");
            if (asset?.issueDate && date < asset.issueDate) return setError("The date cannot be before the item was issued.");
            if (date > today()) return setError("The date cannot be in the future.");
            setError((await onConfirm(date, notes)) || "");
          }}
        >
          <Field id="asset-close-date" label={returning ? "Return Date" : "Disposal Date"} required error={error}>
            <DateField id="asset-close-date" value={date} min={asset?.issueDate} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field id="asset-close-notes" label="Notes">
            <Textarea
              id="asset-close-notes"
              rows={2}
              maxLength={500}
              value={notes}
              placeholder={returning ? "Condition on return" : "Reason for disposal"}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : returning ? "Record Return" : "Record Disposal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The whole record of one item, read-only. */
function ViewDialog({ asset, onClose }) {
  const lines = asset
    ? [
        ["Asset Type", asset.type],
        ["Asset Number", asset.assetNumber],
        ["Make / Model", asset.makeModel || "—"],
        ["Serial Number", asset.serialNumber || "—"],
        ["Issue Date", shortDate(asset.issueDate)],
        ["Return Date", shortDate(asset.returnDate)],
        ["Disposal Date", shortDate(asset.disposalDate)],
        ["Status", <StatusPill key="status" status={asset.status} />],
        ["Notes", asset.notes || "—"],
        ["Recorded By", asset.recordedBy || (asset.draft ? "Filed when the employee is created" : "—")],
      ]
    : [];
  return (
    <Dialog open={Boolean(asset)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="text-start">
          <DialogTitle className="text-primary">{asset?.type}</DialogTitle>
          <DialogDescription>{asset?.assetNumber}</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-container-border text-sm">
          {lines.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-end font-medium text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

export default function AssignedAssets({ employeeId, draft = [], onDraftChange, canEdit }) {
  const saved = Boolean(employeeId);
  // Without a ruling from the caller: a saved register follows the person's
  // permissions; a draft is being filled in by whoever is adding the employee.
  const editable = canEdit ?? (saved ? can("employeeAssets.create", "employeeAssets.edit") : true);
  const mayIssue = canEdit ?? (saved ? can("employeeAssets.create") : true);
  const mayClose = canEdit ?? (saved ? can("employeeAssets.edit") : true);

  const [type, setType] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(saved);
  const [failed, setFailed] = useState(false);

  const [closing, setClosing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setFailed(false);
    try {
      setAssets(await employeeAssetsApi.list(employeeId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = saved ? assets : draft.map((item) => ({ ...item, status: "Assigned", draft: true }));
  const { rows: sorted, sortProps } = useTableSort(rows, SORT_COLUMNS);

  const change = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const pick = (value) => {
    if (value === type) return;
    setType(value);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const add = async () => {
    const number = form.assetNumber.trim();
    const problems = {};
    if (!number) problems.assetNumber = "Enter the asset number.";
    if (!form.issueDate) problems.issueDate = "Enter the issue date.";
    else if (form.issueDate > today()) problems.issueDate = "The issue date cannot be in the future.";
    // The server checks across every employee; this catches the same number
    // entered twice on this screen before anything is sent.
    if (number && rows.some((a) => a.status === "Assigned" && a.assetNumber.toLowerCase() === number.toLowerCase())) {
      problems.assetNumber = "This asset number is already in the register.";
    }
    if (Object.keys(problems).length) return setErrors(problems);

    const item = { ...form, assetNumber: number, type };
    if (!saved) {
      onDraftChange?.([...draft, { ...item, id: draftId() }]);
    } else {
      setSaving(true);
      try {
        const issued = await employeeAssetsApi.issue(employeeId, item);
        setAssets((current) => [issued, ...current]);
        notify(type + " " + issued.assetNumber + " added to the register.", "success");
      } catch (error) {
        const fields = {
          assetNumber: error?.field?.("assetNumber"),
          issueDate: error?.field?.("issueDate"),
          makeModel: error?.field?.("makeModel"),
          serialNumber: error?.field?.("serialNumber"),
        };
        if (Object.values(fields).some(Boolean)) setErrors(fields);
        else notifyError(error);
        return;
      } finally {
        setSaving(false);
      }
    }
    setForm(EMPTY_FORM);
    setErrors({});
  };

  /** Returns the message to show under the date, or nothing once saved. */
  const close = async (date, notes) => {
    const { asset, action } = closing;
    setSaving(true);
    try {
      const updated =
        action === "return"
          ? await employeeAssetsApi.markReturned(employeeId, asset.id, date, notes)
          : await employeeAssetsApi.markDisposed(employeeId, asset.id, date, notes);
      setAssets((current) => current.map((a) => (a.id === updated.id ? updated : a)));
      setClosing(null);
      notify(asset.type + " " + asset.assetNumber + (action === "return" ? " recorded as returned." : " recorded as disposed."), "success");
      return "";
    } catch (error) {
      const message = error?.field?.(action === "return" ? "returnDate" : "disposalDate") || error?.field?.("action");
      if (!message) notifyError(error);
      return message;
    } finally {
      setSaving(false);
    }
  };

  const removeDraft = (id) => onDraftChange?.(draft.filter((item) => item.id !== id));

  const linkClass = "text-sm font-medium text-record-link hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded";

  return (
    <div className="space-y-8">
      {mayIssue && (
        <section aria-labelledby="expected-assets-heading" className="space-y-4">
          <div>
            <h3 id="expected-assets-heading" className="text-lg font-bold text-primary">
              Expected Assets
            </h3>
            <p className="text-sm text-muted-foreground">
              Select an asset type to enter its details. Each saved item is added to the register below.
            </p>
          </div>
          <div role="radiogroup" aria-label="Asset type" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {TYPES.map((t) => (
              <TypeCard key={t.value} type={t} selected={type === t.value} onSelect={() => pick(t.value)} />
            ))}
          </div>
          {type && <DetailsForm type={type} form={form} errors={errors} saving={saving} onChange={change} onSubmit={add} />}
        </section>
      )}

      <section aria-labelledby="assets-register-heading" className="space-y-4">
        <div>
          <h3 id="assets-register-heading" className="text-lg font-bold text-primary">
            Assigned Assets Register
          </h3>
          <p className="text-sm text-muted-foreground">
            {saved ? "Saved assets and their return or disposal dates." : "Filed to the register when the employee is created."}
          </p>
        </div>

        <RecordTable minWidth={960}>
          <HeadRow>
            <Th {...sortProps("type")}>Asset Type</Th>
            <Th {...sortProps("makeModel")}>Asset / Model</Th>
            <Th {...sortProps("assetNumber")}>Asset Number</Th>
            <Th {...sortProps("issueDate")}>Issue Date</Th>
            <Th {...sortProps("returnDate")}>Return Date</Th>
            <Th {...sortProps("disposalDate")}>Disposal Date</Th>
            <Th {...sortProps("status")}>Status</Th>
            <Th>Action</Th>
          </HeadRow>
          <tbody>
            {loading ? (
              <SkeletonRows columns={COLUMNS} rows={3} />
            ) : failed ? (
              <ErrorRow colSpan={COLUMNS} label="assets" onRetry={load} retrying={loading} />
            ) : sorted.length === 0 ? (
              <EmptyRow colSpan={COLUMNS} label="assets" />
            ) : (
              sorted.map((asset) => (
                <Row key={asset.id}>
                  <Td className="font-semibold text-primary">{asset.type}</Td>
                  <Td>{asset.makeModel || "—"}</Td>
                  <Td className="numeric-value">{asset.assetNumber}</Td>
                  <Td className="numeric-value whitespace-nowrap">{shortDate(asset.issueDate)}</Td>
                  <Td className="numeric-value whitespace-nowrap">{shortDate(asset.returnDate)}</Td>
                  <Td className="numeric-value whitespace-nowrap">{shortDate(asset.disposalDate)}</Td>
                  <Td>
                    <StatusPill status={asset.status} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <button type="button" className={linkClass} onClick={() => setViewing(asset)}>
                        View
                      </button>
                      {asset.draft && editable && (
                        <button type="button" className={cn(linkClass, "text-red-600")} onClick={() => removeDraft(asset.id)}>
                          Remove
                        </button>
                      )}
                      {!asset.draft && mayClose && asset.status === "Assigned" && (
                        <button type="button" className={linkClass} onClick={() => setClosing({ asset, action: "return" })}>
                          Return
                        </button>
                      )}
                      {/* A returned item can still be written off later; a disposed one is gone. */}
                      {!asset.draft && mayClose && asset.status !== "Disposed" && (
                        <button type="button" className={linkClass} onClick={() => setClosing({ asset, action: "dispose" })}>
                          Dispose
                        </button>
                      )}
                    </div>
                  </Td>
                </Row>
              ))
            )}
          </tbody>
        </RecordTable>

        <p className="flex items-start gap-2 rounded-xl border border-container-border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
          <Package className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Return Date and Disposal Date are recorded when the item is returned or disposed of. Returning or disposing of an
          item updates its status and preserves the asset history.
        </p>
      </section>

      {/* Keyed by the item, so the date starts again at today for each one. */}
      <CloseDialog
        key={closing ? closing.asset.id + closing.action : "closed"}
        closing={closing}
        saving={saving}
        onCancel={() => setClosing(null)}
        onConfirm={close}
      />
      <ViewDialog asset={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
