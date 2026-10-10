import { useMemo, useState } from "react";
import { ViolationsContext } from "./context";
import { initialViolations } from "@/pages/employees/violationData";
import { violationsApi } from "@/lib/api/modules/violations";
import { attempt } from "@/lib/api/notice";
import { upserted } from "@/lib/api/store";

/**
 * Every violation the signed-in user can see, loaded from the API at sign-in -
 * so one recorded on an employee's page is still there after the page moves
 * to another section, and each stage of it picks up where the last one left
 * off.
 *
 * Each stage is sent to the API and the record it returns replaces the one on
 * screen: the server checks the stage is the one waiting, numbers the
 * violation when a penalty is issued, and sets the status. A refusal is shown
 * as a notice and the action returns null.
 */
export default function ViolationsProvider({ children }) {
  const [violations, setViolations] = useState(initialViolations);

  const value = useMemo(() => {
    const keep = (record) => {
      if (record) setViolations((prev) => upserted(prev, record));
      return record;
    };
    const run = async (call) => keep(await attempt(call));

    return {
      violations,

      addViolation: (employeeId, draft, document) =>
        run(() => violationsApi.add(employeeId, draft, document)),
      acknowledgeViolation: (id) => run(() => violationsApi.acknowledge(id)),
      respondToViolation: (id, draft, document) =>
        run(() => violationsApi.respond(id, draft, document)),
      decideViolation: (id, draft, document) =>
        run(() => violationsApi.decide(id, draft, document)),
      appealViolation: (id, draft, document) =>
        run(() => violationsApi.appeal(id, draft, document)),
      settleAppeal: (id, draft) => run(() => violationsApi.outcome(id, draft)),
    };
  }, [violations]);

  return (
    <ViolationsContext.Provider value={value}>
      {children}
    </ViolationsContext.Provider>
  );
}
