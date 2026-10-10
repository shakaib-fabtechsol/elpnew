import { api, fetchAll } from "../client";
import { registerLoader } from "../session";
import { num, replaceAll } from "../store";
import { salaryHistory } from "@/pages/employees/payrollData";

/**
 * Monthly salaries (/salaries).
 *
 * A salary is prepared on the server from the employee's pay and what is due
 * from it that month - the loan installment and any advance - then
 * transferred, when it takes its SAL number, or rejected. The screens read the
 * advance in with the loan installment, as one deduction, so it is added in
 * here and the net they work out matches the server's.
 */

export function salaryFromApi(s) {
  return {
    id: s.id,
    employee: s.employee?.name || "",
    employeeId: s.employeeId,
    requestNo: s.requestNo || "",
    salaryNo: s.salaryNo || "",
    month: Number(s.month),
    year: Number(s.year),
    basic: num(s.basic) || 0,
    allowances: num(s.allowances) || 0,
    loanDeducted: Number(((num(s.loanDeducted) || 0) + (num(s.advanceDeducted) || 0)).toFixed(3)),
    administrative: num(s.administrative) || 0,
    administrativeReason: s.administrativeReason || "",
    status: s.status,
    rejectionReason: s.rejectionReason || "",
    method: s.paymentMethod || "",
    bankAccount: s.bankAccount || "",
    reference: s.paymentReference || "",
    paymentDate: s.paymentDate || "",
  };
}

export const salariesApi = {
  /**
   * Prepares a month's salary. The figures are the server's; only a
   * deduction the screen adds of its own (penalties) is sent, with why.
   */
  async prepare({ employeeId, month, year, administrative, administrativeReason }) {
    const json = await api("salaries", {
      method: "POST",
      body: {
        employeeId,
        month: Number(month),
        year: Number(year),
        ...(Number(administrative) > 0
          ? { administrative: Number(administrative), administrativeReason }
          : {}),
      },
    });
    return salaryFromApi(json.data);
  },

  /** Transferred: the salary takes its number and repays the loan installment. */
  async transfer(id, pay) {
    const json = await api(`salaries/${id}/transfer`, {
      method: "POST",
      body: {
        paymentMethod: pay.method,
        paymentDate: pay.paymentDate,
        bankAccount: pay.bankAccount || null,
        paymentReference: pay.reference || null,
      },
    });
    return salaryFromApi(json.data);
  },

  async reject(id, reason) {
    const json = await api(`salaries/${id}/reject`, { method: "POST", body: { reason } });
    return salaryFromApi(json.data);
  },
};

// Every salary the signed-in user may see: the firm's side sees everyone's,
// an employee their own. Each screen keeps to the employee it is showing.
registerLoader("salaries", async () => {
  const rows = await fetchAll("salaries");
  replaceAll(salaryHistory, rows.map(salaryFromApi));
});
