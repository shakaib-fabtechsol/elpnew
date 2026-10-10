import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import FormHeading from "@/components/shared/FormHeading";
import TabBar from "@/components/shared/TabBar";
import { FileSpreadsheet } from "lucide-react";
import { ENTITLEMENT_TABS } from "../entitlementTabs";
import { initialEntitlements } from "../entitlementData";
import EntitlementTab from "./EntitlementTab";

/**
 * What the firm owes an employee beyond their salary.
 *
 * Nine lists in one page rather than nine entries in the menu: an allowance
 * and an end-of-service payment answer the same question - what this person is
 * entitled to and why - and the tab says which of them is open. Each list is
 * claimed the same way: a window over the page, a temporary number while it
 * waits, and the list's own number once it is granted.
 */
export default function EntitlementsSection({
  employee,
  // The firm decides what it pays; on My Profile the entitlements are read.
  canEdit = true,
  // Which entitlement to open on, when the page that opens it already knows -
  // Requests opens straight on the one that was chosen there.
  tab: initialTab,
  // Opened from Requests: the chosen entitlement's list alone - the cards
  // above already choose which.
  listOnly = false,
}) {
  const [tab, setTab] = useState(initialTab || ENTITLEMENT_TABS[0].key);
  const [records, setRecords] = useState(initialEntitlements);
  // Whether the window is open, and on which tab it was opened.
  const [adding, setAdding] = useState(null);

  // Moving to another tab closes what was open on the last one.
  const [openTab, setOpenTab] = useState(tab);
  if (openTab !== tab) {
    setOpenTab(tab);
    setAdding(null);
  }

  const current = ENTITLEMENT_TABS.find((option) => option.key === tab);

  return (
    <div className="space-y-6">
      {/* The section's name, and under it the nine entitlements it covers.
          Not beside the name, as a shorter set of tabs would be: nine of these
          labels and a heading cannot share a line without the tabs folding
          onto a second one, and a folded set stops looking like one set. */}
      {!listOnly && (
        <>
          <FormHeading
            icon={FileSpreadsheet}
            title="Employee Entitlements"
            note="Manage employee allowances and end-of-service entitlements"
          />

          <TabBar options={ENTITLEMENT_TABS} value={tab} onChange={setTab} fit />
        </>
      )}

      {/* The button names the entitlement the open tab is on, and asks for
          it rather than adding it: every one of the nine is a request the
          office still has to answer. It sits on the table's own row. */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Every tab is the same page over a different entitlement, so one
              component draws them all - keyed so opening another tab starts
              its own form afresh. */}
          <EntitlementTab
            key={tab}
            kind={tab}
            label={current.label}
            employee={employee}
            records={records}
            onRecords={setRecords}
            addLabel={"Request " + current.label}
            adding={adding === tab}
            onCloseAdd={() => setAdding(null)}
            onOpenAdd={() => setAdding(tab)}
            canDecide={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
