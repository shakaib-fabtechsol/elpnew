import {
  LayoutGrid,
  Gavel,
  CalendarClock,
  Timer,
  AlarmClock,
  ListChecks,
  CalendarX,
  Siren,
  AlertTriangle,
  FileWarning,
  History,
  Layers,
  PhoneCall,
  Hammer,
  Wallet,
  ReceiptText,
  Inbox,
  TrendingUp,
  Crown,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { SECTION_KEYS as K } from "@/lib/permissions";

/**
 * The dashboard, one subject at a time.
 *
 * Everything used to be on one page, which meant scrolling past twenty panels
 * to reach the one that was wanted. The menu names each panel instead, and
 * `general` is the page as it was - every widget, in order - so nothing was
 * taken away by splitting it up.
 *
 * `permission` is the section key the role has to be allowed to see; an entry
 * the signed-in role cannot view is not offered.
 */
export const DASHBOARD_VIEWS = [
  { key: "general", label: "General", icon: LayoutGrid, permission: null },
  {
    key: "todaysHearings",
    label: "Today's Hearings",
    icon: Gavel,
    permission: K.todaysHearings,
  },
  {
    key: "upcomingHearings",
    label: "Upcoming Hearings",
    icon: CalendarClock,
    permission: K.upcomingHearings,
  },
  { key: "deadlines", label: "Deadlines", icon: Timer, permission: K.deadlines },
  {
    key: "appealAlerts",
    label: "Appeal Deadline Alerts",
    icon: AlarmClock,
    permission: K.deadlines,
  },
  { key: "tasks", label: "Tasks", icon: ListChecks, permission: K.myTasks },
  {
    key: "overdueTasks",
    label: "Overdue Tasks",
    icon: CalendarX,
    permission: K.overdueTasks,
  },
  {
    key: "urgentActions",
    label: "Urgent Actions",
    icon: Siren,
    permission: K.urgentActions,
  },
  {
    key: "casesAttention",
    label: "Cases Requiring Attention",
    icon: AlertTriangle,
    permission: K.casesAttention,
  },
  {
    key: "missingDocuments",
    label: "Missing Documents",
    icon: FileWarning,
    permission: K.missingDocuments,
  },
  {
    key: "recentUpdates",
    label: "Recent Case Updates",
    icon: History,
    permission: K.recentUpdates,
  },
  {
    key: "casesByStage",
    label: "Cases by Stage",
    icon: Layers,
    permission: K.casesByStage,
  },
  {
    key: "clientFollowUp",
    label: "Client Follow-up",
    icon: PhoneCall,
    permission: K.clientFollowUp,
  },
  {
    key: "execution",
    label: "Execution Follow-up",
    icon: Hammer,
    permission: K.execution,
  },
  {
    key: "financial",
    label: "Financial Snapshot",
    icon: Wallet,
    permission: K.financial,
  },
  {
    key: "unbilled",
    label: "Unbilled Cases / Pending Billing",
    icon: ReceiptText,
    permission: K.unbilled,
  },
  {
    key: "casesReceived",
    label: "Cases Received by Client",
    icon: Inbox,
    permission: K.caseFlow,
  },
  {
    key: "caseFlowTrend",
    label: "Case Flow Trend",
    icon: TrendingUp,
    permission: K.caseFlow,
  },
  {
    key: "topClients",
    label: "Top Clients by Case Volume",
    icon: Crown,
    permission: K.caseFlow,
  },
  {
    key: "stoppedClients",
    label: "Clients Who Stopped Sending Cases",
    icon: UserMinus,
    permission: K.caseFlow,
  },
  {
    key: "newClients",
    label: "New Clients",
    icon: UserPlus,
    permission: K.caseFlow,
  },
];
