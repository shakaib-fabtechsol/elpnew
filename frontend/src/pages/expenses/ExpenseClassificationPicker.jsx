import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2 } from "lucide-react";
import {
  EXPENSE_TYPES,
  LEVEL_LABELS,
  LINK_LABELS,
  categoriesOf,
  optionsForPath,
  isPathComplete,
} from "@/lib/expenses/taxonomy";
import { LINK_SOURCES, findType } from "./links";

/**
 * Cascading Type -> Category -> Subcategory -> Item picker.
 *
 * Only the levels a branch actually has are shown, because the tree is not the
 * same depth everywhere: Office Expenses goes four deep, Marketing two.
 *
 * When the chosen type relates to a case, employee, fixed asset or partner, the
 * matching record picker appears and is required - the client's rule that such
 * an expense must be tied to the record it belongs to.
 */
export default function ExpenseClassificationPicker({
  types = EXPENSE_TYPES,
  value,
  onChange,
  idPrefix = "expense",
}) {
  const type = findType(value.typeKey);
  const levels = optionsForPath(type, value.path);
  const linkKind = type?.link || null;
  // Nothing beyond the classification is offered until it is complete, so the
  // form reveals one decision at a time.
  const complete = isPathComplete(type, value.path);
  const source = linkKind ? LINK_SOURCES[linkKind] : null;

  const setType = (typeKey) =>
    onChange({ typeKey, path: [], linkKind: findType(typeKey)?.link || null, linkId: null });

  // Choosing at one level clears everything below it.
  const setLevel = (index, name) =>
    onChange({ ...value, path: [...value.path.slice(0, index), name] });

  // A category can name its own subcategories - under Rent they are the
  // property types, and the field says so.
  const labelAt = (index) =>
    (index === 1 &&
      categoriesOf(type).find((category) => category.name === value.path[0])?.childLabel) ||
    LEVEL_LABELS[index + 1] ||
    "Detail";

  return (
    <>
      <div data-required="true" className="form-field space-y-2">
        <Label htmlFor={idPrefix + "-type"}>{LEVEL_LABELS[0]}</Label>
        <Select value={value.typeKey || ""} onValueChange={setType}>
          <SelectTrigger id={idPrefix + "-type"}>
            <SelectValue placeholder="Please Select" />
          </SelectTrigger>
          <SelectContent>
            {types.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {levels.map((options, index) => (
        <div key={index} className="space-y-2">
          <Label htmlFor={idPrefix + "-level-" + index}>
            {labelAt(index)} *
          </Label>
          <Select
            value={value.path[index] || ""}
            onValueChange={(name) => setLevel(index, name)}
          >
            <SelectTrigger id={idPrefix + "-level-" + index}>
              <SelectValue placeholder="Please Select" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.name} value={option.name}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {source && complete && (
        <div className="space-y-2">
          <Label
            htmlFor={idPrefix + "-link"}
            className="flex items-center gap-1.5"
          >
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            {LINK_LABELS[linkKind]} *
          </Label>
          <Select
            value={value.linkId ? String(value.linkId) : ""}
            onValueChange={(id) =>
              onChange({ ...value, linkKind, linkId: Number(id) })
            }
          >
            <SelectTrigger id={idPrefix + "-link"}>
              <SelectValue placeholder="Please Select" />
            </SelectTrigger>
            <SelectContent>
              {source.rows.map((row) => (
                <SelectItem key={row.id} value={String(row.id)}>
                  {source.label(row)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}

