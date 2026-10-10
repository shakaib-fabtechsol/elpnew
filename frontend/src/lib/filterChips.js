/** Whether a stored value counts as a choice somebody made. */
const chosen = (value) =>
  Array.isArray(value) ? value.length > 0 : Boolean(value) && value !== "all";

/**
 * The filters in force, each as one removable tag.
 *
 * Exported because the same tags are shown twice - inside the panel, and on
 * the row under the table - and two readings of "what is this list narrowed
 * by" would disagree the first time a group changed its wording.
 *
 * A group where any number may be chosen yields one tag per choice; a group
 * where one may be chosen yields one tag.
 */
export function filterChips(fields, value) {
  return fields.flatMap((field) => {
    const held = value[field.key];
    if (!chosen(held)) return [];
    const say = (one) =>
      field.options?.find((option) => option.value === one)?.label || one;

    return Array.isArray(held)
      ? held.map((one) => ({
          key: field.key + ":" + one,
          field: field.key,
          option: one,
          label: field.label,
          value: say(one),
        }))
      : [
          {
            key: field.key,
            field: field.key,
            label: field.label,
            value: say(held),
          },
        ];
  });
}

/** What is left in force once one tag is dropped. */
export function withoutChip(value, chip) {
  const next = { ...value };
  if (chip.option) {
    const held = (next[chip.field] || []).filter((one) => one !== chip.option);
    if (held.length) next[chip.field] = held;
    else delete next[chip.field];
  } else {
    delete next[chip.field];
  }
  return next;
}
