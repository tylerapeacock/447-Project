import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// YOUR EXISTING COMPONENT
// Change the path/name to match your file. If its props differ from
// { startDate, endDate, onChange }, edit the <DateRangeSelector /> usage
// near the bottom of this file (look for "ADAPTER").
// ---------------------------------------------------------------------------
import DateRangeSelector from "./DateRangeSelector";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

// Parse "2024-03-15", "3/15/2024", ISO strings, etc. into a timestamp (ms).
// Plain YYYY-MM-DD is treated as local time so it doesn't shift a day.
function toTimestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string" && typeof value !== "number") return NaN;
  const str = String(value).trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]).getTime();
  return Date.parse(str);
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Timestamp -> "YYYY-MM-DD" (local time), the format the date selector uses.
function toInputDate(ts) {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Find the first column whose values parse as dates.
function detectDateKey(rows, columns) {
  const sample = rows.slice(0, 10);
  return columns.find(
    (col) =>
      sample.length > 0 &&
      sample.every((r) => r[col] != null && !Number.isNaN(toTimestamp(r[col])))
  );
}

/**
 * Props
 *  - csvUrl:    URL of a CSV file to load (optional)
 *  - csvText:   raw CSV string (optional)
 *  - data:      already-parsed array of row objects (optional)
 *  - dateKey:   name of the date column (auto-detected if omitted)
 *  - valueKeys: array of numeric columns to plot (auto-detected if omitted)
 *  - title:     heading shown above the chart
 *  - width:     chart width. "100%" (responsive) or a number like 900 for a fixed size
 *  - height:    chart height in px
 *  - allowUpload: show a "Choose CSV" file input
 */
export default function CsvChart({
  csvUrl,
  csvText,
  data,
  dateKey,
  valueKeys,
  title = "Data over time",
  width = "100%",
  height = 400,
  allowUpload = true,
}) {
  const [rawRows, setRawRows] = useState(data || []);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState("line");
  const [hidden, setHidden] = useState({}); // series the user turned off
  const [range, setRange] = useState({ startDate: null, endDate: null });

  // ---- Loading ------------------------------------------------------------
  const parseCsv = (text) => {
    const result = Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });
    if (result.errors.length && result.data.length === 0) {
      setError("Could not parse that CSV file.");
      return;
    }
    setError(null);
    setRawRows(result.data);
    setRange({ startDate: null, endDate: null }); // reset filter for new data
  };

  useEffect(() => {
    if (data) setRawRows(data);
  }, [data]);

  useEffect(() => {
    if (csvText) parseCsv(csvText);
  }, [csvText]);

  useEffect(() => {
    if (!csvUrl) return;
    let cancelled = false;
    setLoading(true);
    fetch(csvUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.text();
      })
      .then((text) => !cancelled && parseCsv(text))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [csvUrl]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseCsv(String(reader.result));
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  };

  // ---- Derive columns -----------------------------------------------------
  const columns = useMemo(
    () => (rawRows.length ? Object.keys(rawRows[0]) : []),
    [rawRows]
  );

  const xKey = dateKey || detectDateKey(rawRows, columns);

  const seriesKeys = useMemo(() => {
    if (valueKeys) return valueKeys;
    return columns.filter(
      (col) =>
        col !== xKey &&
        rawRows.slice(0, 10).some((r) => typeof r[col] === "number")
    );
  }, [valueKeys, columns, xKey, rawRows]);

  // Rows with a numeric timestamp, sorted by date.
  const datedRows = useMemo(() => {
    if (!xKey) return [];
    return rawRows
      .map((r) => ({ ...r, __ts: toTimestamp(r[xKey]) }))
      .filter((r) => !Number.isNaN(r.__ts))
      .sort((a, b) => a.__ts - b.__ts);
  }, [rawRows, xKey]);

  const bounds = useMemo(
    () =>
      datedRows.length
        ? {
            min: datedRows[0].__ts,
            max: datedRows[datedRows.length - 1].__ts,
          }
        : null,
    [datedRows]
  );

  // ---- Date range filtering ----------------------------------------------
  const filtered = useMemo(() => {
    const start = range.startDate ? toTimestamp(range.startDate) : -Infinity;
    // Include the whole end day.
    const end = range.endDate
      ? toTimestamp(range.endDate) + 24 * 60 * 60 * 1000 - 1
      : Infinity;
    return datedRows.filter((r) => r.__ts >= start && r.__ts <= end);
  }, [datedRows, range]);

  const toggleSeries = (key) =>
    setHidden((h) => ({ ...h, [key]: !h[key] }));

  // ADAPTER: your selector uses { start, end } as "YYYY-MM-DD" strings;
  // the chart state uses { startDate, endDate }.
  const selector = (
    <DateRangeSelector
      value={{
        start: range.startDate || "",
        end: range.endDate || "",
      }}
      min={bounds ? toInputDate(bounds.min) : undefined}
      max={bounds ? toInputDate(bounds.max) : undefined}
      onChange={({ start, end }) =>
        setRange({ startDate: start || null, endDate: end || null })
      }
      idPrefix={`chart-range-${title.replace(/\s+/g, "-").toLowerCase()}`}
    />
  );

  // ---- Render -------------------------------------------------------------
  const ChartComponent = chartType === "line" ? LineChart : BarChart;

  const chartBody = (
    <ChartComponent data={filtered} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis
        dataKey="__ts"
        type={chartType === "line" ? "number" : "category"}
        domain={["dataMin", "dataMax"]}
        scale={chartType === "line" ? "time" : "auto"}
        tickFormatter={formatDate}
        minTickGap={32}
      />
      <YAxis />
      <Tooltip labelFormatter={formatDate} />
      <Legend />
      {seriesKeys.map((key, i) =>
        chartType === "line" ? (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={filtered.length < 60}
            hide={!!hidden[key]}
            isAnimationActive={false}
          />
        ) : (
          <Bar
            key={key}
            dataKey={key}
            fill={COLORS[i % COLORS.length]}
            hide={!!hidden[key]}
            isAnimationActive={false}
          />
        )
      )}
    </ChartComponent>
  );

  return (
    <section style={styles.wrap}>
      <header style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        <div style={styles.controls}>
          <div role="group" aria-label="Chart type" style={styles.toggleGroup}>
            {["line", "bar"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setChartType(type)}
                aria-pressed={chartType === type}
                style={{
                  ...styles.toggle,
                  ...(chartType === type ? styles.toggleActive : null),
                }}
              >
                {type === "line" ? "Line" : "Bar"}
              </button>
            ))}
          </div>
          {allowUpload && (
            <label style={styles.upload}>
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                style={{ display: "none" }}
              />
            </label>
          )}
        </div>
      </header>

      <div style={styles.selectorRow}>{selector}</div>

      {loading && <p style={styles.message}>Loading data…</p>}
      {error && (
        <p role="alert" style={{ ...styles.message, color: "#b91c1c" }}>
          {error}
        </p>
      )}

      {!loading && !error && rawRows.length === 0 && (
        <p style={styles.message}>
          No data yet. Choose a CSV file with a date column and at least one numeric column.
        </p>
      )}

      {!loading && rawRows.length > 0 && !xKey && (
        <p role="alert" style={{ ...styles.message, color: "#b91c1c" }}>
          No date column found. Pass a <code>dateKey</code> prop with the name of your date column.
        </p>
      )}

      {xKey && seriesKeys.length > 0 && (
        <>
          <div style={styles.seriesRow}>
            {seriesKeys.map((key, i) => (
              <label key={key} style={styles.seriesLabel}>
                <input
                  type="checkbox"
                  checked={!hidden[key]}
                  onChange={() => toggleSeries(key)}
                />
                <span
                  style={{
                    ...styles.swatch,
                    background: COLORS[i % COLORS.length],
                  }}
                />
                {key}
              </label>
            ))}
          </div>

          <p style={styles.summary}>
            Showing {filtered.length} of {datedRows.length} rows
            {bounds && ` (${formatDate(bounds.min)} to ${formatDate(bounds.max)} available)`}
          </p>

          {filtered.length === 0 ? (
            <p style={styles.message}>No rows fall inside the selected date range.</p>
          ) : typeof width === "number" ? (
            // Fixed size: won't resize with the window
            <div style={{ width, height }}>
              <ChartComponent
                width={width}
                height={height}
                data={filtered}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              >
                {chartBody.props.children}
              </ChartComponent>
            </div>
          ) : (
            // Responsive: fills its container
            <div style={{ width, height }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartBody}
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Inline styles so the file works without a separate stylesheet.
// Move these to your own CSS if you prefer.
const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: 5 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 600 },
  controls: { display: "flex", gap: 8, alignItems: "center" },
  toggleGroup: { display: "inline-flex", border: "1px solid #d1d5db", borderRadius: 6, overflow: "hidden" },
  toggle: { padding: "6px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 14 },
  toggleActive: { background: "#1f2937", color: "#fff" },
  upload: { padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  selectorRow: { marginBottom: 12 },
  seriesRow: { display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 8 },
  seriesLabel: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" },
  swatch: { width: 10, height: 10, borderRadius: 2, display: "inline-block" },
  summary: { fontSize: 13, color: "#6b7280", margin: "0 0 8px" },
  message: { fontSize: 14, color: "#4b5563", margin: "12px 0" },
};
