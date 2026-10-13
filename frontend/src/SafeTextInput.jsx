import { useState } from "react";

// Removes HTML tags and control characters, collapses leading whitespace.
export function sanitize(value) {
  return value
    .replace(/<[^>]*>/g, "")                      // strip HTML tags
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // control chars
    .replace(/^\s+/, "");                         // no leading whitespace
}

export default function SafeTextInput({
  label,
  value: controlledValue,
  onChange,
  maxLength = 100,
  placeholder = "",
  id = "safe-text-input",
}) {
  const [internalValue, setInternalValue] = useState("");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleChange = (e) => {
    const clean = sanitize(e.target.value).slice(0, maxLength);
    if (!isControlled) setInternalValue(clean);
    if (onChange) onChange(clean);
  };

  // Sanitize pasted text too (the change handler covers it, but this avoids
  // briefly accepting very large pastes).
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted.length > maxLength * 10) e.preventDefault();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 360 }}>
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        style={{ padding: "8px 10px", fontSize: 16 }}
      />
      <small aria-live="polite">
        {value.length} / {maxLength}
      </small>
    </div>
  );
}
