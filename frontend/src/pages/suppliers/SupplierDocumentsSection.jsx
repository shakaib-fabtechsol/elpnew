import { useState } from "react";
import UploadIcon from "@/components/shared/UploadIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FormHeading from "@/components/shared/FormHeading";
import DataTable from "@/components/shared/DataTable";
import { FileCheck, FileText, Trash2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { expiryState, EXPIRY_LABEL } from "@/lib/expiry";
import {
  SUPPLIER_DOCUMENT_TYPES,
  initialSupplierDocuments,
} from "./supplierData";
import { checkRequired } from "@/components/shared/formFields";

import DateField from "@/components/shared/DateField";
/** Today as a plain YYYY-MM-DD in the user's own timezone. */
const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

const emptyDraft = {
  type: "",
  documentDate: "",
  expiryDate: "",
  notes: "",
};

/**
 * An expiry date and what it means.
 *
 * The same three states, the same two marks and the same words every other
 * filed paper in the system uses: hollow while the date is only approaching,
 * solid once it has passed.
 */
function ExpiryLine({ date }) {
  const state = expiryState(date);

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-muted-foreground">Expiry Date:</span>
      <span
        className={cn(
          state === "expired" ? "font-semibold text-red-600" : "font-medium"
        )}
      >
        {date || "-"}
      </span>

      {/* Nothing is said about a date still in hand: only one that is running
          out or has passed is worth a mark. */}
      {state !== "none" && state !== "valid" && (
        <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              state === "soon" && "border-2 border-red-500",
              state === "expired" && "bg-red-500"
            )}
          />
          {EXPIRY_LABEL[state]}
        </span>
      )}
    </p>
  );
}

/** One fact in the details panel. */
function Detail({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

/**
 * The papers filed against a supplier.
 *
 * Status is never stored - it is read off the expiry date every render, so a
 * registration cannot sit in the list calling itself valid after its date has
 * passed.
 *
 * Deleting is deliberately not a button in every row. A row is opened first,
 * read, and only then deleted, so a paper cannot be thrown away by a stray
 * click on a table of near-identical lines.
 */
export default function SupplierDocumentsSection({ supplier }) {
  const [documents, setDocuments] = useState(() =>
    initialSupplierDocuments.filter((d) => d.supplierId === supplier.id)
  );
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const opened = documents.find((d) => d.id === openId) || null;

  const setField = (name, value) =>
    setDraft((prev) => ({ ...prev, [name]: value }));

  const closeForm = () => {
    setAdding(false);
    setDraft(emptyDraft);
    setFile(null);
  };

  const removeDocument = (id) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setOpenId(null);
  };

  const canSave = file && draft.type && draft.documentDate;

  const save = () => {
    if (!checkRequired() || !canSave) return;
    setDocuments((prev) => {
      const next = prev.reduce((max, d) => Math.max(max, d.serial), 0) + 1;
      return [
        ...prev,
        {
          id: prev.reduce((max, d) => Math.max(max, d.id), 0) + 1,
          supplierId: supplier.id,
          serial: next,
          type: draft.type,
          fileName: file.name,
          fileUrl: URL.createObjectURL(file),
          documentDate: draft.documentDate,
          expiryDate: draft.expiryDate,
          notes: draft.notes,
        },
      ];
    });
    closeForm();
  };

  const openFile = (document) =>
    window.open(document.fileUrl, "_blank", "noopener,noreferrer");

  const columns = [
    {
      key: "serial",
      header: "Serial No.",
      width: "10%",
      render: (value, row) => (
        <button
          type="button"
          onClick={() => setOpenId(row.id === openId ? null : row.id)}
          className="rounded font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {value}
        </button>
      ),
    },
    {
      key: "documentDate",
      header: "Document Date",
      subHeader: "(Actual Date)",
      width: "15%",
    },
    {
      // The type and the life left in it read as one thing: what the paper is
      // and whether it still counts.
      key: "type",
      header: "Document Type",
      subHeader: "(Expiry Date & Status)",
      width: "30%",
      exportValue: (row) =>
        row.type +
        " - " +
        (row.expiryDate
          ? row.expiryDate + " (" + EXPIRY_LABEL[expiryState(row.expiryDate)] + ")"
          : "no expiry"),
      render: (value, row) => (
        <div className="space-y-1">
          <p className="font-medium">{value}</p>
          <ExpiryLine date={row.expiryDate} />
        </div>
      ),
    },
    {
      key: "fileName",
      header: "Document",
      width: "22%",
      render: (value, row) => (
        <button
          type="button"
          onClick={() => openFile(row)}
          className="flex items-start gap-2 rounded text-start text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
          {value}
        </button>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      width: "23%",
      render: (value) => (
        <span className="text-muted-foreground">{value || "-"}</span>
      ),
    },
  ];

  /*
   * Standard 08: drawn inside the table's own container rather than in
   * a card above it, so the list stays visible while it is filled in.
   */
  const addDocumentPanel = (
    <div className="space-y-4">
            <FormHeading
              icon={FileText}
              title="Add Document"
            />

            <div className="form-grid">
              <div data-required="true" className="form-field space-y-2">
                <Label htmlFor="supplierDocType">Document Type</Label>
                <div className="flex gap-2">
                  <Select
                    value={draft.type}
                    onValueChange={(value) => setField("type", value)}
                  >
                    <SelectTrigger id="supplierDocType" className="flex-1">
                      <SelectValue placeholder="Please Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* The file name lives in the tooltip, so the control stays
                      the size of a button either way. */}
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    title={
                      file ? file.name + " attached" : "Upload the document"
                    }
                    className={cn(
                      "shrink-0",
                      file && "border-green-600 text-green-600"
                    )}
                  >
                    <label
                      htmlFor="supplierDocFile"
                      className="cursor-pointer"
                    >
                      {file ? (
                        <FileCheck className="h-4 w-4" />
                      ) : (
                        <UploadIcon className="h-4 w-4" />
                      )}
                      <span className="sr-only">Upload the document</span>
                    </label>
                  </Button>
                  <Input
                    id="supplierDocFile"
                    type="file"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files[0] && setFile(e.target.files[0])
                    }
                  />
                </div>
                {file && (
                  <p className="truncate text-xs text-green-700">{file.name}</p>
                )}
              </div>

              {/* The date on the paper, not the day it reached the office. */}
              <div className="form-field space-y-2">
                <Label htmlFor="supplierDocDate">Document Date</Label>
                <DateField
                  required
                  id="supplierDocDate"
                  max={todayIso()}
                  value={draft.documentDate}
                  onChange={(e) => setField("documentDate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierDocExpiry">Expiry Date</Label>
                <DateField
                  id="supplierDocExpiry"
                  value={draft.expiryDate}
                  onChange={(e) => setField("expiryDate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierDocNotes">Notes</Label>
                <Input
                  id="supplierDocNotes"
                  value={draft.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Anything worth recording"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="button" onClick={save}>
                Save Document
              </Button>
            </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* One heading at a time: this row gives way to the form's own heading
          while a paper is being filed. The way to add sits on the row above
          the table, where every list in the system has it. */}
      {!adding && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <h2 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">
            Supplier Documents
          </h2>
        </div>
      )}


      {/* The opened document, above the table it was opened from. */}
      {opened && (
        <Card className="border-primary/40">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-primary">
                Document {opened.serial} &mdash; {opened.type}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Close details"
                onClick={() => setOpenId(null)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close details</span>
              </Button>
            </div>

            <div className="form-grid">
              <Detail label="Document Date">{opened.documentDate}</Detail>
              <Detail label="Expiry &amp; Status">
                <ExpiryLine date={opened.expiryDate} />
              </Detail>
              <Detail label="Document">
                <button
                  type="button"
                  onClick={() => openFile(opened)}
                  className="flex items-center gap-2 rounded text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  {opened.fileName}
                </button>
              </Detail>
              <Detail label="Notes">
                <span className="font-normal text-muted-foreground">
                  {opened.notes || "-"}
                </span>
              </Detail>
            </div>

            <div className="flex justify-end border-t pt-3">
              <Button
                type="button"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => removeDocument(opened.id)}
              >
                <Trash2 className="me-1.5 h-4 w-4" />
                Delete Document
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={documents}
        searchPlaceholder="Ask about this supplier's documents..."
        exportFileName="supplier-documents.csv"
        enableColumnSearch={false}
        onAdd={adding ? null : () => setAdding(true)}
        addLabel="Add Document"
        addPanel={adding ? addDocumentPanel : null}
        addPanelTitle="Add Document"
        addPanelNote={supplier?.name}
        onAddPanelClose={() => setAdding(false)}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
