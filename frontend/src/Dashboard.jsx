import "./Dashboard.css";
import ReachChart from "./ReachChart.jsx";
import Card from "./Card.jsx";
import "./Card.css";
import { useState, useEffect } from "react";
import CsvChart from "./CsvChart.jsx";
import { getMetrics } from "./api/api";
import { useAuth } from "./AuthContext";


function pivotMetrics(rows) {
  const byDate = {};
  for (const row of rows) {
    const date = row["Metric Date"];
    if (!byDate[date]) byDate[date] = { Date: date };
    byDate[date][row["Metric Type"]] = row["Count"];
  }
  return Object.values(byDate).sort((a, b) => a.Date.localeCompare(b.Date));
}

function Dashboard() {

  const [source, setSource] = useState("stored");
  const [metrics, setMetrics] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const { user, logout } = useAuth();

  useEffect(() => {
    getMetrics()
    .then((rows) => setMetrics(pivotMetrics(rows)))
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));
  }, []);

  return (
    <div className="Board">
      <div className="background"></div>
 
      <header className="page-header">
        <img className="umbc-logo" src="/UMBCLogo.jpeg" alt="logo" />
        <div className="title">Retriever Dashboard</div>
      </header>
 
      <div className="dashboard-box">
        <div className="source-toggle" role="group" aria-label="Data source">
          <button
            type="button"
            className={source === "stored" ? "source-button active" : "source-button"}
            aria-pressed={source === "stored"}
            onClick={() => setSource("stored")}
          >
            Stored metrics
          </button>

        </div>
 
        <div className="dashboard-row">

 
          <div className="chart-cell">
            {source === "stored" ? (
              <>
                {loading && <p>Loading metrics...</p>}
                {error && <p className="chart-error">Could not load metrics: {error}</p>}
                {!loading && !error && metrics.length === 0 && (
                  <p>No metrics stored yet.</p>
                )}
                {!loading && !error && metrics.length > 0 && (
                  <CsvChart
                    key="stored"
                    data={metrics}
                    dateKey="Date"
                    title="Stored metrics"
                    allowUpload={false}
                  />
                )}
              </>
            ) : (
              <CsvChart key="upload" dateKey="metric_date" title="Uploaded CSV" />
            )}
          </div>
 

        </div>
        <ReachChart />
      </div>
    </div>
  );
}
 
export default Dashboard;