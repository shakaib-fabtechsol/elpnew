// Role-based visibility for the dashboard.
//
// Every dashboard section declares a key; a role sees a section only if the key
// is listed against it. `admin` is the superset and is spelled out rather than
// wildcarded so adding a new section is a deliberate decision per role.

export const ROLES = {
  admin: "Management / Admin",
  lawyer: "Lawyer",
  execution: "Execution Team",
  accounting: "Accounting",
};

export const SECTION_KEYS = {
  summary: "summary",
  brief: "brief",
  quickActions: "quickActions",
  todaysHearings: "todaysHearings",
  upcomingHearings: "upcomingHearings",
  deadlines: "deadlines",
  myTasks: "myTasks",
  overdueTasks: "overdueTasks",
  urgentActions: "urgentActions",
  casesAttention: "casesAttention",
  missingDocuments: "missingDocuments",
  courtNotifications: "courtNotifications",
  recentUpdates: "recentUpdates",
  casesByStage: "casesByStage",
  execution: "execution",
  recentJudgments: "recentJudgments",
  clientFollowUp: "clientFollowUp",
  financial: "financial",
  unbilled: "unbilled",
  caseFlow: "caseFlow",
  teamWorkload: "teamWorkload",
  bottomSummary: "bottomSummary",
};

const K = SECTION_KEYS;

const ROLE_SECTIONS = {
  admin: Object.values(K),
  lawyer: [
    K.summary,
    K.brief,
    K.quickActions,
    K.todaysHearings,
    K.upcomingHearings,
    K.deadlines,
    K.myTasks,
    K.overdueTasks,
    K.urgentActions,
    K.casesAttention,
    K.missingDocuments,
    K.courtNotifications,
    K.recentUpdates,
    K.casesByStage,
    K.recentJudgments,
    K.clientFollowUp,
    K.bottomSummary,
  ],
  execution: [
    K.summary,
    K.brief,
    K.quickActions,
    K.myTasks,
    K.overdueTasks,
    K.urgentActions,
    K.execution,
    K.courtNotifications,
    K.recentUpdates,
    K.bottomSummary,
  ],
  accounting: [
    K.summary,
    K.brief,
    K.quickActions,
    K.financial,
    K.unbilled,
    K.clientFollowUp,
    K.recentUpdates,
    K.bottomSummary,
  ],
};

export function canView(role, sectionKey) {
  return (ROLE_SECTIONS[role] || []).includes(sectionKey);
}

// A lawyer sees only their own work; everyone else sees the whole office.
export function scopedToOwnWork(role) {
  return role === "lawyer";
}

/* ------------------------------------------------- Law Firm Profile access */

// Firm identity and structure are administrative; only admin may change them.
export function canEditFirmSettings(role) {
  return role === "admin";
}

// Section 7 asks that balances and financial records cannot be altered by
// unauthorised users, so recording money is limited to these two roles.
export function canRecordFinance(role) {
  return role === "admin" || role === "accounting";
}

// Firm and client paperwork is maintained by administration and accounting.
export function canManageDocuments(role) {
  return role === "admin" || role === "accounting";
}
