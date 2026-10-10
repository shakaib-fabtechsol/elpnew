import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { subscribe } from "@/lib/api/notice";
import { cn } from "@/lib/utils";

/**
 * Where the server's answer is said when it is not what was hoped for: a
 * request refused for being over the limit, a field in the wrong shape, a
 * lost connection. One message at a time, at the foot of the screen, with
 * each refused field listed under it. A single message goes after a few
 * seconds; a list stays until it is closed, so it can be read and acted on.
 */
export default function ApiNotice() {
  const [notice, setNotice] = useState(null);

  useEffect(() => subscribe(setNotice), []);

  useEffect(() => {
    if (!notice || notice.sticky) return undefined;
    const timer = setTimeout(() => setNotice(null), notice.lines?.length ? 10000 : 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  const Icon = notice.tone === "success" ? CircleCheck : CircleAlert;

  return (
    <div
      role={notice.tone === "success" ? "status" : "alert"}
      className={cn(
        "fixed inset-x-4 bottom-4 z-100 mx-auto flex max-w-xl items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
        notice.tone === "success"
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={cn(notice.lines?.length > 0 && "font-semibold")}>{notice.message}</p>
        {notice.lines?.length > 0 && (
          <ul className="mt-1.5 list-disc space-y-1 ps-4">
            {notice.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={() => setNotice(null)}
        className="rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="size-4" aria-hidden="true" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  );
}
