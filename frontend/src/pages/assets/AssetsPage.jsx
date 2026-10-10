import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import FormHeading from "@/components/shared/FormHeading";
import Panel from "@/components/shared/Panel";
import { IdStatusDot, isEndedStatus } from "@/components/shared/panels";
import {
  Box,
  Coins,
  FileText,
  LayoutGrid,
  Plus,
  ReceiptText,
  Save,
  Tag,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFirm } from "@/lib/firm/context";
import { useSuppliers } from "@/lib/suppliers/context";
import { useAssets } from "@/lib/assets/context";
import { Field, FieldLabel, Attach } from "@/pages/leases/fields";
import { CASH, omr, shortDate, todayIso } from "@/pages/leases/leaseData";
import {
  ASSET_EXPENSE_TYPE,
  ASSET_CATEGORIES,
  ASSET_STATUS,
  assetCost,
  assetState,
  accumulatedDepreciation,
  netBookValue,
} from "./assetData";
import { RecordLink } from "@/components/shared/RecordTable";

import DateField from "@/components/shared/DateField";
const emptyDraft = {
  purchaseDate: "",
  invoiceNo: "",
  invoiceFile: "",
  invoiceLater: false,
  guaranteeNo: "",
  guaranteeFile: "",
  supplier: "",
  expenseType: ASSET_EXPENSE_TYPE,
  category: "",
  subcategory: "",
};

/**
 * A choice from a list, with the icon that marks what kind of choice it is.
 * Empty values are ignored - nobody picks "nothing".
 */
function IconSelect({ id, label, required, icon, value, onChange, options, disabled }) {
  const Icon = icon;
  return (
    <Field data-required={required ? "true" : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
      </FieldLabel>
      <Select value={value} onValueChange={(next) => next && onChange(next)} disabled={disabled}>
        {/* The icon sits straight inside the trigger: a wrapping span would take
            the trigger's one-line clamp and stack the icon over the value. */}
        <SelectTrigger id={id} className="justify-start gap-3 [&>svg:last-child]:ms-auto">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
          <SelectValue placeholder="Please select" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** A document kept with the asset, named in its tooltip. */
function DocLink({ file, label }) {
  if (!file) return null;
  return (
    <p title={file} className="flex items-center gap-1.5 text-xs font-medium text-primary">
      <FileText className="h-3.5 w-3.5 shrink-0" />
      {label}
    </p>
  );
}

/** A dash for anything the asset has not been given yet. */
const Missing = () => <span className="text-muted-foreground">-</span>;

/**
 * The fixed asset register.
 *
 * A new asset starts from its purchase invoice - the date, the number with a
 * copy of it (or a note that the copy comes later), the guarantee and the
 * supplier - and the expense it is booked under. What the asset is, its cost,
 * depreciation rate and payment are completed afterwards, and show as not yet
 * recorded until they are.
 *
 * What it has lost so far and what it is still worth are worked out from the
 * cost, the rate and the years since it was bought, never typed in.
 */
export default function AssetsPage() {
  const { branches, bankAccounts } = useFirm();
  const { suppliers } = useSuppliers();
  const navigate = useNavigate();
  const { assets, addAsset } = useAssets();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));

  const subcategories =
    ASSET_CATEGORIES.find((category) => category.name === draft.category)?.subcategories || [];

  /** A different category has different subcategories, so the old one goes. */
  const chooseCategory = (value) =>
    setDraft((prev) => ({ ...prev, category: value, subcategory: "" }));

  /** An attached copy and "later" cannot both be true. Either answers the copy's error. */
  const attachInvoice = (name) => {
    setDraft((prev) => ({ ...prev, invoiceFile: name, invoiceLater: false }));
    setError("");
  };
  const toggleInvoiceLater = () => {
    setDraft((prev) => ({ ...prev, invoiceLater: !prev.invoiceLater, invoiceFile: "" }));
    setError("");
  };

  const close = () => {
    setAdding(false);
    setDraft(emptyDraft);
    setError("");
  };

  const save = () => {
    if (!draft.invoiceNo.trim() || !draft.category || !draft.subcategory) {
      setError("Invoice Number, Category and Subcategory are required.");
      return;
    }
    if (!draft.invoiceFile && !draft.invoiceLater) {
      setError("Upload the invoice copy, or choose Later to add it afterwards.");
      return;
    }
    addAsset({
      ...draft,
      invoiceNo: draft.invoiceNo.trim(),
      guaranteeNo: draft.guaranteeNo.trim(),
      status: "active",
    });
    // New assets join the end of the register, so show the page they land on.
    setCurrentPage(Math.ceil((assets.length + 1) / pageSize));
    close();
  };

  const branchLabel = (branchId) => {
    const branch = branches.find((option) => option.id === Number(branchId));
    return branch ? branch.name + " Branch" : "-";
  };

  const rows = assets.map((asset) => {
    // What its purchase invoices add up to, before VAT - never stored.
    const cost = assetCost(asset);
    const hasCost = cost > 0;
    return {
      ...asset,
      cost,
      hasCost,
      state: assetState(asset),
      branchLabel: branchLabel(asset.branchId),
      accumulated: hasCost ? accumulatedDepreciation(asset) : null,
      netBookValue: hasCost ? netBookValue(asset) : null,
    };
  });

  const paymentLines = (row) => {
    if (!row.method || row.method === CASH) return [];
    const account = bankAccounts.find((option) => option.id === Number(row.bankAccountId));
    return account ? [account.bankName, account.accountNumber] : ["-"];
  };

  /** What the asset is: its type, or until that is entered, the subcategory it was booked under. */
  const typeOf = (row) => row.type || row.subcategory;

  const figure = (value) =>
    value === null || value === undefined ? (
      <Missing />
    ) : (
      <span className="font-semibold text-primary">{omr(value)}</span>
    );

  const columns = [
    {
      // An asset that has been disposed of says so beside its number; one
      // still in use says nothing, so there is no status column either way.
      key: "assetNo",
      header: "Asset No.",
      subHeader: "Branch",
      width: "9%",
      exportValue: (row) =>
        row.assetNo + " - " + row.branchLabel + " (" + ASSET_STATUS[row.state].label + ")",
      sortValue: (row) => row.assetNo,
      render: (value, row) => (
        <div className="flex items-start gap-3">
          <div>
            {/* The number opens the asset itself. */}
            <RecordLink
              onClick={() => navigate("/assets/" + row.id)}
              title={"Open " + value}
              className="text-base"
            >
              {value}
            </RecordLink>
            <p className="whitespace-nowrap text-primary/80">{row.branchLabel}</p>
          </div>
          <IdStatusDot status={ASSET_STATUS[row.state].label} />
        </div>
      ),
    },
    {
      key: "name",
      header: "Asset Details",
      subHeader: "Name / Type / Brand & Model / Serial No.",
      width: "16%",
      exportValue: (row) =>
        [row.name || "-", typeOf(row), row.brandModel, row.serialNo && "SN: " + row.serialNo]
          .filter(Boolean)
          .join(" - "),
      sortValue: (row) => row.name || null,
      render: (value, row) => (
        <div className="text-primary/80">
          <p className="font-semibold text-primary">{value || "-"}</p>
          {typeOf(row) && <p>{typeOf(row)}</p>}
          {row.brandModel && <p>{row.brandModel}</p>}
          {row.serialNo && <p>SN: {row.serialNo}</p>}
        </div>
      ),
    },
    {
      key: "purchaseDate",
      header: "Purchase Details",
      subHeader: "Date / Supplier / Invoice No.",
      width: "15%",
      exportValue: (row) =>
        [shortDate(row.purchaseDate), row.supplier || "-", row.invoiceNo].filter(Boolean).join(" - "),
      sortValue: (row) => row.purchaseDate || null,
      render: (value, row) => (
        <div className="space-y-0.5 text-primary/80">
          <p className="font-semibold text-primary">{shortDate(value)}</p>
          <p>{row.supplier || "-"}</p>
          {row.invoiceNo && <p>{row.invoiceNo}</p>}
          <DocLink file={row.invoiceFile} label="Purchase Invoice" />
          <DocLink file={row.guaranteeFile} label="Warranty Invoice" />
        </div>
      ),
    },
    {
      // Figures read from the right, the way a ledger is read.
      key: "cost",
      header: "Cost",
      width: "9%",
      className: "text-end",
      cellClassName: "text-end",
      exportValue: (row) => (row.hasCost ? omr(row.cost) : "-"),
      sortValue: (row) => (row.hasCost ? row.cost : null),
      render: (value, row) => figure(row.hasCost ? value : null),
    },
    {
      key: "rate",
      header: "Depreciation Rate",
      subHeader: "(Per Annum)",
      width: "9%",
      className: "text-end",
      cellClassName: "text-end",
      exportValue: (row) => (row.rate ? row.rate + "%" : "-"),
      sortValue: (row) => row.rate || null,
      render: (value) => (value ? <span className="text-primary/80">{value}%</span> : <Missing />),
    },
    {
      // Worked out from the cost, the rate and the full years since purchase.
      key: "accumulated",
      header: "Accumulated Depreciation",
      width: "10%",
      className: "text-end",
      cellClassName: "text-end",
      disableSort: true,
      exportValue: (row) => (row.hasCost ? omr(row.accumulated) : "-"),
      render: (value) => figure(value),
    },
    {
      key: "netBookValue",
      header: "Net Book Value",
      width: "9%",
      className: "text-end",
      cellClassName: "text-end",
      exportValue: (row) => (row.hasCost ? omr(row.netBookValue) : "-"),
      sortValue: (row) => row.netBookValue,
      render: (value) => figure(value),
    },
    {
      key: "method",
      header: "Payment Details",
      subHeader: "Method / Bank / Account No. / Transaction No.",
      width: "16%",
      disableSort: true,
      exportValue: (row) =>
        [row.method || "-", ...paymentLines(row), row.transactionNo].filter(Boolean).join(" - "),
      render: (value, row) => (
        <div className="space-y-0.5 text-primary/80">
          <p className="font-semibold text-primary">{value || "-"}</p>
          {paymentLines(row).map((line) => (
            <p key={line}>{line}</p>
          ))}
          {row.transactionNo && <p>{row.transactionNo}</p>}
          <DocLink file={row.receiptFile} label="Transfer Receipt" />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Box}
        title="Assets"
        note="Fixed Asset Register"
        onAdd={adding ? null : () => setAdding(true)}
        addLabel="Add Asset"
      />

      {adding && (
        <Card>
          <CardContent className="space-y-6 p-4 sm:p-6">
            <FormHeading title="Add New Asset" icon={Box} />

            <Panel title="Invoice Data" icon={ReceiptText}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.25fr)_minmax(0,1fr)]">
                <Field>
                  <FieldLabel htmlFor="assetInvoiceDate">Invoice Date</FieldLabel>
                  <DateField
                    id="assetInvoiceDate"
                    max={todayIso()}
                    value={draft.purchaseDate}
                    onChange={(e) => set("purchaseDate", e.target.value)}
                  />
                </Field>

                {/* The number, with its copy - or a note that the copy follows. */}
                <Field>
                  <FieldLabel htmlFor="assetInvoiceNo" required>
                    Invoice Number
                  </FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="assetInvoiceNo"
                      value={draft.invoiceNo}
                      onChange={(e) => set("invoiceNo", e.target.value)}
                      placeholder="e.g. INV-001"
                      autoComplete="off"
                      className="min-w-0 flex-1"
                    />
                    <Attach
                      id="assetInvoiceFile"
                      file={draft.invoiceFile}
                      onFile={attachInvoice}
                      what="invoice copy"
                    />
                    <Button
                      id="assetInvoiceLater"
                      type="button"
                      variant="outline"
                      aria-pressed={draft.invoiceLater}
                      title={draft.invoiceLater ? "The invoice copy will be added later" : "Add the invoice copy later"}
                      onClick={toggleInvoiceLater}
                      className={cn(
                        "shrink-0 px-3",
                        draft.invoiceLater && "border-primary bg-primary/10 text-primary"
                      )}
                    >
                      Later
                    </Button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="assetGuaranteeNo">Guarantee Number</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="assetGuaranteeNo"
                      value={draft.guaranteeNo}
                      onChange={(e) => set("guaranteeNo", e.target.value)}
                      placeholder="Guarantee Number"
                      autoComplete="off"
                      className="min-w-0 flex-1"
                    />
                    <Attach
                      id="assetGuaranteeFile"
                      file={draft.guaranteeFile}
                      onFile={(name) => set("guaranteeFile", name)}
                      what="guarantee"
                    />
                  </div>
                </Field>

                <IconSelect
                  id="assetSupplier"
                  label="Supplier"
                  value={draft.supplier}
                  onChange={(value) => set("supplier", value)}
                  options={suppliers
                    .filter((supplier) => supplier.status === "Active")
                    .map((supplier) => supplier.name)}
                />
              </div>
            </Panel>

            <Panel title="Expense Details" icon={FileText}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
                <IconSelect
                  id="assetExpenseType"
                  label="Type of Expense"
                  icon={Coins}
                  value={draft.expenseType}
                  onChange={(value) => set("expenseType", value)}
                  options={[ASSET_EXPENSE_TYPE]}
                />
                <IconSelect
                  id="assetCategory"
                  label="Category"
                  required
                  icon={LayoutGrid}
                  value={draft.category}
                  onChange={chooseCategory}
                  options={ASSET_CATEGORIES.map((category) => category.name)}
                />
                <IconSelect
                  id="assetSubcategory"
                  label="Subcategory"
                  required
                  icon={Tag}
                  value={draft.subcategory}
                  onChange={(value) => set("subcategory", value)}
                  options={subcategories}
                  disabled={!draft.category}
                />
              </div>
            </Panel>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={close}>
                <X className="me-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="button" onClick={save}>
                <Save className="me-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            itemLabel="assets"
            data={rows}
            // An asset out of service is kept, at the foot of the register.
            endedRow={(row) => isEndedStatus(ASSET_STATUS[row.state].label)}
            searchPlaceholder="Ask AI anything..."
            exportFileName="assets.csv"
            enableColumnSearch={false}
            enableSorting
            currentPage={currentPage}
            totalPages={Math.ceil(rows.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
