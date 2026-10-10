/**
 * The one way the app talks to the SADEED API (backend/).
 *
 * Every call carries the signed-in user's token. The body goes as JSON, or as
 * multipart when it carries a file. A refusal comes back as an ApiError that
 * holds the server's message and its per-field errors, keyed the way the
 * forms name their fields (camelCase), so they can be shown under the input.
 */

// In development Vite proxies /api to the Laravel server (vite.config.js);
// a build pointed at another host sets VITE_API_URL.
const BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");

const TOKEN_KEY = "sadeed.token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // A browser that refuses storage keeps the user signed in for this tab only.
  }
  memoryToken = token || "";
}

// Kept in memory as well, for browsers where storage is blocked.
let memoryToken = "";

export class ApiError extends Error {
  constructor(message, status, errors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  /** The first message for a field, if the server named one. */
  field(name) {
    return this.errors?.[name]?.[0] || "";
  }
}

const hasFile = (body) =>
  body &&
  typeof body === "object" &&
  Object.values(body).some(
    (value) =>
      (typeof File !== "undefined" && value instanceof File) ||
      (typeof Blob !== "undefined" && value instanceof Blob)
  );

/** A plain object as multipart form data; nested objects go as JSON-ish keys. */
function toFormData(body) {
  const form = new FormData();
  const append = (key, value) => {
    if (value === undefined || value === null) return;
    if (value instanceof Blob) form.append(key, value);
    else if (typeof value === "boolean") form.append(key, value ? "1" : "0");
    else if (Array.isArray(value)) value.forEach((item, i) => append(`${key}[${i}]`, item));
    else if (typeof value === "object") Object.entries(value).forEach(([k, v]) => append(`${key}[${k}]`, v));
    else form.append(key, String(value));
  };
  Object.entries(body).forEach(([key, value]) => append(key, value));
  return form;
}

/**
 * api("salary-advances", { method: "POST", body: {...} }) -> the parsed JSON.
 * Throws ApiError on anything but success.
 */
export async function api(path, { method = "GET", body, query } = {}) {
  const url = new URL(BASE + "/" + String(path).replace(/^\//, ""), window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
  }

  const headers = { Accept: "application/json" };
  const token = getToken() || memoryToken;
  if (token) headers.Authorization = "Bearer " + token;

  let payload;
  if (body !== undefined) {
    if (hasFile(body)) {
      payload = toFormData(body);
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetch(BASE.startsWith("http") ? url.toString() : url.pathname + url.search, {
      method,
      headers,
      body: payload,
    });
  } catch {
    throw new ApiError("The server could not be reached. Check your connection and try again.", 0);
  }

  if (response.status === 204) return null;

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken("");
      window.dispatchEvent(new CustomEvent("sadeed:signed-out"));
    }
    // A crash on the server answers with its own technical words (a database
    // error, a stack trace): never shown to the person using the app.
    if (response.status >= 500) {
      console.error("Server error on " + method + " " + path + ":", json?.message || response.status);
      throw new ApiError(
        "Something went wrong on the server and this could not be saved. Please try again; if it keeps happening, tell the administrator.",
        response.status
      );
    }

    throw new ApiError(
      json?.message ||
        (response.status === 403
          ? "You do not have permission to do this."
          : response.status === 404
            ? "This record could not be found."
            : "Something went wrong on the server."),
      response.status,
      json?.errors || {}
    );
  }

  return json;
}

/** Every page of a list, for loading a whole collection at sign-in. */
export async function fetchAll(path, query = {}, perPage = 100) {
  const rows = [];
  let page = 1;
  let last = 1;
  do {
    const json = await api(path, { query: { ...query, perPage, page } });
    rows.push(...(json?.data || []));
    last = json?.meta?.last_page || 1;
    page += 1;
  } while (page <= last);
  return rows;
}
