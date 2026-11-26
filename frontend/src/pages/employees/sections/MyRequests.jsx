import { useState } from "react";
import { ArrowLeft, LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { reloadDataset } from "@/lib/api/session";
import { REQUEST_TYPES } from "../requestsHub";
import RequestsHub, { useRequestRows } from "./RequestsHub";
import AddRequestDialog from "./AddRequestDialog";

/**
 * An employee's own Requests page: every request they have made, of every
 * kind, in one list - and one button to make another.
 *
 * The detailed screens each kind has (deciding, paying, the full workflow)
 * are management's, and are opened from the firm's Requests list in Company
 * Profile; here the employee asks, follows and reads.
 */
export default function MyRequests({ employee, onBack, backLabel }) {
  const [adding, setAdding] = useState(false);
  // The same rows the list shows, for the history of a kind in Add Request.
  const { rows } = useRequestRows(employee);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {onBack && (
          <>
            <button
              type="button"
              onClick={onBack}
              title={backLabel}
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
              <span className="sr-only">{backLabel}</span>
            </button>
            <span aria-hidden="true" className="h-9 w-px bg-container-border" />
          </>
        )}
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary">
          <LayoutGrid strokeWidth={1.5} className="size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-primary">Requests</h1>
          <p className="text-sm text-primary/75">Manage and track all your requests.</p>
        </div>
        <Button type="button" className="ms-auto h-11 px-5 text-base" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          Add Request
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <RequestsHub employee={employee} />
        </CardContent>
      </Card>

      <AddRequestDialog
        open={adding}
        onOpenChange={setAdding}
        employee={employee}
        history={rows}
        // The new request is listed by its own module: load that list again,
        // and the table and the figures follow.
        onCreated={(result) => reloadDataset(REQUEST_TYPES[result.type]?.dataset)}
      />
    </div>
  );
}
