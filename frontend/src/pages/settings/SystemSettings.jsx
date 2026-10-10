import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, FileWarning, Save, SlidersHorizontal } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { CRITICAL_DOCUMENT_TYPES } from "@/lib/constants";
import {
  ACCESS_ACTIONS,
  readDocumentControl,
  writeDocumentControl,
} from "@/lib/settings/documentControl";

/**
 * Rules the firm sets once for the whole system.
 *
 * One box so far: what happens when an employee's critical paper lapses -
 * how many days they are given to renew it, and what is done to their access
 * if they do not.
 */
export default function SystemSettings() {
  const navigate = useNavigate();
  const [control, setControl] = useState(readDocumentControl);
  const [saved, setSaved] = useState(false);

  const change = (next) => {
    setControl((prev) => ({ ...prev, ...next }));
    setSaved(false);
  };

  const graceValid =
    control.graceDays !== "" && Number.isInteger(Number(control.graceDays)) && Number(control.graceDays) >= 0;

  const save = (e) => {
    e.preventDefault();
    if (!graceValid) return;
    writeDocumentControl({ ...control, graceDays: Number(control.graceDays) });
    setSaved(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={SlidersHorizontal}
        title="System Settings"
        note="Rules that apply across the system"
        className="px-0 sm:px-0"
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={save} className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <span aria-hidden="true" className="h-8 w-1 rounded-full bg-primary" />
              <FileWarning strokeWidth={1.5} aria-hidden="true" className="size-7 shrink-0 text-primary" />
              <div>
                <h2 className="text-xl font-bold text-primary">Document Expiry Control</h2>
                <p className="text-sm text-primary/75">
                  When a critical employee document expires and is not renewed
                </p>
              </div>
            </div>

            <div className="form-grid gap-y-6">
              <div className="form-field space-y-2">
                <Label htmlFor="graceDays">Grace Period (Days)</Label>
                <Input
                  id="graceDays"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="5"
                  value={control.graceDays}
                  onChange={(e) => change({ graceDays: e.target.value })}
                  required
                />
                {!graceValid && (
                  <p className="text-xs text-destructive">Enter a whole number of days.</p>
                )}
              </div>

              <div className="form-field space-y-2">
                <Label htmlFor="accessAction">Action After Grace Period</Label>
                <Select
                  value={control.action}
                  onValueChange={(value) => value && change({ action: value })}
                >
                  <SelectTrigger id="accessAction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_ACTIONS.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Which papers count is part of the rule, so it is shown here;
                  it is not a choice on this page. */}
              <div className="form-field space-y-2 span-6">
                <p className="text-sm font-medium text-primary">Critical Documents</p>
                <div className="flex flex-wrap gap-2">
                  {CRITICAL_DOCUMENT_TYPES.map((type) => (
                    <span
                      key={type}
                      className="rounded-md border border-container-border bg-muted/40 px-2.5 py-1 text-sm text-primary"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t pt-4">
              {saved && (
                <span className="me-auto inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                  <Check className="size-4" aria-hidden="true" />
                  Saved
                </span>
              )}
              <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="me-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
