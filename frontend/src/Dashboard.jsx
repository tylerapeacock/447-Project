import "./Dashboard.css";
import Card from "./Card.jsx";
import "./Card.css";
import SafeTextInput from "./SafeTextInput.jsx";
import DateRangeSelector from "./DateRangeSelector.jsx";
import { useState, useEffect } from "react";
import CsvChart from "./CsvChart.jsx";
import { getMetrics } from "./api/api";
import { useAuth } from "./AuthContext";

function Dashboard() {
  const [name, setName] = useState("");
  const [range, setRange] = useState({ start: "", end: "" });
  const [metrics, setMetrics] = useState([]);
  const { user, logout } = useAuth();

  useEffect(() => {
    getMetrics({ start: range.start, end: range.end }).then(setMetrics);
  }, [range.start, range.end]);

  return (
    <div className="Board">
      <div className="background"></div>

      <header className="page-header">
        <img className="umbc-logo" src="/UMBCLogo.jpeg" alt="logo"></img>

        <div className="title">Retriever Dashboard</div>
        <button className="logout-button" onClick={logout}>Log out</button> {/*LOGOUT BUTTTONNNNNN WOOOO*/}
      </header>
      <div className="dashboard-box">
        <div className="dashboard-row">
          <aside className="stats-panel">
            <Card />
          </aside>
          <div className="chart-cell">
            <CsvChart data={metrics} />
          </div>
          <aside className="stats-panel">
            <Card />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
