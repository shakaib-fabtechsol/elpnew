import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useClients } from "@/lib/clients/context";
import {
  expiryAlerts,
  readAlertIds,
  writeAlertIds,
} from "@/lib/notifications/expiryAlerts";
import { employeeDocumentAlerts } from "@/pages/employees/employeeData";

/** How often the reminder sounds while anything is still unread. */
const REMINDER_MINUTES = 10;

/**
 * A short two-note chime, synthesised rather than fetched.
 *
 * No audio file to ship, cache or fail to load - and a browser that blocks
 * sound until the page has been interacted with simply stays silent, which is
 * the correct behaviour rather than an error.
 */
function chime() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    const audio = new Ctor();
    [880, 1174].forEach((frequency, step) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const at = audio.currentTime + step * 0.18;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.18);
    });
    setTimeout(() => audio.close(), 1000);
  } catch {
    // Sound is a courtesy; the badge is the notification that matters.
  }
}

/**
 * Papers running out, in the header where they cannot be missed.
 *
 * The bell turns red while anything is unread and sounds every ten minutes
 * until it is looked at - an expiry that goes unnoticed costs the firm a case,
 * so it is deliberately hard to ignore. Opening the panel is what marks it
 * read; the noise stops and the bell goes quiet again.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const { clients } = useClients();

  // Clients' papers and employees' papers, in one list, soonest first. Each
  // alert says whose it is, what it is and where it opens.
  const alerts = [
    ...expiryAlerts(clients).map((alert) => ({
      ...alert,
      title: alert.clientName,
      detail: alert.documentType + ": " + alert.number,
      href: "/clients/" + alert.clientId,
    })),
    ...employeeDocumentAlerts(),
  ].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const [readIds, setReadIds] = useState(readAlertIds);
  const [open, setOpen] = useState(false);

  const unread = alerts.filter((alert) => !readIds.includes(alert.id));
  const hasUnread = unread.length > 0;

  const markAllRead = () => {
    const ids = [...new Set([...readIds, ...alerts.map((a) => a.id)])];
    setReadIds(ids);
    writeAlertIds(ids);
  };

  const openPanel = (next) => {
    setOpen(next);
    if (next) markAllRead();
  };

  // Sounds on the interval only, never on the first render: arriving at a page
  // should not make a noise, but sitting on one with an unread alert should.
  useEffect(() => {
    if (!hasUnread) return;
    const timer = setInterval(chime, REMINDER_MINUTES * 60 * 1000);
    return () => clearInterval(timer);
  }, [hasUnread]);

  const openAlert = (alert) => {
    setOpen(false);
    navigate(alert.href);
  };

  return (
    <DropdownMenu open={open} onOpenChange={openPanel}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative me-1"
          title={
            hasUnread
              ? unread.length + " documents expiring or expired"
              : "Notifications"
          }
        >
          <Bell
            className={cn(
              "h-5 w-5",
              hasUnread ? "text-red-600" : "text-primary"
            )}
          />
          {hasUnread && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread.length}
            </span>
          )}
          <span className="sr-only">
            {hasUnread ? unread.length + " unread alerts" : "Notifications"}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="max-h-96 w-80 overflow-y-auto bg-white p-0"
      >
        <p className="border-b px-4 py-3 text-sm font-semibold text-primary">
          Expiry Alerts
          <span className="ms-1 font-normal text-muted-foreground">
            ({alerts.length})
          </span>
        </p>

        {alerts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing is expiring.
          </p>
        ) : (
          alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => openAlert(alert)}
              className="block w-full border-b px-4 py-3 text-start last:border-0 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
            >
              <p className="text-sm font-medium text-primary">
                {alert.title}
              </p>
              <p className="text-xs text-muted-foreground">{alert.detail}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {alert.expiryDate}
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
                  {/* Hollow while it is only approaching, solid once it has
                      passed - the same two marks used in the client table. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      alert.state === "expired"
                        ? "bg-red-500"
                        : "border-2 border-red-500"
                    )}
                  />
                  {alert.status}
                </span>
              </p>
            </button>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
