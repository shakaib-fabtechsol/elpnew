import { useMemo, useState } from "react";
import { BonusesContext } from "./context";
import { initialBonuses } from "@/pages/employees/bonusData";
import { bonusesApi } from "@/lib/api/modules/bonuses";
import { attempt } from "@/lib/api/notice";
import { upserted } from "@/lib/api/store";

/**
 * Every bonus the signed-in user can see, loaded from the API at sign-in, so
 * one asked for on an employee's page is still there after the page moves to
 * another section.
 *
 * Each action is sent to the API and the record it returns replaces the one
 * on screen - the server numbers it and moves it on. A refusal is shown as a
 * notice and the action returns null.
 */
export default function BonusesProvider({ children }) {
  const [bonuses, setBonuses] = useState(initialBonuses);

  const value = useMemo(() => {
    const keep = (record) => {
      if (record) setBonuses((prev) => upserted(prev, record));
      return record;
    };

    return {
      bonuses,

      /** Asked for; it waits on management's decision. */
      addBonus: async (details, file, employeeId) =>
        keep(await attempt(() => bonusesApi.submit(details, file, employeeId))),

      /** A request still waiting, corrected. */
      updateBonus: async (id, details, file, employeeId) =>
        keep(await attempt(() => bonusesApi.update(id, details, file, employeeId))),

      /** Management's answer: full, partial or rejected. */
      decideBonus: async (id, decision) =>
        keep(await attempt(() => bonusesApi.decide(id, decision))),

      /** The disbursement, once the money has actually gone out. */
      payBonus: async (id, pay) => keep(await attempt(() => bonusesApi.pay(id, pay))),
    };
  }, [bonuses]);

  return <BonusesContext.Provider value={value}>{children}</BonusesContext.Provider>;
}
