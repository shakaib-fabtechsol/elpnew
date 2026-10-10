import { useRef, useState } from "react";
import { FileCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import UploadIcon from "@/components/shared/UploadIcon";
import { UPLOAD_RULES, describeUpload } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * A reference number, and the paper it came from.
 *
 * The cloud sits beside the field rather than inside it: an icon within the
 * border reads as part of the value being typed, and a filled square beside
 * it reads as a second field. Attached but outside, it is plainly an action
 * belonging to the reference next to it.
 *
 * The same control stands beside every reference the system asks for -
 * request, transaction, transfer, cheque and invoice - so attaching a
 * document is one gesture wherever it is met.
 */
export default function ReferenceUpload({
  id,
  value,
  onChange,
  file,
  onFile,
  placeholder = "Enter reference number",
  rules = UPLOAD_RULES,
  className,
}) {
  const inputRef = useRef(null);
  const [tooBig, setTooBig] = useState(false);

  const pick = (chosen) => {
    if (!chosen) return;
    if (chosen.size > rules.maxBytes) {
      setTooBig(true);
      return;
    }
    setTooBig(false);
    onFile?.(chosen);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-2.5">
        <Input
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="flex-1"
        />
        {/* No fill and no box of its own - the mark is the whole control. */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          title="Attach a document"
          className="shrink-0 rounded-md p-1 text-primary transition-colors hover:text-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <UploadIcon strokeWidth={1.5} className="size-6" />
          <span className="sr-only">Attach a document</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={rules.accept}
          className="hidden"
          onChange={(e) => pick(e.target.files[0])}
        />
      </div>

      {/* What the system will take, read from the one place it is set. */}
      <p className="mt-1.5 text-xs text-muted-foreground">{describeUpload(rules)}</p>

      {tooBig && (
        <p className="field-error" role="alert">
          That file is larger than {describeUpload(rules).split("\u00b7")[1].trim()}.
        </p>
      )}

      {file && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
          <FileCheck className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onFile?.(null)}
            className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="size-3.5" />
            <span className="sr-only">Remove {file.name}</span>
          </button>
        </p>
      )}
    </div>
  );
}
