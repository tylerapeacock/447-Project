import './Dashboard.css';
import Card from './Card.jsx'
import './Card.css'
import SafeTextInput from './SafeTextInput.jsx';
import DateRangeSelector from './DateRangeSelector.jsx';
import {useState} from "react";



function Dashboard() {
  const [name, setName] = useState("");
  const [range, setRange] = useState({ start: "", end: "" });

  return (
    <div className="Board">
      <div className="background"></div>
      <div className="title">Retriever Dashboard</div>
      <div className="dashboard-box">
        <Card/>
        <SafeTextInput label="Display name"
        value={name}
        onChange={setName}
        maxLength={50}
        placeholder='Enter Text'>
        </SafeTextInput>
        <DateRangeSelector value={range} onChange={setRange} />
        <p>Selected: {range.start || "—"} to {range.end || "—"}</p>
      </div>
    </div>
  );
}

export default Dashboard;