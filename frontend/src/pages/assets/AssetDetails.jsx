import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BackButton from "@/components/shared/BackButton";
import DateField from "@/components/shared/DateField";
import FormHeading from "@/components/shared/FormHeading";
import Panel from "@/components/shared/Panel";
import { EmptyState } from "@/components/shared/panels";
import {
  Box,
  FileText,
  Percent,
  Plus,
  ReceiptText,
  Save,
  TrendingDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFirm } from "@/lib/firm/context";
import { useSuppliers } from "@/lib/suppliers/context";
import { useAssets } from "@/lib/assets/context";
import { Field, FieldLabel, Choice, Worked, Attach } from "@/pages/leases/fields";
import { omr, shortDate, todayIso } from "@/pages/leases/leaseData";
import {
  ASSET_STATUS,
  ASSET_CATEGORIES,
  ASSET_EXPENSE_CATEGORIES,
  FIXED_ASSET_EXPENSES,
  DEPRECIATION_METHODS,
  subcategoriesIn,
  isPurchaseCategory,
  assetCost,
  accumulatedDepreciation,
  netBookValue,
  fullYearsBetween,
  expenseVat,
  expenseTotal,
} from "./assetData";

/**
 * The parts of an asset: what it is and the papers kept with it, what has been
 * spent on it, and how it loses value.
 *
 * `editable` marks the parts saved with Save Changes; expenses are recorded one
 * invoice at a time, each saved as it is entered.
 */
const SECTIONS = [
  { key: "information", label: "Asset Information", icon: Box, editable: true, note: "What the asset is, and the documents kept with it" },
  { key: "expenses", label: "Asset Expenses", icon: ReceiptText, note: "Purchase, maintenance and other costs of this asset" },
  { key: "depreciation", label: "Depreciation", icon: TrendingDown, editable: true, note: "How the asset loses value over its useful life" },
];

const STATUS_OPTIONS = ["active", "maintenance", "disposed"].map((key) => ({
  value: key,
  label: ASSET_STATUS[key].label,
}));

const draftFrom = (asset) =>
  asset
    ? {
        branchId: asset.branchId ? String(asset.branchId) : "",
        name: asset.name || "",
        status: asset.status || "active",
        category: asset.category || "",
        subcategory: asset.subcategory || "",
        brandModel: asset.brandModel || "",
        serialNo: asset.serialNo || "",
        purchaseDate: asset.purchaseDate || "",
        invoiceNo: asset.invoiceNo || "",
        invoiceFile: asset.invoiceFile || "",
        guaranteeNo: asset.guaranteeNo || "",
        guaranteeFile: asset.guaranteeFile || "",
        supplier: asset.supplier || "",
        documents: [...(asset.documents || [])],
        depreciationMethod: asset.depreciationMethod || DEPRECIATION_METHODS[0],
        rate: asset.rate ? String(asset.rate) : "",
        usefulLife: asset.usefulLife ? String(asset.usefulLife) : "",
      }
    : null;

/** Only digits and one decimal point, for amounts, rates and years. */
const decimal = (value) => value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

/** "1 Year", "5 Years". */
const years = (count) => count + (count === 1 ? " Year" : " Years");

/** A typed field, with anything that belongs beside the input (an upload) after it. */
function TextField({ id, label, required, value, onChange, placeholder, type, inputMode, max, hint, children }) {
  // Dates are typed DD/MM/YYYY, never in the browser's own order.
  const Control = type === "date" ? DateField : Input;
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label}
      </FieldLabel>
      {/* The hint hangs below the input rather than taking room in the
          field: fields sit on the row's bottom edge, so a hint in the flow
          would lift this input above the ones beside it. Where fields stack,
          room is kept for it so it cannot run into the next one. */}
      <div className={cn("relative", hint && "mb-5 sm:mb-0")}>
        <div className="flex gap-2">
          <Control
            required={required}
            id={id}
            type={type === "date" ? undefined : type}
            inputMode={inputMode}
            max={max}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="min-w-0 flex-1"
          />
          {children}
        </div>
        {hint && (
          <p className="absolute start-0 top-full mt-1 text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    </Field>
  );
}

/** A supplier list that keeps a name already on the record, even if it is not in the directory. */
const supplierOptions = (suppliers, current) =>
  [
    ...new Set([
      ...suppliers.filter((s) => s.status === "Active").map((s) => s.name),
      ...(current ? [current] : []),
    ]),
  ].map((name) => ({ value: name, label: name }));

/**
 * A new expense on the asset, filled in from what the asset already says.
 *
 * Its first expense is the purchase itself, so that one opens on the asset's
 * own invoice - number, date, supplier and type. Once the purchase is on
 * record, what follows is most often upkeep, so the form opens on maintenance
 * with the supplier still offered as the payee. Only the amounts are left.
 */
function AssetExpenseForm({ asset, suppliers, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => {
    const purchased = (asset.expenses || []).some((e) => isPurchaseCategory(e.category));
    return purchased
      ? { category: "Asset Maintenance & Repairs", subcategory: "", invoiceNo: "", invoiceDate: "", amount: "", vatApplied: true, payee: asset.supplier || "", invoiceFile: "" }
      : { category: asset.category || "Fixed Asset Purchase", subcategory: asset.subcategory || "", invoiceNo: asset.invoiceNo || "", invoiceDate: asset.purchaseDate || "", amount: "", vatApplied: true, payee: asset.supplier || "", invoiceFile: asset.invoiceFile || "" };
  });
  const [error, setError] = useState("");

  const set = (name, value) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
    setError("");
  };
  const hasAmount = Number(draft.amount) > 0;

  const save = () => {
    if (!draft.category || !draft.subcategory || !draft.payee || !draft.invoiceNo.trim() || !draft.invoiceDate || !hasAmount) {
      setError("Complete every field marked * before saving.");
      return;
    }
    onSave({ ...draft, invoiceNo: draft.invoiceNo.trim(), amount: Number(draft.amount) });
  };

  return (
    <Panel title="Add Expense" icon={ReceiptText}>
      <div className="space-y-6">
        <div className="form-grid">
          <Worked id="assetExpenseType" label="Expense Type" value={FIXED_ASSET_EXPENSES} />
          <Choice
            id="assetExpenseCategory"
            label="Category"
            required
            value={draft.category}
            onChange={(value) => setDraft((prev) => ({ ...prev, category: value, subcategory: "" }))}
            options={ASSET_EXPENSE_CATEGORIES.map((c) => ({ value: c.name, label: c.name }))}
          />
          <Choice
            id="assetExpenseSubcategory"
            label="Subcategory"
            required
            value={draft.subcategory}
            onChange={(value) => set("subcategory", value)}
            options={subcategoriesIn(ASSET_EXPENSE_CATEGORIES, draft.category).map((s) => ({ value: s, label: s }))}
            disabled={!draft.category}
          />
          <Choice
            id="assetExpensePayee"
            label="Payee"
            required
            value={draft.payee}
            onChange={(value) => set("payee", value)}
            options={supplierOptions(suppliers, draft.payee)}
            placeholder="Select payee"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 sm:gap-6">
          <TextField
            id="assetExpenseInvoiceNo"
            label="Invoice Number"
            required
            value={draft.invoiceNo}
            onChange={(value) => set("invoiceNo", value)}
            placeholder="e.g. INV-001"
          >
            <Attach
              id="assetExpenseInvoiceFile"
              file={draft.invoiceFile}
              onFile={(name) => set("invoiceFile", name)}
              what="invoice copy"
            />
          </TextField>
          <TextField
            id="assetExpenseInvoiceDate"
            label="Invoice Date"
            required
            type="date"
            max={todayIso()}
            value={draft.invoiceDate}
            onChange={(value) => set("invoiceDate", value)}
          />
          {/* The amount before VAT, with whether VAT is charged on it beside it. */}
          <TextField
            id="assetExpenseAmount"
            label="Amount Before VAT (OMR)"
            required
            inputMode="decimal"
            value={draft.amount}
            onChange={(value) => set("amount", decimal(value))}
            placeholder="0.000"
          >
            <Button
              id="assetExpenseVatToggle"
              type="button"
              variant="outline"
              aria-pressed={draft.vatApplied}
              title={draft.vatApplied ? "VAT charged - click if this invoice has no VAT" : "No VAT - click to charge 5% VAT"}
              onClick={() => set("vatApplied", !draft.vatApplied)}
              className={cn(
                "shrink-0 gap-1 px-2.5",
                draft.vatApplied ? "text-primary" : "text-muted-foreground line-through"
              )}
            >
              <Percent className="h-3.5 w-3.5" />5 %
            </Button>
          </TextField>
          <Worked
            id="assetExpenseVat"
            label={draft.vatApplied ? "VAT 5% (OMR)" : "VAT, none (OMR)"}
            value={hasAmount ? omr(expenseVat(draft)) : ""}
          />
          <Worked
            id="assetExpenseTotal"
            label="Total Amount (OMR)"
            value={hasAmount ? omr(expenseTotal(draft)) : ""}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="me-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            <Save className="me-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/** Everything spent on the asset, the latest invoice first, with what it all comes to. */
function AssetExpensesTable({ expenses }) {
  const rows = [...expenses].sort(
    (x, y) => (y.invoiceDate || "").localeCompare(x.invoiceDate || "") || y.id - x.id
  );
  const sum = (pick) => rows.reduce((total, expense) => total + pick(expense), 0);

  if (rows.length === 0) {
    return <EmptyState>No expenses have been recorded for this asset yet.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-200 border text-sm">
        <thead>
          <tr className="border-b bg-secondary/60 text-start text-primary">
            <th className="p-3 font-semibold">No.</th>
            <th className="p-3 font-semibold">Invoice Date / Number</th>
            <th className="p-3 font-semibold">Expense Details</th>
            <th className="p-3 font-semibold">Payee</th>
            <th className="p-3 text-end font-semibold">Before VAT</th>
            <th className="p-3 text-end font-semibold">VAT</th>
            <th className="p-3 text-end font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((expense, index) => (
            <tr key={expense.id} className="border-b align-top transition-colors hover:bg-primary/5">
              <td className="p-3 text-muted-foreground">{index + 1}</td>
              <td className="p-3">
                <p className="font-semibold text-primary">{shortDate(expense.invoiceDate)}</p>
                <p>{expense.invoiceNo}</p>
                {expense.invoiceFile && (
                  <p title={expense.invoiceFile} className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    Invoice
                  </p>
                )}
              </td>
              <td className="p-3">
                <p className="font-semibold text-primary">{expense.category}</p>
                <p className="text-muted-foreground">{expense.subcategory}</p>
              </td>
              <td className="p-3">{expense.payee}</td>
              <td className="whitespace-nowrap p-3 text-end">{omr(expense.amount)}</td>
              <td className="whitespace-nowrap p-3 text-end text-muted-foreground">{omr(expenseVat(expense))}</td>
              <td className="whitespace-nowrap p-3 text-end font-semibold text-primary">{omr(expenseTotal(expense))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-secondary/40 font-semibold text-primary">
            <td className="p-3" colSpan={4}>Total</td>
            <td className="whitespace-nowrap p-3 text-end">{omr(sum((e) => Number(e.amount || 0)))}</td>
            <td className="whitespace-nowrap p-3 text-end">{omr(sum(expenseVat))}</td>
            <td className="whitespace-nowrap p-3 text-end">{omr(sum(expenseTotal))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * One asset, section by section.
 *
 * Its information and depreciation are edited here and saved together; its
 * expenses are recorded as they come. What it cost, what it has lost and what
 * it is still worth are worked out from those, never typed in.
 */
export default function AssetDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { findAsset, updateAsset, addAssetExpense } = useAssets();
  const { branches } = useFirm();
  const { suppliers } = useSuppliers();

  const asset = findAsset(id);

  const [draft, setDraft] = useState(() => draftFrom(asset));
  const [loadedId, setLoadedId] = useState(id);
  const [section, setSection] = useState("information");
  const [error, setError] = useState("");
  const [addingExpense, setAddingExpense] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [documentFile, setDocumentFile] = useState("");

  // Moving straight from one asset to another reloads the page.
  if (id !== loadedId) {
    setLoadedId(id);
    setDraft(draftFrom(asset));
    setSection("information");
    setError("");
    setAddingExpense(false);
  }

  // Leaving a section closes what was open in it: a form left open would
  // still be open on the way back.
  const [openSection, setOpenSection] = useState(section);
  if (openSection !== section) {
    setOpenSection(section);
    setAddingExpense(false);
  }

  if (!asset || !draft) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">That asset no longer exists.</p>
          <Button type="button" className="mt-4" onClick={() => navigate("/assets")}>
            Back to Assets
          </Button>
        </CardContent>
      </Card>
    );
  }

  const current = SECTIONS.find((option) => option.key === section);
  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));

  // The asset as it would stand if saved now, for the figures worked out from it.
  const preview = {
    ...asset,
    purchaseDate: draft.purchaseDate,
    depreciationMethod: draft.depreciationMethod,
    rate: Number(draft.rate || 0),
  };
  const cost = assetCost(asset);
  const inUse = fullYearsBetween(draft.purchaseDate, todayIso());

  const addDocument = () => {
    if (!documentName.trim() || !documentFile) return;
    setDraft((prev) => ({
      ...prev,
      documents: [
        ...prev.documents,
        {
          id: prev.documents.reduce((max, d) => Math.max(max, d.id), 0) + 1,
          name: documentName.trim(),
          file: documentFile,
          uploadedOn: todayIso(),
        },
      ],
    }));
    setDocumentName("");
    setDocumentFile("");
  };

  const removeDocument = (documentId) =>
    setDraft((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== documentId),
    }));

  const save = () => {
    if (!draft.branchId || !draft.name.trim() || !draft.category || !draft.subcategory) {
      setSection("information");
      setError("Asset Information needs a branch, an asset name, a category and an asset type.");
      return;
    }
    const rate = Number(draft.rate || 0);
    const life = Number(draft.usefulLife || 0);
    if ((draft.rate && !(rate > 0 && rate <= 100)) || (draft.usefulLife && !(life > 0))) {
      setSection("depreciation");
      setError("The depreciation rate must be more than 0 and at most 100, and the useful life more than 0 years.");
      return;
    }
    setError("");
    updateAsset(asset.id, {
      branchId: Number(draft.branchId),
      name: draft.name.trim(),
      status: draft.status,
      category: draft.category,
      subcategory: draft.subcategory,
      brandModel: draft.brandModel.trim(),
      serialNo: draft.serialNo.trim(),
      purchaseDate: draft.purchaseDate,
      invoiceNo: draft.invoiceNo.trim(),
      invoiceFile: draft.invoiceFile,
      invoiceLater: draft.invoiceFile ? false : asset.invoiceLater,
      guaranteeNo: draft.guaranteeNo.trim(),
      guaranteeFile: draft.guaranteeFile,
      supplier: draft.supplier,
      documents: draft.documents,
      depreciationMethod: draft.depreciationMethod,
      rate: draft.rate ? rate : "",
      usefulLife: draft.usefulLife ? life : "",
    });
    navigate("/assets");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/assets" />
          <div className="rounded-xl bg-primary p-2 sm:p-3">
            <Box className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">Asset Details</h1>
            <p className="text-xs text-primary/75 sm:text-sm">
              {asset.assetNo + (asset.name ? " - " + asset.name : "") + " - review and modify"}
            </p>
          </div>
        </div>
        {/* Only where there are fields to save. */}
        {current.editable && (
          <Button type="button" onClick={save}>
            <Save className="me-2 h-4 w-4" />
            Save Changes
          </Button>
        )}
      </div>

      <div className="flex flex-col items-start gap-4 sm:gap-6 lg:flex-row">
        {/* Section navigation */}
        <Card className="w-full lg:sticky lg:top-20 lg:w-64 lg:shrink-0">
          <CardContent className="p-3">
            <p className="mb-2 border-b px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Asset Management
            </p>
            <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
              {SECTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setSection(option.key);
                      setAddingExpense(false);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 text-nowrap rounded-md px-3 py-2 text-start text-sm font-medium transition-colors",
                      section === option.key
                        ? "bg-primary text-primary-foreground"
                        : "text-primary hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {option.label}
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* min-w-0 or a wide table in here would stretch the whole page */}
        <div className="w-full min-w-0 flex-1">
          <Card>
            <CardContent className="space-y-6 p-4 sm:p-6">
              {/* The way to add is not here: it sits on the row above the
                  table it adds to, where every list in the system has it. */}
              <FormHeading title={current.label} note={current.note} icon={current.icon} />

              {error && current.editable && <p className="text-sm text-destructive">{error}</p>}

              {section === "information" && (
                <div className="space-y-6">
                  <div className="form-grid">
                    <Worked id="assetNo" label="Asset No." value={asset.assetNo} />
                    <Choice
                      id="assetBranch"
                      label="Branch"
                      required
                      value={draft.branchId}
                      onChange={(value) => set("branchId", value)}
                      options={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))}
                      placeholder="Select Branch"
                    />
                    <TextField
                      id="assetName"
                      label="Asset Name"
                      required
                      value={draft.name}
                      onChange={(value) => set("name", value)}
                      placeholder="e.g. Laptop"
                    />
                    <Choice
                      id="assetStatus"
                      label="Status"
                      value={draft.status}
                      onChange={(value) => set("status", value)}
                      options={STATUS_OPTIONS}
                    />
                  </div>

                  {/* What kind of asset it is: the category and type it was booked under. */}
                  <div className="form-grid">
                    <Choice
                      id="assetCategory"
                      label="Category"
                      required
                      value={draft.category}
                      onChange={(value) => setDraft((prev) => ({ ...prev, category: value, subcategory: "" }))}
                      options={ASSET_CATEGORIES.map((c) => ({ value: c.name, label: c.name }))}
                    />
                    <Choice
                      id="assetType"
                      label="Asset Type"
                      required
                      value={draft.subcategory}
                      onChange={(value) => set("subcategory", value)}
                      options={subcategoriesIn(ASSET_CATEGORIES, draft.category).map((s) => ({ value: s, label: s }))}
                      disabled={!draft.category}
                    />
                    <TextField
                      id="assetBrandModel"
                      label="Brand & Model"
                      value={draft.brandModel}
                      onChange={(value) => set("brandModel", value)}
                      placeholder="e.g. Dell Latitude 5440"
                    />
                    <TextField
                      id="assetSerialNo"
                      label="Serial No."
                      value={draft.serialNo}
                      onChange={(value) => set("serialNo", value)}
                      placeholder="e.g. DL5440-9823"
                    />
                  </div>

                  <div className="form-grid">
                    <TextField
                      id="assetInvoiceDate"
                      label="Invoice Date"
                      type="date"
                      max={todayIso()}
                      value={draft.purchaseDate}
                      onChange={(value) => set("purchaseDate", value)}
                    />
                    <TextField
                      id="assetInvoiceNo"
                      label="Invoice Number"
                      value={draft.invoiceNo}
                      onChange={(value) => set("invoiceNo", value)}
                      placeholder="e.g. INV-001"
                    >
                      <Attach
                        id="assetInvoiceFile"
                        file={draft.invoiceFile}
                        onFile={(name) => set("invoiceFile", name)}
                        what="invoice copy"
                      />
                    </TextField>
                    <TextField
                      id="assetGuaranteeNo"
                      label="Guarantee Number"
                      value={draft.guaranteeNo}
                      onChange={(value) => set("guaranteeNo", value)}
                      placeholder="Guarantee Number"
                    >
                      <Attach
                        id="assetGuaranteeFile"
                        file={draft.guaranteeFile}
                        onFile={(name) => set("guaranteeFile", name)}
                        what="guarantee"
                      />
                    </TextField>
                    <Choice
                      id="assetSupplier"
                      label="Supplier"
                      value={draft.supplier}
                      onChange={(value) => set("supplier", value)}
                      options={supplierOptions(suppliers, draft.supplier)}
                      placeholder="Please select"
                    />
                  </div>

                  <Panel title="Documents" icon={FileText}>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-end">
                        <TextField
                          id="assetDocumentName"
                          label="Document Name"
                          value={documentName}
                          onChange={setDocumentName}
                          placeholder="e.g. Delivery Note"
                        >
                          <Attach
                            id="assetDocumentFile"
                            file={documentFile}
                            onFile={setDocumentFile}
                            what="document"
                          />
                        </TextField>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addDocument}
                          disabled={!documentName.trim() || !documentFile}
                          className="sm:justify-self-start"
                        >
                          <Plus className="me-2 h-4 w-4" />
                          Add Document
                        </Button>
                      </div>

                      {draft.documents.length === 0 ? (
                        <EmptyState>No documents have been uploaded for this asset.</EmptyState>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full min-w-140 border text-sm">
                            <thead>
                              <tr className="border-b bg-secondary/60 text-start text-primary">
                                <th className="p-3 font-semibold">No.</th>
                                <th className="p-3 font-semibold">Document</th>
                                <th className="p-3 font-semibold">File</th>
                                <th className="p-3 font-semibold">Uploaded On</th>
                                <th className="p-3" />
                              </tr>
                            </thead>
                            <tbody>
                              {draft.documents.map((document, index) => (
                                <tr key={document.id} className="border-b transition-colors last:border-0 hover:bg-primary/5">
                                  <td className="p-3 text-muted-foreground">{index + 1}</td>
                                  <td className="p-3 font-semibold text-primary">{document.name}</td>
                                  <td className="p-3">
                                    <span className="inline-flex items-center gap-1.5">
                                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                                      {document.file}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap p-3">{shortDate(document.uploadedOn)}</td>
                                  <td className="p-3 text-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      title={"Remove " + document.name}
                                      onClick={() => removeDocument(document.id)}
                                    >
                                      <X className="h-4 w-4" />
                                      <span className="sr-only">Remove {document.name}</span>
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              )}

              {section === "expenses" && (
                <div className="space-y-6">
                  {addingExpense && (
                    <AssetExpenseForm
                      asset={asset}
                      suppliers={suppliers}
                      onCancel={() => setAddingExpense(false)}
                      onSave={(expense) => {
                        addAssetExpense(asset.id, expense);
                        setAddingExpense(false);
                      }}
                    />
                  )}

                  {/* The way to add, on the row above the list. */}
                  {!addingExpense && (
                    <div className="flex justify-end">
                      <Button variant="outline"
                        type="button"
                        onClick={() => setAddingExpense(true)}
                      >
                        <Plus className="me-2 h-4 w-4" />
                        Add Expense
                      </Button>
                    </div>
                  )}

                  <AssetExpensesTable expenses={asset.expenses || []} />
                </div>
              )}

              {section === "depreciation" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
                    <Choice
                      id="assetDepreciationMethod"
                      label="Depreciation Method"
                      required
                      value={draft.depreciationMethod}
                      onChange={(value) => set("depreciationMethod", value)}
                      options={DEPRECIATION_METHODS.map((m) => ({ value: m, label: m }))}
                    />
                    <TextField
                      id="assetDepreciationRate"
                      label="Annual Depreciation Rate (%)"
                      inputMode="decimal"
                      value={draft.rate}
                      onChange={(value) => set("rate", decimal(value))}
                      placeholder="e.g. 20"
                    />
                    <TextField
                      id="assetUsefulLife"
                      label="Useful Life (Years)"
                      inputMode="decimal"
                      value={draft.usefulLife}
                      onChange={(value) => set("usefulLife", decimal(value))}
                      placeholder="e.g. 5"
                    />
                  </div>

                  {/* Where the asset stands today, from the settings above. */}
                  <div className="form-grid">
                    <Worked id="assetCost" label="Cost (OMR)" value={cost > 0 ? omr(cost) : ""} />
                    <Worked id="assetYearsInUse" label="Years in Use" value={draft.purchaseDate ? years(inUse) : ""} />
                    <Worked
                      id="assetAccumulated"
                      label="Accumulated Depreciation (OMR)"
                      value={cost > 0 ? omr(accumulatedDepreciation(preview)) : ""}
                    />
                    <Worked
                      id="assetNetBookValue"
                      label="Net Book Value (OMR)"
                      value={cost > 0 ? omr(netBookValue(preview)) : ""}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
