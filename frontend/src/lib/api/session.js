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
 */
const loaders = [];

export function registerLoader(name, load) {
  loaders.push({ name, load });
}

export async function loadAll() {
  const results = await Promise.allSettled(loaders.map((loader) => loader.load()));
  const failed = results
    .map((result, index) => (result.status === "rejected" ? loaders[index].name + ": " + (result.reason?.message || result.reason) : null))
    .filter(Boolean);
  if (failed.length) {
    // Logged for the developer; the screens that loaded still work.
    console.error("Some data could not be loaded:", failed);
  }
  return failed;
}
