import { Button } from "@/components/ui/button";
import UploadIcon from "@/components/shared/UploadIcon";
import { Input } from "@/components/ui/input";
import { FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A place to drop one file.
 *
 * It is drawn with a dashed edge while it is empty and a solid green one once
 * a file is held, so an unfilled upload reads as an empty slot rather than as
 * a button somebody forgot to press. The file name replaces the prompt, which
 * is the only confirmation the control needs to give.
 */
export default function UploadBox({ file, onSelect, accept = ".pdf,.jpg,.jpeg,.png" }) {
  if (file) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-14 w-full justify-start border-green-600 text-green-600 hover:text-destructive"
        title={file.name + " - click to remove"}
        onClick={() => onSelect(null)}
      >
        <FileCheck className="me-2 h-4 w-4 shrink-0" />
        <span className="truncate">{file.name}</span>
      </Button>
    );
  }

  return (
    <label
      className={cn(
        "flex h-14 cursor-pointer items-center justify-center gap-2 rounded-md",
        "border border-dashed border-primary/40 text-sm font-medium text-primary",
        "transition-colors hover:bg-secondary"
      )}
    >
      <UploadIcon className="h-4 w-4" />
      Upload Document
      <Input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files[0] && onSelect(e.target.files[0])}
      />
    </label>
  );
}
