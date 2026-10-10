/**
 * A salary advance from start to finish, as one PDF page to print and file in
 * the employee's personnel record: what was asked for, what management
 * decided, and how the money was paid out.
 *
 * jsPDF is loaded only when a summary is made, so the pages that never make
 * one do not carry it.
 */
import { amountValue, CURRENCY } from "@/lib/money";
import { deductedFrom } from "./advanceSalaryData";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "04 Oct 2026", or a dash where there is no date. */
const day = (iso) => {
  if (!iso) return "-";
  const [year, month, date] = String(iso).split("-");
  return `${date} ${SHORT_MONTHS[Number(month) - 1]} ${year}`;
};

const money = (value) => amountValue(value) + " " + CURRENCY;

/** How each of management's answers is written on the summary. */
const DECISION_LABEL = {
  full: "Full Approval",
  partial: "Partial Approval",
  completion: "Returned for Resubmission",
  rejected: "Rejected",
};

/**
 * Builds the summary and returns a blob URL to show it by.
 *
 * `advance` is the request as it stands once paid; `net` is the salary it was
 * judged against.
 */
export async function advanceSummaryPdf({ advance, employee, net }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 18;
  const right = 192;
  const width = right - left;
  let y = 20;

  const navy = [15, 35, 75];
  const grey = [100, 110, 125];

  // The head: what this is, the request's number, and when it was printed.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...navy);
  doc.text("Salary Advance - Transaction Summary", left, y);
  doc.setFontSize(11);
  doc.text(advance.requestNo || "", right, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...grey);
  doc.text("Generated on " + day(advance.paidOn), left, y);
  y += 4;
  doc.setDrawColor(200, 205, 215);
  doc.line(left, y, right, y);
  y += 8;

  /** A section's heading, ruled under. */
  const heading = (title) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...navy);
    doc.text(title, left, y);
    y += 2;
    doc.line(left, y, right, y);
    y += 6;
  };

  /** Label and value pairs, two to a line. */
  const facts = (pairs) => {
    const column = width / 2;
    pairs.forEach(([label, value], index) => {
      const x = left + (index % 2) * column;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...grey);
      doc.text(label, x, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...navy);
      doc.text(String(value ?? "-"), x, y + 5, { maxWidth: column - 6 });
      if (index % 2 === 1 || index === pairs.length - 1) y += 13;
    });
  };

  /** A passage of written text under its label, wrapped to the page. */
  const passage = (label, text) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...grey);
    doc.text(label, left, y);
    y += 5;
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    const lines = doc.splitTextToSize(text || "-", width);
    doc.text(lines, left, y);
    y += lines.length * 5 + 5;
  };

  const approved = Number(advance.approvedAmount) || Number(advance.amount) || 0;

  heading("Employee");
  facts([
    ["Employee Name", employee?.name],
    ["Employee No.", employee?.empNo],
  ]);

  heading("1. Request");
  facts([
    ["Request Date", day(advance.requestedOn)],
    ["Advance Amount (Requested)", money(advance.amount)],
    ["Deduct From Salary Of", deductedFrom(advance)],
    ["Purpose", advance.purpose || "-"],
    ["Salary of That Month", money(net)],
  ]);
  passage("Employee Remarks", advance.reason);

  heading("2. Management Decision");
  facts([
    ["Decision", DECISION_LABEL[advance.decision] || advance.status],
    ["Approved Amount", money(approved)],
    ["Decision Date", day(advance.decidedOn)],
    ["Approved By", advance.decidedBy || "-"],
    ["Remaining Salary After Approved Amount", money(net - approved)],
  ]);
  passage("Management Comment", advance.managementComment);

  heading("3. Financial Department Actions");
  facts([
    ["Disbursement Type", advance.expenseType],
    ["Category", advance.category],
    ["Sub-Category", advance.subcategory],
    ["Disbursement Date", day(advance.paymentDate)],
    ["Payment Method", advance.method],
    ["Reference No.", advance.reference || "-"],
    ["Processed By", advance.paidBy || "-"],
    ["Processed On", day(advance.paidOn)],
  ]);
  passage("Financial Comment", advance.financeComment);

  // Room to sign it before it is filed.
  y = Math.max(y + 10, 250);
  doc.setDrawColor(150, 155, 165);
  doc.line(left, y, left + 60, y);
  doc.line(right - 60, y, right, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...grey);
  doc.text("Management Signature", left, y + 5);
  doc.text("Financial Department Signature", right, y + 5, { align: "right" });

  return URL.createObjectURL(doc.output("blob"));
}
