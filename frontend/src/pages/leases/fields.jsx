import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UploadIcon from "@/components/shared/UploadIcon";
import DateField from "@/components/shared/DateField";
import { FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** A field's label. */
export function FieldLabel({ htmlFor, children }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
    </Label>
  );
}

export function Field({ className, children, ...rest }) {
  // `form-field` is what the message under an empty required field anchors
  // to, and `rest` carries the data-required that says a field is one.
  return (
    <div
      className={cn("form-field flex h-full flex-col justify-end gap-2", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/** A choice from a list. Empty values are ignored - nobody picks "nothing". */
export function Choice({ id, label, value, onChange, options, placeholder = "Please Select", disabled, children }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label}
      </FieldLabel>
      <div className="flex gap-2">
        <Select
          value={value}
          onValueChange={(next) => next && onChange(next)}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="min-w-0 flex-1">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {children}
      </div>
    </Field>
  );
}

/** A figure worked out from the fields beside it - shown, never typed. */
export function Worked({ id, label, value }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        readOnly
        tabIndex={-1}
        className="cursor-default bg-locked text-muted-foreground"
        value={value}
        placeholder="Auto calculated"
      />
    </Field>
  );
}

/** A typed field, with anything that belongs beside the input (an upload) after it. */
export function TextField({ id, label, required, value, onChange, placeholder, type, inputMode, max, children }) {
  // Dates are typed DD/MM/YYYY, never in the browser's own order.
  const Control = type === "date" ? DateField : Input;
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label}
      </FieldLabel>
      <div className="flex gap-2">
        <Control
          required={required}
          id={id}
          type={type === "date" ? undefined : type}
          inputMode={inputMode}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="min-w-0 flex-1"
        />
        {children}
      </div>
    </Field>
  );
}

/**
 * A file attached beside the field it backs. The name lives in the tooltip,
 * so the control stays the size of a button whether a file is there or not.
 */
export function Attach({ id, file, onFile, what }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      asChild
      title={file ? file + " attached" : "Upload " + what}
      className={cn("shrink-0", file && "border-green-600 text-green-600")}
    >
      <label className="cursor-pointer">
        {file ? <FileCheck className="h-4 w-4" /> : <UploadIcon className="h-4 w-4" />}
        <span className="sr-only">Upload {what}</span>
        <Input
          id={id}
          type="file"
          className="hidden"
          onChange={(e) => e.target.files[0] && onFile(e.target.files[0].name)}
        />
      </label>
    </Button>
  );
}
