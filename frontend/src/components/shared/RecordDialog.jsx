import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Views or edits one record without needing a page of its own.
 *
 * Modules that have no detail screen still need their row actions to do
 * something real - this shows the record's own fields rather than a placeholder.
 *
 * `fields` is [{ key, label, readOnly }].
 */
export default function RecordDialog({
  open,
  onOpenChange,
  title,
  description,
  record,
  fields,
  readOnly,
  onSave,
}) {
  const [draft, setDraft] = useState(record || {});
  const [loadedId, setLoadedId] = useState(record?.id);

  // Reload when the dialog is pointed at a different record.
  if (record && record.id !== loadedId) {
    setLoadedId(record.id);
    setDraft(record);
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="form-grid form-grid-2">
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={"record-" + field.key}>{field.label}</Label>
              <Input
                id={"record-" + field.key}
                value={draft[field.key] ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                disabled={readOnly || field.readOnly}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              Save Changes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
