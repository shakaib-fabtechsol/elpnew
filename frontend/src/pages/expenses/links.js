import { EXPENSE_TYPES } from "@/lib/expenses/taxonomy";
import { fixedAssets, employees, partners, linkedCases } from "./expenseData";

/** What each kind of link offers, and how each option reads. */
export const LINK_SOURCES = {
  case: { rows: linkedCases, label: (r) => r.caseNo + " - " + r.client },
  employee: { rows: employees, label: (r) => r.name + " (" + r.role + ")" },
  asset: { rows: fixedAssets, label: (r) => r.assetNo + " - " + r.name },
  partner: { rows: partners, label: (r) => r.name + " (" + r.share + ")" },
};

export const findType = (typeKey) =>
  EXPENSE_TYPES.find((t) => t.key === typeKey) || null;

/** Reads back a stored link as text. */
export function linkLabel(linkKind, linkId) {
  const source = LINK_SOURCES[linkKind];
  if (!source) return "";
  const row = source.rows.find((r) => r.id === linkId);
  return row ? source.label(row) : "";
}
