import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { IdStatusDot, isEndedStatus } from "@/components/shared/panels";
import { Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFirm } from "@/lib/firm/context";
import { useSuppliers } from "@/lib/suppliers/context";
import { useLeases } from "@/lib/leases/context";
import {
  PROPERTY_TYPES,
  LEASE_STATE,
  leaseMonths,
  leaseState,
  nextPaymentDate,
  frequencyLabel,
  vatOf,
  totalOf,
  omr,
  shortDate,
} from "./leaseData";
import { checkRequired } from "@/components/shared/formFields";

const emptyDraft = {
  landlord: "",
  branchId: "",
  propertyType: "",
  address: "",
};

/** A field's label. */
function FieldLabel({ htmlFor, children }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      
    </Label>
  );
}

/** A required choice from a fixed list. */
function Choice({ id, label, value, onChange, options, placeholder }) {
  return (
    <div className="flex h-full flex-col justify-end gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A dash for anything the contract has not been given yet. */
const Missing = () => <span className="text-muted-foreground">-</span>;

/**
 * Every lease the firm holds, in one list.
 *
 * A new lease starts with the property: who it is rented from, which branch
 * uses it, what kind of place it is and where. Saving puts it straight into the
 * rental contracts table, where the contract's own figures - its dates, rent
 * and payments - show as not yet recorded until they are.
 *
 * What follows from those figures (the months, the VAT and total, the next
 * payment and whether the lease is running out) is worked out on the spot,
 * never stored.
 */
export default function LeasesPage() {
  const navigate = useNavigate();
  const { branches } = useFirm();
  const { suppliers } = useSuppliers();
  // Shared with each lease's own page, so a change made there shows here.
  const { leases, addLease } = useLeases();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const set = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));

  // Landlords are chosen from the supplier directory, so a landlord is paid
  // through the same record - bank, account, tax numbers - as anyone else the
  // firm pays. Only suppliers still in use are offered.
  const landlords = suppliers
    .filter((supplier) => supplier.status === "Active")
    .map((supplier) => ({ value: supplier.name, label: supplier.name }));

  const branchName = (branchId) =>
    branches.find((branch) => branch.id === Number(branchId))?.name || "-";

  const canSave =
    draft.landlord &&
    draft.branchId &&
    draft.propertyType &&
    draft.address.trim();

  const close = () => {
    setAdding(false);
    setDraft(emptyDraft);
  };

  const save = () => {
    if (!checkRequired() || !canSave) return;
    // The number and the empty contract are filled in where leases are kept.
    addLease({
      landlord: draft.landlord,
      branchId: Number(draft.branchId),
      propertyType: draft.propertyType,
      address: draft.address.trim(),
    });
    setCurrentPage(1);
    close();
  };

  // The rows the table reads: the contract, with its branch named and its
  // place in the list numbered.
  const rows = leases.map((lease, index) => ({
    ...lease,
    rowNo: index + 1,
    branchName: branchName(lease.branchId),
    state: leaseState(lease),
  }));

  /** The property as it is described: its building and unit, or its address. */
  const propertyLines = (row) =>
    row.building ? [row.building, row.unit].filter(Boolean) : [row.address || "-"];

  const columns = [
    {
      // The dot says where the lease stands, so there is no status column.
      key: "rowNo",
      header: "#",
      width: "5%",
      exportValue: (row) => row.rowNo + " (" + LEASE_STATE[row.state].label + ")",
      render: (value, row) => (
        <span className="inline-flex items-center gap-2">
          {/* The number opens the lease itself. */}
          <button
            type="button"
            onClick={() => navigate("/leases/" + row.id)}
            title={"Open " + (row.contractNo || "this lease")}
            className="numeric-value font-medium text-record-link hover:opacity-80"
          >
            {value}
          </button>
          <IdStatusDot status={LEASE_STATE[row.state].label} />
        </span>
      ),
    },
    {
      key: "branchName",
      header: "Branch",
      subHeader: "Property Type",
      width: "10%",
      exportValue: (row) => row.branchName + " - " + row.propertyType,
      render: (value, row) => (
        <div>
          <p className="font-semibold text-primary">{value}</p>
          <p className="text-primary/80">{row.propertyType}</p>
        </div>
      ),
    },
    {
      key: "building",
      header: "Property Information",
      width: "15%",
      exportValue: (row) => propertyLines(row).join(" - "),
      render: (_, row) => (
        <div className="text-primary/80">
          {propertyLines(row).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ),
    },
    {
      key: "landlord",
      header: "Landlord",
      width: "14%",
      render: (value) => <span className="text-primary/80">{value}</span>,
    },
    {
      key: "contractNo",
      header: "Contract No.",
      width: "10%",
      render: (value) => (
        <span className="whitespace-nowrap text-primary/80">{value || "-"}</span>
      ),
    },
    {
      // The two dates and the months between them, counted rather than typed.
      key: "start",
      header: "Contract Period",
      subHeader: "Duration",
      width: "11%",
      exportValue: (row) =>
        row.start && row.end
          ? shortDate(row.start) +
            " to " +
            shortDate(row.end) +
            " (" +
            leaseMonths(row.start, row.end) +
            " Months)"
          : "-",
      render: (value, row) =>
        value && row.end ? (
          <div className="whitespace-nowrap text-primary/80">
            <p>{shortDate(value)}</p>
            <p>{shortDate(row.end)}</p>
            <p>{leaseMonths(value, row.end)} Months</p>
          </div>
        ) : (
          <Missing />
        ),
    },
    {
      // The rent for one payment, its VAT and what the two come to.
      key: "rent",
      header: "Rental Value · VAT 5% · Total",
      width: "12%",
      // Monthly rent. A lease exempt from VAT (a flat, say) shows 0.000 VAT.
      exportValue: (row) =>
        Number(row.rent) > 0
          ? omr(row.rent) +
            " + " +
            omr(vatOf(row.rent, row.vatApplied)) +
            " = " +
            omr(totalOf(row.rent, row.vatApplied))
          : "-",
      render: (value, row) =>
        Number(value) > 0 ? (
          <div className="whitespace-nowrap">
            <p className="text-primary">{omr(value)}</p>
            <p className="text-primary/80">{omr(vatOf(value, row.vatApplied))}</p>
            <p className="font-semibold text-primary">
              {omr(totalOf(value, row.vatApplied))}
            </p>
          </div>
        ) : (
          <Missing />
        ),
    },
    {
      key: "frequency",
      header: "Payment Frequency",
      subHeader: "Payment Method",
      width: "12%",
      // How often is read off the contract's months and its number of
      // installments - twelve months in four installments is Quarterly.
      exportValue: (row) =>
        frequencyLabel(row) ? frequencyLabel(row) + " - " + (row.method || "-") : "-",
      render: (_, row) =>
        frequencyLabel(row) ? (
          <div>
            <p className="font-semibold text-primary">{frequencyLabel(row)}</p>
            <p className="text-primary/80">{row.method || "-"}</p>
          </div>
        ) : (
          <Missing />
        ),
    },
    {
      key: "nextPayment",
      header: "Next Payment Date",
      width: "11%",
      exportValue: (row) => shortDate(nextPaymentDate(row)),
      render: (_, row) => (
        <span className="whitespace-nowrap text-primary/80">
          {shortDate(nextPaymentDate(row))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Home}
        title="Leases"
        note="Manage all lease contracts in one place"
        onAdd={adding ? null : () => setAdding(true)}
        addLabel="Add New Lease"
      />

      {adding && (
        <Card>
          <CardContent className="space-y-6 p-4 sm:p-6">
            <FormHeading
              title="Property Details"
              note="Information about the leased property"
              icon={Home}
            />

            <div className="form-grid">
              <Choice
                id="leaseLandlord"
                label="Landlord"
                value={draft.landlord}
                onChange={(value) => set("landlord", value)}
                options={landlords}
                placeholder="Select landlord from suppliers"
              />
              <Choice
                id="leaseBranch"
                label="Branch"
                value={draft.branchId}
                onChange={(value) => set("branchId", value)}
                options={branches.map((branch) => ({
                  value: String(branch.id),
                  label: branch.name,
                }))}
                placeholder="Select Branch"
              />
              <Choice
                id="leasePropertyType"
                label="Property Type"
                value={draft.propertyType}
                onChange={(value) => set("propertyType", value)}
                options={PROPERTY_TYPES.map((type) => ({ value: type, label: type }))}
                placeholder="Select Property Type"
              />
              <div className="flex h-full flex-col justify-end gap-2">
                <FieldLabel htmlFor="leaseAddress">Address</FieldLabel>
                <Input
                  id="leaseAddress"
                  value={draft.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="e.g. Al Khuwair, Muscat"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="button" onClick={save}>
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
            itemLabel="leases"
            data={rows}
            // A lease that has ended or been cancelled sits under the running
            // ones rather than among them.
            endedRow={(row) => isEndedStatus(LEASE_STATE[row.state].label)}
            searchPlaceholder="Ask about leases..."
            exportFileName="leases.csv"
            enableColumnSearch={false}
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
