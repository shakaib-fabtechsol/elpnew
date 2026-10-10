/**
 * Percentage change between two periods.
 *
 * A previous period of zero has no meaningful percentage, so it is reported as
 * new flow rather than a bogus figure or a division by zero.
 */
export function changePercent(current, previous) {
  if (!previous) return { isNew: current > 0, value: null };
  return { isNew: false, value: Math.round(((current - previous) / previous) * 100) };
}
