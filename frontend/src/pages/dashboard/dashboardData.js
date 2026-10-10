// Mock data for the dashboard. Dates are generated relative to today so the
// "today" and "days remaining" sections stay correct whenever the demo is run.

import { withRial } from "@/lib/money";

const DAY = 24 * 60 * 60 * 1000;

const iso = (date) => date.toISOString().slice(0, 10);

export const today = new Date();
today.setHours(0, 0, 0, 0);

export const dayOffset = (days) => iso(new Date(today.getTime() + days * DAY));

export const daysUntil = (dateStr) =>
  Math.round((new Date(dateStr).setHours(0, 0, 0, 0) - today.getTime()) / DAY);

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const money = (amount) =>
  withRial(Math.round(amount).toLocaleString("en-GB"));

export { changePercent } from "@/lib/metrics";

// `group` is what circulars are addressed to - see lib/circulars.
export const CURRENT_USER = {
  // Filled in by sign-in (lib/api/session.js) with the real user.
  name: "",
  role: "admin",
  group: "",
};

/* ---------------------------------------------------------------- summary */

export const summaryStats = {
  activeCases: { value: 0, previous: 0, to: "/litigation?status=Active" },
  totalClients: { value: 0, previous: 0, to: "/clients" },
  casesReceivedThisMonth: { value: 0, previous: 0, to: "/litigation?newWithin=30" },
  newCasesThisMonth: { value: 0, previous: 0, to: "/litigation?newWithin=30&stage=Registration" },
  pendingInvoices: { value: 0, previous: 0, to: "/finance?status=Pending" },
  outstandingAmount: { value: 0, previous: 0, to: "/finance?status=Pending" },
};

export const bottomSummary = {
  hearingsThisMonth: { value: 0, to: "/litigation?stage=Under Litigation" },
  judgmentsIssued: { value: 0, to: "/litigation?stage=Judgment Issued" },
  openExecutionFiles: { value: 0, to: "/litigation?stage=Execution" },
  overdueTasks: { value: 0, to: "/profile/tasks?overdue=1" },
};

/* --------------------------------------------------------------- hearings */

export const hearings = [];

export const todaysHearings = hearings.filter((h) => h.date === dayOffset(0));

export const upcomingHearings = hearings
  .filter((h) => h.date > dayOffset(0) && daysUntil(h.date) <= 14)
  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

/* -------------------------------------------------------------- deadlines */

export const deadlines = [];

export const appealDeadlines = deadlines
  .filter((d) => d.isAppeal)
  .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

/* ------------------------------------------------------------------ tasks */

export const tasks = [];

// A task is overdue when its due date has passed and it is not yet complete.
export const overdueTasks = tasks
  .filter((t) => t.status !== "Completed" && daysUntil(t.dueDate) < 0)
  .map((t) => ({ ...t, daysOverdue: Math.abs(daysUntil(t.dueDate)) }))
  .sort((a, b) => b.daysOverdue - a.daysOverdue);

/* ----------------------------------------------------------------- alerts */

export const urgentActions = [];

export const casesRequiringAttention = [];

export const missingDocuments = [];

export const courtNotifications = [];

/* ---------------------------------------------------------------- updates */

export const recentCaseUpdates = [];

export const casesByStage = [
  { stage: "Registration", count: 0 },
  { stage: "Under Litigation", count: 0 },
  { stage: "Reserved for Judgment", count: 0 },
  { stage: "Judgment Issued", count: 0 },
  { stage: "Appeal", count: 0 },
  { stage: "Supreme Court", count: 0 },
  { stage: "Execution", count: 0 },
  { stage: "Closed", count: 0 },
];

/* -------------------------------------------------------------- execution */

export const executionIndicators = [
  { label: "New Execution Files", value: 0, tone: "info" },
  { label: "Pending Execution Actions", value: 0, tone: "warning" },
  { label: "Attachment Requests", value: 0, tone: "info" },
  { label: "Bank Attachment Requests", value: 0, tone: "info" },
  { label: "Vehicle Attachment Requests", value: 0, tone: "info" },
  { label: "Travel Ban Requests", value: 0, tone: "warning" },
  { label: "Arrest / Detention Requests", value: 0, tone: "high" },
  { label: "Files Without Recent Action", value: 0, tone: "high" },
  { label: "Files Waiting for Court Response", value: 0, tone: "warning" },
];

export const amountsCollected = 0;

export const recentJudgments = [];

/* ---------------------------------------------------------- client follow */

export const clientFollowUp = [];

/* -------------------------------------------------------------- financial */

export const financialSnapshot = {
  totalInvoices: 0,
  paidInvoices: 0,
  pendingInvoices: 0,
  cancelledInvoices: 0,
  collectedThisMonth: 0,
  outstandingAmount: 0,
  unbilledWork: 0,
  expenses: 0,
};

export const unbilledCases = [];

/* -------------------------------------------------------------- case flow */

// Counts per client across the periods the filter offers.
export const clientCaseFlow = [];

// Which field a filter reads, and what it compares against.
export const CASE_FLOW_PERIODS = [
  { key: "today", label: "Today", field: "today", previousField: null },
  { key: "week", label: "This Week", field: "week", previousField: null },
  { key: "thisMonth", label: "This Month", field: "thisMonth", previousField: "lastMonth" },
  { key: "lastMonth", label: "Last Month", field: "lastMonth", previousField: null },
  { key: "last3Months", label: "Last 3 Months", field: "last3Months", previousField: null },
  { key: "last6Months", label: "Last 6 Months", field: "last6Months", previousField: "last3Months" },
  { key: "thisYear", label: "This Year", field: "thisYear", previousField: "lastYear" },
  { key: "lastYear", label: "Last Year", field: "lastYear", previousField: null },
  { key: "custom", label: "Custom Date Range", field: "thisMonth", previousField: "lastMonth" },
];

// Office-wide cases received, month by month, for the trend chart.
export const caseFlowTrend = [];

// Weekly view of the same measure.
export const caseFlowTrendWeekly = [];

export const newClients = [];

/* ------------------------------------------------------------- team */

export const teamWorkload = [];

/* ---------------------------------------------------------- quick search */

export const QUICK_SEARCH_FIELDS = [
  "Case Number",
  "Execution Number",
  "Client Name",
  "Client Phone",
  "Civil ID",
  "Commercial Registration",
  "Opponent Name",
  "Court",
  "Lawyer Name",
];

export const searchIndex = [];
