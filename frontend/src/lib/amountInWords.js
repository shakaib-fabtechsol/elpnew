/**
 * An amount written out in words, the way it is written on a transfer slip.
 *
 * A Rial is a thousand Baisa, not a hundred, so the fraction is read to three
 * places and named Baisa rather than cents. Both halves are spelled out
 * separately because that is how the bank's own paperwork reads: "One Thousand
 * Two Hundred Fifty Rials and Five Hundred Baisa".
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

/** The names of each group of three digits, smallest first. */
const SCALES = ["", "Thousand", "Million", "Billion"];

/** A number under a thousand, in words. */
function underThousand(value) {
  if (value < 20) return ONES[value];
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)];
    const ones = ONES[value % 10];
    return ones ? tens + " " + ones : tens;
  }
  const hundreds = ONES[Math.floor(value / 100)] + " Hundred";
  const rest = value % 100;
  return rest ? hundreds + " " + underThousand(rest) : hundreds;
}

/** A whole number in words. Zero has a name of its own. */
export function numberInWords(value) {
  const whole = Math.floor(Math.abs(value));
  if (whole === 0) return "Zero";

  const groups = [];
  let left = whole;
  while (left > 0) {
    groups.push(left % 1000);
    left = Math.floor(left / 1000);
  }

  return groups
    .map((group, i) =>
      group ? underThousand(group) + (SCALES[i] ? " " + SCALES[i] : "") : ""
    )
    .filter(Boolean)
    .reverse()
    .join(" ");
}

/**
 * A Rial amount in words.
 *
 * Returns an empty string for nothing at all, so a form can show its own
 * placeholder rather than the words "Zero Rials" over an empty field.
 */
export function amountInWords(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";

  const rials = Math.floor(amount);
  // Rounded to the Baisa, because a tenth of a Baisa cannot be transferred.
  const baisa = Math.round((amount - rials) * 1000);

  const parts = [];
  if (rials) parts.push(numberInWords(rials) + (rials === 1 ? " Rial" : " Rials"));
  if (baisa) {
    parts.push(numberInWords(baisa) + (baisa === 1 ? " Baisa" : " Baisa"));
  }
  return parts.join(" and ") + " Only";
}
