import { useState } from "react";
import { Navigate } from "react-router-dom";
import CsvChart from "./CsvChart.jsx";
import { getMetrics, getDepartments } from "./api/api.js";
import { useAuth } from "./AuthContext.jsx";
import { TRANSFER_ROLES } from "./Layout.jsx";
import "./Pages.css";

// Quote a CSV field when it contains a comma, quote, or line break.
function csvField(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, columns) {
  const lines = [columns.map(csvField).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvField(row[c])).join(","));
  }
  return lines.join("\r\n");
}

function today() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function DataPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!TRANSFER_ROLES.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleExport() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const [rows, departments] = await Promise.all([getMetrics(), getDepartments()]);
      const names = {};
      for (const d of departments) names[d["Department ID"]] = d["Department Name"];

      const withNames = rows.map((r) => ({
        ...r,
        Department: names[r["Department ID"]] ?? "",
      }));
      const columns = ["Metric Date", "Department", "Metric Type", "Count", "Department ID", "Metric ID"];
      const blob = new Blob([toCsv(withNames, columns)], { type: "text/csv;charset=utf-8" });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `retriever-metrics-${today()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setStatus(`Downloaded ${rows.length} ${rows.length === 1 ? "record" : "records"}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Import & export</h1>

      <section className="page-card">
        <h2 className="page-card-title">Export</h2>
        <p className="page-text">
          Download your department's metrics as a CSV file you can open in Excel.
        </p>
        <button type="button" className="page-button" onClick={handleExport} disabled={busy}>
          {busy ? "Preparing file…" : "Download CSV"}
        </button>
        {status && <p className="page-status">{status}</p>}
        {error && <p className="page-status page-error">{error}</p>}
      </section>

      <section className="page-card">
        <h2 className="page-card-title">Import</h2>
        <p className="page-text">
          Choose a department CSV to preview it as a chart. Previewing doesn't
          save anything. Saving uploads to the database isn't available yet.
        </p>
        <CsvChart dateKey="metric_date" title="CSV preview" />
      </section>
    </div>
  );
}

export default DataPage;