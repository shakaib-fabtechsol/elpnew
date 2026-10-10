import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SignIn from "@/pages/settings/SignIn";
import ApiNotice from "@/components/shared/ApiNotice";
import { hasToken, loadAll, loadProfile } from "./session";
import "./modules";

/**
 * Nothing behind this renders until somebody is signed in and their data has
 * come from the API. The providers below it are mounted afresh on each
 * sign-in, so they start from the records just loaded rather than the last
 * user's.
 */
export default function SessionGate({ children }) {
  const [state, setState] = useState(() => (hasToken() ? "loading" : "signedOut"));
  const [error, setError] = useState("");
  // Bumped on every sign-in, to remount everything below with fresh data.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const signedOut = () => setState("signedOut");
    window.addEventListener("sadeed:signed-out", signedOut);
    return () => window.removeEventListener("sadeed:signed-out", signedOut);
  }, []);

  useEffect(() => {
    if (state !== "loading") return undefined;
    let cancelled = false;
    loadProfile()
      .then(() => loadAll())
      .then(() => {
        if (cancelled) return;
        setGeneration((n) => n + 1);
        setState("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.status === 401) setState("signedOut");
        else {
          setError(e?.message || "The data could not be loaded.");
          setState("failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (state === "signedOut") {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <SignIn onSignedIn={() => setState("loading")} />
        <ApiNotice />
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center gap-3 bg-background text-primary">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <span className="text-sm font-medium">Loading your records…</span>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="max-w-md text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => setState("loading")}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div key={generation} className="contents">
      {children}
      <ApiNotice />
    </div>
  );
}
