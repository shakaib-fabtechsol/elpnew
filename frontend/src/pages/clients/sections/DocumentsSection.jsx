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
import DataTable from "@/components/shared/DataTable";
import {
  FileText,
  FileCheck,
  Trash2,
  Plus,
  AlertTriangle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { expiryState, EXPIRY_LABEL } from "@/lib/expiry";
import { clientDocuments } from "../clientMockData";
import { checkRequired } from "@/components/shared/formFields";

import DateField from "@/components/shared/DateField";
/**
 * Document types that carry fields the client record already holds.
 *
 * These are edited here and in Basic Info as one value - not copied - so a
 * change in either place is the same change. Adding another such type means
 * adding a row here and nothing else.
 */
/** The client's reference number and its expiry. Editing them here edits the
 *  client record itself. */
const REFERENCE_FIELDS = {
  expiryField: "referenceExpiryDate",
  fields: [
    {
      name: "referenceNo",
      label: "Reference No.",
      placeholder: "Enter reference number",
    },
    {
      name: "referenceExpiryDate",
      label: "Reference Expiry Date",
      type: "date",
    },
  ],
};

/**
 * Which client fields each document type carries.
 *
 * Only these three do. Everything else is a file with a note, so nothing extra
 * is asked for.
 */
const LINKED_FIELDS = {
  "Power of Attorney": {
    expiryField: "poaExpiryDate",
    fields: [
      { name: "poaNo", label: "POA No.", placeholder: "Enter POA number" },
      { name: "poaExpiryDate", label: "POA Expiry Date", type: "date" },
    ],
  },
  "Commercial Registration": REFERENCE_FIELDS,
  "ID Card": REFERENCE_FIELDS,
};

/** Today as a plain YYYY-MM-DD in the user's own timezone. */
const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

const emptyUpload = {
  documentType: "",
  documentDate: "",
  expiryDate: "",
  notes: "",
};

/**
 * An expiry date and what it means.
 *
 * The state is said in words as well as colour: a red date on its own tells
 * anyone who cannot see it nothing at all, and tells everyone else only that
 * something is wrong - not whether the paper has weeks left or has already
 * lapsed.
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
              // Hollow while the date is only approaching, solid once it
              // has passed - the same two marks the rest of the system uses.
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
 * The papers filed against a client.
 *
 * Status is never stored - it is read off the expiry date every render, so a
 * document cannot sit in the list calling itself valid after its date has
 * passed.
 *
 * Deleting is deliberately not a button in every row. A row is opened first,
 * read, and only then deleted, so a paper cannot be thrown away by a stray
 * click on a table of near-identical lines.
 */
export default function DocumentsSection({ formData, onChange }) {
  const [documents, setDocuments] = useState(clientDocuments);
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState(emptyUpload);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const linked = LINKED_FIELDS[draft.documentType];
  const opened = documents.find((d) => d.id === openId) || null;

  const setField = (name, value) =>
    setDraft((prev) => ({ ...prev, [name]: value }));

  const handleFileChange = (e) => {
    const chosen = e.target.files[0];
    if (chosen) setFile(chosen);
  };

  const closeForm = () => {
    setAdding(false);
    setFile(null);
    setDraft(emptyUpload);
  };

  const removeDocument = (id) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setOpenId(null);
  };

  const handleSave = () => {
    if (!checkRequired() || !canSave) return;
    setDocuments((prev) => {
      const next = prev.reduce((max, d) => Math.max(max, d.serial), 0) + 1;
      return [
        ...prev,
        {
          id: next,
          serial: next,
          documentType: draft.documentType,
          fileName: file.name,
          fileUrl: URL.createObjectURL(file),
          documentDate: draft.documentDate,
          expiryDate: linked ? formData[linked.expiryField] : draft.expiryDate,
          notes: draft.notes,
          linkedFileNo: null,
        },
      ];
    });
    closeForm();
  };

  const canSave =
    file &&
    draft.documentType &&
    draft.documentDate &&
    (!linked || linked.fields.every((field) => formData[field.name]));

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
          // Reading a paper closes the form that was being filled in: only
          // one of the two belongs on screen.
          onClick={() => {
            setAdding(false);
            setOpenId(row.id === openId ? null : row.id);
          }}
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
      width: "14%",
    },
    {
      // The type and the life left in it read as one thing: what the paper is
      // and whether it still counts.
      key: "documentType",
      header: "Document Type",
      subHeader: "(Expiry Date & Status)",
      width: "30%",
      exportValue: (row) =>
        row.documentType +
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
      width: "24%",
      render: (value) => (
        <span className="text-muted-foreground">{value || "-"}</span>
      ),
    },
  ];

  /*
   * Standard 08: the add form, drawn inside the table's own container
   * rather than in a card above it. Held in a variable so its markup
   * stays beside the state it is filled from, and handed to the table
   * below as `addPanel`.
   */
  const addDocumentPanel = (
    <div className="space-y-4">
            <div className="form-grid">
              <div data-required="true" className="form-field space-y-2">
                <Label htmlFor="documentType">Document Type</Label>
                <div className="flex gap-2">
                  <Select
                    value={draft.documentType}
                    onValueChange={(value) => setField("documentType", value)}
                  >
                    <SelectTrigger id="documentType" className="flex-1">
                      <SelectValue placeholder="Please Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
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
                      title="Upload file"
                      asChild
                    >
                      <label className="cursor-pointer">
                        <UploadIcon className="h-4 w-4" />
                        <span className="sr-only">Upload file</span>
                        <Input
                          type="file"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </Button>
                  )}
                </div>
              </div>

              {/* The date on the paper, not the day it reached the office. */}
              <div className="form-field space-y-2">
                <Label htmlFor="documentDate">Document Date</Label>
                <DateField
                  required
                  id="documentDate"
                  max={todayIso()}
                  value={draft.documentDate}
                  onChange={(e) => setField("documentDate", e.target.value)}
                />
              </div>

              {/* These read and write the client's own fields, so editing them
                  here or in Basic Info changes the same value. */}
              {linked?.fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={"document-" + field.name}>
                    {field.label} *
                  </Label>
                  <Input
                    id={"document-" + field.name}
                    name={field.name}
                    type={field.type || "text"}
                    value={formData[field.name]}
                    onChange={onChange}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}

              {/* A type that carries no client field brings its own expiry. */}
              {!linked && (
                <div className="space-y-2">
                  <Label htmlFor="documentExpiry">Expiry Date</Label>
                  <DateField
                    id="documentExpiry"
                    value={draft.expiryDate}
                    onChange={(e) => setField("expiryDate", e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="documentNotes">Note</Label>
                <Input
                  id="documentNotes"
                  value={draft.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Add a note about this document"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave}>
                Save Document
              </Button>
            </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* The section's own heading, so the way to add to it sits on the
          same line rather than costing a row of its own. */}
      {/* The section's own heading. The way to add is not here: it sits on
          the row above the table, where every list in the system has it. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <h2 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">Documents</h2>
      </div>


      {/* The list stays under the form rather than making way for it: a
          new record is judged against the ones already there. */}

      {/* The opened document, above the table it was opened from. */}
      {opened && (
        <Card className="border-primary/40">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-primary">
                Document {opened.serial} &mdash; {opened.documentType}
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
        searchPlaceholder="Search documents..."
        enableColumnSearch={false}
        // Opening the form closes any paper that was being read: only one of
        // the two belongs on screen.
        onAdd={
          adding
            ? null
            : () => {
                setOpenId(null);
                setAdding(true);
              }
        }
        addLabel="Add Document"
        addPanel={adding ? addDocumentPanel : null}
        addPanelTitle="Add Document"
        addPanelNote={formData?.clientName}
        onAddPanelClose={() => setAdding(false)}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

    </div>
  );
}
