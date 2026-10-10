/**
 * Invoice analysis for requests that are made on an invoice - medical,
 * travel, air ticket and transport allowances.
 *
 * The employee uploads the invoice first; the server reads it before the
 * request exists (POST /invoices/analyze): invoice number, supplier (with its
 * VAT number), what it was for, the amount and the VAT. It then checks the
 * invoice against what is on record - the same invoice number claimed before,
 * the same medication claimed before, a supplier the firm does not know yet -
 * and marks it safe (green) or suspicious (red) for management. The checks
 * run again when the request is filed, and that `risk` is what the request
 * carries. See src/lib/api/modules/entitlements.js.
 */

/** Requests that are made on an invoice, and so start with its analysis. */
export const INVOICE_KINDS = ["medical", "travel", "airTicket", "transport"];

export const needsInvoice = (kind) => INVOICE_KINDS.includes(kind);

/** Oman's standard VAT rate. Medicines and medical care are zero-rated. */
export const VAT_RATE = 0.05;
