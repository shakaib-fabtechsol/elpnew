import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SearchableSelect from "@/components/shared/SearchableSelect";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
} from "@/components/shared/RecordTable";
import { EmptyState } from "@/components/shared/panels";
import { ArrowRight, Check } from "lucide-react";
import { useClients } from "@/lib/clients/context";
import { clientDisplayName, mergedInto } from "../clientRecords";
import { MERGE_TRANSFER_ITEMS } from "../clientMockData";
import { checkRequired } from "@/components/shared/formFields";

import DateField from "@/components/shared/DateField";
/** Which name the two clients are to carry once they are one. */
const KEEP_MAIN = "main";
const KEEP_MERGED = "merged";
const NEW_NAME = "new";

const today = () => new Date().toISOString().slice(0, 10);

/** "16/09/2026" */
const shortDate = (value) => {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  return day + "/" + month + "/" + year;
};

/** A field's label. */
function FieldLabel({ htmlFor, children }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
    </Label>
  );
}

/**
 * Folding one client into another.
 *
 * The profile being viewed is the main client - that is what makes this a page
 * rather than a form, so it is stated, not chosen. What is asked for is the day
 * the merge is booked, the client coming in, and the name the two are to carry
 * afterwards: either of their own, or a new one written here.
 */
export default function MergeSection({ client }) {
  const navigate = useNavigate();
  const { clients, mergeClients } = useClients();

  const [mergeDate, setMergeDate] = useState(today);
  const [otherId, setOtherId] = useState("");
  const [naming, setNaming] = useState(KEEP_MAIN);
  const [newName, setNewName] = useState({ english: "", arabic: "" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);

  const other = clients.find((c) => String(c.id) === otherId) || null;
  // The most recent merge at the top of the history.
  const absorbed = [...mergedInto(clients, client)].sort((a, b) =>
    String(b.mergedOn || "").localeCompare(String(a.mergedOn || ""))
  );

  // A client already folded into somewhere cannot be folded in again, and a
  // client this one was folded into cannot be pulled back the other way.
  const options = clients.filter(
    (c) =>
      c.id !== client.id &&
      !c.mergedIntoClientNo &&
      c.clientNo !== client.mergedIntoClientNo
  );

  const writingName = naming === NEW_NAME;

  /** What the two will be called once the merge is made. */
  const resulting =
    naming === KEEP_MAIN
      ? { english: client.clientName, arabic: client.arabicName }
      : naming === KEEP_MERGED
        ? { english: other?.clientName || "", arabic: other?.arabicName || "" }
        : { english: newName.english.trim(), arabic: newName.arabic.trim() };

  const canMerge =
    mergeDate &&
    other &&
    (!writingName || (newName.english.trim() && newName.arabic.trim()));

  const handleMerge = () => {
    if (!checkRequired() || !canMerge) return;
    mergeClients(other.clientNo, client.clientNo, {
      on: mergeDate,
      name: resulting.english,
      arabicName: resulting.arabic,
    });
    setResult({ from: other.clientName, name: resulting.english });
    setOtherId("");
    setNaming(KEEP_MAIN);
    setNewName({ english: "", arabic: "" });
    setMergeDate(today());
    setConfirmOpen(false);
  };

  if (result) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-green-600">
            <Check className="h-5 w-5" />
            <h3 className="font-semibold">Merge completed</h3>
          </div>

          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Merged in: </span>
              {result.from}
            </p>
            <p>
              <span className="text-muted-foreground">Now reads as: </span>
              <span className="font-medium">
                {clientDisplayName(clients, client)}
              </span>
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-4">
            <p className="mb-2 text-sm font-medium">Moved to {result.name}</p>
            <ul className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              {MERGE_TRANSFER_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-3 w-3 shrink-0 text-green-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            {result.from} was kept, not deleted. Its profile stays open to read
            and now shows that it was merged with {result.name}.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setResult(null)}>
              Merge another client
            </Button>
            <Button onClick={() => navigate("/clients")}>Back to Clients</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
          {/* The day it is booked, who is coming in, and - underneath - the
              name the two carry afterwards. */}
          <div className="form-grid form-grid-3">
            <div className="space-y-2">
              <FieldLabel htmlFor="mergeDate" required>
                Merge Date
              </FieldLabel>
              <DateField
                id="mergeDate"
                value={mergeDate}
                onChange={(e) => setMergeDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="mainClient">Main Client</FieldLabel>
              <Input
                id="mainClient"
                value={client.clientName}
                readOnly
                tabIndex={-1}
                className="cursor-default bg-locked text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="mergedClient" required>
                Client to Be Merged
              </FieldLabel>
              <SearchableSelect
                id="mergedClient"
                value={otherId}
                onValueChange={setOtherId}
                options={options.map((c) => ({
                  value: String(c.id),
                  label: c.clientName,
                }))}
                placeholder="Select client"
                searchPlaceholder="Search by name..."
              />
            </div>

            {/* Either name may be kept, or a new one written for the two of
                them together - which is what the two fields below are for. */}
            <div className="space-y-2">
              <FieldLabel htmlFor="mergeNaming" required>
                Client Name After Merge
              </FieldLabel>
              <Select
                value={naming}
                onValueChange={(value) => value && setNaming(value)}
              >
                <SelectTrigger id="mergeNaming">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP_MAIN}>
                    {client.clientName} — Main Client
                  </SelectItem>
                  <SelectItem value={KEEP_MERGED} disabled={!other}>
                    {other
                      ? other.clientName + " — Merged Client"
                      : "Merged client's name"}
                  </SelectItem>
                  <SelectItem value={NEW_NAME}>New Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {writingName && (
              <>
                <div className="space-y-2">
                  <FieldLabel htmlFor="mergeNameAr" required>
                    Client Name (Arabic)
                  </FieldLabel>
                  <Input
                    id="mergeNameAr"
                    dir="rtl"
                    value={newName.arabic}
                    onChange={(e) =>
                      setNewName((prev) => ({ ...prev, arabic: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel htmlFor="mergeNameEn" required>
                    Client Name (English)
                  </FieldLabel>
                  <Input
                    id="mergeNameEn"
                    value={newName.english}
                    onChange={(e) =>
                      setNewName((prev) => ({
                        ...prev,
                        english: e.target.value,
                      }))
                    }
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
            >
              Merge Clients
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* What has already been folded in, and what each merge produced */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <p className="mb-4 text-base font-bold text-primary">Merge History</p>

          {absorbed.length === 0 ? (
            <EmptyState>No client has been merged into this one yet.</EmptyState>
          ) : (
            <RecordTable minWidth={860}>
              <HeadRow>
                <Th width="10%">Serial No.</Th>
                <Th width="15%">Merge Date</Th>
                <Th width="25%">Main Client</Th>
                <Th width="25%">Merged Client</Th>
                <Th width="25%">Resulting Client Name</Th>
              </HeadRow>
              <tbody>
                {absorbed.map((record, index) => (
                  <Row key={record.id}>
                    <Td className="font-medium text-primary">{index + 1}</Td>
                    <Td className="whitespace-nowrap">
                      {shortDate(record.mergedOn)}
                    </Td>
                    <Td>{client.clientName}</Td>
                    <Td>{record.clientName}</Td>
                    <Td>
                      <span className="block font-semibold text-primary">
                        {record.mergeResultName || client.clientName}
                      </span>
                      <span className="block text-muted-foreground" dir="rtl">
                        {record.mergeResultArabic || client.arabicName}
                      </span>
                    </Td>
                  </Row>
                ))}
              </tbody>
            </RecordTable>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm merge</DialogTitle>
            <DialogDescription>
              Everything below moves to {client.clientName}. The client being
              merged is kept, not deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span>{other?.clientName}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{client.clientName}</span>
            </p>

            <ul className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              {MERGE_TRANSFER_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            {/* The name the two will read as from the merge date on. */}
            <p className="rounded-md border bg-muted/40 p-3 font-medium text-foreground">
              {resulting.english} — {other?.clientName} Previously
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMerge}>Confirm merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
