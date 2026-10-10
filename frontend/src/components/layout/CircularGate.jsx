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
import { Megaphone } from "lucide-react";
import { useCirculars, formatDate } from "@/lib/circulars/context";

/**
 * The circulars a person has to read before they can do anything else.
 *
 * Shown one at a time, oldest first, with no way past it: no close button, no
 * escape key, no click outside. That is the point of a circular - the firm has
 * to be able to say everybody addressed by it has seen it, and a prompt that
 * can be dismissed proves nothing.
 *
 * The dialog is modal, so everything behind it is inert while it is open: no
 * navigation, no typing, no saving.
 *
 * Which circulars are waiting is the server's answer - it knows who each was
 * issued to - and the acknowledgement is recorded there, against whoever is
 * signed in. Until the server has it, the prompt stays.
 */
export default function CircularGate() {
  const { pending: outstanding, acknowledge } = useCirculars();
  // One acknowledgement at a time: the button waits for the server.
  const [busy, setBusy] = useState(false);
  const circular = outstanding[0];

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await acknowledge(circular.id);
    } finally {
      setBusy(false);
    }
  };

  if (!circular) return null;

  return (
    <Dialog open>
      <DialogContent
        hideClose
        className="max-w-lg"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded-lg bg-primary p-2 text-primary-foreground">
              <Megaphone className="h-4 w-4" />
            </span>
            Circular {circular.circularNo}
          </DialogTitle>
          <DialogDescription>
            {formatDate(circular.date)} &middot;{" "}
            {circular.targetGroup}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg border bg-secondary p-4 text-sm text-primary">
          {circular.content}
        </p>

        {/* Said plainly, because the reader cannot get past this either way */}
        <p className="text-xs text-muted-foreground">
          You cannot use the system until this circular is acknowledged. Your
          name and the time will be recorded against it.
          {outstanding.length > 1 &&
            " " + (outstanding.length - 1) + " more to read after this one."}
        </p>

        <DialogFooter>
          <Button onClick={confirm} disabled={busy}>
            I acknowledge this circular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
