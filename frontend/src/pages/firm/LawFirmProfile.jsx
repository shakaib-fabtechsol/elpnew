import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/shared/BackButton";
import RecordSidebar from "@/components/shared/RecordSidebar";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  ArrowLeft,

  Wallet,
  FileText,
  Network,
  Landmark,
  Info,
  Megaphone,
  Percent,
} from "lucide-react";
import {
  ROLES,
  canRecordFinance,
  canEditFirmSettings,
  canManageDocuments,
} from "@/lib/permissions";

import { CURRENT_USER } from "@/pages/dashboard/dashboardData";

import OverviewSection from "./sections/OverviewSection";
import FirmInformationSection from "./sections/FirmInformationSection";
import DocumentsSection from "./sections/DocumentsSection";
import CircularsSection from "./sections/CircularsSection";
import BranchesSection from "./sections/BranchesSection";
import BankAccountsSection from "./sections/BankAccountsSection";
import TransactionsSection from "./sections/TransactionsSection";
import CommissionSection from "./sections/CommissionSection";
import RequestsSection from "./sections/RequestsSection";
import { ClipboardList } from "lucide-react";
import { can } from "@/lib/access";

/**
 * The profile's sections, in the order the company is read: what it is, where
 * it works from, where its money sits, what it holds on file, and last the
 * summary of all of it. Financial Transactions is not chosen from here - Bank
 * Accounts opens it against one account - so it sits at the end.
 */
const SECTIONS = [
  {
    key: "information",
    label: "Company Details",
    icon: FileText,
    note: "Core legal and registration information",
  },
  {
    ownsHeader: true,
    key: "branches",
    label: "Branches",
    icon: Network,
    note: "Offices the company works from",
  },
  {
    key: "bank",
    label: "Bank Accounts",
    icon: Landmark,
    note: "Manage all bank accounts and view account balances",
    // The tabs name whichever list is open, so the section draws one row of
    // its own: that name, the tabs, and the button that adds to it.
    ownsHeader: true,
  },
  {
    ownsHeader: true,
    key: "circulars",
    label: "Circulars",
    icon: Megaphone,
    note: "Notices everyone must read before using the system",
  },
  {
    key: "overview",
    label: "Company Overview",
    icon: Info,
    note: "Cases, clients and money, at a glance",
  },
  {
    // Not in the menu any more: an account's history is read by picking
    // that bank on the Bank Accounts page, which is where anyone looking
    // for it already is. The section stays so the links into it still work.
    key: "transactions",
    label: "Manage Transactions",
    icon: Wallet,
    note: "Every movement through the bank accounts",
    hidden: true,
  },
  {
    // Commission is worked out across clients rather than inside any one
    // of them, which is why it belongs to the company and not to a client.
    ownsHeader: true,
    key: "commission",
    label: "Commission",
    icon: Percent,
    note: "What referred work has earned, on paid fees",
  },
  {
    // Every employee's requests, opened in each kind's own detailed screen.
    // Management's: whoever may decide or pay requests (the server limits
    // the list to the employees they reach).
    ownsHeader: true,
    key: "requests",
    label: "Requests",
    icon: ClipboardList,
    note: "Every employee's requests, to review, decide and pay",
    when: () => mayManageRequests(),
  },
];

/** Whether the signed-in person decides or pays employees' requests. */
const mayManageRequests = () =>
  CURRENT_USER.role === "admin" ||
  can(
    ...["financingRequests", "entitlementRequests", "allowanceRequests", "endOfServiceRequests", "leaveRequests", "generalRequests"].flatMap(
      (module) => [module + ".approve", module + ".pay"]
    )
  );


export default function LawFirmProfile() {
  const [activeSection, setActiveSection] = useState("information");
  // Carries context when one section links into another, such as opening the
  // transaction history on a particular account.
  const [sectionArgs, setSectionArgs] = useState({});
  const [role, setRole] = useState(CURRENT_USER.role);

  // Documents are read under Company Details now, not on a page of their own:
  // the licences and certificates are what those details are taken from. A
  // link that still asks for them lands where they are.
  const goToSection = (key, args = {}) => {
    setActiveSection(key === "documents" ? "information" : key);
    setSectionArgs(args);
  };

  const current = SECTIONS.find((s) => s.key === activeSection);

  // Every role may read the whole profile; the role decides what can be changed.
  const isAdmin = canEditFirmSettings(role);
  const canRecord = canRecordFinance(role);
  const canEditDocuments = canManageDocuments(role);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallback="/dashboard" />
          <div className="rounded-xl bg-primary p-2 sm:p-3">
            <Building2 className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">
              Company Profile
            </h1>
            <p className="text-xs text-primary/75 sm:text-sm">
              Manage company information, branches, accounts and documents
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Viewing as</span>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-9 w-48 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>


      <div className="flex flex-col items-start gap-4 sm:gap-6 lg:flex-row">
        {/* Section navigation: the shared record rail, so it narrows to the
            navy icon-and-name rail the same way as every other record. */}
        <RecordSidebar
          id="firm"
          title="Office Management"
          active={activeSection}
          onSelect={goToSection}
          groups={SECTIONS.filter((section) => !section.hidden && (!section.when || section.when())).map((section) => ({
            key: section.key,
            link: true,
            label: section.label,
            icon: section.icon,
          }))}
        />

        {/* min-w-0 or the column will not shrink: a flex child sizes itself to
            its widest content by default, so one wide table in here would
            stretch the whole page and push the sidebar off screen. */}
        <div className="w-full min-w-0 flex-1 space-y-4 sm:space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              {/* The name of the section, and nothing else. A section that
                  carries an Add button draws its own heading instead, so the
                  button can share the line with it. */}
              {!current.ownsHeader && (
                <div className="mb-6 border-b pb-3">
                  <h2 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">
                    {current.label}
                  </h2>
                </div>
              )}

              {activeSection === "overview" && (
                <OverviewSection onNavigateSection={goToSection} />
              )}
              {activeSection === "information" && (
                <FirmInformationSection canEdit={isAdmin} />
              )}
              {activeSection === "circulars" && (
                <CircularsSection canEdit={isAdmin || can("circulars.create", "circulars.edit")} />
              )}
              {activeSection === "branches" && (
                <BranchesSection canEdit={isAdmin} />
              )}
              {activeSection === "bank" && (
                <BankAccountsSection
                  canRecord={canRecord}
                  canEdit={isAdmin}
                />
              )}
              {activeSection === "transactions" && (
                <TransactionsSection
                  initialAccountId={sectionArgs.accountId}
                  canRecord={canRecord}
                />
              )}
              {activeSection === "commission" && <CommissionSection />}
              {activeSection === "requests" && mayManageRequests() && <RequestsSection />}
            </CardContent>
          </Card>

          {/* The company's papers, in a box of their own under the details
              they back - one page for what the company is and what proves it. */}
          {activeSection === "information" && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <DocumentsSection canEdit={canEditDocuments} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
