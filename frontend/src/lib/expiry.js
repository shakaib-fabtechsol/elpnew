/**
 * How long a document has left.
 *
 * The rule lives here once because several pages ask the same question of the
 * same kind of date - a reference, a power of attorney, an uploaded copy - and
 * they must all answer it the same way. How each page *shows* the answer is its
 * own business; this only decides what the answer is.
 */

/**
 * Papers are chased a month before they lapse, so that is the warning -
 * unless a kind of paper is chased earlier and says so.
 */
export const EXPIRING_SOON_DAYS = 30;

/** The firm's calendar: a day turns over in Muscat, wherever it is read. */
const FIRM_TIME_ZONE = "Asia/Muscat";

const DAY = 24 * 60 * 60 * 1000;

/** Today's date on the firm's calendar, as YYYY-MM-DD. */
export function firmToday() {
  // en-CA writes dates year first, which is the shape the fields store.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FIRM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** A calendar date as a day count, so two dates subtract to whole days. */
const dayNumber = (iso) => {
  const [year, month, day] = String(iso).slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY;
};

/**
 * Whole days from today to a date on the firm's calendar: 0 on the day,
 * negative once it has passed (-1 the day after).
 */
export const daysUntil = (date) => dayNumber(date) - dayNumber(firmToday());

/** A date some whole days after another, as YYYY-MM-DD. */
export const addDays = (date, days) =>
  new Date((dayNumber(date) + days) * DAY).toISOString().slice(0, 10);

/**
 * One of four states.
 *
 * Read in whole calendar days on the firm's calendar, so a paper expiring
 * today is still running out today and has expired tomorrow - not at some
 * hour that depends on where the page is opened. A paper with no expiry date
 * is not a failing - it simply says nothing, because there is nothing to say.
 */
export function expiryState(date, soonDays = EXPIRING_SOON_DAYS) {
  if (!date) return "none";
  const days = daysUntil(date);
  if (days < 0) return "expired";
  if (days <= soonDays) return "soon";
  return "valid";
}

/** What each state is called on screen. */
export const EXPIRY_LABEL = {
  valid: "Active",
  soon: "Expiring Soon",
  expired: "Expired",
};
