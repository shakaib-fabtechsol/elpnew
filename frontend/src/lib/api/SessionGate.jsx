import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageLoader } from "@/components/shared/Loader";
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
 *
 * The address follows the same rule. Signed out, it reads /login - never the
 * page that was open, which would leave one person's record in the address
 * bar for the next. Somebody who arrives at a page without being signed in is
 * taken back to it once they are; somebody who signs out is not, because the
 * next person to sign in may not be them.
 */
const SIGN_IN_PATH = "/login";

export default function SessionGate({ children }) {
  const [state, setState] = useState(() => (hasToken() ? "loading" : "signedOut"));
  const [error, setError] = useState("");
  // Bumped on every sign-in, to remount everything below with fresh data.
  const [generation, setGeneration] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  // Where to go once signed in: the page somebody arrived at, if any.
  const returnTo = useRef("");
  // True only for the very first address of this visit, before anything here
  // has moved it: that one is an arrival, every later one is not.
  const hasArrived = useRef(true);
  // Whether anybody has been signed in during this visit.
  const everReady = useRef(false);

  useEffect(() => {
    const signedOut = () => {
      // Signed out on purpose (or by the server): nothing to come back to.
      returnTo.current = "";
      setState("signedOut");
    };
    // Something was created outside the screen that lists it: load again.
    const reload = () => setState((now) => (now === "ready" ? "loading" : now));
    window.addEventListener("sadeed:signed-out", signedOut);
    window.addEventListener("sadeed:reload", reload);
    return () => {
      window.removeEventListener("sadeed:signed-out", signedOut);
      window.removeEventListener("sadeed:reload", reload);
    };
  }, []);

  useEffect(() => {
    if (state !== "loading") return undefined;
    let cancelled = false;
    loadProfile()
      .then(() => loadAll())
      .then(() => {
        if (cancelled) return;
        everReady.current = true;
        setGeneration((n) => n + 1);
        setState("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.status === 401) {
          // A saved sign-in that has lapsed, found on arriving at a page:
          // the page is still where they were going.
          if (!everReady.current && window.location.pathname !== SIGN_IN_PATH) {
            returnTo.current = window.location.pathname + window.location.search;
          }
          setState("signedOut");
        }
        else {
          setError(e?.message || "The data could not be loaded.");
          setState("failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  // Keeps the address in step with whether anybody is signed in.
  useEffect(() => {
    const here = location.pathname;
    if (state === "signedOut" && here !== SIGN_IN_PATH) {
      // Arrived at a page while signed out: remember it for after sign-in.
      // (After a sign-out the ref has just been emptied, and stays empty.)
      if (returnTo.current === "" && hasArrived.current) returnTo.current = here + location.search;
      navigate(SIGN_IN_PATH, { replace: true });
    } else if (state === "ready" && here === SIGN_IN_PATH) {
      const target = returnTo.current || "/";
      returnTo.current = "";
      navigate(target, { replace: true });
    }
    hasArrived.current = false;
  }, [state, location.pathname, location.search, navigate]);

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
      // The page loader, in the middle of the screen, over an empty page.
      <div className="min-h-screen bg-background">
        <PageLoader label="Loading your records" />
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
