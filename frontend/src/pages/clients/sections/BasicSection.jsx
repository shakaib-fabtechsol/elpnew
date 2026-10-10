import { Input } from "@/components/ui/input";
import UploadIcon from "@/components/shared/UploadIcon";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip, X } from "lucide-react";
import { CLIENT_TYPES } from "@/lib/constants";
import { MANUAL_CLIENT_STATUSES } from "@/lib/clientStatus";

import DateField from "@/components/shared/DateField";
/** A stored date as it is read on the page: 2026-09-04 becomes 04/09/2026. */
const formatDate = (iso) => {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return day + "/" + month + "/" + year;
};

/**
 * A number and the copy that proves it, kept in one field.
 *
 * The upload sits inside the field rather than beside it, so it cannot drift
 * into the neighbouring column when the grid narrows.
 */
function NumberWithCopy({
  id,
  name,
  label,
  placeholder,
  value,
  file,
  onChange,
  onFileChange,
}) {
  const fileName = typeof file === "string" ? file.split("/").pop() : "";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="min-w-0 flex-1"
          required
        />
        <label
          title={file ? "Replace copy" : "Upload copy"}
          className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border text-muted-foreground hover:bg-muted/50"
        >
          <UploadIcon className="h-4 w-4" />
          <span className="sr-only">Upload copy</span>
          <Input
            type="file"
            className="hidden"
            onChange={(e) =>
              e.target.files[0] && onFileChange(e.target.files[0].name)
            }
          />
        </label>
      </div>

      {file && (
        /* A faint ground: the chip is a note that a file is attached, not a
           block of its own competing with the field above it. */
        <div className="flex h-8 items-center justify-between gap-2 rounded-md bg-muted/40 px-3">
          <span className="inline-flex min-w-0 items-center gap-1 text-xs text-primary">
            <Paperclip className="h-3 w-3 shrink-0" />
            <span className="truncate">{fileName}</span>
          </span>
          <button
            type="button"
            onClick={() => onFileChange("")}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Remove copy</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function BasicSection({
  formData,
  clientType,
  status,
  statusLocked,
  statusNote,
  onChange,
  onClientTypeChange,
  onStatusChange,
  onFileChange,
}) {
  const isInactive = status !== "Active";

  const statusOptions = MANUAL_CLIENT_STATUSES.includes(status)
    ? MANUAL_CLIENT_STATUSES
    : [...MANUAL_CLIENT_STATUSES, status];

  return (
    // Three to a row, the width every form in the system is laid out on.
    <div className="form-grid form-grid-3">
      {/* Date of Registration - stamped by the system on creation.
          The day a client came on to the books is a record of what happened,
          not a choice, so it is shown rather than asked for. */}
      <div className="space-y-2">
        <Label htmlFor="dateOfRegistration">Date of Registration</Label>
        <Input
          id="dateOfRegistration"
          value={formatDate(formData.dateOfRegistration)}
          readOnly
          tabIndex={-1}
          className="cursor-default bg-locked text-muted-foreground"
        />
      </div>

      {/* Client Type */}
      <div data-required="true" className="form-field space-y-2">
        <Label htmlFor="clientType">Client Type</Label>
        <Select value={clientType} onValueChange={onClientTypeChange}>
          <SelectTrigger id="clientType">
            <SelectValue placeholder="Select client type" />
          </SelectTrigger>
          <SelectContent>
            {CLIENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Client Name (Arabic) */}
      <div className="form-field space-y-2">
        <Label htmlFor="arabicName">Client Name (Arabic)</Label>
        <Input
          id="arabicName"
          name="arabicName"
          value={formData.arabicName}
          onChange={onChange}
          placeholder="أدخل الاسم بالعربية"
          dir="rtl"
          required
        />
      </div>

      {/* Client Name (English) */}
      <div className="form-field space-y-2">
        <Label htmlFor="englishName">Client Name (English)</Label>
        <Input
          id="englishName"
          name="englishName"
          value={formData.englishName}
          onChange={onChange}
          placeholder="Enter name in English"
          required
        />
      </div>

      {/* Reference No, with the copy of it */}
      <NumberWithCopy
        id="referenceNo"
        name="referenceNo"
        label="Reference No. *"
        placeholder="Enter reference number"
        value={formData.referenceNo}
        file={formData.referenceCopy}
        onChange={onChange}
        onFileChange={(file) => onFileChange("referenceCopy", file)}
      />

      {/* Reference Expiry Date */}
      <div className="form-field space-y-2">
        <Label htmlFor="referenceExpiryDate">Reference Expiry Date</Label>
        <DateField
          id="referenceExpiryDate"
          name="referenceExpiryDate"
          value={formData.referenceExpiryDate}
          onChange={onChange}
          required
        />
      </div>

      {/* POA No, with the copy of it */}
      <NumberWithCopy
        id="poaNo"
        name="poaNo"
        label="POA No. *"
        placeholder="Enter POA number"
        value={formData.poaNo}
        file={formData.poaCopy}
        onChange={onChange}
        onFileChange={(file) => onFileChange("poaCopy", file)}
      />

      {/* POA Expiry Date */}
      <div className="form-field space-y-2">
        <Label htmlFor="poaExpiryDate">POA Expiry Date</Label>
        <DateField
          id="poaExpiryDate"
          name="poaExpiryDate"
          value={formData.poaExpiryDate}
          onChange={onChange}
          required
        />
      </div>

      {/* Status. Merged is never offered as a choice - it is the outcome of a
          merge - but a client that has been merged still has to be able to say
          so, so its own status is listed alongside. */}
      <div className="space-y-2">
        <Label htmlFor="clientStatus">Status</Label>
        <Select
          value={status}
          onValueChange={onStatusChange}
          disabled={statusLocked}
        >
          <SelectTrigger id="clientStatus">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {statusNote && (
          <p className="text-xs text-muted-foreground">{statusNote}</p>
        )}
      </div>

      {/* When and why the client was deactivated. Both only exist while
          the client is Inactive: an active client has no date to give and
          nothing to explain, so asking would only invite stale answers. */}
      {isInactive && (
        <>
          <div className="space-y-2">
            <Label htmlFor="deactivationDate">Deactivation Date</Label>
            <DateField
              id="deactivationDate"
              name="deactivationDate"
              value={formData.deactivationDate}
              onChange={onChange}
            />
          </div>

          {/* Given the width of two fields because it is a sentence
              rather than a value, but the height of one so the row stays
              level with the fields beside it. */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="deactivationReason">Deactivation Reason</Label>
            <Input
              id="deactivationReason"
              name="deactivationReason"
              value={formData.deactivationReason}
              onChange={onChange}
              placeholder="Reason for deactivating this client"
            />
          </div>
        </>
      )}

    </div>
  );
}
