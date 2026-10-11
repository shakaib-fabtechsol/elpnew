import { useEffect, useRef, useState } from "react";
import { CONFIDENCE_FLOOR, extractDemo, intakeType, mapExtraction, needsReview, requiredFields } from "./documentIntake";
import { employeesApi } from "@/lib/api/modules/employees";

// How long the demo takes to read a paper, so the step shows it working.
const READ_MS = 900;

/**
 * The papers of an employee being added, and what they have filled in.
 *
 * Holds the uploaded papers and, for every value they filled, its source,
 * confidence and review status. Reading a paper runs the whole pipeline -
 * classify, extract, map to fields, detect conflicts, fill the draft - and
 * writes only into fields the user has not confirmed or typed themselves.
 */
export function useDocumentIntake(formData, setFormData) {
  const [docs, setDocs] = useState([]);
  const [meta, setMeta] = useState({});
  // Read by the timers, which outlive the render they were started from.
  const latest = useRef({ formData, docs, meta });
  useEffect(() => {
    latest.current = { formData, docs, meta };
  });
  const nextId = useRef(0);

  /**
   * What one paper says. Read by the AI on the server; where no AI is
   * connected the sample reading stands in (and is marked `sample`), and a
   * reading that failed leaves the paper to be typed in by hand.
   */
  const readOne = async (doc) => {
    if (!doc.size || !doc.file) return extractDemo(doc);
    try {
      const read = await employeesApi.readPaper(doc.file, doc.typeKey);
      if (!read.available) return { ...extractDemo(doc), sample: true };
      const type = intakeType(read.typeKey);
      return {
        typeKey: read.typeKey,
        fields: read.fields,
        number: type?.numberKey ? read.fields[type.numberKey]?.value || "" : "",
        expiry: type?.expiryKey ? read.fields[type.expiryKey]?.value || "" : "",
        qualification: read.qualification || null,
        // Somebody already on file with this civil ID, said before saving.
        duplicateOf: read.duplicateOf || null,
        status: Object.values(read.fields).some((field) => field.confidence < CONFIDENCE_FLOOR) ? "review" : "processed",
        sample: false,
      };
    } catch (error) {
      return { status: "failed", typeKey: doc.typeKey || "other", fields: {}, problem: error?.message || "This paper could not be read." };
    }
  };

  /** Puts one paper's reading in its place, then maps everything read into the draft. */
  const settle = (id, reading) => {
    const { docs: now, formData: current, meta: previous } = latest.current;
    // Removed, or replaced by another copy, while it was being read.
    if (!now.some((doc) => doc.id === id)) return;
    const read = now.map((doc) => (doc.id === id ? { ...doc, ...reading } : doc));
    const { meta: mapped, fills } = mapExtraction(read, current, previous);
    latest.current = { ...latest.current, docs: read, meta: mapped };
    setDocs(read);
    setMeta(mapped);
    if (Object.keys(fills).length) setFormData((prev) => ({ ...prev, ...fills }));
  };

  /** Reads the given papers, each as soon as its own reading comes back. */
  const readLater = (ids) =>
    setTimeout(() => {
      latest.current.docs
        .filter((doc) => ids.includes(doc.id))
        .forEach((doc) => {
          const copy = doc.file;
          readOne(doc).then((reading) => {
            // A newer copy of the same paper is being read instead.
            const still = latest.current.docs.find((one) => one.id === doc.id);
            if (still && still.file === copy) settle(doc.id, reading);
          });
        });
    }, READ_MS);

  const fromFile = (file, typeKey) => {
    nextId.current += 1;
    return {
      id: nextId.current,
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
      // The copy itself, sent to the API when the paper is filed.
      file,
      size: file.size,
      // Chosen from a tile, or left for classification to decide.
      typeKey: typeKey || null,
      status: "processing",
    };
  };

  /** Several papers at once; each is classified unless a kind was chosen. */
  const upload = (files, typeKey) => {
    const added = files.map((file) => fromFile(file, typeKey));
    setDocs((prev) => [...prev, ...added]);
    readLater(added.map((doc) => doc.id));
  };

  /** A new copy of a paper, read afresh in its place. */
  const replace = (id, file) => {
    setDocs((prev) =>
      prev.map((doc) => (doc.id === id ? { ...fromFile(file, null), id } : doc))
    );
    readLater([id]);
  };

  /** The kind put right by hand, and the paper read again as that kind. */
  const retype = (id, typeKey) => {
    setDocs((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, typeKey, status: "processing" } : doc))
    );
    readLater([id]);
  };

  const remove = (id) => {
    const rest = docs.filter((doc) => doc.id !== id);
    setDocs(rest);
    // What only that paper said is no longer sourced; what the user settled stays.
    const { meta: mapped } = mapExtraction(rest, formData, meta);
    setMeta(mapped);
  };

  /** Every paper read again; confirmed values stay as they are. */
  const reprocess = () => {
    setDocs((prev) => prev.map((doc) => ({ ...doc, status: "processing" })));
    readLater(docs.map((doc) => doc.id));
  };

  /** A value settled by the user: filled in, and never written over. */
  const confirm = (key, value, source) => {
    setMeta((prev) => ({
      ...prev,
      [key]: { ...prev[key], value, source: source || prev[key]?.source, status: "Confirmed" },
    }));
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  /** A fresh start, for another employee being added. */
  const reset = () => {
    setDocs([]);
    setMeta({});
  };

  const busy = docs.some((doc) => doc.status === "processing");
  // Field marks are shown once there is something read and nothing still reading.
  const settled = docs.length > 0 && !busy;
  const reviewKeys = Object.keys(meta).filter((key) => needsReview(meta[key], formData[key]));
  const missingKeys = requiredFields(formData).filter((key) => !formData[key]);
  // A read paper waits on review while anything it said does: a value too
  // unsure to take, or one another paper disagrees with. Once settled, it is
  // Processed.
  const reviewSources = new Set(
    reviewKeys.flatMap((key) =>
      meta[key].status === "Conflict"
        ? meta[key].candidates.map((candidate) => candidate.source)
        : [meta[key].source]
    )
  );
  const shownDocs = docs.map((doc) =>
    doc.status === "processing" || doc.status === "failed"
      ? doc
      : { ...doc, status: reviewSources.has(doc.fileName) ? "review" : "processed" }
  );
  const summary = {
    processed: shownDocs.filter((doc) => doc.status === "processed").length,
    total: docs.length,
    autoFilled: Object.values(meta).filter((entry) => entry.source !== "Entered manually").length,
    review: reviewKeys.length,
    missing: missingKeys.length,
  };

  return {
    docs: shownDocs,
    meta,
    busy,
    settled,
    reviewKeys,
    missingKeys,
    summary,
    upload,
    replace,
    retype,
    remove,
    reprocess,
    confirm,
    reset,
  };
}
