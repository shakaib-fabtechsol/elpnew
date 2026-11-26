import { can } from "@/lib/access";

/**
 * Who may open which of the Employees table's windows (EmployeeQuickViews):
 * salary needs payroll access, leave the leave requests, documents the
 * employee documents - the same permissions the API enforces.
 */
export const mayView = {
  salary: () => can("payroll.view"),
  leave: () => can("leaveRequests.view"),
  documents: () => can("employeeDocuments.view"),
};
