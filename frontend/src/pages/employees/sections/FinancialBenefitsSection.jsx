import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/panels";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
} from "@/components/shared/RecordTable";
import FormHeading from "@/components/shared/FormHeading";
import RequestTable from "@/components/shared/RequestTable";
import RequestOverview from "@/components/shared/RequestOverview";
import TabBar from "@/components/shared/TabBar";
import { Plus, Eye, EyeOff, Coins } from "lucide-react";
import { withRial } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REQUEST_STATUS_CHIP } from "../requestFlow";
import { formatDate } from "@/pages/firm/firmData";
import {
  commissionRecords,
  commissionsFor,
  feesFor,
  commissionOn,
  nextCommissionNo,
} from "@/pages/firm/commissionData";
import CommissionForm from "@/pages/firm/sections/CommissionForm";
import { useClients } from "@/lib/clients/context";
import { commissionsApi } from "@/lib/api/modules/commissions";
import { attempt } from "@/lib/api/notice";
import { employeeRecords } from "../employeeData";

import SalariesSection from "./SalariesSection";
import BonusSection from "./BonusSection";
import LoansSection from "./LoansSection";
import AssistanceSection from "./AssistanceSection";
import { BENEFIT_TABS } from "./benefitTabs";

/** A commission that has been paid is settled; anything else is a request. */
const COMMISSION_PAID = "Paid";

/** Agreed by management and waiting on the payment. */
const COMMISSION_APPROVED = "Approved";

const COMMISSION_STATUS_CHIP = {
  ...REQUEST_STATUS_CHIP,
  [COMMISSION_APPROVED]: "bg-blue-100 text-blue-800",
  [COMMISSION_PAID]: "bg-green-100 text-green-800",
};

/** The day the commission was recorded, however far back it goes. */
const commissionDate = (record) =>
  record.date || record.periodFrom
    ? formatDate(record.date || record.periodFrom)
    : "-";

const money = (amount) =>
  withRial(
    Number(amount || 0).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );

/**
 * The commission agreed with this employee, read from the firm's records.
 *
 * The same form the firm's own commission page uses opens above the list -
 * with one difference: the person it is paid to is this employee, so the two
 * questions about who it is for are answered before it opens.
 */
function CommissionTab({ employee, adding, onCloseAdd, onOpenAdd, canDecide = true }) {
  const { clients } = useClients();
  const [records, setRecords] = useState(() => commissionsFor(employee.name));
  // The commission on the list the form is open on, if any.
  const [openId, setOpenId] = useState(null);
  const open = records.find((record) => record.id === openId) || null;

  // The client chosen on the open form, if any. While a commission is being
  // written for a client, the list shows only what is already agreed with that
  // client - which is what the new one has to be judged against.
  const [clientFilter, setClientFilter] = useState("");
  // What this employee has been paid before, open over the request.
  const [showHistory, setShowHistory] = useState(false);

  const filtering = adding && Boolean(clientFilter);
  const clientName =
    clients.find((client) => client.clientNo === clientFilter)?.clientName ||
    "";
  const shown = filtering
    ? records.filter((record) => record.clientNo === clientFilter)
    : records;
  // What the table shows: the number it goes by, and where it stands.
  const asRow = (record) => ({
    ...record,
    no: record.commissionNo || record.requestNo,
    status: record.status || COMMISSION_PAID,
    dateText: commissionDate(record),
  });
  const rows = shown.map(asRow);

  /** Closing the form, by either button, puts the whole list back. */
  const close = () => {
    setClientFilter("");
    setOpenId(null);
    onCloseAdd();
  };

  // While a call to the server is out, a second click sends nothing.
  const [busy, setBusy] = useState(false);
  /**
   * Sends one or more calls in turn. Each saved commission is already back in
   * the firm's list (commissionRecords), so this list is read again from it;
   * a refusal is shown as a notice and stops the rest.
   */
  const send = async (...calls) => {
    if (busy) return null;
    setBusy(true);
    try {
      let saved = null;
      for (const call of calls) {
        saved = await attempt(call);
        if (!saved) break;
      }
      setRecords(commissionsFor(employee.name));
      return saved;
    } finally {
      setBusy(false);
    }
  };

  /** Whose commission it is, by the id the API files it under. */
  const payeeId = (record) =>
    employeeRecords.find((person) => person.name === record.paidTo)?.id ?? employee.id;

  /**
   * What was agreed, on the list straight away under the number the server
   * gave it, and waiting on the decision and payment that settle it.
   */
  const submit = async (record) => {
    const saved = await send(() =>
      openId
        ? commissionsApi.update(openId, record, payeeId(record))
        : commissionsApi.submit(
            { ...record, amount: Number(commissionOn(record).toFixed(3)) },
            payeeId(record)
          )
    );
    if (saved) setOpenId(saved.id);
    return saved;
  };

  /**
   * Approved and paid: management's answer, then the payment. One already
   * approved is only paid.
   */
  const save = async (record) => {
    if (!canDecide || !open) return;
    const pay = () =>
      commissionsApi.pay(open.id, {
        method: record.method,
        paymentDate: record.paymentDate,
        bankAccount: [record.bank, String(record.payingAccountNo || "").slice(-4)]
          .filter(Boolean)
          .join(" "),
        reference: record.reference,
        financeComment: record.paymentNotes,
      });
    const saved =
      open.status === COMMISSION_APPROVED
        ? await send(pay)
        : await send(
            () =>
              commissionsApi.decide(open.id, {
                decision: record.decision,
                approvedAmount: record.approvedAmount,
                comment: record.paymentNotes,
              }),
            pay
          );
    if (saved) close();
  };

  /** Refused: the commission keeps its number and says why. */
  const reject = async (why) => {
    if (!canDecide || !open) return;
    const saved = await send(() =>
      commissionsApi.decide(open.id, { decision: "Rejection", comment: why })
    );
    if (saved) close();
  };

  /** A commission opened back off the list, to be followed or decided. */
  const track = (record) => {
    setOpenId(record.id);
    onOpenAdd?.();
  };

  // The list's columns, on the page and in the History window alike.
  const columns = [
    {
      // A commission waiting on payment carries its temporary
      // number and opens back into the form.
      key: "no",
      header: "Commission No.",
      width: "13%",
      render: (value, record) =>
        record.status === COMMISSION_PAID ? (
          <span className="font-medium text-primary">{value}</span>
        ) : (
          <button
            type="button"
            onClick={() => track(record)}
            className="rounded font-bold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {value}
          </button>
        ),
    },
    {
      key: "dateText",
      header: "Commission Date",
      width: "12%",
      render: (value) => <span className="whitespace-nowrap text-primary">{value}</span>,
    },
    { key: "clientName", header: "Client Name", width: "15%" },
    { key: "paidTo", header: "Payee", width: "14%" },
    {
      // What it was worked out from, then what it came to.
      key: "rate",
      header: "Legal Fees & Commission",
      width: "20%",
      render: (value, record) => (
        <>
          <span className="block">
            <span className="text-muted-foreground">Before VAT: </span>
            {money(feesFor(record))}
          </span>
          <span className="block">
            <span className="text-muted-foreground">Commission: </span>
            {value}%
          </span>
          <span className="block font-bold text-green-700">
            <span className="font-normal text-muted-foreground">Paid Commission: </span>
            {money(commissionOn(record))}
          </span>
        </>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      width: "14%",
      render: (value) => <span className="text-muted-foreground">{value || "-"}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      render: (value) => (
        <span
          className={cn(
            "block w-fit rounded-md px-2.5 py-0.5 text-xs font-semibold",
            COMMISSION_STATUS_CHIP[value]
          )}
        >
          {value}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Opened over the page, so the list it is filed into stays behind. */}
      <Dialog open={Boolean(adding)} onOpenChange={(o) => !o && close()}>
        <DialogContent hideClose className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
          <CommissionForm
            onHistory={() => setShowHistory(true)}
            canAnswer={canDecide}
            key={openId || "new"}
            employee={employee}
            // The kind of client is not kept on the commission; it is the
            // client's own, read back off the directory.
            initial={
              open && {
                ...open,
                clientType:
                  clients.find((client) => client.clientNo === open.clientNo)?.type || "",
              }
            }
            commissionNo={
              open?.commissionNo ||
              nextCommissionNo(commissionRecords.concat(records))
            }
            onCancel={close}
            onSubmit={submit}
            onSave={save}
            onReject={reject}
            onClientChange={setClientFilter}
          />
          {/* Every commission this employee has, over the request. */}
          <Dialog open={showHistory} onOpenChange={setShowHistory}>
            <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Commission History · {employee.name}</DialogTitle>
                <DialogDescription>Every commission recorded for this employee.</DialogDescription>
              </DialogHeader>
              <RequestTable
                rows={records.map(asRow)}
                columns={columns}
                searchPlaceholder="Search by commission no., client or payee..."
                itemLabel="commissions"
                exportFileName="commissions.csv"
              />
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      {filtering && (
        <p className="text-sm text-muted-foreground">
          Showing commissions for{" "}
          <span className="font-semibold text-primary">{clientName}</span>{" "}
          only
        </p>
      )}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {/* What has been earned, a reading of it, and the way to record
              another - over the list itself. The amount is worked out from
              the fees, never typed, so nothing is offered to apply. */}
          <RequestOverview
            icon={Coins}
            title="Commission"
            subtitle="Record commission and track its payment."
            noun="commission request"
            newLabel="New Commission Request"
            onNew={!adding ? onOpenAdd : null}
            money
            typeLabel="Commission Type"
            rows={records.map((record) => ({
              id: record.id,
              no: record.commissionNo || record.requestNo,
              date: record.date || record.periodFrom,
              amount: commissionOn(record),
              status: record.status || COMMISSION_PAID,
              type: record.type,
              record,
            }))}
            onOpen={adding ? null : track}
            renderAll={() => (
              <RequestTable
                rows={records.map(asRow)}
                columns={columns}
                searchPlaceholder="Search by commission no., client or payee..."
                itemLabel="commissions"
                exportFileName="commissions.csv"
              />
            )}
          />
          <RequestTable
            rows={rows}
            columns={columns}
            searchPlaceholder="Search by commission no., client or payee..."
            itemLabel="commissions"
            exportFileName="commissions.csv"
            filterBy={[
              { key: "status", label: "Status" },
              { key: "clientName", label: "Client" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Everything the firm pays one employee, on one page.
 *
 * Salary, loans, assistance and commission were four entries in the menu, all
 * answering the same question - what this person is owed and why. They are one
 * page with four tabs instead. The tabs themselves sit in the corner of the
 * section's heading, which is where the choice of tab belongs; this page shows
 * whichever one is open. Each tab's Add button opens its form at the top of
 * that tab rather than at the top of the page: the form belongs to the records
 * underneath it, not to the whole employee.
 */
export default function FinancialBenefitsSection({
  employee,
  onSaveSalary,
  tab,
  onTabChange,
  // The firm sets what it pays; on My Profile the figures are only read.
  canEdit = true,
  // Opened from Requests: the request's own list and nothing else - no tabs,
  // since the cards above choose, and no salary breakdown.
  listOnly = false,
}) {
  // Which tab's form is open, if any.
  const [adding, setAdding] = useState(null);

  // Moving to another tab closes what was open on the last one. A form left
  // open would still be open on the way back, over records it was never
  // started from.
  const [openTab, setOpenTab] = useState(tab);
  if (openTab !== tab) {
    setOpenTab(tab);
    setAdding(null);
  }

  // The salary breakdown is what the Salaries tab is: opening the tab shows
  // what the employee is paid, with the history of payments under it.

  // My Profile shows what the employee is paid. What the office keeps its own
  // record of - the bonuses it decided on - is not shown there at all, so the
  // tab itself goes, and with it any chance of landing on a tab that is gone.
  const tabs = canEdit
    ? BENEFIT_TABS
    : BENEFIT_TABS.filter((option) => !option.office);

  const current = tabs.find((option) => option.key === tab) || tabs[0];
  const open = current.key;

  // Salary and commission are what the firm decides to pay; a loan and
  // assistance are what the employee asks for. So on My Profile the first two
  // are only read, and the other two can still be asked for.
  //
  // Salary has a second button that belongs to the other page: the employee
  // cannot record their own pay, but they can ask for part of it in advance,
  // and the firm never asks for that on their behalf.
  const firmDecides = open === "salaries" || open === "commission";
  const addLabel = canEdit
    ? current.add
    : current.selfAdd || (firmDecides ? "" : current.add);
  const showsAdd = Boolean(addLabel);

  // One heading at a time: a form that opens with its own heading - and its
  // own way back - takes this row's place instead of sitting under it.
  // Commission's form has no heading of its own, and neither have the stepped
  // salary and loan forms, which open under the tabs; so those rows stay.
  const inlineForm =
    open === "commission" ||
    open === "loans" ||
    open === "assistance" ||
    open === "bonus" ||
    (open === "salaries" && canEdit);
  const formHasHeading = adding === open && !inlineForm;

  return (
    <div className="space-y-6">
      {/* One row for the whole section: the open tab's name on the left, and
          on the right the tabs and the buttons that act on what is open. A
          heading above the tabs would only name the tab that is already
          highlighted. */}
      {!formHasHeading && !listOnly && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormHeading title={current.label} note={current.note} icon={current.icon} />

        {/* ms-auto keeps the tabs at the logical end even when they wrap onto a
            line of their own: a wrapped line is laid out on its own, so
            justify-between above would otherwise drop them back to the left. */}
        {/* No Add up here: every list carries it on the row above its own
            table, opposite the search. */}
        <div className="ms-auto">
          <TabBar options={tabs} value={open} onChange={onTabChange} />
        </div>
      </div>
      )}

      {open === "salaries" && (
        <SalariesSection
          employee={employee}
          adding={adding === "salaries"}
          onCloseAdd={() => setAdding(null)}
          onOpenAdd={() => setAdding("salaries")}
          onSave={onSaveSalary}
          addLabel={showsAdd ? addLabel : ""}
          canEdit={canEdit}
          advance={!canEdit}
          advanceOnly={listOnly}
        />
      )}

      {open === "bonus" && (
        <BonusSection
          employee={employee}
          adding={adding === "bonus"}
          onCloseAdd={() => setAdding(null)}
          onOpenAdd={() => setAdding("bonus")}
          addLabel={showsAdd ? addLabel : ""}
          canDecide={canEdit}
        />
      )}

      {open === "loans" && (
        <LoansSection
          employee={employee}
          adding={adding === "loans"}
          onCloseAdd={() => setAdding(null)}
          onOpenAdd={() => setAdding("loans")}
          addLabel={showsAdd ? addLabel : ""}
          canDecide={canEdit}
        />
      )}

      {open === "assistance" && (
        <AssistanceSection
          employee={employee}
          adding={adding === "assistance"}
          onCloseAdd={() => setAdding(null)}
          onOpenAdd={() => setAdding("assistance")}
          addLabel={showsAdd ? addLabel : ""}
          canDecide={canEdit}
        />
      )}

      {open === "commission" && (
        <CommissionTab
          employee={employee}
          adding={adding === "commission"}
          onCloseAdd={() => setAdding(null)}
          onOpenAdd={() => setAdding("commission")}
          canDecide={canEdit}
        />
      )}
    </div>
  );
}