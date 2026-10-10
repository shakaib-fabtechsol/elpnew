import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/shared/BackButton";

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
import { cn } from "@/lib/utils";
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
];


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
        {/* Section navigation */}
        <Card className="w-full lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-60 lg:shrink-0 lg:overflow-y-auto">
          <CardContent className="p-3">
            <p className="mb-2 border-b px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Office Management
            </p>
            <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
              {SECTIONS.filter((section) => !section.hidden).map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => goToSection(section.key)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-start text-sm font-medium text-nowrap transition-colors",
                      activeSection === section.key
                        ? "bg-primary text-primary-foreground"
                        : "text-primary hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

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
                <CircularsSection canEdit={isAdmin} />
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
