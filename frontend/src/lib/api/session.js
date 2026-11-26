import { api, setToken, getToken } from "./client";
import { CURRENT_USER } from "@/pages/dashboard/dashboardData";

/**
 * Who is signed in, and loading their data from the API.
 *
 * CURRENT_USER stays the object every screen already reads; signing in fills
 * it with the real user instead of the demo one, so nothing that reads it had
 * to change.
 */

/** The group a role is shown under on the dashboard. */
const GROUP = {
  admin: "Administration",
  accounting: "Accounting",
  lawyer: "Lawyers",
  execution: "Execution Team",
};

/** The signed-in user's profile, as /auth/me and /auth/login return it. */
export const session = { user: null };

function applyUser(profile) {
  session.user = profile;
  Object.assign(CURRENT_USER, {
    name: profile.name,
    role: profile.role,
    group: GROUP[profile.role] || "",
    email: profile.email,
    employeeId: profile.employee?.id ?? null,
    permissions: profile.permissions,
  });
}

export const hasToken = () => Boolean(getToken());

export async function signIn(email, password) {
  const json = await api("auth/login", { method: "POST", body: { email, password, deviceName: "web" } });
  setToken(json.data.token);
  applyUser(json.data.user);
  return json.data.user;
}

export async function loadProfile() {
  const json = await api("auth/me");
  applyUser(json.data);
  return json.data;
}

export async function signOut() {
  try {
    await api("auth/logout", { method: "POST" });
  } catch {
    // Signed out locally whatever the server says.
  }
  setToken("");
  session.user = null;
  window.dispatchEvent(new CustomEvent("sadeed:signed-out"));
}

/* -------------------------------------------------------------- loading */

/**
 * Each module registers how it loads its records (src/lib/api/modules/*).
 * They all run at sign-in, side by side, and fill the stores the screens
 * already read - so a screen shows live data without knowing where it came
 * from.
 *
 * Each one is also a dataset with a state of its own - loading, ready or
 * failed - that a table can show and retry on its own (useDataset). A list
 * that could not be loaded says so, rather than showing an empty table that
 * looks like there is nothing to list.
 */
const loaders = [];

/** name -> { status: "loading" | "ready" | "failed", error, version } */
const datasets = new Map();
const listeners = new Set();

function setDataset(name, patch) {
  const now = datasets.get(name) || { status: "loading", error: "", version: 0 };
  // A new object on every change, so React sees the change.
  datasets.set(name, { ...now, ...patch });
  listeners.forEach((listener) => listener());
}

export function registerLoader(name, load) {
  loaders.push({ name, load });
}

/** For useSyncExternalStore: told whenever any dataset changes state. */
export function subscribeDatasets(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const READY = { status: "ready", error: "", version: 0 };

/** A dataset's state. One nobody registered is simply ready. */
export const datasetState = (name) => datasets.get(name) || READY;

/** Runs one loader, keeping its dataset's state as it goes. */
async function run(loader) {
  setDataset(loader.name, { status: "loading", error: "" });
  try {
    await loader.load();
    setDataset(loader.name, {
      status: "ready",
      error: "",
      version: datasetState(loader.name).version + 1,
    });
  } catch (error) {
    setDataset(loader.name, { status: "failed", error: error?.message || String(error) });
    throw error;
  }
}

/**
 * Loads one dataset again - a table's Retry, or a refresh after something
 * changed. Only that dataset: the rest of the app, and whatever the table on
 * screen is searched, filtered, sorted and paged to, stays as it is.
 */
export async function reloadDataset(name) {
  const loader = loaders.find((one) => one.name === name);
  if (!loader) return;
  try {
    await run(loader);
  } catch {
    // Its state already says it failed, and the table shows that.
  }
}

export async function loadAll() {
  const results = await Promise.allSettled(loaders.map(run));
  const failed = results
    .map((result, index) => (result.status === "rejected" ? loaders[index].name + ": " + (result.reason?.message || result.reason) : null))
    .filter(Boolean);
  if (failed.length) {
    // Logged for the developer; the tables whose data failed say so and
    // offer Retry, and the screens that loaded still work.
    console.error("Some data could not be loaded:", failed);
  }
  return failed;
}
