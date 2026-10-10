import { useMemo, useState } from "react";
import { LeavesContext } from "./context";
import { initialLeaves } from "@/pages/employees/leaveData";
import { leavesApi } from "@/lib/api/modules/leaves";
import { attempt } from "@/lib/api/notice";
import { replaceAll, upserted } from "@/lib/api/store";

/**
 * Every leave request the signed-in user can see, loaded from the API at
 * sign-in.
 *
 * Held here rather than inside the Leaves section: a request asked for on My
 * Profile is the same request the administration reads on the employee's
 * record, and it has to still be there after the page moves to another
 * section and back.
 *
 * Each action is sent to the API and the record it returns replaces the one
 * on screen - the server numbers the request, checks the balance and the
 * dates, and moves it between stages. A refusal is shown as a notice and the
 * action returns null.
 */
export default function LeavesProvider({ children }) {
  const [leaves, setLeaves] = useState(initialLeaves);

  const value = useMemo(() => {
    const keep = (record) => {
      if (record) setLeaves((prev) => upserted(prev, record));
      return record;
    };

    /** The whole list again, as the server now has it. */
    const refresh = async () => {
      const rows = await attempt(() => leavesApi.list());
      if (rows) {
        replaceAll(initialLeaves, rows);
        setLeaves(rows);
      }
      return rows;
    };

    return {
      leaves,

      /** A new request, waiting on the department that has to review it. */
      addLeave: async (draft, employeeId) =>
        keep(await attempt(() => leavesApi.submit(draft, employeeId))),

      /** The department's review: approved goes up to management, refused ends it. */
      departmentDecision: async (id, review) =>
        keep(await attempt(() => leavesApi.departmentDecide(id, review))),

      /** Management's final answer. */
      managementDecision: async (id, review) =>
        keep(await attempt(() => leavesApi.decide(id, review))),

      /**
       * Days of annual leave paid out by a leave encashment. The server files
       * them on the list as Encashed – Paid when the encashment is paid, so
       * this only reads the list again - call it once the payment is through.
       */
      recordEncashment: () => refresh(),

      refreshLeaves: refresh,
    };
  }, [leaves]);

  return <LeavesContext.Provider value={value}>{children}</LeavesContext.Provider>;
}
