import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The two things a form can be told: leave it, or keep it.
 *
 * Cancel is written first and Save second, which puts Save at the trailing
 * edge of the row - the right in English and the left in Arabic - without
 * either of them naming a side. The page's own direction does that work, so
 * the pair cannot end up the wrong way round in one language.
 *
 * While a save is running the button says so and stops taking clicks: a form
 * submitted three times because nothing appeared to happen is the failure
 * this guards against.
 */
export default function FormActions({
  onCancel,
  onSave,
  saving = false,
  saveLabel = "Save",
  savingLabel = "Saving...",
  cancelLabel = "Cancel",
  form,
  className,
}) {
  return (
    <div className={cn("flex items-center justify-end gap-3", className)}>
      <Button type="button" variant="cancel" onClick={onCancel} disabled={saving}>
        {cancelLabel}
      </Button>
      <Button
        type={form || !onSave ? "submit" : "button"}
        form={form}
        onClick={onSave}
        disabled={saving}
        aria-busy={saving || undefined}
      >
        {saving ? (
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Save aria-hidden="true" />
        )}
        {saving ? savingLabel : saveLabel}
      </Button>
    </div>
  );
}
