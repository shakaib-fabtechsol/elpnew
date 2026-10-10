// Sample records for the client profile sections. In the live system each of
// these comes from the API, scoped to the client being viewed.


/**
 * The papers filed against this client.
 *
 * `documentDate` is the date on the document itself, not the day it was
 * uploaded - a certificate issued in March that reaches the office in June
 * is a March document, and the expiry it is read against belongs to that
 * date.
 *
 * Status is not held here. It is read off the expiry date every render, so a
 * paper cannot sit in the list calling itself valid after its date has
 * passed. Expiries are generated around today so the demo always shows all
 * three states.
 */
export const clientDocuments = [];


/**
 * Every agreement signed with this client - the original, its renewals, and any
 * amendment made since. A contract with an end date that has passed is spent,
 * and the table drops it to the bottom.
 */
export const clientContracts = [];

// Office file sequence numbers a contract can be tied to.
export const officeFiles = [];

/**
 * The cases this client has running.
 *
 *  is the court a case has reached and  says
 * whether it is still live. The two are counted separately above the table:
 * a closed case still belongs to the level it ended at.
 */
/**
 * The client's files, one row each.
 *
 * `caseNumbers` holds every number the file has been given as it moved up:
 * the same dispute is registered afresh at each level, so a file at the
 * Supreme Court still carries its Primary and Appeal numbers. Keeping them
 * together is what lets one row show a file's whole history.
 *
 * `litigationLevel` is where the file stands now - the level its next
 * hearing belongs to - which is what the stage tabs count.
 */
export const clientLinkedCases = [];

/**
 * A case file, by its number.
 *
 * An invoice records which file it was raised for and nothing else about it:
 * the opponent, the level and the case number belong to the case, and copying
 * them onto the invoice would let the two disagree the moment a case moves.
 */
export const caseByFileNo = (fileNo) =>
  clientLinkedCases.find((file) => file.fileNo === fileNo) || null;

/** The case number at the level the file currently stands at. */
export const currentCaseNo = (file) =>
  file ? file.caseNumbers[file.litigationLevel] || "-" : "-";

/**
 * What this client has been billed.
 *
 * `details` is the fee being charged and `reason` is why it was charged;
 * `caseFileNo` ties both to the file they were earned on. `feeType` says what
 * kind of money the invoice is for - only "Legal Fees" earns commission, so
 * court charges, execution fees, expenses and disbursements are told apart
 * here rather than guessed at from the wording of the details.
 */
export const clientInvoices = [];

// Case activity, month by month. Deliberately holds no financial data - the
// analytics section is defined to ignore invoices and payment status.
export const clientCaseActivity = [];

export const clientActivitySummary = {};

// Compact directory used by the merge screen. Replaced by the clients API
// call in the live system.
export const clientDirectory = [];

// Everything a merge carries across to the surviving client.
export const MERGE_TRANSFER_ITEMS = [
  "Files and transactions",
  "Invoices",
  "Payments and balances",
  "Documents",
  "Contracts",
  "Notes",
];

/** Who a commission can be paid to. */

