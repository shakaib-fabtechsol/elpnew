import { useState } from "react";
import { ClipboardList } from "lucide-react";
import FormHeading from "@/components/shared/FormHeading";
import RequestsHub from "@/pages/employees/sections/RequestsHub";
import RequestWorkflowDialog from "@/pages/employees/sections/RequestWorkflowDialog";

/**
 * Company Profile -> Requests: every employee's requests, for management.
 *
 * The same list employees see of their own, with the employee named on each
 * row. View Details opens the request in its own detailed screen - the one
 * each kind has always had, with its decision, payment and history - for the
 * employee it belongs to, already opened on that request.
 */

export default function RequestsSection() {
  const [open, setOpen] = useState(null);

  return (
    <div className="space-y-6">
      <FormHeading
        icon={ClipboardList}
        title="Requests"
        note="Every employee's requests in one list. Open one to review, decide or pay it."
      />

      <RequestsHub showEmployee onView={setOpen} itemLabel="requests" />

      <RequestWorkflowDialog request={open} onClose={() => setOpen(null)} />
    </div>
  );
}
