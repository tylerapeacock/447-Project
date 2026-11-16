import { useState } from "react";
import { Navigate } from "react-router-dom";
import Papa from "papaparse";
import CsvChart from "./CsvChart.jsx";
import { getMetrics, getDepartments, uploadMetricsCsv } from "./api/api.js";
import { useAuth } from "./AuthContext.jsx";
import { TRANSFER_ROLES } from "./Layout.jsx";
import "./Pages.css";

// ---------- Export helpers ----------

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

// ---------- Import preview helpers ----------

// Same two date formats the backend accepts: 2026-09-01 and 9/1/2026.
function normalizeDate(text) {
  const value = (text || "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return value;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

// One chart line per metric type, so the preview matches the dashboard.
// This is only a preview; the backend does the real checking on upload.
function previewRows(text) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const byDate = {};
  const types = new Set();
  let readable = 0;
  for (const row of parsed.data) {
    const type = (row.metric_type || "").trim();
    const date = normalizeDate(row.metric_date);
    const countText = (row.count || "").trim();
    // Same rule as the backend: a whole number, not empty, not negative.
    if (!type || !date || !/^\d+$/.test(countText)) continue;
    readable += 1;
    types.add(type);
    if (!byDate[date]) byDate[date] = { Date: date };
    byDate[date][type] = Number(countText);
  }
  return {
    total: parsed.data.length,
    readable,
    chart: Object.values(byDate).sort((a, b) => a.Date.localeCompare(b.Date)),
    // Listed explicitly and sorted, so every type is charted and keeps the
    // same color as on the dashboard.
    series: [...types].sort(),
  };
}

function plural(n, word) {
  return `${n.toLocaleString()} ${n === 1 ? word : word + "s"}`;
}

function UploadResult({ result }) {
  const saved = result["Rows Saved"];
  const rejected = result["Rows Rejected"];
  const status = result["Status"];

  const parts = [];
  if (result["Rows Added"]) parts.push(`${result["Rows Added"]} new`);
  if (result["Rows Updated"]) parts.push(`${result["Rows Updated"]} updated with new counts`);
  if (result["Rows Unchanged"]) parts.push(`${result["Rows Unchanged"]} already up to date`);

  return (
    <div className={`upload-result upload-result-${status}`} role="status">
      <p className="upload-result-headline">
        {status === "failed"
          ? "Nothing was saved."
          : status === "partial"
          ? `Saved ${saved} of ${result["Rows In File"]} rows. ${plural(rejected, "row")} need fixing.`
          : `Saved all ${plural(saved, "row")}.`}
      </p>
      {parts.length > 0 && <p className="upload-result-detail">{parts.join(", ")}.</p>}

      {result["Errors"].length > 0 && (
        <>
          <ul className="upload-errors">
            {result["Errors"].map((e) => (
              <li key={`${e.Row}-${e.Message}`}>
                <span className="upload-error-row">Row {e.Row}</span> {e.Message}
              </li>
            ))}
          </ul>
          {result["Errors Truncated"] && (
            <p className="upload-result-detail">
              Showing the first {result["Errors"].length} problems. Fix these and
              upload again to see the rest.
            </p>
          )}
          {status === "partial" && (
            <p className="upload-result-detail">
              Fix those rows and upload the whole file again. Rows that were
              already saved won't be counted twice.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function DataPage() {
  const { user } = useAuth();

  const [exportStatus, setExportStatus] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  if (!TRANSFER_ROLES.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleExport() {
    setExporting(true);
    setExportStatus(null);
    setExportError(null);
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

      setExportStatus(`Downloaded ${plural(rows.length, "record")}.`);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  function handleChoose(event) {
    const chosen = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again still triggers this
    if (!chosen) return;

    setResult(null);
    setUploadError(null);
    setFile(chosen);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = () => setPreview(previewRows(String(reader.result)));
    reader.onerror = () => setUploadError("Couldn't read that file.");
    reader.readAsText(chosen);
  }

  async function handleUpload() {
    setUploading(true);
    setResult(null);
    setUploadError(null);
    try {
      setResult(await uploadMetricsCsv(file));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Import & export</h1>

      <section className="page-card">
        <h2 className="page-card-title">Import</h2>
        <p className="page-text">
          Upload a CSV with three columns: <code>metric_type</code>,{" "}
          <code>metric_date</code>, and <code>count</code>. Rows are saved to
          your department. Uploading a corrected file replaces the old counts
          for the same dates instead of adding them twice.
        </p>

        <div className="upload-controls">
          <label className="page-button page-button-secondary upload-choose">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleChoose}
              className="visually-hidden"
            />
          </label>
          {file && <span className="upload-filename">{file.name}</span>}
        </div>

        {preview && (
          <>
            <p className="page-text upload-preview-note">
              {preview.readable === preview.total
                ? `${plural(preview.total, "row")} found.`
                : `${plural(preview.total, "row")} found. ${preview.total - preview.readable} can't be read and won't be saved. Uploading lists exactly what to fix.`}
            </p>
            {preview.chart.length > 0 && (
              <CsvChart
                key={file.name + file.lastModified}
                data={preview.chart}
                dateKey="Date"
                valueKeys={preview.series}
                title="Preview"
                allowUpload={false}
                height={300}
              />
            )}
          </>
        )}

        {file && (
          <button
            type="button"
            className="page-button upload-button"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading
              ? "Uploading…"
              : preview
              ? `Upload ${plural(preview.total, "row")} to the database`
              : "Upload to the database"}
          </button>
        )}

        {uploadError && <p className="page-status page-error">{uploadError}</p>}
        {result && <UploadResult result={result} />}
      </section>

      <section className="page-card">
        <h2 className="page-card-title">Export</h2>
        <p className="page-text">
          Download your department's metrics as a CSV file you can open in Excel.
        </p>
        <button type="button" className="page-button" onClick={handleExport} disabled={exporting}>
          {exporting ? "Preparing file…" : "Download CSV"}
        </button>
        {exportStatus && <p className="page-status">{exportStatus}</p>}
        {exportError && <p className="page-status page-error">{exportError}</p>}
      </section>
    </div>
  );
}

export default DataPage;