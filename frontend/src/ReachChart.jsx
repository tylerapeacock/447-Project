import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { getReach, getReachByUnit } from "./api/api";
import "./ReachChart.css";

// Two categorical slots, validated for color-blind separation and contrast.
const ONE_TIME = { key: "One-time Students", label: "One-time", color: "#2a78d6" };
const RETURNING = { key: "Returning Students", label: "Returning", color: "#eb6834" };
const SERIES = [ONE_TIME, RETURNING];

const GAP = 2; // surface-colored gap between stacked segments
const RADIUS = 4; // rounded data-end, square at the baseline

// The outermost non-empty segment of a row gets the rounded end.
function isOuterSegment(row, key) {
  if (key === RETURNING.key) return row[RETURNING.key] > 0;
  return row[RETURNING.key] === 0;
}

function SegmentShape({ x, y, width, height, fill, payload, dataKey }) {
  if (!width || width <= 0) return null;
  // Every segment after the first starts a gap's width later.
  const inset = dataKey === ONE_TIME.key ? 0 : GAP;
  const left = x + inset;
  const w = width - inset;
  if (w <= 0) return null;

  if (!isOuterSegment(payload, dataKey)) {
    return <rect x={left} y={y} width={w} height={height} fill={fill} />;
  }
  const r = Math.min(RADIUS, w, height / 2);
  const right = left + w;
  const d =
    `M${left},${y} H${right - r} Q${right},${y} ${right},${y + r} ` +
    `V${y + height - r} Q${right},${y + height} ${right - r},${y + height} ` +
    `H${left} Z`;
  return <path d={d} fill={fill} />;
}

function TotalLabel({ x, y, width, height, index, rows }) {
  const row = rows[index];
  if (!row) return null;
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      dominantBaseline="central"
      className="reach-chart-end-label"
    >
      {row["Unique Students"]}
    </text>
  );
}

function ReachTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="reach-chart-tooltip">
      <div className="reach-chart-tooltip-title">{row.Department}</div>
      {SERIES.map((s) => (
        <div key={s.key} className="reach-chart-tooltip-row">
          <span className="reach-chart-swatch" style={{ background: s.color }} />
          <span>{s.label}</span>
          <span className="reach-chart-tooltip-value">{row[s.key]}</span>
        </div>
      ))}
      <div className="reach-chart-tooltip-row reach-chart-tooltip-total">
        <span />
        <span>Unique students</span>
        <span className="reach-chart-tooltip-value">{row["Unique Students"]}</span>
      </div>
    </div>
  );
}

function ReachChart({ start, end }) {
  const [units, setUnits] = useState([]);
  const [reach, setReach] = useState(null);
  const [threshold, setThreshold] = useState(5);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getReachByUnit({ start, end }), getReach({ start, end })])
      .then(([byUnit, totals]) => {
        setUnits(byUnit["Units"]);
        setThreshold(byUnit["Suppression Threshold"]);
        setReach(totals);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [start, end]);

  const shown = units
    .filter((u) => u["Hidden"] === null && u["Unique Students"] > 0)
    .sort((a, b) => b["Unique Students"] - a["Unique Students"]);
  const noVisits = units.filter((u) => u["Hidden"] === null && u["Unique Students"] === 0);
  const hiddenAll = units.filter((u) => u["Hidden"] === "all");
  const hiddenSplit = units.filter((u) => u["Hidden"] === "split");
  const anyHidden = hiddenAll.length > 0 || hiddenSplit.length > 0;
  const portfolio = reach && reach["Scope"] === "portfolio";
  const overlap = reach ? reach["Served By Multiple Units"] : null;

  return (
    <section className="reach-chart">
      <div className="reach-chart-head">
        <h2 className="reach-chart-title">Students reached by unit</h2>
        <p className="reach-chart-subtitle">
          Unique students who used each unit. Returning students visited the
          same unit two or more times.
        </p>
      </div>

      {loading && <p className="reach-chart-state">Loading…</p>}
      {error && <p className="reach-chart-state reach-chart-error">{error}</p>}

      {!loading && !error && (
        <>
          {portfolio && (
            <p className="reach-chart-overlap">
              {overlap === null
                ? `Fewer than ${threshold} students used more than one unit.`
                : `${overlap} ${overlap === 1 ? "student" : "students"} used more than one unit.`}
            </p>
          )}

          {shown.length === 0 ? (
            <p className="reach-chart-state">
              {anyHidden
                ? "No unit has enough students in this period to chart without risking identifying someone."
                : "No visits recorded in this period."}
            </p>
          ) : (
            <div style={{ width: "100%", height: shown.length * 48 + 64 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={shown}
                  layout="vertical"
                  margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
                  barCategoryGap={12}
                >
                  <CartesianGrid horizontal={false} stroke="#e9e7e2" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b655c", fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="Department"
                    width={190}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#1c1a17", fontSize: 13 }}
                  />
                  <Tooltip content={<ReachTooltip />} cursor={{ fill: "#f3f1ec" }} />
                  <Legend
                    verticalAlign="top"
                    align="left"
                    height={32}
                    iconType="square"
                    iconSize={10}
                    formatter={(value) => (
                      <span className="reach-chart-legend-text">{value}</span>
                    )}
                  />
                  <Bar
                    dataKey={ONE_TIME.key}
                    name={ONE_TIME.label}
                    stackId="reach"
                    fill={ONE_TIME.color}
                    barSize={20}
                    shape={<SegmentShape dataKey={ONE_TIME.key} />}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey={RETURNING.key}
                    name={RETURNING.label}
                    stackId="reach"
                    fill={RETURNING.color}
                    barSize={20}
                    shape={<SegmentShape dataKey={RETURNING.key} />}
                    isAnimationActive={false}
                  >
                    <LabelList content={<TotalLabel rows={shown} />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {(anyHidden || noVisits.length > 0) && (
            <ul className="reach-chart-hidden">
              {hiddenSplit.map((u) => (
                <li key={u["Department ID"]}>
                  {u["Department"]}: {u["Unique Students"]} students. The
                  one-time and returning split is hidden because one group has
                  fewer than {threshold}.
                </li>
              ))}
              {hiddenAll.map((u) => (
                <li key={u["Department ID"]}>
                  {u["Department"]}: hidden, fewer than {threshold} students.
                </li>
              ))}
              {noVisits.length > 0 && (
                <li>
                  No visits recorded:{" "}
                  {noVisits.map((u) => u["Department"]).join(", ")}.
                </li>
              )}
            </ul>
          )}

          {units.length > 0 && (
            <details className="reach-chart-table-toggle">
              <summary>View as table</summary>
              <table className="reach-chart-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th className="num">Unique students</th>
                    <th className="num">One-time</th>
                    <th className="num">Returning</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u["Department ID"]}>
                      <td>{u["Department"]}</td>
                      <td className="num">{u["Unique Students"] ?? "Hidden"}</td>
                      <td className="num">{u["One-time Students"] ?? "Hidden"}</td>
                      <td className="num">{u["Returning Students"] ?? "Hidden"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}
    </section>
  );
}

export default ReachChart;