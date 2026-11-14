const API_URL = "http://localhost:8000";
const TOKEN_KEY = "retriever_token";

// The backend issues a JWT at login. Every other endpoint requires it as
// an Authorization header, so we keep it alongside the user in sessionStorage.
export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing or blocked storage.
  }
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Shared handling so an expired token gives a clear message everywhere.
async function request(path, label) {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (res.status === 401) {
    throw new Error("Your session has expired. Please log in again.");
  }
  if (!res.ok) throw new Error(`Failed to load ${label}`);
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Invalid email or password");

  // The backend returns { access_token, token_type, user }.
  const data = await res.json();
  setToken(data.access_token);
  return data.user;
}

export async function getDepartments() {
  return request("/departmentInfo", "departments");
}

export async function getMetricTypes() {
  return request("/metricTypes", "metric types");
}

export async function getMetrics({ start, end, departmentId } = {}) {
  const params = new URLSearchParams();
  if (start) params.append("start", start);
  if (end) params.append("end", end);
  if (departmentId) params.append("department_id", departmentId);

  return request(`/metrics?${params}`, "metrics");
}

export async function getReach({ start, end, term } = {}) {
  const params = new URLSearchParams();
  if (start) params.append("start", start);
  if (end) params.append("end", end);
  if (term) params.append("term", term);
  return request(`/reach?${params}`, "reach");
}

export async function getReachByUnit({ start, end } = {}) {
  const params = new URLSearchParams();
  if (start) params.append("start", start);
  if (end) params.append("end", end);
  return request(`/reach/by-unit?${params}`, "reach by unit");
}

// Sends a CSV file to be saved. The backend decides the department from the
// logged-in user and returns a summary of what was saved and what was rejected.
export async function uploadMetricsCsv(file) {
  const form = new FormData();
  form.append("file", file);

  // No Content-Type header: the browser sets it, including the file boundary.
  const res = await fetch(`${API_URL}/metrics/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (res.status === 401) {
    throw new Error("Your session has expired. Please log in again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : null;
    throw new Error(detail ?? "The upload failed. Nothing was saved.");
  }
  return body;
}