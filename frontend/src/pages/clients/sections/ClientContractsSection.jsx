import {
  useState } from "react";
import UploadIcon from "@/components/shared/UploadIcon";
import { Button } from "@/components/ui/button";
import { Card,
  CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  } from "@/components/ui/dialog";
import DataTable from "@/components/shared/DataTable";
import SearchableSelect from "@/components/shared/SearchableSelect";
import FormHeading from "@/components/shared/FormHeading";
import { FileText,
  FileCheck,
  Plus,
  FileSignature,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTRACT_TYPES } from "@/lib/constants";
import { formatDate, dayOffset } from "@/pages/firm/firmData";
import { clientContracts, clientLinkedCases } from "../clientMockData";
import { checkRequired } from "@/components/shared/formFields";

import DateField from "@/components/shared/DateField";
/**
 * A contract is spent once the end date it carries has arrived. Until then it
 * is live, even if an end date is already agreed.
 */
const isCancelled = (contract) =>
  Boolean(contract.endDate) && contract.endDate <= dayOffset(0);

/**
 * Live contracts first, spent ones beneath them.
 *
 * Whoever opens this page is nearly always after the agreement in force, so the
 * ones that have run out are pushed under it rather than mixed in by date.
 */
const byStanding = (a, b) => {
  const spent = Number(isCancelled(a)) - Number(isCancelled(b));
  return spent || b.startDate.localeCompare(a.startDate);
};

const emptyContract = {
  contractType: "General",
  caseFileNo: "",
  title: "",
  startDate: "",
  endDate: "",
  notes: "",
};

export default function ClientContractsSection() {
  const [contracts, setContracts] = useState(clientContracts);
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState(emptyContract);
  const [editing, setEditing] = useState(null);
  // The page is the list until someone asks to add to it.
  const [adding, setAdding] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const isSpecific = draft.contractType === "Specific";

  const setField = (name, value) =>
    setDraft((prev) => ({ ...prev, [name]: value }));

  const canSave =
    file && draft.startDate && (!isSpecific || draft.caseFileNo);

  const closeForm = () => {
    setAdding(false);
    setFile(null);
    setDraft(emptyContract);
  };

  const handleSave = () => {
    if (!checkRequired() || !canSave) return;
    setContracts((prev) => [
      ...prev,
      {
        ...draft,
        id: prev.reduce((max, c) => Math.max(max, c.id), 0) + 1,
        serial: prev.reduce((max, c) => Math.max(max, c.serial), 0) + 1,
        caseFileNo: isSpecific ? draft.caseFileNo : null,
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
      },
    ]);
    closeForm();
  };

  const saveEdit = () => {
    setContracts((prev) =>
      prev.map((c) => (c.id === editing.id ? editing : c))
    );
    setEditing(null);
  };

  const rows = [...contracts].sort(byStanding);

  const columns = [
    {
      key: "serial",
      header: "Serial No.",
      width: "12%",
      render: (value, row) => (
        <div>
          <button
            type="button"
            onClick={() => setEditing({ ...row })}
            className="numeric-value font-medium text-record-link hover:opacity-80"
          >
            {value}
          </button>
          {isCancelled(row) && (
            <div className="mt-1">
              <Badge variant="destructive">Cancelled</Badge>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {formatDate(row.endDate)}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "contractType",
      header: "Contract Type",
      width: "14%",
      cellClassName: "font-medium",
      render: (value, row) => (
        <div>
          <span className="block">{value}</span>
          {row.caseFileNo && (
            <span className="block text-xs text-muted-foreground">
              Case file {row.caseFileNo}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "startDate",
      header: "Start Date",
      width: "12%",
      render: (value) => formatDate(value) || "-",
    },
    {
      key: "endDate",
      header: "Contract End Date",
      width: "13%",
      render: (value) =>
        value ? (
          formatDate(value)
        ) : (
          <span className="text-muted-foreground">Open ended</span>
        ),
    },
    {
      key: "fileName",
      header: "Contract Document",
      width: "25%",
      render: (value, row) => (
        <button
          type="button"
          onClick={() =>
            window.open(row.fileUrl, "_blank", "noopener,noreferrer")
          }
          className="flex items-start gap-2 rounded text-start text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <FileText className="h-4 w-4 shrink-0" />
          {value}
        </button>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      width: "24%",
      render: (value, row) => (
        <span className="text-muted-foreground">
          {row.title ? row.title + ". " : ""}
          {value || "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* The section's own heading, so the way to add to it sits on the
          same line rather than costing a row of its own. While a contract is
          being added the form's heading stands in its place. */}
      {!adding && (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        {/* Named as the sidebar names it: the page is already one client's.
            The way to add sits on the row above the table. */}
        <h2 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">Contracts</h2>
      </div>
      )}

      {/* The form takes the place of the list while it is being filled in:
          a page is one thing at a time, either the contracts on file or the
          form that adds to them. */}
      {adding && (
      <Card>
        <CardContent className="space-y-4 p-4">
          <FormHeading
            icon={FileSignature}
            title="Add Contract"
            onBack={closeForm}
          />

          <div className="form-grid">
            <div data-required="true" className="form-field space-y-2">
              <Label htmlFor="contractType">Contract Type</Label>
              <div className="flex gap-2">
                <Select
                  value={draft.contractType}
                  onValueChange={(value) => setField("contractType", value)}
                >
                  <SelectTrigger id="contractType" className="flex-1">
                    <SelectValue placeholder="Please Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* The attached file's name lives in the tooltip, so the
                    control stays the size of an icon either way. */}
                {file ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 border-green-600 text-green-600 hover:text-destructive"
                    title={file.name + " - click to remove"}
                    onClick={() => setFile(null)}
                  >
                    <FileCheck className="h-4 w-4" />
                    <span className="sr-only">
                      {file.name} attached. Remove it.
                    </span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title="Upload contract"
                    asChild
                  >
                    <label className="cursor-pointer">
                      <UploadIcon className="h-4 w-4" />
                      <span className="sr-only">Upload contract</span>
                      <Input
                        type="file"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files[0] && setFile(e.target.files[0])
                        }
                      />
                    </label>
                  </Button>
                )}
              </div>
            </div>

            {/* A specific contract is written for one case, so it names it */}
            {isSpecific && (
              <div className="form-field space-y-2">
                <Label htmlFor="caseFileNo">Case File Number</Label>
                <SearchableSelect
                  id="caseFileNo"
                  value={draft.caseFileNo}
                  onValueChange={(value) => setField("caseFileNo", value)}
                  options={clientLinkedCases.map((c) => ({
                    value: c.fileNo,
                    label: c.fileNo + " - " + c.opponent,
                  }))}
                  placeholder="Select case file"
                  searchPlaceholder="Search file number or opponent..."
                />
              </div>
            )}

            <div className="form-field space-y-2">
              <Label htmlFor="contractStart">Start Date</Label>
              <DateField
                required
                id="contractStart"
                value={draft.startDate}
                onChange={(e) => setField("startDate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractEnd">Contract End Date</Label>
              <DateField
                id="contractEnd"
                value={draft.endDate}
                onChange={(e) => setField("endDate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractTitle">Contract</Label>
              <Input
                id="contractTitle"
                value={draft.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Original, renewal, amendment..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractNotes">Note</Label>
              <Input
                id="contractNotes"
                value={draft.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Add a note about this contract"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save Contract
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* The list stays under the form rather than making way for it: a
          new record is judged against the ones already there. */}
      <DataTable
        columns={columns}
        data={rows}
        // Already newest first by start date, with spent contracts under them.
        keepOrder
        searchPlaceholder="Search contracts..."
        enableColumnSearch={false}
        onAdd={adding ? null : () => setAdding(true)}
        addLabel="Add Contract"
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

      {/* The serial number opens the contract for reading and editing */}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contract {editing?.serial}</DialogTitle>
            <DialogDescription>
              {editing && isCancelled(editing)
                ? "Cancelled on " + formatDate(editing.endDate)
                : "In force"}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="form-grid form-grid-2">
              {/* The case file only exists for a specific contract, so the type
                  takes the whole row when there is nothing to sit beside it. */}
              <div
                className={cn(
                  "space-y-2",
                  editing.contractType !== "Specific" && "sm:col-span-2"
                )}
              >
                <Label htmlFor="editType">Contract Type</Label>
                <Select
                  value={editing.contractType}
                  onValueChange={(value) =>
                    setEditing({
                      ...editing,
                      contractType: value,
                      caseFileNo: value === "Specific" ? editing.caseFileNo : null,
                    })
                  }
                >
                  <SelectTrigger id="editType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editing.contractType === "Specific" && (
                <div className="space-y-2">
                  <Label htmlFor="editCaseFile">Case File Number</Label>
                  <SearchableSelect
                    id="editCaseFile"
                    value={editing.caseFileNo || ""}
                    onValueChange={(value) =>
                      setEditing({ ...editing, caseFileNo: value })
                    }
                    options={clientLinkedCases.map((c) => ({
                      value: c.fileNo,
                      label: c.fileNo + " - " + c.opponent,
                    }))}
                    placeholder="Select case file"
                    searchPlaceholder="Search file number or opponent..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="editStart">Start Date</Label>
                <DateField
                  id="editStart"
                  value={editing.startDate}
                  onChange={(e) =>
                    setEditing({ ...editing, startDate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editEnd">Contract End Date</Label>
                <DateField
                  id="editEnd"
                  value={editing.endDate}
                  onChange={(e) =>
                    setEditing({ ...editing, endDate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="editTitle">Contract</Label>
                <Input
                  id="editTitle"
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="editNotes">Note</Label>
                <Input
                  id="editNotes"
                  value={editing.notes}
                  onChange={(e) =>
                    setEditing({ ...editing, notes: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Contract Document</Label>
                <button
                  type="button"
                  onClick={() =>
                    window.open(editing.fileUrl, "_blank", "noopener,noreferrer")
                  }
                  className="flex h-9 w-full items-center gap-2 rounded-md border bg-muted/40 px-3 text-start text-sm text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{editing.fileName}</span>
                </button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
