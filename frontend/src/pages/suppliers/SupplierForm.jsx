import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGoBack } from "@/lib/useGoBack";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/shared/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  ArrowLeft,
  Save,
  FileText,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SupplierPaymentsSection from "./SupplierPaymentsSection";
import SupplierDocumentsSection from "./SupplierDocumentsSection";
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_DIAL_CODE,
  RECEIVING_BANKS,
} from "@/lib/constants";
import { useSuppliers } from "@/lib/suppliers/context";
import { SUPPLIER_CATEGORIES, SUPPLIER_STATUSES } from "./supplierData";

/**
 * The sections of a supplier record.
 *
 * `existingOnly` keeps payments behind a saved supplier: a supplier that
 * has not been created yet has nothing to have been billed for.
 *
 * Documents are not a section of their own: the C.R, the contract and the tax
 * certificates are what the details above them are taken from, so they are
 * read on the same page as those details.
 */
const SECTIONS = [
  { key: "information", label: "Supplier Information", icon: FileText },
  {
    key: "payments",
    label: "Supplier Payments",
    icon: Wallet,
    existingOnly: true,
  },
];

const emptySupplier = {
  name: "",
  category: "",
  commercialRegistration: "",
  taxIdentificationNumber: "",
  vatNumber: "",
  bank: "",
  accountNumber: "",
  dialCode: DEFAULT_DIAL_CODE,
  phone: "",
  status: "Active",
};

/** Phone is stored as one string; the form edits the code and number apart. */
const splitPhone = (phone) => {
  const match = /^(\+\d+)\s*(.*)$/.exec(phone || "");
  return match
    ? { dialCode: match[1], phone: match[2] }
    : { dialCode: DEFAULT_DIAL_CODE, phone: phone || "" };
};

const draftFrom = (supplier) => {
  if (!supplier) return emptySupplier;
  const { phone, ...rest } = supplier;
  return { ...emptySupplier, ...rest, ...splitPhone(phone) };
};

export default function SupplierForm() {
  const navigate = useNavigate();
  const goBack = useGoBack("/suppliers");
  const { id } = useParams();
  const { suppliers, addSupplier, updateSupplier } = useSuppliers();

  const existing = id ? suppliers.find((s) => String(s.id) === id) : null;
  const isEdit = Boolean(id);

  const [draft, setDraft] = useState(() => draftFrom(existing));
  const [loadedId, setLoadedId] = useState(id);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("information");

  // Moving straight from one supplier to another reloads the form.
  if (id !== loadedId) {
    setLoadedId(id);
    setDraft(draftFrom(existing));
    setError("");
    setActiveSection("information");
  }

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));
  const onChange = (e) => set(e.target.name, e.target.value);

  const canSave = draft.name.trim() && draft.category;

  // A supplier that has not been saved has no payments to show.
  const sections = SECTIONS.filter((section) => isEdit || !section.existingOnly);
  const isInformation = activeSection === "information";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSave) {
      setError("A supplier needs at least a name and a category.");
      return;
    }
    const { dialCode, phone, ...rest } = draft;
    const record = { ...rest, phone: phone ? dialCode + " " + phone : "" };
    if (isEdit) {
      updateSupplier(existing.id, record);
    } else {
      addSupplier(record);
    }
    navigate("/suppliers");
  };

  if (isEdit && !existing) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            That supplier no longer exists.
          </p>
          <Button className="mt-4" onClick={goBack}>
            Back to Suppliers
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/suppliers" />
          <div className="rounded-xl bg-primary p-2 sm:p-3">
            <Truck className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">
              {isEdit ? "Supplier Details" : "Add Supplier"}
            </h1>
            <p className="text-xs text-primary/75 sm:text-sm">
              {isEdit
                ? existing.supplierId + " - review and modify"
                : "Create a new supplier record"}
            </p>
          </div>
        </div>
        {/* Payments are a record of what happened, so there is nothing to
            save while they are on screen. */}
        {isInformation && (
          <Button type="submit" form="supplier-form">
            <Save className="me-2 h-4 w-4" />
            {isEdit ? "Save Changes" : "Save Supplier"}
          </Button>
        )}
      </div>

      <div className="flex flex-col items-start gap-4 sm:gap-6 lg:flex-row">
        {/* Section navigation */}
        <Card className="w-full lg:sticky lg:top-20 lg:w-60 lg:shrink-0">
          <CardContent className="p-3">
            <p className="mb-2 border-b px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Supplier Details
            </p>
            <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
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

        {/* min-w-0 or a wide table in here would stretch the whole page */}
        <div className="w-full min-w-0 flex-1">
          {activeSection === "payments" ? (
            <SupplierPaymentsSection supplier={existing} />
          ) : (
      <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardContent className="p-4 sm:p-6">
          <form id="supplier-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="form-grid">
              <div className="form-field space-y-2">
                <Label htmlFor="supplierName">Supplier Name</Label>
                <Input
                  required
                  id="supplierName"
                  name="name"
                  value={draft.name}
                  onChange={onChange}
                  placeholder="e.g. Muscat Stationery Est."
                />
              </div>

              <div data-required="true" className="form-field space-y-2">
                <Label htmlFor="supplierCategory">Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(value) => set("category", value)}
                >
                  <SelectTrigger id="supplierCategory">
                    <SelectValue placeholder="Please Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commercialRegistration">
                  Commercial Registration (CR)
                </Label>
                <Input
                  id="commercialRegistration"
                  name="commercialRegistration"
                  value={draft.commercialRegistration}
                  onChange={onChange}
                  placeholder="Enter CR number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxIdentificationNumber">
                  Tax Identification Number (TIN)
                </Label>
                <Input
                  id="taxIdentificationNumber"
                  name="taxIdentificationNumber"
                  value={draft.taxIdentificationNumber}
                  onChange={onChange}
                  placeholder="Enter TIN"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT Number</Label>
                <Input
                  id="vatNumber"
                  name="vatNumber"
                  value={draft.vatNumber}
                  onChange={onChange}
                  placeholder="Enter VAT number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierBank">Supplier&apos;s Bank</Label>
                <Select
                  value={draft.bank}
                  onValueChange={(value) => set("bank", value)}
                >
                  <SelectTrigger id="supplierBank">
                    <SelectValue placeholder="Please Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECEIVING_BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierAccount">
                  Supplier&apos;s Account Number
                </Label>
                <Input
                  id="supplierAccount"
                  name="accountNumber"
                  value={draft.accountNumber}
                  onChange={onChange}
                  placeholder="Account number or IBAN"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierPhone">Phone Number</Label>
                <div className="flex gap-2">
                  <Select
                    value={draft.dialCode}
                    onValueChange={(value) => set("dialCode", value)}
                  >
                    <SelectTrigger
                      className="w-24 shrink-0"
                      aria-label="Country code"
                    >
                      <SelectValue>{draft.dialCode}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COUNTRY_DIAL_CODES.map((country) => (
                        <SelectItem key={country.code} value={country.dial}>
                          <span className="inline-flex w-full items-center gap-2">
                            <span className="w-12 shrink-0 font-medium">
                              {country.dial}
                            </span>
                            <span className="opacity-70">{country.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="supplierPhone"
                    name="phone"
                    value={draft.phone}
                    onChange={onChange}
                    placeholder="XXXX XXXX"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierStatus">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) => set("status", value)}
                >
                  <SelectTrigger id="supplierStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>

      {/* The supplier's papers, under the details they back. Only once the
          supplier exists: there is nobody to file a paper against before. */}
      {/* Keyed on the supplier: moving to another one starts its papers - and
          anything half-written over them - afresh. */}
      {isEdit && (
        <SupplierDocumentsSection key={existing?.id} supplier={existing} />
      )}
      </div>
          )}
        </div>
      </div>
    </div>
  );
}
