import { useState } from "react";
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
import SearchableSelect from "@/components/shared/SearchableSelect";
import DateField from "@/components/shared/DateField";
import { cn } from "@/lib/utils";
import { UserMinus, LogOut, Briefcase, Clock3 } from "lucide-react";
import { employeeRecords } from "@/pages/employees/employeeData";
import {
  offboardingApi,
  OFFBOARDING_TYPES,
  NOTICE_MODES,
  REASONS_BY_TYPE,
} from "@/lib/api/modules/offboarding";

/** YYYY-MM-DD, today in the user's own timezone. */
const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const addDays = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  return date.toISOString().slice(0, 10);
};

/** "1 Month", "30 days", "2 weeks" on the record -> days; 30 where nothing is said. */
const noticeDaysOf = (text) => {
  const m = /(\d+)\s*(day|week|month)?/i.exec(String(text || ""));
  if (!m) return 30;
  const n = Number(m[1]);
  const unit = (m[2] || "day").toLowerCase();
  return unit === "month" ? n * 30 : unit === "week" ? n * 7 : n;
};

/** What each kind of departure is, said once where it is chosen. */
const TYPE_NOTES = {
  Resignation: { icon: LogOut, note: "Employee-initiated" },
  Termination: { icon: UserMinus, note: "Company-initiated" },
  "End of Contract": { icon: Briefcase, note: "Fixed term ends" },
  Retirement: { icon: Clock3, note: "Retirement age or early" },
};

/**
 * Starts an End of Service case: who, what kind of departure, why, and the
 * notice - from which the last working day follows (and can be moved).
 *
 * `employee` fixes the person (opened from their record); `resign` is an
 * employee filing their own resignation, which offers that type only.
 */
export default function StartOffboardingDialog({ open, onOpenChange, employee, resign = false, onStarted }) {
  const fixed = employee || null;
  const blank = () => {
    const days = noticeDaysOf(fixed?.noticePeriod);
    return {
      employeeId: fixed ? String(fixed.id) : "",
      type: resign ? "Resignation" : "",
      reason: "",
      details: "",
      noticeDate: todayIso(),
      noticeDays: String(days),
      noticeMode: "Served",
      lastWorkingDate: addDays(todayIso(), days),
    };
  };
  const [draft, setDraft] = useState(blank);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // A fresh form each time it opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(blank());
      setErrors({});
    }
  }

  const set = (key, value) =>
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      // The last day follows the notice until somebody moves it by hand.
      if (key === "noticeDate" || key === "noticeDays") {
        if (next.noticeDate) next.lastWorkingDate = addDays(next.noticeDate, next.noticeDays);
      }
      if (key === "noticeMode" && value === "Waived") next.lastWorkingDate = next.noticeDate;
      if (key === "type") next.reason = "";
      if (key === "employeeId") {
        const person = employeeRecords.find((e) => String(e.id) === value);
        const days = noticeDaysOf(person?.noticePeriod);
        next.noticeDays = String(days);
        next.lastWorkingDate = addDays(next.noticeDate, days);
      }
      return next;
    });

  const candidates = employeeRecords
    .filter((e) => e.status !== "Inactive")
    .map((e) => ({ value: String(e.id), label: e.name + (e.empNo ? " (" + e.empNo + ")" : "") }));

  const submit = async () => {
    const missing = {};
    if (!draft.employeeId) missing.employeeId = "Choose the employee.";
    if (!draft.type) missing.type = "Choose the type of departure.";
    if (!draft.noticeDate) missing.noticeDate = "Enter the notice date.";
    if (!draft.lastWorkingDate) missing.lastWorkingDate = "Enter the last working day.";
    if (Object.keys(missing).length) {
      setErrors(missing);
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const made = await offboardingApi.start({
        employeeId: Number(draft.employeeId),
        type: draft.type,
        reason: draft.reason || null,
        details: draft.details || null,
        noticeDate: draft.noticeDate,
        noticeDays: Number(draft.noticeDays || 0),
        noticeMode: draft.noticeMode,
        lastWorkingDate: draft.lastWorkingDate,
      });
      onOpenChange(false);
      onStarted?.(made);
    } catch (error) {
      const fields = Object.fromEntries(
        Object.entries(error.errors || {}).map(([key, list]) => [key, list[0]])
      );
      setErrors(Object.keys(fields).length ? fields : { form: error.message });
    } finally {
      setSaving(false);
    }
  };

  const types = resign ? ["Resignation"] : OFFBOARDING_TYPES;
  const err = (key) =>
    errors[key] ? <p className="text-xs font-medium text-destructive">{errors[key]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resign ? "Submit Resignation" : "Start Offboarding"}</DialogTitle>
          <DialogDescription>
            {resign
              ? "Your resignation goes to management for approval. Your notice period starts on the notice date."
              : "Opens an End of Service case. It goes for approval, then through the notice period, clearance and final settlement."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {!fixed && (
            <div className="space-y-2">
              <Label htmlFor="off-employee">Employee</Label>
              <SearchableSelect
                id="off-employee"
                value={draft.employeeId}
                onValueChange={(value) => set("employeeId", value)}
                options={candidates}
                placeholder="Choose an employee"
                searchPlaceholder="Search employees..."
              />
              {err("employeeId")}
            </div>
          )}
          {fixed && (
            <p className="rounded-lg border border-container-border bg-secondary/60 px-3 py-2 text-sm text-primary">
              <span className="font-semibold">{fixed.name}</span>
              {fixed.empNo && <span className="text-muted-foreground"> · {fixed.empNo}</span>}
              {err("employeeId")}
            </p>
          )}

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-primary">Type of departure</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {types.map((type) => {
                const Icon = TYPE_NOTES[type].icon;
                const chosen = draft.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => set("type", type)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      chosen
                        ? "border-primary bg-blue-50/70 ring-1 ring-primary"
                        : "border-container-border hover:bg-menu-hover"
                    )}
                  >
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                    <span className="text-sm font-semibold text-primary">{type}</span>
                    <span className="text-xs text-muted-foreground">{TYPE_NOTES[type].note}</span>
                  </button>
                );
              })}
            </div>
            {err("type")}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="off-reason">Reason</Label>
              <Select
                value={draft.reason}
                onValueChange={(value) => set("reason", value)}
                disabled={!draft.type}
              >
                <SelectTrigger id="off-reason">
                  <SelectValue placeholder={draft.type ? "Choose a reason" : "Choose the type first"} />
                </SelectTrigger>
                <SelectContent>
                  {(REASONS_BY_TYPE[draft.type] || []).map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err("reason")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="off-mode">Notice</Label>
              <Select value={draft.noticeMode} onValueChange={(value) => set("noticeMode", value)}>
                <SelectTrigger id="off-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTICE_MODES.filter((mode) => !(resign && mode === "Paid in lieu")).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode === "Served" ? "Notice served (works the notice)" : mode === "Waived" ? "Notice waived" : "Paid in lieu of notice"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="off-notice-date">Notice date</Label>
              <DateField id="off-notice-date" value={draft.noticeDate} onChange={(e) => set("noticeDate", e.target.value)} />
              {err("noticeDate")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="off-notice-days">Notice period (days)</Label>
              <Input
                id="off-notice-days"
                type="number"
                min={0}
                max={180}
                value={draft.noticeDays}
                onChange={(e) => set("noticeDays", e.target.value)}
              />
              {err("noticeDays")}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="off-lwd">Last working day</Label>
              <DateField
                id="off-lwd"
                value={draft.lastWorkingDate}
                onChange={(e) => set("lastWorkingDate", e.target.value)}
              />
              {err("lastWorkingDate")}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="off-details">Details</Label>
              <Textarea
                id="off-details"
                rows={3}
                value={draft.details}
                onChange={(e) => set("details", e.target.value)}
                placeholder={resign ? "Anything you would like management to know" : "What happened, and anything agreed with the employee"}
              />
            </div>
          </div>
          {errors.form && <p className="text-sm font-medium text-destructive">{errors.form}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {resign ? "Submit Resignation" : "Start Offboarding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
