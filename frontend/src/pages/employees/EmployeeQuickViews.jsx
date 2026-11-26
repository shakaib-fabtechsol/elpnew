import { useRef, useState } from "react";
import { CalendarDays, Download, Eye, FileText, RefreshCw, Upload, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
  EmptyRow,
  SkeletonRows,
  ErrorRow,
} from "@/components/shared/RecordTable";
import { useTableSort } from "@/lib/sorting";
import useDataset from "@/lib/api/useDataset";
import { attempt } from "@/lib/api/notice";
import { documentsApi, downloadDocument, viewDocument } from "@/lib/api/modules/documents";
import { can } from "@/lib/access";
import { cn } from "@/lib/utils";
import { useLeaves } from "@/lib/leaves/context";
import {
  amount,
  netSalary,
  totalAllowances,
  totalDeductions,
  documentCategory,
  documentStanding,
  documentStatus,
  formatUploadedAt,
  isVersioned,
  relatedExpiry,
  relatedNumber,
} from "./employeeData";
import { salaryHistory, MONTH_FULL } from "./payrollData";
import { leavesFor, daysOf, leaveTypeLabel, remainingBalance } from "./leaveData";

/**
 * The three windows the Employees table opens from a row: the salary, the
 * leave and the documents of the one employee whose row it is.
 *
 * Every one reads the system's own records as they stand now - the same
 * records the employee's profile shows - so what a window says cannot differ
 * from the profile. Closing one leaves the table exactly where it was: same
 * scroll, same search, filters, sort and page, nothing reloaded.
 *
 * What a person may see is decided by their permissions (lib/access): the
 * table offers a window only to somebody allowed to read it, and within the
 * documents window, preview and download need `employeeDocuments.view` and
 * upload or replace `employeeDocuments.create`.
 */

/** "2026-11-07" -> "07/11/2026"; nothing for nothing. */
const shortDate = (iso) => {
  if (!iso) return "–";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

/** The window frame the three share: the employee named at the top. */
function QuickView({ open, onOpenChange, icon, title, employee, children }) {
  const Icon = icon;
  // The control that opened the window, to give focus back to on closing.
  const opener = useRef(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] w-[min(1000px,95vw)] max-w-none overflow-y-auto"
        // Focus moves into the window and back out again without scrolling
        // the page: closing a window returns the person to the same place in
        // the table they opened it from, not to the top of the page.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          opener.current = document.activeElement;
          event.currentTarget.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus?.({ preventScroll: true });
        }}
      >
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-primary">
            <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {employee?.name} <span className="px-1">|</span> {employee?.empNo}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** One line of a breakdown: what it is, and the figure at the end. */
function Line({ label, value, strong, tone }) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-1.5 text-sm",
        strong && "border-t border-container-border pt-2 font-semibold"
      )}
    >
      <span className={cn("text-primary/80", strong && "text-primary")}>{label}</span>
      <span className={cn("numeric-value whitespace-nowrap text-primary", tone)}>{value}</span>
    </div>
  );
}

/** A coloured status pill. */
const TONE = {
  Transferred: "bg-emerald-50 text-emerald-700",
  Paid: "bg-emerald-50 text-emerald-700",
  Approved: "bg-emerald-50 text-emerald-700",
  Active: "bg-emerald-50 text-emerald-700",
  Complete: "bg-emerald-50 text-emerald-700",
  Pending: "bg-amber-50 text-amber-700",
  "Expiring Soon": "bg-amber-50 text-amber-700",
  Rejected: "bg-red-50 text-red-700",
  Expired: "bg-red-50 text-red-700",
  Missing: "bg-red-50 text-red-700",
};
function Pill({ children }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", TONE[children] || "bg-slate-100 text-slate-700")}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ salary */

const ALLOWANCE_LABELS = [
  ["special", "Special Allowance"],
  ["housing", "Housing Allowance"],
  ["phoneAllowance", "Phone Allowance"],
  ["transport", "Transportation Allowance"],
  ["electricity", "Electricity Allowance"],
  ["water", "Water Allowance"],
];
const DEDUCTION_LABELS = [
  ["loan", "Loan Installment"],
  ["salaryAdvance", "Salary Advance"],
  ["disciplinary", "Disciplinary Deduction"],
  ["otherDeduction", "Other Deduction"],
  ["administrative", "Administrative Deduction"],
];

/** What a month's salary came to: pay and allowances less what was held back. */
const paidNet = (record) =>
  Number(record.basic || 0) +
  Number(record.allowances || 0) -
  Number(record.loanDeducted || 0) -
  Number(record.administrative || 0);

export function SalaryView({ employee, open, onOpenChange }) {
  const dataset = useDataset(["salaries"]);
  const payments = salaryHistory.filter((record) => record.employeeId === employee?.id);
  const { rows, sortProps } = useTableSort(payments, {
    month: { sort: "date", sortValue: (r) => `${r.year}-${String(r.month).padStart(2, "0")}-01` },
    paymentDate: { sort: "date" },
    amount: { sort: "money", sortValue: paidNet },
    status: { sort: "status", sortOrder: ["Pending", "Transferred", "Rejected"] },
  });
  if (!employee) return null;

  const gross = Number(employee.salary || 0) + totalAllowances(employee);
  const lines = (labels) =>
    labels.filter(([key]) => Number(employee[key] || 0) > 0);

  return (
    <QuickView open={open} onOpenChange={onOpenChange} icon={Wallet} title="Salary Details" employee={employee}>
      <div className="grid gap-4 rounded-container border border-container-border p-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Earnings</p>
          <Line label="Basic Salary" value={amount(employee.salary || 0)} />
          {lines(ALLOWANCE_LABELS).map(([key, label]) => (
            <Line key={key} label={label} value={amount(employee[key])} />
          ))}
          <Line label="Gross Salary" value={amount(gross)} strong />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recurring Deductions</p>
          {lines(DEDUCTION_LABELS).length === 0 && (
            <p className="py-1.5 text-sm text-muted-foreground">No recurring deductions.</p>
          )}
          {lines(DEDUCTION_LABELS).map(([key, label]) => (
            <Line key={key} label={label} value={"− " + amount(employee[key])} tone="text-red-700" />
          ))}
          <Line label="Total Deductions" value={amount(totalDeductions(employee))} strong />
          <Line label="Net Salary" value={amount(netSalary(employee))} strong tone="text-emerald-700" />
        </div>
      </div>

      <h3 className="mt-2 text-[15px] font-semibold text-primary">Salary Payment History</h3>
      <RecordTable minWidth={640}>
        <HeadRow>
          <Th {...sortProps("month")}>Payment Month</Th>
          <Th {...sortProps("paymentDate")}>Payment Date</Th>
          <Th {...sortProps("amount")} className="text-end">Amount</Th>
          <Th {...sortProps("status")}>Status</Th>
        </HeadRow>
        <tbody>
          {dataset.status === "loading" ? (
            <SkeletonRows columns={4} rows={4} />
          ) : dataset.status === "failed" ? (
            <ErrorRow colSpan={4} label="salary payments" onRetry={dataset.retry} />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={4} label="salary payments" />
          ) : (
            rows.map((record) => (
              <Row key={record.id}>
                <Td>{MONTH_FULL[record.month - 1]} {record.year}</Td>
                <Td>{shortDate(record.paymentDate)}</Td>
                <Td className="numeric-value text-end font-semibold text-primary">{amount(paidNet(record))}</Td>
                <Td><Pill>{record.status}</Pill></Td>
              </Row>
            ))
          )}
        </tbody>
      </RecordTable>
    </QuickView>
  );
}

/* ------------------------------------------------------------------- leave */

export function LeaveView({ employee, open, onOpenChange }) {
  const { leaves } = useLeaves();
  const dataset = useDataset(["leaves"]);
  const history = employee ? leavesFor(leaves, employee.name) : [];
  const { rows, sortProps } = useTableSort(history, {
    type: { sort: "text", sortValue: leaveTypeLabel },
    from: { sort: "date" },
    to: { sort: "date" },
    days: { sort: "number", sortValue: daysOf },
    status: { sort: "status", sortOrder: ["Pending", "Approved", "Encashed – Paid", "Rejected"] },
  });
  if (!employee) return null;

  // Annual leave this year: what is given, what approved leave has used, and
  // what is left - worked out from the approved requests, so every movement
  // on the leave book shows here at once.
  const balance = remainingBalance(leaves, employee.name, "Annual Leave", String(new Date().getFullYear()));
  const figures = [
    ["Entitlement", balance?.allowance],
    ["Used", balance?.used],
    ["Remaining", balance?.remaining],
  ];

  return (
    <QuickView open={open} onOpenChange={onOpenChange} icon={CalendarDays} title="Leave Details" employee={employee}>
      <div className="grid grid-cols-3 divide-x divide-container-border rounded-container border border-container-border rtl:divide-x-reverse">
        {figures.map(([label, value]) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="numeric-value text-2xl font-bold text-primary">{value ?? "–"}</p>
            <p className="text-xs text-muted-foreground">{label} (days, {new Date().getFullYear()})</p>
          </div>
        ))}
      </div>

      <h3 className="mt-2 text-[15px] font-semibold text-primary">Leave History</h3>
      <RecordTable minWidth={640}>
        <HeadRow>
          <Th {...sortProps("type")}>Leave Type</Th>
          <Th {...sortProps("from")}>Start Date</Th>
          <Th {...sortProps("to")}>End Date</Th>
          <Th {...sortProps("days")} className="text-end">Days</Th>
          <Th {...sortProps("status")}>Approval Status</Th>
        </HeadRow>
        <tbody>
          {dataset.status === "loading" ? (
            <SkeletonRows columns={5} rows={4} />
          ) : dataset.status === "failed" ? (
            <ErrorRow colSpan={5} label="leave history" onRetry={dataset.retry} />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={5} label="leave records" />
          ) : (
            rows.map((leave) => (
              <Row key={leave.id}>
                <Td>{leaveTypeLabel(leave)}</Td>
                <Td>{shortDate(leave.from)}</Td>
                <Td>{shortDate(leave.to)}</Td>
                <Td className="numeric-value text-end">{daysOf(leave)}</Td>
                <Td><Pill>{leave.status}</Pill></Td>
              </Row>
            ))
          )}
        </tbody>
      </RecordTable>
    </QuickView>
  );
}

/* --------------------------------------------------------------- documents */

/** The file picker behind Upload and Replace: one paper of one type. */
function FileButton({ label, icon, onFile, busy }) {
  const Icon = icon;
  const input = useRef(null);
  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        <Icon className="me-1.5 size-3.5" aria-hidden="true" />
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

export function DocumentsView({ employee, open, onOpenChange, onChanged }) {
  const dataset = useDataset(["employee documents"]);
  const [busyType, setBusyType] = useState("");
  // Bumped after an upload, so the window reads the file again.
  const [, setTick] = useState(0);

  const standing = employee ? documentStanding(employee) : null;
  // Every paper on file, and a line for each required one that is not.
  const list = standing
    ? [
        ...standing.current.map((paper) => ({
          key: "doc-" + paper.id,
          paper,
          type: paper.type,
          status: documentStatus(paper, standing.papers),
        })),
        ...standing.missing.map((type) => ({ key: "missing-" + type, type, status: "Missing" })),
      ]
    : [];
  const { rows, sortProps } = useTableSort(list, {
    type: { sort: "text" },
    category: { sort: "text", sortValue: (row) => documentCategory(row.type) },
    uploaded: { sort: "date", sortValue: (row) => row.paper?.uploadedAt },
    expiry: { sort: "date", sortValue: (row) => row.paper?.expiry },
    status: { sort: "status", sortOrder: ["Expired", "Missing", "Expiring Soon", "Active"] },
  });
  if (!employee) return null;

  const mayRead = can("employeeDocuments.view");
  const mayFile = can("employeeDocuments.create");

  /** Files a copy of one type: a missing paper, or a new version of one on file. */
  const file = async (type, upload) => {
    setBusyType(type);
    const saved = await attempt(() =>
      documentsApi.upload(employee.id, {
        type,
        file: upload,
        number: relatedNumber(type, employee),
        expiry: relatedExpiry(type, employee),
      })
    );
    setBusyType("");
    if (saved) {
      setTick((n) => n + 1);
      onChanged?.();
    }
  };

  return (
    <QuickView open={open} onOpenChange={onOpenChange} icon={FileText} title="Employee Documents" employee={employee}>
      <p className="text-sm text-muted-foreground">
        Standing: <Pill>{standing.status}</Pill>
        {standing.missing.length > 0 && <> &middot; {standing.missing.length} required missing</>}
        {standing.expiring.length > 0 && <> &middot; {standing.expiring.length} expiring soon</>}
        {standing.expired.length > 0 && <> &middot; {standing.expired.length} expired</>}
      </p>
      <RecordTable minWidth={820}>
        <HeadRow>
          <Th {...sortProps("type")}>Document</Th>
          <Th {...sortProps("category")}>Type</Th>
          <Th {...sortProps("uploaded")}>Upload Date</Th>
          <Th {...sortProps("expiry")}>Expiry Date</Th>
          <Th {...sortProps("status")}>Status</Th>
          <Th className="text-end">Actions</Th>
        </HeadRow>
        <tbody>
          {dataset.status === "loading" ? (
            <SkeletonRows columns={6} rows={4} />
          ) : dataset.status === "failed" ? (
            <ErrorRow colSpan={6} label="documents" onRetry={dataset.retry} />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={6} label="documents" />
          ) : (
            rows.map((row) => (
              <Row key={row.key}>
                <Td>
                  <p className="font-medium text-primary">{row.type}</p>
                  {row.paper?.number && <p className="text-xs text-muted-foreground">{row.paper.number}</p>}
                </Td>
                <Td>{documentCategory(row.type)}</Td>
                <Td>{row.paper?.uploadedAt ? formatUploadedAt(row.paper.uploadedAt) : "–"}</Td>
                <Td>{shortDate(row.paper?.expiry)}</Td>
                <Td><Pill>{row.status}</Pill></Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {row.paper && mayRead && row.paper.downloadPath && (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={() => viewDocument(row.paper)}>
                          <Eye className="me-1.5 size-3.5" aria-hidden="true" />
                          Preview
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => downloadDocument(row.paper)}>
                          <Download className="me-1.5 size-3.5" aria-hidden="true" />
                          Download
                        </Button>
                      </>
                    )}
                    {/* Replace files a new version of a paper held one at a
                        time; the old one is kept, archived. A missing paper is
                        uploaded. Both are for those allowed to file papers. */}
                    {mayFile && !row.paper && (
                      <FileButton label="Upload" icon={Upload} busy={busyType === row.type} onFile={(f) => file(row.type, f)} />
                    )}
                    {mayFile && row.paper && isVersioned(row.type) && (
                      <FileButton label="Replace" icon={RefreshCw} busy={busyType === row.type} onFile={(f) => file(row.type, f)} />
                    )}
                  </div>
                </Td>
              </Row>
            ))
          )}
        </tbody>
      </RecordTable>
    </QuickView>
  );
}
