import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/pages/firm/firmData";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleX,
  CloudUpload,
  Eye,
  File,
  FileSignature,
  FileText,
  FileUser,
  Globe,
  GraduationCap,
  IdCard,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  SquareUserRound,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { INTAKE_ACCEPT, INTAKE_TYPES, intakeFileProblem, intakeType } from "../documentIntake";

/** Each kind's mark and colour, on its tile and its chip in the table. */
const LOOK = {
  civilId: { icon: IdCard, tile: "bg-blue-50 text-blue-600", chip: "bg-blue-50 text-blue-700" },
  passport: { icon: Globe, tile: "bg-slate-800 text-white", chip: "bg-violet-50 text-violet-700" },
  contract: { icon: FileSignature, tile: "bg-emerald-50 text-emerald-600", chip: "bg-teal-50 text-teal-700" },
  cv: { icon: FileUser, tile: "bg-violet-50 text-violet-600", chip: "bg-violet-50 text-violet-700" },
  education: { icon: GraduationCap, tile: "bg-orange-50 text-orange-500", chip: "bg-orange-50 text-orange-600" },
  lawyerCard: { icon: SquareUserRound, tile: "bg-pink-50 text-pink-600", chip: "bg-pink-50 text-pink-700" },
  bank: { icon: Landmark, tile: "bg-cyan-50 text-cyan-600", chip: "bg-cyan-50 text-cyan-700" },
  other: { icon: File, tile: "bg-slate-100 text-slate-600", chip: "bg-slate-100 text-slate-700" },
};

/** How each standing of a paper reads in the table. */
function DocumentStatus({ status }) {
  if (status === "processing")
    return (
      <span className="flex items-center gap-2 font-medium text-blue-700">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        Processing
      </span>
    );
  if (status === "review")
    return (
      <span className="flex items-center gap-2 font-medium text-amber-600">
        <TriangleAlert className="size-5 fill-amber-500 text-white" aria-hidden="true" />
        Review Required
      </span>
    );
  if (status === "failed")
    return (
      <span className="flex items-center gap-2 font-medium text-red-700">
        <CircleX className="size-5 fill-red-600 text-white" aria-hidden="true" />
        Failed
      </span>
    );
  return (
    <span className="flex items-center gap-2 font-medium text-green-700">
      <span className="flex size-5 items-center justify-center rounded-full bg-green-600 text-white">
        <Check className="size-3.5" aria-hidden="true" />
      </span>
      Processed
    </span>
  );
}

/** A small icon button on a row of the table. */
function RowAction({ label, onClick, danger, children }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        "rounded-md p-1.5 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        danger ? "hover:bg-red-50 hover:text-destructive" : "hover:bg-menu-hover"
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * Step one of Add Employee: the papers first, and the profile filled in from
 * them.
 *
 * Papers can be dropped several at once without saying what they are: each
 * is classified, read, mapped onto the profile and checked against the
 * others, and the draft is filled. A tile's + uploads a paper already known
 * to be of that kind. A kind guessed wrong is put right in the table, and the
 * paper is read again as that kind.
 */
export default function DocumentIntake({
  intake,
  onContinue,
  onCancel,
  // On a record: the papers already filed, listed first and only viewed.
  filed = [],
  // On a record: its own Cancel and Save in place of Continue.
  footer = null,
}) {
  const { docs, busy, summary } = intake;
  const rows = [...filed.map((paper) => ({ ...paper, filed: true })), ...docs];
  // The upload panel: closed, open for any paper (""), or for one kind.
  const [uploading, setUploading] = useState(null);
  const [problem, setProblem] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  // The row whose paper is being replaced, while its file is chosen.
  const replaceRef = useRef(null);
  const replacing = useRef(null);
  const open = uploading !== null;

  // The upload panel closes on a click anywhere outside it, or on Escape.
  // A click on another tile closes it here and opens it again for that kind.
  useEffect(() => {
    if (!open) return;
    const close = () => {
      setUploading(null);
      setProblem("");
      setDragging(false);
    };
    const onPointer = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) close();
    };
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPanel = (typeKey) => {
    setUploading(typeKey);
    setProblem("");
  };
  const closePanel = () => {
    setUploading(null);
    setProblem("");
    setDragging(false);
  };

  /** Every file that can be taken is; the rest are named and why. */
  const take = (fileList) => {
    const files = [...fileList];
    const wrong = files.map(intakeFileProblem).filter(Boolean);
    const good = files.filter((file) => !intakeFileProblem(file));
    if (good.length) intake.upload(good, uploading || null);
    if (wrong.length) setProblem(wrong.join(" "));
    else closePanel();
  };

  const kind = uploading ? intakeType(uploading)?.label : "";

  return (
    <Card>
      <CardContent className="relative p-4 sm:p-6">
        {/* The step's head, as every step of Add Employee has it, with the
            way to upload any paper without saying first what it is. */}
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b pb-4">
          <span aria-hidden="true" className="w-1 self-stretch rounded-full bg-primary" />
          <FileText strokeWidth={1.5} aria-hidden="true" className="size-8 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-primary">Document Intake</h2>
            <p className="text-sm text-primary/75">
              Upload employee documents. SADEED will classify them, extract the
              information and automatically fill the employee profile.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => openPanel("")}>
            <Upload className="me-2 h-4 w-4" aria-hidden="true" />
            Upload Documents
          </Button>
        </div>

        {/* One tile per kind of paper; the + under it adds one of that kind. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {INTAKE_TYPES.map((type) => {
            const look = LOOK[type.key];
            const Icon = look.icon;
            return (
              <button
                key={type.key}
                type="button"
                onClick={() => openPanel(type.key)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border bg-blue-50/30 px-2 py-3 text-center transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  uploading === type.key && "border-blue-600 bg-blue-50"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("flex size-12 items-center justify-center rounded-lg", look.tile)}
                >
                  <Icon className="size-6" strokeWidth={1.75} />
                </span>
                <span className="flex min-h-10 items-center text-sm font-medium leading-tight text-primary">
                  {type.label}
                </span>
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-full bg-white text-primary shadow-sm"
                >
                  <Plus className="size-4" />
                </span>
                <span className="sr-only">Upload {type.label}</span>
              </button>
            );
          })}
        </div>

        {/* Where papers are dropped or chosen, over the tiles' right side. */}
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Upload Documents"
            className="absolute end-4 top-4 z-20 w-[calc(100%-2rem)] space-y-4 rounded-xl border bg-card p-5 shadow-xl sm:end-6 sm:top-6 sm:w-md"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-primary">
                Upload Document
                <span className="ms-2 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {kind || "Type detected automatically"}
                </span>
              </h3>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-md p-1 text-primary hover:bg-menu-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-5" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files?.length) take(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
                dragging ? "border-blue-600 bg-blue-50" : "border-blue-200 bg-blue-50/30"
              )}
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <CloudUpload className="size-7" aria-hidden="true" />
              </span>
              <p className="font-semibold text-primary">Drag &amp; drop your files here</p>
              <p className="text-sm text-primary/75">or click to browse - several at once</p>
              <Button
                type="button"
                variant="outline"
                className="mt-1"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <Upload className="me-2 h-4 w-4" aria-hidden="true" />
                Browse Files
              </Button>
              <p className="text-xs text-muted-foreground">
                Supported formats: PDF, JPG, JPEG, PNG (Max 10 MB each)
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={INTAKE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files?.length) take(files);
                  e.target.value = "";
                }}
              />
            </div>
            {problem && (
              <p role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            )}
            <div className="flex justify-end border-t pt-4">
              <Button type="button" variant="outline" onClick={closePanel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* The file that replaces a row's paper, chosen from the row. */}
        <input
          ref={replaceRef}
          type="file"
          accept={INTAKE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file && replacing.current && !intakeFileProblem(file)) {
              intake.replace(replacing.current, file);
            }
            replacing.current = null;
          }}
        />

        {/* What has been uploaded, and what was read from each. */}
        <section className="mt-6 overflow-hidden rounded-xl border">
          <h3 className="px-4 py-3 font-bold text-primary">
            Uploaded Documents ({rows.length})
          </h3>
          {rows.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No documents uploaded yet. Upload them all at once, or choose a
              document type above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-190 text-sm">
                <thead className="bg-table-head text-start text-xs font-semibold text-primary">
                  <tr>
                    <th className="px-4 py-2 text-start">Document Name</th>
                    <th className="px-4 py-2 text-start">Document Type</th>
                    <th className="px-4 py-2 text-start">Document Number</th>
                    <th className="px-4 py-2 text-start">Expiry Date</th>
                    <th className="px-4 py-2 text-start">Status</th>
                    <th className="px-4 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((doc) => (
                    <tr key={doc.id} className="border-t">
                      <td className="px-4 py-2.5 text-primary">{doc.fileName}</td>
                      <td className="px-4 py-2.5">
                        {/* A paper already on the record keeps the kind it was
                            filed as; a new one's kind, as classified, is open
                            to be put right. */}
                        {doc.filed ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {doc.typeLabel}
                          </span>
                        ) : doc.typeKey ? (
                          <span className="relative inline-flex items-center">
                            <select
                              aria-label={"Document type of " + doc.fileName}
                              value={doc.typeKey}
                              disabled={doc.status === "processing"}
                              onChange={(e) => intake.retype(doc.id, e.target.value)}
                              className={cn(
                                "cursor-pointer appearance-none rounded-md py-1 ps-2 pe-6 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                LOOK[doc.typeKey].chip
                              )}
                            >
                              {INTAKE_TYPES.map((type) => (
                                <option key={type.key} value={type.key}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              aria-hidden="true"
                              className="pointer-events-none absolute end-1.5 size-3.5 text-current opacity-70"
                            />
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Classifying...</span>
                        )}
                        {doc.qualification && (
                          <span className="mt-1 block text-xs text-primary/75">
                            {doc.qualification.degree} · {doc.qualification.institution}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-primary">{doc.number || "-"}</td>
                      <td className="px-4 py-2.5 text-primary">
                        {doc.expiry ? formatDate(doc.expiry) : "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <DocumentStatus status={doc.filed ? "processed" : doc.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          {(doc.fileUrl || doc.onView) && (
                            <RowAction
                              label={"View " + doc.fileName}
                              onClick={() =>
                                // A filed paper is fetched from the API; a new one is still in the browser.
                                doc.onView ? doc.onView() : window.open(doc.fileUrl, "_blank", "noopener,noreferrer")
                              }
                            >
                              <Eye className="size-4" aria-hidden="true" />
                            </RowAction>
                          )}
                          {!doc.filed && (
                          <>
                          <RowAction
                            label={"Replace " + doc.fileName}
                            onClick={() => {
                              replacing.current = doc.id;
                              replaceRef.current?.click();
                            }}
                          >
                            <Upload className="size-4" aria-hidden="true" />
                          </RowAction>
                          <RowAction label={"Delete " + doc.fileName} onClick={() => intake.remove(doc.id)} danger>
                            <Trash2 className="size-4" aria-hidden="true" />
                          </RowAction>
                          </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* What the papers have done for the profile so far. */}
        {docs.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-green-100 bg-green-50/40 px-4 py-3">
            <p className="flex items-center gap-2 font-semibold text-green-700">
              <span className="flex size-7 items-center justify-center rounded-full bg-green-600 text-white">
                <Check className="size-4" aria-hidden="true" />
              </span>
              {summary.processed} of {summary.total} Documents Processed
            </p>
            {[
              { icon: FileText, tone: "text-blue-600", value: summary.autoFilled, label: "Fields Auto-filled" },
              { icon: TriangleAlert, tone: "text-amber-500", value: summary.review, label: "Fields Need Review" },
              { icon: CircleAlert, tone: "text-red-600", value: summary.missing, label: "Required Fields Missing" },
            ].map((fact) => {
              const Icon = fact.icon;
              return (
                <div key={fact.label} className="flex items-center gap-2 border-s ps-6">
                  <Icon className={cn("size-6", fact.tone)} aria-hidden="true" />
                  <div>
                    <p className="text-lg font-bold leading-none text-primary">{fact.value}</p>
                    <p className="text-xs text-primary/75">{fact.label}</p>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" className="ms-auto" onClick={intake.reprocess} disabled={busy}>
              <RefreshCw className={cn("me-2 h-4 w-4", busy && "animate-spin")} aria-hidden="true" />
              Reprocess Documents
            </Button>
          </div>
        )}

        {footer ? (
          <div className="mt-6 border-t pt-4">{footer}</div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button type="button" variant="outline" className="min-w-28" onClick={onCancel}>
              Cancel
            </Button>
            {/* The same as every step's Save. */}
            <Button type="button" disabled={busy} onClick={onContinue}>
              Continue to Personal Information
              <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * What still waits on a person on the step open: values two papers disagree
 * on, each with the paper it came from, and readings too unsure to take as
 * read. Choosing or confirming one settles it - the papers will not change it
 * again.
 */
export function IntakeReview({ items, onConfirm }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <h3 className="flex items-center gap-2 font-bold text-amber-800">
        <TriangleAlert className="size-5" aria-hidden="true" />
        Review required ({items.length})
      </h3>
      <ul className="space-y-3">
        {items.map(({ key, label, entry }) => (
          <li key={key} className="rounded-lg border border-amber-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-primary">
              {label}
              <span className="ms-2 font-normal text-amber-700">
                {entry.status === "Conflict"
                  ? "Documents disagree - choose the correct value"
                  : "Uncertain reading - confirm or correct it in the field"}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(entry.status === "Conflict"
                ? entry.candidates.filter(
                    (c, i, all) => all.findIndex((o) => String(o.value) === String(c.value)) === i
                  )
                : [entry]
              ).map((candidate) => (
                <button
                  key={candidate.source + candidate.value}
                  type="button"
                  onClick={() => onConfirm(key, candidate.value, candidate.source)}
                  className="rounded-md border px-3 py-1.5 text-start text-sm transition-colors hover:border-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block font-semibold text-primary">{String(candidate.value)}</span>
                  <span className="block text-xs text-primary/75">
                    {candidate.source} · {candidate.confidence}%
                    {entry.status === "Conflict" ? " · Use this" : " · Confirm"}
                  </span>
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
