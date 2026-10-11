// Adding a supplier from inside another form. The supplier joins the directory
// straight away, so the form that opened this can select it on the spot.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSuppliers } from "@/lib/suppliers/context";
import SupplierFields from "./SupplierFields";
import {
  canSaveSupplier,
  emptySupplier,
  toSupplierRecord,
} from "./supplierData";
import { checkRequired } from "@/components/shared/formFields";

export default function NewSupplierDialog({ open, onOpenChange, onCreated }) {
  const { addSupplier } = useSuppliers();
  const [draft, setDraft] = useState(emptySupplier);
  const [saving, setSaving] = useState(false);

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));

  const close = () => {
    setDraft(emptySupplier);
    onOpenChange(false);
  };

  const save = async () => {
    if (saving || !checkRequired() || !canSaveSupplier(draft)) return;
    setSaving(true);
    const saved = await addSupplier(toSupplierRecord(draft));
    setSaving(false);
    // Refused by the server: the reason is shown and the dialog stays open.
    if (!saved) return;
    onCreated?.(saved);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add supplier</DialogTitle>
          <DialogDescription>
            The supplier is added to the directory and selected for this
            request.
          </DialogDescription>
        </DialogHeader>

        <div className="form-grid form-grid-2">
          <SupplierFields
            draft={draft}
            set={set}
            idPrefix="new-supplier"
            showStatus={false}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            Save Supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
