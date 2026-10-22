const API_URL = "http://localhost:8000";

export async function getDepartments() {
  const res = await fetch(`${API_URL}/departmentInfo`);
  if (!res.ok) throw new Error("Failed to load departments");
  return res.json();
}

export async function getMetrics({ start, end, departmentId } = {}) {
  const params = new URLSearchParams();
  if (start) params.append("start", start);
  if (end) params.append("end", end);
  if (departmentId) params.append("department_id", departmentId);
  const res = await fetch(`${API_URL}/metrics?${params}`);
  if (!res.ok) throw new Error("Failed to load metrics");
  return res.json();
}