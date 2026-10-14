import { useState } from "react";

// Dates are ISO strings ("YYYY-MM-DD"), which is what <input type="date"> uses.
export default function DateRangeSelector({
  value,                 // optional: { start: "2026-01-01", end: "2026-01-31" }
  onChange,              // called with { start, end }
  min,                   // optional earliest selectable date
  max,                   // optional latest selectable date
  startLabel = "Start date",
  endLabel = "End date",
  idPrefix = "date-range",
}) {
  const [internal, setInternal] = useState({ start: "", end: "" });
  const isControlled = value !== undefined && value !== null;
  const range = isControlled ? value : internal;

  const update = (next) => {
    if (!isControlled) setInternal(next);
    if (onChange) onChange(next);
  };

  const handleStart = (e) => {
    const start = e.target.value;
    // If the new start is after the end, move the end to match.
    const end = range.end && start > range.end ? start : range.end;
    update({ start, end });
  };

  const handleEnd = (e) => {
    const end = e.target.value;
    // If the new end is before the start, move the start to match.
    const start = range.start && end < range.start ? end : range.start;
    update({ start, end });
  };

  const handleClear = () => update({ start: "", end: "" });

  const hasValue = range.start || range.end;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label htmlFor={`${idPrefix}-start`}>{startLabel}</label>
        <input
          id={`${idPrefix}-start`}
          type="date"
          value={range.start}
          min={min}
          max={range.end || max}
          onChange={handleStart}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label htmlFor={`${idPrefix}-end`}>{endLabel}</label>
        <input
          id={`${idPrefix}-end`}
          type="date"
          value={range.end}
          min={range.start || min}
          max={max}
          onChange={handleEnd}
        />
      </div>

      {hasValue && (
        <button type="button" onClick={handleClear}>
          Clear dates
        </button>
      )}
    </div>
  );
}
