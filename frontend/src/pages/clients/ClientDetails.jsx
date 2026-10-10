import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/shared/BackButton";
import {
  UserPlus,
  Save,
  ArrowLeft,
  ArrowRight,
  User,
  LayoutDashboard,
  Briefcase,
  FileText,
  Users,
  FileSignature,
  Receipt,
  GitMerge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_DIAL_CODE } from "@/lib/constants";
import { deriveClientStatus } from "@/lib/clientStatus";
import { clientDisplayName } from "./clientRecords";
import { useClients } from "@/lib/clients/context";
import { StatusDot } from "@/components/shared/panels";
import { activeCaseCount } from "./clientCases";

import BasicSection from "./sections/BasicSection";
import ContactSection from "./sections/ContactSection";
import FinancialSection from "./sections/FinancialSection";

import ClientManagementSection from "./sections/ClientManagementSection";
import DocumentsSection from "./sections/DocumentsSection";
import ClientContractsSection from "./sections/ClientContractsSection";
import LinkedCasesSection from "./sections/LinkedCasesSection";
import InvoicesSection from "./sections/InvoicesSection";
import AnalyticsSection from "./sections/AnalyticsSection";
import MergeSection from "./sections/MergeSection";

/**
 * Sections of the client record.
 *
 * `form` marks the page that edits the client itself, whose three boxes share
 * `existingOnly` hides the sections that need a saved client behind them -
 * there are no documents, cases or invoices to show while one is being created.
 * one save button. `required` is a function so conditional fields (VATIN,
 * custom payment days) are only demanded when they actually apply.
 */
const SECTIONS = [
  {
    // What the client looks like at a glance comes first; the record behind
    // it follows. Each item is named by what it holds - the sidebar is
    // already inside one client, so "Client" in every label said nothing.
    key: "analytics",
    label: "Dashboard",
    icon: LayoutDashboard,
    existingOnly: true,
  },
  {
    key: "info",
    label: "Information",
    icon: User,
    form: true,
    required: (formData, clientType) => [
      "arabicName",
      "englishName",
      "referenceNo",
      "referenceExpiryDate",
      "poaNo",
      "poaExpiryDate",
      ...(clientType !== "Individual" ? ["vatinNo"] : []),
      "receivingBank",
      "receivingAccount",
      ...(formData.paymentDelayPeriod === "custom"
        ? ["paymentDelayCustomDays"]
        : []),
      "mobile",
      "email",
      "languageOfCommunication",
      "whatsappNotification",
      "emailNotification",
    ],
  },
  { key: "cases", label: "Cases", icon: Briefcase, existingOnly: true },
  {
    key: "management",
    label: "Team",
    icon: Users,
    existingOnly: true,
    ownsHeader: true,
  },
  {
    key: "documents",
    label: "Documents",
    icon: FileText,
    existingOnly: true,
    ownsHeader: true,
  },
  {
    key: "contracts",
    label: "Contracts",
    icon: FileSignature,
    existingOnly: true,
    ownsHeader: true,
  },
  { key: "invoices", label: "Invoices", icon: Receipt, existingOnly: true },

  { key: "merge", label: "Merge Clients", icon: GitMerge, existingOnly: true },
];


/**
 * One titled box on the Client Information page.
 *
 * The three boxes are separated by space rather than by a divider, so the
 * page reads as three things about one client rather than one long form.
 */
function SectionCard({ title, aside, children }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="mb-6 flex items-center gap-4 border-b pb-3">
          <h2 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">{title}</h2>
          {aside}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** Today as a plain YYYY-MM-DD in the user's own timezone. */
const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

/**
 * A record as the form holds it.
 *
 * A client being created is stamped with today: the date of registration is
 * the day the record was made, so it is filled in here rather than asked for.
 */
const toFormData = (record) =>
  !record
    ? { ...emptyFormData, dateOfRegistration: todayIso() }
    : {
        dateOfRegistration: record.dateOfRegistration || "",
        arabicName: record.arabicName || "",
        englishName: record.clientName || "",
        referenceNo: record.referenceNo || "",
        referenceExpiryDate: record.referenceExpiryDate || "",
        vatinNo: record.vatinNo || "",
        poaNo: record.poaNo || "",
        poaExpiryDate: record.poaExpiryDate || "",
        email: record.email || "",
        mobileDialCode: record.mobileDialCode || DEFAULT_DIAL_CODE,
        mobile: record.mobile || "",
        receivingBank: record.receivingBank || "",
        receivingAccount: record.receivingAccount || "",
        commissionRate: record.commissionRate || "",
        payFeesOnBehalf: record.payFeesOnBehalf || "",
        paymentDelayPeriod: record.paymentDelayPeriod || "",
        paymentDelayCustomDays: record.paymentDelayCustomDays || "",
        languageOfCommunication: record.languageOfCommunication || "",
        whatsappNotification: record.whatsappNotification || "No",
        emailNotification: record.emailNotification || "No",
        deactivationDate: record.deactivationDate || "",
        deactivationReason: record.deactivationReason || "",
        referenceCopy: record.attachments?.referenceCopy || "",
        poaCopy: record.attachments?.poaCopy || "",
      };

const emptyFormData = {
  dateOfRegistration: "",
  arabicName: "",
  englishName: "",
  referenceNo: "",
  referenceExpiryDate: "",
  vatinNo: "",
  poaNo: "",
  poaExpiryDate: "",
  email: "",
  mobileDialCode: DEFAULT_DIAL_CODE,
  mobile: "",
  receivingBank: "",
  receivingAccount: "",
  commissionRate: "",
  payFeesOnBehalf: "",
  paymentDelayPeriod: "",
  paymentDelayCustomDays: "",
  languageOfCommunication: "",
  whatsappNotification: "No",
  emailNotification: "No",
  deactivationDate: "",
  deactivationReason: "",
  referenceCopy: "",
  poaCopy: "",
};

export default function ClientDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isExisting = Boolean(id);

  const { clients, findClient, findByNo } = useClients();
  const record = isExisting ? findClient(id) : null;
  // Where this client's records now live, if it has been folded into another.
  const mergedInto = record?.mergedIntoClientNo
    ? findByNo(record.mergedIntoClientNo)
    : null;

  const [clientType, setClientType] = useState(() => record?.type || "Individual");
  // A client being created is Active from the day it is created; an existing
  // one keeps whatever it was pinned to, or "auto" to follow its open cases.
  const [statusOverride, setStatusOverride] = useState(
    () => record?.statusOverride || (record ? "auto" : "Active")
  );
  const [activeSection, setActiveSection] = useState("info");
  const [formData, setFormData] = useState(() => toFormData(record));

  // Reload when the route moves to a different client without unmounting.
  const [loadedId, setLoadedId] = useState(id);
  if (id !== loadedId) {
    setLoadedId(id);
    setClientType(record?.type || "Individual");
    setStatusOverride(record?.statusOverride || (record ? "auto" : "Active"));
    setFormData(toFormData(record));
    setActiveSection("info");
  }

  const sections = SECTIONS.filter((s) => isExisting || !s.existingOnly);
  const current = sections.find((s) => s.key === activeSection) || sections[0];

  // Read from the form rather than the saved record, so the field, the dot
  // beside the heading and the deactivation date can never disagree.
  const status = deriveClientStatus({
    ...record,
    activeCases: record?.activeCases || 0,
    statusOverride: statusOverride === "auto" ? null : statusOverride,
    deactivationDate: formData.deactivationDate || null,
  });

  // Two things settle the standing on their own, leaving the Status field
  // nothing to decide: a merge, and a deactivation date that has arrived.
  const statusNote = record?.mergedIntoClientNo
    ? "Set by the merge."
    : formData.deactivationDate && formData.deactivationDate <= todayIso()
      ? "Set by the deactivation date."
      : "";
  const statusLocked = Boolean(statusNote);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Sets the status by hand.
   *
   * Going back to Active leaves nothing to explain, so the deactivation
   * date and reason go with it rather than lingering as stale answers to
   * a question nobody is asking any more.
   */
  const chooseStatus = (value) => {
    setStatusOverride(value);
    if (value === "Active") {
      setFormData((prev) => ({
        ...prev,
        deactivationDate: "",
        deactivationReason: "",
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // The browser only validates the section on screen, so check the other
    // form sections here and open the first one that is still incomplete.
    const incomplete = sections.find(
      (section) =>
        section.form &&
        section.key !== activeSection &&
        section.required(formData, clientType).some((field) => !formData[field])
    );
    if (incomplete) {
      setActiveSection(incomplete.key);
      return;
    }

    const clientData = {
      type: clientType,
      statusOverride: statusOverride === "auto" ? null : statusOverride,
      ...formData,
    };
    if (isExisting) {
      console.log("Updating client:", clientData);
    } else {
      console.log("Creating client:", clientData);
    }
    navigate("/clients");
  };

  // Whatever this client has absorbed travels in its name, so the old name
  // still finds the records that came in under it. The client's number is not
  // in the heading: a person is known here by name, and a number beside it
  // only belongs where files are numbered - in Litigation.
  const title = isExisting
    ? clientDisplayName(clients, record) ||
      formData.englishName ||
      "Client Details"
    : "Add New Client";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/clients" />
          {!isExisting && (
            <div className="p-2 sm:p-3 rounded-xl bg-primary">
              <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-primary">
              {title}
            </h1>
            {/* A merged client is still readable, and says where it went */}
            {mergedInto ? (
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="font-medium text-amber-600">
                  Merged with {mergedInto.clientName}
                </span>
                <button
                  type="button"
                  onClick={() => navigate("/clients/" + mergedInto.id)}
                  className="inline-flex items-center gap-1 text-primary"
                >
                  Open {mergedInto.clientName}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-primary/75">
                {isExisting
                  ? "Client profile and related records"
                  : "Create a new client record"}
              </p>
            )}
          </div>
        </div>

        {/* Only the editable sections have something to save */}
        {current.form && (
          <Button type="submit" form="client-form">
            <Save className="me-2 h-4 w-4" />
            {isExisting ? "Update Client" : "Save Client"}
          </Button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
        {/* Section navigation */}
        <Card className="w-full lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-60 lg:shrink-0 lg:overflow-y-auto">
          <CardContent className="p-3">
            <p className="mb-2 border-b px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Client Details
            </p>
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveSection(section.key)}
                    className={cn(
                      "flex items-center gap-2.5 text-nowrap rounded-md px-3 py-2 text-start text-sm font-medium transition-colors",
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

        <div className="w-full min-w-0 flex-1 space-y-4 sm:space-y-6">
          {current.form ? (
            /* Three boxes, one form, one save button: everything that is the
               client itself, on one page. */
            <form
              id="client-form"
              onSubmit={handleSubmit}
              className="space-y-4 sm:space-y-6"
            >
              {/* No standing beside the heading: the client's status is on the
                  row this record was opened from, and it is a field below. */}
              <SectionCard title="Client Information">
                <BasicSection
                  formData={formData}
                  clientType={clientType}
                  status={status}
                  statusLocked={statusLocked}
                  statusNote={statusNote}
                  onChange={handleChange}
                  onClientTypeChange={setClientType}
                  onStatusChange={chooseStatus}
                  onFileChange={handleSelectChange}
                />
              </SectionCard>

              <SectionCard title="Financial Details">
                <FinancialSection
                  formData={formData}
                  clientType={clientType}
                  onChange={handleChange}
                  onSelectChange={handleSelectChange}
                />
              </SectionCard>

              {/* Communication Methods belongs to this box - it is how the
                  client is contacted, not a subject of its own. */}
              <SectionCard title="Contact Details">
                <ContactSection
                  formData={formData}
                  onChange={handleChange}
                  onSelectChange={handleSelectChange}
                />
              </SectionCard>
            </form>
          ) : (
            <Card>
              <CardContent className="p-4 sm:p-6">
                {/* A section that carries an Add button draws its own
                    heading, so the button can share the line with it. */}
                {!current.ownsHeader && (
                <div className="mb-6 flex items-center gap-4 border-b pb-3">
                  <h2 className="border-s-4 border-primary ps-3 text-lg font-bold text-primary">
                    {current.label}
                  </h2>
                  {/* Live cases still open, which is what File Status is
                      about */}
                  {activeSection === "analytics" && (
                    <span className="text-base font-bold text-primary">
                      {activeCaseCount}
                    </span>
                  )}
                </div>
                )}


                {activeSection === "documents" && (
                  <DocumentsSection
                    formData={formData}
                    onChange={handleChange}
                  />
                )}
                {activeSection === "contracts" && <ClientContractsSection />}
                {activeSection === "cases" && <LinkedCasesSection />}
                {activeSection === "invoices" && <InvoicesSection clientNo={record?.clientNo} />}
                {activeSection === "management" && record && (
                  <ClientManagementSection />
                )}
                {activeSection === "analytics" && <AnalyticsSection />}
                {activeSection === "merge" && record && (
                  <MergeSection client={record} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
