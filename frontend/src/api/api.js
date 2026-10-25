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
  const data = await res.json();
  setToken(data.access_token);
  return data.user;
}

export async function getDepartments() {
  return request("/departmentInfo", "departments");
}

export async function getMetrics({ start, end, departmentId } = {}) {
  const params = new URLSearchParams();
  if (start) params.append("start", start);
  if (end) params.append("end", end);
  if (departmentId) params.append("department_id", departmentId);

  return request(`/metrics?${params}`, "metrics");
}
 
export async function getMetricTypes() {
  return request("/metricTypes", "metric types");
}