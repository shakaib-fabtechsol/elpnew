import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Coins, FileCheck } from "lucide-react";
import UploadIcon from "@/components/shared/UploadIcon";
import SearchableSelect from "@/components/shared/SearchableSelect";
import {
  FieldLabel,
  Group,
  Row,
  Field,
  Locked,
  Note,
  Counted,
  Decision,
  useRequiredFields,
  checkRequired,
} from "@/components/shared/formFields";
import { AdvanceSteps } from "@/pages/employees/sections/AdvanceSalarySection";
import { SheetHead, SheetCard, HistoryCard } from "@/components/shared/RequestSheet";
import { REQUEST_REJECTED } from "@/pages/employees/requestFlow";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/pages/expenses/expenseData";
import { useClients } from "@/lib/clients/context";
import { useFirm } from "@/lib/firm/context";
import { employeeRecords } from "@/pages/employees/employeeData";
import { formatDate } from "@/pages/firm/firmData";
import {
  DEFAULT_COMMISSION_BOOKING,
  INVOICE_LINKED_COMMISSION,
  subcategoriesOf,
  legalFeesCollected,
  legalFeesInvoicesFor,
  legalFeesOnInvoice,
  invoiceFor,
  isFullyPaid,
} from "../commissionData";

import DateField from "@/components/shared/DateField";
const OTHER_STAFF = "Other Staff";

/**
 * The groups a beneficiary can belong to, and the job that puts them in one.
 *
 * Commission is not a partners' matter: anyone in the office who brings in a
 * client or a case can be owed a share of the fees, so the last group catches
 * whoever the named ones do not - nobody who can earn commission is left out.
 *
 * `role` is the field on the employee record the group is read from. Nobody is
 * asked which group a person is in; it is what their job already says.
 */
export const CLASSIFICATIONS = [
  { key: "Partners", role: "Partner" },
  { key: "Consultants", role: "Advisor" },
  { key: "Lawyers", role: "Lawyer" },
  { key: "Administrators", role: "Administrative" },
  { key: "Accountants", role: "Accountant" },
  { key: OTHER_STAFF, role: null },
];

/** The group a person's job puts them in. */
const classificationOf = (role) =>
  CLASSIFICATIONS.find((group) => group.role === role)?.key || OTHER_STAFF;

/**
 * Everyone who can be paid a commission, each under the group their job puts
 * them in.
 *
 * One question rather than two. The group used to be asked for first, to cut
 * the whole office down to a handful of names - but a list you can type into
 * does that better, and the group is a fact about the person's job rather than
 * a decision, so it is read off whoever is chosen instead of asked for and
 * then having to agree.
 */
const beneficiaryOptionsOf = (people) => people.map((person) => ({
  value: person.name,
  label: person.name + " \u2014 " + classificationOf(person.role),
}));

const emptyDraft = {
  ...DEFAULT_COMMISSION_BOOKING,
  clientType: "",
  clientNo: "",
  caseFileNo: "",
  invoiceNo: "",
  periodFrom: "",
  periodTo: "",
  classification: "",
  paidTo: "",
  rate: "",
  notes: "",
};

/**
 * What the office decides, and how the commission then reached the person.
 *
 * `decision` is the answer to the request rather than a step in paying it:
 * approved in full, approved for less, or refused. Only a partial approval
 * carries an amount of its own - the other two are worth what was asked for,
 * or nothing.
 */
const emptyPayment = {
  decision: "",
  approvedAmount: "",
  method: "",
  bankAccountId: "",
  paymentDate: "",
  reference: "",
  notes: "",
};

/** Today, as a record writes it. */
const today = () => new Date().toISOString().slice(0, 10);

/** The three answers the office can give a commission request. */
const APPROVED_IN_FULL = "Full Approval";
const APPROVED_IN_PART = "Partial Approval";
const REFUSED = "Rejection";

/**
 * What may be typed into a percentage.
 *
 * Digits and at most one point, and never above a hundred: a commission worth
 * more than the whole fee it is a share of is not a rate, it is a slip - and
 * the figure it produces would be wrong by thousands without ever looking
 * wrong on the way in.
 */
function asRate(text) {
  const [whole, ...rest] = text.replace(/[^\d.]/g, "").split(".");
  const single = rest.length ? whole + "." + rest.join("") : whole;
  return Number(single) > 100 ? "100" : single;
}

/** Three decimals, the way Rials are written here. */
const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

/**
 * The office's answer to a commission request, and how it was then paid.
 *
 * Everything the request said is read back first and none of it can be
 * changed here: this screen decides a request, it does not rewrite one. The
 * figure is not asked for again either - it is what the first stage worked
 * out, and a typed one could disagree with the fees it came from. The single
 * exception is a partial approval, which exists precisely to pay a different
 * amount, and so is the only answer that opens that field.
 */
function CommissionPayment({
  commissionNo,
  requestDate,
  payee,
  commissionType,
  clientName,
  invoiceNo,
  invoiceStatus,
  period,
  fees,
  rate,
  amount,
  employeeComment,
  expenseType,
  category,
  firmAccounts,
  beneficiaryBank,
  beneficiaryAccountNo,
  canAnswer = true,
  payment,
  onChange,
  receipt,
  onReceipt,
  decided,
}) {
  const partial = payment.decision === APPROVED_IN_PART;
  const refusing = payment.decision === REFUSED;

  return (
    <div className="space-y-6">
      <Group title="Request Information">
        <div className="form-grid">
          <Locked id="payRequestNo" label="Request No." value={commissionNo} />
          <Locked
            id="payRequestDate"
            label="Request Date"
            value={formatDate(requestDate)}
          />
          <Locked id="payPayee" label="Employee Name" value={payee} />
          <Locked
            id="payType"
            label="Commission Type"
            value={commissionType}
          />
        </div>
      </Group>

      {/* What was asked for, in the terms it was worked out in. The rate and
          the fees are beside the amount so the figure can be checked rather
          than taken on trust. */}
      <Group title="Commission Details">
        <div className="form-grid">
          <Locked id="payClient" label="Client Name" value={clientName} />
          <Locked
            id="payInvoice"
            label={invoiceNo ? "Invoice No. & Status" : "Period"}
            value={
              invoiceNo ? invoiceNo + "  \u00b7  " + invoiceStatus : period
            }
          />
          <Locked
            id="payFees"
            label="Eligible Legal Fees & Commission Rate"
            value={fees + " OMR  |  " + (rate || 0) + "%"}
          />
          <Locked
            id="payRequested"
            label="Requested Commission Amount (OMR)"
            value={amount}
          />
        </div>
      </Group>

      {employeeComment && (
        <Group title="Employee Comment">
          <p className="rounded-md bg-locked px-3 py-2 text-sm text-muted-foreground">
            {employeeComment}
          </p>
        </Group>
      )}

      <Group title="Management Decision">
        <div
          role="radiogroup"
          aria-label="Management decision"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <Decision
            value={APPROVED_IN_FULL}
            chosen={payment.decision}
            onChoose={(v) => onChange("decision", v)}
            disabled={!canAnswer}
          />
          <Decision
            value={APPROVED_IN_PART}
            chosen={payment.decision}
            onChoose={(v) => onChange("decision", v)}
            disabled={!canAnswer}
          />
          <Decision
            value={REFUSED}
            chosen={payment.decision}
            onChoose={(v) => onChange("decision", v)}
            disabled={!canAnswer}
            tone="bad"
          />
        </div>
      </Group>

      {/* Nothing about paying a commission that is being refused: there is no
          payment to describe, only a reason to give. */}
      {!refusing && (
        <Group title="Expense & Disbursement Details">
          {/* Where it lands in the books. Not a choice - every commission is
              booked the same way - but shown, so the record says what it will
              be charged to. */}
          <Row cols={4}>
            <Locked id="payExpenseType" label="Expense Type" value={expenseType} />
            <Locked id="payCategory" label="Category" value={category} />
            <Locked
              id="paySubcategory"
              label="Subcategory"
              value={commissionType}
            />

            <Field id="payMethod" label="Payment Method" required>
              <Select
                value={payment.method}
                onValueChange={(value) => value && onChange("method", value)}
              >
                <SelectTrigger id="payMethod">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Row>

          <Row cols={4}>
            {/* Which of the firm's own accounts the money leaves. Only the
                last four digits are shown: enough to tell two accounts apart,
                and no more of a live account number on screen than that. */}
            <Field id="payBank" label="Bank Account" required>
              <Select
                value={payment.bankAccountId}
                onValueChange={(value) => value && onChange("bankAccountId", value)}
              >
                <SelectTrigger id="payBank">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {firmAccounts.map((account) => (
                    <SelectItem key={account.value} value={account.value}>
                      {account.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* The day the money moves, which is the day this is decided -
                read off the clock rather than typed, so it cannot be told to
                have happened on some other day. */}
            <Locked
              id="payDate"
              label="Payment Date"
              value={formatDate(payment.paymentDate)}
            />

            {/* What the bank called the transfer, and the proof of it. */}
            <Field id="payReference" label="Transfer No.">
              <div className="flex w-full min-w-0 items-center gap-2">
                <Input
                  id="payReference"
                  className="min-w-0 flex-1"
                  value={payment.reference}
                  onChange={(e) => onChange("reference", e.target.value)}
                  placeholder="TRX-0000-00000"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  asChild
                  title={
                    receipt ? receipt.name + " attached" : "Attach transfer receipt"
                  }
                  className={cn(
                    "shrink-0",
                    receipt && "border-green-600 text-green-600"
                  )}
                >
                  <label htmlFor="payReceipt" className="cursor-pointer">
                    {receipt ? (
                      <FileCheck className="h-4 w-4" />
                    ) : (
                      <UploadIcon className="h-4 w-4" />
                    )}
                    <span className="sr-only">Attach transfer receipt</span>
                  </label>
                </Button>
                <Input
                  id="payReceipt"
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && onReceipt(e.target.files[0])}
                />
              </div>
            </Field>

            {/* Approved in full, this is what was asked for and is only read
                back. Approved in part, it is the whole point of the answer and
                is the one figure this screen may set. */}
            {partial ? (
              <Field
                id="payApproved"
                label="Approved Commission Amount (OMR)"
                required
                note={"No more than the " + amount + " OMR requested."}
              >
                <Input
                  id="payApproved"
                  inputMode="decimal"
                  value={payment.approvedAmount}
                  onChange={(e) =>
                    onChange(
                      "approvedAmount",
                      e.target.value.replace(/[^\d.]/g, "")
                    )
                  }
                  placeholder="0.000"
                />
              </Field>
            ) : (
              <Locked
                id="payApproved"
                label="Approved Commission Amount (OMR)"
                value={amount}
                highlight
              />
            )}
          </Row>
        </Group>
      )}

      <Group title={refusing ? "Reason for Rejection" : "Management Comment"}>
        <Counted
          id="payManagementComment"
          rows={3}
          limit={300}
          value={payment.notes}
          onChange={(value) => onChange("notes", value)}
          placeholder={
            refusing
              ? "Say why this commission is refused"
              : "Add management comment (optional)"
          }
        />
      </Group>

      {/* Who is being paid what, and into which account - the four facts the
          transfer is actually made from, gathered where they can be checked
          in one look before the money moves. */}
      {decided && !refusing && (
        <div className="form-grid rounded-md border border-green-600/40 bg-green-50 px-4 py-3">
          {[
            ["Employee Name", payee],
            ["Bank Name", beneficiaryBank || "-"],
            ["Employee Account Number", beneficiaryAccountNo || "-"],
            ["Transfer Amount", (partial ? payment.approvedAmount : amount) + " OMR"],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-green-800/70">{label}</p>
              <p className="font-semibold text-green-900">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The arrangement being agreed: who, on whose fees, at what rate, over what
 * period.
 *
 * One form for every place it is asked for. Anyone in the office can be named
 * as the beneficiary - not only partners - because commission is earned by
 * whoever brought in the client or the case. On an employee's record that
 * employee is simply the starting choice.
 *
 * The commission amount is on the form but is never typed: it is the legal fees
 * before VAT the client has paid in full - on the chosen invoice, or within the
 * period - times the percentage. A figure that could be typed could be typed
 * wrong.
 */
export default function CommissionForm({
  employee,
  onCancel,
  onSave,
  // A commission already on the list, opened back into the form to be
  // followed, corrected or decided.
  initial = null,
  // What the first stage does: the commission goes on the list straight away,
  // waiting on the payment that settles it.
  onSubmit,
  onReject,
  // The number this commission will carry, handed down by whoever keeps the
  // list, so the form can show it before it is saved.
  commissionNo = "",
  // Told which client is chosen, so the list under the form can narrow to
  // that client's commissions while one for them is being written.
  onClientChange,
  // `canDecide` below means there is enough on the form to decide on. This
  // is the other question: whether the person looking may decide at all. The
  // firm settles a commission, so on the payee's own page the decision is
  // read once it has been given, and never written.
  canAnswer = true,
  // Opens what this employee has been paid in commission before.
  onHistory,
}) {
  const { clients } = useClients();
  const { bankAccounts } = useFirm();

  /**
   * The firm's own accounts the money can leave from. Closed ones are not
   * offered: an account nobody can pay out of is not a choice.
   */
  const firmAccounts = bankAccounts
    .filter((account) => account.active)
    .map((account) => ({
      value: String(account.id),
      label:
        account.bankName +
        " \u2014 \u2022\u2022\u2022\u2022 " +
        String(account.accountNumber).replace(/\s/g, "").slice(-4),
    }));

  // The day the request was made: the day it was first written, or today for
  // one being written now. Not asked for - a date somebody can type is a date
  // that can disagree with when the record was actually created.
  const requestDate = initial?.date || new Date().toISOString().slice(0, 10);

  // Which half of the commission is open: what it comes to, and then how it
  // was paid.
  const [stage, setStage] = useState(initial ? "payment" : "commission");
  const [payment, setPayment] = useState(() =>
    initial
      ? {
          ...emptyPayment,
          method: initial.method || "",
          bankAccountId: initial.bankAccountId || "",
          paymentDate: initial.paymentDate || today(),
          reference: initial.reference || "",
          decision: initial.decision || "",
          approvedAmount:
            initial.approvedAmount === undefined
              ? ""
              : String(initial.approvedAmount),
          notes: initial.paymentNotes || initial.rejectionReason || "",
        }
      : { ...emptyPayment, paymentDate: today() }
  );
  const [receipt, setReceipt] = useState(null);
  const refused = initial?.status === REQUEST_REJECTED;
  const setPay = (name, value) =>
    setPayment((prev) => ({ ...prev, [name]: value }));

  // Opened from an employee's record, that employee is filled in to start
  // with - but only to start with. Commission can go to any member of the
  // office who brought in the client or the case, so both questions about who
  // it is for stay open to change.
  const [draft, setDraft] = useState(() =>
    initial
      ? {
          ...emptyDraft,
          ...initial,
          subcategory: initial.type || initial.subcategory || "",
          rate: String(initial.rate ?? ""),
        }
      : {
          ...emptyDraft,
          classification: employee ? classificationOf(employee.role) : "",
          paidTo: employee ? employee.name : "",
        }
  );

  const setField = (name, value) =>
    setDraft((prev) => ({ ...prev, [name]: value }));

  /** The person, and with them the group their job puts them in. */
  const choosePaidTo = (name) => {
    const person = employeeRecords.find((e) => e.name === name);
    setDraft((prev) => ({
      ...prev,
      paidTo: name,
      classification: person ? classificationOf(person.role) : "",
    }));
  };

  /** Changing the kind of client empties the client, for the same reason. */
  const chooseClientType = (value) => {
    if (!value) return;
    setDraft((prev) => ({
      ...prev,
      clientType: value,
      clientNo: "",
      invoiceNo: "",
    }));
    onClientChange?.("");
  };

  /**
   * The client, passed on to whoever shows the list.
   *
   * An empty value is ignored: inside the employee's form Radix keeps a hidden
   * native select that reports "" when its list is rebuilt, which would clear
   * the choice - and the filter with it - on its own.
   */
  const chooseClient = (value) => {
    if (!value) return;
    // Invoices belong to a client, so one chosen for the last client goes.
    setDraft((prev) => ({ ...prev, clientNo: value, invoiceNo: "" }));
    onClientChange?.(value);
  };

  // The kinds of client the firm actually has, read off the directory rather
  // than listed here - a kind nobody is would only ever be an empty choice.
  const clientTypes = [...new Set(clients.map((client) => client.type))]
    .filter(Boolean)
    .sort();

  const clientsOfType = clients.filter(
    (client) => client.type === draft.clientType
  );

  // An invoice-linked commission is calculated from one paid invoice; a fixed
  // one stands over a period. They are alternatives, so the form asks for one
  // or the other and never for both.
  const isInvoiceLinked = draft.subcategory === INVOICE_LINKED_COMMISSION;

  const chooseInvoice = (value) => {
    if (!value) return;
    setField("invoiceNo", value);
  };

  // What an invoice-linked commission can be calculated from: every legal-fees
  // invoice this client was sent. The case file is not asked for first - the
  // invoice already knows which file it belongs to.
  const clientInvoices = legalFeesInvoicesFor(draft.clientNo);

  // The invoice itself, so the form can read back when it was raised, whether
  // it was paid and when, rather than asking for any of it again.
  const invoice = invoiceFor(draft.clientNo, draft.invoiceNo);

  // What the arrangement is worth so far: the legal fees before VAT it runs
  // on, times the rate - one invoice for an invoice-linked commission,
  // everything paid in the period for a fixed one. Both sides come from
  // elsewhere, so it moves on its own as the invoice or the period and the
  // percentage are set.
  const fees = isInvoiceLinked
    ? legalFeesOnInvoice(draft.clientNo, draft.invoiceNo)
    : legalFeesCollected(draft.clientNo, draft.periodFrom, draft.periodTo);
  const commission = (fees * Number(draft.rate || 0)) / 100;

  const asked = useRequiredFields({
    commissionSubcategory: draft.subcategory,
    commissionClientType: draft.clientType,
    commissionClient: draft.clientNo,
    ...(isInvoiceLinked
      ? { commissionInvoice: draft.invoiceNo }
      : { periodFrom: draft.periodFrom, periodTo: draft.periodTo }),
    paidTo: draft.paidTo,
    commissionRate: Number(draft.rate) > 0 ? draft.rate : "",
  });

  const canSave =
    draft.expenseType &&
    draft.category &&
    draft.subcategory &&
    draft.clientType &&
    draft.clientNo &&
    (isInvoiceLinked
      ? draft.invoiceNo
      : draft.periodFrom && draft.periodTo) &&
    draft.classification &&
    draft.paidTo &&
    Number(draft.rate) > 0;

  /** What was agreed, as the record keeps it. */
  const agreed = () => {
    const client = clients.find((c) => c.clientNo === draft.clientNo);
    return {
      ...draft,
      // The subcategory is what kind of commission this is, so the record
      // keeps it under the name the rest of the system reads it by.
      type: draft.subcategory,
      // Only one of the two was asked for, so only one is kept. The case file
      // is not among the questions: it is read off the invoice the commission
      // was calculated from, so the two can never disagree.
      caseFileNo: isInvoiceLinked ? invoice?.caseFileNo || "" : "",
      invoiceNo: isInvoiceLinked ? draft.invoiceNo : "",
      periodFrom: isInvoiceLinked ? "" : draft.periodFrom,
      periodTo: isInvoiceLinked ? "" : draft.periodTo,
      clientName: client?.clientName || "",
      rate: Number(draft.rate),
    };
  };

  /**
   * The commission agreed. It goes on the list straight away, waiting on the
   * payment that settles it, and the form moves on to that payment.
   */
  const saveAndContinue = async () => {
    if (!asked.check()) return;
    // A refusal from the server leaves the request open to be put right.
    if ((await onSubmit?.(agreed())) === null) return;
    setStage("payment");
  };

  const refusing = payment.decision === REFUSED;
  const partial = payment.decision === APPROVED_IN_PART;

  /**
   * Where the commission lands. Held on the person's own record, so it is read
   * from there rather than asked for again on every request they make - an
   * account number typed a second time is an account number that can be typed
   * wrong.
   */
  const beneficiary = employeeRecords.find((e) => e.name === draft.paidTo);
  const payingAccount = bankAccounts.find(
    (account) => String(account.id) === payment.bankAccountId
  );

  /**
   * What a partial approval comes to. It has to be worth something and it
   * cannot be worth more than was asked for: an office that may pay less than
   * the request may not use the same answer to pay more than it.
   */
  const approved = Number(payment.approvedAmount || 0);
  const partialIsSound =
    approved > 0 && approved <= Number(commission.toFixed(3));

  /** Refusing needs only a reason; paying needs a way and a day. */
  const canDecide =
    canSave &&
    Boolean(payment.decision) &&
    (refusing
      ? Boolean((payment.notes || "").trim())
      : payment.method &&
        payment.bankAccountId &&
        (!partial || partialIsSound));

  const save = () => {
    if (!checkRequired() || !canDecide || !canAnswer) return;
    if (refusing) {
      onReject?.((payment.notes || "").trim());
      return;
    }
    onSave({
      ...agreed(),
      // The day it was agreed, which is what the list reads it by.
      date: new Date().toISOString().slice(0, 10),
      decision: payment.decision,
      // What is actually transferred. A full approval pays the figure the
      // calculation produced; only a partial one departs from it, and it is
      // written down rather than left to be inferred from the difference.
      approvedAmount: partial ? approved : Number(commission.toFixed(3)),
      method: payment.method,
      // Both ends of the transfer, as they stood on the day it was made.
      bankAccountId: payment.bankAccountId,
      bank: payingAccount?.bankName || "",
      payingAccountNo: payingAccount?.accountNumber || "",
      beneficiaryBank: beneficiary?.bankName || "",
      accountNo: beneficiary?.accountNumber || "",
      paymentDate: payment.paymentDate,
      reference: payment.reference.trim(),
      receipt: receipt?.name || "",
      paymentNotes: (payment.notes || "").trim(),
    });
  };

  return (
    <div className="space-y-6">
        <SheetHead
          icon={Coins}
          title="Commission Request"
          intro={
            stage === "payment"
              ? "Review the commission and record the management decision."
              : "Submit a new commission request with the calculation and eligibility details."
          }
          // On the payment step the head names whoever is paid - the
          // beneficiary chosen on the form - and their bank and account.
          employee={stage === "payment" ? beneficiary || employee : employee}
          date={requestDate}
          requestNo={commissionNo}
          paying={stage === "payment"}
        />

        {/* The two halves of a commission: what is being asked for, and then
            what the office answers. Either step opens its own half. */}
        <AdvanceSteps
          active={stage}
          onChange={setStage}
          steps={[
            {
              key: "commission",
              title: "Submit Request",
              note: "Enter commission calculation and eligibility details",
              done: Boolean(canSave),
            },
            {
              key: "payment",
              title: "Management Decision",
              note: "Review, approve and disburse",
              done: Boolean(canDecide),
              // Nothing can be decided until there is a figure to decide on.
              disabled: !canSave,
            },
          ]}
        />

        {/* No heading here: the step above says which half is open, and the
            window it sits in is already named after it. */}
        {stage === "payment" ? (
          <CommissionPayment
            canAnswer={canAnswer}
            commissionNo={commissionNo}
            requestDate={requestDate}
            payee={draft.paidTo}
            commissionType={draft.subcategory}
            clientName={
              clients.find((c) => c.clientNo === draft.clientNo)?.clientName || ""
            }
            invoiceNo={isInvoiceLinked ? draft.invoiceNo : ""}
            invoiceStatus={invoice?.status || ""}
            period={
              isInvoiceLinked
                ? ""
                : formatDate(draft.periodFrom) +
                  " \u2013 " +
                  formatDate(draft.periodTo)
            }
            fees={money(fees)}
            rate={draft.rate}
            amount={money(commission)}
            employeeComment={draft.notes}
            expenseType={draft.expenseType}
            category={draft.category}
            firmAccounts={firmAccounts}
            beneficiaryBank={beneficiary?.bankName || ""}
            beneficiaryAccountNo={beneficiary?.accountNumber || ""}
            payment={payment}
            onChange={setPay}
            receipt={receipt}
            onReceipt={setReceipt}
            decided={canDecide}
          />
        ) : (
        <>
        {/* What is being asked for, before anything about the money. */}
        <SheetCard title="Commission Request Details">
          <Row cols={2}>

            {/* Opened from an employee's record, that employee is filled in to
                start with - but only to start with. Commission is earned by
                whoever brought in the client or the case, which can be anyone
                in the office, so the name stays open to change. */}
            <Field
              id="paidTo"
              label="Employee Name"
              required
              error={asked.errorFor("paidTo")}
            >
              <SearchableSelect
                id="paidTo"
                value={draft.paidTo}
                onValueChange={choosePaidTo}
                options={beneficiaryOptionsOf(employeeRecords)}
                placeholder="Select Employee"
                searchPlaceholder="Search employees..."
              />
            </Field>

            {/* Which of the two kinds this is. It decides every question
                below it, so nothing is shown until it has been answered. */}
            <Field
              id="commissionSubcategory"
              label="Commission Type"
              required
              error={asked.errorFor("commissionSubcategory")}
            >
              <Select
                value={draft.subcategory}
                onValueChange={(value) => setField("subcategory", value)}
              >
                <SelectTrigger id="commissionSubcategory">
                  <SelectValue placeholder="Please Select" />
                </SelectTrigger>
                <SelectContent>
                  {subcategoriesOf(draft.expenseType, draft.category).map(
                    (sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </Field>
          </Row>
        </SheetCard>

        {draft.subcategory && (
        <>
        <SheetCard
          title={
            isInvoiceLinked
              ? "Invoice-Linked Commission Details"
              : "Fixed Commission Details"
          }
        >
          {/* Whose fees the commission runs on. */}
          <Row cols={3}>
            <Field error={asked.errorFor("commissionClientType")} id="commissionClientType" label="Client Type" required>
              <Select value={draft.clientType} onValueChange={chooseClientType}>
                <SelectTrigger id="commissionClientType">
                  <SelectValue placeholder="Select Client Type" />
                </SelectTrigger>
                <SelectContent>
                  {clientTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field error={asked.errorFor("commissionClient")} id="commissionClient" label="Client Name" required>
              <Select
                value={draft.clientNo}
                onValueChange={chooseClient}
                disabled={!draft.clientType}
              >
                <SelectTrigger id="commissionClient">
                  <SelectValue
                    placeholder={
                      draft.clientType
                        ? "Select Client"
                        : "Select a client type first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {clientsOfType.map((client) => (
                    <SelectItem key={client.clientNo} value={client.clientNo}>
                      {client.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {isInvoiceLinked ? (
              /* The invoice the commission is calculated from: only this
                 client's legal-fees invoices are offered. One not yet paid in
                 full is shown - so it is clear it exists - but cannot be
                 chosen, because commission is earned only on fees the client
                 has actually paid. */
              <Field error={asked.errorFor("commissionInvoice")} id="commissionInvoice" label="Invoice No." required>
                <Select
                  value={draft.invoiceNo}
                  onValueChange={chooseInvoice}
                  disabled={!draft.clientNo || clientInvoices.length === 0}
                >
                  <SelectTrigger id="commissionInvoice">
                    {/* Only the number once it is chosen: the fees beside it
                        help pick from the list, but repeating them in the box
                        says twice what the field below already says once. */}
                    {draft.invoiceNo ? (
                      <SelectValue>{draft.invoiceNo}</SelectValue>
                    ) : (
                      <SelectValue
                        placeholder={
                          !draft.clientNo
                            ? "Select a client first"
                            : clientInvoices.length === 0
                              ? "No legal-fees invoice for this client"
                              : "Select Invoice"
                        }
                      />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {clientInvoices.map((row) => {
                      const paidInFull = isFullyPaid(row);
                      return (
                        <SelectItem
                          key={row.invoiceNo}
                          value={row.invoiceNo}
                          disabled={!paidInFull}
                        >
                          {row.invoiceNo} &mdash; {money(row.legalFees)} before
                          VAT
                          {!paidInFull && " \u00b7 " + row.status}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field
                error={asked.errorFor("periodFrom")}
                id="periodFrom"
                label="Period From"
                required
                note="The period applies to paid invoices, not issued ones - whenever the client's payment was confirmed."
              >
                <DateField
                  id="periodFrom"
                  value={draft.periodFrom}
                  max={draft.periodTo || undefined}
                  onChange={(e) => setField("periodFrom", e.target.value)}
                />
              </Field>
            )}
          </Row>

          {isInvoiceLinked && (
            <>
            {/* Facts about the invoice, read back rather than asked for. */}
            <Row cols={3}>
              <Locked
                id="commissionInvoiceDate"
                label="Invoice Date"
                value={formatDate(invoice?.date)}
              />
              <Locked
                id="commissionPaymentStatus"
                label="Payment Status"
                value={invoice?.status || ""}
                highlight={Boolean(invoice) && isFullyPaid(invoice)}
              />
              <Locked
                id="commissionPaidDate"
                label="Payment Date"
                value={formatDate(invoice?.paidDate)}
              />
            </Row>
            <Note>
              Commission applies only to an invoice whose payment by the client
              to the firm has been confirmed. VAT and disbursements are
              excluded.
            </Note>
            </>
          )}

          {/* The whole calculation on one row, so the amount is never read
              apart from the two numbers it came from. */}
          <Row cols={3}>
            {/* A fixed commission does not show the fees it runs on: they are
                every invoice paid inside the period rather than one named
                sum, so a single figure beside the dates would read as a total
                the office could check, which it is not. */}
            {isInvoiceLinked ? (
              <Locked
                id="commissionFees"
                label="Eligible Paid Legal Fees Before VAT (OMR)"
                value={money(fees)}
                note="Only the legal fees stated on the invoice."
              />
            ) : (
              <Field
                error={asked.errorFor("periodTo")}
                id="periodTo"
                label="Period To"
                required
                note="The period applies to paid invoices, not issued ones - whenever the client's payment was confirmed."
              >
                <DateField
                  id="periodTo"
                  value={draft.periodTo}
                  min={draft.periodFrom || undefined}
                  onChange={(e) => setField("periodTo", e.target.value)}
                />
              </Field>
            )}

            <Field
              id="commissionRate"
              label="Commission Percentage (Before VAT)"
              required
              error={asked.errorFor("commissionRate")}
            >
              <div className="relative">
                <Input
                  id="commissionRate"
                  inputMode="decimal"
                  value={draft.rate}
                  onChange={(e) => setField("rate", asRate(e.target.value))}
                  placeholder="0"
                  className="pe-8"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground"
                >
                  %
                </span>
              </div>
            </Field>

            {/* Worked out, never typed: a figure that could be typed could be
                typed wrong. */}
            <Locked
              id="commissionAmount"
              label="Commission Amount (OMR)"
              value={money(commission)}
              highlight={commission > 0}
              note="Calculated automatically."
            />
          </Row>
        </SheetCard>

        <SheetCard title="Employee Comment">
          <Counted
            id="commissionNotes"
            limit={500}
            value={draft.notes}
            onChange={(value) => setField("notes", value)}
            placeholder="Say what this commission is for (optional)"
          />
        </SheetCard>
        </>
        )}
        </>
        )}

        {/* A commission already refused says why, and stays as it is. */}
        {stage === "payment" && refused && (
          <div className="space-y-2">
            <FieldLabel htmlFor="commissionRefused">
              Reason for Rejection
            </FieldLabel>
            <Textarea
              id="commissionRefused"
              readOnly
              tabIndex={-1}
              rows={2}
              className="cursor-default border-destructive/40 bg-destructive/5 text-destructive"
              value={initial?.rejectionReason || ""}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {onHistory && <HistoryCard onClick={onHistory} />}
          <div className="ms-auto flex flex-wrap gap-3">
          <Button type="button" variant="outline" className="min-w-36" onClick={onCancel}>
            Cancel
          </Button>

          {/* One button, whose name is whatever was decided: the decision is
              made in the radio group above, so a second place to make it
              could only disagree with the first. */}
          {stage === "payment" ? (
            !refused &&
            canAnswer && (
              <Button
                type="button"
                className="min-w-48"
                variant={refusing ? "destructive" : "default"}
                onClick={save}
              >
                {refusing
                  ? "Confirm Rejection"
                  : payment.decision
                    ? "Approve and Disburse"
                    : "Select a Decision"}
              </Button>
            )
          ) : (
            <Button type="button" className="min-w-48" onClick={saveAndContinue}>
              Submit Request
            </Button>
          )}
          </div>
        </div>
    </div>
  );
}
