import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import { Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { IdStatusDot, isEndedStatus } from "@/components/shared/panels";
import ActiveFilters from "@/components/shared/ActiveFilters";
import { useListFilter } from "@/lib/useListFilter";
import { deriveClientStatus } from "@/lib/clientStatus";
import { clientDisplayName } from "./clientRecords";
import { useClients } from "@/lib/clients/context";
import { expiryState, EXPIRY_LABEL } from "@/lib/expiry";


/**
 * A date and what it means, in the cell the date already lives in.
 *
 * The state is said in words as well as colour: red on its own tells anyone
 * who cannot see it nothing at all, and tells everyone else only that
 * something is wrong - not whether the paper has weeks left or has already
 * lapsed.
 */
function ExpiryDate({ date }) {
  const state = expiryState(date);
  if (state === "none") return null;

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* Only an expired date is printed in red; a date with weeks left is
          still a perfectly good date. */}
      <span
        className={cn(
          state === "expired"
            ? "font-medium text-red-600"
            : "text-muted-foreground"
        )}
      >
        {date}
      </span>

      {/* Hollow while the date is only approaching, solid once it has
          passed: the shape says how far gone it is, not just that
          something is wrong. */}
      {state !== "valid" && (
        <span
          aria-hidden="true"
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            state === "expired" ? "bg-red-500" : "border-2 border-red-500"
          )}
        />
      )}

      {/* A date still in hand says nothing: only one running out or already
          gone is worth a word. */}
      {state !== "valid" && (
        <span className="font-medium text-red-600">{EXPIRY_LABEL[state]}</span>
      )}
    </p>
  );
}

/**
 * The attached copy, offered as the icon alone.
 *
 * It sits on the same line as the number it belongs to rather than under it:
 * the word "Document" repeated down two columns of every row said nothing the
 * icon does not, and cost each row a line to say it. The word is kept in the
 * tooltip and read out to screen readers.
 */
function DocumentLink({ url, label }) {
  if (!url) return null;
  return (
    <button
      type="button"
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      className="shrink-0 rounded text-primary hover:text-primary/70 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <FileText className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export default function ClientsList() {
  const navigate = useNavigate();
  const URL_FILTERS = {
    status: { label: "Status", match: (row, value) => row.status === value },
    type: { label: "Type", match: (row, value) => row.type === value },
  };

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const { active, apply, clear } = useListFilter(URL_FILTERS);
  const { clients } = useClients();

  // Inactive and merged clients sit at the end of the list.
  const processedClients = apply(
    clients.map(client => ({
      ...client,
      status: deriveClientStatus(client),
      // Whatever this client absorbed travels in its name, so searching by the
      // old name still finds the records that came in under it.
      clientName: clientDisplayName(clients, client),
    }))
  ).sort((a, b) => {
    const aIsInactive = a.status !== "Active";
    const bIsInactive = b.status !== "Active";
    if (aIsInactive && !bIsInactive) return 1;
    if (!aIsInactive && bIsInactive) return -1;
    return 0;
  });

  // Column definitions
  const columns = [
    {
      key: "clientNo",
      header: "Client No.",
      width: "14%",
      exportValue: (row) => row.clientNo + " (" + row.status + ")",
      // Standing sits with the number rather than in a column of its own:
      // it belongs to the client, not to a separate fact about them.
      render: (value, row) => (
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/clients/${row.id}`);
            }}
            className="numeric-value font-medium text-record-link hover:opacity-80"
          >
            {value}
          </button>
          {/* Only a client that has stopped says so; a live one says nothing. */}
          <IdStatusDot status={row.status} />
        </span>
      ),
    },
    {
      key: "type",
      header: "Client Type",
      width: "13%"
    },
    {
      key: "clientName",
      header: "Client Name",
      width: "25%",
      cellClassName: "font-medium",
    },
    {
      // Number, expiry and the attached copy read as one block per record.
      key: "referenceNo",
      header: "Reference No.",
      width: "24%",
      render: (value, row) => (
        <div className="space-y-1">
          <p className="flex items-center gap-2">
            {value}
            <DocumentLink
              url={row.attachments?.referenceCopy}
              label="Open reference document"
            />
          </p>
          <ExpiryDate date={row.referenceExpiryDate} />
        </div>
      ),
    },
    {
      key: "poaNo",
      header: "POA No.",
      width: "24%",
      render: (value, row) => (
        <div className="space-y-1">
          <p className="flex items-center gap-2">
            {value}
            <DocumentLink
              url={row.attachments?.poaCopy}
              label="Open power of attorney"
            />
          </p>
          <ExpiryDate date={row.poaExpiryDate} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Users}
        title="Clients"
        note="Manage client information"
        onAdd={() => navigate("/clients/create")}
        addLabel="Add Client"
      />

      <ActiveFilters
        filters={active}
        onClear={clear}
        resultCount={processedClients.length}
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            itemLabel="clients"
            data={processedClients}
            // Clients that have stopped are kept, at the foot of the list.
            endedRow={(row) => isEndedStatus(row.status)}
            searchPlaceholder="Ask anything..."
            enableColumnSearch={false}
            currentPage={currentPage}
            totalPages={Math.ceil(processedClients.length / pageSize)}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
