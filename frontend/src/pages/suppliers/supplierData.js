/**
 * Suppliers the firm buys from.
 *
 * The Expense Requests page used to hold its own list of supplier names. This
 * is the record behind those names, so a supplier added here is immediately
 * selectable on an invoice, and its tax numbers travel with it.
 */

import { COUNTRY_DIAL_CODES, DEFAULT_DIAL_CODE } from "@/lib/constants";

export const SUPPLIER_CATEGORIES = [
  "Office Supplies",
  "Utilities",
  "Telecommunications",
  "Professional Services",
  "Marketing",
  "Maintenance",
  "IT & Software",
  "Government",
  "Banking",
  "Medical",
  "Other",
];

export const SUPPLIER_STATUSES = ["Active", "Inactive"];

/* ------------------------------------------------------------ new supplier */

// The draft a supplier form starts from. The dial code is held apart from the
// number while editing and folded back in on save.
export const emptySupplier = {
  name: "",
  category: "",
  commercialRegistration: "",
  taxIdentificationNumber: "",
  vatNumber: "",
  bank: "",
  accountNumber: "",
  dialCode: DEFAULT_DIAL_CODE,
  phone: "",
  status: "Active",
};

/** A supplier needs at least a name and a category before it can be saved. */
export const canSaveSupplier = (draft) =>
  Boolean(draft.name.trim() && draft.category);

/** Folds the dial code back onto the phone number the record stores. */
export function toSupplierRecord(draft) {
  const { dialCode, phone, ...rest } = draft;
  return { ...rest, phone: phone ? dialCode + " " + phone : "" };
}


export const initialSuppliers = [];

/** The three papers a supplier is asked for, and no others. */
export const SUPPLIER_DOCUMENT_TYPES = ["C.R", "Contract", "Tax Certificates"];

const DAY = 24 * 60 * 60 * 1000;

/**
 * Papers filed against a supplier.
 *
 * `documentDate` is the date on the paper itself rather than the day it was
 * uploaded, and status is never stored - it is read off the expiry date every
 * render, the same way it is everywhere else. Expiries are generated around
 * today so the demo always shows all three states.
 */
export const initialSupplierDocuments = [];
