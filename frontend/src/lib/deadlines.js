/**
 * Urgency of a deadline, from the days remaining.
 *
 * Three bands keep the dashboard calm: most deadlines sit in the informational
 * band and only the near ones are allowed to shout.
 */
export function urgencyOf(days) {
  if (days <= 3) return "High";
  if (days <= 7) return "Medium";
  return "Information";
}
