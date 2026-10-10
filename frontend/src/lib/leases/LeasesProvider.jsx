import { useMemo, useState } from "react";
import { LeasesContext } from "./context";
import { initialLeases } from "@/pages/leases/leaseData";

/** What a lease holds before its contract has been entered. */
const EMPTY_CONTRACT = {
  contractStatus: "",
  contractNo: "",
  contractFile: "",
  building: "",
  unit: "",
  address: "",
  start: "",
  end: "",
  rent: 0,
  vatApplied: true,
  method: "",
  paymentFile: "",
  bankAccountId: "",
  installments: "",
  paymentDay: "",
  cheques: {},
  nonRenewalDate: "",
  nonRenewalFile: "",
  payments: {},
  cancelled: [],
  installmentNotes: {},
};

/**
 * The leases, in one place.
 *
 * The table and a lease's own page read and change the same records, so a
 * correction made on the lease is what the table shows the moment you go back.
 */
export default function LeasesProvider({ children }) {
  const [leases, setLeases] = useState(initialLeases);

  // Editing the seed data while the app is open hot-reloads this provider
  // with its old state kept: leases shaped the old way, which the pages can
  // no longer read (an empty payment schedule, say). Start again from the new
  // seed whenever it changes.
  const [seed, setSeed] = useState(initialLeases);
  if (seed !== initialLeases) {
    setSeed(initialLeases);
    setLeases(initialLeases);
  }

  const value = useMemo(
    () => ({
      leases,

      findLease: (id) => leases.find((lease) => lease.id === Number(id)) || null,

      /**
       * A new lease, newest first so it is at the top of the table it was
       * added from. Its contract - number included, which is the one on the
       * signed paper - is entered later, on the lease's own page.
       */
      addLease: (record) =>
        setLeases((prev) => [
          {
            ...EMPTY_CONTRACT,
            ...record,
            id: prev.reduce((max, lease) => Math.max(max, lease.id), 0) + 1,
          },
          ...prev,
        ]),

      updateLease: (id, changes) =>
        setLeases((prev) =>
          prev.map((lease) =>
            lease.id === Number(id) ? { ...lease, ...changes } : lease
          )
        ),

      /**
       * One installment's payment and note, from wherever it was recorded -
       * the lease's own schedule or the pending disbursements. No payment
       * takes a recorded one back off; an empty note removes the note.
       */
      recordInstallment: (id, no, { payment, note }) =>
        setLeases((prev) =>
          prev.map((lease) => {
            if (lease.id !== Number(id)) return lease;
            const payments = { ...(lease.payments || {}) };
            if (payment) payments[no] = payment;
            else delete payments[no];
            const installmentNotes = { ...(lease.installmentNotes || {}) };
            if (note) installmentNotes[no] = note;
            else delete installmentNotes[no];
            return { ...lease, payments, installmentNotes };
          })
        ),
    }),
    [leases]
  );

  return (
    <LeasesContext.Provider value={value}>{children}</LeasesContext.Provider>
  );
}
