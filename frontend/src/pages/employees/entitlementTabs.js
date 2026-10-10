/**
 * What an employee is entitled to beyond their salary.
 *
 * Allowances the firm pays on top of the monthly pay, and the sums the law
 * requires when somebody leaves. Each is its own list because each is claimed,
 * decided and paid on its own; they live in one file because two places read
 * them - the heading that carries the tabs, and the section that shows
 * whichever is open.
 */
export const ENTITLEMENT_TABS = [
  { key: "leaveEncashment", label: "Leave Encashment" },
  { key: "overtime", label: "Overtime Pay" },
  { key: "medical", label: "Medical Allowance" },
  { key: "transport", label: "Transport Allowance" },
  { key: "assistance", label: "Assistance" },
  { key: "travel", label: "Travel Allowance" },
  { key: "airTicket", label: "Air Ticket Allowance" },
  { key: "notice", label: "Notice Pay" },
  { key: "endOfService", label: "End of Service" },
];
