import { useMemo, useState } from "react";
import { AdvancesContext } from "./context";
import { initialAdvances } from "@/pages/employees/advanceSalaryData";
import { advancesApi } from "@/lib/api/modules/advances";
import { attempt } from "@/lib/api/notice";
import { upserted } from "@/lib/api/store";

/**
 * Every salary advance the signed-in user can see, loaded from the API at
 * sign-in, so a request made on My Profile is still there after the page
 * moves to another section.
 *
 * Each action is sent to the API and the record it returns replaces the one
 * on screen - the server decides numbers, statuses and limits. A refusal is
 * shown as a notice and the action returns null.
 */
export default function AdvancesProvider({ children }) {
  const [advances, setAdvances] = useState(initialAdvances);

  const value = useMemo(() => {
    const keep = (record) => {
      if (record) setAdvances((prev) => upserted(prev, record));
      return record;
    };

    return {
      advances,

      /** A request is only ever asked for; the office decides it later. */
      submitAdvance: async (draft, employeeId) =>
        keep(await attempt(() => advancesApi.submit(draft, employeeId))),

      /** A returned request, corrected and sent back to management. */
      resubmitAdvance: async (id, draft, employeeId) =>
        keep(await attempt(() => advancesApi.resubmit(id, draft, employeeId))),

      /** Management's answer: full, partial, completion (return) or rejected. */
      decideAdvance: async (id, decision) =>
        keep(await attempt(() => advancesApi.decide(id, decision))),

      /** The financial department's payment. */
      payAdvance: async (id, pay) => keep(await attempt(() => advancesApi.pay(id, pay))),
    };
  }, [advances]);

  return (
    <AdvancesContext.Provider value={value}>{children}</AdvancesContext.Provider>
  );
}
