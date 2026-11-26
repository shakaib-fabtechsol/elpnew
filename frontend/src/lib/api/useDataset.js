import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { datasetState, reloadDataset, subscribeDatasets } from "./session";

/**
 * The state of one or more datasets loaded at sign-in (see session.js), for a
 * table to show: skeleton rows while loading, an error with Retry when it
 * failed, the records once ready.
 *
 *   const employees = useDataset(["employees", "employee documents"]);
 *   employees.status   // "loading" | "ready" | "failed" (the worst of them)
 *   employees.version  // goes up each time any of them loads afresh
 *   employees.retry()  // loads again whichever of them failed
 *
 * With no names - a list kept in the browser only - it is always ready.
 */
export default function useDataset(names) {
  const list = names ? (Array.isArray(names) ? names : [names]) : [];
  const key = list.join("|");

  // The snapshot is a string, so React compares it by value and re-renders
  // only when one of these datasets actually changed.
  const snapshot = useSyncExternalStore(subscribeDatasets, () =>
    list.map((name) => {
      const state = datasetState(name);
      return state.status + ":" + state.version;
    }).join("|")
  );

  const states = list.map(datasetState);
  const status = states.some((s) => s.status === "failed")
    ? "failed"
    : states.some((s) => s.status === "loading")
      ? "loading"
      : "ready";
  const version = states.reduce((sum, s) => sum + s.version, 0);
  const error = states.find((s) => s.status === "failed")?.error || "";

  const retry = useCallback(
    () =>
      Promise.all(
        key
          .split("|")
          .filter(Boolean)
          .filter((name) => datasetState(name).status !== "ready")
          .map(reloadDataset)
      ),
    [key]
  );

  return { status, version, error, retry, snapshot };
}

/**
 * Keeps a provider's state in step with its dataset: each time the dataset is
 * loaded afresh after the first time (a table's Retry), `reseed` is called so
 * the provider takes in the records just fetched instead of holding the old
 * ones it started with.
 */
export function useReseed(name, reseed) {
  const version = useSyncExternalStore(subscribeDatasets, () => datasetState(name).version);
  const seen = useRef(version);
  const latest = useRef(reseed);
  useEffect(() => {
    latest.current = reseed;
  });
  useEffect(() => {
    if (version === seen.current) return;
    seen.current = version;
    latest.current();
  }, [version]);
}
