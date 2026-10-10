// Every amount in the system is written the same way: the figure, then the
// currency after it - "1,500.000 OMR". One formatter decides that, so a table,
// a summary tile and a read-only field cannot disagree about it.

/**
 * The currency of the books, as the active locale writes it.
 *
 * English uses the ISO code; Arabic writes ر.ع. Nothing else in the system
 * spells either of them out.
 */
export const CURRENCY = "OMR";

/** A number as money, without the currency: "1,500.000". */
export const amountValue = (value, decimals = 3) =>
  Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * A number as money, with the currency after it: "1,500.000 OMR".
 *
 * This is what every amount shown to somebody goes through. `decimals` is
 * there for the few places that round to whole Rials - a summary tile, a
 * chart axis - and is three everywhere else, because a Baisa is a thousandth.
 */
export const money = (value, decimals = 3) =>
  amountValue(value, decimals) + " " + CURRENCY;

/** An already-formatted figure with the currency after it. */
export function withRial(text) {
  // `currency-value` is what keeps it readable in Arabic: the figure runs
  // left to right whichever way the page does, its separators and decimal
  // point stay in the order they were written, and the amount and its
  // currency never come apart across a line break.
  return (
    <span className="currency-value">
      <span>{text}</span>
      <span>{CURRENCY}</span>
    </span>
  );
}
