import {
  useState } from "react";
import SalaryLedger from "./SalaryLedger";
import { PayeeFacts, HistoryCard } from "@/components/shared/RequestSheet";
import AdvanceOverview from "./AdvanceOverview";
import UploadIcon from "@/components/shared/UploadIcon";
import { Button } from "@/components/ui/button";
import { RequestSteps } from "@/components/shared/RequestSteps";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  } from "@/components/ui/select";
import SalaryHistory from "./SalaryHistory";
import {
  AdvanceSalaryForm,
  AdvanceRequests,
} from "./AdvanceSalarySection";
import { Rial } from "@/components/shared/Rial";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Save,
  FileCheck,
  History,
  Landmark,
  ShieldCheck,
  Wallet,
  PieChart,
  BarChart3,
  Receipt,
} from "lucide-react";
import Panel from "@/components/shared/Panel";
import { Bordered } from "@/components/shared/panels";
import {
  Said,
  checkRequired,
} from "@/components/shared/formFields";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
} from "@/components/shared/RecordTable";
import { useViolations } from "@/lib/violations/context";
import { useAdvances } from "@/lib/advances/context";
import { owedAdvances, deductedFrom } from "../advanceSalaryData";
import { DEDUCTION_PENALTY } from "../violationData";
import {
  loanRecords,
  loansFor,
  loanTotal,
  schedule,
  isApprovedLoan,
} from "../loanData";
import { PAYMENT_METHODS } from "@/pages/expenses/expenseData";
import { PAYING_ACCOUNTS } from "@/pages/firm/firmData";
import {
  ALLOWANCES,
  DEDUCTIONS,
  SALARY_MONTHS,
  MONTH_FULL,
  PAYMENT_YEARS,
  DEFAULT_BOOKING,
  salaryHistory,
  nextSalaryNo,
  SALARY_REJECTED,
  totalEarnings,
  amount,
} from "../payrollData";
import { salariesApi } from "@/lib/api/modules/salaries";
import { attempt } from "@/lib/api/notice";
import { upsert, upserted } from "@/lib/api/store";

import DateField from "@/components/shared/DateField";
/** The allowances the salary card asks for. */
const SHOWN_KEYS = ["special", "housing", "transport"];

const PAYSLIP_KEYS = [
  "special",
  "housing",
  "transport",
  "electricity",
  "water",
  "loan",
  "administrative",
];

/** An employee record as the payslip form reads it: strings, and no blanks. */
function fromEmployee(employee) {
  const value = (key) => (employee?.[key] ? String(employee[key]) : "");
  const payslip = { basic: value("salary") };
  PAYSLIP_KEYS.forEach((key) => {
    payslip[key] = value(key);
  });
  return payslip;
}

// The three figures start as null rather than "": null means untouched, so
// they open on what the employee is actually paid and can still be cleared.
const emptyPayment = {
  ...DEFAULT_BOOKING,
  month: "",
  year: "",
  calculationDate: new Date().toISOString().slice(0, 10),
  method: "",
  // One choice for where it leaves from: the account carries its bank.
  bankAccount: "",
  reference: "",
  paymentDate: "",
};

/** A heading over one group of the payslip. */
function Group({ title, children }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-primary">{title}</p>
      <div className="form-grid">
        {children}
      </div>
      <div className="border-b" />
    </div>
  );
}

/**
 * One amount on the payslip, with the currency inside the box.
 *
 * `readOnly` marks a figure that is worked out rather than entered; `highlight`
 * marks the one figure the whole page is for.
 */
function Amount({ id, label, required, value, onChange, readOnly, highlight }) {
  return (
    <div className="form-field flex h-full flex-col justify-end gap-2">
      <Label htmlFor={id}>
        {label}
      </Label>
      <div className="relative">
        <Input
          required={required && !readOnly}
          id={id}
          type={readOnly ? "text" : "number"}
          min={readOnly ? undefined : "0"}
          step={readOnly ? undefined : "0.001"}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          placeholder="0.000"
          className={cn(
            !readOnly && "pe-12",
            readOnly && "text-muted-foreground",
            readOnly && !highlight && "bg-locked",
            highlight && "border-green-600 bg-green-50 font-bold text-green-700"
          )}
          value={value}
          onChange={onChange}
        />
        {/* A figure that is typed needs the box to say what it is in; one that
            is worked out arrives with the currency already on it. */}
        {!readOnly && (
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Rial />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * One line of a payslip in the history: what it is, then how much.
 *
 * `tone` colours the amount and never the label, so a row can be scanned
 * down the left for what is being read and across for whether it went out
 * (red) or is what is left (green).
 */
function PayLine({ label, tone, className, children }) {
  return (
    <span className={cn("block leading-relaxed", className)}>
      <span className="font-semibold">{label}</span>{" "}
      <span className={cn("font-semibold", tone)}>{children}</span>
    </span>
  );
}

/** A booking the form does not ask about: it is what a salary is filed as. */
function Locked({ id, label, value }) {
  return (
    <div className="flex h-full flex-col justify-end gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        readOnly
        tabIndex={-1}
        value={value}
        className="cursor-default bg-locked text-muted-foreground"
      />
    </div>
  );
}

/**
 * A figure typed into the salary being recorded. The label says (OMR).
 *
 * `held` marks money coming off the pay rather than going onto it, so any
 * figure above zero is read in red - the one colour money held back wears
 * everywhere in the system.
 */
function Typed({ id, label, value, onChange, held }) {
  return (
    <div className="flex h-full flex-col justify-end gap-2">
      <Label htmlFor={id}>
        {label} (<Rial />)
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0.000"
        className={cn(held && Number(value) > 0 && "font-semibold text-destructive")}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
      />
    </div>
  );
}

/** Two digits, the way an installment is counted: "03 / 12". */
const pad = (n) => String(n).padStart(2, "0");

/** One figure of the summary: what it is, then how much it came to. */
function Sum({ label, value, held, payable }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        payable && "border-green-600/40 bg-green-50"
      )}
    >
      <p
        className={cn(
          "text-sm font-medium",
          held ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-bold",
          held ? "text-destructive" : payable ? "text-green-700" : "text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * One figure of the salary, as a tile.
 *
 * `tone` says what kind of figure it is: money held back is read in red, and
 * the one figure the whole page is for is lit.
 */
function Tile({ icon, title, note, value, tone }) {
  const Icon = icon;
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "held" && "border-destructive/30 bg-destructive/5",
        tone === "payable" && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            tone === "held" ? "text-destructive" : "text-primary"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-primary">{title}</p>
          <p className="text-xs text-muted-foreground">{note}</p>
        </div>
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-bold",
          tone === "held" ? "text-destructive" : "text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** A settled figure inside the payment form's summary. */
function Figure({ label, value }) {
  return (
    <div className="flex h-full flex-col justify-end gap-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="relative">
        <Input
          readOnly
          tabIndex={-1}
          className="bg-locked text-muted-foreground"
          value={amount(value)}
        />
      </div>
    </div>
  );
}

/** A labelled select, since the payment form is made almost entirely of them. */
function Choice({ id, label, value, onChange, placeholder, options }) {
  return (
    <div className="flex h-full flex-col justify-end gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) =>
            typeof option === "string" ? (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ) : (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * What an employee is paid, and the payments made against it.
 *
 * The page holds the monthly salary; the form behind "Add Salary / Bonus"
 * records one payment of it. The payment never asks for the figures again - it
 * reads them off the salary above, so a payslip and the payment that settles it
 * cannot disagree.
 */
export default function SalariesSection({
  employee,
  adding,
  onCloseAdd,
  // Opening a request from the list puts the section back into adding, so
  // the form over the page is the one that shows it.
  onOpenAdd,
  onSave,
  // The words on the button that opens the form, shown over the history.
  addLabel = "Add Salary",
  // The firm sets the salary; on My Profile the payslip is only read.
  canEdit = true,
  // My Profile, where the employee cannot record a payment to themselves but
  // can ask for part of their salary in advance.
  advance = false,
  // Opened from Requests: the salary advances alone.
  advanceOnly = false,
}) {
  // Opened on what the employee is already paid, so the page shows the salary
  // in force rather than a blank form somebody has to fill in from memory.
  // Every salary on record, so a month entered through this form is in the
  // history below it rather than somewhere of its own.
  const { violations } = useViolations();
  const { advances } = useAdvances();
  // The salaries loaded at sign-in are everyone's the user may see; this
  // record shows its own employee's.
  const [history, setHistory] = useState(() =>
    salaryHistory.filter((row) => row.employee === employee?.name)
  );
  // While a call to the server is out, its button waits rather than sending twice.
  const [busy, setBusy] = useState(false);
  const send = async (call) => {
    if (busy) return null;
    setBusy(true);
    try {
      return await attempt(call);
    } finally {
      setBusy(false);
    }
  };
  /** The record the server returned, in place of the one on screen. */
  const keep = (row) => {
    upsert(salaryHistory, row);
    setHistory((prev) => upserted(prev, row));
    return row;
  };
  // Everything paid before, open over the salary payment.
  const [showLedger, setShowLedger] = useState(false);
  const [payslip, setPayslip] = useState(() => fromEmployee(employee));
  const [payment, setPayment] = useState(emptyPayment);
  const [receipt, setReceipt] = useState(null);
  // Which half of the salary being recorded is open: what it comes to, and
  // then how it was transferred.
  const [payStage, setPayStage] = useState("salary");
  // The request on the list that the form is open on, if any, and the reason
  // being written for refusing it.
  const [openId, setOpenId] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  // The advance request opened off its own list, if one is.
  const [openAdvanceId, setOpenAdvanceId] = useState(null);
  // A new advance asked for from the employee's record rather than My Profile.
  const [newAdvance, setNewAdvance] = useState(false);

  const openRequest = history.find((row) => row.id === openId) || null;
  const settled = Boolean(openRequest?.salaryNo);
  const refused = openRequest?.status === SALARY_REJECTED;

  const onAmount = (name) => (e) =>
    setPayslip((prev) => ({ ...prev, [name]: e.target.value }));
  const setPay = (name, value) =>
    setPayment((prev) => ({ ...prev, [name]: value }));

  const earnings = totalEarnings(payslip);
  const allowances = earnings - Number(payslip.basic || 0);

  // What comes off the pay is not typed: it is the loans still being repaid
  // and the penalties on record, added up.
  const loanDebts = loansFor(loanRecords, employee?.name)
    .filter(isApprovedLoan)
    .map((loan) => {
    const plan = schedule(loanTotal(loan), loan.monthly);
    const taken = (loan.payments || []).filter((p) => Number(p.amount) > 0).length;
    return {
      id: loan.id,
      type: "Employee Loan",
      number: Math.min(taken + 1, plan.months || 1),
      of: plan.months || 0,
      monthly: loan.monthly,
    };
  });
  // An advance already granted comes off the pay the same way a loan does -
  // it is money the employee has had - except that it comes off in one go, in
  // the month they named when they asked for it. Read off the same list the
  // request form counts it from, so the two cannot disagree.
  const advanceDebts = owedAdvances(advances, employee?.name).map((advance) => ({
    id: "advance-" + advance.id,
    type: "Salary Advance",
    number: 1,
    of: 1,
    note: deductedFrom(advance),
    monthly: Number(advance.approvedAmount ?? advance.amount ?? 0),
  }));

  const debts = [...loanDebts, ...advanceDebts];
  const loanDue = debts.reduce((sum, debt) => sum + Number(debt.monthly || 0), 0);

  // Penalties that took money, gathered into the month they fell in.
  const penalties = Object.values(
    violations
      .filter(
        (violation) =>
          violation.employee === employee?.name &&
          violation.penaltyType === DEDUCTION_PENALTY &&
          Number(violation.deductionAmount) > 0 &&
          violation.penaltyDate
      )
      .reduce((months, violation) => {
        const [year, month] = violation.penaltyDate.split("-");
        const key = year + "-" + month;
        const found = months[key] || {
          key,
          month: MONTH_FULL[Number(month) - 1] || "",
          year,
          total: 0,
        };
        found.total += Number(violation.deductionAmount);
        months[key] = found;
        return months;
      }, {})
  );
  const penaltyDue = penalties.reduce((sum, row) => sum + row.total, 0);

  const deductions = Number((loanDue + penaltyDue).toFixed(3));
  const net = Number((earnings - deductions).toFixed(3));

  // The month being recorded is worth what the record says it is worth: the
  // salary in force, less the loans and penalties on it.
  const payBasic = Number(payslip.basic) || 0;
  const payAllowances = allowances;
  const payNet = net;

  // What the salary is called while it waits: the request's own number until
  // it is approved and takes the next salary number.
  // A request that is waiting carries its own temporary number; a new one
  // shows the salary number it will take once it is approved.
  const salaryNo = openRequest
    ? openRequest.salaryNo || openRequest.requestNo
    : nextSalaryNo(history);
  const monthNumber = SALARY_MONTHS.findIndex((m) => m.value === payment.month) + 1;
  const period = monthNumber
    ? MONTH_FULL[monthNumber - 1] + " " + payment.year
    : "";

  /** The salary in force, saved onto the employee's record. */
  const savePayslip = () => {
    if (!(Number(payslip.basic) > 0)) return;
    const saved = { salary: String(Number(payslip.basic)) };
    PAYSLIP_KEYS.forEach((key) => {
      saved[key] = Number(payslip[key]) || 0;
    });
    onSave?.(saved);
  };

  const closeAdd = () => {
    setPayment(emptyPayment);
    setReceipt(null);
    setPayStage("salary");
    setOpenId(null);
    setRejecting(false);
    setReason("");
    setOpenAdvanceId(null);
    setNewAdvance(false);
    onCloseAdd();
  };

  /** A request opened back off the list, to be followed, edited or decided. */
  const trackRequest = (record) => {
    setOpenId(record.id);
    setPayStage(record.salaryNo ? "transfer" : "salary");
    setRejecting(false);
    setReason("");
    setReceipt(null);
    setPayment({
      ...emptyPayment,
      month: SALARY_MONTHS[record.month - 1]?.value || "",
      year: String(record.year),
      calculationDate: record.calculationDate || emptyPayment.calculationDate,
      method: record.method || "",
      bankAccount: record.bankAccount || "",
      reference: record.reference || "",
      paymentDate: record.paymentDate || "",
    });
    onOpenAdd?.();
  };

  // What the month came to has to be settled before how it was transferred.
  const canSaveSalary =
    payment.month && payment.year && payment.calculationDate && payBasic > 0;
  const canPay =
    canSaveSalary &&
    payment.method &&
    payment.bankAccount &&
    payment.paymentDate &&
    payment.reference.trim();

  /** What the month is worth, as the record keeps it. */
  const figures = () => ({
    month: monthNumber,
    year: Number(payment.year),
    calculationDate: payment.calculationDate,
    basic: payBasic,
    allowances: payAllowances,
    // Each deduction is kept as what it is: an installment of a loan, and
    // what the penalties took.
    loanDeducted: loanDue,
    administrative: penaltyDue,
    administrativeReason: "",
  });

  /**
   * The salary asked for. It goes on the list straight away, under a
   * temporary number and waiting on a decision, and the form moves on to the
   * transfer that settles it.
   */
  const saveSalary = async () => {
    if (!checkRequired() || !canSaveSalary) return;
    // A request already prepared keeps the figures the server worked out for
    // it; there is nothing to send again.
    if (!openRequest) {
      // The server works the month out from the employee's pay and what is
      // due from it, and numbers the request.
      const { month, year, administrative } = figures();
      const saved = await send(() =>
        salariesApi.prepare({
          employeeId: employee?.id,
          month,
          year,
          administrative,
          administrativeReason: "Disciplinary deductions",
        })
      );
      if (!saved) return;
      keep(saved);
      setOpenId(saved.id);
    }
    setPayStage("transfer");
  };

  /** Approved: the request takes the next salary number and is transferred. */
  const savePayment = async () => {
    if (!checkRequired() || !canPay || !openId) return;
    // One already transferred is only being looked at.
    if (!settled) {
      const saved = await send(() =>
        salariesApi.transfer(openId, { ...payment, reference: payment.reference.trim() })
      );
      if (!saved) return;
      keep(saved);
    }
    closeAdd();
  };

  /** Refused: the request keeps its temporary number and says why. */
  const rejectRequest = async () => {
    if (!openId || !reason.trim()) return;
    const saved = await send(() => salariesApi.reject(openId, reason.trim()));
    if (!saved) return;
    keep(saved);
    closeAdd();
  };

  /* ------------------------------------------------ the payment being added */

  // An advance is what the employee asks for out of their own salary: on My
  // Profile it is the only thing that opens here, and on the firm's side it
  // opens whenever one of those requests is picked off the list to decide.
  const addingAdvance = Boolean(adding && (advance || openAdvanceId || newAdvance));

  // The form opens over the page rather than pushing it down: the list it is
  // filed into stays where it was, behind it.
  const form = (
      <div className="space-y-6">
        {/* The two halves of recording a month's pay: what it came to, and
            then how it was transferred. Either header opens its own half. */}
        <RequestSteps
          active={payStage}
          onChange={setPayStage}
          steps={[
            {
              key: "salary",
              title: "Salary Calculation",
              note: "Review earnings, deductions and salary period",
              done: Boolean(canSaveSalary),
            },
            {
              key: "transfer",
              title: "Salary Transfer",
              note: "Payment and bank transfer details",
              done: Boolean(canPay),
              // Nothing can be transferred until there is a figure to transfer.
              disabled: !canSaveSalary,
            },
          ]}
        />

        {payStage === "salary" ? (
          <>
            {/* Which month is being paid. The number and the figures are not
                asked for: they follow from the record. */}
            <Bordered title="Salary Information">
              <div className="form-grid">
                <div className="space-y-2">
                  <Label htmlFor="pay-no">Salary No.</Label>
                  <div className="relative">
                    <Input
                      id="pay-no"
                      readOnly
                      tabIndex={-1}
                      value={salaryNo}
                      className="cursor-default bg-locked pe-16 text-muted-foreground"
                    />
                    <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded bg-secondary px-2 py-0.5 text-xs font-medium text-primary">
                      Auto
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pay-calc-date">Calculation Date</Label>
                  <DateField
                    id="pay-calc-date"
                    value={payment.calculationDate}
                    onChange={(e) => setPay("calculationDate", e.target.value)}
                  />
                </div>

                <Choice
                  id="pay-month"
                  label="Salary Month"
                  value={payment.month}
                  onChange={(value) => value && setPay("month", value)}
                  placeholder="Select month"
                  options={SALARY_MONTHS}
                />

                <Choice
                  id="pay-year"
                  label="Salary Year"
                  value={payment.year}
                  onChange={(value) => value && setPay("year", value)}
                  placeholder="Select year"
                  options={PAYMENT_YEARS}
                />
              </div>
            </Bordered>

            {/* What goes onto the pay and what comes off it, side by side. */}
            <div className="form-grid form-grid-2">
              <Bordered title="Earnings">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Amount
                    id="pay-basic"
                    label="Basic Salary"
                    value={amount(payslip.basic)}
                    readOnly
                  />
                  {ALLOWANCES.map((allowance) => (
                    <Amount
                      key={allowance.key}
                      id={"pay-" + allowance.key}
                      label={allowance.label}
                      value={amount(payslip[allowance.key])}
                      readOnly
                    />
                  ))}
                </div>
              </Bordered>

              <Bordered title="Deductions" held>
                <div className="form-grid form-grid-2">
                  <Amount
                    id="pay-loan"
                    label="Loan Installment"
                    value={amount(loanDue)}
                    readOnly
                  />
                  <Amount
                    id="pay-penalty"
                    label="Disciplinary Deductions"
                    value={amount(penaltyDue)}
                    readOnly
                  />
                </div>
              </Bordered>
            </div>

            {/* What it all comes to, in the order it is worked out. */}
            <Bordered title="Salary Summary">
              <div className="form-grid">
                <Sum label="Total Earnings" value={amount(earnings)} />
                <Sum label="Total Deductions" value={amount(deductions)} held />
                <Sum label="Net Salary" value={amount(net)} />
                <Sum label="Amount Payable" value={amount(net)} payable />
              </div>
            </Bordered>

            {/* Plain buttons: this form sits inside the employee form, which
                either would otherwise submit. */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Everything paid before, opened over this window. */}
              <HistoryCard onClick={() => setShowLedger(true)} />

              <div className="ms-auto flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={closeAdd}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveSalary}>
                  Save
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* What is being transferred, read off the salary just settled
                rather than asked for again. */}
            <Bordered title="Salary Information">
              <div className="form-grid">
                <Locked id="pay-no" label="Salary No." value={salaryNo} />
                <Locked id="pay-period" label="Salary Period" value={period} />
                <Locked
                  id="pay-employee"
                  label="Employee Name"
                  value={employee?.name || ""}
                />
                <Amount
                  id="pay-net"
                  label="Amount Payable"
                  value={amount(payNet)}
                  readOnly
                  highlight
                />
              </div>
            </Bordered>

            {/* Where it is booked, and how it actually leaves. */}
            <Bordered title="Expense & Disbursement Details">
              <div className="form-grid">
                <Locked
                  id="pay-type"
                  label="Expense Type"
                  value={payment.expenseType}
                />
                <Locked id="pay-category" label="Category" value="Salaries" />
                <Locked
                  id="pay-subcategory"
                  label="Subcategory"
                  value={payment.subcategory}
                />

                <Choice
                  id="pay-method"
                  label={
                    <>
                      Payment Method
                      
                    </>
                  }
                  value={payment.method}
                  onChange={(value) => value && setPay("method", value)}
                  placeholder="Select method"
                  options={PAYMENT_METHODS}
                />

                {/* One choice, not two: the account carries the bank it is
                    held at, so they cannot be set to disagree. */}
                <Choice
                  id="pay-bank"
                  label={
                    <>
                      Bank Account
                      
                    </>
                  }
                  value={payment.bankAccount}
                  onChange={(value) => value && setPay("bankAccount", value)}
                  placeholder="Select bank account"
                  options={PAYING_ACCOUNTS}
                />

                <div className="flex h-full flex-col justify-end gap-2">
                  <Label htmlFor="pay-date">
                    Payment Date
                    
                  </Label>
                  <DateField
                    id="pay-date"
                    value={payment.paymentDate}
                    onChange={(e) => setPay("paymentDate", e.target.value)}
                  />
                </div>

                {/* What the bank called the transfer, and the proof of it:
                    the file name lives in the tooltip, so the control stays
                    icon-sized either way. */}
                <div className="flex h-full flex-col justify-end gap-2">
                  <Label htmlFor="pay-reference">
                    Transfer No.
                    
                  </Label>
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <Input
                      id="pay-reference"
                      className="min-w-0 flex-1"
                      value={payment.reference}
                      onChange={(e) => setPay("reference", e.target.value)}
                      placeholder="TRX-0000-00000"
                    />
                    {receipt ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 border-green-600 text-green-600 hover:text-destructive"
                        title={receipt.name + " - click to remove"}
                        onClick={() => setReceipt(null)}
                      >
                        <FileCheck className="h-4 w-4" />
                        <span className="sr-only">
                          {receipt.name} attached. Remove it.
                        </span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        title="Upload transfer receipt"
                        asChild
                      >
                        <label className="cursor-pointer">
                          <UploadIcon className="h-4 w-4" />
                          <span className="sr-only">Upload transfer receipt</span>
                          <Input
                            type="file"
                            className="hidden"
                            onChange={(e) =>
                              e.target.files[0] && setReceipt(e.target.files[0])
                            }
                          />
                        </label>
                      </Button>
                    )}
                  </div>
                </div>

                {/* The figure being transferred is the one settled on the
                    stage before, so it is shown rather than typed again. */}
                <Amount
                  id="pay-amount"
                  label="Amount to Disburse"
                  value={amount(payNet)}
                  readOnly
                  highlight
                />
              </div>
            </Bordered>

            {/* Who is being paid and where it lands, in one line to be read
                against the transfer above before it is confirmed. */}
            <div className="rounded-lg border border-green-600/40 bg-green-50/50 p-4">
              <p className="mb-3 flex items-center gap-2 font-semibold text-green-700">
                <span
                  aria-hidden="true"
                  className="h-5 w-1 shrink-0 rounded-full bg-green-600"
                />
                Employee &amp; Transfer Summary
              </p>
              <div className="form-grid lg:[&>*+*]:border-s">
                <Said label="Employee No." value={employee?.empNo || ""} />
                <Said label="Employee Name" value={employee?.name || ""} />
                {/* Where the salary lands: the employee's own account, not
                    the firm's account it leaves from. */}
                <Said label="Bank Name" value={employee?.bankName || "-"} />
                <Said label="Account Number" value={employee?.accountNumber || "-"} />
                <Said label="Transfer Amount" value={amount(payNet)} settled />
              </div>
            </div>

            {/* A refused request says why, and stays as it is. */}
            {refused && (
              <div className="space-y-2">
                <Label htmlFor="pay-refused">Reason for Rejection</Label>
                <Textarea
                  id="pay-refused"
                  readOnly
                  tabIndex={-1}
                  rows={2}
                  className="cursor-default border-destructive/40 bg-destructive/5 text-destructive"
                  value={openRequest?.rejectionReason || ""}
                />
              </div>
            )}

            {/* Refusing asks for a reason before it takes one. */}
            {rejecting && (
              <div className="space-y-2">
                <Label htmlFor="pay-reason">
                  Reason for Rejection
                  
                </Label>
                <Textarea
                  id="pay-reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Say why this salary is refused"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Everything paid before, opened over this window. */}
              <HistoryCard onClick={() => setShowLedger(true)} />

              <div className="ms-auto flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={closeAdd}>
                  Cancel
                </Button>

                {/* A salary already transferred is only being looked at. */}
                {!settled && !refused && (
                  rejecting ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={rejectRequest}
                      disabled={!reason.trim()}
                    >
                      Confirm Rejection
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setRejecting(true)}
                    >
                      Reject Request
                    </Button>
                  )
                )}

                {!refused && (
                  <Button
                    type="button"
                    onClick={savePayment}
                    disabled={rejecting}
                  >
                    Save
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
  );

  /* --------------------------------------------------------- the salary itself */


  return (
    <div className="space-y-6">
      {/* Opened over the page, so the list it is filed into stays behind it. */}
      <Dialog
        open={Boolean(adding) && !addingAdvance}
        onOpenChange={(open) => !open && closeAdd()}
      >
        <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {openRequest
                ? "Salary Payment " +
                  (openRequest.salaryNo || openRequest.requestNo)
                : "Salary Payment"}
            </DialogTitle>
            {/* On the transfer, where the salary goes - the employee's bank
                and account - so nobody has to look them up to pay it. */}
            {payStage === "transfer" && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-primary">
                <span>{employee?.empNo || ""}</span>
                <span aria-hidden="true" className="h-5 w-px bg-container-border" />
                <span>{employee?.name || ""}</span>
                <span aria-hidden="true" className="h-5 w-px bg-container-border" />
                <PayeeFacts employee={employee} />
              </div>
            )}
          </DialogHeader>
          {form}
          <Dialog open={showLedger} onOpenChange={setShowLedger}>
            <DialogContent className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Salary History · {employee?.name}</DialogTitle>
              </DialogHeader>
              <SalaryLedger employee={employee} history={history} />
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      {/* What the employee asks for out of that salary opens the same way. */}
      <Dialog
        open={addingAdvance}
        onOpenChange={(open) => !open && closeAdd()}
      >
        <DialogContent hideClose className="max-h-[90vh] w-[92vw] max-w-7xl overflow-y-auto">
          {/* The form heads itself: its title, number, whose it is and the
              close beside them. */}
          <AdvanceSalaryForm
            employee={employee}
            net={net}
            requestId={openAdvanceId}
            // The employee asks for the advance; only the firm's side
            // answers it.
            canDecide={canEdit}
            // On the employee's record the window stays open after a request
            // is sent, on to the decision; on My Profile it closes.
            stayOpen={!advance}
            salaryHistory={history}
            onClose={closeAdd}
          />
        </DialogContent>
      </Dialog>

      {/* What the employee is paid: opening the tab is what shows it, with
          the history of payments under it. Shown, not asked for - a salary is
          changed by recording one, which is what Add Salary is for. */}
      {/* From Requests, only the advances: the salary itself and its history
          are on Financial Benefits. */}
      {!advanceOnly && (
      <div id="salary-details" className="space-y-6 rounded-lg border p-4 sm:p-6">
        {/* The firm sets what somebody is paid, so on their own page the
            figures are read and not typed. Left open they were editable by
            the person they are about, and every figure below - the net, and
            with it what may be asked for in advance - is counted from them. */}
        <fieldset disabled={!canEdit} className="contents">
          <Group title="Salary & Allowances">
            <Amount
              id="salary-basic"
              label="Basic Salary"
              required
              readOnly={!canEdit}
              value={payslip.basic}
              onChange={onAmount("basic")}
            />
            {ALLOWANCES.filter((a) => SHOWN_KEYS.includes(a.key)).map((allowance) => (
              <Amount
                key={allowance.key}
                id={"salary-" + allowance.key}
                label={allowance.label}
                readOnly={!canEdit}
                value={payslip[allowance.key]}
                onChange={onAmount(allowance.key)}
              />
            ))}
          </Group>
        </fieldset>

        {/* What comes off the pay is not typed here: it is what the loans
            and the penalties on record say it is. */}
        <div className="form-grid form-grid-2">
          <Panel title="Debt Installments" icon={Landmark}>
            <RecordTable minWidth={320}>
              <HeadRow>
                <Th width="40%">Debt Type</Th>
                <Th width="28%">Installment No.</Th>
                <Th width="32%">Installment Amount</Th>
              </HeadRow>
              <tbody>
                {debts.length === 0 ? (
                  <Row>
                    <Td className="text-muted-foreground" colSpan={3}>
                      No debt is being repaid.
                    </Td>
                  </Row>
                ) : (
                  debts.map((debt) => (
                    <Row key={debt.id}>
                      <Td>
                        {debt.type}
                        {/* An advance comes off one named month rather than
                            monthly, so the row says which. */}
                        {debt.note && (
                          <span className="block text-xs text-muted-foreground">
                            {debt.note}
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {pad(debt.number)} / {pad(debt.of)}
                      </Td>
                      <Td className="whitespace-nowrap">{amount(debt.monthly)}</Td>
                    </Row>
                  ))
                )}
              </tbody>
            </RecordTable>
          </Panel>

          <Panel title="Disciplinary Deductions" icon={ShieldCheck}>
            <RecordTable minWidth={320}>
              <HeadRow>
                <Th width="40%">Month</Th>
                <Th width="28%">Year</Th>
                <Th width="32%">Total Deduction</Th>
              </HeadRow>
              <tbody>
                {penalties.length === 0 ? (
                  <Row>
                    <Td className="text-muted-foreground" colSpan={3}>
                      No penalty has been deducted.
                    </Td>
                  </Row>
                ) : (
                  penalties.map((penalty) => (
                    <Row key={penalty.key}>
                      <Td>{penalty.month}</Td>
                      <Td>{penalty.year}</Td>
                      <Td className="whitespace-nowrap">{amount(penalty.total)}</Td>
                    </Row>
                  ))
                )}
              </tbody>
            </RecordTable>
          </Panel>
        </div>

        {/* What it all comes to, in the order it is worked out. */}
        <div className="form-grid">
          <Tile
            icon={Wallet}
            title="Total Earnings"
            note="Salary + Allowances"
            value={amount(earnings)}
          />
          <Tile
            icon={PieChart}
            title="Total Deductions"
            note="Loans + Disciplinary"
            value={amount(deductions)}
            tone="held"
          />
          <Tile
            icon={BarChart3}
            title="Net Salary"
            note="After Deductions"
            value={amount(net)}
          />
          <Tile
            icon={Receipt}
            title="Amount Payable"
            note="Final Amount"
            value={amount(net)}
            tone="payable"
          />
        </div>

        {/* The salary belongs to the employee, so it is saved onto the
            record - by the firm, on the Employees page. */}
        {canEdit && (
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={savePayslip}
              disabled={!(Number(payslip.basic) > 0)}
            >
              <Save className="me-2 h-4 w-4" />
              Save
            </Button>
          </div>
        )}
      </div>
      )}

      {/* What has been asked for out of the salary above. The firm sees its
          own record of an advance in the payments; this is the employee's. */}
      {/* What has been asked for out of the salary above. The employee asks
          here, on their own page; the office decides it on theirs. */}
      {/* From Requests: the salary and its advances in one table - an
          advance under its request number while it waits, under the month's
          salary payment number once approved. Elsewhere, the advances alone. */}
      {advanceOnly ? (
        <div className="space-y-5">
          {/* Who may ask for how much, a reading of the past requests, and
              the way to ask - over the list itself. */}
          <AdvanceOverview
            employee={employee}
            advances={advances}
            net={net}
            history={history}
            onNew={
              canEdit && !adding
                ? () => {
                    setNewAdvance(true);
                    onOpenAdd?.();
                  }
                : null
            }
            onOpen={
              adding
                ? null
                : (request) => {
                    setOpenAdvanceId(request.id);
                    onOpenAdd?.();
                  }
            }
          />
          <SalaryLedger
            employee={employee}
            history={history}
            onOpenAdvance={
              adding
                ? null
                : (request) => {
                    setOpenAdvanceId(request.id);
                    onOpenAdd?.();
                  }
            }
            onOpenSalary={canEdit ? trackRequest : null}
            // Add Salary is off the Requests page for now, and the advance is
            // asked for from the button at the head of the view above.
            onAdd={null}
            addLabel={addLabel}
          />
        </div>
      ) : (
      <AdvanceRequests
        employee={employee}
        // The one thing the employee may do with their own salary, on the row
        // above the list it is added to.
        // From Requests, where the salary's own list is not shown, the firm's
        // Add Salary sits here instead.
        onAdd={
          (advance || (advanceOnly && canEdit)) && addLabel && !adding
            ? () => onOpenAdd?.()
            : null
        }
        addLabel={addLabel}
        // On the employee's record, an advance can be asked for on their
        // behalf too, beside Add Salary.
        moreAdds={
          !advance && canEdit && !adding
            ? [
                {
                  label: "Salary Advance Request",
                  onClick: () => {
                    setNewAdvance(true);
                    onOpenAdd?.();
                  },
                },
              ]
            : []
        }
        onOpenRequest={
          adding
            ? null
            : (request) => {
                setOpenAdvanceId(request.id);
                onOpenAdd?.();
              }
        }
      />
      )}


      {/* What has been paid, month by month */}
      {!advanceOnly && (
        <SalaryHistory
          history={history}
          // A request that has not been approved opens back into the form, to
          // be followed, corrected or decided.
          onOpenRequest={canEdit ? trackRequest : null}
          onAdd={canEdit && !adding ? () => onOpenAdd?.() : null}
          addLabel={addLabel}
        />
      )}
    </div>
  );
}