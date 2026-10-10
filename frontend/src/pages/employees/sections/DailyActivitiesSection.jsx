import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/panels";
import {
  RecordTable,
  HeadRow,
  Th,
  Row,
  Td,
} from "@/components/shared/RecordTable";
import {
  CalendarDays,
  Clock,
  Activity,
  FileText,
  Gavel,
  Megaphone,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdvances } from "@/lib/advances/context";
import { useBonuses } from "@/lib/bonuses/context";
import { useLeaves } from "@/lib/leaves/context";
import { useViolations } from "@/lib/violations/context";
import { useCirculars } from "@/lib/circulars/context";
import { initialEntitlements } from "../entitlementData";
import { longDate, today } from "../activityData";
import {
  activityLog,
  workingDay,
  actionCounts,
  clockTime,
  formatDuration,
} from "../activityLog";

/** What each kind of work is called on the page, and how it is drawn. */
const KINDS = [
  { key: "request", label: "Requests Raised", icon: Send },
  { key: "decision", label: "Decisions Recorded", icon: Gavel },
  { key: "document", label: "Documents Filed", icon: FileText },
  { key: "circular", label: "Circulars Acknowledged", icon: Megaphone },
];

/** A figure the day is measured by. Read, never entered. */
function Measure({ icon, label, value, note }) {
  const Icon = icon;
  return (
    <div className="rounded-lg border p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-primary">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** A fact of the working day: shown because the system knows it. */
function Fixed({ id, label, value }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        readOnly
        tabIndex={-1}
        value={value || "-"}
        className="cursor-default bg-locked text-muted-foreground"
      />
    </div>
  );
}

/**
 * The day's work, compiled rather than reported.
 *
 * Nothing on this page is typed. Every figure and every line is read back off
 * what the system already recorded when the work was done - a request sent, a
 * decision given, a circular acknowledged, a paper filed - so the day cannot
 * be written up more kindly than it was worked, and nobody has to stop at five
 * o'clock to account for themselves.
 *
 * Check-in and check-out are the first and last thing the person actually did.
 * That is the only honest answer a system without a turnstile has, and it is
 * said plainly rather than dressed up as an attendance record.
 */
export default function DailyActivitiesSection({ employee }) {
  const { advances } = useAdvances();
  const { bonuses } = useBonuses();
  const { leaves } = useLeaves();
  const { violations } = useViolations();
  const { circulars } = useCirculars();

  const date = today();

  const log = activityLog({
    employee,
    date,
    advances,
    bonuses,
    leaves,
    violations,
    circulars,
    entitlements: initialEntitlements,
    documents: employee?.documents || [],
  });

  const day = workingDay(log);
  const counts = actionCounts(log);

  return (
    <div className="space-y-6">
      {/* When the day started and ended, and how much of it was spent in the
          system. None of it is asked for: all four follow from the log. */}
      <div className="rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-primary">Working Day</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
            {longDate(date)}
          </p>
        </div>

        <div className="form-grid">
          <Fixed
            id="day-check-in"
            label="Check-in"
            value={day.checkIn ? clockTime(day.checkIn) : ""}
          />
          <Fixed
            id="day-check-out"
            label="Check-out"
            value={day.checkOut ? clockTime(day.checkOut) : ""}
          />
          <Fixed
            id="day-office"
            label="Total Office Time"
            value={log.length ? formatDuration(day.officeMinutes) : ""}
          />
          <Fixed
            id="day-active"
            label="System Active Duration"
            value={log.length ? formatDuration(day.activeMinutes) : ""}
          />
        </div>
      </div>

      {/* What the day came to, counted by kind. */}
      <div className="form-grid">
        <Measure
          icon={Activity}
          label="Actions Logged"
          value={String(log.length)}
          note="Across the whole system"
        />
        {KINDS.map((kind) => (
          <Measure
            key={kind.key}
            icon={kind.icon}
            label={kind.label}
            value={String(counts[kind.key] || 0)}
          />
        ))}
      </div>

      {/* The day itself, newest first. */}
      <div className="space-y-4 rounded-lg border p-4">
        <p className="flex items-center gap-2 font-semibold text-primary">
          <Clock aria-hidden="true" className="h-4 w-4 shrink-0" />
          Logged System Actions
        </p>

        {log.length === 0 ? (
          <EmptyState>
            Nothing has been recorded in the system for this employee today.
          </EmptyState>
        ) : (
          <RecordTable minWidth={820}>
            <HeadRow>
              <Th width="12%">Time</Th>
              <Th width="22%">Action</Th>
              <Th width="42%">Details</Th>
              <Th width="24%">Reference</Th>
            </HeadRow>
            <tbody>
              {log.map((event, index) => (
                <Row key={index}>
                  <Td className="whitespace-nowrap text-primary">
                    {clockTime(event.at)}
                  </Td>
                  <Td
                    className={cn(
                      "whitespace-nowrap font-medium",
                      event.kind === "decision" ? "text-green-700" : "text-primary"
                    )}
                  >
                    {event.action}
                  </Td>
                  <Td className="text-start text-muted-foreground">
                    {event.about || "-"}
                  </Td>
                  <Td className="text-primary">{event.reference || "-"}</Td>
                </Row>
              ))}
            </tbody>
          </RecordTable>
        )}
      </div>
    </div>
  );
}
