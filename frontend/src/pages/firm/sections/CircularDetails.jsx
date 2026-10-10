import { Button } from "@/components/ui/button";
import ExcelIcon from "@/components/shared/ExcelIcon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";
import {
  audienceFor,
  acknowledgementBy,
  formatDate,
} from "@/lib/circulars/context";

/**
 * Who has acknowledged a circular and who has not.
 *
 * Both halves are shown, because the half that matters is the one that has not
 * read it. The report is the same list as evidence: it names the circular, the
 * person, and the moment they acknowledged - which is what is produced when
 * somebody says they were never told.
 */
export default function CircularDetails({ circular, onOpenChange }) {
  const audience = audienceFor(circular).map((employee) => ({
    employee,
    acknowledgement: acknowledgementBy(circular, employee.name),
  }));

  const read = audience.filter((row) => row.acknowledgement);

  const exportReport = () =>
    downloadCsv(
      toCsv(
        [
          { key: "circularNo", header: "Circular No." },
          { key: "content", header: "Subject / Content" },
          { key: "issueDate", header: "Issue Date" },
          { key: "targetGroup", header: "Target Group" },
          { key: "employee", header: "Employee" },
          { key: "status", header: "Acknowledgement Status" },
          { key: "at", header: "Acknowledged At" },
        ],
        audience.map(({ employee, acknowledgement }) => ({
          circularNo: circular.circularNo,
          content: circular.content,
          issueDate: formatDate(circular.date),
          targetGroup: circular.targetGroup,
          employee: employee.name,
          status: acknowledgement ? "Acknowledged" : "Not acknowledged",
          at: acknowledgement ? acknowledgement.at : "",
        }))
      ),
      "circular-" + circular.circularNo + "-acknowledgements.csv"
    );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{circular.circularNo}</DialogTitle>
          <DialogDescription>
            {formatDate(circular.date)} &middot; {circular.targetGroup} &middot;{" "}
            {read.length} of {audience.length} acknowledged
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto rounded-lg border">
          <table className="w-full border text-sm">
            <thead className="sticky top-0 bg-muted/90">
              <tr className="border-b text-start text-xs text-muted-foreground">
                <th className="p-3 font-semibold">Employee</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Date &amp; Time</th>
              </tr>
            </thead>
            <tbody>
              {audience.map(({ employee, acknowledgement }) => (
                <tr key={employee.id} className="border-b last:border-0">
                  <td className="p-3">{employee.name}</td>
                  <td className="p-3">
                    {acknowledgement ? (
                      <span className="inline-flex items-center gap-1.5 text-green-700">
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        Acknowledged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-red-600">
                        <X className="h-3.5 w-3.5 shrink-0" />
                        Not acknowledged
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {acknowledgement ? acknowledgement.at : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={exportReport}>
            <ExcelIcon className="me-2 size-[18px]" />
            Acknowledgement Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
