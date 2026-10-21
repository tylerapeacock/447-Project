import "./Dashboard.css";
import Card from "./Card.jsx";
import "./Card.css";
import SafeTextInput from "./SafeTextInput.jsx";
import DateRangeSelector from "./DateRangeSelector.jsx";
import { useState } from "react";
import CsvChart from "./CsvChart.jsx";

function Dashboard() {
  const [name, setName] = useState("");
  const [range, setRange] = useState({ start: "", end: "" });

  return (
    <div className="Board">
      <div className="background"></div>

      <header className="page-header">
        <img className="umbc-logo" src="/UMBCLogo.jpeg" alt="logo"></img>
        <div className="title">Retriever Dashboard</div>
      </header>
      <div className="dashboard-box">
        <div className="dashboard-row">
          <aside className="stats-panel">
            <Card />
          </aside>
          <div className="chart-cell">
            <CsvChart csvUrl="/data/sales.csv" />
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
